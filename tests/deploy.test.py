import fcntl
import os
from pathlib import Path
import subprocess
import tempfile
import unittest

SCRIPT = Path(__file__).resolve().parents[1] / 'scripts/deploy/poll-and-deploy.sh'


class DeploymentTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.origin = self.root / 'origin'
        self.repo = self.root / 'checkout'
        self.state = self.root / 'state'
        self.bin = self.root / 'bin'
        self.bin.mkdir()
        self.log = self.root / 'docker.log'
        self.git('init', '-b', 'main', str(self.origin))
        self.git('-C', str(self.origin), 'config', 'user.email', 'test@example.com')
        self.git('-C', str(self.origin), 'config', 'user.name', 'Test')
        (self.origin / '.gitignore').write_text('.env\n')
        (self.origin / 'compose.yaml').write_text('services:\n  web:\n    image: test\n')
        self.commit('initial')
        self.git('clone', str(self.origin), str(self.repo))
        (self.repo / '.env').write_text('VITE_SUPABASE_URL=https://test.invalid\n')
        docker = self.bin / 'docker'
        docker.write_text('''#!/usr/bin/env bash
set -eu
printf '%s\\n' "$*" >> "$DOCKER_LOG"
if [[ "$1" == inspect ]]; then
  case "$3" in
    *Config.Image*) echo ep7-web;;
    *platform.os*) echo linux/arm64;;
    *ImageManifestDescriptor.digest*) echo sha256:manifest;;
    *) echo sha256:old;;
  esac
  exit
fi
if [[ "$1" == image ]]; then
  if [[ "$2" == inspect ]]; then
    case "$*" in
      *sha256:old*) [[ "${CONTAINERD_IMAGES:-0}" != 1 ]];;
      *--platform*)
        if [[ "${MISMATCH_IMAGE:-0}" == 1 ]]; then echo sha256:different;
        else echo sha256:manifest; fi;;
      *) echo sha256:index;;
    esac
  fi
  exit
fi
case " $* " in
  *" ps -q web "*) echo container-id;;
  *" config "*) cat "$TEST_REPO/compose.yaml";;
  *" build --pull web "*) [[ "${FAIL_BUILD:-0}" != 1 ]];;
  *" up "*)
    if [[ "$*" == *rollback-image.yaml* ]]; then exit 0; fi
    [[ "${FAIL_UP:-0}" != 1 ]];;
esac
''')
        docker.chmod(0o755)
        self.env = dict(os.environ, PATH=f'{self.bin}:{os.environ["PATH"]}', DOCKER_LOG=str(self.log), TEST_REPO=str(self.repo))

    def git(self, *args):
        return subprocess.check_output(['git', *args], stderr=subprocess.DEVNULL, text=True).strip()

    def commit(self, message):
        self.git('-C', str(self.origin), 'add', '.')
        self.git('-C', str(self.origin), 'commit', '-m', message)
        return self.git('-C', str(self.origin), 'rev-parse', 'HEAD')

    def update(self):
        (self.origin / 'version').write_text('new release')
        return self.commit('update')

    def run_deploy(self, **env):
        return subprocess.run(['bash', str(SCRIPT), str(self.repo), str(self.state), 'ep7'], env={**self.env, **env}, capture_output=True, text=True)

    def test_deploys_new_main_and_skips_unchanged_commit(self):
        sha = self.update()
        result = self.run_deploy()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual((self.state / 'deployed-sha').read_text().strip(), sha)
        calls = self.log.read_text()
        self.assertIn('build --pull web', calls)
        self.assertIn('up -d --no-build --wait --wait-timeout 120 web', calls)
        self.assertNotIn(' down', calls)
        self.assertEqual(self.run_deploy().returncode, 0)
        self.assertEqual(self.log.read_text(), calls)

    def test_failed_build_leaves_container_and_retries_same_commit(self):
        sha = self.update()
        self.assertNotEqual(self.run_deploy(FAIL_BUILD='1').returncode, 0)
        self.assertNotIn(' up ', self.log.read_text())
        self.assertFalse((self.state / 'deployed-sha').exists())
        self.assertEqual(self.git('-C', str(self.repo), 'rev-parse', 'HEAD'), sha)
        self.assertEqual(self.run_deploy().returncode, 0)
        self.assertEqual((self.state / 'deployed-sha').read_text().strip(), sha)

    def test_containerd_image_is_preserved_by_verified_index_id(self):
        sha = self.update()
        result = self.run_deploy(CONTAINERD_IMAGES='1')
        self.assertEqual(result.returncode, 0, result.stderr)
        calls = self.log.read_text()
        self.assertIn('image inspect --platform linux/arm64 --format {{.Id}} sha256:index', calls)
        self.assertIn('image tag sha256:index ep7-web:rollback', calls)
        self.assertEqual((self.state / 'deployed-sha').read_text().strip(), sha)

    def test_changed_image_tag_cannot_be_used_for_rollback(self):
        before = self.git('-C', str(self.repo), 'rev-parse', 'HEAD')
        self.update()
        result = self.run_deploy(CONTAINERD_IMAGES='1', MISMATCH_IMAGE='1')
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('rollback image does not match', result.stdout)
        calls = self.log.read_text()
        self.assertNotIn('image tag', calls)
        self.assertNotIn('build --pull', calls)
        self.assertNotIn(' up ', calls)
        self.assertEqual(self.git('-C', str(self.repo), 'rev-parse', 'HEAD'), before)

    def test_unhealthy_container_rolls_back_and_preserves_last_success(self):
        self.assertEqual(self.run_deploy().returncode, 0)
        previous = (self.state / 'deployed-sha').read_text()
        config = (self.state / 'last-good-compose.yaml').read_text()
        self.update()
        result = self.run_deploy(FAIL_UP='1')
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('Previous container restored', result.stdout)
        self.assertIn('rollback-image.yaml up', self.log.read_text())
        self.assertEqual((self.state / 'deployed-sha').read_text(), previous)
        self.assertEqual((self.state / 'last-good-compose.yaml').read_text(), config)
        self.assertEqual(self.run_deploy().returncode, 0)

    def test_dirty_checkout_is_never_overwritten(self):
        (self.repo / 'compose.yaml').write_text('local changes')
        self.assertNotEqual(self.run_deploy().returncode, 0)
        self.assertFalse(self.log.exists())
        self.assertEqual((self.repo / 'compose.yaml').read_text(), 'local changes')

    def test_diverged_main_is_never_reset(self):
        self.git('-C', str(self.repo), '-c', 'user.name=Test', '-c', 'user.email=test@example.com', 'commit', '--allow-empty', '-m', 'local')
        before = self.git('-C', str(self.repo), 'rev-parse', 'HEAD')
        self.update()
        self.assertNotEqual(self.run_deploy().returncode, 0)
        self.assertEqual(self.git('-C', str(self.repo), 'rev-parse', 'HEAD'), before)
        self.assertFalse(self.log.exists())

    def test_overlapping_poll_skips(self):
        self.state.mkdir()
        with (self.state / 'deploy.lock').open('w') as lock:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
            result = self.run_deploy()
        self.assertEqual(result.returncode, 0)
        self.assertIn('Another deployment is running', result.stdout)
        self.assertFalse(self.log.exists())


if __name__ == '__main__':
    unittest.main()

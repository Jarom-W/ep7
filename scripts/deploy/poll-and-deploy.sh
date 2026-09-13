#!/usr/bin/env bash
# Run as the checkout owner, with Docker access and noninteractive Git credentials.
set -Eeuo pipefail
umask 077
repo=${1:?Usage: poll-and-deploy.sh REPO STATE_DIR COMPOSE_PROJECT}
state=${2:?Missing state directory}
project=${3:?Missing Compose project name}
mkdir -p "$state"
state=$(cd "$state" && pwd)
exec 9>"$state/deploy.lock"
flock -n 9 || { echo 'Another deployment is running; skipping.'; exit 0; }
cd "$repo"
repo=$(pwd)
export GIT_TERMINAL_PROMPT=0
export GIT_SSH_COMMAND='ssh -o BatchMode=yes -o ConnectTimeout=20'
log() { printf '%s %s\n' "$(date -Is)" "$*"; }
compose() { docker compose --project-name "$project" --project-directory "$repo" -f "$repo/compose.yaml" "$@"; }
[[ $(git branch --show-current) == main ]] || { log 'Refusing to deploy: checkout must be on main.'; exit 1; }
[[ -z $(git status --porcelain) ]] || { log 'Refusing to deploy: commit or move local changes first.'; exit 1; }
[[ -f .env ]] || { log 'Missing .env with the public Supabase build settings.'; exit 1; }
git fetch --no-tags origin main
candidate=$(git rev-parse FETCH_HEAD)
git merge-base --is-ancestor HEAD "$candidate" || { log 'Local main has diverged; refusing to overwrite it.'; exit 1; }
if [[ -f "$state/deployed-sha" && $(cat "$state/deployed-sha") == "$candidate" ]]; then
  log "Already deployed $candidate."
  exit 0
fi

# Preserve the running image and its last successful configuration before rebuilding.
container=$(compose ps -q web)
rollback_available=0
if [[ -n "$container" ]]; then
  image=$(docker inspect --format '{{.Image}}' "$container")
  if ! docker image inspect "$image" >/dev/null 2>&1; then
    # The containerd store exposes index/manifest IDs instead of the container's
    # config digest. Resolve its named image, then verify it still matches the
    # running platform manifest before preserving the immutable index ID.
    source=$(docker inspect --format '{{.Config.Image}}' "$container")
    manifest=$(docker inspect --format '{{.ImageManifestDescriptor.digest}}' "$container")
    platform=$(docker inspect --format '{{.ImageManifestDescriptor.platform.os}}/{{.ImageManifestDescriptor.platform.architecture}}{{with index .ImageManifestDescriptor.platform "variant"}}/{{.}}{{end}}' "$container")
    image=$(docker image inspect --format '{{.Id}}' "$source")
    actual=$(docker image inspect --platform "$platform" --format '{{.Id}}' "$image")
    [[ -n "$manifest" && "$actual" == "$manifest" ]] || { log 'Refusing to deploy: rollback image does not match the running container.'; exit 1; }
  fi
  docker image tag "$image" "$project-web:rollback"
  if [[ ! -f "$state/last-good-compose.yaml" ]]; then
    compose config > "$state/last-good-compose.yaml.tmp"
    mv "$state/last-good-compose.yaml.tmp" "$state/last-good-compose.yaml"
  fi
  printf 'services:\n  web:\n    image: %s-web:rollback\n' "$project" > "$state/rollback-image.yaml"
  rollback_available=1
fi
replacing=0
rollback() {
  result=$?
  trap - EXIT
  if (( result != 0 && replacing )); then
    if (( rollback_available )); then
      log 'Deployment failed; restoring the previous container.'
      if docker compose --project-name "$project" --project-directory "$repo" -f "$state/last-good-compose.yaml" -f "$state/rollback-image.yaml" up -d --no-build --wait --wait-timeout 120 web; then
        log 'Previous container restored. The next poll will retry the new commit.'
      else
        log 'ROLLBACK FAILED: inspect Docker and the service journal immediately.'
      fi
    else
      log 'Deployment failed; no previous container was available for rollback.'
    fi
  fi
  exit "$result"
}
trap rollback EXIT
trap 'exit 143' TERM
trap 'exit 130' INT
log "Deploying $candidate."
git merge --ff-only "$candidate"
# Keep the live container running while building; never run compose down.
compose config > "$state/candidate-compose.yaml"
compose build --pull web
replacing=1
compose up -d --no-build --wait --wait-timeout 120 web
# Only mark a commit deployed after Docker's nginx health check succeeds.
cp "$state/candidate-compose.yaml" "$state/last-good-compose.yaml.tmp"
mv "$state/last-good-compose.yaml.tmp" "$state/last-good-compose.yaml"
printf '%s\n' "$candidate" > "$state/deployed-sha.tmp"
mv "$state/deployed-sha.tmp" "$state/deployed-sha"
replacing=0
log "Healthy deployment completed: $candidate."

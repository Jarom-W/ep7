#!/usr/bin/env bash
set -Eeuo pipefail
repo=$(realpath "${1:?Pass the absolute app checkout path}")
user=${2:-$(id -un)}
project=${3:-$(basename "$repo")}
[[ "$repo" =~ ^/[a-zA-Z0-9_./-]+$ && "$user" =~ ^[a-z_][a-z0-9_-]*[$]?$ && "$project" =~ ^[a-z0-9][a-z0-9_-]*$ ]] || { echo 'Use a checkout path without spaces and a valid user/project name.'; exit 1; }
id "$user" >/dev/null
if [[ $EUID != 0 && "$user" != "$(id -un)" ]]; then echo 'User installation must run as the specified account.'; exit 1; fi
as_user() { if [[ $EUID == 0 ]]; then runuser -u "$user" -- "$@"; else "$@"; fi; }
for command in git docker flock systemctl runuser; do command -v "$command" >/dev/null; done
[[ -f "$repo/.env" && -f "$repo/compose.yaml" ]] || { echo 'The checkout needs compose.yaml and .env.'; exit 1; }
[[ $(as_user git -C "$repo" branch --show-current) == main ]] || { echo 'Switch the checkout to main first.'; exit 1; }
[[ -z $(as_user git -C "$repo" status --porcelain) ]] || { echo 'Commit or move local checkout changes first.'; exit 1; }
as_user docker info >/dev/null
as_user docker compose up --help | grep -q -- '--wait-timeout' || { echo 'Upgrade the Docker Compose plugin to support --wait-timeout.'; exit 1; }
as_user env GIT_TERMINAL_PROMPT=0 GIT_SSH_COMMAND='ssh -o BatchMode=yes -o ConnectTimeout=20' git -C "$repo" ls-remote --exit-code origin refs/heads/main >/dev/null
source_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
if [[ $EUID == 0 ]]; then
  state=/var/lib/ready-together-deploy
  install -d -m 700 -o "$user" -g "$(id -gn "$user")" "$state"
  install -d -m 755 /usr/local/lib/ready-together
  install -m 755 "$source_dir/poll-and-deploy.sh" /usr/local/lib/ready-together/poll-and-deploy.sh
  printf 'REPO_DIR=%s\nSTATE_DIR=%s\nCOMPOSE_PROJECT=%s\n' "$repo" "$state" "$project" > /etc/ready-together-deploy.conf
  chmod 600 /etc/ready-together-deploy.conf
  sed "s/@USER@/$user/g" "$source_dir/ready-together-deploy.service" > /etc/systemd/system/ready-together-deploy.service
  install -m 644 "$source_dir/ready-together-deploy.timer" /etc/systemd/system/ready-together-deploy.timer
  manager=(systemctl)
else
  [[ $(loginctl show-user "$user" -p Linger --value) == yes ]] || { echo "Enable reboot/logout persistence once: sudo loginctl enable-linger $user"; exit 1; }
  state="$HOME/.local/state/ready-together-deploy"
  install -d -m 700 "$state" "$HOME/.config/ready-together-deploy"
  install -d -m 755 "$HOME/.local/lib/ready-together" "$HOME/.config/systemd/user"
  install -m 755 "$source_dir/poll-and-deploy.sh" "$HOME/.local/lib/ready-together/poll-and-deploy.sh"
  printf 'REPO_DIR=%s\nSTATE_DIR=%s\nCOMPOSE_PROJECT=%s\n' "$repo" "$state" "$project" > "$HOME/.config/ready-together-deploy/environment"
  chmod 600 "$HOME/.config/ready-together-deploy/environment"
  install -m 644 "$source_dir/ready-together-deploy.user.service" "$HOME/.config/systemd/user/ready-together-deploy.service"
  install -m 644 "$source_dir/ready-together-deploy.timer" "$HOME/.config/systemd/user/ready-together-deploy.timer"
  # User managers use default.target rather than the system's timers.target.
  sed -i 's/WantedBy=timers.target/WantedBy=default.target/' "$HOME/.config/systemd/user/ready-together-deploy.timer"
  manager=(systemctl --user)
fi
"${manager[@]}" daemon-reload
"${manager[@]}" enable --now ready-together-deploy.timer
printf 'Installed. First poll runs shortly; later polls run five minutes after each completed check.\n'

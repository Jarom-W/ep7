# Run Ready Together on the Lenovo M720q

This walkthrough targets the Lenovo ThinkCentre M720q with **Ubuntu Server 26.04.1 LTS, amd64**, a normal user with `sudo` access, and a domain already active in Cloudflare. Run server commands over SSH or at the Lenovo's console; commands labeled **on your computer** run on your laptop/desktop. Replace `YOUR_USER` and `SERVER_LAN_IP` with your Ubuntu username and LAN address. The public hostname is `https://myemprep.com`.

The site is not public yet, so create a fresh dashboard-managed Cloudflare Tunnel. You do not need the old host's tunnel config or credentials. Keep using the existing hosted Supabase project: accounts, documents, and saved plans stay there. The container has no database or persistent volume to transfer. Guest plans stay in each browser and are specific to the site's origin (scheme, hostname, and port).

Traffic will follow this path:

```text
Browser → Cloudflare HTTPS → cloudflared on Ubuntu → 127.0.0.1:8080 → nginx container
Browser → hosted Supabase (authentication, database, storage, functions)
```

## 1. Prepare Ubuntu and remote access

Connect the Lenovo by Ethernet and reserve its LAN address in your router's DHCP settings. If available in firmware, enable automatic power-on after power loss. Use the installed Ubuntu system; no reinstall is needed.

On the Lenovo:

```bash
cat /etc/os-release
dpkg --print-architecture
sudo apt update
sudo apt upgrade -y
sudo apt install -y ca-certificates curl git nano openssh-server
sudo systemctl enable --now ssh
hostname -I
```

The architecture should be `amd64`. Note the Ethernet LAN IP from `hostname -I`. If updates require a reboot, run `sudo reboot`, then reconnect. If UFW is already enabled, allow SSH with `sudo ufw allow OpenSSH` before disconnecting (adjust the rule if you use a custom SSH port).

**On your computer**, open a new terminal and check SSH access:

```bash
ssh YOUR_USER@SERVER_LAN_IP
```

Keep SSH on your LAN or VPN. This deployment needs no router port forwarding for SSH, HTTP, HTTPS, or Docker's port 8080.

## 2. Install Docker Engine and Compose

Use [Docker's Ubuntu apt repository](https://docs.docker.com/engine/install/ubuntu/), which supports Ubuntu 26.04. These commands assume a fresh server without another Docker installation. If Docker is already installed, check its source and follow the linked guide's conflicting-package instructions before replacing it.

```bash
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc

sudo tee /etc/apt/sources.list.d/docker.sources >/dev/null <<EOF
Types: deb
URIs: https://download.docker.com/linux/ubuntu
Suites: $(. /etc/os-release && echo "${UBUNTU_CODENAME:-$VERSION_CODENAME}")
Components: stable
Architectures: $(dpkg --print-architecture)
Signed-By: /etc/apt/keyrings/docker.asc
EOF

sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo systemctl enable --now docker
sudo docker run --rm hello-world
sudo usermod -aG docker "$USER"
```

The deployment timer runs Docker as your account. Membership in the `docker` group grants root-equivalent access to this server; use your trusted server administration account.

**Log out and open a new SSH session** so the new group membership takes effect. Then verify all three commands work without `sudo`:

```bash
docker info
docker compose version
docker run --rm hello-world
```

Node, npm, and a host nginx installation are unnecessary for hosting: Docker builds the frontend and runs nginx.

## 3. Clone the app and configure Supabase

Use HTTPS to clone the public repository so the server and its update timer need no GitHub credentials:

```bash
mkdir -p "$HOME/apps"
cd "$HOME/apps"
git clone --branch main https://github.com/Jarom-W/ep7.git
cd ep7
cp .env.example .env
chmod 600 .env
nano .env
```

Replace both placeholders with the **existing** Supabase project's URL and public anon key:

```dotenv
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_PUBLIC_ANON_KEY
```

You can get these from your development `.env.local` or the Supabase project's Connect/API settings; access to the old server is unnecessary. Never use a service-role/secret key here. These two values are public browser configuration embedded in the built JavaScript. Keep Cloudflare tokens and server-only Supabase secrets out of this file.

Use `.env` for Docker Compose; `.env.local` is for local frontend development. Compose rejects missing or empty values, but you must still replace the example values with working ones. Environment files are ignored by Git and excluded from the Docker build context; Compose passes only the two specified build arguments.

If the existing Supabase project is already configured, retain it and apply only pending migrations when needed. For a project that has not been set up, complete [Supabase setup in the README](../README.md#supabase-setup) first. Database migrations and Edge Functions are separate from container deployment.

## 4. Build and verify the container privately

In `~/apps/ep7`:

```bash
docker compose config --quiet
docker compose build --pull web
docker compose up -d --no-build --wait --wait-timeout 120 web
docker compose ps
curl --fail --head http://127.0.0.1:8080/
curl --fail --head http://127.0.0.1:8080/radio
```

Expect a healthy `web` container and HTTP 200 for both URLs. Docker selects native amd64 images. The 128 MB limit applies to the running nginx container; the build uses additional host memory. Runtime logs rotate using Docker's `local` driver, with three files of up to 10 MB each.

To view the app before publishing, **on your computer** open an SSH forward and leave the command running:

```bash
ssh -N -L 18080:127.0.0.1:8080 YOUR_USER@SERVER_LAN_IP
```

Open `http://localhost:18080` in your computer's browser. Check the home page, `/radio`, and account sign-in. The site should show real Supabase content rather than preview mode. Password-reset redirects need the public URL configuration in step 6.

Opening `http://SERVER_LAN_IP:8080` directly will not work: the port deliberately listens only on the Lenovo's loopback interface. Leave that binding in place; the host's `cloudflared` service can reach it.

## 5. Create the Cloudflare Tunnel

### Install cloudflared on Ubuntu

Use [Cloudflare's stable apt repository](https://pkg.cloudflare.com/index.html):

```bash
sudo install -m 0755 -d /usr/share/keyrings
curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg | sudo tee /usr/share/keyrings/cloudflare-main.gpg >/dev/null
sudo chmod a+r /usr/share/keyrings/cloudflare-main.gpg
echo 'deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared any main' | sudo tee /etc/apt/sources.list.d/cloudflared.list
sudo apt update
sudo apt install -y cloudflared
cloudflared --version
```

### Connect the Lenovo

In the Cloudflare dashboard, go to **Networking → Tunnels**, create a tunnel, and name it `ready-together-m720q`. Choose the `cloudflared` connector if prompted, then **Linux / Debian / 64-bit**. Follow [Cloudflare's dashboard setup](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/get-started/create-remote-tunnel/); some dashboard layouts put tunnels under **Zero Trust → Networks → Connectors**.

The connector setup shows an installation command containing a tunnel token. Since `cloudflared` is already installed, use that token with the following commands **on the Lenovo**. Paste only the token at the prompt, not the whole dashboard command. Input is hidden and the token itself is not saved in shell history:

```bash
sudo -v
read -r -s -p 'Cloudflare tunnel token: ' CLOUDFLARE_TUNNEL_TOKEN
printf '\n'
sudo cloudflared service install "$CLOUDFLARE_TUNNEL_TOKEN"
unset CLOUDFLARE_TUNNEL_TOKEN
sudo systemctl enable --now cloudflared
sudo systemctl is-active cloudflared
```

The service retains the credential so it can reconnect after reboot. Treat the token and generated service configuration as secrets; do not paste them into Git, screenshots, or support messages. No local `config.yml`, `cloudflared tunnel login`, or old tunnel credentials are needed for this dashboard-managed setup.

Wait for the Lenovo connector to appear healthy in the dashboard, then continue.

### Publish your hostname

On the tunnel's **Routes** tab, add a **Published application** route (called **Public Hostname** in some layouts):

| Setting | Value |
| --- | --- |
| Subdomain | Leave blank (use the root domain) |
| Domain | `myemprep.com` |
| Path | Leave blank, so every application route is included |
| Service type | `HTTP` |
| Service URL | `127.0.0.1:8080` |

If the form uses a single URL field, enter `http://127.0.0.1:8080`. Use the host service, not a second Docker container for `cloudflared`; the loopback address in this guide refers to Ubuntu itself. Cloudflare provides public HTTPS while this local connection uses HTTP.

Save the route. Cloudflare creates the tunnel DNS record. If a record already exists for the chosen hostname, inspect it first and remove or replace only that unused record before adding the route; keep unrelated DNS records. No record should point to your home IP. Leave any old, unused tunnel alone until the new site works, then remove it only after confirming no other services use it.

Enable **SSL/TLS → Edge Certificates → Always Use HTTPS** for the domain if appropriate for its other sites. Open `https://myemprep.com`. This is a public site; it already has Supabase sign-in for private features and does not require a Cloudflare Access login in front of every page.

## 6. Set the public login URLs and verify startup

In your existing Supabase project, open **Authentication → URL Configuration**:

- **Site URL:** `https://myemprep.com`
- **Redirect URLs:** add `https://myemprep.com/account`

The `/account` entry matches this app's password-reset redirect. Keep any development URLs you still use. See [Supabase's redirect URL documentation](https://supabase.com/docs/guides/auth/redirect-urls).

Verify the public home page and `/radio`, sign in, open a saved plan or document, and test a password-reset email with your own account. A healthy nginx container confirms HTTP serving; it does not prove that Supabase or email is configured correctly.

Reboot the Lenovo once to check unattended startup:

```bash
sudo reboot
```

Reconnect over SSH, then run:

```bash
cd "$HOME/apps/ep7"
systemctl is-active docker cloudflared
docker compose ps
curl --fail --head http://127.0.0.1:8080/
curl --fail --head https://myemprep.com/
```

Both services should be active and the container should become healthy. The Docker restart policy restarts the app after reboot, unless it was deliberately stopped with `docker compose stop` or removed with `docker compose down`; start it with the `up` command from step 4 in that case.

## 7. Enable automatic deployment from main

After the site works, enable the existing deployment timer under the account that owns `~/apps/ep7` and can run Docker without `sudo`:

```bash
cd "$HOME/apps/ep7"
git switch main
git pull --ff-only origin main
sudo loginctl enable-linger "$USER"
bash scripts/deploy/install.sh "$PWD" "$USER"
systemctl --user start ready-together-deploy.service
tail -n 100 "$HOME/.local/state/ready-together-deploy/deploy.log"
systemctl --user list-timers ready-together-deploy.timer
```

Keep the default Compose project name (`ep7`) for both manual commands and the timer. The timer checks `main` five minutes after each completed check, builds new commits while the existing container runs, waits for health, and attempts to restore the previous container if startup fails. Lingering makes the user timer survive logout and start after reboot. Its first run deploys the current commit even if you built it manually already.

The timer deploys merged commits directly; it does not wait for GitHub checks. Merge only passing changes. Supabase migrations and function deployments remain separate. See [automatic deployment details](../README.md#automatic-deployment-from-main) for rollback behavior, state locations, and the optional system-wide installation.

## Updates and troubleshooting

For a manual app update, a change to `.env`, or refreshing the base images at the same commit, pause the timer (if installed) and wait for any current deployment to finish before building:

```bash
systemctl --user stop ready-together-deploy.timer
systemctl --user is-active ready-together-deploy.service
```

If the service reports `active` or `activating`, follow its log and wait until it finishes. If you never installed the timer, skip those two commands. Once no deployment is running:

```bash
cd "$HOME/apps/ep7"
git pull --ff-only origin main
docker compose config --quiet
docker compose build --pull web
docker compose up -d --no-build --wait --wait-timeout 120 web
docker compose ps
```

Run `systemctl --user start ready-together-deploy.timer` afterward if you use the timer. A manual `compose up` does not provide the deployment runner's automatic rollback. Editing `.env` or restarting a container alone does not change the built client values; the rebuild above is required. An unchanged commit is skipped by the timer even when `.env` or upstream base images have changed.

For Ubuntu, Docker, and cloudflared package updates, use `sudo apt update` followed by `sudo apt upgrade`, then reboot when required and repeat the startup checks. Retain the `.env` settings securely and keep Supabase backups; rebuilding the frontend does not back up the hosted database or Storage.

Useful diagnostics:

```bash
cd "$HOME/apps/ep7"
docker compose ps
docker compose logs --tail 100 web
sudo journalctl -u cloudflared -n 100 --no-pager
df -h
docker system df
```

| Symptom | Check |
| --- | --- |
| Docker socket permission denied | Reconnect after joining the `docker` group; confirm `docker info` works as the checkout owner. |
| Compose reports missing Supabase settings | Run from `~/apps/ep7` and fill both values in `.env`. |
| Site loads in preview mode or cannot sign in | Verify the Supabase URL/public key and rebuild; check the browser console and project status. |
| Cloudflare 502 | Confirm local `curl` works and the route is HTTP to `127.0.0.1:8080`, not HTTPS or port 80. |
| Tunnel is down / error 1033 | Check the host's `cloudflared` service and logs. Restrictive networks must permit outbound TCP/UDP 7844 to Cloudflare. |
| DNS record conflict | Inspect the exact requested hostname for an old A/AAAA/CNAME record before replacing it. |
| Password-reset link goes to localhost or the wrong site | Correct the Site URL and allowed `/account` redirect in Supabase. |
| Build fails for lack of memory or disk | Check `free -h`, `df -h`, build output, and `docker system df`; the runtime memory limit does not cap builds. |

The deployment runner's `deploy.log` and cached build images need periodic disk review; container log rotation does not rotate that separate file. Avoid pruning the retained rollback image while it may be needed.

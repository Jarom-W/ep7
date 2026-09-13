# Ready Together

A full-stack emergency preparedness site for the Spanish Fork 7th Ward. The public site includes a live privacy-safe ward dashboard, PDF newsletter archive, standing emergency plan, private household food/water planner, pantry-driven meal forecasts, recipes, a code-drawn interactive ward block map, and bug/feature feedback. Families can create accounts to sync their progress, while the specialist role manages shared content through Supabase Auth, Postgres, Storage, and Row Level Security.

## Architecture

- React + TypeScript + Vite frontend (small static bundle, ideal for a Raspberry Pi 4B)
- Supabase Auth, Postgres, Storage, and Edge Functions
- nginx container on the Pi, bound only to `127.0.0.1:8080`
- Cloudflare Tunnel for public HTTPS; no router port-forward is required
- Browser-local storage for guests, with optional private Supabase sync for signed-in families
- A security-definer aggregate RPC for the public dashboard; it never returns individual family rows and suppresses preparedness measures until three families participate

## Local setup

Requires Node 22 or newer.

```bash
cp .env.example .env.local
npm install
npm run dev
```

Add these public client values to `.env.local`:

```dotenv
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_PUBLIC_ANON_KEY
```

Never put a Supabase service-role key, database password, Resend API key, admin password, or Cloudflare token in a `VITE_` variable or commit it to git.

## Supabase setup

1. Create a Supabase project and run all SQL files in `supabase/migrations/` in filename order. They create shared content, private family profiles/plans, the anonymous dashboard aggregate, the authenticated household directory, and ministering access controls.
2. In **Authentication → Providers → Email**, enable email/password sign-ups and turn **Confirm email** off. New family accounts then receive a session immediately and do not use Supabase's limited signup email service. Keep the email address as the account username; password-reset emails still require a working mail path. The local/self-hosted equivalent is already set with `auth.email.enable_confirmations = false` in `supabase/config.toml`.
3. Create the specialist user with a strong password and MFA. Ordinary family sign-ups never receive the specialist role.
4. Grant that user the specialist role by running the final commented query in the initial migration with the specialist email substituted.
5. Install the Supabase CLI, link the project, apply every pending migration, and deploy the Edge Functions:

   ```bash
   supabase login
   supabase link --project-ref YOUR_PROJECT_REF
   supabase db push
   supabase functions deploy submit-feedback
   ```

6. Create a Resend account, verify a sending domain, and add the server-only feedback secrets:

   ```bash
   supabase secrets set RESEND_API_KEY=re_...
   supabase secrets set FEEDBACK_FROM_EMAIL="Ready Together <feedback@YOUR_DOMAIN>"
   ```

Feedback is stored in Postgres for the admin inbox and emailed to `jaromwardwell@gmail.com`. The recipient is defined only in the Edge Function. The form includes input limits and a bot honeypot; add Cloudflare Turnstile before advertising the site broadly if spam becomes a problem.

Because confirmation-free email registration cannot prove that a visitor owns the address they enter, enable Supabase CAPTCHA protection before broad public promotion and do not use an email address as proof of ward membership. Directory visibility still depends on authenticated access and administrator-approved household records.

## Raspberry Pi 4B deployment

Install 64-bit Raspberry Pi OS Lite, Docker Engine, the Docker Compose plugin, and `cloudflared`. Clone the repo, create `.env` with the same two public Supabase values, then run:

```bash
docker compose up -d --build
curl http://127.0.0.1:8080
```

The container is ARM64-compatible, limited to 128 MB RAM, restarts automatically, and exposes nginx only on the Pi loopback interface.

Create a named Cloudflare Tunnel and route the chosen hostname to the container:

```yaml
# /etc/cloudflared/config.yml
tunnel: YOUR_TUNNEL_ID
credentials-file: /etc/cloudflared/YOUR_TUNNEL_ID.json
ingress:
  - hostname: preparedness.YOUR_DOMAIN
    service: http://127.0.0.1:8080
  - service: http_status:404
```

Then install and start the service:

```bash
sudo cloudflared service install
sudo systemctl enable --now cloudflared
```

In Cloudflare, enable Always Use HTTPS, Bot Fight Mode, and a conservative rate-limit rule for the public site. Keep the Pi patched and do not expose ports 80, 443, 5432, or 22 through the router.

## Automatic deployment from main

The Pi can poll GitHub five minutes after each completed check using the included systemd timer. It fetches `origin/main`, fast-forwards the checkout, builds while the existing container stays up, and replaces the `web` container only after the build succeeds. Docker must report the new container healthy before its commit is recorded as deployed. A failed startup restores the previous image/configuration; failed builds and startups are retried on the next poll, even if the checkout already has the new commit. A file lock prevents overlapping runs.

One-time setup **on the Pi**, after merging and pulling this change:

```bash
cd /absolute/path/to/ep7
git switch main
git pull --ff-only origin main
bash scripts/deploy/install.sh "$PWD" "$USER"
```

The default installs a user-owned timer. User lingering must be enabled so it survives logout and starts on boot; if needed, run `sudo loginctl enable-linger "$USER"` once. Use the Linux account that owns this clone and already runs Docker successfully without `sudo`. The installer verifies a clean `main` checkout, `.env`, Docker Compose health-wait support, and noninteractive GitHub access. For private repositories, configure a read-only SSH deploy key (without an interactive passphrase) or a credential helper for that account. The timer uses that account's credentials; it needs no inbound webhook or new public port.

The Compose project name defaults to the checkout directory name, matching ordinary `docker compose` usage. If the existing deployment uses `-p` or `COMPOSE_PROJECT_NAME`, pass that **same** name as a third installer argument, e.g. `bash scripts/deploy/install.sh "$PWD" "$USER" existing-project`. Confirm the existing name with `docker compose ls` before installation. Keep production edits out of tracked files; `.env` remains ignored and preserved.

```bash
# Trigger a check immediately and view its logs.
systemctl --user start ready-together-deploy.service
journalctl --user -u ready-together-deploy.service -n 100 --no-pager
systemctl --user list-timers ready-together-deploy.timer

# Pause automatic updates (for maintenance or investigating a bad release).
systemctl --user disable --now ready-together-deploy.timer
```

The first poll occurs shortly after installation and on boot. Runs time out after 30 minutes. State, the last successful commit, and rollback configuration live in `~/.local/state/ready-together-deploy`; configuration lives in `~/.config/ready-together-deploy/environment`. An optional system-wide install is available by running the installer with `sudo`; it uses `/var/lib/ready-together-deploy` and `/etc/ready-together-deploy.conf`, and its management commands omit `--user`. Install only one timer for this checkout. Re-run the installer to apply future changes to the deployment scripts or timer. Logs remain in the system journal. Disk cleanup is manual; the runner does not prune unrelated Docker images or volumes. If rollback fails, the log explicitly reports it; inspect Docker before retrying. Revert a bad release through a new commit on `main` instead of force-pushing or resetting the Pi checkout.

The GitHub Checks workflow runs lint, build, browser regressions, radio tests, and deployment-runner tests. Protect `main` with the `verify` check if merges should require it. The Pi deploys merged commits directly, so merge only reviewed, passing changes. Supabase migrations and Edge Function deployments remain separate from this Docker timer: apply required migrations before merging a frontend that depends on them.

## Publishing the Help video

Sign in as the specialist, open **Documents → Publish the Help video**, choose an MP4, WebM, or Ogg file, and click **Upload & publish video**. The selected filename, upload percentage, publishing status, and any errors appear beside the form. Keep the page open until the success message appears; the current-video preview updates immediately and the published video becomes available on `/help`.

Uploads use [Supabase's resumable upload protocol](https://supabase.com/docs/guides/storage/uploads/resumable-uploads) with 6 MB chunks and automatic retries for interrupted requests. The application accepts files up to 250 MB; the Supabase project's global upload limit must also allow the file size (a bucket limit cannot override a lower project/plan limit). The existing `20260906000000_help_video.sql` migration creates the `preparedness-media` bucket, `site_media` record, and specialist-only write policies. Apply it with the other pending migrations if video publishing reports a missing table or bucket. The old published record remains in place until the replacement upload and database write succeed. Old files, or files uploaded successfully before a publication failure, remain in Storage for manual cleanup.

## Content and privacy notes

- The green walkie-talkie button opens `/radio`, a public Stake Radio Communications calendar and resource page. Specialists manage its events and information under **Specialist → Stake radio** (or `/specialist?tab=radio`).
- Radio events use Mountain Time, with one-time, weekly, and selected-week-of-month recurrence. A specialist can end a series, skip individual dates, or mark events proposed/cancelled. Editing a recurring event changes the entire series; skip a date and add a one-time replacement to change only one meeting.
- The initial radio schedule and resources come from Allen Carter's August 23, 2026 email. The September 24 drill remains proposed, and the Springville job notice is labeled historical rather than treated as a verified current opening.
- Newsletter and emergency-plan uploads accept PDFs up to 20 MB.
- The signed-in map is fully code-drawn SVG from `src/data/neighborhood.ts` and `src/data/blockDetails.ts`; the reference photos are never displayed in the application.
- Captains and households default to private. An admin must explicitly mark each record public after obtaining permission to publish the name/address/phone.
- Family planner rows are protected by owner-only RLS. Ward administrators cannot read them through the application. The dashboard calls `ward_progress_stats()` and receives aggregates only.
- The site stores only the account and preparedness fields a family chooses to enter, solely to sync progress. It does not sell the data or use it for advertising.
- Calorie and water numbers are planning estimates, not medical advice. The interface tells visitors to adjust for weather, activity, health, pets, pregnancy, and nursing.
- The recipe catalog currently contains 16 shelf-stable meals with gluten-free and dairy-free filters. Recipe quantities and calories are transparent estimates and can be extended in `src/data/recipes.ts`.

## Verification

```bash
npm run lint
npm run test:radio
npm run test:deploy
npx playwright install chromium
npm run test:browser
npm run build
docker compose config
```

The production build goes to `dist/`. nginx is configured with SPA routing and immutable caching for hashed assets.

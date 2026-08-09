# Ready, EP7

A full-stack emergency preparedness site for the Spanish Fork 7th Ward. The public site includes a PDF newsletter archive, standing emergency plan, private household food/water planner, pantry-driven meal forecasts, recipes, an interactive ward block map, and bug/feature feedback. A single specialist role manages shared content through Supabase Auth, Postgres, Storage, and Row Level Security.

## Architecture

- React + TypeScript + Vite frontend (small static bundle, ideal for a Raspberry Pi 4B)
- Supabase Auth, Postgres, Storage, and Edge Functions
- nginx container on the Pi, bound only to `127.0.0.1:8080`
- Cloudflare Tunnel for public HTTPS; no router port-forward is required
- Browser-local storage for household ages, pantry inventory, and water. This intentionally keeps personal planning data out of the public ward database.

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

1. Create a Supabase project and run [the initial migration](supabase/migrations/20260809000000_initial_schema.sql) in its SQL editor. This creates all tables, RLS policies, the public PDF bucket, and the `is_admin()` authorization function.
2. In Authentication, disable public sign-ups and create the specialist user manually with a strong password and MFA.
3. Grant that user the specialist role by running the final commented query in the migration with the specialist email substituted.
4. Install the Supabase CLI, link the project, and deploy the feedback function:

   ```bash
   supabase login
   supabase link --project-ref YOUR_PROJECT_REF
   supabase functions deploy submit-feedback
   ```

5. Create a Resend account, verify a sending domain, and add the server-only secrets:

   ```bash
   supabase secrets set RESEND_API_KEY=re_...
   supabase secrets set FEEDBACK_FROM_EMAIL="Ready EP7 <feedback@YOUR_DOMAIN>"
   ```

Feedback is stored in Postgres for the admin inbox and emailed to `jaromwardwell@gmail.com`. The recipient is defined only in the Edge Function. The form includes input limits and a bot honeypot; add Cloudflare Turnstile before advertising the site broadly if spam becomes a problem.

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

## Content and privacy notes

- Newsletter and emergency-plan uploads accept PDFs up to 20 MB.
- The map uses the specialist-provided `photos/block_map.jpg`, corrected for web display, with an SVG block layer in `src/data/blocks.ts`.
- Captains and households default to private. An admin must explicitly mark each record public after obtaining permission to publish the name/address/phone.
- Calorie and water numbers are planning estimates, not medical advice. The interface tells visitors to adjust for weather, activity, health, pets, pregnancy, and nursing.
- The recipe catalog currently contains 16 shelf-stable meals with gluten-free and dairy-free filters. Recipe quantities and calories are transparent estimates and can be extended in `src/data/recipes.ts`.

## Verification

```bash
npm run build
docker compose config
```

The production build goes to `dist/`. nginx is configured with SPA routing and immutable caching for hashed assets.

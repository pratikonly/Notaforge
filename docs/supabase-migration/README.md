# NotaForge → Self-Managed Supabase Migration Guide

This guide moves the NotaForge backend off **Lovable Cloud** and onto your **own Supabase project** (free tier available at supabase.com). After this, your app runs on Vercel (frontend) + your own Supabase (backend) with zero Lovable involvement.

> ⚠️ **Important:** You cannot disconnect Lovable Cloud from the existing Lovable project. This guide assumes you are deploying the code **outside Lovable** (e.g. forking the GitHub repo to Replit/Vercel). The Lovable preview will keep using Lovable Cloud — that's fine, you just won't use it anymore.

---

## 📁 What's in this folder

| File | Purpose |
|---|---|
| `README.md` | This guide |
| `all-migrations.sql` | Complete database schema (tables, RLS, functions, triggers) |
| `edge-functions/cloudinary-usage.ts` | Cloudinary usage stats endpoint |
| `edge-functions/discord-logger.ts` | Logs new notes to Discord |
| `edge-functions/keep-alive.ts` | Keeps DB warm via cron |
| `secrets.example.env` | List of all secrets you must configure |

---

## 🧱 Architecture overview

```
┌────────────────┐      ┌──────────────────────┐      ┌──────────────────┐
│  Vercel (FE)   │ ───► │  Your Supabase       │ ◄──► │  Cloudinary      │
│  React + Vite  │      │  - Postgres + RLS    │      │  (file uploads)  │
│                │      │  - Auth              │      └──────────────────┘
│                │      │  - Storage           │      ┌──────────────────┐
│                │      │  - Edge Functions    │ ───► │  Discord Webhook │
│                │      │  - pg_cron           │      └──────────────────┘
└────────────────┘      └──────────────────────┘
```

---

## 🚀 Step-by-step migration

### STEP 1 — Create a new Supabase project

1. Go to https://supabase.com → New Project
2. Pick a region close to your users, set a strong DB password (save it!)
3. Wait ~2 min for provisioning
4. Note down from **Project Settings → API**:
   - `Project URL` → `https://xxxx.supabase.co`
   - `anon public` key
   - `service_role` key (⚠️ secret, server only)
   - `Project Ref` (the `xxxx` part of the URL)

### STEP 2 — Run the database schema

1. Open Supabase Dashboard → **SQL Editor** → **New query**
2. Paste the **entire contents of `all-migrations.sql`**
3. Click **Run**

This creates:
- `app_role` enum (admin, moderator, user)
- Tables: `profiles`, `user_roles`, `notes`, `folders`, `login_history`, `keep_alive_logs`
- Functions: `has_role`, `handle_new_user`, `update_updated_at_column`, `cleanup_keep_alive_logs`, `notify_discord_logger`, `prune_keep_alive_logs`
- All RLS policies and GRANTs
- The `on_auth_user_created` trigger that auto-creates a profile row

If you get errors about `net.http_post` not existing, enable the `pg_net` extension first (Step 5).

### STEP 3 — Create the storage bucket

Dashboard → **Storage** → **New bucket**:
- Name: `note-files`
- Public: ✅ **Yes**
- Click Create

Then add storage policies (Storage → note-files → Policies → New policy → "For full customization"):

```sql
-- Allow anyone to upload
CREATE POLICY "Public upload" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'note-files');

-- Allow anyone to read
CREATE POLICY "Public read" ON storage.objects
  FOR SELECT USING (bucket_id = 'note-files');

-- Only admins can delete
CREATE POLICY "Admin delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'note-files'
    AND public.has_role(auth.uid(), 'admin')
  );
```

### STEP 4 — Configure Auth

Dashboard → **Authentication → Providers**:
- **Email**: enable, turn OFF "Confirm email" (matches current behavior)
- **Google** (optional): enable and add OAuth client ID/secret from Google Cloud Console

Dashboard → **Authentication → URL Configuration**:
- **Site URL**: `https://notaforge.qzz.io`
- **Redirect URLs**: add `https://notaforge.qzz.io/**` and `http://localhost:8080/**`

### STEP 5 — Enable required extensions

Dashboard → **Database → Extensions** — enable:
- `pg_net` (required for discord-logger trigger + cron HTTP calls)
- `pg_cron` (required for keep-alive scheduled job)

### STEP 6 — Deploy Edge Functions

Install the Supabase CLI:
```bash
npm install -g supabase
supabase login
supabase link --project-ref YOUR_PROJECT_REF
```

Create local function folders matching this repo's structure and copy each `.ts` file from `edge-functions/` into `supabase/functions/<name>/index.ts`, then deploy:

```bash
supabase functions deploy cloudinary-usage --no-verify-jwt
supabase functions deploy discord-logger --no-verify-jwt
supabase functions deploy keep-alive --no-verify-jwt
```

### STEP 7 — Set Edge Function secrets

Dashboard → **Project Settings → Edge Functions → Secrets** (or use CLI):

```bash
supabase secrets set CLOUDINARY_API_KEY=xxx
supabase secrets set CLOUDINARY_API_SECRET=xxx
supabase secrets set CLOUDINARY_CLOUD_NAME=xxx
supabase secrets set DISCORD_WEBHOOK_TEXT=https://discord.com/api/webhooks/...
supabase secrets set DISCORD_WEBHOOK_IMAGES=https://discord.com/api/webhooks/...
supabase secrets set DISCORD_WEBHOOK_FILES=https://discord.com/api/webhooks/...
supabase secrets set DISCORD_WEBHOOK_LINKS=https://discord.com/api/webhooks/...
supabase secrets set DISCORD_LOGGER_SECRET=$(openssl rand -hex 32)
supabase secrets set KEEP_ALIVE_SECRET=$(openssl rand -hex 32)
supabase secrets set RESEND_API_KEY=re_xxx     # if used
supabase secrets set ALERT_EMAIL=you@example.com
```

`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` are **auto-injected** by Supabase — don't set them.

### STEP 8 — Schedule the keep-alive cron

Dashboard → **SQL Editor**, replace `YOUR_PROJECT_REF` and `YOUR_ANON_KEY`:

```sql
SELECT cron.schedule(
  'keep-alive-every-5-min',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/keep-alive',
    headers := '{"Content-Type":"application/json","apikey":"YOUR_ANON_KEY"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
```

### STEP 9 — Update the discord-logger trigger URL

The `notify_discord_logger()` function in `all-migrations.sql` has the OLD Lovable Cloud URL hardcoded. After running migrations, replace it:

```sql
CREATE OR REPLACE FUNCTION public.notify_discord_logger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
BEGIN
  BEGIN
    PERFORM net.http_post(
      url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/discord-logger',
      headers := jsonb_build_object('Content-Type', 'application/json'),
      body := jsonb_build_object('record', to_jsonb(NEW))
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  RETURN NEW;
END;
$function$;
```

Also attach it as an AFTER INSERT trigger on `notes` if not already present:
```sql
CREATE TRIGGER notes_discord_logger
AFTER INSERT ON public.notes
FOR EACH ROW EXECUTE FUNCTION public.notify_discord_logger();
```

### STEP 10 — Update frontend env vars

In your Vercel project → **Settings → Environment Variables**, add:

```
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_ANON_KEY
VITE_SUPABASE_PROJECT_ID=YOUR_PROJECT_REF
```

Also set them locally in `.env.local` (which is gitignored). The file `src/integrations/supabase/client.ts` already reads these — no code changes needed.

Redeploy on Vercel. Done.

### STEP 11 — Create your admin user

1. Sign up via your live site (or Dashboard → Authentication → Users → Add user)
2. In Dashboard → SQL Editor:
```sql
INSERT INTO public.user_roles (user_id, role)
VALUES ('PASTE_YOUR_USER_ID_HERE', 'admin');
```

---

## ✅ Verification checklist

- [ ] Can sign up / sign in
- [ ] Admin can edit and delete notes
- [ ] Public visitors can create notes
- [ ] File upload to `note-files` bucket works
- [ ] New note → Discord notification fires
- [ ] `keep_alive_logs` table gets a row every 5 minutes
- [ ] `cloudinary-usage` endpoint returns JSON

---

## 💰 Cost comparison

| | Lovable Cloud | Self-managed Supabase |
|---|---|---|
| DB / Auth / Storage / Functions | Counts against monthly credits | Free tier: 500 MB DB, 1 GB storage, 50K MAU, 500K function invocations |
| When you hit the limit | App stops working until top-up | Project pauses after 7 days inactive on free tier; or $25/mo Pro plan |
| Secret management | Lovable UI | Supabase Dashboard or CLI |
| Edge function deploys | Automatic | Manual (`supabase functions deploy`) |

For a small site like NotaForge, **Supabase free tier is plenty**.

---

## ❓ Troubleshooting

**"permission denied for table X"** → You forgot a `GRANT` statement. Re-run `all-migrations.sql`.

**Discord trigger doesn't fire** → `pg_net` not enabled, or you didn't update the URL in `notify_discord_logger` (Step 9), or the trigger isn't attached.

**Cron not running** → `pg_cron` not enabled, or check `SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;`.

**Auth redirect mismatch** → Add the exact URL to Auth → URL Configuration → Redirect URLs.

**Function returns 401** → You deployed without `--no-verify-jwt`. Redeploy with that flag, or send a valid `Authorization: Bearer <anon_key>` header.

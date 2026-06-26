-- ============================================================
-- NotaForge — Clean Schema (only tables the app actually uses)
-- Target project: xofnbmqxyfjbfvsqvogd
-- Safe to re-run (fully idempotent)
-- ============================================================
-- Tables used by the app:
--   notes          → main content (CRUD + realtime)
--   user_roles     → admin auth via has_role() RPC
--   keep_alive_logs→ admin keep-alive monitoring page
--   folders        → admin-managed folders that group notes
-- Tables removed (zero usage in frontend):
--   profiles       → was only trigger-created, never queried
--   login_history  → completely unused
-- ============================================================

-- ── EXTENSIONS ───────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto"  WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "pg_net"    WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "pg_cron";

-- ── ENUMS ────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'user');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── TABLES (created first so functions can reference them) ───

CREATE TABLE IF NOT EXISTS public.user_roles (
  id      uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role    app_role NOT NULL DEFAULT 'user',
  UNIQUE (user_id, role)
);

CREATE TABLE IF NOT EXISTS public.notes (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     uuid DEFAULT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title       text DEFAULT 'Untitled' NOT NULL,
  content     text,
  note_type   text DEFAULT 'text' NOT NULL
              CONSTRAINT notes_note_type_check
              CHECK (note_type = ANY (ARRAY['text','image','pdf','video','audio','link','file'])),
  file_url    text,
  file_name   text,
  link_url    text,
  is_pinned   boolean DEFAULT false NOT NULL,
  color       text DEFAULT 'default',
  is_archived boolean DEFAULT false NOT NULL,
  is_deleted  boolean DEFAULT false NOT NULL,
  folder_id   uuid DEFAULT NULL REFERENCES public.folders(id) ON DELETE SET NULL,
  created_at  timestamptz DEFAULT now() NOT NULL,
  updated_at  timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.keep_alive_logs (
  id               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  status           text NOT NULL CHECK (status IN ('success','failure','unauthorized')),
  notes_count      integer,
  response_time_ms integer,
  error_message    text,
  source           text,
  created_at       timestamptz DEFAULT now() NOT NULL
);

-- ── INDEXES ──────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_notes_archived             ON public.notes (is_archived) WHERE is_archived = true;
CREATE INDEX IF NOT EXISTS idx_notes_deleted              ON public.notes (is_deleted)  WHERE is_deleted  = true;
CREATE INDEX IF NOT EXISTS idx_notes_created_at           ON public.notes (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_keep_alive_logs_created_at ON public.keep_alive_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_keep_alive_logs_status     ON public.keep_alive_logs (status);

-- Needed for realtime change tracking
ALTER TABLE public.notes REPLICA IDENTITY FULL;

-- ── FUNCTIONS (after tables so SQL functions can resolve refs) 

-- Checks whether a user has a given role (used by RLS + frontend RPC)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Auto-updates updated_at on row changes
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Cleans up keep_alive_logs older than 7 days (scheduled via pg_cron)
CREATE OR REPLACE FUNCTION public.cleanup_keep_alive_logs()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  DELETE FROM public.keep_alive_logs WHERE created_at < now() - interval '7 days';
END;
$$;

-- Fires after INSERT on notes → calls discord-logger edge function
CREATE OR REPLACE FUNCTION public.notify_discord_logger()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions AS $$
BEGIN
  BEGIN
    PERFORM net.http_post(
      url     := 'https://xofnbmqxyfjbfvsqvogd.supabase.co/functions/v1/discord-logger',
      headers := jsonb_build_object('Content-Type', 'application/json'),
      body    := jsonb_build_object('record', to_jsonb(NEW))
    );
  EXCEPTION WHEN OTHERS THEN
    NULL; -- never block the insert
  END;
  RETURN NEW;
END;
$$;

-- ── TRIGGERS ─────────────────────────────────────────────────
DROP TRIGGER IF EXISTS update_notes_updated_at ON public.notes;
CREATE TRIGGER update_notes_updated_at
  BEFORE UPDATE ON public.notes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS notes_discord_logger ON public.notes;
CREATE TRIGGER notes_discord_logger
  AFTER INSERT ON public.notes
  FOR EACH ROW EXECUTE FUNCTION public.notify_discord_logger();

-- ── ROW LEVEL SECURITY ───────────────────────────────────────
ALTER TABLE public.user_roles      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notes           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.keep_alive_logs ENABLE ROW LEVEL SECURITY;

-- user_roles
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage roles"        ON public.user_roles;
CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage roles"
  ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- notes: public can read & create; only admins can update/delete
DROP POLICY IF EXISTS "Anyone can view notes"    ON public.notes;
DROP POLICY IF EXISTS "Anyone can create notes"  ON public.notes;
DROP POLICY IF EXISTS "Admins can update notes"  ON public.notes;
DROP POLICY IF EXISTS "Admins can delete notes"  ON public.notes;
-- also drop any old policy names that might exist from previous runs
DROP POLICY IF EXISTS "Anyone can update notes"           ON public.notes;
DROP POLICY IF EXISTS "Anyone can delete notes"           ON public.notes;
DROP POLICY IF EXISTS "Anyone can read active notes"      ON public.notes;
DROP POLICY IF EXISTS "Anyone can insert notes"           ON public.notes;
DROP POLICY IF EXISTS "Users can view their own notes"    ON public.notes;
DROP POLICY IF EXISTS "Users can create their own notes"  ON public.notes;
DROP POLICY IF EXISTS "Users can update their own notes"  ON public.notes;
DROP POLICY IF EXISTS "Users can delete their own notes"  ON public.notes;
DROP POLICY IF EXISTS "Users can view own notes"          ON public.notes;
DROP POLICY IF EXISTS "Users can create own notes"        ON public.notes;
DROP POLICY IF EXISTS "Users can update own notes"        ON public.notes;
DROP POLICY IF EXISTS "Users can delete own notes"        ON public.notes;

CREATE POLICY "Anyone can view notes"   ON public.notes FOR SELECT USING (true);
CREATE POLICY "Anyone can create notes" ON public.notes FOR INSERT WITH CHECK (true);
CREATE POLICY "Admins can update notes" ON public.notes FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete notes" ON public.notes FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- keep_alive_logs: only admins can read; edge function writes via service role
DROP POLICY IF EXISTS "Admins can view keep-alive logs" ON public.keep_alive_logs;
CREATE POLICY "Admins can view keep-alive logs"
  ON public.keep_alive_logs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- ── STORAGE POLICIES (note-files bucket) ─────────────────────
-- Create the bucket first in the dashboard: Storage → New bucket
--   Name: note-files   Public: ON
-- Then these policies allow anyone to upload/read files.

DROP POLICY IF EXISTS "Public read note files"       ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload note files" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can update note files" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can delete note files" ON storage.objects;
-- drop old names too
DROP POLICY IF EXISTS "Allow public uploads to public folder"   ON storage.objects;
DROP POLICY IF EXISTS "Allow public updates to public folder"   ON storage.objects;
DROP POLICY IF EXISTS "Allow public deletes from public folder" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own files"        ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own files"        ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own files"        ON storage.objects;

CREATE POLICY "Public read note files"       ON storage.objects FOR SELECT USING (bucket_id = 'note-files');
CREATE POLICY "Anyone can upload note files" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'note-files');
CREATE POLICY "Anyone can update note files" ON storage.objects FOR UPDATE USING (bucket_id = 'note-files');
CREATE POLICY "Anyone can delete note files" ON storage.objects FOR DELETE USING (bucket_id = 'note-files');

-- ── CRON: daily cleanup of keep_alive_logs ───────────────────
SELECT cron.unschedule('cleanup-keep-alive-logs-daily')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup-keep-alive-logs-daily');
SELECT cron.schedule(
  'cleanup-keep-alive-logs-daily',
  '0 3 * * *',
  $$ SELECT public.cleanup_keep_alive_logs(); $$
);

-- ── GRANTS ───────────────────────────────────────────────────
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES    IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_role TO authenticated;

-- ── AFTER RUNNING THIS SCRIPT ────────────────────────────────
-- 1. Enable Realtime on the notes table:
--    Dashboard → Database → Replication → supabase_realtime publication → Add table → notes
-- 2. Create your admin user:
--    Sign up via the site, then run:
--    INSERT INTO public.user_roles (user_id, role)
--    VALUES ('your-user-id-here', 'admin');

-- ============================================================
-- NotaForge — Full Schema (idempotent, safe to re-run)
-- Target project: xofnbmqxyfjbfvsqvogd
-- ============================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto"        WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp"       WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "pg_net"          WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "pg_cron";

-- ── ENUMS ────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'user');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── FUNCTIONS ────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (user_id, username, email)
  VALUES (NEW.id, NEW.raw_user_meta_data ->> 'username', NEW.email)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger LANGUAGE plpgsql
SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.cleanup_keep_alive_logs()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  DELETE FROM public.keep_alive_logs WHERE created_at < now() - interval '7 days';
END;
$$;

-- Discord logger trigger — points to YOUR new project
CREATE OR REPLACE FUNCTION public.notify_discord_logger()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions AS $$
BEGIN
  BEGIN
    PERFORM net.http_post(
      url := 'https://xofnbmqxyfjbfvsqvogd.supabase.co/functions/v1/discord-logger',
      headers := jsonb_build_object('Content-Type', 'application/json'),
      body := jsonb_build_object('record', to_jsonb(NEW))
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  RETURN NEW;
END;
$$;

-- ── TABLES ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.profiles (
  id         uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  user_id    uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  username   text NOT NULL,
  email      text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.user_roles (
  id      uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role    app_role NOT NULL DEFAULT 'user',
  UNIQUE (user_id, role)
);

CREATE TABLE IF NOT EXISTS public.folders (
  id          uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  user_id     uuid NOT NULL,
  name        text DEFAULT 'Untitled Folder' NOT NULL,
  color       text DEFAULT 'default',
  is_archived boolean DEFAULT false NOT NULL,
  is_deleted  boolean DEFAULT false NOT NULL,
  parent_id   uuid REFERENCES public.folders(id) ON DELETE SET NULL,
  created_at  timestamptz DEFAULT now() NOT NULL,
  updated_at  timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.notes (
  id          uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  user_id     uuid REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT NULL,
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
  folder_id   uuid REFERENCES public.folders(id) ON DELETE SET NULL,
  created_at  timestamptz DEFAULT now() NOT NULL,
  updated_at  timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.login_history (
  id                uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  user_id           uuid NOT NULL,
  device_info       text,
  browser           text,
  os                text,
  ip_address        text,
  is_current_session boolean DEFAULT false,
  created_at        timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.keep_alive_logs (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  status          text NOT NULL CHECK (status IN ('success','failure','unauthorized')),
  notes_count     integer,
  response_time_ms integer,
  error_message   text,
  source          text,
  created_at      timestamptz DEFAULT now() NOT NULL
);

-- ── INDEXES ──────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_folders_parent_id         ON public.folders (parent_id);
CREATE INDEX IF NOT EXISTS idx_login_history_user_id     ON public.login_history (user_id);
CREATE INDEX IF NOT EXISTS idx_notes_archived            ON public.notes (is_archived) WHERE is_archived = true;
CREATE INDEX IF NOT EXISTS idx_notes_deleted             ON public.notes (is_deleted)  WHERE is_deleted  = true;
CREATE INDEX IF NOT EXISTS idx_keep_alive_logs_created_at ON public.keep_alive_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_keep_alive_logs_status    ON public.keep_alive_logs (status);

-- ── REPLICA IDENTITY ─────────────────────────────────────────

ALTER TABLE public.notes REPLICA IDENTITY FULL;

-- ── TRIGGERS ─────────────────────────────────────────────────

DROP TRIGGER IF EXISTS update_folders_updated_at  ON public.folders;
CREATE TRIGGER update_folders_updated_at
  BEFORE UPDATE ON public.folders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_notes_updated_at    ON public.notes;
CREATE TRIGGER update_notes_updated_at
  BEFORE UPDATE ON public.notes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

DROP TRIGGER IF EXISTS notes_discord_logger ON public.notes;
CREATE TRIGGER notes_discord_logger
  AFTER INSERT ON public.notes
  FOR EACH ROW EXECUTE FUNCTION public.notify_discord_logger();

-- ── ROW LEVEL SECURITY ───────────────────────────────────────

ALTER TABLE public.profiles       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.folders        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notes          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.login_history  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.keep_alive_logs ENABLE ROW LEVEL SECURITY;

-- profiles
DROP POLICY IF EXISTS "Users can view their own profile"   ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile"   ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);

-- user_roles
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage roles"        ON public.user_roles;
CREATE POLICY "Users can view their own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage roles"        ON public.user_roles FOR ALL    TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- folders
DROP POLICY IF EXISTS "Users can view their own folders"   ON public.folders;
DROP POLICY IF EXISTS "Users can create their own folders" ON public.folders;
DROP POLICY IF EXISTS "Users can update their own folders" ON public.folders;
DROP POLICY IF EXISTS "Users can delete their own folders" ON public.folders;
CREATE POLICY "Users can view their own folders"   ON public.folders FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own folders" ON public.folders FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own folders" ON public.folders FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own folders" ON public.folders FOR DELETE USING (auth.uid() = user_id);

-- notes (public — anyone can read/write, admins can manage)
DROP POLICY IF EXISTS "Anyone can view notes"           ON public.notes;
DROP POLICY IF EXISTS "Anyone can create notes"         ON public.notes;
DROP POLICY IF EXISTS "Anyone can update notes"         ON public.notes;
DROP POLICY IF EXISTS "Anyone can delete notes"         ON public.notes;
DROP POLICY IF EXISTS "Anyone can read active notes"    ON public.notes;
DROP POLICY IF EXISTS "Anyone can insert notes"         ON public.notes;
DROP POLICY IF EXISTS "Admins can update notes"         ON public.notes;
DROP POLICY IF EXISTS "Admins can delete notes"         ON public.notes;
DROP POLICY IF EXISTS "Users can view their own notes"  ON public.notes;
DROP POLICY IF EXISTS "Users can create their own notes" ON public.notes;
DROP POLICY IF EXISTS "Users can update their own notes" ON public.notes;
DROP POLICY IF EXISTS "Users can delete their own notes" ON public.notes;
CREATE POLICY "Anyone can view notes"   ON public.notes FOR SELECT USING (true);
CREATE POLICY "Anyone can create notes" ON public.notes FOR INSERT WITH CHECK (true);
CREATE POLICY "Admins can update notes" ON public.notes FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete notes" ON public.notes FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- login_history
DROP POLICY IF EXISTS "Users can view their own login history"   ON public.login_history;
DROP POLICY IF EXISTS "Users can insert their own login history" ON public.login_history;
DROP POLICY IF EXISTS "Users can update their own login history" ON public.login_history;
CREATE POLICY "Users can view their own login history"   ON public.login_history FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own login history" ON public.login_history FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own login history" ON public.login_history FOR UPDATE USING (auth.uid() = user_id);

-- keep_alive_logs
DROP POLICY IF EXISTS "Admins can view keep-alive logs" ON public.keep_alive_logs;
CREATE POLICY "Admins can view keep-alive logs" ON public.keep_alive_logs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- ── STORAGE POLICIES ─────────────────────────────────────────
-- Run these only after creating the 'note-files' bucket in the dashboard.

DROP POLICY IF EXISTS "Anyone can upload note files"            ON storage.objects;
DROP POLICY IF EXISTS "Anyone can update note files"            ON storage.objects;
DROP POLICY IF EXISTS "Anyone can delete note files"            ON storage.objects;
DROP POLICY IF EXISTS "Public read note files"                  ON storage.objects;
DROP POLICY IF EXISTS "Allow public uploads to public folder"   ON storage.objects;
DROP POLICY IF EXISTS "Allow public updates to public folder"   ON storage.objects;
DROP POLICY IF EXISTS "Allow public deletes from public folder" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own files"        ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own files"        ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own files"        ON storage.objects;

CREATE POLICY "Public read note files"    ON storage.objects FOR SELECT USING (bucket_id = 'note-files');
CREATE POLICY "Anyone can upload note files" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'note-files');
CREATE POLICY "Anyone can update note files" ON storage.objects FOR UPDATE USING (bucket_id = 'note-files');
CREATE POLICY "Anyone can delete note files" ON storage.objects FOR DELETE USING (bucket_id = 'note-files');

-- ── CRON JOBS ────────────────────────────────────────────────

SELECT cron.unschedule('cleanup-keep-alive-logs-daily') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'cleanup-keep-alive-logs-daily'
);
SELECT cron.schedule(
  'cleanup-keep-alive-logs-daily',
  '0 3 * * *',
  $$ SELECT public.cleanup_keep_alive_logs(); $$
);

-- ── GRANTS ───────────────────────────────────────────────────

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_role TO authenticated;

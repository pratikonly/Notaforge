CREATE EXTENSION IF NOT EXISTS "pg_graphql";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "plpgsql";
CREATE EXTENSION IF NOT EXISTS "supabase_vault";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";
BEGIN;

--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.1

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--



--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  INSERT INTO public.profiles (user_id, username, email)
  VALUES (NEW.id, NEW.raw_user_meta_data ->> 'username', NEW.email);
  RETURN NEW;
END;
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


SET default_table_access_method = heap;

--
-- Name: folders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.folders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    name text DEFAULT 'Untitled Folder'::text NOT NULL,
    color text DEFAULT 'default'::text,
    is_archived boolean DEFAULT false NOT NULL,
    is_deleted boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    parent_id uuid
);


--
-- Name: login_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.login_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    device_info text,
    browser text,
    os text,
    ip_address text,
    is_current_session boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: notes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    title text DEFAULT 'Untitled'::text NOT NULL,
    content text,
    note_type text DEFAULT 'text'::text NOT NULL,
    file_url text,
    file_name text,
    link_url text,
    is_pinned boolean DEFAULT false NOT NULL,
    color text DEFAULT 'default'::text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    is_archived boolean DEFAULT false NOT NULL,
    is_deleted boolean DEFAULT false NOT NULL,
    folder_id uuid,
    CONSTRAINT notes_note_type_check CHECK ((note_type = ANY (ARRAY['text'::text, 'image'::text, 'pdf'::text, 'video'::text, 'audio'::text, 'link'::text, 'file'::text])))
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    username text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    email text
);


--
-- Name: folders folders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.folders
    ADD CONSTRAINT folders_pkey PRIMARY KEY (id);


--
-- Name: login_history login_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.login_history
    ADD CONSTRAINT login_history_pkey PRIMARY KEY (id);


--
-- Name: notes notes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notes
    ADD CONSTRAINT notes_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_user_id_key UNIQUE (user_id);


--
-- Name: profiles profiles_username_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_username_key UNIQUE (username);


--
-- Name: idx_folders_parent_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_folders_parent_id ON public.folders USING btree (parent_id);


--
-- Name: idx_login_history_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_login_history_user_id ON public.login_history USING btree (user_id);


--
-- Name: idx_notes_archived; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notes_archived ON public.notes USING btree (is_archived) WHERE (is_archived = true);


--
-- Name: idx_notes_deleted; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notes_deleted ON public.notes USING btree (is_deleted) WHERE (is_deleted = true);


--
-- Name: folders update_folders_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_folders_updated_at BEFORE UPDATE ON public.folders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: notes update_notes_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_notes_updated_at BEFORE UPDATE ON public.notes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: profiles update_profiles_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: folders folders_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.folders
    ADD CONSTRAINT folders_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.folders(id) ON DELETE SET NULL;


--
-- Name: notes notes_folder_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notes
    ADD CONSTRAINT notes_folder_id_fkey FOREIGN KEY (folder_id) REFERENCES public.folders(id) ON DELETE SET NULL;


--
-- Name: notes notes_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notes
    ADD CONSTRAINT notes_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: folders Users can create their own folders; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create their own folders" ON public.folders FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: notes Users can create their own notes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create their own notes" ON public.notes FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: folders Users can delete their own folders; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own folders" ON public.folders FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: notes Users can delete their own notes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own notes" ON public.notes FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: login_history Users can insert their own login history; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own login history" ON public.login_history FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: profiles Users can insert their own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: folders Users can update their own folders; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own folders" ON public.folders FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: login_history Users can update their own login history; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own login history" ON public.login_history FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: notes Users can update their own notes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own notes" ON public.notes FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: profiles Users can update their own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: folders Users can view their own folders; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own folders" ON public.folders FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: login_history Users can view their own login history; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own login history" ON public.login_history FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: notes Users can view their own notes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own notes" ON public.notes FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: profiles Users can view their own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: folders; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.folders ENABLE ROW LEVEL SECURITY;

--
-- Name: login_history; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.login_history ENABLE ROW LEVEL SECURITY;

--
-- Name: notes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--




COMMIT;-- Update RLS policies for notes table to allow public access (no authentication required)
-- First, drop all existing policies on notes
DROP POLICY IF EXISTS "Users can create their own notes" ON public.notes;
DROP POLICY IF EXISTS "Users can delete their own notes" ON public.notes;
DROP POLICY IF EXISTS "Users can update their own notes" ON public.notes;
DROP POLICY IF EXISTS "Users can view their own notes" ON public.notes;

-- Create new public access policies for notes (anyone can CRUD)
CREATE POLICY "Anyone can view notes" 
ON public.notes 
FOR SELECT 
USING (true);

CREATE POLICY "Anyone can create notes" 
ON public.notes 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Anyone can update notes" 
ON public.notes 
FOR UPDATE 
USING (true);

CREATE POLICY "Anyone can delete notes" 
ON public.notes 
FOR DELETE 
USING (true);

-- Make user_id nullable since we won't require authentication
ALTER TABLE public.notes ALTER COLUMN user_id DROP NOT NULL;

-- Set a default value for user_id to null for anonymous notes
ALTER TABLE public.notes ALTER COLUMN user_id SET DEFAULT NULL;-- Drop existing restrictive upload policy
DROP POLICY IF EXISTS "Users can upload their own files" ON storage.objects;

-- Create policy to allow anyone to upload files to note-files bucket
CREATE POLICY "Anyone can upload note files"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'note-files');

-- Allow anyone to update files in note-files bucket
DROP POLICY IF EXISTS "Users can update their own files" ON storage.objects;
CREATE POLICY "Anyone can update note files"
ON storage.objects
FOR UPDATE
USING (bucket_id = 'note-files');

-- Allow anyone to delete files in note-files bucket
DROP POLICY IF EXISTS "Users can delete their own files" ON storage.objects;
CREATE POLICY "Anyone can delete note files"
ON storage.objects
FOR DELETE
USING (bucket_id = 'note-files');-- Drop existing user-based RLS policies on notes table
DROP POLICY IF EXISTS "Users can view own notes" ON public.notes;
DROP POLICY IF EXISTS "Users can create own notes" ON public.notes;
DROP POLICY IF EXISTS "Users can update own notes" ON public.notes;
DROP POLICY IF EXISTS "Users can delete own notes" ON public.notes;

-- Create new public access RLS policies
CREATE POLICY "Anyone can view notes" 
ON public.notes 
FOR SELECT 
USING (true);

CREATE POLICY "Anyone can create notes" 
ON public.notes 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Anyone can update notes" 
ON public.notes 
FOR UPDATE 
USING (true);

CREATE POLICY "Anyone can delete notes" 
ON public.notes 
FOR DELETE 
USING (true);-- Allow public uploads to the 'public' folder in note-files bucket
CREATE POLICY "Allow public uploads to public folder"
ON storage.objects
FOR INSERT
TO public
WITH CHECK (
  bucket_id = 'note-files' 
  AND (storage.foldername(name))[1] = 'public'
);

-- Allow public updates to files in public folder
CREATE POLICY "Allow public updates to public folder"
ON storage.objects
FOR UPDATE
TO public
USING (
  bucket_id = 'note-files' 
  AND (storage.foldername(name))[1] = 'public'
);

-- Allow public deletes to files in public folder
CREATE POLICY "Allow public deletes from public folder"
ON storage.objects
FOR DELETE
TO public
USING (
  bucket_id = 'note-files' 
  AND (storage.foldername(name))[1] = 'public'
);
-- Create role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- Create user_roles table
CREATE TABLE public.user_roles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL DEFAULT 'user',
    UNIQUE (user_id, role)
);

-- Enable RLS
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles (avoids RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- RLS: Users can read their own roles
CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- RLS: Only admins can manage roles
CREATE POLICY "Admins can manage roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='notes' AND policyname='Anyone can read active notes') THEN
    CREATE POLICY "Anyone can read active notes" ON public.notes FOR SELECT USING (is_archived = false AND is_deleted = false);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='notes' AND policyname='Anyone can insert notes') THEN
    CREATE POLICY "Anyone can insert notes" ON public.notes FOR INSERT WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='notes' AND policyname='Admins can update notes') THEN
    CREATE POLICY "Admins can update notes" ON public.notes FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='notes' AND policyname='Admins can delete notes') THEN
    CREATE POLICY "Admins can delete notes" ON public.notes FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
  END IF;
END $$;
-- Enable required extensions for scheduled cleanup
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Keep-alive logs table
CREATE TABLE public.keep_alive_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status text NOT NULL CHECK (status IN ('success', 'failure', 'unauthorized')),
  notes_count integer,
  response_time_ms integer,
  error_message text,
  source text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_keep_alive_logs_created_at ON public.keep_alive_logs (created_at DESC);
CREATE INDEX idx_keep_alive_logs_status ON public.keep_alive_logs (status);

ALTER TABLE public.keep_alive_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can read
CREATE POLICY "Admins can view keep-alive logs"
  ON public.keep_alive_logs
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Cleanup function: delete logs older than 7 days
CREATE OR REPLACE FUNCTION public.cleanup_keep_alive_logs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.keep_alive_logs WHERE created_at < now() - interval '7 days';
END;
$$;

-- Schedule daily cleanup at 03:00 UTC
SELECT cron.schedule(
  'cleanup-keep-alive-logs-daily',
  '0 3 * * *',
  $$ SELECT public.cleanup_keep_alive_logs(); $$
);ALTER TABLE public.notes REPLICA IDENTITY FULL;-- Enable pg_net for outbound HTTP from triggers
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Trigger function: posts new note to discord-logger edge function
CREATE OR REPLACE FUNCTION public.notify_discord_logger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_secret text;
  v_url text := 'https://ffhfmdfvqmfktkohdnlm.supabase.co/functions/v1/discord-logger';
BEGIN
  -- Best-effort: never block the insert if HTTP queue fails
  BEGIN
    SELECT decrypted_secret INTO v_secret
    FROM vault.decrypted_secrets
    WHERE name = 'DISCORD_LOGGER_SECRET'
    LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    v_secret := NULL;
  END;

  IF v_secret IS NULL THEN
    -- Fallback: skip silently. The edge function will reject without secret.
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-logger-secret', v_secret
    ),
    body := jsonb_build_object('record', to_jsonb(NEW))
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Never break the insert
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notes_discord_logger ON public.notes;
CREATE TRIGGER notes_discord_logger
  AFTER INSERT ON public.notes
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_discord_logger();CREATE OR REPLACE FUNCTION public.notify_discord_logger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  BEGIN
    PERFORM net.http_post(
      url := 'https://ffhfmdfvqmfktkohdnlm.supabase.co/functions/v1/discord-logger',
      headers := jsonb_build_object('Content-Type', 'application/json'),
      body := jsonb_build_object('record', to_jsonb(NEW))
    );
  EXCEPTION WHEN OTHERS THEN
    -- Never block the insert if the HTTP queue fails
    NULL;
  END;
  RETURN NEW;
END;
$$;
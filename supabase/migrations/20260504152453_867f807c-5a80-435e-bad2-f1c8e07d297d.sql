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
);
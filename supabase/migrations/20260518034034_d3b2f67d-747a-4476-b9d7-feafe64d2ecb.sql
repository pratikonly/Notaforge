-- Enable pg_net for outbound HTTP from triggers
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
  EXECUTE FUNCTION public.notify_discord_logger();
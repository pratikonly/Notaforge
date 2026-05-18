CREATE OR REPLACE FUNCTION public.notify_discord_logger()
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
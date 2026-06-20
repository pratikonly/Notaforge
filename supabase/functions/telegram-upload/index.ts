const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN');
    const CHAT_ID   = Deno.env.get('TELEGRAM_CHAT_ID');
    const PROJECT_URL = Deno.env.get('SUPABASE_URL');

    if (!BOT_TOKEN || !CHAT_ID) {
      return new Response(JSON.stringify({ error: 'TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not set' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File;
    if (!file) {
      return new Response(JSON.stringify({ error: 'No file provided' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Always use sendDocument — preserves original quality (sendPhoto compresses images)
    const tgForm = new FormData();
    tgForm.append('chat_id', CHAT_ID);
    tgForm.append('document', file, file.name);

    const tgRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendDocument`, {
      method: 'POST',
      body: tgForm,
    });

    const tgData = await tgRes.json();
    if (!tgData.ok) {
      console.error('Telegram error:', tgData);
      return new Response(JSON.stringify({ error: tgData.description || 'Telegram upload failed' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const fileId: string = tgData.result.document.file_id;
    const fileName: string = tgData.result.document.file_name ?? file.name;

    // Serve URL points to our telegram-serve edge function (keeps token secret)
    const serveUrl = `${PROJECT_URL}/functions/v1/telegram-serve?id=${fileId}`;

    return new Response(JSON.stringify({ url: serveUrl, fileId, fileName }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('telegram-upload error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

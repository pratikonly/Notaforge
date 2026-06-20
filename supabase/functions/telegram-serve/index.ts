// Proxies files from Telegram — keeps bot token server-side, never exposed to browser.
// Browser caches responses for 1 year so repeated loads don't re-hit this function.

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    const fileId = url.searchParams.get('id');

    if (!fileId) {
      return new Response('Missing id parameter', { status: 400 });
    }

    const BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN');
    if (!BOT_TOKEN) {
      return new Response('TELEGRAM_BOT_TOKEN not set', { status: 500 });
    }

    // Step 1: get file path from Telegram
    const infoRes = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/getFile?file_id=${fileId}`
    );
    const infoData = await infoRes.json();

    if (!infoData.ok) {
      console.error('Telegram getFile error:', infoData);
      return new Response('File not found', { status: 404 });
    }

    // Step 2: fetch the actual file bytes from Telegram CDN
    const filePath = infoData.result.file_path;
    const fileRes = await fetch(
      `https://api.telegram.org/file/bot${BOT_TOKEN}/${filePath}`
    );

    if (!fileRes.ok) {
      return new Response('Failed to fetch file from Telegram', { status: 502 });
    }

    const contentType = fileRes.headers.get('Content-Type') ?? 'application/octet-stream';

    return new Response(fileRes.body, {
      headers: {
        'Content-Type': contentType,
        // Cache aggressively — file_ids are permanent in Telegram
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });

  } catch (err) {
    console.error('telegram-serve error:', err);
    return new Response(String(err), { status: 500 });
  }
});

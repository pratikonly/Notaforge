// Proxies files from Telegram — keeps bot token server-side, never exposed to browser.
// Browser caches responses for 1 year so repeated loads don't re-hit this function.

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    const fileId   = url.searchParams.get('id');
    const fileName = url.searchParams.get('name') ?? '';

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

    // Step 2: fetch the actual file bytes from Telegram CDN.
    // Forward Range so browsers can load video metadata and seek efficiently.
    const filePath = infoData.result.file_path;
    const range = req.headers.get('Range');
    const fileRes = await fetch(
      `https://api.telegram.org/file/bot${BOT_TOKEN}/${filePath}`,
      range ? { headers: { Range: range } } : undefined,
    );

    if (!fileRes.ok) {
      return new Response('Failed to fetch file from Telegram', { status: 502 });
    }

    // Telegram may return application/octet-stream for documents, even when
    // the original upload is a playable video. Prefer the filename's type in
    // that case so HTMLMediaElement can identify the response correctly.
    const extension = fileName.split('.').pop()?.toLowerCase();
    const extensionTypes: Record<string, string> = {
      mp4: 'video/mp4',
      webm: 'video/webm',
      ogv: 'video/ogg',
      mov: 'video/quicktime',
      m4v: 'video/x-m4v',
      avi: 'video/x-msvideo',
      mkv: 'video/x-matroska',
    };
    const upstreamType = fileRes.headers.get('Content-Type');
    const contentType = upstreamType && upstreamType !== 'application/octet-stream'
      ? upstreamType
      : extensionTypes[extension ?? ''] ?? upstreamType ?? 'application/octet-stream';

    // Determine safe display name for Content-Disposition
    const safeName = fileName
      ? encodeURIComponent(fileName).replace(/['()]/g, escape)
      : filePath.split('/').pop() ?? 'file';

    const headers = new Headers({
      'Content-Type': contentType,
      // inline = open in browser (not force-download); filename shown in browser tab / save dialog
      'Content-Disposition': `inline; filename="${safeName}"`,
      // Cache aggressively — file_ids are permanent in Telegram
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Accept-Ranges': fileRes.headers.get('Accept-Ranges') ?? 'bytes',
      'Access-Control-Allow-Origin': '*',
    });

    for (const header of ['Content-Length', 'Content-Range']) {
      const value = fileRes.headers.get(header);
      if (value) headers.set(header, value);
    }

    return new Response(fileRes.body, {
      status: fileRes.status,
      headers,
    });

  } catch (err) {
    console.error('telegram-serve error:', err);
    return new Response(String(err), { status: 500 });
  }
});

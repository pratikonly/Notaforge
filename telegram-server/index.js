/**
 * NotaForge Telegram MTProto Upload Server
 * Deploy on Render (free tier) + UptimeRobot ping every 5 min.
 *
 * Handles files up to 2 GB using Telegram's MTProto API (GramJS).
 * Files ≤ 50 MB are handled by the Supabase edge function (Bot API).
 *
 * Env vars needed on Render:
 *   TELEGRAM_API_ID      — from my.telegram.org
 *   TELEGRAM_API_HASH    — from my.telegram.org
 *   TELEGRAM_SESSION     — from generate-session.js (run once locally)
 *   TELEGRAM_CHAT_ID     — your private channel ID, e.g. -1001234567890
 *   RENDER_URL           — this server's URL, e.g. https://notaforge-tg.onrender.com
 *   PORT                 — set by Render automatically
 */

const express  = require('express');
const cors     = require('cors');
const multer   = require('multer');
const os       = require('os');
const fs       = require('fs');
const path     = require('path');
const { TelegramClient, Api } = require('telegram');
const { StringSession }       = require('telegram/sessions');
const { CustomFile }          = require('telegram/client/uploads');

const app = express();
app.use(cors());

// ── Config ────────────────────────────────────────────────────
const API_ID      = parseInt(process.env.TELEGRAM_API_ID  || '');
const API_HASH    = process.env.TELEGRAM_API_HASH          || '';
const SESSION_STR = process.env.TELEGRAM_SESSION           || '';
const RAW_CHAT_ID = process.env.TELEGRAM_CHAT_ID           || '';
const RENDER_URL  = (process.env.RENDER_URL || '').replace(/\/$/, '');
const PORT        = parseInt(process.env.PORT || '3000');

if (!API_ID || !API_HASH || !SESSION_STR || !RAW_CHAT_ID) {
  console.error('Missing required env vars: TELEGRAM_API_ID, TELEGRAM_API_HASH, TELEGRAM_SESSION, TELEGRAM_CHAT_ID');
  process.exit(1);
}

// Strip -100 prefix → raw channel ID for MTProto
const CHANNEL_ID_STR = RAW_CHAT_ID.replace(/^-100/, '');

// ── Multer — disk storage, 2 GB limit ─────────────────────────
const upload = multer({
  storage: multer.diskStorage({
    destination: os.tmpdir(),
    filename: (req, file, cb) => cb(null, `tg_${Date.now()}_${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`),
  }),
  limits: { fileSize: 2 * 1024 * 1024 * 1024 },
});

// ── Telegram client ───────────────────────────────────────────
const client = new TelegramClient(
  new StringSession(SESSION_STR),
  API_ID,
  API_HASH,
  {
    connectionRetries: 10,
    retryDelay: 2000,
    autoReconnect: true,   // reconnect automatically after any drop
    useWSS: false,
  }
);

let channelEntity = null;


async function ensureConnected() {
  // Verify the connection is truly alive with a lightweight API call.
  // client.connected can be stale after a silent TCP drop.
  try {
    if (!client.connected) {
      await client.connect();
      console.log('Connected to Telegram');
    } else {
      // Ping Telegram — if this throws, the socket is dead
      await client.getMe();
    }
  } catch {
    console.log('Connection check failed — reconnecting...');
    channelEntity = null;
    try { await client.disconnect(); } catch {}
    await client.connect();
    console.log('Reconnected to Telegram');
  }

  if (!channelEntity) {
    await client.getDialogs({ limit: 50 });
    channelEntity = await client.getEntity(BigInt(CHANNEL_ID_STR));
    console.log('Channel entity resolved:', channelEntity.title ?? CHANNEL_ID_STR);
  }
  return channelEntity;
}

// ── Telegram keepalive ────────────────────────────────────────
// Telegram closes idle MTProto connections after ~5–10 minutes.
// Ping every 4 minutes to keep the socket alive between uploads.
setInterval(async () => {
  try {
    await client.getMe();
  } catch (err) {
    console.log('Keepalive ping failed — reconnecting:', err.message);
    channelEntity = null;
    try { await client.disconnect(); } catch {}
    await client.connect().catch(() => {});
  }
}, 4 * 60 * 1000);

// ── SSE progress store ────────────────────────────────────────
// Maps uploadId → SSE response object so the upload handler can
// push real Telegram upload percentages back to the browser.
const progressClients = new Map();

function emitProgress(uploadId, pct) {
  const res = progressClients.get(uploadId);
  if (res) res.write(`data: ${pct}\n\n`);
}

function emitDone(uploadId) {
  const res = progressClients.get(uploadId);
  if (res) {
    res.write('event: done\ndata: 100\n\n');
    progressClients.delete(uploadId);
  }
}

// ── Routes ────────────────────────────────────────────────────

// Root redirect — visiting the server URL opens the main app
app.get('/', (req, res) => res.redirect('https://notaforge.qzz.io/'));

// UptimeRobot ping endpoint — keeps Render awake
app.get('/ping', (req, res) => res.json({ ok: true, ts: Date.now() }));

// SSE progress endpoint — browser subscribes before starting upload.
// The upload handler pushes real Telegram upload % here in real time.
app.get('/progress/:uploadId', (req, res) => {
  const { uploadId } = req.params;

  res.setHeader('Content-Type',  'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection',    'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // disable Nginx buffering on Render
  res.flushHeaders();

  progressClients.set(uploadId, res);

  // Heartbeat every 20 s — prevents Render's proxy from closing the connection
  const heartbeat = setInterval(() => {
    res.write(':heartbeat\n\n');
  }, 20000);

  req.on('close', () => {
    clearInterval(heartbeat);
    progressClients.delete(uploadId);
  });
});

// Upload endpoint — accepts any file up to 2 GB.
// Pass ?uploadId=<id> to receive real-time progress via the SSE endpoint above.
app.post('/upload', upload.single('file'), async (req, res) => {
  const tempPath = req.file?.path;
  const uploadId = req.query.uploadId || null;

  try {
    if (!req.file) return res.status(400).json({ error: 'No file provided' });

    const { originalname, size } = req.file;
    console.log(`Uploading "${originalname}" (${(size / 1024 / 1024).toFixed(1)} MB)`);

    const peer = await ensureConnected();

    // Upload file bytes to Telegram servers.
    // workers: 16 uploads 16 chunks in parallel — ~4x faster than workers: 4.
    // onProgress pushes the real percentage to the browser via SSE.
    const tgFile = await client.uploadFile({
      file: new CustomFile(originalname, size, tempPath),
      workers: 16,
      onProgress: (pct) => {
        const p = Math.round(pct * 100);
        process.stdout.write(`\rUpload ${p}%  `);
        if (uploadId) emitProgress(uploadId, p);
      },
    });
    console.log(`\nUpload complete, sending to channel...`);

    if (uploadId) emitDone(uploadId);

    const message = await client.sendFile(peer, {
      file: tgFile,
      forceDocument: true,
      caption: originalname,
    });

    const msgId    = message.id;
    const serveUrl = `${RENDER_URL}/file/${msgId}?name=${encodeURIComponent(originalname)}`;
    console.log(`Stored as message #${msgId}`);

    res.json({ url: serveUrl, fileName: originalname });

  } catch (err) {
    console.error('Upload error:', err);
    if (uploadId) progressClients.delete(uploadId);
    res.status(500).json({ error: String(err) });
  } finally {
    if (tempPath) fs.unlink(tempPath, () => {});
  }
});

// Serve endpoint — streams file from Telegram with Range request support.
// Range requests are required by browsers for video/audio seeking and PDF preview.
app.get('/file/:msgId', async (req, res) => {
  try {
    const msgId    = parseInt(req.params.msgId);
    const fileName = req.query.name || 'file';

    const peer     = await ensureConnected();
    const messages = await client.getMessages(peer, { ids: [msgId] });

    if (!messages?.length || !messages[0]) {
      return res.status(404).json({ error: 'Message not found' });
    }

    const message = messages[0];
    const doc     = message.media?.document;

    if (!doc) return res.status(404).json({ error: 'No document in message' });

    const mimeType = doc.mimeType || 'application/octet-stream';
    const fileSize = Number(doc.size);

    const fileLocation = new Api.InputDocumentFileLocation({
      id:            doc.id,
      accessHash:    doc.accessHash,
      fileReference: doc.fileReference,
      thumbSize:     '',
    });

    const CHUNK = 512 * 1024;
    const ALIGN = 4096;

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(String(fileName))}"`);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('Accept-Ranges', 'bytes');

    const rangeHeader = req.headers.range;

    if (rangeHeader) {
      const [startStr, endStr] = rangeHeader.replace(/bytes=/, '').split('-');
      const start  = parseInt(startStr, 10) || 0;
      const end    = endStr ? Math.min(parseInt(endStr, 10), fileSize - 1) : fileSize - 1;
      const length = end - start + 1;

      const alignedStart = Math.floor(start / ALIGN) * ALIGN;
      const skipBytes    = start - alignedStart;

      res.status(206);
      res.setHeader('Content-Range',  `bytes ${start}-${end}/${fileSize}`);
      res.setHeader('Content-Length', String(length));

      let sent    = 0;
      let skipped = 0;

      for await (const chunk of client.iterDownload({
        file:        fileLocation,
        requestSize: CHUNK,
        offset:      BigInt(alignedStart),
        limit:       skipBytes + length,
      })) {
        if (sent >= length) break;

        let buf = Buffer.from(chunk);

        if (skipped < skipBytes) {
          const toSkip = Math.min(skipBytes - skipped, buf.length);
          skipped += toSkip;
          buf = buf.slice(toSkip);
        }

        if (buf.length === 0) continue;

        const toSend = Math.min(buf.length, length - sent);
        const canContinue = res.write(buf.slice(0, toSend));
        sent += toSend;
        if (!canContinue) await new Promise(resolve => res.once('drain', resolve));
      }

    } else {
      res.setHeader('Content-Length', String(fileSize));

      for await (const chunk of client.iterDownload({
        file:        fileLocation,
        requestSize: CHUNK,
      })) {
        const canContinue = res.write(Buffer.from(chunk));
        if (!canContinue) await new Promise(resolve => res.once('drain', resolve));
      }
    }

    res.end();

  } catch (err) {
    console.error('Serve error:', err);
    if (!res.headersSent) res.status(500).json({ error: String(err) });
    else res.end();
  }
});

// ── Boot ──────────────────────────────────────────────────────
ensureConnected()
  .then(() => {
    app.listen(PORT, () => console.log(`\n🚀 Telegram server ready on port ${PORT}`));
  })
  .catch(err => {
    console.error('Failed to connect on startup:', err);
    process.exit(1);
  });

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
  { connectionRetries: 5, useWSS: false }
);

let channelEntity = null;

async function ensureConnected() {
  if (!client.connected) {
    await client.connect();
    console.log('Connected to Telegram');
  }
  if (!channelEntity) {
    // Populate entity cache so getEntity can resolve by ID
    await client.getDialogs({ limit: 50 });
    channelEntity = await client.getEntity(BigInt(CHANNEL_ID_STR));
    console.log('Channel entity resolved:', channelEntity.title ?? CHANNEL_ID_STR);
  }
  return channelEntity;
}

// ── Routes ────────────────────────────────────────────────────

// UptimeRobot ping endpoint — keeps Render awake
app.get('/ping', (req, res) => res.json({ ok: true, ts: Date.now() }));

// Upload endpoint — accepts any file up to 2 GB
app.post('/upload', upload.single('file'), async (req, res) => {
  const tempPath = req.file?.path;
  try {
    if (!req.file) return res.status(400).json({ error: 'No file provided' });

    const { originalname, size } = req.file;
    console.log(`Uploading "${originalname}" (${(size / 1024 / 1024).toFixed(1)} MB)`);

    const peer = await ensureConnected();

    // Upload file bytes to Telegram servers
    const tgFile = await client.uploadFile({
      file: new CustomFile(originalname, size, tempPath),
      workers: 4,
      onProgress: (pct) => process.stdout.write(`\rUpload ${(pct * 100).toFixed(0)}%  `),
    });
    console.log(`\nUpload complete, sending to channel...`);

    // Post to channel — gets a permanent message ID
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
    res.status(500).json({ error: String(err) });
  } finally {
    if (tempPath) fs.unlink(tempPath, () => {});
  }
});

// Serve endpoint — streams file from Telegram channel
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

    const mimeType = doc.mimeType  || 'application/octet-stream';
    const fileSize = doc.size?.toString();

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(String(fileName))}"`);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    if (fileSize) res.setHeader('Content-Length', fileSize);

    // Stream in 512 KB chunks — keeps memory low even for 2 GB files
    const fileLocation = new Api.InputDocumentFileLocation({
      id:            doc.id,
      accessHash:    doc.accessHash,
      fileReference: doc.fileReference,
      thumbSize:     '',
    });

    for await (const chunk of client.iterDownload({
      file:        fileLocation,
      requestSize: 512 * 1024,
    })) {
      const canContinue = res.write(Buffer.from(chunk));
      if (!canContinue) {
        await new Promise(resolve => res.once('drain', resolve));
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

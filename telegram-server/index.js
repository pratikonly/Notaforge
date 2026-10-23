/**
 * NotaForge Telegram MTProto Server (Render)
 *
 * Env vars: TELEGRAM_API_ID, TELEGRAM_API_HASH, TELEGRAM_SESSION,
 *           TELEGRAM_CHAT_ID, RENDER_URL, PORT
 */

const express  = require('express');
const cors     = require('cors');
const multer   = require('multer');
const os       = require('os');
const fs       = require('fs');
const { TelegramClient, Api } = require('telegram');
const { StringSession }       = require('telegram/sessions');
const { CustomFile }          = require('telegram/client/uploads');
const bigInt                  = require('big-integer'); // GramJS needs this type for offsets, not native BigInt

const app = express();
app.use(cors({ exposedHeaders: ['Content-Range', 'Accept-Ranges', 'Content-Length'] }));

// ── Config ────────────────────────────────────────────────────
const API_ID      = parseInt(process.env.TELEGRAM_API_ID || '');
const API_HASH    = process.env.TELEGRAM_API_HASH || '';
const SESSION_STR = process.env.TELEGRAM_SESSION || '';
const RAW_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '';
const RENDER_URL  = (process.env.RENDER_URL || '').replace(/\/$/, '');
const PORT        = parseInt(process.env.PORT || '3000');

if (!API_ID || !API_HASH || !SESSION_STR || !RAW_CHAT_ID) {
  console.error('Missing required env vars: TELEGRAM_API_ID, TELEGRAM_API_HASH, TELEGRAM_SESSION, TELEGRAM_CHAT_ID');
  process.exit(1);
}

const CHANNEL_ID_STR = RAW_CHAT_ID.replace(/^-100/, '');

// ── Multer: disk storage, 2 GB limit ──────────────────────────
const upload = multer({
  storage: multer.diskStorage({
    destination: os.tmpdir(),
    filename: (req, file, cb) =>
      cb(null, `tg_${Date.now()}_${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`),
  }),
  limits: { fileSize: 2 * 1024 * 1024 * 1024 },
});

// ── Telegram client (single persistent connection) ────────────
const client = new TelegramClient(new StringSession(SESSION_STR), API_ID, API_HASH, {
  connectionRetries: Infinity,
  retryDelay: 2000,
  autoReconnect: true,
  useWSS: false,
  floodSleepThreshold: 60,
});
client.setLogLevel('warn');

let channelEntity = null;
let connecting    = null; // mutex: only one connect/reconnect at a time

async function resolveChannel() {
  if (channelEntity) return channelEntity;
  await client.getDialogs({ limit: 50 });
  channelEntity = await client.getEntity(BigInt(CHANNEL_ID_STR));
  console.log('Channel resolved:', channelEntity.title ?? CHANNEL_ID_STR);
  return channelEntity;
}

async function hardReconnect() {
  if (connecting) return connecting;
  connecting = (async () => {
    console.log('Reconnecting to Telegram...');
    channelEntity = null;
    try { await client.disconnect(); } catch {}
    await client.connect();
    await resolveChannel();
    console.log('Reconnected');
  })().finally(() => { connecting = null; });
  return connecting;
}

// Fast path: no network call when already connected.
async function getPeer() {
  if (connecting) await connecting;
  if (!client.connected) await hardReconnect();
  return channelEntity || resolveChannel();
}

// Health check every 60 s keeps the socket warm and repairs silent drops.
setInterval(async () => {
  try {
    await client.getMe();
  } catch (err) {
    console.log('Health check failed:', err.message);
    hardReconnect().catch(e => console.error('Reconnect failed:', e.message));
  }
}, 60 * 1000);

// Self-ping through the public URL so Render never idles the service.
if (RENDER_URL) {
  setInterval(() => {
    fetch(`${RENDER_URL}/ping`).catch(() => {});
  }, 10 * 60 * 1000);
}

// ── Document cache (avoids getMessages on every range request) ─
const DOC_TTL = 20 * 60 * 1000;
const DOC_MAX = 500;
const docCache = new Map(); // msgId -> { doc, ts }

function cacheGet(msgId) {
  const e = docCache.get(msgId);
  if (!e) return null;
  if (Date.now() - e.ts > DOC_TTL) { docCache.delete(msgId); return null; }
  return e.doc;
}
function cacheSet(msgId, doc) {
  if (docCache.size >= DOC_MAX) docCache.delete(docCache.keys().next().value);
  docCache.set(msgId, { doc, ts: Date.now() });
}

async function loadDoc(msgId, force = false) {
  if (!force) {
    const hit = cacheGet(msgId);
    if (hit) return hit;
  }
  const peer = await getPeer();
  const messages = await client.getMessages(peer, { ids: [msgId] });
  const doc = messages?.[0]?.media?.document;
  if (!doc) return null;
  cacheSet(msgId, doc);
  return doc;
}

// ── SSE progress ──────────────────────────────────────────────
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

// ── Mime fallback ─────────────────────────────────────────────
const MIME_BY_EXT = {
  mp4: 'video/mp4', m4v: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime',
  mkv: 'video/x-matroska', mp3: 'audio/mpeg', m4a: 'audio/mp4', wav: 'audio/wav',
  ogg: 'audio/ogg', pdf: 'application/pdf',
};
function resolveMime(docMime, fileName) {
  if (docMime && docMime !== 'application/octet-stream') return docMime;
  const ext = String(fileName).split('.').pop().toLowerCase();
  return MIME_BY_EXT[ext] || 'application/octet-stream';
}

// ── Routes ────────────────────────────────────────────────────
app.get('/', (req, res) => res.redirect('https://notaforge.qzz.io/'));

app.get('/ping', (req, res) => res.json({ ok: true, connected: client.connected, ts: Date.now() }));

app.get('/progress/:uploadId', (req, res) => {
  const { uploadId } = req.params;
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  progressClients.set(uploadId, res);
  const heartbeat = setInterval(() => res.write(':heartbeat\n\n'), 20000);
  req.on('close', () => {
    clearInterval(heartbeat);
    progressClients.delete(uploadId);
  });
});

app.post('/upload', upload.single('file'), async (req, res) => {
  const tempPath = req.file?.path;
  const uploadId = req.query.uploadId || null;

  try {
    if (!req.file) return res.status(400).json({ error: 'No file provided' });

    const { originalname, size } = req.file;
    console.log(`Uploading "${originalname}" (${(size / 1024 / 1024).toFixed(1)} MB)`);

    const peer = await getPeer();

    const tgFile = await client.uploadFile({
      file: new CustomFile(originalname, size, tempPath),
      workers: 8,
      onProgress: (pct) => {
        if (uploadId) emitProgress(uploadId, Math.round(pct * 100));
      },
    });

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

// Stream a byte range [start, end] of a document to the response.
// Telegram requires offsets aligned to the request size, so we align and skip.
async function streamRange(doc, start, end, res, isClosed) {
  const CHUNK = 512 * 1024;
  const length = end - start + 1;
  const alignedStart = Math.floor(start / CHUNK) * CHUNK;
  const skipBytes = start - alignedStart;
  const chunks = Math.ceil((skipBytes + length) / CHUNK);

  const fileLocation = new Api.InputDocumentFileLocation({
    id: doc.id,
    accessHash: doc.accessHash,
    fileReference: doc.fileReference,
    thumbSize: '',
  });

  let sent = 0;
  let skipped = 0;

  for await (const chunk of client.iterDownload({
    file: fileLocation,
    requestSize: CHUNK,
    offset: bigInt(alignedStart),
    limit: chunks,
    dcId: doc.dcId,
  })) {
    if (isClosed() || sent >= length) break;

    let buf = Buffer.from(chunk);
    if (skipped < skipBytes) {
      const toSkip = Math.min(skipBytes - skipped, buf.length);
      skipped += toSkip;
      buf = buf.subarray(toSkip);
    }
    if (buf.length === 0) continue;

    const toSend = Math.min(buf.length, length - sent);
    const ok = res.write(buf.subarray(0, toSend));
    sent += toSend;

    if (!ok) {
      await new Promise(resolve => {
        const done = () => { res.off('drain', done); res.off('close', done); resolve(); };
        res.once('drain', done);
        res.once('close', done);
      });
    }
  }
}

app.get('/file/:msgId', async (req, res) => {
  let closed = false;
  res.on('close', () => { closed = true; });
  const isClosed = () => closed;

  try {
    const msgId    = parseInt(req.params.msgId);
    const fileName = req.query.name || 'file';

    let doc = await loadDoc(msgId);
    if (!doc) return res.status(404).json({ error: 'Message or document not found' });

    const fileSize = Number(doc.size);
    const mimeType = resolveMime(doc.mimeType, fileName);

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(String(fileName))}`);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('Accept-Ranges', 'bytes');

    let start = 0;
    let end   = fileSize - 1;
    let partial = false;

    const rangeHeader = req.headers.range;
    if (rangeHeader) {
      const m = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim());
      if (!m || (m[1] === '' && m[2] === '')) {
        res.setHeader('Content-Range', `bytes */${fileSize}`);
        return res.status(416).end();
      }
      if (m[1] === '') {
        // suffix range: last N bytes
        const n = parseInt(m[2], 10);
        start = Math.max(0, fileSize - n);
      } else {
        start = parseInt(m[1], 10);
        if (m[2] !== '') end = Math.min(parseInt(m[2], 10), fileSize - 1);
        else end = Math.min(fileSize - 1, start + 16 * 1024 * 1024 - 1); // cap open-ended ranges
      }
      if (start >= fileSize || start > end) {
        res.setHeader('Content-Range', `bytes */${fileSize}`);
        return res.status(416).end();
      }
      partial = true;
    }

    res.status(partial ? 206 : 200);
    if (partial) res.setHeader('Content-Range', `bytes ${start}-${end}/${fileSize}`);
    res.setHeader('Content-Length', String(end - start + 1));

    try {
      await streamRange(doc, start, end, res, isClosed);
    } catch (err) {
      // Expired file reference: refresh the document and retry once, if nothing was sent yet.
      if (String(err).includes('FILE_REFERENCE') && !res.headersSent) {
        docCache.delete(msgId);
        doc = await loadDoc(msgId, true);
        if (!doc) return res.status(404).json({ error: 'Document not found' });
        await streamRange(doc, start, end, res, isClosed);
      } else {
        throw err;
      }
    }

    res.end();
  } catch (err) {
    if (closed) return;
    console.error('Serve error:', err.message || err);
    if (!res.headersSent) res.status(500).json({ error: String(err) });
    else res.end();
  }
});

// ── Boot ──────────────────────────────────────────────────────
client.connect()
  .then(resolveChannel)
  .then(() => {
    console.log('Connected to Telegram');
    app.listen(PORT, () => console.log(`Telegram server ready on port ${PORT}`));
  })
  .catch(err => {
    console.error('Failed to connect on startup:', err);
    process.exit(1);
  });
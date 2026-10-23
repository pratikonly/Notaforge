const SUPABASE_URL        = import.meta.env.VITE_SUPABASE_URL as string;
const ANON_KEY            = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
// Set VITE_TELEGRAM_SERVER_URL to your Render URL to enable 2 GB uploads via MTProto.
// If not set, uploads are capped at 50 MB via the Supabase edge function (Bot API).
export const MTPROTO_SERVER_URL = (import.meta.env.VITE_TELEGRAM_SERVER_URL as string | undefined)?.replace(/\/$/, '') ?? '';

export const MAX_FILE_SIZE = MTPROTO_SERVER_URL
  ? 2  * 1024 * 1024 * 1024  // 2 GB via MTProto
  : 50 * 1024 * 1024;         // 50 MB via Bot API

export const MAX_FILE_SIZE_LABEL = MTPROTO_SERVER_URL ? '2 GB' : '50 MB';

// Bot API can only download files up to 20 MB (getFile limit), so anything
// larger must go through the Render MTProto server, which can serve any size.
const BOT_API_LIMIT = 15 * 1024 * 1024;

export async function uploadToTelegram(
  file: File,
  onProgress?: (pct: number) => void,
): Promise<{ url: string; fileName: string } | null> {
  if (MTPROTO_SERVER_URL && file.size > BOT_API_LIMIT) {
    return uploadViaMTProto(file, onProgress);
  }
  return uploadViaBotAPI(file, onProgress);
}

function xhrUpload(
  url: string,
  formData: FormData,
  headers: Record<string, string>,
  onProgress?: (pct: number) => void,
): Promise<any> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);
    for (const [k, v] of Object.entries(headers)) {
      xhr.setRequestHeader(k, v);
    }
    if (onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          // Cap at 90% — the remaining 10% represents the server-side Telegram upload.
          // onProgress(100) is called only after the server responds successfully.
          onProgress(Math.min(90, Math.round((e.loaded / e.total) * 90)));
        }
      };
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        if (onProgress) onProgress(100);
        try {
          resolve(JSON.parse(xhr.responseText));
        } catch {
          reject(new Error('Invalid JSON response'));
        }
      } else {
        try {
          const err = JSON.parse(xhr.responseText);
          reject(new Error(err.error || `HTTP ${xhr.status}`));
        } catch {
          reject(new Error(`HTTP ${xhr.status}`));
        }
      }
    };
    xhr.onerror = () => reject(new Error('Network error during upload'));
    xhr.send(formData);
  });
}

async function uploadViaBotAPI(
  file: File,
  onProgress?: (pct: number) => void,
): Promise<{ url: string; fileName: string }> {
  const formData = new FormData();
  formData.append('file', file);

  const data = await xhrUpload(
    `${SUPABASE_URL}/functions/v1/telegram-upload`,
    formData,
    { apikey: ANON_KEY },
    onProgress,
  );

  if (data.error) throw new Error(data.error);
  return { url: data.url, fileName: data.fileName ?? file.name };
}

async function uploadViaMTProto(
  file: File,
  onProgress?: (pct: number) => void,
): Promise<{ url: string; fileName: string }> {
  // Generate a unique ID so the SSE endpoint and upload endpoint share state
  const uploadId = Math.random().toString(36).slice(2) + Date.now().toString(36);
  const formData = new FormData();
  formData.append('file', file);

  // ── Phase 1: browser → Render (XHR, 0–30%) ──────────────────
  // ── Phase 2: Render → Telegram (SSE, 30–100%) ───────────────
  //
  // Open the SSE stream first so it's ready before Render starts
  // the Telegram upload (which begins only after Phase 1 finishes).

  let eventSource: EventSource | null = null;

  if (onProgress) {
    eventSource = new EventSource(`${MTPROTO_SERVER_URL}/progress/${uploadId}`);

    eventSource.onmessage = (e) => {
      const tgPct = parseInt(e.data, 10);
      if (!isNaN(tgPct)) {
        // Map Telegram's 0–100 into the 30–99 range on the UI bar
        onProgress(30 + Math.round(tgPct * 0.69));
      }
    };

    eventSource.addEventListener('done', () => {
      onProgress(100);
      eventSource?.close();
      eventSource = null;
    });
  }

  try {
    // XHR progress maps to 0–30% (browser → Render).
    // SSE takes over at 30% once the file reaches Render.
    const data = await xhrUpload(
      `${MTPROTO_SERVER_URL}/upload?uploadId=${uploadId}`,
      formData,
      {},
      onProgress
        ? (pct) => onProgress(Math.round(pct * 0.30)) // 0–90% XHR → 0–27% UI
        : undefined,
    );

    if (data.error) throw new Error(data.error);
    return { url: data.url, fileName: data.fileName ?? file.name };
  } finally {
    eventSource?.close();
  }
}
const SUPABASE_URL        = import.meta.env.VITE_SUPABASE_URL as string;
const ANON_KEY            = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
// Set VITE_TELEGRAM_SERVER_URL to your Render URL to enable 2 GB uploads via MTProto.
// If not set, uploads are capped at 50 MB via the Supabase edge function (Bot API).
export const MTPROTO_SERVER_URL = (import.meta.env.VITE_TELEGRAM_SERVER_URL as string | undefined)?.replace(/\/$/, '') ?? '';

export const MAX_FILE_SIZE = MTPROTO_SERVER_URL
  ? 2  * 1024 * 1024 * 1024  // 2 GB via MTProto
  : 50 * 1024 * 1024;         // 50 MB via Bot API

export const MAX_FILE_SIZE_LABEL = MTPROTO_SERVER_URL ? '2 GB' : '50 MB';

export async function uploadToTelegram(
  file: File,
  onProgress?: (pct: number) => void,
): Promise<{ url: string; fileName: string } | null> {
  if (MTPROTO_SERVER_URL && file.size > 50 * 1024 * 1024) {
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
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
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
  const formData = new FormData();
  formData.append('file', file);

  const data = await xhrUpload(
    `${MTPROTO_SERVER_URL}/upload`,
    formData,
    {},
    onProgress,
  );

  if (data.error) throw new Error(data.error);
  return { url: data.url, fileName: data.fileName ?? file.name };
}

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
  file: File
): Promise<{ url: string; fileName: string } | null> {
  // Route large files to MTProto server (Render), small files to Supabase edge function
  if (MTPROTO_SERVER_URL && file.size > 50 * 1024 * 1024) {
    return uploadViaMTProto(file);
  }
  return uploadViaBotAPI(file);
}

async function uploadViaBotAPI(file: File): Promise<{ url: string; fileName: string }> {
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch(`${SUPABASE_URL}/functions/v1/telegram-upload`, {
    method: 'POST',
    headers: { apikey: ANON_KEY },
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Upload failed');
  }

  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return { url: data.url, fileName: data.fileName ?? file.name };
}

async function uploadViaMTProto(file: File): Promise<{ url: string; fileName: string }> {
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch(`${MTPROTO_SERVER_URL}/upload`, {
    method: 'POST',
    body: formData,
    // No timeout — large files take time
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Large file upload failed');
  }

  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return { url: data.url, fileName: data.fileName ?? file.name };
}

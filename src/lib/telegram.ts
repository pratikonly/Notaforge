const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const ANON_KEY     = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

export async function uploadToTelegram(
  file: File
): Promise<{ url: string; fileName: string } | null> {
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch(`${SUPABASE_URL}/functions/v1/telegram-upload`, {
    method: 'POST',
    headers: { apikey: ANON_KEY },
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Telegram upload failed');
  }

  const data = await res.json();
  if (data.error) throw new Error(data.error);

  return { url: data.url, fileName: data.fileName ?? file.name };
}

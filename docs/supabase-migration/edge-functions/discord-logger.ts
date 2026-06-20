// Discord logger: posts new notes to category-specific Discord webhooks.
// Triggered by a Postgres trigger via pg_net after INSERT on public.notes.
// Auth model: the function verifies that the posted note.id actually exists in
// the database (using the service role key) before sending to Discord.

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_DISCORD_FILE = 10 * 1024 * 1024; // 10 MB

const WEBHOOKS = {
  text: Deno.env.get("DISCORD_WEBHOOK_TEXT") ?? "",
  images: Deno.env.get("DISCORD_WEBHOOK_IMAGES") ?? "",
  links: Deno.env.get("DISCORD_WEBHOOK_LINKS") ?? "",
  files: Deno.env.get("DISCORD_WEBHOOK_FILES") ?? "",
};

const COLORS = {
  text: 0x3b82f6,
  images: 0xa855f7,
  links: 0x10b981,
  files: 0xf59e0b,
};

type Note = {
  id: string;
  title: string;
  content: string | null;
  note_type: string;
  file_url: string | null;
  file_name: string | null;
  link_url: string | null;
  created_at: string;
};

function getExt(name?: string | null, url?: string | null): string {
  const src = (name || url || "").toLowerCase().split("?")[0];
  const m = src.match(/\.([a-z0-9]+)$/);
  return m?.[1] ?? "";
}
function isImage(ext: string) {
  return ["jpg", "jpeg", "png", "gif", "webp", "heic", "bmp", "svg", "avif"].includes(ext);
}
function pickChannel(note: Note): keyof typeof WEBHOOKS {
  if (note.link_url) return "links";
  if (note.file_url) {
    const ext = getExt(note.file_name, note.file_url);
    if (isImage(ext)) return "images";
    return "files";
  }
  return "text";
}
function fmtBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}
function truncate(s: string, max: number) {
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + "…";
}

function buildEmbed(
  note: Note,
  channel: keyof typeof WEBHOOKS,
  fileMeta?: { size: number; mime: string; tooBig: boolean },
) {
  const fields: { name: string; value: string; inline?: boolean }[] = [];
  fields.push({ name: "Type", value: note.note_type || "text", inline: true });
  fields.push({
    name: "Created",
    value: `<t:${Math.floor(new Date(note.created_at).getTime() / 1000)}:f>`,
    inline: true,
  });
  if (note.file_name) fields.push({ name: "File", value: truncate(note.file_name, 100) });
  if (fileMeta) {
    fields.push({ name: "Size", value: fmtBytes(fileMeta.size), inline: true });
    fields.push({ name: "MIME", value: fileMeta.mime || "unknown", inline: true });
    if (fileMeta.tooBig) {
      fields.push({
        name: "⚠️ Too large for Discord",
        value: "File exceeds 10 MB upload limit — open via link below.",
      });
    }
  }
  if (note.link_url) fields.push({ name: "Link", value: note.link_url });
  if (note.file_url) fields.push({ name: "URL", value: note.file_url });

  const embed: Record<string, unknown> = {
    title: truncate(note.title || "Untitled", 256),
    color: COLORS[channel],
    fields,
    footer: { text: `NotaForge · ${note.id.slice(0, 8)}` },
    timestamp: note.created_at,
  };
  if (note.content) embed.description = truncate(note.content, 3800);
  if (channel === "images" && note.file_url && !fileMeta?.tooBig) {
    embed.image = { url: note.file_url };
  } else if (channel === "images" && note.file_url) {
    embed.thumbnail = { url: note.file_url };
  }
  return embed;
}

async function postEmbedOnly(webhook: string, embed: unknown) {
  return await fetch(webhook, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "NotaForge", embeds: [embed] }),
  });
}

async function postWithFile(webhook: string, embed: unknown, fileName: string, blob: Blob) {
  const fd = new FormData();
  fd.append(
    "payload_json",
    JSON.stringify({
      username: "NotaForge",
      embeds: [embed],
      attachments: [{ id: 0, filename: fileName }],
    }),
  );
  fd.append("files[0]", blob, fileName);
  return await fetch(webhook, { method: "POST", body: fd });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const incoming: Note = payload.record ?? payload.new ?? payload;
  if (!incoming?.id) {
    return new Response(JSON.stringify({ error: "Missing note id" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Verify the note actually exists in the database. Acts as auth: only real
  // inserted notes will be logged, even though the function is public.
  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const { data: note, error } = await admin
    .from("notes")
    .select("id,title,content,note_type,file_url,file_name,link_url,created_at")
    .eq("id", incoming.id)
    .maybeSingle();
  if (error || !note) {
    return new Response(JSON.stringify({ error: "Note not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const channel = pickChannel(note as Note);
  const webhook = WEBHOOKS[channel];
  if (!webhook) {
    console.warn(`No webhook configured for channel: ${channel}`);
    return new Response(JSON.stringify({ ok: true, skipped: channel }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    if (channel === "text" || channel === "links") {
      const embed = buildEmbed(note as Note, channel);
      const res = await postEmbedOnly(webhook, embed);
      if (!res.ok) console.error(`Discord ${channel} ${res.status}:`, await res.text());
      return new Response(JSON.stringify({ ok: res.ok, channel }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!note.file_url) {
      const embed = buildEmbed(note as Note, channel);
      await postEmbedOnly(webhook, embed);
      return new Response(JSON.stringify({ ok: true, channel }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let size = 0;
    let mime = "";
    try {
      const head = await fetch(note.file_url, { method: "HEAD" });
      size = Number(head.headers.get("content-length") ?? "0");
      mime = head.headers.get("content-type") ?? "";
    } catch (e) {
      console.warn("HEAD failed", e);
    }

    if (size > 0 && size > MAX_DISCORD_FILE) {
      const embed = buildEmbed(note as Note, channel, { size, mime, tooBig: true });
      const res = await postEmbedOnly(webhook, embed);
      if (!res.ok) console.error(`Discord ${channel} embed ${res.status}:`, await res.text());
      return new Response(JSON.stringify({ ok: res.ok, channel, tooBig: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const fileRes = await fetch(note.file_url);
    if (!fileRes.ok) {
      console.error(`Failed to fetch file: ${fileRes.status}`);
      const embed = buildEmbed(note as Note, channel, { size, mime, tooBig: false });
      await postEmbedOnly(webhook, embed);
      return new Response(JSON.stringify({ ok: false, channel }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const buf = await fileRes.arrayBuffer();
    const realSize = buf.byteLength;
    const realMime =
      fileRes.headers.get("content-type") ?? mime ?? "application/octet-stream";

    if (realSize > MAX_DISCORD_FILE) {
      const embed = buildEmbed(note as Note, channel, {
        size: realSize,
        mime: realMime,
        tooBig: true,
      });
      const res = await postEmbedOnly(webhook, embed);
      if (!res.ok) console.error(`Discord ${channel} embed ${res.status}:`, await res.text());
      return new Response(JSON.stringify({ ok: res.ok, channel, tooBig: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const blob = new Blob([buf], { type: realMime });
    const fileName =
      note.file_name ||
      note.file_url.split("/").pop()?.split("?")[0] ||
      `file.${getExt(null, note.file_url) || "bin"}`;
    const embed = buildEmbed(note as Note, channel, {
      size: realSize,
      mime: realMime,
      tooBig: false,
    });
    const res = await postWithFile(webhook, embed, fileName, blob);
    if (!res.ok) console.error(`Discord ${channel} upload ${res.status}:`, await res.text());

    return new Response(JSON.stringify({ ok: res.ok, channel, size: realSize }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("discord-logger error", e);
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

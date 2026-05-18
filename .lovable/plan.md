# Discord Logger for New Notes

Mirror every newly created note to Discord, routed into 4 channels by content type.

## Channel routing

| Channel | Used for |
|---|---|
| **Text** webhook | `note_type === 'text'` notes (title + content embed) |
| **Images** webhook | Image files (jpg/png/gif/webp/heic…) |
| **Links** webhook | Notes with `link_url` set |
| **Files** webhook | Everything else: pdf, docx, audio, video, zip, etc. |

A note with both text and an attachment posts to the attachment's channel; a note with a link goes to Links.

## File-size behavior (per attachment)

1. **≤ 10 MB** → attach the file directly to the Discord message.
2. **> 10 MB** → fall back to a metadata embed only:
   - Title, note type, file type/MIME, file size (MB), created date, link to the Cloudinary URL.
   - No compression attempted (per your choice).

Discord webhook hard limits are respected: 10 MB upload cap, 8 attachments max, 6000-char embed total.

## Trigger

- **Database webhook** on `INSERT` into `public.notes` → calls a new edge function `discord-logger`.
- This works no matter where the note came from (web, mobile, future API).
- The webhook is created via SQL using `pg_net` to POST to the edge function, signed with `KEEP_ALIVE_SECRET`-style shared secret (new secret: `DISCORD_LOGGER_SECRET`).

## Secrets to add

- `DISCORD_WEBHOOK_TEXT`
- `DISCORD_WEBHOOK_IMAGES`
- `DISCORD_WEBHOOK_LINKS`
- `DISCORD_WEBHOOK_FILES`
- `DISCORD_LOGGER_SECRET` (random, used to authenticate the DB → function call)

I'll request these via the secrets tool once you approve. You'll create each webhook in Discord (Channel → Edit → Integrations → Webhooks → New Webhook → Copy URL) and paste them in.

## Edge function: `supabase/functions/discord-logger/index.ts`

- Verifies the shared secret header.
- Parses the inserted note row from the DB-webhook payload.
- Picks the correct webhook URL based on type/extension.
- Builds a rich embed:
  - Title (note title), description (truncated content), fields: type, size, filename, created_at, author = "NotaForge".
  - Color-coded per channel (text=blue, images=purple, links=green, files=amber).
  - Thumbnail = image URL for image notes.
- If file ≤ 10 MB → `fetch` the Cloudinary URL, then `multipart/form-data` POST to webhook with embed + file.
- If > 10 MB → POST embed only with a "Download" link button (Discord link in embed).
- Returns 200 even on Discord failure (logs error), so DB webhook doesn't retry forever.

## Migration

- Create a `pg_net` trigger or Supabase database webhook on `notes` INSERT.
- Approach: small SQL migration enabling `pg_net` and a trigger function `notify_discord_logger()` that does `net.http_post(...)` to the edge function URL with the new row as JSON.

## Files

- New: `supabase/functions/discord-logger/index.ts`
- New: migration creating `notify_discord_logger()` trigger + enabling `pg_net`
- No frontend changes.

## Out of scope

- Compression (skipped per your choice).
- Updates/deletes (only INSERT logs, per your wording "every new notes added").
- Retry queue (single attempt, errors logged to function logs).

/**
 * Run this ONCE to generate a Telegram session string.
 * Usage:
 *   TELEGRAM_API_ID=12345678 TELEGRAM_API_HASH=abc123 node generate-session.js
 *
 * Then copy the printed session string and add it to Render env vars
 * as TELEGRAM_SESSION. Keep it secret — it's like a password.
 */

const { TelegramClient } = require('telegram');
const { StringSession } = require('telegram/sessions');
const readline = require('readline');

const API_ID   = parseInt(process.env.TELEGRAM_API_ID   || process.argv[2] || '');
const API_HASH = process.env.TELEGRAM_API_HASH || process.argv[3] || '';

if (!API_ID || !API_HASH) {
  console.error('Usage: TELEGRAM_API_ID=xxx TELEGRAM_API_HASH=xxx node generate-session.js');
  process.exit(1);
}

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise(res => rl.question(q, res));

async function main() {
  const client = new TelegramClient(new StringSession(''), API_ID, API_HASH, {
    connectionRetries: 5,
  });

  await client.start({
    phoneNumber: async () => ask('📱 Phone number (with country code, e.g. +91...): '),
    password:    async () => ask('🔐 2FA password (press Enter if none): '),
    phoneCode:   async () => ask('📨 OTP code sent to your Telegram: '),
    onError: (err) => console.error('Auth error:', err),
  });

  const session = client.session.save();

  console.log('\n✅ Session generated!\n');
  console.log('Add this to Render as TELEGRAM_SESSION:\n');
  console.log(session);
  console.log('\n⚠️  Keep this secret — it gives full Telegram account access.');

  rl.close();
  await client.disconnect();
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });

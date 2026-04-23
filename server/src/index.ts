import dotenv from 'dotenv';
dotenv.config();

import fs from 'fs';
import app from './app';
import connectDB from './config/db';

// If YOUTUBE_COOKIES_B64 (or YOUTUBE_COOKIES) is provided, write the cookies file
// so yt-dlp can bypass "Sign in to confirm you're not a bot" on datacenter IPs.
// Accepts either base64-encoded or raw Netscape cookie text — auto-detects.
const cookiesInput = process.env.YOUTUBE_COOKIES_B64 || process.env.YOUTUBE_COOKIES;
const cookiesPath = process.env.COOKIES_PATH || '/app/cookies.txt';

const looksLikeCookiesFile = (s: string) =>
  s.includes('\t') && (/^# Netscape HTTP Cookie File/m.test(s) || /\.youtube\.com/.test(s));

if (cookiesInput) {
  let content = '';
  try {
    const decoded = Buffer.from(cookiesInput, 'base64').toString('utf8');
    if (looksLikeCookiesFile(decoded)) content = decoded;
  } catch {}
  if (!content && looksLikeCookiesFile(cookiesInput)) {
    content = cookiesInput;
  }
  if (content) {
    try {
      fs.writeFileSync(cookiesPath, content);
      console.log(`[INIT] YouTube cookies written to ${cookiesPath} (${content.split('\n').length} lines)`);
    } catch (err: any) {
      console.error(`[INIT] Failed to write cookies file: ${err.message}`);
    }
  } else {
    console.error('[INIT] YOUTUBE_COOKIES_B64 is set but does not decode to a valid Netscape cookies file.');
    console.error('[INIT] Expected base64 of the exported youtube.com_cookies.txt.');
  }
}

const PORT = process.env.PORT || 5000;

// Start HTTP server first so health check is always reachable, even if DB fails.
app.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
});

connectDB().catch((err) => {
  console.error(`[FATAL] Database connection failed: ${err.message}`);
});

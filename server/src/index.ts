import dotenv from 'dotenv';
dotenv.config();

import fs from 'fs';
import app from './app';
import connectDB from './config/db';

// If YOUTUBE_COOKIES_B64 is provided, decode it to the cookies file so yt-dlp
// can bypass "Sign in to confirm you're not a bot" on datacenter IPs.
const cookiesB64 = process.env.YOUTUBE_COOKIES_B64;
const cookiesPath = process.env.COOKIES_PATH || '/app/cookies.txt';
if (cookiesB64) {
  try {
    fs.writeFileSync(cookiesPath, Buffer.from(cookiesB64, 'base64').toString('utf8'));
    console.log(`[INIT] YouTube cookies written to ${cookiesPath}`);
  } catch (err: any) {
    console.error(`[INIT] Failed to write cookies file: ${err.message}`);
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

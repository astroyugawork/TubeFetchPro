import { Request, Response } from 'express';
import { exec } from 'child_process';
import util from 'util';
import path from 'path';
import fs from 'fs';
import { resolveInputType, fetchVideoMetadata } from '../services/youtubeService';
import * as youtubeService from '../services/youtubeService';
import { convertToMp3 } from '../services/ffmpegService';
import ChannelCache from '../models/ChannelCache';

const execPromise = util.promisify(exec);

const getYtDlpPath = () => {
  if (process.env.YT_DLP_PATH && process.env.YT_DLP_PATH !== 'yt-dlp') {
    return process.env.YT_DLP_PATH;
  }
  const isWin = process.platform === 'win32';
  const localBin = path.join(__dirname, '../../bin', isWin ? 'yt-dlp.exe' : 'yt-dlp');
  if (fs.existsSync(localBin)) return `"${localBin}"`;
  return 'yt-dlp';
};

const YT_DLP = getYtDlpPath();

const MP4_HEIGHT: Record<string, number> = { high: 1080, medium: 720, low: 480 };

const sanitizeFilename = (s: string) =>
  s.replace(/[\\/:*?"<>|\x00-\x1f]/g, '').replace(/\s+/g, ' ').slice(0, 120).trim() || 'download';

export const resolveInput = async (req: Request, res: Response) => {
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'URL is required' });

    const type = resolveInputType(url);
    res.json({ type, originalUrl: url });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const fetchMetadata = async (req: Request, res: Response) => {
  try {
    const { videoUrl } = req.body;
    if (!videoUrl) return res.status(400).json({ error: 'videoUrl is required' });

    const metadata = await fetchVideoMetadata(videoUrl);
    res.json(metadata);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const directDownload = async (req: Request, res: Response) => {
  const url = (req.query.url || '').toString();
  const type = (req.query.type || 'mp4').toString();
  const quality = (req.query.quality || 'high').toString();
  const title = (req.query.title || 'download').toString();

  if (!url) return res.status(400).json({ error: 'url is required' });
  if (type !== 'mp3' && type !== 'mp4') return res.status(400).json({ error: 'type must be mp3 or mp4' });

  const tempDir = path.resolve(__dirname, '../../temp');
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

  const id = `dl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const rawPath = path.join(tempDir, `${id}_raw.mp4`);
  let finalPath = rawPath;

  const cleanup = () => {
    try { if (fs.existsSync(rawPath)) fs.unlinkSync(rawPath); } catch {}
    try { if (finalPath !== rawPath && fs.existsSync(finalPath)) fs.unlinkSync(finalPath); } catch {}
  };

  try {
    const height = MP4_HEIGHT[quality] || MP4_HEIGHT.high;
    const formatSelector = `bestvideo[height<=${height}][ext=mp4]+bestaudio[ext=m4a]/best[height<=${height}][ext=mp4]/best[height<=${height}]`;
    const cmd = `${YT_DLP} -o "${rawPath}" -f "${formatSelector}" --no-playlist "${url}"`;
    console.log(`[DIRECT] ${cmd}`);
    await execPromise(cmd, { timeout: 600000, maxBuffer: 1024 * 1024 * 10 });

    if (!fs.existsSync(rawPath)) throw new Error('yt-dlp produced no file');

    if (type === 'mp3') {
      const mp3Path = path.join(tempDir, `${id}.mp3`);
      await convertToMp3(rawPath, mp3Path, quality);
      finalPath = mp3Path;
    }

    const safe = sanitizeFilename(title);
    const filename = `${safe}.${type}`;
    const encoded = encodeURIComponent(filename);

    res.setHeader('Content-Disposition', `attachment; filename="${safe}.${type}"; filename*=UTF-8''${encoded}`);
    res.setHeader('Content-Type', type === 'mp3' ? 'audio/mpeg' : 'video/mp4');
    res.setHeader('Content-Length', fs.statSync(finalPath).size.toString());

    const stream = fs.createReadStream(finalPath);
    stream.pipe(res);
    stream.on('close', cleanup);
    stream.on('error', cleanup);
    res.on('close', cleanup);
  } catch (err: any) {
    console.error(`[DIRECT ERROR] ${err.message}`);
    cleanup();
    if (!res.headersSent) res.status(500).json({ error: err.message });
  }
};

export const fetchChannelVideos = async (req: Request, res: Response) => {
  try {
    let { channelUrl } = req.body;
    if (!channelUrl) return res.status(400).json({ error: 'channelUrl is required' });

    // Handle @username shorthand
    if (channelUrl.startsWith('@')) {
      channelUrl = `https://www.youtube.com/${channelUrl}`;
    }

    // 1. Check ChannelCache first
    const cache = await ChannelCache.findOne({ channelUrl });
    if (cache) {
      // Return cached results if less than 1 hour old (freq update for dev)
      const isFresh = (new Date().getTime() - new Date(cache.lastFetchedAt).getTime()) < 1 * 60 * 60 * 1000;
      if (isFresh) {
        return res.json(cache);
      }
    }

    // 2. Fetch from YouTube with real service
    const rawData = await youtubeService.fetchChannelVideos(channelUrl);
    
    // 3. Update/Save to Cache
    const updatedCache = await ChannelCache.findOneAndUpdate(
      { channelUrl },
      { 
        channelName: rawData.channelName || channelUrl.split('/').pop() || 'YouTube Channel',
        fetchedVideos: rawData.fetchedVideos,
        lastFetchedAt: new Date(),
      },
      { upsert: true, new: true }
    );

    res.json(updatedCache);
  } catch (error: any) {
    console.error(`\x1b[31m[BACKEND ERROR] fetchChannelVideos for ${req.body.channelUrl} failed: ${error.message}\x1b[0m`);
    res.status(500).json({ error: error.message });
  }
};

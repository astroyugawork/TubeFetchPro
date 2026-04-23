import { exec } from 'child_process';
import util from 'util';
import path from 'path';
import fs from 'fs';

const execPromise = util.promisify(exec);

const getBinaryPath = () => {
  if (process.env.YT_DLP_PATH && process.env.YT_DLP_PATH !== 'yt-dlp') {
    return process.env.YT_DLP_PATH;
  }
  // Check project local bin
  const isWin = process.platform === 'win32';
  const binName = isWin ? 'yt-dlp.exe' : 'yt-dlp';
  const localBin = path.join(__dirname, '../../bin', binName);
  
  if (fs.existsSync(localBin)) return `"${localBin}"`;
  
  return 'yt-dlp';
};

const YT_DLP = getBinaryPath();

const COOKIES_PATH = process.env.COOKIES_PATH || '/app/cookies.txt';

// Shared yt-dlp flags to improve reliability on cloud IPs:
// - multiple YouTube player clients to bypass some bot checks
// - cookies file (if present) to bypass "Sign in to confirm you're not a bot"
export const getYtDlpCommonArgs = (): string => {
  const parts: string[] = [
    '--extractor-args "youtube:player_client=default,mweb,tv_embedded"',
  ];
  if (fs.existsSync(COOKIES_PATH)) {
    parts.push(`--cookies "${COOKIES_PATH}"`);
  }
  return parts.join(' ');
};

export const resolveInputType = (inputUrl: string) => {
  if (inputUrl.includes('youtube.com/watch') || inputUrl.includes('youtu.be/')) {
    return 'single_video';
  } else if (inputUrl.includes('youtube.com/@') || inputUrl.includes('youtube.com/channel/') || inputUrl.includes('youtube.com/c/')) {
    return 'channel_video';
  } else if (inputUrl.startsWith('@')) {
    return 'channel_video';
  }
  return 'unknown';
};

export const fetchVideoMetadata = async (videoUrl: string) => {
  try {
    const command = `${YT_DLP} ${getYtDlpCommonArgs()} --print "%(id)s||%(title)s||%(thumbnail)s||%(duration)s||%(uploader)s" --no-warnings "${videoUrl}"`;
    console.log(`[EXEC] ${command}`);
    const { stdout } = await execPromise(command);
    const [videoId, title, thumbnail, duration, channelName] = stdout.trim().split('||');
    
    return {
      videoId,
      title,
      thumbnail,
      duration: parseInt(duration) || 0,
      channelName: channelName || 'Unknown Channel',
    };
  } catch (error: any) {
    console.error(`[ERROR] yt-dlp metadata fetch failed: ${error.message}`);
    throw new Error('Failed to fetch video metadata. Ensure yt-dlp is installed and the URL is valid.');
  }
};

export const fetchChannelVideos = async (channelUrl: string, limit: number = 30) => {
  try {
    // In --flat-playlist mode, per-entry `thumbnail`, `uploader`, and `channel`
    // come back as "NA". We rely on playlist_channel/playlist_uploader for the
    // channel name and build thumbnail URLs directly from the video ID.
    const command = `${YT_DLP} ${getYtDlpCommonArgs()} --flat-playlist --playlist-end ${limit} --print "%(playlist_channel,playlist_uploader,channel,uploader)s||%(id)s||%(title)s||%(duration)s" --no-warnings --ignore-errors "${channelUrl}"`;
    console.log(`[EXEC] ${command}`);
    const { stdout } = await execPromise(command, { maxBuffer: 1024 * 1024 * 10 });

    const lines = stdout.trim().split('\n');
    let channelName = '';
    const videos = lines
      .filter(line => line.includes('||'))
      .map(line => {
        const parts = line.split('||');
        if (parts.length < 4) return null;
        const [uploader, videoId, title, duration] = parts;
        if (!videoId || videoId === 'NA') return null;
        if (uploader && uploader !== 'NA') channelName = uploader;
        return {
          videoId,
          title,
          duration: parseInt(duration) || 0,
          thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
        };
      })
      .filter((v): v is NonNullable<typeof v> => v !== null);

    if (!channelName) {
      const handleMatch = channelUrl.match(/@([\w.-]+)/);
      channelName = handleMatch ? `@${handleMatch[1]}` : 'YouTube Channel';
    }

    return {
      channelUrl,
      channelName,
      fetchedVideos: videos,
    };
  } catch (error: any) {
    console.error(`[ERROR] yt-dlp channel fetch failed: ${error.message}`);
    throw new Error('Failed to scan channel videos. Ensure the URL/Handle is valid.');
  }
};

import { exec } from 'child_process';
import util from 'util';

const execPromise = util.promisify(exec);

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
    const { stdout } = await execPromise(`yt-dlp --print "%(id)s,%(title)s,%(thumbnail)s,%(duration)s,%(uploader)s" --no-warnings "${videoUrl}"`);
    const [videoId, title, thumbnail, duration, channelName] = stdout.trim().split(',');
    
    return {
      videoId,
      title,
      thumbnail,
      duration: parseInt(duration) || 0,
      channelName,
    };
  } catch (error: any) {
    console.error(`[ERROR] yt-dlp metadata fetch failed: ${error.message}`);
    throw new Error('Failed to fetch video metadata. Ensure yt-dlp is installed and the URL is valid.');
  }
};

export const fetchChannelVideos = async (channelUrl: string, limit: number = 30) => {
  try {
    // Using --flat-playlist to get metadata without downloading
    // --playlist-end limits the number of videos to fetch for performance
    const { stdout } = await execPromise(
      `yt-dlp --flat-playlist --playlist-end ${limit} --print "%(id)s||%(title)s||%(duration)s||%(thumbnail)s" --no-warnings "${channelUrl}"`
    );

    const lines = stdout.trim().split('\n');
    const videos = lines
      .filter(line => line.includes('||'))
      .map(line => {
        const [videoId, title, duration, thumbnail] = line.split('||');
        return {
          videoId,
          title,
          duration: parseInt(duration) || 0,
          thumbnail,
        };
      });

    return {
      channelUrl,
      fetchedVideos: videos,
    };
  } catch (error: any) {
    console.error(`[ERROR] yt-dlp channel fetch failed: ${error.message}`);
    throw new Error('Failed to scan channel videos. Ensure the URL/Handle is valid.');
  }
};

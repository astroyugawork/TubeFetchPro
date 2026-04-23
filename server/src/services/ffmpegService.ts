import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs';
import path from 'path';

const getFfmpegPath = () => {
  if (process.env.FFMPEG_PATH && process.env.FFMPEG_PATH !== 'ffmpeg') {
    return process.env.FFMPEG_PATH;
  }
  // Check project local bin
  const isWin = process.platform === 'win32';
  const binName = isWin ? 'ffmpeg.exe' : 'ffmpeg';
  const localBin = path.join(__dirname, '../../bin', binName);
  
  if (fs.existsSync(localBin)) return localBin;
  
  return 'ffmpeg';
};

ffmpeg.setFfmpegPath(getFfmpegPath());

const MP3_BITRATES: Record<string, string> = {
  high: '320k',
  medium: '192k',
  low: '128k',
};

export const convertToMp3 = async (
  inputPath: string,
  outputPath: string,
  quality: string = 'high'
): Promise<string> => {
  const bitrate = MP3_BITRATES[quality] || MP3_BITRATES.high;
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .toFormat('mp3')
      .audioBitrate(bitrate)
      .on('start', (commandLine) => {
        console.log(`Spawned FFmpeg with command: ${commandLine}`);
      })
      .on('error', (err) => {
        console.error(`An error occurred: ${err.message}`);
        reject(err);
      })
      .on('end', () => {
        console.log('FFmpeg processing finished!');
        if (fs.existsSync(inputPath)) {
          fs.unlinkSync(inputPath);
        }
        resolve(outputPath);
      })
      .save(outputPath);
  });
};

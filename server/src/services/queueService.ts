import PQueue from 'p-queue';
import * as ffmpeg from 'fluent-ffmpeg';
import VideoJob from '../models/VideoJob';
import { convertToMp3 } from './ffmpegService';
import { uploadToCloudinary } from './cloudinaryService';
import { exec } from 'child_process';
import { v4 as uuidv4 } from 'uuid';
import util from 'util';
import path from 'path';
import fs from 'fs';

const execPromise = util.promisify(exec);
const queue = new PQueue({ concurrency: 1 }); // Process one video at a time to save resources

export const addJobToQueue = (jobId: string) => {
  queue.add(async () => {
    const job = await VideoJob.findById(jobId);
    if (!job) return;

    try {
      job.status = 'processing';
      await job.save();

      const tempDir = path.join(__dirname, '../../temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      const rawFilePath = path.join(tempDir, `${job.videoId}_raw.mp4`);
      
      // 1. Download Video with yt-dlp
      console.log(`Downloading ${job.sourceUrl} using yt-dlp...`);
      try {
        await execPromise(`yt-dlp -o "${rawFilePath}" -f "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best" --no-playlist "${job.sourceUrl}"`);
      } catch (dlError: any) {
        console.error(`[DOWNLOAD ERROR] ${dlError.message}`);
        throw new Error(`yt-dlp download failed: ${dlError.message}`);
      }

      if (!fs.existsSync(rawFilePath)) {
        throw new Error('Downloaded file not found on disk.');
      }

      let finalFilePath = rawFilePath;
      let resourceType: 'video' | 'raw' | 'auto' = 'video';

      // 2. Convert if needed
      if (job.outputType === 'mp3') {
        job.status = 'converting';
        await job.save();
        const mp3Path = path.join(tempDir, `${job.videoId}.mp3`);
        await convertToMp3(rawFilePath, mp3Path);
        finalFilePath = mp3Path;
        resourceType = 'auto'; // Use auto for mp3
      }

      // 3. Upload to Cloudinary
      job.status = 'uploading';
      await job.save();
      console.log(`Uploading to Cloudinary...`);
      const uploadResult = await uploadToCloudinary(
        finalFilePath, 
        job.customFilename || `${job.videoId}_${Date.now()}`,
        resourceType
      );

      // 4. Update Job
      job.status = 'completed';
      job.cloudUrl = uploadResult.url;
      job.fileSize = uploadResult.size;
      await job.save();
      console.log(`Job ${jobId} completed successfully.`);

    } catch (error: any) {
      console.error(`Job ${jobId} failed:`, error.message);
      job.status = 'failed';
      job.errorMessage = error.message;
      await job.save();
    } finally {
      // Cleanup temp files
      try {
        const tempDir = path.join(__dirname, '../../temp');
        const rawFilePath = path.join(tempDir, `${job.videoId}_raw.mp4`);
        const mp3Path = path.join(tempDir, `${job.videoId}.mp3`);
        
        if (fs.existsSync(rawFilePath)) fs.unlinkSync(rawFilePath);
        if (fs.existsSync(mp3Path)) fs.unlinkSync(mp3Path);
        console.log(`[CLEANUP] Deleted temp files for job ${job.videoId}`);
      } catch (cleanupErr: any) {
        console.error(`[CLEANUP ERROR] ${cleanupErr.message}`);
      }
    }
  });
};

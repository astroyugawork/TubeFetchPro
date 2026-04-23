import { Request, Response } from 'express';
import VideoJob from '../models/VideoJob';
import UsageConsent from '../models/UsageConsent';
import { fetchVideoMetadata } from '../services/youtubeService';
import { addJobToQueue } from '../services/queueService';

export const createJob = async (req: Request, res: Response) => {
  try {
    const { sourceUrl, outputType, quality, consentAccepted, customFilename } = req.body;
    const userId = (req as any).user?.id;

    if (!consentAccepted) {
      return res.status(403).json({ error: 'You must provide consent representing legal authority to process this content.' });
    }

    // Record consent
    await UsageConsent.create({
      userId,
      sourceUrl,
      accepted: true,
      ipAddress: req.ip
    });

    const metadata = await fetchVideoMetadata(sourceUrl);

    const job = await VideoJob.create({
      userId,
      inputType: 'single_video',
      sourceUrl,
      videoId: metadata.videoId,
      title: metadata.title,
      thumbnail: metadata.thumbnail,
      duration: metadata.duration,
      outputType: outputType || 'mp4',
      quality: quality || 'high',
      customFilename,
      status: 'pending',
      consentAccepted
    });

    addJobToQueue(job._id.toString());
    res.status(201).json(job);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const createBatchJobs = async (req: Request, res: Response) => {
  try {
    const { items, outputType, quality, consentAccepted } = req.body;
    const userId = (req as any).user?.id;

    if (!consentAccepted) {
      return res.status(403).json({ error: 'Consent is required for batch processing.' });
    }

    if (!items || !Array.isArray(items)) {
      return res.status(400).json({ error: 'Items array is required' });
    }

    const jobIds: string[] = [];

    for (const item of items) {
      // Record consent for each
      await UsageConsent.create({
        userId,
        sourceUrl: item.sourceUrl,
        accepted: true,
        ipAddress: req.ip
      });

      const job = await VideoJob.create({
        userId,
        inputType: 'channel_video',
        sourceUrl: item.sourceUrl,
        videoId: item.videoId,
        title: item.title,
        thumbnail: item.thumbnail,
        duration: item.duration,
        outputType: outputType || 'mp4',
        quality: quality || 'high',
        status: 'pending',
        consentAccepted
      });

      addJobToQueue(job._id.toString());
      jobIds.push(job._id.toString());
    }

    res.status(201).json({ message: `${jobIds.length} jobs created successfully`, jobIds });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getHistory = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    let query = {};
    if (userId) {
      query = { userId };
    }
    // If guest, we just show all recent broad history (limited for privacy)
    // or we could show only guest jobs? Let's show all latest for now.
    const jobs = await VideoJob.find(query).limit(50).sort({ createdAt: -1 });
    res.json(jobs);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getJob = async (req: Request, res: Response) => {
  try {
    const job = await VideoJob.findById(req.params.id);
    if (!job) return res.status(404).json({ error: 'Job not found' });
    res.json(job);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteJob = async (req: Request, res: Response) => {
  try {
    const job = await VideoJob.findByIdAndDelete(req.params.id);
    if (!job) return res.status(404).json({ error: 'Job not found' });
    res.json({ message: 'Job deleted' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

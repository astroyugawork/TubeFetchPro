import express from 'express';
import { resolveInput, fetchMetadata, fetchChannelVideos, directDownload } from '../controllers/youtubeController';

const router = express.Router();

router.post('/resolve-input', resolveInput);
router.post('/video-metadata', fetchMetadata);
router.post('/channel-videos', fetchChannelVideos);
router.get('/download', directDownload);

export default router;

import express from 'express';
import { resolveInput, fetchMetadata, fetchChannelVideos, directDownload, searchVideos } from '../controllers/youtubeController';

const router = express.Router();

router.post('/resolve-input', resolveInput);
router.post('/video-metadata', fetchMetadata);
router.post('/channel-videos', fetchChannelVideos);
router.post('/search', searchVideos);
router.get('/download', directDownload);

export default router;

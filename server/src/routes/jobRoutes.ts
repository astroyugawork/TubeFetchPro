import express from 'express';
import { createJob, createBatchJobs, getHistory, getJob, deleteJob, retryJob } from '../controllers/jobController';
import { protect } from '../middlewares/authMiddleware';

const router = express.Router();

router.post('/create', createJob);
router.post('/batch', createBatchJobs);
router.get('/history', getHistory);
router.get('/:id', getJob);
router.post('/:id/retry', retryJob);
router.delete('/:id', deleteJob);

export default router;

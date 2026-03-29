import express from 'express';
import { createJob, createBatchJobs, getHistory, getJob, deleteJob } from '../controllers/jobController';
import { protect } from '../middlewares/authMiddleware';

const router = express.Router();

router.post('/create', protect, createJob);
router.post('/batch', protect, createBatchJobs);
router.get('/history', protect, getHistory);
router.get('/:id', protect, getJob);
router.delete('/:id', protect, deleteJob);

export default router;

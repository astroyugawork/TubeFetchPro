import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import fs from 'fs';
import rateLimit from 'express-rate-limit';
import youtubeRoutes from './routes/youtubeRoutes';
import jobRoutes from './routes/jobRoutes';

const app = express();

// Railway/Vercel/etc sit behind a proxy — trust it so req.ip is correct for rate-limit.
app.set('trust proxy', 1);

app.use(morgan('dev'));

// Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests from this IP, please try again after 15 minutes' }
});

app.use('/api/', limiter);

// Health check - before ALL middleware
app.get(['/health', '/api/health'], (req, res) => {
  const cookiesPath = process.env.COOKIES_PATH || '/app/cookies.txt';
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    cookies: fs.existsSync(cookiesPath),
  });
});

// Middlewares
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['*'];

app.use(cors({
  origin: allowedOrigins.includes('*') ? '*' : allowedOrigins,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Routes
app.use('/api/youtube', youtubeRoutes);
app.use('/api/jobs', jobRoutes);

// Error Handling Middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(`\x1b[31m[BACKEND ERROR] ${err.message}\x1b[0m`);
  console.error(err.stack);
  
  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  res.status(statusCode).json({
    message: err.message,
    stack: process.env.NODE_ENV === 'production' ? null : err.stack,
  });
});

export default app;

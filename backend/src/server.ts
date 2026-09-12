import express, { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import path from 'path';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import { paymentMiddleware } from '@x402/express';
import { x402Server, x402Routes } from './config/x402';


// Load environment variables
dotenv.config();

// Route imports
import authRoutes from './routes/authRoutes';
import reportRoutes from './routes/reportRoutes';
import socialRoutes from './routes/socialRoutes';
import alertRoutes from './routes/alertRoutes';
import officialRoutes from './routes/officialRoutes';
import notificationRoutes from './routes/notificationRoutes';
import twilioRoutes from './routes/twilioRoutes';
import aiRoutes from './routes/aiRoutes';
import { syncOfficialAlerts } from './services/officialAlertService';
import agentRoutes from './routes/agentRoutes';
const app = express();
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/coastalert';

// 1. Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded images statically
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// 2. Rate Limiting on submissions to prevent spam
const reportRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // Limit each IP to 30 report submissions per window
  message: { message: 'Too many reports submitted from this IP, please try again later.' }
});
app.post('/api/reports', reportRateLimiter);

// 3. API Routes
app.use('/api/auth', authRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/social-signals', socialRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/official', officialRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/twilio', twilioRoutes);
app.use('/api/ai', aiRoutes);
app.use(paymentMiddleware(x402Routes, x402Server));
app.use('/api/agent', agentRoutes);


// Base Route
app.get('/', (req: Request, res: Response) => {
  res.json({
    name: 'CoastAlert REST API',
    status: 'Running',
    version: '1.0.0',
    timestamp: new Date()
  });
});
// Health Check
app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'CoastAlert API',
    timestamp: new Date()
  });
});
// 4. Centralized Error Handler Middleware
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('API Error:', err);
  res.status(err.status || 500).json({
    message: err.message || 'Internal Server Error',
    error: process.env.NODE_ENV === 'development' ? err : {}
  });
});

// 5. Connect to MongoDB and start Server
const startServer = async () => {
  console.log('Connecting to MongoDB at:', MONGODB_URI);
  try {
    await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 2000 } as any);
    console.log('Successfully connected to MongoDB.');
  } catch (err: any) {
    console.warn('MongoDB connection failure:', err.message);
    console.log('Attempting to start MongoMemoryServer (in-memory fallback)...');
    try {
      const { MongoMemoryServer } = require('mongodb-memory-server');
      const mongoServer = await MongoMemoryServer.create();
      const inMemoryUri = mongoServer.getUri();
      await mongoose.connect(inMemoryUri);
      console.log('Connected to In-Memory MongoDB:', inMemoryUri);
      console.log('Initialized in-memory database without seeded demo content.');
    } catch (mongoErr: any) {
      console.error('In-memory MongoDB startup failed:', mongoErr.message);
      process.exit(1);
    }
  }

  app.listen(PORT, () => {
    console.log(`Server is listening on port ${PORT}`);
  });

  // Synchronize official alerts on startup and keep them current periodically.
  try {
    await syncOfficialAlerts();
    setInterval(async () => {
      await syncOfficialAlerts();
    }, 10 * 60 * 1000); // every 10 minutes
  } catch (syncError: any) {
    console.warn('Initial official alert sync failed:', syncError.message);
  }
};

startServer();

export default app;

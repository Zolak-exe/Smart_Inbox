import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

import db from './db/database.js'; // Ensure DB is initialized
import emailRouter from './routes/emails.js';
import jobRouter from './routes/jobs.js';
import configRouter from './routes/config.js';
import spamRulesRouter from './routes/spamRules.js';
import aiConfigRouter  from './routes/aiConfig.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS for our frontend
app.use(cors({
  // null = Electron file:// origin, localhost variants = dev server
  origin: (origin, callback) => {
    const allowed = ['http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173'];
    if (!origin || allowed.includes(origin)) callback(null, true);
    else callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static assets if any
// app.use('/static', express.static(path.join(__dirname, 'public')));

// Mount API routes
app.use('/api/emails', emailRouter);
app.use('/api/jobs', jobRouter);
app.use('/api/config', configRouter);
app.use('/api/spam-rules', spamRulesRouter);
app.use('/api/ai', aiConfigRouter);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date() });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err.stack);
  res.status(500).json({ error: 'Internal Server Error', message: err.message });
});

app.listen(PORT, () => {
  console.log(`========================================`);
  console.log(` Server running on http://localhost:${PORT}`);
  console.log(` Workspace directory: ${path.resolve(__dirname, '..')}`);
  console.log(`========================================`);
});

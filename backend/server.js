/**
 * Systemfehler API Server
 * 
 * Express.js REST API for serving crawler data and moderation queue
 */

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import * as db from './database/connection.js';
import * as queries from './database/queries.js';

dotenv.config();

const app = express();
const PORT = process.env.API_PORT || 3001;

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Health check endpoint
app.get('/api/health', async (req, res) => {
  try {
    await db.query('SELECT 1');
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      database: 'connected'
    });
  } catch (error) {
    res.status(503).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      database: 'disconnected',
      error: error.message
    });
  }
});

// Status endpoint
app.get('/api/status', async (req, res) => {
  try {
    const stats = await queries.getStatistics();
    
    // Transform stats for response
    const byDomain = {};
    stats.entries.forEach(e => {
      if (!byDomain[e.domain]) {
        byDomain[e.domain] = {};
      }
      byDomain[e.domain][e.status] = parseInt(e.count);
    });
    
    const moderationStats = {};
    stats.moderation.forEach(m => {
      moderationStats[m.status] = parseInt(m.count);
    });
    
    res.json({
      database: {
        totalEntries: Object.values(byDomain).reduce((sum, domain) => {
          return sum + Object.values(domain).reduce((s, count) => s + count, 0);
        }, 0),
        byDomain
      },
      moderation: moderationStats,
      qualityScores: {
        avgIqs: parseFloat(stats.qualityScores.avg_iqs || 0).toFixed(2),
        avgAis: parseFloat(stats.qualityScores.avg_ais || 0).toFixed(2)
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Status endpoint error:', error);
    res.status(500).json({ error: 'Failed to fetch status' });
  }
});

// Get entries with filtering and pagination
app.get('/api/data/entries', async (req, res) => {
  try {
    const {
      domain,
      status,
      limit = 50,
      offset = 0,
      search
    } = req.query;
    
    const options = {
      domain,
      status,
      limit: Math.min(parseInt(limit), 100),
      offset: parseInt(offset)
    };
    
    let result;
    if (search) {
      result = await queries.searchEntries({
        ...options,
        searchText: search
      });
    } else {
      result = await queries.getAllEntries(options);
    }
    
    res.json(result);
  } catch (error) {
    console.error('Get entries error:', error);
    res.status(500).json({ error: 'Failed to fetch entries' });
  }
});

// Get single entry by ID
app.get('/api/data/entries/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const entry = await queries.getEntryById(id);
    
    if (!entry) {
      return res.status(404).json({ error: 'Entry not found' });
    }
    
    res.json({ entry });
  } catch (error) {
    console.error('Get entry error:', error);
    res.status(500).json({ error: 'Failed to fetch entry' });
  }
});

// Get moderation queue
app.get('/api/data/moderation-queue', async (req, res) => {
  try {
    const {
      status = 'pending',
      domain,
      limit = 100,
      offset = 0
    } = req.query;
    
    const queue = await queries.getModerationQueue({
      status,
      domain,
      limit: Math.min(parseInt(limit), 100),
      offset: parseInt(offset)
    });
    
    res.json({
      queue,
      total: queue.length,
      status,
      domain
    });
  } catch (error) {
    console.error('Get moderation queue error:', error);
    res.status(500).json({ error: 'Failed to fetch moderation queue' });
  }
});

// Get quality report
app.get('/api/data/quality-report', async (req, res) => {
  try {
    const report = await queries.getQualityReport();
    
    // Transform domain statistics
    const byDomain = {};
    report.byDomain.forEach(domain => {
      byDomain[domain.domain] = {
        totalEntries: parseInt(domain.total_entries),
        activeEntries: parseInt(domain.active_entries),
        avgIqs: parseFloat(domain.avg_iqs || 0).toFixed(2),
        avgAis: parseFloat(domain.avg_ais || 0).toFixed(2),
        missingEnTranslation: parseInt(domain.missing_en_translation),
        missingEasyDeTranslation: parseInt(domain.missing_easy_de_translation)
      };
    });
    
    res.json({
      byDomain,
      lowQualityEntries: report.lowQualityEntries.map(e => ({
        id: e.id,
        domain: e.domain,
        title: e.title_de,
        url: e.url,
        iqs: parseFloat(e.iqs || 0),
        ais: parseFloat(e.ais || 0)
      })),
      missingTranslations: report.missingTranslations.map(e => ({
        id: e.id,
        domain: e.domain,
        title: e.title_de,
        url: e.url,
        missingEn: e.missing_en,
        missingEasyDe: e.missing_easy_de
      }))
    });
  } catch (error) {
    console.error('Get quality report error:', error);
    res.status(500).json({ error: 'Failed to fetch quality report' });
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Start server
const server = app.listen(PORT, () => {
  console.log(`🚀 Systemfehler API server running on port ${PORT}`);
  console.log(`   Health check: http://localhost:${PORT}/api/health`);
  console.log(`   Status: http://localhost:${PORT}/api/status`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
  });
  
  await db.closePool();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
  });
  
  await db.closePool();
  process.exit(0);
});

export default app;

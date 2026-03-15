/**
 * Systemfehler API Server
 * 
 * Express.js REST API for serving crawler data and moderation queue
 */

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import * as db from './database/connection.js';
import * as queries from './database/queries.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { isTurnstileConfigured, verifyTurnstileToken } from './turnstile.js';

dotenv.config();

const PORT = process.env.API_PORT || 3001;

export function createApp({
  dbModule = db,
  queriesModule = queries,
  logger = console,
} = {}) {
  const app = express();
  const rawOrigins = process.env.CORS_ORIGIN || 'http://localhost:5173,http://localhost:5174';
  const allowedOrigins = rawOrigins.split(',').map(s => s.trim()).filter(Boolean);

  app.use(cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true);
      if (allowedOrigins.indexOf(origin) !== -1) {
        return callback(null, true);
      }
      return callback(new Error('CORS policy: origin not allowed'));
    },
    credentials: true
  }));
  app.use(express.json());

  const moderationQueueLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false
  });
  const searchLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 120,
    standardHeaders: true,
    legacyHeaders: false
  });
  const requireTurnstileForSearch =
    (process.env.API_REQUIRE_TURNSTILE_FOR_SEARCH || 'false').toLowerCase() === 'true';

  app.use((req, res, next) => {
    logger.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
  });

  async function maybeVerifyTurnstile(req, res, next) {
    if (!requireTurnstileForSearch || !isTurnstileConfigured()) {
      return next();
    }

    const searchValue =
      typeof req.query?.search === 'string' ? req.query.search.trim() : '';
    if (!searchValue) {
      return next();
    }

    try {
      const verification = await verifyTurnstileToken({
        token: req.get('x-turnstile-token') || '',
        remoteIp: req.ip,
      });

      if (!verification.success) {
        return res.status(403).json({
          error: 'turnstile_verification_failed',
          message: 'Bot protection verification failed.',
          errorCodes: verification.errorCodes,
        });
      }
      return next();
    } catch (error) {
      logger.error('Turnstile verification error:', error);
      return res.status(503).json({
        error: 'turnstile_unavailable',
        message: 'Bot protection service is temporarily unavailable.',
      });
    }
  }

  app.get('/api/health', async (req, res) => {
  try {
    await dbModule.query('SELECT 1');
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

  app.get('/api/version', async (req, res) => {
  res.json({
    service: 'systemfehler-api',
    version: process.env.npm_package_version || '0.1.0',
    runtime: 'node-express',
    deploymentTarget: process.env.DEPLOYMENT_TARGET || 'local-backend',
    host: req.get('host') || null,
    timestamp: new Date().toISOString()
  });
  });

  app.get('/api/status', async (req, res) => {
  try {
    const stats = await queriesModule.getStatistics();
    
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
    logger.error('Status endpoint error:', error);
    res.status(500).json({ error: 'Failed to fetch status' });
  }
  });

  app.get('/api/data/entries', searchLimiter, maybeVerifyTurnstile, async (req, res) => {
  try {
    const {
      domain,
      status,
      sourceTier,
      jurisdiction,
      limit = 50,
      offset = 0,
      search,
      includeTranslations = 'false'
    } = req.query;
    
    const options = {
      domain,
      status,
      sourceTier,
      jurisdiction,
      limit: Math.min(parseInt(limit), 100),
      offset: parseInt(offset),
      includeTranslations: includeTranslations === 'true' || includeTranslations === '1'
    };
    
    let result;
    if (search) {
      result = await queriesModule.searchEntriesForAutocomplete({
        ...options,
        searchText: search
      });
    } else {
      result = await queriesModule.getAllEntries(options);
    }
    
    res.json(result);
  } catch (error) {
    logger.error('Get entries error:', error);
    res.status(500).json({ error: 'Failed to fetch entries' });
  }
  });

  app.get('/api/data/entries/:id', searchLimiter, async (req, res) => {
  try {
    const { id } = req.params;
    const entry = await queriesModule.getEntryById(id);
    
    if (!entry) {
      return res.status(404).json({ error: 'Entry not found' });
    }
    
    res.json({ entry });
  } catch (error) {
    logger.error('Get entry error:', error);
    res.status(500).json({ error: 'Failed to fetch entry' });
  }
  });

  app.get('/api/data/moderation-queue', moderationQueueLimiter, async (req, res) => {
  try {
    const {
      status = 'pending',
      domain,
      limit = 100,
      offset = 0
    } = req.query;
    
    const queue = await queriesModule.getModerationQueue({
      status,
      domain,
      limit: Math.min(parseInt(limit), 100),
      offset: parseInt(offset)
    });
    // If DB returned no results, fall back to file-based moderation queue
    if ((!queue || queue.length === 0)) {
      try {
        const filePath = path.resolve(process.cwd(), 'moderation', 'review_queue.json');
        const fq = await fs.readFile(filePath, 'utf8');
        const fileItems = JSON.parse(fq || '[]');

        const mapped = Array.isArray(fileItems) ? fileItems.map((it) => {
          const entryId = it.entryId || it.entry_id || null;
          const candidateData = it.candidateData || it.candidate_data || null;
          const existingData = it.existingData || it.existing_data || null;
          const createdAt = it.createdAt || it.created_at || it.timestamp || null;
          const reviewedAt = it.reviewedAt || it.reviewed_at || null;
          const reviewedBy = it.reviewedBy || it.reviewed_by || null;
          // Always use string for title
          const titleDe = it.title_de || it.title?.de || candidateData?.title_de || candidateData?.title?.de || null;
          const url = it.url || candidateData?.url || it.source || null;

          return {
            id: it.id || entryId || null,
            entryId,
            entry_id: entryId,
            domain: it.domain || null,
            action: it.action || 'update',
            status: it.status || 'pending',
            candidateData,
            candidate_data: candidateData,
            existingData,
            existing_data: existingData,
            diff: it.diff || null,
            diffSummary: it.diffSummary || null,
            importantChanges: Array.isArray(it.importantChanges) ? it.importantChanges : [],
            provenance: it.provenance || { source: it.source || null },
            reviewedBy,
            reviewed_by: reviewedBy,
            reviewedAt,
            reviewed_at: reviewedAt,
            createdAt,
            created_at: createdAt,
            title: titleDe || undefined,
            title_de: titleDe,
            url
          };
        }) : [];

        return res.json({ queue: mapped, total: mapped.length, status, domain });
      } catch (err) {
        // log file read errors and continue to return DB result (which may be empty)
        logger.error('Failed to read moderation queue file fallback:', err && err.message ? err.message : err);
      }
    }

    res.json({
      queue,
      total: queue.length,
      status,
      domain
    });
  } catch (error) {
    logger.error('Get moderation queue error:', error);
    res.status(500).json({ error: 'Failed to fetch moderation queue', message: error && error.message ? error.message : undefined });
  }
  });

  app.get('/api/data/quality-report', async (req, res) => {
  try {
    const report = await queriesModule.getQualityReport();
    
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
        title: e.title_de, // always string
        url: e.url,
        iqs: parseFloat(e.iqs || 0),
        ais: parseFloat(e.ais || 0)
      })),
      missingTranslations: report.missingTranslations.map(e => ({
        id: e.id,
        domain: e.domain,
        title: e.title_de, // always string
        url: e.url,
        missingEn: e.missing_en,
        missingEasyDe: e.missing_easy_de
      }))
    });
  } catch (error) {
    logger.error('Get quality report error:', error);
    res.status(500).json({ error: 'Failed to fetch quality report' });
  }
  });

  app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
  });

  app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
  });

  return app;
}

export function startServer({
  port = PORT,
  dbModule = db,
  queriesModule = queries,
  logger = console,
} = {}) {
  const app = createApp({ dbModule, queriesModule, logger });
  const server = app.listen(port, () => {
    logger.log(`🚀 Systemfehler API server running on port ${port}`);
    logger.log(`   Health check: http://localhost:${port}/api/health`);
    logger.log(`   Status: http://localhost:${port}/api/status`);
  });

  const shutdown = async (signal) => {
    logger.log(`${signal} signal received: closing HTTP server`);
    server.close(() => {
      logger.log('HTTP server closed');
    });
    await dbModule.closePool();
    process.exit(0);
  };

  process.on('SIGTERM', () => {
    void shutdown('SIGTERM');
  });

  process.on('SIGINT', () => {
    void shutdown('SIGINT');
  });

  return { app, server };
}

const isMainModule = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMainModule) {
  startServer();
}

export default createApp();

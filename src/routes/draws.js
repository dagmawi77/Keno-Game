const express = require('express');
const { body, validationResult } = require('express-validator');
const drawService = require('../services/drawService');
const { logger, auditLog } = require('../config/logger');

const router = express.Router();

// Middleware to validate request
const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }
  next();
};

/**
 * GET /api/v1/draws
 * Get recent draws
 */
router.get('/', async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    const draws = await drawService.getRecentDraws(parseInt(limit));
    
    res.json({
      success: true,
      data: draws.map(draw => ({
        drawId: draw.id,
        drawNumber: draw.draw_number,
        drawTime: draw.draw_time,
        numbers: draw.numbers,
        status: draw.status,
        serverSeedHash: draw.server_seed_hash,
        clientSeed: draw.client_seed,
        nonce: draw.nonce,
        completedAt: draw.completed_at
      }))
    });
  } catch (error) {
    logger.error('Failed to get draws', { error: error.message });
    
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve draws'
    });
  }
});

/**
 * GET /api/v1/draws/upcoming
 * Get upcoming draws
 */
router.get('/upcoming', async (req, res) => {
  try {
    const draws = await drawService.getUpcomingDraws();
    
    res.json({
      success: true,
      data: draws.map(draw => ({
        drawId: draw.id,
        drawNumber: draw.draw_number,
        drawTime: draw.draw_time,
        status: draw.status
      }))
    });
  } catch (error) {
    logger.error('Failed to get upcoming draws', { error: error.message });
    
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve upcoming draws'
    });
  }
});

/**
 * GET /api/v1/draws/:drawId
 * Get specific draw details
 */
router.get('/:drawId', async (req, res) => {
  try {
    const { drawId } = req.params;
    const draw = await drawService.getDrawById(drawId);
    
    if (!draw) {
      return res.status(404).json({
        success: false,
        message: 'Draw not found'
      });
    }
    
    res.json({
      success: true,
      data: {
        drawId: draw.id,
        drawNumber: draw.draw_number,
        drawTime: draw.draw_time,
        numbers: draw.numbers,
        status: draw.status,
        serverSeedHash: draw.server_seed_hash,
        clientSeed: draw.client_seed,
        nonce: draw.nonce,
        completedAt: draw.completed_at
      }
    });
  } catch (error) {
    logger.error('Failed to get draw', { error: error.message, drawId: req.params.drawId });
    
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve draw'
    });
  }
});

/**
 * POST /api/v1/draws
 * Create a new draw (admin only)
 */
router.post('/', async (req, res) => {
  try {
    // Check if user is admin (assuming auth middleware sets req.user.role)
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }
    
    const { drawTime } = req.body;
    const draw = await drawService.createDraw(drawTime ? new Date(drawTime) : new Date());
    
    res.status(201).json({
      success: true,
      message: 'Draw created successfully',
      data: {
        drawId: draw.id,
        drawNumber: draw.draw_number,
        drawTime: draw.draw_time,
        status: draw.status
      }
    });
  } catch (error) {
    logger.error('Failed to create draw', { error: error.message, userId: req.user?.id });
    
    res.status(500).json({
      success: false,
      message: 'Failed to create draw'
    });
  }
});

/**
 * POST /api/v1/draws/:drawId/complete
 * Complete a draw and settle tickets (admin only)
 */
router.post('/:drawId/complete', async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }
    
    const { drawId } = req.params;
    const result = await drawService.completeDraw(drawId);
    
    res.json({
      success: true,
      message: 'Draw completed successfully',
      data: result
    });
  } catch (error) {
    logger.error('Failed to complete draw', { error: error.message, drawId: req.params.drawId });
    
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to complete draw'
    });
  }
});

/**
 * POST /api/v1/draws/:drawId/verify
 * Verify draw integrity using provably fair verification
 */
router.post('/:drawId/verify', async (req, res) => {
  try {
    const { drawId } = req.params;
    const result = await drawService.verifyDraw(drawId);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Failed to verify draw', { error: error.message, drawId: req.params.drawId });
    
    res.status(500).json({
      success: false,
      message: 'Failed to verify draw'
    });
  }
});

/**
 * GET /api/v1/draws/stats
 * Get draw statistics (admin only)
 */
router.get('/stats', async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }
    
    const stats = await drawService.getDrawStats();
    
    res.json({
      success: true,
      data: {
        totalDraws: parseInt(stats.total_draws),
        completedDraws: parseInt(stats.completed_draws),
        pendingDraws: parseInt(stats.pending_draws),
        avgTicketsPerDraw: parseFloat(stats.avg_tickets_per_draw) || 0
      }
    });
  } catch (error) {
    logger.error('Failed to get draw stats', { error: error.message, userId: req.user?.id });
    
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve draw statistics'
    });
  }
});

/**
 * POST /api/v1/draws/scheduler/start
 * Start automatic draw scheduler (admin only)
 */
router.post('/scheduler/start', async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }
    
    drawService.startScheduler();
    
    res.json({
      success: true,
      message: 'Draw scheduler started'
    });
  } catch (error) {
    logger.error('Failed to start scheduler', { error: error.message, userId: req.user?.id });
    
    res.status(500).json({
      success: false,
      message: 'Failed to start draw scheduler'
    });
  }
});

/**
 * POST /api/v1/draws/scheduler/stop
 * Stop automatic draw scheduler (admin only)
 */
router.post('/scheduler/stop', async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }
    
    drawService.stopScheduler();
    
    res.json({
      success: true,
      message: 'Draw scheduler stopped'
    });
  } catch (error) {
    logger.error('Failed to stop scheduler', { error: error.message, userId: req.user?.id });
    
    res.status(500).json({
      success: false,
      message: 'Failed to stop draw scheduler'
    });
  }
});

module.exports = router;

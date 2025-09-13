const express = require('express');
const paytableService = require('../models/paytable');
const { logger } = require('../config/logger');

const router = express.Router();

/**
 * GET /api/v1/paytables
 * Get all paytables
 */
router.get('/', async (req, res) => {
  try {
    const paytables = paytableService.getAllPaytables();
    
    res.json({
      success: true,
      data: paytables
    });
  } catch (error) {
    logger.error('Failed to get paytables', { error: error.message });
    
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve paytables'
    });
  }
});

/**
 * GET /api/v1/paytables/:spotSize
 * Get paytable for specific spot size
 */
router.get('/:spotSize', async (req, res) => {
  try {
    const { spotSize } = req.params;
    const spotSizeNum = parseInt(spotSize);
    
    if (isNaN(spotSizeNum) || spotSizeNum < 1 || spotSizeNum > 10) {
      return res.status(400).json({
        success: false,
        message: 'Spot size must be between 1 and 10'
      });
    }
    
    const paytable = paytableService.getPaytable(spotSizeNum);
    
    res.json({
      success: true,
      data: paytable
    });
  } catch (error) {
    logger.error('Failed to get paytable', { error: error.message, spotSize: req.params.spotSize });
    
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to retrieve paytable'
    });
  }
});

/**
 * GET /api/v1/paytables/rtp
 * Get RTP (Return to Player) percentages for all spot sizes
 */
router.get('/rtp', async (req, res) => {
  try {
    const rtps = paytableService.getAllRTPs();
    
    res.json({
      success: true,
      data: rtps
    });
  } catch (error) {
    logger.error('Failed to get RTPs', { error: error.message });
    
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve RTP data'
    });
  }
});

/**
 * GET /api/v1/paytables/:spotSize/rtp
 * Get RTP for specific spot size
 */
router.get('/:spotSize/rtp', async (req, res) => {
  try {
    const { spotSize } = req.params;
    const spotSizeNum = parseInt(spotSize);
    
    if (isNaN(spotSizeNum) || spotSizeNum < 1 || spotSizeNum > 10) {
      return res.status(400).json({
        success: false,
        message: 'Spot size must be between 1 and 10'
      });
    }
    
    const rtp = paytableService.calculateRTP(spotSizeNum);
    
    res.json({
      success: true,
      data: {
        spotSize: spotSizeNum,
        rtp: rtp
      }
    });
  } catch (error) {
    logger.error('Failed to get RTP', { error: error.message, spotSize: req.params.spotSize });
    
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to retrieve RTP'
    });
  }
});

/**
 * POST /api/v1/paytables/calculate
 * Calculate payout for given parameters
 */
router.post('/calculate', async (req, res) => {
  try {
    const { spotSize, matches, wager } = req.body;
    
    if (!spotSize || !matches || !wager) {
      return res.status(400).json({
        success: false,
        message: 'spotSize, matches, and wager are required'
      });
    }
    
    const spotSizeNum = parseInt(spotSize);
    const matchesNum = parseInt(matches);
    const wagerNum = parseFloat(wager);
    
    if (isNaN(spotSizeNum) || spotSizeNum < 1 || spotSizeNum > 10) {
      return res.status(400).json({
        success: false,
        message: 'Spot size must be between 1 and 10'
      });
    }
    
    if (isNaN(matchesNum) || matchesNum < 0 || matchesNum > spotSizeNum) {
      return res.status(400).json({
        success: false,
        message: 'Matches must be between 0 and spot size'
      });
    }
    
    if (isNaN(wagerNum) || wagerNum <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Wager must be a positive number'
      });
    }
    
    const payout = paytableService.calculatePayout(spotSizeNum, matchesNum, wagerNum);
    
    res.json({
      success: true,
      data: payout
    });
  } catch (error) {
    logger.error('Failed to calculate payout', { error: error.message, body: req.body });
    
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to calculate payout'
    });
  }
});

/**
 * GET /api/v1/paytables/:spotSize/probabilities
 * Get match probabilities for specific spot size
 */
router.get('/:spotSize/probabilities', async (req, res) => {
  try {
    const { spotSize } = req.params;
    const spotSizeNum = parseInt(spotSize);
    
    if (isNaN(spotSizeNum) || spotSizeNum < 1 || spotSizeNum > 10) {
      return res.status(400).json({
        success: false,
        message: 'Spot size must be between 1 and 10'
      });
    }
    
    const probabilities = {};
    for (let matches = 0; matches <= spotSizeNum; matches++) {
      probabilities[matches] = paytableService.calculateMatchProbability(
        spotSizeNum, 
        matches, 
        80, // pool size
        20  // draw size
      );
    }
    
    res.json({
      success: true,
      data: {
        spotSize: spotSizeNum,
        probabilities: probabilities
      }
    });
  } catch (error) {
    logger.error('Failed to get probabilities', { error: error.message, spotSize: req.params.spotSize });
    
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve probabilities'
    });
  }
});

module.exports = router;

const express = require('express');
const { body, validationResult } = require('express-validator');
const ticketService = require('../services/ticketService');
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

// Purchase ticket validation rules
const purchaseTicketValidation = [
  body('spots')
    .isArray({ min: 1, max: 10 })
    .withMessage('Spots must be an array with 1-10 numbers'),
  body('spots.*')
    .isInt({ min: 1, max: 80 })
    .withMessage('Each spot must be an integer between 1 and 80'),
  body('wager')
    .isFloat({ min: 0.25, max: 20.00 })
    .withMessage('Wager must be between $0.25 and $20.00'),
  body('spotSize')
    .isInt({ min: 1, max: 10 })
    .withMessage('Spot size must be between 1 and 10'),
  body('drawId')
    .optional()
    .isUUID()
    .withMessage('Draw ID must be a valid UUID')
];

/**
 * POST /api/v1/tickets
 * Purchase a new Keno ticket
 */
router.post('/', purchaseTicketValidation, validateRequest, async (req, res) => {
  try {
    const { spots, wager, spotSize, drawId } = req.body;
    const userId = req.user.id; // Assuming auth middleware sets req.user
    
    // Validate spot size matches number of spots
    if (spotSize !== spots.length) {
      return res.status(400).json({
        success: false,
        message: 'Spot size must match number of selected spots'
      });
    }
    
    // Check for duplicate spots
    if (new Set(spots).size !== spots.length) {
      return res.status(400).json({
        success: false,
        message: 'Duplicate spots are not allowed'
      });
    }
    
    const ticket = await ticketService.purchaseTicket(userId, {
      spots,
      wager,
      spotSize,
      drawId
    });
    
    res.status(201).json({
      success: true,
      message: 'Ticket purchased successfully',
      data: {
        ticketId: ticket.id,
        ticketNumber: ticket.ticket_number,
        spots: ticket.spots,
        wager: ticket.wager,
        spotSize: ticket.spot_size,
        status: ticket.status,
        purchaseTime: ticket.purchase_time
      }
    });
  } catch (error) {
    logger.error('Ticket purchase failed', { error: error.message, userId: req.user?.id });
    
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to purchase ticket'
    });
  }
});

/**
 * GET /api/v1/tickets
 * Get user's tickets with optional filtering
 */
router.get('/', async (req, res) => {
  try {
    const userId = req.user.id;
    const { status, limit = 50, offset = 0 } = req.query;
    
    const tickets = await ticketService.getUserTickets(userId, {
      status,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
    
    res.json({
      success: true,
      data: tickets.map(ticket => ({
        ticketId: ticket.id,
        ticketNumber: ticket.ticket_number,
        spots: ticket.spots,
        wager: ticket.wager,
        spotSize: ticket.spot_size,
        status: ticket.status,
        purchaseTime: ticket.purchase_time,
        drawTime: ticket.draw_time,
        drawNumbers: ticket.draw_numbers,
        drawStatus: ticket.draw_status,
        matches: ticket.matches,
        payout: ticket.payout,
        settlementTime: ticket.settled_at
      }))
    });
  } catch (error) {
    logger.error('Failed to get tickets', { error: error.message, userId: req.user?.id });
    
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve tickets'
    });
  }
});

/**
 * GET /api/v1/tickets/:ticketId
 * Get specific ticket details
 */
router.get('/:ticketId', async (req, res) => {
  try {
    const { ticketId } = req.params;
    const userId = req.user.id;
    
    const ticket = await ticketService.getTicketById(ticketId);
    
    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Ticket not found'
      });
    }
    
    // Check if user owns this ticket
    if (ticket.user_id !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }
    
    res.json({
      success: true,
      data: {
        ticketId: ticket.id,
        ticketNumber: ticket.ticket_number,
        spots: ticket.spots,
        wager: ticket.wager,
        spotSize: ticket.spot_size,
        status: ticket.status,
        purchaseTime: ticket.purchase_time,
        drawTime: ticket.draw_time,
        drawNumbers: ticket.draw_numbers,
        drawStatus: ticket.draw_status,
        matches: ticket.matches,
        payout: ticket.payout,
        settlementTime: ticket.settled_at
      }
    });
  } catch (error) {
    logger.error('Failed to get ticket', { error: error.message, ticketId: req.params.ticketId });
    
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve ticket'
    });
  }
});

/**
 * DELETE /api/v1/tickets/:ticketId
 * Cancel a ticket (if not yet drawn)
 */
router.delete('/:ticketId', async (req, res) => {
  try {
    const { ticketId } = req.params;
    const userId = req.user.id;
    
    const result = await ticketService.cancelTicket(ticketId, userId);
    
    res.json({
      success: true,
      message: 'Ticket cancelled successfully',
      data: {
        refundAmount: result.refund_amount
      }
    });
  } catch (error) {
    logger.error('Failed to cancel ticket', { error: error.message, ticketId: req.params.ticketId });
    
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to cancel ticket'
    });
  }
});

/**
 * GET /api/v1/tickets/stats
 * Get user's ticket statistics
 */
router.get('/stats', async (req, res) => {
  try {
    const userId = req.user.id;
    const stats = await ticketService.getUserTicketStats(userId);
    
    res.json({
      success: true,
      data: {
        totalTickets: parseInt(stats.total_tickets),
        totalWagered: parseFloat(stats.total_wagered),
        settledTickets: parseInt(stats.settled_tickets),
        settledWagered: parseFloat(stats.settled_wagered)
      }
    });
  } catch (error) {
    logger.error('Failed to get ticket stats', { error: error.message, userId: req.user?.id });
    
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve ticket statistics'
    });
  }
});

module.exports = router;

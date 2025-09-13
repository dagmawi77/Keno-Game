const { v4: uuidv4 } = require('uuid');
const cron = require('node-cron');
const database = require('../config/database');
const rngService = require('./rng');
const ticketService = require('./ticketService');
const { logger, auditLog } = require('../config/logger');

class DrawService {
  constructor() {
    this.isRunning = false;
    this.scheduledJobs = new Map();
    this.setupScheduler();
  }

  /**
   * Setup automatic draw scheduler
   */
  setupScheduler() {
    const schedule = process.env.DRAW_SCHEDULE || '*/5 * * * *'; // Every 5 minutes by default
    
    try {
      if (cron.validate(schedule)) {
        const job = cron.schedule(schedule, async () => {
          try {
            await this.runScheduledDraw();
          } catch (error) {
            logger.error('Scheduled draw failed', { error: error.message });
          }
        }, {
          scheduled: false
        });
        
        this.scheduledJobs.set('main', job);
        logger.info('Draw scheduler configured', { schedule });
      } else {
        logger.warn('Invalid draw schedule format', { schedule });
      }
    } catch (error) {
      logger.error('Failed to setup draw scheduler', { error: error.message });
    }
  }

  /**
   * Start automatic draws
   */
  startScheduler() {
    if (this.scheduledJobs.has('main')) {
      this.scheduledJobs.get('main').start();
      this.isRunning = true;
      logger.info('Draw scheduler started');
    }
  }

  /**
   * Stop automatic draws
   */
  stopScheduler() {
    if (this.scheduledJobs.has('main')) {
      this.scheduledJobs.get('main').stop();
      this.isRunning = false;
      logger.info('Draw scheduler stopped');
    }
  }

  /**
   * Run a scheduled draw
   */
  async runScheduledDraw() {
    try {
      const drawTime = new Date();
      const draw = await this.createDraw(drawTime);
      await this.completeDraw(draw.id);
      logger.info('Scheduled draw completed', { drawId: draw.id });
    } catch (error) {
      logger.error('Scheduled draw failed', { error: error.message });
    }
  }

  /**
   * Create a new draw
   */
  async createDraw(drawTime = new Date()) {
    try {
      // Get next draw number
      const drawNumber = await this.getNextDrawNumber();
      
      // Generate draw using RNG service
      const drawResult = rngService.generateDraw();
      
      const drawId = uuidv4();
      const result = await database.query(`
        INSERT INTO draws (id, draw_number, draw_time, numbers, server_seed_hash, client_seed, nonce, status)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `, [
        drawId,
        drawNumber,
        drawTime,
        drawResult.numbers,
        drawResult.serverSeedHash,
        drawResult.clientSeed,
        drawResult.nonce,
        'pending'
      ]);
      
      const draw = result.rows[0];
      
      auditLog('DRAW_CREATED', {
        drawId,
        drawNumber,
        drawTime,
        numbers: drawResult.numbers,
        serverSeedHash: drawResult.serverSeedHash
      });
      
      logger.info('Draw created', { drawId, drawNumber, numbers: drawResult.numbers });
      
      return draw;
    } catch (error) {
      logger.error('Failed to create draw', { error: error.message });
      throw error;
    }
  }

  /**
   * Complete a draw and settle all tickets
   */
  async completeDraw(drawId) {
    try {
      // Get draw details
      const drawResult = await database.query(`
        SELECT * FROM draws WHERE id = $1
      `, [drawId]);
      
      if (drawResult.rows.length === 0) {
        throw new Error('Draw not found');
      }
      
      const draw = drawResult.rows[0];
      
      if (draw.status !== 'pending') {
        throw new Error('Draw is not in pending status');
      }
      
      // Update draw status to completed
      await database.query(`
        UPDATE draws SET status = 'completed', completed_at = CURRENT_TIMESTAMP WHERE id = $1
      `, [drawId]);
      
      // Get all active tickets for this draw
      const ticketsResult = await database.query(`
        SELECT * FROM tickets WHERE draw_id = $1 AND status = 'active'
      `, [drawId]);
      
      const tickets = ticketsResult.rows;
      logger.info(`Settling ${tickets.length} tickets for draw ${drawId}`);
      
      // Settle each ticket
      for (const ticket of tickets) {
        try {
          await this.settleTicket(ticket, draw);
        } catch (error) {
          logger.error('Failed to settle ticket', { 
            ticketId: ticket.id, 
            drawId, 
            error: error.message 
          });
        }
      }
      
      auditLog('DRAW_COMPLETED', {
        drawId,
        ticketsSettled: tickets.length,
        numbers: draw.numbers
      });
      
      logger.info('Draw completed and tickets settled', { 
        drawId, 
        ticketsSettled: tickets.length 
      });
      
      return { drawId, ticketsSettled: tickets.length };
    } catch (error) {
      logger.error('Failed to complete draw', { drawId, error: error.message });
      throw error;
    }
  }

  /**
   * Settle a single ticket
   */
  async settleTicket(ticket, draw) {
    try {
      // Calculate matches
      const matches = this.calculateMatches(ticket.spots, draw.numbers);
      
      // Calculate payout
      const payoutResult = this.calculatePayout(ticket.spot_size, matches, ticket.wager);
      
      // Create settlement record
      const settlementId = uuidv4();
      await database.query(`
        INSERT INTO ticket_settlements (id, ticket_id, draw_id, matches, payout, settlement_reference)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [
        settlementId,
        ticket.id,
        draw.id,
        matches,
        payoutResult.payout,
        `SETTLE-${settlementId.slice(-8).toUpperCase()}`
      ]);
      
      // Update ticket status
      await database.query(`
        UPDATE tickets SET status = 'settled', settlement_time = CURRENT_TIMESTAMP WHERE id = $1
      `, [ticket.id]);
      
      // Credit winnings to wallet if any
      if (payoutResult.payout > 0) {
        await this.creditWinnings(ticket.user_id, payoutResult.payout, ticket.id);
      }
      
      auditLog('TICKET_SETTLED', {
        ticketId: ticket.id,
        drawId: draw.id,
        matches,
        payout: payoutResult.payout,
        spots: ticket.spots,
        drawNumbers: draw.numbers
      });
      
      logger.info('Ticket settled', { 
        ticketId: ticket.id, 
        matches, 
        payout: payoutResult.payout 
      });
      
      return { matches, payout: payoutResult.payout };
    } catch (error) {
      logger.error('Failed to settle ticket', { 
        ticketId: ticket.id, 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Calculate number of matches between ticket spots and drawn numbers
   */
  calculateMatches(ticketSpots, drawNumbers) {
    const spotSet = new Set(ticketSpots);
    const drawSet = new Set(drawNumbers);
    
    let matches = 0;
    for (const spot of spotSet) {
      if (drawSet.has(spot)) {
        matches++;
      }
    }
    
    return matches;
  }

  /**
   * Calculate payout for a ticket
   */
  calculatePayout(spotSize, matches, wager) {
    const paytableService = require('../models/paytable');
    return paytableService.calculatePayout(spotSize, matches, wager);
  }

  /**
   * Credit winnings to user wallet
   */
  async creditWinnings(userId, amount, ticketId) {
    try {
      const wallet = await ticketService.getUserWallet(userId);
      const newBalance = parseFloat(wallet.balance) + amount;
      
      await database.query(`
        UPDATE user_wallets SET balance = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2
      `, [newBalance, wallet.id]);
      
      // Record payout transaction
      await database.query(`
        INSERT INTO wallet_transactions (wallet_id, transaction_type, amount, balance_before, balance_after, reference_id)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [wallet.id, 'payout', amount, wallet.balance, newBalance, ticketId]);
      
      logger.info('Winnings credited', { userId, amount, ticketId });
    } catch (error) {
      logger.error('Failed to credit winnings', { userId, amount, error: error.message });
      throw error;
    }
  }

  /**
   * Get next draw number
   */
  async getNextDrawNumber() {
    const result = await database.query(`
      SELECT COALESCE(MAX(draw_number), 0) + 1 as next_number FROM draws
    `);
    
    return parseInt(result.rows[0].next_number);
  }

  /**
   * Get draw by ID
   */
  async getDrawById(drawId) {
    const result = await database.query(`
      SELECT * FROM draws WHERE id = $1
    `, [drawId]);
    
    return result.rows[0] || null;
  }

  /**
   * Get recent draws
   */
  async getRecentDraws(limit = 10) {
    const result = await database.query(`
      SELECT * FROM draws 
      ORDER BY draw_time DESC 
      LIMIT $1
    `, [limit]);
    
    return result.rows;
  }

  /**
   * Get upcoming draws
   */
  async getUpcomingDraws() {
    const result = await database.query(`
      SELECT * FROM draws 
      WHERE status = 'pending' 
      ORDER BY draw_time ASC
    `);
    
    return result.rows;
  }

  /**
   * Verify draw integrity
   */
  async verifyDraw(drawId) {
    try {
      const draw = await this.getDrawById(drawId);
      if (!draw) {
        throw new Error('Draw not found');
      }
      
      const isValid = rngService.verifyDraw({
        serverSeedHash: draw.server_seed_hash,
        clientSeed: draw.client_seed,
        nonce: draw.nonce,
        numbers: draw.numbers,
        poolSize: 80,
        drawSize: 20
      });
      
      return { drawId, isValid };
    } catch (error) {
      logger.error('Draw verification failed', { drawId, error: error.message });
      return { drawId, isValid: false, error: error.message };
    }
  }

  /**
   * Get draw statistics
   */
  async getDrawStats() {
    const result = await database.query(`
      SELECT 
        COUNT(*) as total_draws,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_draws,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_draws,
        AVG(CASE WHEN status = 'completed' THEN 
          (SELECT COUNT(*) FROM tickets WHERE draw_id = draws.id AND status = 'settled')
        END) as avg_tickets_per_draw
      FROM draws
    `);
    
    return result.rows[0];
  }
}

module.exports = new DrawService();

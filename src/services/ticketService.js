const { v4: uuidv4 } = require('uuid');
const database = require('../config/database');
const paytableService = require('../models/paytable');
const { logger, auditLog } = require('../config/logger');

class TicketService {
  constructor() {
    this.minWager = parseFloat(process.env.MIN_WAGER) || 0.25;
    this.maxWager = parseFloat(process.env.MAX_WAGER) || 20.00;
    this.minSpots = parseInt(process.env.MIN_SPOTS) || 1;
    this.maxSpots = parseInt(process.env.MAX_SPOTS) || 10;
  }

  /**
   * Purchase a Keno ticket
   */
  async purchaseTicket(userId, ticketData) {
    const { spots, wager, spotSize, drawId } = ticketData;
    
    try {
      // Validate ticket data
      this.validateTicketData(spots, wager, spotSize);
      
      // Check if user has sufficient balance
      const wallet = await this.getUserWallet(userId);
      if (wallet.balance < wager) {
        throw new Error('Insufficient balance');
      }
      
      // Generate ticket number
      const ticketNumber = this.generateTicketNumber();
      
      // Create ticket record
      const ticketId = uuidv4();
      const result = await database.query(`
        INSERT INTO tickets (id, user_id, draw_id, ticket_number, spots, spot_size, wager, total_cost, status)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
      `, [
        ticketId,
        userId,
        drawId,
        ticketNumber,
        spots,
        spotSize,
        wager,
        wager, // total_cost = wager for single draw
        'active'
      ]);
      
      const ticket = result.rows[0];
      
      // Reserve funds in wallet
      await this.reserveFunds(wallet.id, wager, ticketId, 'wager');
      
      // Log audit trail
      auditLog('TICKET_PURCHASED', {
        ticketId,
        userId,
        spots,
        wager,
        spotSize,
        drawId,
        ticketNumber
      });
      
      logger.info('Ticket purchased successfully', { ticketId, userId, wager });
      
      return ticket;
    } catch (error) {
      logger.error('Ticket purchase failed', { error: error.message, userId, ticketData });
      throw error;
    }
  }

  /**
   * Validate ticket data
   */
  validateTicketData(spots, wager, spotSize) {
    if (!Array.isArray(spots) || spots.length === 0) {
      throw new Error('Spots must be a non-empty array');
    }
    
    if (spots.length < this.minSpots || spots.length > this.maxSpots) {
      throw new Error(`Number of spots must be between ${this.minSpots} and ${this.maxSpots}`);
    }
    
    if (spotSize !== spots.length) {
      throw new Error('Spot size must match number of selected spots');
    }
    
    // Validate spot numbers
    for (const spot of spots) {
      if (!Number.isInteger(spot) || spot < 1 || spot > 80) {
        throw new Error('All spots must be integers between 1 and 80');
      }
    }
    
    // Check for duplicates
    if (new Set(spots).size !== spots.length) {
      throw new Error('Duplicate spots are not allowed');
    }
    
    if (wager < this.minWager || wager > this.maxWager) {
      throw new Error(`Wager must be between $${this.minWager} and $${this.maxWager}`);
    }
  }

  /**
   * Generate unique ticket number
   */
  generateTicketNumber() {
    const timestamp = Date.now().toString().slice(-8);
    const random = Math.random().toString(36).substr(2, 4).toUpperCase();
    return `K${timestamp}${random}`;
  }

  /**
   * Get user's wallet
   */
  async getUserWallet(userId) {
    const result = await database.query(`
      SELECT * FROM user_wallets WHERE user_id = $1
    `, [userId]);
    
    if (result.rows.length === 0) {
      // Create wallet if it doesn't exist
      const walletId = uuidv4();
      await database.query(`
        INSERT INTO user_wallets (id, user_id, balance) VALUES ($1, $2, $3)
      `, [walletId, userId, 0.00]);
      
      return { id: walletId, user_id: userId, balance: 0.00 };
    }
    
    return result.rows[0];
  }

  /**
   * Reserve funds for a ticket
   */
  async reserveFunds(walletId, amount, referenceId, transactionType) {
    return await database.transaction(async (client) => {
      // Get current balance
      const walletResult = await client.query(`
        SELECT balance FROM user_wallets WHERE id = $1 FOR UPDATE
      `, [walletId]);
      
      if (walletResult.rows.length === 0) {
        throw new Error('Wallet not found');
      }
      
      const currentBalance = parseFloat(walletResult.rows[0].balance);
      const newBalance = currentBalance - amount;
      
      if (newBalance < 0) {
        throw new Error('Insufficient balance');
      }
      
      // Update wallet balance
      await client.query(`
        UPDATE user_wallets SET balance = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2
      `, [newBalance, walletId]);
      
      // Record transaction
      await client.query(`
        INSERT INTO wallet_transactions (wallet_id, transaction_type, amount, balance_before, balance_after, reference_id)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [walletId, transactionType, -amount, currentBalance, newBalance, referenceId]);
      
      return { balance_before: currentBalance, balance_after: newBalance };
    });
  }

  /**
   * Get user's tickets
   */
  async getUserTickets(userId, options = {}) {
    const { status, limit = 50, offset = 0 } = options;
    
    let query = `
      SELECT t.*, d.draw_time, d.numbers as draw_numbers, d.status as draw_status
      FROM tickets t
      LEFT JOIN draws d ON t.draw_id = d.id
      WHERE t.user_id = $1
    `;
    
    const params = [userId];
    let paramCount = 1;
    
    if (status) {
      paramCount++;
      query += ` AND t.status = $${paramCount}`;
      params.push(status);
    }
    
    query += ` ORDER BY t.created_at DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
    params.push(limit, offset);
    
    const result = await database.query(query, params);
    return result.rows;
  }

  /**
   * Get ticket by ID
   */
  async getTicketById(ticketId) {
    const result = await database.query(`
      SELECT t.*, d.draw_time, d.numbers as draw_numbers, d.status as draw_status,
             ts.matches, ts.payout, ts.settled_at
      FROM tickets t
      LEFT JOIN draws d ON t.draw_id = d.id
      LEFT JOIN ticket_settlements ts ON t.id = ts.ticket_id
      WHERE t.id = $1
    `, [ticketId]);
    
    return result.rows[0] || null;
  }

  /**
   * Cancel a ticket (if not yet drawn)
   */
  async cancelTicket(ticketId, userId) {
    return await database.transaction(async (client) => {
      // Get ticket
      const ticketResult = await client.query(`
        SELECT * FROM tickets WHERE id = $1 AND user_id = $2
      `, [ticketId, userId]);
      
      if (ticketResult.rows.length === 0) {
        throw new Error('Ticket not found');
      }
      
      const ticket = ticketResult.rows[0];
      
      if (ticket.status !== 'active') {
        throw new Error('Ticket cannot be cancelled');
      }
      
      // Check if draw has already occurred
      if (ticket.draw_id) {
        const drawResult = await client.query(`
          SELECT status FROM draws WHERE id = $1
        `, [ticket.draw_id]);
        
        if (drawResult.rows.length > 0 && drawResult.rows[0].status === 'completed') {
          throw new Error('Cannot cancel ticket after draw has completed');
        }
      }
      
      // Refund funds
      await this.refundTicket(client, ticket);
      
      // Update ticket status
      await client.query(`
        UPDATE tickets SET status = 'cancelled' WHERE id = $1
      `, [ticketId]);
      
      auditLog('TICKET_CANCELLED', { ticketId, userId, refund_amount: ticket.wager });
      
      logger.info('Ticket cancelled', { ticketId, userId });
      
      return { success: true, refund_amount: ticket.wager };
    });
  }

  /**
   * Refund ticket funds
   */
  async refundTicket(client, ticket) {
    const wallet = await this.getUserWallet(ticket.user_id);
    
    // Add funds back to wallet
    const newBalance = parseFloat(wallet.balance) + parseFloat(ticket.wager);
    
    await client.query(`
      UPDATE user_wallets SET balance = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2
    `, [newBalance, wallet.id]);
    
    // Record refund transaction
    await client.query(`
      INSERT INTO wallet_transactions (wallet_id, transaction_type, amount, balance_before, balance_after, reference_id)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [wallet.id, 'refund', ticket.wager, wallet.balance, newBalance, ticket.id]);
  }

  /**
   * Get ticket statistics for a user
   */
  async getUserTicketStats(userId) {
    const result = await database.query(`
      SELECT 
        COUNT(*) as total_tickets,
        SUM(wager) as total_wagered,
        COUNT(CASE WHEN status = 'settled' THEN 1 END) as settled_tickets,
        SUM(CASE WHEN status = 'settled' THEN wager ELSE 0 END) as settled_wagered
      FROM tickets 
      WHERE user_id = $1
    `, [userId]);
    
    return result.rows[0];
  }
}

module.exports = new TicketService();

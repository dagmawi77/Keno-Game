const { logger } = require('../config/logger');
const database = require('../config/database');

/**
 * Monitoring and Alerting Service for Keno Game
 */

class MonitoringService {
  constructor() {
    this.metrics = {
      requests: 0,
      errors: 0,
      ticketsPurchased: 0,
      drawsCompleted: 0,
      totalWagered: 0,
      totalPayouts: 0,
      activeUsers: 0,
      responseTime: []
    };
    
    this.alerts = [];
    this.alertThresholds = {
      errorRate: 0.05, // 5% error rate
      responseTime: 2000, // 2 seconds
      memoryUsage: 0.9, // 90% memory usage
      cpuUsage: 0.8, // 80% CPU usage
      failedDraws: 1, // Any failed draws
      suspiciousActivity: 1 // Any suspicious activity
    };
    
    this.startMonitoring();
  }

  /**
   * Start monitoring services
   */
  startMonitoring() {
    // Monitor system metrics every 30 seconds
    setInterval(() => {
      this.collectSystemMetrics();
    }, 30000);

    // Check for alerts every minute
    setInterval(() => {
      this.checkAlerts();
    }, 60000);

    // Generate daily reports
    setInterval(() => {
      this.generateDailyReport();
    }, 24 * 60 * 60 * 1000);

    logger.info('Monitoring service started');
  }

  /**
   * Record API request
   */
  recordRequest(responseTime, success = true) {
    this.metrics.requests++;
    this.metrics.responseTime.push(responseTime);
    
    if (!success) {
      this.metrics.errors++;
    }

    // Keep only last 1000 response times
    if (this.metrics.responseTime.length > 1000) {
      this.metrics.responseTime = this.metrics.responseTime.slice(-1000);
    }
  }

  /**
   * Record ticket purchase
   */
  recordTicketPurchase(wager) {
    this.metrics.ticketsPurchased++;
    this.metrics.totalWagered += wager;
  }

  /**
   * Record draw completion
   */
  recordDrawCompletion() {
    this.metrics.drawsCompleted++;
  }

  /**
   * Record payout
   */
  recordPayout(amount) {
    this.metrics.totalPayouts += amount;
  }

  /**
   * Record suspicious activity
   */
  recordSuspiciousActivity(activity, details) {
    this.alerts.push({
      type: 'suspicious_activity',
      timestamp: new Date(),
      activity,
      details
    });

    logger.warn('Suspicious activity detected', { activity, details });
  }

  /**
   * Collect system metrics
   */
  async collectSystemMetrics() {
    try {
      const memUsage = process.memoryUsage();
      const cpuUsage = process.cpuUsage();
      
      const systemMetrics = {
        memory: {
          rss: memUsage.rss,
          heapTotal: memUsage.heapTotal,
          heapUsed: memUsage.heapUsed,
          external: memUsage.external,
          usage: memUsage.heapUsed / memUsage.heapTotal
        },
        cpu: {
          user: cpuUsage.user,
          system: cpuUsage.system
        },
        uptime: process.uptime(),
        timestamp: new Date()
      };

      // Check memory usage
      if (systemMetrics.memory.usage > this.alertThresholds.memoryUsage) {
        this.createAlert('high_memory_usage', {
          usage: systemMetrics.memory.usage,
          threshold: this.alertThresholds.memoryUsage
        });
      }

      // Store metrics in database for historical analysis
      await this.storeMetrics(systemMetrics);

    } catch (error) {
      logger.error('Failed to collect system metrics', { error: error.message });
    }
  }

  /**
   * Store metrics in database
   */
  async storeMetrics(metrics) {
    try {
      await database.query(`
        INSERT INTO system_metrics (memory_usage, cpu_usage, uptime, timestamp)
        VALUES ($1, $2, $3, $4)
      `, [
        metrics.memory.usage,
        metrics.cpu.user,
        metrics.uptime,
        metrics.timestamp
      ]);
    } catch (error) {
      logger.error('Failed to store metrics', { error: error.message });
    }
  }

  /**
   * Check for alerts
   */
  async checkAlerts() {
    try {
      // Check error rate
      const errorRate = this.metrics.errors / this.metrics.requests;
      if (errorRate > this.alertThresholds.errorRate) {
        this.createAlert('high_error_rate', {
          errorRate,
          threshold: this.alertThresholds.errorRate
        });
      }

      // Check average response time
      if (this.metrics.responseTime.length > 0) {
        const avgResponseTime = this.metrics.responseTime.reduce((a, b) => a + b, 0) / this.metrics.responseTime.length;
        if (avgResponseTime > this.alertThresholds.responseTime) {
          this.createAlert('high_response_time', {
            avgResponseTime,
            threshold: this.alertThresholds.responseTime
          });
        }
      }

      // Check for failed draws
      await this.checkDrawHealth();

      // Check for suspicious patterns
      await this.checkSuspiciousPatterns();

    } catch (error) {
      logger.error('Failed to check alerts', { error: error.message });
    }
  }

  /**
   * Check draw health
   */
  async checkDrawHealth() {
    try {
      // Check for draws that should have completed but haven't
      const result = await database.query(`
        SELECT COUNT(*) as pending_draws
        FROM draws 
        WHERE status = 'pending' 
        AND draw_time < NOW() - INTERVAL '10 minutes'
      `);

      const pendingDraws = parseInt(result.rows[0].pending_draws);
      if (pendingDraws > 0) {
        this.createAlert('stuck_draws', {
          count: pendingDraws,
          message: `${pendingDraws} draws are stuck in pending status`
        });
      }

    } catch (error) {
      logger.error('Failed to check draw health', { error: error.message });
    }
  }

  /**
   * Check for suspicious patterns
   */
  async checkSuspiciousPatterns() {
    try {
      // Check for unusual ticket purchase patterns
      const result = await database.query(`
        SELECT user_id, COUNT(*) as ticket_count, SUM(wager) as total_wagered
        FROM tickets 
        WHERE created_at > NOW() - INTERVAL '1 hour'
        GROUP BY user_id
        HAVING COUNT(*) > 50 OR SUM(wager) > 1000
      `);

      for (const row of result.rows) {
        this.createAlert('suspicious_ticket_activity', {
          userId: row.user_id,
          ticketCount: row.ticket_count,
          totalWagered: row.total_wagered,
          message: `User ${row.user_id} purchased ${row.ticket_count} tickets worth $${row.total_wagered} in the last hour`
        });
      }

      // Check for unusual payout patterns
      const payoutResult = await database.query(`
        SELECT user_id, COUNT(*) as payout_count, SUM(payout) as total_payouts
        FROM ticket_settlements ts
        JOIN tickets t ON ts.ticket_id = t.id
        WHERE ts.settled_at > NOW() - INTERVAL '1 hour'
        GROUP BY user_id
        HAVING SUM(payout) > 5000
      `);

      for (const row of payoutResult.rows) {
        this.createAlert('suspicious_payout_activity', {
          userId: row.user_id,
          payoutCount: row.payout_count,
          totalPayouts: row.total_payouts,
          message: `User ${row.user_id} received $${row.total_payouts} in payouts in the last hour`
        });
      }

    } catch (error) {
      logger.error('Failed to check suspicious patterns', { error: error.message });
    }
  }

  /**
   * Create an alert
   */
  createAlert(type, details) {
    const alert = {
      type,
      timestamp: new Date(),
      details,
      resolved: false
    };

    this.alerts.push(alert);
    
    // Log alert
    logger.warn('Alert created', alert);

    // In production, send to alerting system (PagerDuty, Slack, etc.)
    this.sendAlert(alert);
  }

  /**
   * Send alert to external systems
   */
  sendAlert(alert) {
    // In production, integrate with alerting services
    console.log(`🚨 ALERT: ${alert.type}`, alert.details);
  }

  /**
   * Generate daily report
   */
  async generateDailyReport() {
    try {
      const report = {
        date: new Date().toISOString().split('T')[0],
        metrics: {
          totalRequests: this.metrics.requests,
          totalErrors: this.metrics.errors,
          errorRate: this.metrics.errors / this.metrics.requests,
          avgResponseTime: this.metrics.responseTime.length > 0 ? 
            this.metrics.responseTime.reduce((a, b) => a + b, 0) / this.metrics.responseTime.length : 0,
          ticketsPurchased: this.metrics.ticketsPurchased,
          drawsCompleted: this.metrics.drawsCompleted,
          totalWagered: this.metrics.totalWagered,
          totalPayouts: this.metrics.totalPayouts,
          netRevenue: this.metrics.totalWagered - this.metrics.totalPayouts
        },
        alerts: this.alerts.filter(alert => 
          alert.timestamp > new Date(Date.now() - 24 * 60 * 60 * 1000)
        )
      };

      // Store report in database
      await this.storeDailyReport(report);

      // Reset daily metrics
      this.resetDailyMetrics();

      logger.info('Daily report generated', report);

    } catch (error) {
      logger.error('Failed to generate daily report', { error: error.message });
    }
  }

  /**
   * Store daily report
   */
  async storeDailyReport(report) {
    try {
      await database.query(`
        INSERT INTO daily_reports (report_date, metrics, alerts, created_at)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (report_date) DO UPDATE SET
        metrics = $2, alerts = $3, updated_at = CURRENT_TIMESTAMP
      `, [
        report.date,
        JSON.stringify(report.metrics),
        JSON.stringify(report.alerts),
        new Date()
      ]);
    } catch (error) {
      logger.error('Failed to store daily report', { error: error.message });
    }
  }

  /**
   * Reset daily metrics
   */
  resetDailyMetrics() {
    this.metrics = {
      requests: 0,
      errors: 0,
      ticketsPurchased: 0,
      drawsCompleted: 0,
      totalWagered: 0,
      totalPayouts: 0,
      activeUsers: 0,
      responseTime: []
    };
  }

  /**
   * Get current metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      avgResponseTime: this.metrics.responseTime.length > 0 ? 
        this.metrics.responseTime.reduce((a, b) => a + b, 0) / this.metrics.responseTime.length : 0,
      errorRate: this.metrics.requests > 0 ? this.metrics.errors / this.metrics.requests : 0
    };
  }

  /**
   * Get active alerts
   */
  getActiveAlerts() {
    return this.alerts.filter(alert => !alert.resolved);
  }

  /**
   * Resolve alert
   */
  resolveAlert(alertId) {
    const alert = this.alerts.find(a => a.timestamp.getTime() === alertId);
    if (alert) {
      alert.resolved = true;
      logger.info('Alert resolved', { alertId, type: alert.type });
    }
  }
}

module.exports = new MonitoringService();

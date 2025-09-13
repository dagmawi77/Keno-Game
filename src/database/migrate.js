const fs = require('fs');
const path = require('path');
const database = require('../config/database');
const { logger } = require('../config/logger');

class DatabaseMigrator {
  constructor() {
    this.migrationsPath = path.join(__dirname, 'migrations');
  }

  async runMigrations() {
    try {
      logger.info('Starting database migrations...');
      
      // Get all migration files
      const migrationFiles = fs.readdirSync(this.migrationsPath)
        .filter(file => file.endsWith('.sql'))
        .sort();
      
      logger.info(`Found ${migrationFiles.length} migration files`);
      
      for (const file of migrationFiles) {
        await this.runMigration(file);
      }
      
      logger.info('All migrations completed successfully');
    } catch (error) {
      logger.error('Migration failed', { error: error.message });
      throw error;
    }
  }

  async runMigration(filename) {
    const filePath = path.join(this.migrationsPath, filename);
    const sql = fs.readFileSync(filePath, 'utf8');
    
    try {
      logger.info(`Running migration: ${filename}`);
      await database.query(sql);
      logger.info(`Migration completed: ${filename}`);
    } catch (error) {
      logger.error(`Migration failed: ${filename}`, { error: error.message });
      throw error;
    }
  }

  async createInitialData() {
    try {
      logger.info('Creating initial data...');
      
      // Insert default paytables
      await this.insertDefaultPaytables();
      
      // Create admin user
      await this.createAdminUser();
      
      logger.info('Initial data created successfully');
    } catch (error) {
      logger.error('Failed to create initial data', { error: error.message });
      throw error;
    }
  }

  async insertDefaultPaytables() {
    const paytableService = require('../models/paytable');
    const paytables = paytableService.getAllPaytables();
    
    for (const [spotSize, paytable] of Object.entries(paytables)) {
      const rtp = paytableService.calculateRTP(parseInt(spotSize));
      
      await database.query(`
        INSERT INTO paytables (version, spot_size, payouts, wager_base, rtp_percentage, is_active)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [
        '1.0',
        parseInt(spotSize),
        JSON.stringify(paytable.payouts),
        paytable.wager,
        rtp,
        true
      ]);
    }
    
    logger.info('Default paytables inserted');
  }

  async createAdminUser() {
    const bcrypt = require('bcryptjs');
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
    const hashedPassword = await bcrypt.hash(adminPassword, 12);
    
    try {
      await database.query(`
        INSERT INTO users (username, email, password_hash, first_name, last_name, kyc_status, account_status)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (email) DO NOTHING
      `, [
        'admin',
        'admin@kenogame.com',
        hashedPassword,
        'Admin',
        'User',
        'verified',
        'active'
      ]);
      
      // Create wallet for admin user
      const result = await database.query(`
        SELECT id FROM users WHERE email = $1
      `, ['admin@kenogame.com']);
      
      if (result.rows.length > 0) {
        const userId = result.rows[0].id;
        
        await database.query(`
          INSERT INTO user_wallets (user_id, balance)
          VALUES ($1, $2)
          ON CONFLICT DO NOTHING
        `, [userId, 10000.00]); // $10,000 starting balance for admin
      }
      
      logger.info('Admin user created');
    } catch (error) {
      logger.warn('Admin user may already exist', { error: error.message });
    }
  }

  async checkDatabaseConnection() {
    try {
      await database.query('SELECT 1');
      logger.info('Database connection successful');
      return true;
    } catch (error) {
      logger.error('Database connection failed', { error: error.message });
      return false;
    }
  }
}

// Run migrations if called directly
if (require.main === module) {
  const migrator = new DatabaseMigrator();
  
  migrator.checkDatabaseConnection()
    .then(connected => {
      if (connected) {
        return migrator.runMigrations();
      } else {
        throw new Error('Database connection failed');
      }
    })
    .then(() => migrator.createInitialData())
    .then(() => {
      logger.info('Database setup completed');
      process.exit(0);
    })
    .catch(error => {
      logger.error('Database setup failed', { error: error.message });
      process.exit(1);
    });
}

module.exports = DatabaseMigrator;

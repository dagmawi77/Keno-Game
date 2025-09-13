-- Keno Game Database Schema
-- Production-ready with audit trails and compliance features

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    date_of_birth DATE,
    phone VARCHAR(20),
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(50),
    zip_code VARCHAR(20),
    country VARCHAR(50) DEFAULT 'US',
    kyc_status VARCHAR(20) DEFAULT 'pending', -- pending, verified, rejected
    kyc_verified_at TIMESTAMP,
    account_status VARCHAR(20) DEFAULT 'active', -- active, suspended, closed
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP
);

-- User wallets
CREATE TABLE user_wallets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    balance DECIMAL(15,2) DEFAULT 0.00,
    currency VARCHAR(3) DEFAULT 'USD',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Wallet transactions
CREATE TABLE wallet_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    wallet_id UUID NOT NULL REFERENCES user_wallets(id) ON DELETE CASCADE,
    transaction_type VARCHAR(20) NOT NULL, -- deposit, withdrawal, wager, payout, refund
    amount DECIMAL(15,2) NOT NULL,
    balance_before DECIMAL(15,2) NOT NULL,
    balance_after DECIMAL(15,2) NOT NULL,
    description TEXT,
    reference_id UUID, -- Reference to ticket, draw, or external transaction
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Draws table
CREATE TABLE draws (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    draw_number BIGINT UNIQUE NOT NULL,
    draw_time TIMESTAMP NOT NULL,
    numbers INTEGER[] NOT NULL, -- Array of 20 drawn numbers
    server_seed_hash VARCHAR(64) NOT NULL,
    client_seed VARCHAR(64),
    nonce BIGINT,
    status VARCHAR(20) DEFAULT 'pending', -- pending, completed, cancelled
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP
);

-- Tickets table
CREATE TABLE tickets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    draw_id UUID REFERENCES draws(id),
    ticket_number VARCHAR(20) UNIQUE NOT NULL,
    spots INTEGER[] NOT NULL, -- Array of selected numbers
    spot_size INTEGER NOT NULL CHECK (spot_size >= 1 AND spot_size <= 10),
    wager DECIMAL(10,2) NOT NULL CHECK (wager > 0),
    total_cost DECIMAL(10,2) NOT NULL,
    status VARCHAR(20) DEFAULT 'active', -- active, settled, cancelled, refunded
    purchase_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    settlement_time TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Ticket settlements
CREATE TABLE ticket_settlements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    draw_id UUID NOT NULL REFERENCES draws(id),
    matches INTEGER NOT NULL,
    payout DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    settled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    settlement_reference VARCHAR(100)
);

-- Paytables (for historical tracking and updates)
CREATE TABLE paytables (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    version VARCHAR(20) NOT NULL,
    spot_size INTEGER NOT NULL,
    payouts JSONB NOT NULL, -- JSON object with match count -> payout mapping
    wager_base DECIMAL(10,2) NOT NULL DEFAULT 1.00,
    rtp_percentage DECIMAL(5,2),
    is_active BOOLEAN DEFAULT true,
    effective_from TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    effective_to TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Audit logs for compliance
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    action VARCHAR(50) NOT NULL,
    entity_type VARCHAR(50), -- user, ticket, draw, settlement
    entity_id UUID,
    user_id UUID REFERENCES users(id),
    ip_address INET,
    user_agent TEXT,
    old_values JSONB,
    new_values JSONB,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Game sessions (for responsible gaming)
CREATE TABLE game_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_start TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    session_end TIMESTAMP,
    total_wagered DECIMAL(15,2) DEFAULT 0.00,
    total_won DECIMAL(15,2) DEFAULT 0.00,
    net_result DECIMAL(15,2) DEFAULT 0.00,
    tickets_played INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true
);

-- Responsible gaming settings
CREATE TABLE responsible_gaming_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    daily_deposit_limit DECIMAL(15,2),
    daily_wager_limit DECIMAL(15,2),
    daily_loss_limit DECIMAL(15,2),
    session_time_limit INTEGER, -- in minutes
    self_exclusion_until TIMESTAMP,
    reality_check_interval INTEGER, -- in minutes
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_kyc_status ON users(kyc_status);
CREATE INDEX idx_tickets_user_id ON tickets(user_id);
CREATE INDEX idx_tickets_draw_id ON tickets(draw_id);
CREATE INDEX idx_tickets_status ON tickets(status);
CREATE INDEX idx_tickets_purchase_time ON tickets(purchase_time);
CREATE INDEX idx_draws_draw_time ON draws(draw_time);
CREATE INDEX idx_draws_status ON draws(status);
CREATE INDEX idx_wallet_transactions_wallet_id ON wallet_transactions(wallet_id);
CREATE INDEX idx_wallet_transactions_type ON wallet_transactions(transaction_type);
CREATE INDEX idx_wallet_transactions_created_at ON wallet_transactions(created_at);
CREATE INDEX idx_ticket_settlements_ticket_id ON ticket_settlements(ticket_id);
CREATE INDEX idx_ticket_settlements_draw_id ON ticket_settlements(draw_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_entity_type ON audit_logs(entity_type);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX idx_game_sessions_user_id ON game_sessions(user_id);
CREATE INDEX idx_game_sessions_active ON game_sessions(is_active);

-- Triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_wallets_updated_at BEFORE UPDATE ON user_wallets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_responsible_gaming_settings_updated_at BEFORE UPDATE ON responsible_gaming_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

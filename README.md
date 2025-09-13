# Keno Game - Production-Ready Digital Lottery

A comprehensive, production-ready Keno lottery game built with Node.js, featuring provably fair RNG, secure architecture, and full compliance features.

## 🎯 Features

### Core Game Features
- **Classic Keno Gameplay**: Select 1-10 numbers from 1-80
- **Multiple Draw Schedules**: Configurable draw intervals (default: every 5 minutes)
- **Provably Fair RNG**: Cryptographically secure random number generation
- **Real-time Results**: Live draw display with instant ticket settlement
- **Responsive UI**: Modern, mobile-friendly interface

### Security & Compliance
- **Cryptographically Secure RNG**: Uses OS CSPRNG with provably fair verification
- **Audit Logging**: Complete audit trail for regulatory compliance
- **Anti-cheat Protection**: Pattern detection and suspicious activity monitoring
- **Rate Limiting**: Multi-tier rate limiting for API protection
- **Input Validation**: Comprehensive request validation and sanitization

### Technical Features
- **Scalable Architecture**: Microservices-based design
- **Database ACID Compliance**: PostgreSQL with transaction integrity
- **Caching Layer**: Redis for performance optimization
- **Monitoring & Alerting**: Prometheus + Grafana integration
- **Docker Ready**: Complete containerization with docker-compose
- **Statistical Testing**: RNG certification-ready test suite

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL 13+
- Redis 6+
- Docker & Docker Compose (optional)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd keno-game
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment setup**
   ```bash
   cp env.example .env
   # Edit .env with your configuration
   ```

4. **Database setup**
   ```bash
   # Start PostgreSQL and Redis
   # Update .env with your database credentials
   
   # Run migrations
   npm run migrate
   ```

5. **Start the application**
   ```bash
   # Development
   npm run dev
   
   # Production
   npm start
   ```

### Docker Deployment

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f keno-app

# Stop services
docker-compose down
```

## 🏗️ Architecture

### Backend Services
- **API Gateway**: Express.js with security middleware
- **Game Service**: Ticket management and game logic
- **RNG Service**: Cryptographically secure random number generation
- **Settlement Service**: Payout calculation and wallet management
- **Monitoring Service**: Metrics collection and alerting

### Database Schema
- **Users**: Player accounts and authentication
- **Tickets**: Game tickets and selections
- **Draws**: Draw results and RNG data
- **Settlements**: Payout records
- **Audit Logs**: Compliance and security logging

### Frontend
- **Responsive Design**: Mobile-first approach
- **Real-time Updates**: Live draw results
- **Ticket Management**: Purchase and view tickets
- **Provably Fair Verification**: Draw verification tools

## 🔒 Security Features

### RNG Security
- **OS CSPRNG**: Uses system cryptographically secure random number generator
- **Provably Fair**: Server seed hashing with client verification
- **Statistical Testing**: Comprehensive test suite for certification
- **Seed Rotation**: Regular server seed rotation

### Application Security
- **Rate Limiting**: Multi-tier protection against abuse
- **Input Validation**: Comprehensive request sanitization
- **Anti-cheat Detection**: Pattern analysis and suspicious activity monitoring
- **Audit Logging**: Complete transaction and security audit trail
- **HTTPS Enforcement**: SSL/TLS with security headers

### Compliance Features
- **Audit Trail**: Immutable logs for regulatory compliance
- **Responsible Gaming**: Built-in limits and monitoring
- **Data Retention**: Configurable retention policies
- **KYC Integration**: Identity verification framework

## 📊 Monitoring & Observability

### Metrics Collection
- **Application Metrics**: Request rates, response times, error rates
- **Business Metrics**: Tickets sold, payouts, revenue
- **System Metrics**: Memory, CPU, database performance
- **Security Metrics**: Failed logins, suspicious activity

### Alerting
- **High Error Rates**: Automatic alerting for system issues
- **Suspicious Activity**: Real-time fraud detection
- **System Health**: Resource usage and performance alerts
- **Draw Failures**: Immediate notification of draw issues

### Dashboards
- **Grafana Integration**: Pre-built dashboards for monitoring
- **Real-time Metrics**: Live system and business metrics
- **Historical Analysis**: Trend analysis and reporting

## 🧪 Testing

### RNG Statistical Tests
```bash
# Run comprehensive RNG tests
npm run test:rng

# Run with custom sample size
node tests/rng-statistical-tests.js 1000000
```

### API Tests
```bash
# Run all tests
npm test

# Run with coverage
npm run test -- --coverage
```

### Test Coverage
- **Unit Tests**: Individual component testing
- **Integration Tests**: API endpoint testing
- **Statistical Tests**: RNG quality verification
- **Load Tests**: Performance and scalability testing

## 🔧 Configuration

### Environment Variables
```bash
# Server Configuration
NODE_ENV=production
PORT=3000

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=keno_game
DB_USER=keno_user
DB_PASSWORD=your_secure_password

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# Security
JWT_SECRET=your_jwt_secret
RNG_SERVER_SEED=your_rng_seed

# Game Configuration
KENO_POOL_SIZE=80
KENO_DRAW_SIZE=20
MIN_WAGER=0.25
MAX_WAGER=20.00
```

### Draw Scheduling
Configure draw intervals using cron expressions:
```bash
# Every 5 minutes
DRAW_SCHEDULE="*/5 * * * *"

# Every hour at minute 0
DRAW_SCHEDULE="0 * * * *"
```

## 📈 Performance

### Optimization Features
- **Database Indexing**: Optimized queries with proper indexes
- **Connection Pooling**: Efficient database connection management
- **Caching**: Redis for frequently accessed data
- **Compression**: Gzip compression for API responses
- **CDN Ready**: Static asset optimization

### Scalability
- **Horizontal Scaling**: Stateless design for load balancing
- **Database Sharding**: Ready for database partitioning
- **Microservices**: Independent service scaling
- **Container Ready**: Docker and Kubernetes support

## 🚀 Deployment

### Production Checklist
- [ ] Environment variables configured
- [ ] Database migrations run
- [ ] SSL certificates installed
- [ ] Monitoring configured
- [ ] Backup strategy implemented
- [ ] Security audit completed
- [ ] RNG certification obtained
- [ ] Load testing performed

### Cloud Deployment
- **AWS**: ECS, RDS, ElastiCache, CloudFront
- **Google Cloud**: GKE, Cloud SQL, Memorystore
- **Azure**: AKS, Azure Database, Redis Cache

## 📋 API Documentation

### Authentication
```bash
# Login
POST /api/v1/auth/login
{
  "username": "player1",
  "password": "password123"
}
```

### Ticket Purchase
```bash
# Purchase ticket
POST /api/v1/tickets
Authorization: Bearer <token>
{
  "spots": [7, 12, 23, 34, 45],
  "wager": 1.00,
  "spotSize": 5
}
```

### Draw Information
```bash
# Get latest draw
GET /api/v1/draws

# Get specific draw
GET /api/v1/draws/{drawId}

# Verify draw (provably fair)
POST /api/v1/draws/{drawId}/verify
```

## 🎮 Game Rules

### How to Play
1. Select 1-10 numbers from 1-80
2. Choose your wager amount ($0.25 - $20.00)
3. Purchase your ticket before the draw
4. Win prizes based on how many numbers match the draw

### Payout Structure
- **1 Spot**: 3:1 for 1 match
- **5 Spots**: 1:1 for 2 matches, 2:1 for 3 matches, 10:1 for 4 matches, 500:1 for 5 matches
- **10 Spots**: Up to 100,000:1 for 10 matches

### RTP (Return to Player)
- Varies by spot size (typically 60-75%)
- Calculated using hypergeometric distribution
- Transparent and verifiable

## 🔍 Troubleshooting

### Common Issues
1. **Database Connection**: Check PostgreSQL is running and credentials are correct
2. **Redis Connection**: Verify Redis is accessible
3. **RNG Issues**: Ensure server seed is properly configured
4. **Draw Failures**: Check draw scheduler and database connectivity

### Logs
```bash
# Application logs
tail -f logs/combined.log

# Error logs
tail -f logs/error.log

# Audit logs
tail -f logs/audit.log
```

## 📞 Support

### Documentation
- [API Reference](docs/api.md)
- [Deployment Guide](docs/deployment.md)
- [Security Guide](docs/security.md)
- [Compliance Guide](docs/compliance.md)

### Contact
- **Technical Issues**: Create an issue in the repository
- **Security Concerns**: Email security@kenogame.com
- **Business Inquiries**: Contact business@kenogame.com

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## ⚠️ Disclaimer

This software is for educational and development purposes. For production use in regulated jurisdictions, ensure compliance with local gambling laws and obtain necessary licenses and certifications.

## 🙏 Acknowledgments

- **RNG Standards**: Based on NIST and GLI guidelines
- **Security**: OWASP security best practices
- **Architecture**: Microservices and cloud-native patterns
- **Compliance**: Industry-standard audit and logging practices
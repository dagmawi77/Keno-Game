require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const slowDown = require('express-slow-down');
const path = require('path');

const { logger } = require('./config/logger');

const app = express();
const PORT = process.env.PORT || 3000;
const API_VERSION = process.env.API_VERSION || 'v1';

// In-memory storage for demo (in production, use Redis or database)
const otpStorage = new Map();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"],
    },
  },
}));

// CORS configuration
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://yourdomain.com']
    : ['http://localhost:3000', 'http://localhost:3001'],
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(limiter);

// Speed limiter
const speedLimiter = slowDown({
  windowMs: 15 * 60 * 1000,
  delayAfter: 50,
  delayMs: () => 500, // Fixed the warning
  maxDelayMs: 20000
});

app.use(speedLimiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Compression middleware
app.use(compression());

// Request logging middleware
app.use((req, res, next) => {
  logger.http(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString()
  });
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Keno Game API is running',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0'
  });
});

// Serve static files (for frontend)
app.use(express.static(path.join(__dirname, '../public')));

// Root endpoint - serve the game interface
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// WhatsApp OTP API endpoints
app.post('/api/v1/otp/send', (req, res) => {
  try {
    const { mobile } = req.body;
    
    if (!mobile) {
      return res.status(400).json({
        success: false,
        message: 'Mobile number is required'
      });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiry = Date.now() + 300000; // 5 minutes

    // Store OTP
    otpStorage.set(mobile, {
      otp,
      expiry,
      attempts: 0
    });

    // In production, integrate with WhatsApp Business API
    // For demo, we'll log the OTP
    logger.info('OTP generated', { mobile, otp });

    // Simulate WhatsApp API call
    console.log(`\n📱 WhatsApp OTP for ${mobile}: ${otp}\n`);
    console.log('In production, this would be sent via WhatsApp Business API');

    res.json({
      success: true,
      message: 'OTP sent successfully to WhatsApp',
      mobile: mobile,
      expiry: expiry
    });

  } catch (error) {
    logger.error('OTP send error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to send OTP'
    });
  }
});

app.post('/api/v1/otp/verify', (req, res) => {
  try {
    const { mobile, otp } = req.body;
    
    if (!mobile || !otp) {
      return res.status(400).json({
        success: false,
        message: 'Mobile number and OTP are required'
      });
    }

    const storedData = otpStorage.get(mobile);
    
    if (!storedData) {
      return res.status(400).json({
        success: false,
        message: 'OTP not found or expired'
      });
    }

    // Check if OTP has expired
    if (Date.now() > storedData.expiry) {
      otpStorage.delete(mobile);
      return res.status(400).json({
        success: false,
        message: 'OTP has expired'
      });
    }

    // Check attempt limit
    if (storedData.attempts >= 3) {
      otpStorage.delete(mobile);
      return res.status(400).json({
        success: false,
        message: 'Too many failed attempts. Please request a new OTP'
      });
    }

    // Verify OTP
    if (storedData.otp === otp) {
      otpStorage.delete(mobile);
      res.json({
        success: true,
        message: 'OTP verified successfully'
      });
    } else {
      // Increment attempts
      storedData.attempts++;
      otpStorage.set(mobile, storedData);
      
      res.status(400).json({
        success: false,
        message: 'Invalid OTP',
        attemptsLeft: 3 - storedData.attempts
      });
    }

  } catch (error) {
    logger.error('OTP verify error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to verify OTP'
    });
  }
});

// User registration endpoint
app.post('/api/v1/auth/register', (req, res) => {
  try {
    const { username, email, mobile, password } = req.body;
    
    // Basic validation
    if (!username || !email || !mobile || !password) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required'
      });
    }

    // In production, you would:
    // 1. Hash the password
    // 2. Store user in database
    // 3. Send verification email
    // 4. Generate JWT token

    logger.info('User registration', { username, email, mobile });

    res.json({
      success: true,
      message: 'User registered successfully',
      user: {
        id: 'user_' + Date.now(),
        username,
        email,
        mobile
      }
    });

  } catch (error) {
    logger.error('Registration error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Registration failed'
    });
  }
});

// User login endpoint
app.post('/api/v1/auth/login', (req, res) => {
  try {
    const { username, password } = req.body;
    
    // Demo credentials
    const validCredentials = {
      'admin': 'admin123',
      'player': 'player123',
      '+1234567890': 'mobile123'
    };

    if (validCredentials[username] === password) {
      const token = 'jwt_token_' + Date.now();
      
      res.json({
        success: true,
        message: 'Login successful',
        token,
        user: {
          id: '1',
          username,
          role: username === 'admin' ? 'admin' : 'player'
        }
      });
    } else {
      res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

  } catch (error) {
    logger.error('Login error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Login failed'
    });
  }
});

// API routes (placeholder)
app.get('/api/v1/paytables', (req, res) => {
  res.json({
    success: true,
    data: {
      1: { name: "1-Spot", wager: 1.00, payouts: { 1: 3.00 } },
      2: { name: "2-Spot", wager: 1.00, payouts: { 2: 12.00 } },
      3: { name: "3-Spot", wager: 1.00, payouts: { 2: 1.00, 3: 42.00 } },
      4: { name: "4-Spot", wager: 1.00, payouts: { 2: 1.00, 3: 3.00, 4: 100.00 } },
      5: { name: "5-Spot", wager: 1.00, payouts: { 2: 1.00, 3: 2.00, 4: 10.00, 5: 500.00 } }
    }
  });
});

app.get('/api/v1/draws', (req, res) => {
  // Generate a sample draw
  const numbers = Array.from({length: 20}, () => Math.floor(Math.random() * 80) + 1).sort((a, b) => a - b);
  res.json({
    success: true,
    data: [{
      drawId: 'demo-draw-1',
      drawNumber: 1001,
      drawTime: new Date().toISOString(),
      numbers: numbers,
      status: 'completed'
    }]
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint not found'
  });
});

// Global error handler
app.use((error, req, res, next) => {
  logger.error('Unhandled error', {
    error: error.message,
    stack: error.stack,
    path: req.path,
    method: req.method,
    ip: req.ip
  });
  
  res.status(500).json({
    success: false,
    message: process.env.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : error.message
  });
});

// Start server
app.listen(PORT, () => {
  logger.info(`Keno Game API server started on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`API Version: ${API_VERSION}`);
  logger.info(`Game interface available at: http://localhost:${PORT}`);
  logger.info(`WhatsApp OTP demo: Check console for OTP codes`);
});

module.exports = app;
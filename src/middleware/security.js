const rateLimit = require('express-rate-limit');
const slowDown = require('express-slow-down');
const { logger, auditLog } = require('../config/logger');

/**
 * Security middleware for Keno Game
 */

// Rate limiting for different endpoints
const createRateLimit = (windowMs, max, message) => {
  return rateLimit({
    windowMs,
    max,
    message: {
      success: false,
      message
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      auditLog('RATE_LIMIT_EXCEEDED', {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        path: req.path,
        method: req.method
      });
      
      res.status(429).json({
        success: false,
        message
      });
    }
  });
};

// General API rate limiting
const generalRateLimit = createRateLimit(
  15 * 60 * 1000, // 15 minutes
  100, // 100 requests per window
  'Too many requests from this IP, please try again later.'
);

// Strict rate limiting for ticket purchases
const ticketPurchaseRateLimit = createRateLimit(
  5 * 60 * 1000, // 5 minutes
  10, // 10 ticket purchases per 5 minutes
  'Too many ticket purchases. Please slow down.'
);

// Admin endpoint rate limiting
const adminRateLimit = createRateLimit(
  15 * 60 * 1000, // 15 minutes
  50, // 50 admin requests per window
  'Too many admin requests from this IP.'
);

// Speed limiting for API endpoints
const speedLimiter = slowDown({
  windowMs: 15 * 60 * 1000, // 15 minutes
  delayAfter: 50, // allow 50 requests per 15 minutes, then...
  delayMs: 500, // begin adding 500ms of delay per request above 50
  maxDelayMs: 20000, // maximum delay of 20 seconds
  onLimitReached: (req, res, options) => {
    auditLog('SPEED_LIMIT_REACHED', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      path: req.path,
      method: req.method
    });
  }
});

/**
 * IP whitelist/blacklist middleware
 */
const ipFilter = (req, res, next) => {
  const clientIP = req.ip || req.connection.remoteAddress;
  
  // Check against blacklist (in production, this would come from a database)
  const blacklistedIPs = process.env.BLACKLISTED_IPS ? 
    process.env.BLACKLISTED_IPS.split(',') : [];
  
  if (blacklistedIPs.includes(clientIP)) {
    auditLog('BLACKLISTED_IP_ACCESS_ATTEMPT', {
      ip: clientIP,
      userAgent: req.get('User-Agent'),
      path: req.path
    });
    
    return res.status(403).json({
      success: false,
      message: 'Access denied'
    });
  }
  
  next();
};

/**
 * Request validation middleware
 */
const validateRequest = (req, res, next) => {
  // Check for suspicious patterns
  const suspiciousPatterns = [
    /script/i,
    /javascript/i,
    /<script/i,
    /union.*select/i,
    /drop.*table/i,
    /insert.*into/i,
    /delete.*from/i
  ];
  
  const requestBody = JSON.stringify(req.body);
  const requestQuery = JSON.stringify(req.query);
  const requestParams = JSON.stringify(req.params);
  
  for (const pattern of suspiciousPatterns) {
    if (pattern.test(requestBody) || pattern.test(requestQuery) || pattern.test(requestParams)) {
      auditLog('SUSPICIOUS_REQUEST_DETECTED', {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        path: req.path,
        method: req.method,
        body: req.body,
        query: req.query,
        params: req.params
      });
      
      return res.status(400).json({
        success: false,
        message: 'Invalid request detected'
      });
    }
  }
  
  next();
};

/**
 * Anti-cheat middleware for ticket purchases
 */
const antiCheatValidation = (req, res, next) => {
  if (req.path.includes('/tickets') && req.method === 'POST') {
    const { spots, wager, spotSize } = req.body;
    
    // Validate spot selection patterns
    if (spots && Array.isArray(spots)) {
      // Check for sequential patterns (potential bot behavior)
      const sortedSpots = [...spots].sort((a, b) => a - b);
      let sequentialCount = 0;
      
      for (let i = 1; i < sortedSpots.length; i++) {
        if (sortedSpots[i] === sortedSpots[i-1] + 1) {
          sequentialCount++;
        }
      }
      
      // Flag if more than 70% of spots are sequential
      if (sequentialCount / spots.length > 0.7) {
        auditLog('SUSPICIOUS_TICKET_PATTERN', {
          userId: req.user?.id,
          ip: req.ip,
          spots: spots,
          pattern: 'sequential',
          ratio: sequentialCount / spots.length
        });
      }
      
      // Check for common "lucky" number patterns
      const commonLuckyNumbers = [7, 13, 21, 28, 35, 42, 49, 56, 63, 70, 77];
      const luckyNumberCount = spots.filter(spot => commonLuckyNumbers.includes(spot)).length;
      
      if (luckyNumberCount / spots.length > 0.8) {
        auditLog('SUSPICIOUS_TICKET_PATTERN', {
          userId: req.user?.id,
          ip: req.ip,
          spots: spots,
          pattern: 'lucky_numbers',
          ratio: luckyNumberCount / spots.length
        });
      }
    }
    
    // Validate wager amounts
    if (wager && (wager < 0.25 || wager > 20.00)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid wager amount'
      });
    }
    
    // Validate spot size
    if (spotSize && (spotSize < 1 || spotSize > 10)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid spot size'
      });
    }
  }
  
  next();
};

/**
 * Request size limiting
 */
const requestSizeLimit = (req, res, next) => {
  const contentLength = parseInt(req.get('content-length') || '0');
  const maxSize = 10 * 1024 * 1024; // 10MB
  
  if (contentLength > maxSize) {
    auditLog('REQUEST_SIZE_EXCEEDED', {
      ip: req.ip,
      contentLength,
      maxSize,
      path: req.path
    });
    
    return res.status(413).json({
      success: false,
      message: 'Request too large'
    });
  }
  
  next();
};

/**
 * User agent validation
 */
const userAgentValidation = (req, res, next) => {
  const userAgent = req.get('User-Agent');
  
  // Block requests with suspicious or missing user agents
  if (!userAgent || userAgent.length < 10) {
    auditLog('SUSPICIOUS_USER_AGENT', {
      ip: req.ip,
      userAgent: userAgent || 'missing',
      path: req.path
    });
    
    return res.status(400).json({
      success: false,
      message: 'Invalid request'
    });
  }
  
  // Block known bot user agents (in production, use a more comprehensive list)
  const botPatterns = [
    /bot/i,
    /crawler/i,
    /spider/i,
    /scraper/i,
    /curl/i,
    /wget/i
  ];
  
  for (const pattern of botPatterns) {
    if (pattern.test(userAgent)) {
      auditLog('BOT_USER_AGENT_DETECTED', {
        ip: req.ip,
        userAgent,
        path: req.path
      });
      
      return res.status(403).json({
        success: false,
        message: 'Bot access not allowed'
      });
    }
  }
  
  next();
};

/**
 * Geographic restrictions (basic implementation)
 */
const geoRestriction = (req, res, next) => {
  // In production, use a proper GeoIP service
  const allowedCountries = process.env.ALLOWED_COUNTRIES ? 
    process.env.ALLOWED_COUNTRIES.split(',') : ['US', 'CA', 'GB'];
  
  // For demo purposes, we'll skip actual GeoIP lookup
  // In production, integrate with MaxMind GeoIP2 or similar service
  
  next();
};

/**
 * Session security middleware
 */
const sessionSecurity = (req, res, next) => {
  // Add security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Remove server information
  res.removeHeader('X-Powered-By');
  
  next();
};

module.exports = {
  generalRateLimit,
  ticketPurchaseRateLimit,
  adminRateLimit,
  speedLimiter,
  ipFilter,
  validateRequest,
  antiCheatValidation,
  requestSizeLimit,
  userAgentValidation,
  geoRestriction,
  sessionSecurity
};

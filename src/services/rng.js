const crypto = require('crypto');
const { logger, auditLog } = require('../config/logger');

/**
 * Cryptographically Secure Random Number Generator for Keno draws
 * Implements provably fair RNG with server seed hashing
 */
class RNGService {
  constructor() {
    this.serverSeed = process.env.RNG_SERVER_SEED || this.generateSecureSeed();
    this.clientSeedLength = parseInt(process.env.RNG_CLIENT_SEED_LENGTH) || 32;
    this.poolSize = parseInt(process.env.KENO_POOL_SIZE) || 80;
    this.drawSize = parseInt(process.env.KENO_DRAW_SIZE) || 20;
  }

  /**
   * Generate a cryptographically secure seed
   */
  generateSecureSeed() {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Generate server seed hash for provably fair verification
   */
  getServerSeedHash() {
    return crypto.createHash('sha256').update(this.serverSeed).digest('hex');
  }

  /**
   * Generate a new server seed and return the hash
   */
  rotateServerSeed() {
    this.serverSeed = this.generateSecureSeed();
    return this.getServerSeedHash();
  }

  /**
   * Sample without replacement using Fisher-Yates shuffle with crypto RNG
   * This is the core RNG function for drawing Keno numbers
   */
  sampleWithoutReplacement(seed, nonce, poolSize, sampleSize) {
    const hmac = crypto.createHmac('sha256', seed);
    hmac.update(nonce.toString());
    const hash = hmac.digest();
    
    // Create array of numbers 1 to poolSize
    const numbers = Array.from({ length: poolSize }, (_, i) => i + 1);
    
    // Fisher-Yates shuffle using crypto RNG
    for (let i = numbers.length - 1; i > 0; i--) {
      const j = this.getRandomIndex(hash, i + 1);
      [numbers[i], numbers[j]] = [numbers[j], numbers[i]];
    }
    
    // Return first sampleSize numbers (sorted for consistency)
    return numbers.slice(0, sampleSize).sort((a, b) => a - b);
  }

  /**
   * Get random index using hash as entropy source
   */
  getRandomIndex(hash, max) {
    let randomValue = 0;
    let offset = 0;
    
    do {
      // Use 4 bytes from hash for randomness
      randomValue = hash.readUInt32BE(offset % (hash.length - 4));
      offset += 4;
    } while (randomValue >= Math.floor(0x100000000 / max) * max);
    
    return randomValue % max;
  }

  /**
   * Generate a Keno draw with provably fair verification
   */
  generateDraw(clientSeed = null, nonce = null) {
    const drawId = crypto.randomUUID();
    const timestamp = new Date().toISOString();
    
    // Use provided seeds or generate new ones
    const actualClientSeed = clientSeed || crypto.randomBytes(this.clientSeedLength).toString('hex');
    const actualNonce = nonce || Date.now();
    
    // Generate the draw numbers
    const numbers = this.sampleWithoutReplacement(
      this.serverSeed + actualClientSeed,
      actualNonce,
      this.poolSize,
      this.drawSize
    );
    
    // Create draw result
    const drawResult = {
      drawId,
      timestamp,
      numbers,
      serverSeedHash: this.getServerSeedHash(),
      clientSeed: actualClientSeed,
      nonce: actualNonce,
      poolSize: this.poolSize,
      drawSize: this.drawSize
    };
    
    // Log for audit trail
    auditLog('DRAW_GENERATED', {
      drawId,
      timestamp,
      numbers,
      serverSeedHash: this.getServerSeedHash(),
      clientSeed: actualClientSeed,
      nonce: actualNonce
    });
    
    logger.info('Keno draw generated', { drawId, numbers });
    
    return drawResult;
  }

  /**
   * Verify a draw using provably fair verification
   */
  verifyDraw(drawResult) {
    try {
      const { serverSeedHash, clientSeed, nonce, numbers, poolSize, drawSize } = drawResult;
      
      // Verify server seed hash
      if (this.getServerSeedHash() !== serverSeedHash) {
        throw new Error('Server seed hash mismatch');
      }
      
      // Regenerate draw with same parameters
      const regeneratedNumbers = this.sampleWithoutReplacement(
        this.serverSeed + clientSeed,
        nonce,
        poolSize,
        drawSize
      );
      
      // Compare results
      const isValid = JSON.stringify(numbers) === JSON.stringify(regeneratedNumbers);
      
      if (!isValid) {
        logger.error('Draw verification failed', { drawResult, regeneratedNumbers });
        throw new Error('Draw verification failed');
      }
      
      logger.info('Draw verification successful', { drawId: drawResult.drawId });
      return true;
    } catch (error) {
      logger.error('Draw verification error', { error: error.message, drawResult });
      return false;
    }
  }

  /**
   * Statistical test for RNG quality (for certification)
   */
  async runStatisticalTests(sampleSize = 100000) {
    logger.info('Starting RNG statistical tests', { sampleSize });
    
    const results = {
      chiSquare: 0,
      kolmogorovSmirnov: 0,
      runsTest: 0,
      sampleSize
    };
    
    // Generate large sample of draws
    const draws = [];
    for (let i = 0; i < sampleSize; i++) {
      const draw = this.generateDraw();
      draws.push(draw.numbers);
    }
    
    // Flatten all numbers for analysis
    const allNumbers = draws.flat();
    
    // Chi-square test for uniformity
    const expectedFreq = allNumbers.length / this.poolSize;
    let chiSquare = 0;
    
    for (let i = 1; i <= this.poolSize; i++) {
      const observedFreq = allNumbers.filter(n => n === i).length;
      chiSquare += Math.pow(observedFreq - expectedFreq, 2) / expectedFreq;
    }
    
    results.chiSquare = chiSquare;
    
    // Kolmogorov-Smirnov test
    const sortedNumbers = allNumbers.sort((a, b) => a - b);
    const n = sortedNumbers.length;
    let maxDiff = 0;
    
    for (let i = 0; i < n; i++) {
      const empirical = (i + 1) / n;
      const theoretical = sortedNumbers[i] / this.poolSize;
      maxDiff = Math.max(maxDiff, Math.abs(empirical - theoretical));
    }
    
    results.kolmogorovSmirnov = maxDiff * Math.sqrt(n);
    
    logger.info('RNG statistical tests completed', results);
    return results;
  }
}

module.exports = new RNGService();

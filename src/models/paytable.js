/**
 * Keno Paytable Configuration
 * Based on industry standards and state lottery examples
 */

class PaytableService {
  constructor() {
    // Standard paytables for different spot sizes
    // Based on Delaware Lottery and CT Lottery examples
    this.paytables = {
      // 1-spot payouts
      1: {
        name: "1-Spot",
        wager: 1.00,
        payouts: {
          1: 3.00  // 3:1 payout for 1 match
        }
      },
      
      // 2-spot payouts
      2: {
        name: "2-Spot",
        wager: 1.00,
        payouts: {
          0: 0.00,
          1: 0.00,
          2: 12.00  // 12:1 payout for 2 matches
        }
      },
      
      // 3-spot payouts
      3: {
        name: "3-Spot",
        wager: 1.00,
        payouts: {
          0: 0.00,
          1: 0.00,
          2: 1.00,   // 1:1 payout for 2 matches
          3: 42.00   // 42:1 payout for 3 matches
        }
      },
      
      // 4-spot payouts
      4: {
        name: "4-Spot",
        wager: 1.00,
        payouts: {
          0: 0.00,
          1: 0.00,
          2: 1.00,   // 1:1 payout for 2 matches
          3: 3.00,   // 3:1 payout for 3 matches
          4: 100.00  // 100:1 payout for 4 matches
        }
      },
      
      // 5-spot payouts
      5: {
        name: "5-Spot",
        wager: 1.00,
        payouts: {
          0: 0.00,
          1: 0.00,
          2: 1.00,   // 1:1 payout for 2 matches
          3: 2.00,   // 2:1 payout for 3 matches
          4: 10.00,  // 10:1 payout for 4 matches
          5: 500.00  // 500:1 payout for 5 matches
        }
      },
      
      // 6-spot payouts
      6: {
        name: "6-Spot",
        wager: 1.00,
        payouts: {
          0: 0.00,
          1: 0.00,
          2: 0.00,
          3: 1.00,   // 1:1 payout for 3 matches
          4: 5.00,   // 5:1 payout for 4 matches
          5: 50.00,  // 50:1 payout for 5 matches
          6: 1000.00 // 1000:1 payout for 6 matches
        }
      },
      
      // 7-spot payouts
      7: {
        name: "7-Spot",
        wager: 1.00,
        payouts: {
          0: 0.00,
          1: 0.00,
          2: 0.00,
          3: 0.00,
          4: 1.00,   // 1:1 payout for 4 matches
          5: 10.00,  // 10:1 payout for 5 matches
          6: 100.00, // 100:1 payout for 6 matches
          7: 2000.00 // 2000:1 payout for 7 matches
        }
      },
      
      // 8-spot payouts
      8: {
        name: "8-Spot",
        wager: 1.00,
        payouts: {
          0: 0.00,
          1: 0.00,
          2: 0.00,
          3: 0.00,
          4: 0.00,
          5: 5.00,   // 5:1 payout for 5 matches
          6: 50.00,  // 50:1 payout for 6 matches
          7: 500.00, // 500:1 payout for 7 matches
          8: 5000.00 // 5000:1 payout for 8 matches
        }
      },
      
      // 9-spot payouts
      9: {
        name: "9-Spot",
        wager: 1.00,
        payouts: {
          0: 0.00,
          1: 0.00,
          2: 0.00,
          3: 0.00,
          4: 0.00,
          5: 2.00,   // 2:1 payout for 5 matches
          6: 20.00,  // 20:1 payout for 6 matches
          7: 200.00, // 200:1 payout for 7 matches
          8: 2000.00, // 2000:1 payout for 8 matches
          9: 10000.00 // 10000:1 payout for 9 matches
        }
      },
      
      // 10-spot payouts
      10: {
        name: "10-Spot",
        wager: 1.00,
        payouts: {
          0: 0.00,
          1: 0.00,
          2: 0.00,
          3: 0.00,
          4: 0.00,
          5: 1.00,    // 1:1 payout for 5 matches
          6: 10.00,   // 10:1 payout for 6 matches
          7: 100.00,  // 100:1 payout for 7 matches
          8: 1000.00, // 1000:1 payout for 8 matches
          9: 5000.00, // 5000:1 payout for 9 matches
          10: 100000.00 // 100000:1 payout for 10 matches
        }
      }
    };
  }

  /**
   * Get paytable for a specific spot size
   */
  getPaytable(spotSize) {
    if (!this.paytables[spotSize]) {
      throw new Error(`Invalid spot size: ${spotSize}`);
    }
    return this.paytables[spotSize];
  }

  /**
   * Calculate payout for a ticket
   */
  calculatePayout(spotSize, matches, wager) {
    const paytable = this.getPaytable(spotSize);
    const basePayout = paytable.payouts[matches] || 0;
    
    // Scale payout based on wager amount
    const payout = (basePayout / paytable.wager) * wager;
    
    return {
      matches,
      basePayout,
      wager,
      payout: Math.round(payout * 100) / 100, // Round to 2 decimal places
      spotSize
    };
  }

  /**
   * Get all available paytables
   */
  getAllPaytables() {
    return this.paytables;
  }

  /**
   * Calculate Return to Player (RTP) for a spot size
   */
  calculateRTP(spotSize) {
    const paytable = this.getPaytable(spotSize);
    const poolSize = 80;
    const drawSize = 20;
    const spotSizeNum = parseInt(spotSize);
    
    let totalExpectedPayout = 0;
    
    // Calculate expected payout for each possible match count
    for (let matches = 0; matches <= spotSizeNum; matches++) {
      const probability = this.calculateMatchProbability(spotSizeNum, matches, poolSize, drawSize);
      const payout = paytable.payouts[matches] || 0;
      totalExpectedPayout += probability * payout;
    }
    
    const rtp = totalExpectedPayout / paytable.wager;
    return Math.round(rtp * 10000) / 100; // Return as percentage
  }

  /**
   * Calculate probability of getting exactly 'matches' numbers
   * Using hypergeometric distribution
   */
  calculateMatchProbability(spotSize, matches, poolSize, drawSize) {
    if (matches > spotSize || matches > drawSize) return 0;
    if (matches < 0) return 0;
    
    // Hypergeometric distribution: C(k,m) * C(N-k, n-m) / C(N,n)
    // where N=poolSize, n=drawSize, k=spotSize, m=matches
    
    const numerator = this.combination(spotSize, matches) * 
                     this.combination(poolSize - spotSize, drawSize - matches);
    const denominator = this.combination(poolSize, drawSize);
    
    return numerator / denominator;
  }

  /**
   * Calculate combination C(n,k) = n! / (k! * (n-k)!)
   */
  combination(n, k) {
    if (k > n || k < 0) return 0;
    if (k === 0 || k === n) return 1;
    
    let result = 1;
    for (let i = 0; i < k; i++) {
      result = result * (n - i) / (i + 1);
    }
    
    return Math.round(result);
  }

  /**
   * Get RTP for all spot sizes
   */
  getAllRTPs() {
    const rtps = {};
    for (let spotSize = 1; spotSize <= 10; spotSize++) {
      rtps[spotSize] = this.calculateRTP(spotSize);
    }
    return rtps;
  }

  /**
   * Validate paytable configuration
   */
  validatePaytable(spotSize, payouts) {
    const errors = [];
    
    if (spotSize < 1 || spotSize > 10) {
      errors.push('Spot size must be between 1 and 10');
    }
    
    for (let matches = 0; matches <= spotSize; matches++) {
      if (payouts[matches] === undefined) {
        errors.push(`Payout for ${matches} matches is required`);
      } else if (payouts[matches] < 0) {
        errors.push(`Payout for ${matches} matches cannot be negative`);
      }
    }
    
    return errors;
  }
}

module.exports = new PaytableService();

/**
 * RNG Statistical Tests for Keno Game
 * Implements tests required for gaming certification (GLI standards)
 */

const rngService = require('../src/services/rng');
const { logger } = require('../src/config/logger');

class RNGStatisticalTests {
    constructor() {
        this.testResults = {
            chiSquare: null,
            kolmogorovSmirnov: null,
            runsTest: null,
            autocorrelation: null,
            overallPass: false
        };
    }

    /**
     * Run all statistical tests
     */
    async runAllTests(sampleSize = 100000) {
        console.log(`\n🧪 Starting RNG Statistical Tests (Sample Size: ${sampleSize.toLocaleString()})`);
        console.log('=' * 60);

        try {
            // Test 1: Chi-Square Test for Uniformity
            console.log('\n1. Chi-Square Test for Uniformity...');
            await this.chiSquareTest(sampleSize);

            // Test 2: Kolmogorov-Smirnov Test
            console.log('\n2. Kolmogorov-Smirnov Test...');
            await this.kolmogorovSmirnovTest(sampleSize);

            // Test 3: Runs Test
            console.log('\n3. Runs Test...');
            await this.runsTest(sampleSize);

            // Test 4: Autocorrelation Test
            console.log('\n4. Autocorrelation Test...');
            await this.autocorrelationTest(sampleSize);

            // Overall assessment
            this.assessOverallResults();

            this.printResults();
            return this.testResults;

        } catch (error) {
            logger.error('RNG statistical tests failed', { error: error.message });
            throw error;
        }
    }

    /**
     * Chi-Square Test for Uniformity
     * Tests if numbers are uniformly distributed across 1-80
     */
    async chiSquareTest(sampleSize) {
        const draws = [];
        const poolSize = 80;
        const drawSize = 20;
        
        // Generate sample draws
        for (let i = 0; i < sampleSize; i++) {
            const draw = rngService.generateDraw();
            draws.push(draw.numbers);
        }

        // Flatten all numbers
        const allNumbers = draws.flat();
        const totalNumbers = allNumbers.length;

        // Count frequency of each number (1-80)
        const observedFreq = new Array(poolSize + 1).fill(0);
        allNumbers.forEach(num => observedFreq[num]++);

        // Expected frequency (uniform distribution)
        const expectedFreq = totalNumbers / poolSize;

        // Calculate chi-square statistic
        let chiSquare = 0;
        for (let i = 1; i <= poolSize; i++) {
            const observed = observedFreq[i];
            const expected = expectedFreq;
            chiSquare += Math.pow(observed - expected, 2) / expected;
        }

        // Degrees of freedom = poolSize - 1
        const degreesOfFreedom = poolSize - 1;
        
        // Critical value for 99% confidence (α = 0.01)
        const criticalValue = this.getChiSquareCriticalValue(degreesOfFreedom, 0.01);
        
        const passed = chiSquare <= criticalValue;
        
        this.testResults.chiSquare = {
            statistic: chiSquare,
            degreesOfFreedom,
            criticalValue,
            passed,
            pValue: this.chiSquarePValue(chiSquare, degreesOfFreedom)
        };

        console.log(`   Chi-Square Statistic: ${chiSquare.toFixed(4)}`);
        console.log(`   Critical Value (99%): ${criticalValue.toFixed(4)}`);
        console.log(`   Result: ${passed ? '✅ PASS' : '❌ FAIL'}`);
    }

    /**
     * Kolmogorov-Smirnov Test
     * Tests if the empirical distribution matches the theoretical uniform distribution
     */
    async kolmogorovSmirnovTest(sampleSize) {
        const draws = [];
        
        // Generate sample draws
        for (let i = 0; i < sampleSize; i++) {
            const draw = rngService.generateDraw();
            draws.push(draw.numbers);
        }

        // Flatten and sort all numbers
        const allNumbers = draws.flat().sort((a, b) => a - b);
        const n = allNumbers.length;
        const poolSize = 80;

        // Calculate empirical CDF
        let maxDiff = 0;
        for (let i = 0; i < n; i++) {
            const empirical = (i + 1) / n;
            const theoretical = allNumbers[i] / poolSize;
            const diff = Math.abs(empirical - theoretical);
            maxDiff = Math.max(maxDiff, diff);
        }

        // KS statistic
        const ksStatistic = maxDiff * Math.sqrt(n);
        
        // Critical value for 99% confidence
        const criticalValue = 1.63; // For large samples
        
        const passed = ksStatistic <= criticalValue;
        
        this.testResults.kolmogorovSmirnov = {
            statistic: ksStatistic,
            criticalValue,
            passed
        };

        console.log(`   KS Statistic: ${ksStatistic.toFixed(4)}`);
        console.log(`   Critical Value (99%): ${criticalValue.toFixed(4)}`);
        console.log(`   Result: ${passed ? '✅ PASS' : '❌ FAIL'}`);
    }

    /**
     * Runs Test
     * Tests for randomness in the sequence of numbers
     */
    async runsTest(sampleSize) {
        const draws = [];
        
        // Generate sample draws
        for (let i = 0; i < sampleSize; i++) {
            const draw = rngService.generateDraw();
            draws.push(draw.numbers);
        }

        // Flatten all numbers
        const allNumbers = draws.flat();
        const n = allNumbers.length;
        const poolSize = 80;

        // Calculate median
        const sortedNumbers = [...allNumbers].sort((a, b) => a - b);
        const median = sortedNumbers[Math.floor(n / 2)];

        // Create binary sequence (above/below median)
        const binarySequence = allNumbers.map(num => num > median ? 1 : 0);

        // Count runs
        let runs = 1;
        for (let i = 1; i < n; i++) {
            if (binarySequence[i] !== binarySequence[i - 1]) {
                runs++;
            }
        }

        // Count 1s and 0s
        const n1 = binarySequence.filter(bit => bit === 1).length;
        const n0 = n - n1;

        // Expected runs
        const expectedRuns = (2 * n1 * n0) / n + 1;

        // Variance
        const variance = (2 * n1 * n0 * (2 * n1 * n0 - n)) / (n * n * (n - 1));

        // Z-score
        const zScore = Math.abs(runs - expectedRuns) / Math.sqrt(variance);
        
        // Critical value for 99% confidence (two-tailed)
        const criticalValue = 2.576;
        
        const passed = zScore <= criticalValue;
        
        this.testResults.runsTest = {
            runs,
            expectedRuns,
            zScore,
            criticalValue,
            passed
        };

        console.log(`   Runs: ${runs}`);
        console.log(`   Expected Runs: ${expectedRuns.toFixed(2)}`);
        console.log(`   Z-Score: ${zScore.toFixed(4)}`);
        console.log(`   Result: ${passed ? '✅ PASS' : '❌ FAIL'}`);
    }

    /**
     * Autocorrelation Test
     * Tests for independence between consecutive numbers
     */
    async autocorrelationTest(sampleSize) {
        const draws = [];
        
        // Generate sample draws
        for (let i = 0; i < sampleSize; i++) {
            const draw = rngService.generateDraw();
            draws.push(draw.numbers);
        }

        // Flatten all numbers
        const allNumbers = draws.flat();
        const n = allNumbers.length;
        const poolSize = 80;

        // Calculate mean
        const mean = allNumbers.reduce((sum, num) => sum + num, 0) / n;

        // Calculate autocorrelation for lag 1
        let numerator = 0;
        let denominator = 0;

        for (let i = 0; i < n - 1; i++) {
            numerator += (allNumbers[i] - mean) * (allNumbers[i + 1] - mean);
        }

        for (let i = 0; i < n; i++) {
            denominator += Math.pow(allNumbers[i] - mean, 2);
        }

        const autocorrelation = numerator / denominator;

        // Standard error for autocorrelation
        const standardError = 1 / Math.sqrt(n);
        
        // Z-score
        const zScore = Math.abs(autocorrelation) / standardError;
        
        // Critical value for 99% confidence
        const criticalValue = 2.576;
        
        const passed = zScore <= criticalValue;
        
        this.testResults.autocorrelation = {
            autocorrelation,
            zScore,
            criticalValue,
            passed
        };

        console.log(`   Autocorrelation: ${autocorrelation.toFixed(6)}`);
        console.log(`   Z-Score: ${zScore.toFixed(4)}`);
        console.log(`   Result: ${passed ? '✅ PASS' : '❌ FAIL'}`);
    }

    /**
     * Assess overall test results
     */
    assessOverallResults() {
        const tests = [
            this.testResults.chiSquare,
            this.testResults.kolmogorovSmirnov,
            this.testResults.runsTest,
            this.testResults.autocorrelation
        ];

        this.testResults.overallPass = tests.every(test => test && test.passed);
    }

    /**
     * Print test results summary
     */
    printResults() {
        console.log('\n' + '=' * 60);
        console.log('📊 RNG STATISTICAL TEST RESULTS');
        console.log('=' * 60);

        console.log(`\nChi-Square Test: ${this.testResults.chiSquare?.passed ? '✅ PASS' : '❌ FAIL'}`);
        console.log(`Kolmogorov-Smirnov Test: ${this.testResults.kolmogorovSmirnov?.passed ? '✅ PASS' : '❌ FAIL'}`);
        console.log(`Runs Test: ${this.testResults.runsTest?.passed ? '✅ PASS' : '❌ FAIL'}`);
        console.log(`Autocorrelation Test: ${this.testResults.autocorrelation?.passed ? '✅ PASS' : '❌ FAIL'}`);

        console.log('\n' + '=' * 60);
        console.log(`🎯 OVERALL RESULT: ${this.testResults.overallPass ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);
        console.log('=' * 60);

        if (this.testResults.overallPass) {
            console.log('\n🎉 RNG is statistically sound and ready for certification!');
        } else {
            console.log('\n⚠️  RNG needs improvement before certification.');
        }
    }

    /**
     * Get chi-square critical value for given degrees of freedom and significance level
     */
    getChiSquareCriticalValue(df, alpha) {
        // Approximate critical values for common degrees of freedom
        const criticalValues = {
            79: 108.8,  // 80-1 = 79 degrees of freedom
            80: 109.8,
            81: 110.8
        };

        return criticalValues[df] || 100; // Fallback value
    }

    /**
     * Approximate p-value for chi-square test
     */
    chiSquarePValue(chiSquare, df) {
        // This is a simplified approximation
        // In production, use a proper statistical library
        if (chiSquare < df) return 0.5;
        if (chiSquare < df + Math.sqrt(2 * df)) return 0.1;
        if (chiSquare < df + 2 * Math.sqrt(2 * df)) return 0.01;
        return 0.001;
    }
}

// Run tests if called directly
if (require.main === module) {
    const tester = new RNGStatisticalTests();
    
    const sampleSize = process.argv[2] ? parseInt(process.argv[2]) : 100000;
    
    tester.runAllTests(sampleSize)
        .then(results => {
            process.exit(results.overallPass ? 0 : 1);
        })
        .catch(error => {
            console.error('Test execution failed:', error);
            process.exit(1);
        });
}

module.exports = RNGStatisticalTests;

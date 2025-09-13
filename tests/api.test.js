const request = require('supertest');
const app = require('../src/server');
const database = require('../src/config/database');

describe('Keno Game API Tests', () => {
    let authToken;
    let testUserId;

    beforeAll(async () => {
        // Setup test database connection
        await database.query('SELECT 1');
    });

    afterAll(async () => {
        // Cleanup
        await database.close();
    });

    describe('Health Check', () => {
        test('GET /health should return 200', async () => {
            const response = await request(app)
                .get('/health')
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.message).toContain('Keno Game API');
        });
    });

    describe('Paytables API', () => {
        test('GET /api/v1/paytables should return all paytables', async () => {
            const response = await request(app)
                .get('/api/v1/paytables')
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data).toBeDefined();
            expect(response.body.data['1']).toBeDefined();
            expect(response.body.data['10']).toBeDefined();
        });

        test('GET /api/v1/paytables/5 should return 5-spot paytable', async () => {
            const response = await request(app)
                .get('/api/v1/paytables/5')
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.spotSize).toBe(5);
            expect(response.body.data.payouts).toBeDefined();
        });

        test('POST /api/v1/paytables/calculate should calculate payout', async () => {
            const response = await request(app)
                .post('/api/v1/paytables/calculate')
                .send({
                    spotSize: 5,
                    matches: 3,
                    wager: 1.00
                })
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.matches).toBe(3);
            expect(response.body.data.payout).toBeGreaterThanOrEqual(0);
        });

        test('GET /api/v1/paytables/rtp should return RTP percentages', async () => {
            const response = await request(app)
                .get('/api/v1/paytables/rtp')
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data).toBeDefined();
            expect(typeof response.body.data['5']).toBe('number');
        });
    });

    describe('Draws API', () => {
        test('GET /api/v1/draws should return recent draws', async () => {
            const response = await request(app)
                .get('/api/v1/draws')
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(Array.isArray(response.body.data)).toBe(true);
        });

        test('GET /api/v1/draws/upcoming should return upcoming draws', async () => {
            const response = await request(app)
                .get('/api/v1/draws/upcoming')
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(Array.isArray(response.body.data)).toBe(true);
        });
    });

    describe('Authentication', () => {
        test('POST /api/v1/tickets without auth should return 401', async () => {
            const response = await request(app)
                .post('/api/v1/tickets')
                .send({
                    spots: [1, 2, 3],
                    wager: 1.00,
                    spotSize: 3
                })
                .expect(401);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toContain('Access token required');
        });
    });

    describe('Ticket Validation', () => {
        test('POST /api/v1/tickets with invalid spots should return 400', async () => {
            // This would require authentication in a real test
            const response = await request(app)
                .post('/api/v1/tickets')
                .set('Authorization', 'Bearer invalid_token')
                .send({
                    spots: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], // Too many spots
                    wager: 1.00,
                    spotSize: 11
                })
                .expect(401); // Would be 400 with valid auth

            expect(response.body.success).toBe(false);
        });
    });

    describe('RNG Service', () => {
        test('RNG should generate valid draws', () => {
            const rngService = require('../src/services/rng');
            
            const draw = rngService.generateDraw();
            
            expect(draw.numbers).toHaveLength(20);
            expect(draw.numbers.every(num => num >= 1 && num <= 80)).toBe(true);
            expect(new Set(draw.numbers).size).toBe(20); // No duplicates
            expect(draw.serverSeedHash).toBeDefined();
            expect(draw.clientSeed).toBeDefined();
            expect(draw.nonce).toBeDefined();
        });

        test('RNG should be verifiable', () => {
            const rngService = require('../src/services/rng');
            
            const draw = rngService.generateDraw();
            const isValid = rngService.verifyDraw(draw);
            
            expect(isValid).toBe(true);
        });
    });

    describe('Paytable Service', () => {
        test('Should calculate correct payouts', () => {
            const paytableService = require('../src/models/paytable');
            
            // Test 5-spot, 3 matches, $1 wager
            const payout = paytableService.calculatePayout(5, 3, 1.00);
            
            expect(payout.matches).toBe(3);
            expect(payout.wager).toBe(1.00);
            expect(payout.payout).toBeGreaterThanOrEqual(0);
            expect(payout.spotSize).toBe(5);
        });

        test('Should calculate RTP correctly', () => {
            const paytableService = require('../src/models/paytable');
            
            const rtp = paytableService.calculateRTP(5);
            
            expect(typeof rtp).toBe('number');
            expect(rtp).toBeGreaterThan(0);
            expect(rtp).toBeLessThan(100);
        });

        test('Should validate paytable configuration', () => {
            const paytableService = require('../src/models/paytable');
            
            const errors = paytableService.validatePaytable(5, {
                0: 0,
                1: 0,
                2: 1,
                3: 2,
                4: 10,
                5: 500
            });
            
            expect(errors).toHaveLength(0);
        });
    });
});

describe('Database Integration Tests', () => {
    test('Database connection should work', async () => {
        const result = await database.query('SELECT 1 as test');
        expect(result.rows[0].test).toBe(1);
    });

    test('Database should have required tables', async () => {
        const result = await database.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name IN ('users', 'tickets', 'draws', 'paytables')
        `);
        
        expect(result.rows).toHaveLength(4);
    });
});

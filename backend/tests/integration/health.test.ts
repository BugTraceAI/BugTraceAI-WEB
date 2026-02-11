import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../../src/index.js';

describe('Health Endpoints Integration Tests', () => {
  describe('GET /health', () => {
    it('should return status ok', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('ok');
    });

    it('should include timestamp and environment', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body.data.timestamp).toBeDefined();
      expect(response.body.data.environment).toBeDefined();
    });

    it('should include uptime', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body.data.uptime).toBeDefined();
      expect(typeof response.body.data.uptime).toBe('number');
    });
  });

  describe('GET /health/detailed', () => {
    it('should include database connection status', async () => {
      const response = await request(app)
        .get('/health/detailed')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.database).toBeDefined();
      expect(response.body.data.database.connected).toBeDefined();
    });

    it('should include database stats when connected', async () => {
      const response = await request(app)
        .get('/health/detailed')
        .expect(200);

      if (response.body.data.database.connected) {
        expect(response.body.data.database.stats).toBeDefined();
      }
    });

    it('should include memory usage', async () => {
      const response = await request(app)
        .get('/health/detailed')
        .expect(200);

      expect(response.body.data.memory).toBeDefined();
      expect(response.body.data.memory.heapUsed).toBeDefined();
      expect(response.body.data.memory.heapTotal).toBeDefined();
    });

    it('should include all basic health info', async () => {
      const response = await request(app)
        .get('/health/detailed')
        .expect(200);

      expect(response.body.data.status).toBe('ok');
      expect(response.body.data.timestamp).toBeDefined();
      expect(response.body.data.environment).toBeDefined();
      expect(response.body.data.uptime).toBeDefined();
    });
  });

  describe('GET /api/version', () => {
    it('should return version 2.0.0', async () => {
      const response = await request(app)
        .get('/api/version')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.version).toBe('2.0.0');
    });

    it('should return API name', async () => {
      const response = await request(app)
        .get('/api/version')
        .expect(200);

      expect(response.body.data.name).toBeDefined();
      expect(response.body.data.name).toContain('BugTraceAI');
    });

    it('should return API version', async () => {
      const response = await request(app)
        .get('/api/version')
        .expect(200);

      expect(response.body.data.apiVersion).toBeDefined();
    });
  });

  describe('GET /nonexistent', () => {
    it('should return 404 with JSON error', async () => {
      const response = await request(app)
        .get('/nonexistent')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
    });

    it('should include path in error', async () => {
      const response = await request(app)
        .get('/nonexistent')
        .expect(404);

      expect(response.body.error.path).toBe('/nonexistent');
      expect(response.body.error.message).toContain('not found');
    });
  });
});

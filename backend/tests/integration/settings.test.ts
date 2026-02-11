import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../src/index.js';
import { prisma } from '../../src/utils/prisma.js';

describe('Settings API Integration Tests', () => {
  const testKey = 'test_setting';

  beforeEach(async () => {
    // Clean up test setting
    await prisma.appSettings.deleteMany({
      where: { key: testKey }
    });
  });

  describe('GET /api/settings', () => {
    it('should get all settings', async () => {
      const response = await request(app)
        .get('/api/settings')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(typeof response.body.data).toBe('object');
    });

    it('should return all settings as key-value object', async () => {
      const response = await request(app)
        .get('/api/settings')
        .expect(200);

      // Should be an object, not an array
      expect(Array.isArray(response.body.data)).toBe(false);
      expect(typeof response.body.data).toBe('object');
    });

    it('should include seeded settings', async () => {
      const response = await request(app)
        .get('/api/settings')
        .expect(200);

      // Check for some default settings that should exist from seed
      expect(response.body.data).toBeDefined();
    });
  });

  describe('GET /api/settings/:key', () => {
    beforeEach(async () => {
      await prisma.appSettings.create({
        data: { key: testKey, value: { data: 'test' } }
      });
    });

    it('should get a specific setting', async () => {
      const response = await request(app)
        .get(`/api/settings/${testKey}`)
        .expect(200);

      expect(response.body.data.key).toBe(testKey);
      expect(response.body.data.value.data).toBe('test');
    });

    it('should return 404 for non-existent setting', async () => {
      await request(app)
        .get('/api/settings/nonexistent_key')
        .expect(404);
    });
  });

  describe('PUT /api/settings/:key', () => {
    it('should create a new setting', async () => {
      const response = await request(app)
        .put(`/api/settings/${testKey}`)
        .send({
          value: { test: true, number: 123 }
        })
        .expect(200);

      expect(response.body.data.key).toBe(testKey);
      expect(response.body.data.value.test).toBe(true);
    });

    it('should update existing setting', async () => {
      // Create initial setting
      await prisma.appSettings.create({
        data: { key: testKey, value: { initial: true } }
      });

      // Update it
      const response = await request(app)
        .put(`/api/settings/${testKey}`)
        .send({
          value: { updated: true }
        })
        .expect(200);

      expect(response.body.data.value.updated).toBe(true);
    });

    it('should require value in body', async () => {
      await request(app)
        .put(`/api/settings/${testKey}`)
        .send({})
        .expect(400);
    });
  });

  describe('DELETE /api/settings/:key', () => {
    beforeEach(async () => {
      await prisma.appSettings.create({
        data: { key: testKey, value: { data: 'test' } }
      });
    });

    it('should delete a setting', async () => {
      const response = await request(app)
        .delete(`/api/settings/${testKey}`)
        .expect(200);

      expect(response.body.data.deleted_key).toBe(testKey);

      // Verify deletion
      const deleted = await prisma.appSettings.findUnique({
        where: { key: testKey }
      });
      expect(deleted).toBeNull();
    });

    it('should return 404 for non-existent key', async () => {
      await request(app)
        .delete('/api/settings/nonexistent_key')
        .expect(404);
    });
  });

  describe('POST /api/settings/bulk', () => {
    it('should update multiple settings', async () => {
      const response = await request(app)
        .post('/api/settings/bulk')
        .send({
          settings: {
            test_setting_1: { value: 1 },
            test_setting_2: { value: 2 }
          }
        })
        .expect(200);

      expect(response.body.data.updated_count).toBe(2);

      // Verify settings were created
      const setting1 = await prisma.appSettings.findUnique({
        where: { key: 'test_setting_1' }
      });
      expect(setting1?.value).toEqual({ value: 1 });
    });

    it('should create settings that dont exist', async () => {
      const response = await request(app)
        .post('/api/settings/bulk')
        .send({
          settings: {
            test_new_setting: { new: true }
          }
        })
        .expect(200);

      expect(response.body.data.updated_count).toBe(1);

      const newSetting = await prisma.appSettings.findUnique({
        where: { key: 'test_new_setting' }
      });
      expect(newSetting).toBeDefined();
    });

    it('should require settings object', async () => {
      await request(app)
        .post('/api/settings/bulk')
        .send({})
        .expect(400);
    });
  });

  describe('POST /api/settings/reset', () => {
    it('should reset all settings to defaults', async () => {
      // Create some test settings
      await Promise.all([
        prisma.appSettings.create({ data: { key: 'test_reset_1', value: { test: 1 } } }),
        prisma.appSettings.create({ data: { key: 'test_reset_2', value: { test: 2 } } })
      ]);

      const response = await request(app)
        .post('/api/settings/reset')
        .expect(200);

      expect(response.body.data.reset_count).toBeGreaterThan(0);
    });

    it('should return reset count', async () => {
      const response = await request(app)
        .post('/api/settings/reset')
        .expect(200);

      expect(response.body.data.reset_count).toBeDefined();
      expect(typeof response.body.data.reset_count).toBe('number');
    });
  });
});

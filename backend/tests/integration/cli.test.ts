import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../src/index.js';
import { prisma } from '../../src/utils/prisma.js';

describe('CLI API Integration Tests', () => {
  let testReportId: string;
  const testReportPath = '/test/reports/cli-report-1.json';

  describe('POST /api/cli/reports', () => {
    it('should register CLI report', async () => {
      const response = await request(app)
        .post('/api/cli/reports')
        .send({
          report_path: testReportPath,
          target_url: 'https://test.example.com',
          scan_date: new Date().toISOString(),
          severity_summary: {
            critical: 1,
            high: 2,
            medium: 3,
            low: 4
          }
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.report_path).toBe(testReportPath);
      testReportId = response.body.data.id;
    });

    it('should reject duplicate report_path', async () => {
      // Create first report
      await prisma.cliReport.create({
        data: {
          reportPath: testReportPath
        }
      });

      // Try to create duplicate
      await request(app)
        .post('/api/cli/reports')
        .send({
          report_path: testReportPath
        })
        .expect(409);
    });

    it('should require report_path', async () => {
      await request(app)
        .post('/api/cli/reports')
        .send({
          target_url: 'https://test.example.com'
        })
        .expect(400);
    });

    it('should accept optional fields', async () => {
      const response = await request(app)
        .post('/api/cli/reports')
        .send({
          report_path: '/test/reports/optional-fields.json'
        })
        .expect(201);

      expect(response.body.data.report_path).toBe('/test/reports/optional-fields.json');
    });
  });

  describe('GET /api/cli/reports', () => {
    beforeEach(async () => {
      await Promise.all([
        prisma.cliReport.create({
          data: {
            reportPath: '/test/reports/report1.json',
            targetUrl: 'https://test1.example.com'
          }
        }),
        prisma.cliReport.create({
          data: {
            reportPath: '/test/reports/report2.json',
            targetUrl: 'https://test2.example.com'
          }
        })
      ]);
    });

    it('should list CLI reports', async () => {
      const response = await request(app)
        .get('/api/cli/reports')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data.results)).toBe(true);
      expect(response.body.data.results.length).toBeGreaterThan(0);
    });

    it('should support pagination', async () => {
      const response = await request(app)
        .get('/api/cli/reports?limit=1&offset=0')
        .expect(200);

      expect(response.body.data.results.length).toBeLessThanOrEqual(1);
      expect(response.body.data.pagination.limit).toBe(1);
      expect(response.body.data.pagination.offset).toBe(0);
    });
  });

  describe('GET /api/cli/reports/:reportId', () => {
    beforeEach(async () => {
      const report = await prisma.cliReport.create({
        data: {
          reportPath: '/test/reports/specific-report.json',
          targetUrl: 'https://specific.test.com'
        }
      });
      testReportId = report.id;
    });

    it('should return report metadata', async () => {
      const response = await request(app)
        .get(`/api/cli/reports/${testReportId}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(testReportId);
      expect(response.body.data.report_path).toContain('specific-report');
    });

    it('should return 404 for non-existent report', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      await request(app)
        .get(`/api/cli/reports/${fakeId}`)
        .expect(404);
    });

    it('should return 400 for invalid UUID', async () => {
      await request(app)
        .get('/api/cli/reports/invalid-uuid')
        .expect(400);
    });
  });

  describe('DELETE /api/cli/reports/:reportId', () => {
    beforeEach(async () => {
      const report = await prisma.cliReport.create({
        data: {
          reportPath: '/test/reports/delete-report.json'
        }
      });
      testReportId = report.id;
    });

    it('should delete report entry', async () => {
      const response = await request(app)
        .delete(`/api/cli/reports/${testReportId}`)
        .expect(200);

      expect(response.body.data.deleted_report_id).toBe(testReportId);

      // Verify deletion
      const deleted = await prisma.cliReport.findUnique({
        where: { id: testReportId }
      });
      expect(deleted).toBeNull();
    });

    it('should return 404 for non-existent report', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      await request(app)
        .delete(`/api/cli/reports/${fakeId}`)
        .expect(404);
    });
  });

  describe('POST /api/cli/sync', () => {
    it('should return stub response', async () => {
      const response = await request(app)
        .post('/api/cli/sync')
        .send({
          directory: '/test/reports'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toBeDefined();
    });

    it('should indicate Phase 4 implementation', async () => {
      const response = await request(app)
        .post('/api/cli/sync')
        .send({
          directory: '/test/reports'
        })
        .expect(200);

      expect(response.body.data.message).toContain('Phase 4');
    });
  });
});

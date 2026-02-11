import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../src/index.js';
import { prisma } from '../../src/utils/prisma.js';

describe('Analysis API Integration Tests', () => {
  let testReportId: string;

  describe('POST /api/analyses', () => {
    it('should create an analysis report', async () => {
      const response = await request(app)
        .post('/api/analyses')
        .send({
          analysis_type: 'url_analysis',
          target: 'https://test.example.com',
          vulnerabilities: {
            total: 2,
            items: [
              { severity: 'high', type: 'XSS' },
              { severity: 'medium', type: 'CSRF' }
            ]
          },
          metadata: {
            scanDuration: 5000,
            timestamp: new Date().toISOString()
          }
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.analysis_type).toBe('url_analysis');
      expect(response.body.data.target).toBe('https://test.example.com');
      testReportId = response.body.data.id;
    });

    it('should reject invalid analysis type', async () => {
      await request(app)
        .post('/api/analyses')
        .send({
          analysis_type: 'invalid_type',
          target: 'https://test.example.com',
          vulnerabilities: {}
        })
        .expect(400);
    });

    it('should require target and vulnerabilities', async () => {
      await request(app)
        .post('/api/analyses')
        .send({
          analysis_type: 'url_analysis'
        })
        .expect(400);
    });

    it('should accept all valid analysis types', async () => {
      const types = ['url_analysis', 'xss_test', 'sql_test'];

      for (const type of types) {
        const response = await request(app)
          .post('/api/analyses')
          .send({
            analysis_type: type,
            target: 'https://test.example.com',
            vulnerabilities: { total: 0, items: [] }
          })
          .expect(201);

        expect(response.body.data.analysis_type).toBe(type);
      }
    });
  });

  describe('GET /api/analyses', () => {
    beforeEach(async () => {
      await prisma.analysisReport.create({
        data: {
          analysisType: 'url_analysis',
          target: 'https://test.example.com/test1',
          vulnerabilities: { total: 1, items: [] }
        }
      });
    });

    it('should list analysis reports', async () => {
      const response = await request(app)
        .get('/api/analyses')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data.results)).toBe(true);
      expect(response.body.data.pagination).toBeDefined();
    });

    it('should filter by analysis type', async () => {
      const response = await request(app)
        .get('/api/analyses?analysis_type=url_analysis')
        .expect(200);

      const results = response.body.data.results;
      results.forEach((report: any) => {
        expect(report.analysis_type).toBe('url_analysis');
      });
    });

    it('should filter by target (partial match)', async () => {
      const response = await request(app)
        .get('/api/analyses?target=test.example.com')
        .expect(200);

      const results = response.body.data.results;
      results.forEach((report: any) => {
        expect(report.target).toContain('test.example.com');
      });
    });

    it('should support pagination', async () => {
      const response = await request(app)
        .get('/api/analyses?limit=5&offset=0')
        .expect(200);

      expect(response.body.data.results.length).toBeLessThanOrEqual(5);
      expect(response.body.data.pagination.limit).toBe(5);
      expect(response.body.data.pagination.offset).toBe(0);
    });
  });

  describe('GET /api/analyses/:reportId', () => {
    beforeEach(async () => {
      const report = await prisma.analysisReport.create({
        data: {
          analysisType: 'url_analysis',
          target: 'https://test.example.com/specific',
          vulnerabilities: { total: 0, items: [] }
        }
      });
      testReportId = report.id;
    });

    it('should return specific report', async () => {
      const response = await request(app)
        .get(`/api/analyses/${testReportId}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(testReportId);
      expect(response.body.data.target).toContain('specific');
    });

    it('should return 404 for non-existent report', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      await request(app)
        .get(`/api/analyses/${fakeId}`)
        .expect(404);
    });

    it('should return 400 for invalid UUID', async () => {
      await request(app)
        .get('/api/analyses/invalid-uuid')
        .expect(400);
    });
  });

  describe('DELETE /api/analyses/:reportId', () => {
    beforeEach(async () => {
      const report = await prisma.analysisReport.create({
        data: {
          analysisType: 'url_analysis',
          target: 'https://test.example.com/delete',
          vulnerabilities: { total: 0, items: [] }
        }
      });
      testReportId = report.id;
    });

    it('should delete report', async () => {
      const response = await request(app)
        .delete(`/api/analyses/${testReportId}`)
        .expect(200);

      expect(response.body.data.deleted_report_id).toBe(testReportId);

      // Verify deletion
      const deleted = await prisma.analysisReport.findUnique({
        where: { id: testReportId }
      });
      expect(deleted).toBeNull();
    });

    it('should return 404 for non-existent report', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      await request(app)
        .delete(`/api/analyses/${fakeId}`)
        .expect(404);
    });
  });

  describe('GET /api/analyses/stats', () => {
    beforeEach(async () => {
      await Promise.all([
        prisma.analysisReport.create({
          data: {
            analysisType: 'url_analysis',
            target: 'https://test.example.com/stats1',
            vulnerabilities: { total: 0, items: [] }
          }
        }),
        prisma.analysisReport.create({
          data: {
            analysisType: 'code_analysis',
            target: 'https://test.example.com/stats2',
            vulnerabilities: { total: 0, items: [] }
          }
        })
      ]);
    });

    it('should return report statistics', async () => {
      const response = await request(app)
        .get('/api/analyses/stats')
        .expect(200);

      expect(response.body.data.total_reports).toBeDefined();
      expect(response.body.data.total_reports).toBeGreaterThan(0);
    });

    it('should include type breakdown', async () => {
      const response = await request(app)
        .get('/api/analyses/stats')
        .expect(200);

      expect(response.body.data.reports_by_type).toBeDefined();
      expect(typeof response.body.data.reports_by_type).toBe('object');
    });
  });
});

import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../src/index.js';
import { prisma } from '../../src/utils/prisma.js';

describe('Chat API Integration Tests', () => {
  let testSessionId: string;
  let testMessageId: string;

  beforeEach(async () => {
    // Create a test session for use in tests
    const session = await prisma.chatSession.create({
      data: {
        sessionType: 'websec',
        title: 'TEST Session for Integration'
      }
    });
    testSessionId = session.id;
  });

  describe('POST /api/chats', () => {
    it('should create a new chat session', async () => {
      const response = await request(app)
        .post('/api/chats')
        .send({
          session_type: 'websec',
          title: 'TEST New Chat Session'
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.session_type).toBe('websec');
      expect(response.body.data.title).toBe('TEST New Chat Session');
      expect(response.body.data.id).toBeDefined();
      expect(response.body.timestamp).toBeDefined();
    });

    it('should reject invalid session type', async () => {
      const response = await request(app)
        .post('/api/chats')
        .send({
          session_type: 'invalid_type',
          title: 'TEST Invalid'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
    });

    it('should auto-generate title if not provided', async () => {
      const response = await request(app)
        .post('/api/chats')
        .send({
          session_type: 'xss'
        })
        .expect(201);

      expect(response.body.data.title).toContain('XSS');
    });

    it('should accept all valid session types', async () => {
      const types = ['websec', 'xss', 'sql'];

      for (const type of types) {
        const response = await request(app)
          .post('/api/chats')
          .send({
            session_type: type,
            title: `TEST ${type} session`
          })
          .expect(201);

        expect(response.body.data.session_type).toBe(type);
      }
    });
  });

  describe('GET /api/chats', () => {
    it('should list all chat sessions', async () => {
      const response = await request(app)
        .get('/api/chats')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data.results)).toBe(true);
      expect(response.body.data.pagination).toBeDefined();
      expect(response.body.data.pagination.total).toBeGreaterThan(0);
    });

    it('should support pagination', async () => {
      const response = await request(app)
        .get('/api/chats?limit=5&offset=0')
        .expect(200);

      expect(response.body.data.results.length).toBeLessThanOrEqual(5);
      expect(response.body.data.pagination.limit).toBe(5);
      expect(response.body.data.pagination.offset).toBe(0);
    });

    it('should filter by session type', async () => {
      const response = await request(app)
        .get('/api/chats?session_type=websec')
        .expect(200);

      const results = response.body.data.results;
      results.forEach((session: any) => {
        expect(session.session_type).toBe('websec');
      });
    });

    it('should exclude archived by default', async () => {
      // Archive the test session
      await prisma.chatSession.update({
        where: { id: testSessionId },
        data: { isArchived: true }
      });

      const response = await request(app)
        .get('/api/chats')
        .expect(200);

      const foundArchived = response.body.data.results.some(
        (s: any) => s.id === testSessionId
      );
      expect(foundArchived).toBe(false);
    });

    it('should include archived when requested', async () => {
      await prisma.chatSession.update({
        where: { id: testSessionId },
        data: { isArchived: true }
      });

      const response = await request(app)
        .get('/api/chats?include_archived=true')
        .expect(200);

      const foundArchived = response.body.data.results.some(
        (s: any) => s.id === testSessionId
      );
      expect(foundArchived).toBe(true);
    });

    it('should respect limit and offset parameters', async () => {
      // Create multiple test sessions
      await Promise.all([
        prisma.chatSession.create({ data: { sessionType: 'websec', title: 'TEST Session 1' } }),
        prisma.chatSession.create({ data: { sessionType: 'websec', title: 'TEST Session 2' } }),
        prisma.chatSession.create({ data: { sessionType: 'websec', title: 'TEST Session 3' } })
      ]);

      const response = await request(app)
        .get('/api/chats?limit=2&offset=1')
        .expect(200);

      expect(response.body.data.results.length).toBeLessThanOrEqual(2);
      expect(response.body.data.pagination.offset).toBe(1);
    });
  });

  describe('GET /api/chats/:sessionId', () => {
    it('should return specific session with message count', async () => {
      const response = await request(app)
        .get(`/api/chats/${testSessionId}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(testSessionId);
      expect(response.body.data.session_type).toBe('websec');
      expect(response.body.data.message_count).toBeDefined();
    });

    it('should return 404 for non-existent session', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const response = await request(app)
        .get(`/api/chats/${fakeId}`)
        .expect(404);

      expect(response.body.success).toBe(false);
    });

    it('should return 400 for invalid UUID format', async () => {
      const response = await request(app)
        .get('/api/chats/invalid-uuid')
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('PATCH /api/chats/:sessionId', () => {
    it('should update session title', async () => {
      const response = await request(app)
        .patch(`/api/chats/${testSessionId}`)
        .send({ title: 'TEST Updated Title' })
        .expect(200);

      expect(response.body.data.title).toBe('TEST Updated Title');
    });

    it('should archive session', async () => {
      const response = await request(app)
        .patch(`/api/chats/${testSessionId}`)
        .send({ is_archived: true })
        .expect(200);

      expect(response.body.data.is_archived).toBe(true);
    });

    it('should unarchive session', async () => {
      // First archive it
      await prisma.chatSession.update({
        where: { id: testSessionId },
        data: { isArchived: true }
      });

      const response = await request(app)
        .patch(`/api/chats/${testSessionId}`)
        .send({ is_archived: false })
        .expect(200);

      expect(response.body.data.is_archived).toBe(false);
    });

    it('should return 404 for non-existent session', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      await request(app)
        .patch(`/api/chats/${fakeId}`)
        .send({ title: 'New Title' })
        .expect(404);
    });
  });

  describe('DELETE /api/chats/:sessionId', () => {
    it('should delete session and cascade delete messages', async () => {
      // Create a message first
      await prisma.chatMessage.create({
        data: {
          sessionId: testSessionId,
          role: 'user',
          content: 'Test message'
        }
      });

      const response = await request(app)
        .delete(`/api/chats/${testSessionId}`)
        .expect(200);

      expect(response.body.data.success).toBe(true);
      expect(response.body.data.deleted_messages).toBe(1);

      // Verify deletion
      const deletedSession = await prisma.chatSession.findUnique({
        where: { id: testSessionId }
      });
      expect(deletedSession).toBeNull();
    });

    it('should return 404 for non-existent session', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      await request(app)
        .delete(`/api/chats/${fakeId}`)
        .expect(404);
    });

    it('should return deleted message count', async () => {
      // Create multiple messages
      await Promise.all([
        prisma.chatMessage.create({ data: { sessionId: testSessionId, role: 'user', content: 'Msg 1' } }),
        prisma.chatMessage.create({ data: { sessionId: testSessionId, role: 'assistant', content: 'Msg 2' } }),
        prisma.chatMessage.create({ data: { sessionId: testSessionId, role: 'user', content: 'Msg 3' } })
      ]);

      const response = await request(app)
        .delete(`/api/chats/${testSessionId}`)
        .expect(200);

      expect(response.body.data.deleted_messages).toBe(3);
    });
  });

  describe('GET /api/chats/search', () => {
    beforeEach(async () => {
      // Create searchable messages
      await prisma.chatMessage.create({
        data: {
          sessionId: testSessionId,
          role: 'user',
          content: 'This is a searchable test message with keyword FINDME'
        }
      });
    });

    it('should search messages by content', async () => {
      const response = await request(app)
        .get('/api/chats/search?q=FINDME')
        .expect(200);

      expect(response.body.data.results.length).toBeGreaterThan(0);
      expect(response.body.data.query).toBe('FINDME');
    });

    it('should return 400 when query missing', async () => {
      const response = await request(app)
        .get('/api/chats/search')
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should group results by session', async () => {
      await prisma.chatMessage.create({
        data: {
          sessionId: testSessionId,
          role: 'assistant',
          content: 'Another FINDME message'
        }
      });

      const response = await request(app)
        .get('/api/chats/search?q=FINDME')
        .expect(200);

      expect(response.body.data.results.length).toBeGreaterThan(0);
      const result = response.body.data.results[0];
      expect(result.session_id).toBeDefined();
      expect(result.match_count).toBeGreaterThan(0);
    });

    it('should exclude archived sessions', async () => {
      // Archive the session with searchable content
      await prisma.chatSession.update({
        where: { id: testSessionId },
        data: { isArchived: true }
      });

      const response = await request(app)
        .get('/api/chats/search?q=FINDME')
        .expect(200);

      const foundArchived = response.body.data.results.some(
        (r: any) => r.session_id === testSessionId
      );
      expect(foundArchived).toBe(false);
    });
  });

  describe('GET /api/chats/stats', () => {
    it('should return total, active, archived counts', async () => {
      const response = await request(app)
        .get('/api/chats/stats')
        .expect(200);

      expect(response.body.data.total_sessions).toBeGreaterThan(0);
      expect(response.body.data.active_sessions).toBeDefined();
      expect(response.body.data.archived_sessions).toBeDefined();
    });

    it('should return sessions by type breakdown', async () => {
      const response = await request(app)
        .get('/api/chats/stats')
        .expect(200);

      expect(response.body.data.sessions_by_type).toBeDefined();
      expect(typeof response.body.data.sessions_by_type).toBe('object');
    });
  });

  describe('POST /api/chats/:sessionId/messages', () => {
    it('should create message with valid data', async () => {
      const response = await request(app)
        .post(`/api/chats/${testSessionId}/messages`)
        .send({
          role: 'user',
          content: 'TEST message content'
        })
        .expect(201);

      expect(response.body.data.role).toBe('user');
      expect(response.body.data.content).toBe('TEST message content');
      testMessageId = response.body.data.id;
    });

    it('should reject invalid role', async () => {
      await request(app)
        .post(`/api/chats/${testSessionId}/messages`)
        .send({
          role: 'invalid',
          content: 'Test'
        })
        .expect(400);
    });

    it('should reject empty content', async () => {
      await request(app)
        .post(`/api/chats/${testSessionId}/messages`)
        .send({
          role: 'user',
          content: ''
        })
        .expect(400);
    });

    it('should return 404 for non-existent session', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      await request(app)
        .post(`/api/chats/${fakeId}/messages`)
        .send({
          role: 'user',
          content: 'Test message'
        })
        .expect(404);
    });

    it('should update session updatedAt timestamp', async () => {
      const beforeUpdate = await prisma.chatSession.findUnique({
        where: { id: testSessionId }
      });

      // Wait a moment to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 100));

      await request(app)
        .post(`/api/chats/${testSessionId}/messages`)
        .send({
          role: 'user',
          content: 'TEST Update timestamp'
        })
        .expect(201);

      const afterUpdate = await prisma.chatSession.findUnique({
        where: { id: testSessionId }
      });

      expect(afterUpdate?.updatedAt.getTime()).toBeGreaterThan(beforeUpdate?.updatedAt.getTime() || 0);
    });
  });

  describe('GET /api/chats/:sessionId/messages', () => {
    beforeEach(async () => {
      await prisma.chatMessage.createMany({
        data: [
          { sessionId: testSessionId, role: 'user', content: 'Message 1' },
          { sessionId: testSessionId, role: 'assistant', content: 'Message 2' }
        ]
      });
    });

    it('should list messages for a session', async () => {
      const response = await request(app)
        .get(`/api/chats/${testSessionId}/messages`)
        .expect(200);

      expect(response.body.data.results.length).toBe(2);
      expect(response.body.data.pagination.total).toBe(2);
    });

    it('should order messages by createdAt asc', async () => {
      const response = await request(app)
        .get(`/api/chats/${testSessionId}/messages`)
        .expect(200);

      const messages = response.body.data.results;
      expect(messages[0].content).toBe('Message 1');
      expect(messages[1].content).toBe('Message 2');
    });

    it('should respect pagination parameters', async () => {
      const response = await request(app)
        .get(`/api/chats/${testSessionId}/messages?limit=1&offset=0`)
        .expect(200);

      expect(response.body.data.results.length).toBe(1);
      expect(response.body.data.pagination.limit).toBe(1);
    });

    it('should return 404 for non-existent session', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      await request(app)
        .get(`/api/chats/${fakeId}/messages`)
        .expect(404);
    });
  });

  describe('POST /api/chats/:sessionId/messages/bulk', () => {
    it('should create multiple messages', async () => {
      const response = await request(app)
        .post(`/api/chats/${testSessionId}/messages/bulk`)
        .send({
          messages: [
            { role: 'user', content: 'Bulk message 1' },
            { role: 'assistant', content: 'Bulk message 2' },
            { role: 'user', content: 'Bulk message 3' }
          ]
        })
        .expect(201);

      expect(response.body.data.created_count).toBe(3);
    });

    it('should validate each message', async () => {
      await request(app)
        .post(`/api/chats/${testSessionId}/messages/bulk`)
        .send({
          messages: [
            { role: 'user', content: 'Valid message' },
            { role: 'invalid_role', content: 'Invalid message' }
          ]
        })
        .expect(400);
    });

    it('should reject more than 100 messages', async () => {
      const messages = Array.from({ length: 101 }, (_, i) => ({
        role: 'user',
        content: `Message ${i + 1}`
      }));

      await request(app)
        .post(`/api/chats/${testSessionId}/messages/bulk`)
        .send({ messages })
        .expect(400);
    });
  });

  describe('DELETE /api/chats/:sessionId/messages/:messageId', () => {
    beforeEach(async () => {
      const message = await prisma.chatMessage.create({
        data: {
          sessionId: testSessionId,
          role: 'user',
          content: 'Message to delete'
        }
      });
      testMessageId = message.id;
    });

    it('should delete specific message', async () => {
      const response = await request(app)
        .delete(`/api/chats/${testSessionId}/messages/${testMessageId}`)
        .expect(200);

      expect(response.body.data.deleted_message_id).toBe(testMessageId);

      // Verify deletion
      const deleted = await prisma.chatMessage.findUnique({
        where: { id: testMessageId }
      });
      expect(deleted).toBeNull();
    });

    it('should return 404 if message not in session', async () => {
      // Create another session
      const otherSession = await prisma.chatSession.create({
        data: { sessionType: 'websec', title: 'TEST Other Session' }
      });

      await request(app)
        .delete(`/api/chats/${otherSession.id}/messages/${testMessageId}`)
        .expect(404);
    });
  });
});

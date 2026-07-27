import { Server as HTTPServer } from 'http';
import { Server } from 'socket.io';

let io: Server | null = null;

export function initializeWebSocket(httpServer: HTTPServer): Server {
  io = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        const allowed = origin.includes('localhost')
          || origin.includes('127.0.0.1')
          || /^https?:\/\/(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.)/.test(origin)
          || origin === (process.env.FRONTEND_URL || 'http://localhost:5173');
        callback(null, allowed);
      },
      methods: ['GET', 'POST'],
      credentials: true,
    },
    path: '/socket.io/',
  });

  // Note: Scan namespace removed in Phase 4 (Frontend Migration).
  // Real-time scan events now stream via CLI FastAPI native WebSocket.
  // Socket.IO server kept for future WEB-specific WebSocket features.

  console.log('WebSocket server initialized');
  return io;
}

export function getIO(): Server {
  if (!io) {
    throw new Error('WebSocket server not initialized');
  }
  return io;
}

export { io };

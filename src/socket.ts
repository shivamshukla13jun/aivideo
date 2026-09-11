import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';

let io: SocketIOServer | null = null;

export function initSocket(server: HTTPServer): SocketIOServer {
  io = new SocketIOServer(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
      credentials: false,
    },
    path: '/socket.io',
  });

  io.on('connection', (socket) => {
    console.log(`[Socket.IO] Client connected: ${socket.id}`);

    socket.on('disconnect', (reason) => {
      console.log(`[Socket.IO] Client disconnected: ${socket.id} (${reason})`);
    });
  });

  return io;
}

export function getIO(): SocketIOServer | null {
  return io;
}

export function emitProgress(
  target: string | undefined,
  data: { step: string; message: string; percent: number; [key: string]: any }
) {
  if (!io) return;
  if (target && io.sockets && io.sockets.sockets.has(target)) {
    io.to(target).emit('generation_progress', data);
  } else {
    io.emit('generation_progress', data);
  }
}


import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(window.location.origin, {
      reconnectionAttempts: 5,
      timeout: 10000
    });

    socket.on('connect', () => {
      console.log('[SocketService] Connected to server, socketId:', socket?.id);
    });

    socket.on('disconnect', () => {
      console.log('[SocketService] Disconnected from server');
    });
  }
  return socket;
}

export function joinRoom(roomId: string) {
  const s = getSocket();
  s.emit('join-room', roomId);
}

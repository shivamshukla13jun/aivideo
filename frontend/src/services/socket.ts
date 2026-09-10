import { io, Socket } from 'socket.io-client';

let socketInstance: Socket | null = null;

export interface GenerationProgressData {
  step: string;
  message: string;
  percent: number;
  mangaId?: string | number;
  chapterId?: string | number;
  streamSnippet?: string;
  accumulatedLength?: number;
  [key: string]: any;
}


/**
 * Singleton Socket.IO Client for Real-Time Generation Updates
 */
export function getSocket(): Socket {
  if (!socketInstance) {
    socketInstance = io({
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 15,
      reconnectionDelay: 1000,
    });

    socketInstance.on('connect', () => {
      console.log('[Socket.IO] Connected to backend! Socket ID:', socketInstance?.id);
    });

    socketInstance.on('disconnect', (reason) => {
      console.log('[Socket.IO] Disconnected from backend:', reason);
    });

    socketInstance.on('connect_error', (error) => {
      console.warn('[Socket.IO] Connection error:', error.message);
    });
  }

  if (!socketInstance.connected) {
    socketInstance.connect();
  }

  return socketInstance;
}

/**
 * Get the current active Socket ID to pass in API payloads
 */
export function getSocketId(): string | undefined {
  const socket = getSocket();
  return socket.id;
}

/**
 * Subscribe to real-time Gemini generation progress updates
 */
export function subscribeToGenerationProgress(
  callback: (data: GenerationProgressData) => void
): () => void {
  const socket = getSocket();

  const handler = (data: GenerationProgressData) => {
    console.log('[Socket.IO Progress]', data);
    callback(data);
  };

  socket.on('generation_progress', handler);

  return () => {
    socket.off('generation_progress', handler);
  };
}

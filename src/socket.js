import { io } from 'socket.io-client';

// Prefer explicit WS URL, then API URL, then localhost
const SOCKET_URL =
  import.meta.env.VITE_BACKEND_WS ||
  import.meta.env.VITE_API_URL ||
  'http://localhost:5050';

export const socket = io(SOCKET_URL, {
  transports: ['websocket'],
  autoConnect: false,
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
});

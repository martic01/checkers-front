import { io } from "socket.io-client";
import { API_BASE_URL } from "./client.js";

let socket = null;

export function getSocket() {
  if (!socket) {
    socket = io(API_BASE_URL, { autoConnect: false });
  }
  return socket;
}

export function connectSocket() {
  const s = getSocket();
  if (!s.connected) s.connect();
  return s;
}

export function disconnectSocket() {
  if (socket?.connected) socket.disconnect();
}

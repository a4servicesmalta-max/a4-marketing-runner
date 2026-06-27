/** Provide a global WebSocket for supabase-js realtime on Node < 22. */
import WebSocket from "ws";
if (!(globalThis as any).WebSocket) {
  (globalThis as any).WebSocket = WebSocket;
}

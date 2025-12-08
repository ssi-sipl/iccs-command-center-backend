// socket.js
import { Server } from "socket.io";

let io;

/**
 * Initialize Socket.IO with an HTTP server
 */
function initSocket(server) {
  io = new Server(server, {
    cors: {
      origin: process.env.FRONTEND_ORIGIN || "http://localhost:3000",
      methods: ["GET", "POST"],
    },
  });

  io.on("connection", (socket) => {
    console.log("🔌 Client connected:", socket.id);

    socket.on("disconnect", () => {
      console.log("❌ Client disconnected:", socket.id);
    });
  });

  return io;
}

/**
 * Get the initialized io instance
 */
function getIo() {
  if (!io) {
    throw new Error(
      "Socket.io not initialized. Call initSocket(server) first."
    );
  }
  return io;
}

export { initSocket, getIo };

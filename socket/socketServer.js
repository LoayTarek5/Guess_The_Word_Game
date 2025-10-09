import { Server } from "socket.io";
import { authenticateSocket } from "./socketAuth.js";
import { setupRoomHandlers } from "./handlers/roomHandler.js";
import {
  setupUserStatusHandlers,
  broadcastUserStatus,
} from "./handlers/userStatusHandler.js";
import { setupNotificationHandlers } from "./handlers/notificationHandler.js";
import { setupChatHandlers } from "./handlers/chatHandler.js";

import User from "../models/User.js";

let io;
const userSocketMap = new Map();

export const initializeSocket = async (server) => {
  io = new Server(server, {
    cors: {
      origin: process.env.CLIENT_URL || "http://localhost:8000",
      credentials: true,
    },
  });

  io.use(authenticateSocket);

  io.on("connection", (socket) => {
    console.log("New client connected:", socket.id, "User:", socket.userId);

    userSocketMap.set(socket.userId, socket.id);
    socket.join(`user:${socket.userId}`);

    // Update user status to online
    updateUserStatus(socket.userId, "online");
    broadcastUserStatus(socket.userId, "online");

    // Setup all event handlers
    setupRoomHandlers(socket);
    setupUserStatusHandlers(socket);
    setupNotificationHandlers(socket);
    setupChatHandlers(socket);

    socket.on("disconnect", () => {
      console.log("Client disconnected:", socket.id);
      userSocketMap.delete(socket.userId);

      // Update user status to offline
      updateUserStatus(socket.userId, "offline");
      broadcastUserStatus(socket.userId, "offline");
    });
  });

  return io;
};

export const getIO = () => {
  if (!io) {
    throw new Error("Socket.io not initialized!");
  }
  return io;
};

export const getUserSocketId = (userId) => {
  return userSocketMap.get(userId.toString());
};

export const isUserOnline = (userId) => {
  return userSocketMap.has(userId.toString());
};

async function updateUserStatus(userId, status) {
  try {
    await User.findByIdAndUpdate(userId, {
      status,
      lastSeen: new Date(),
    });
  } catch (error) {
    console.error("Error updating user status:", error);
  }
}

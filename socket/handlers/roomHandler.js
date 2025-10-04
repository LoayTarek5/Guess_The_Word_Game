import { getIO, getUserSocketId } from "../socketServer.js";
export const setupRoomHandlers = (socket) => {
  socket.on("room:join", async (roomId) => {
    try {
      socket.join(`room:${roomId}`);
      console.log(`User ${socket.userId} joined room channel: ${roomId}`);
    } catch (error) {
      console.error("Error joining room channel:", error);
    }
  });

  socket.on("room:leave", async (roomId) => {
    try {
      socket.leave(`room:${roomId}`);
      console.log(`User ${socket.userId} left room channel: ${roomId}`);
    } catch (error) {
      console.error("Error leaving room channel:", error);
    }
  });
};

export const emitPlayerJoined = (roomId, playerData) => {
  const io = getIO();
  io.to(`room:${roomId}`).emit("room:playerJoined", playerData);
};

export const emitPlayerLeft = (roomId, data) => {
  const io = getIO();
  io.to(`room:${roomId}`).emit("room:playerLeft", data);
};

export const emitRoomSettingsUpdate = (roomId, settings, updatedBy) => {
  const io = getIO();
  io.to(`room:${roomId}`).emit("room:settingsUpdated", {
    settings,
    updatedBy,
  });
};

export const emitRoomStatusChange = (roomId, newStatus) => {
  const io = getIO();
  io.to(`room:${roomId}`).emit("room:statusChanged", {
    status: newStatus,
  });
};

export const emitRoomInvitation = (userIds, invitationData) => {
  const io = getIO();
  userIds.forEach((userId) => {
    const socketId = getUserSocketId(userId);
    if (socketId) {
      io.to(socketId).emit("room:invitation", invitationData);
    }
  });
};

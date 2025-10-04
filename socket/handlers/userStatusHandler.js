import { getIO, getUserSocketId } from "../socketServer.js";
import User from "../../models/User.js";
import Friendship from "../../models/User.js";

export const setupUserStatusHandlers = (socket) => {
  socket.on("user:offline", async () => {
    try {
      await updateUserStatus(socket.userId, "offline");
      broadcastUserStatus(socket.userId, "offline");
    } catch (error) {
      console.error("Error setting user offline:", error);
    }
  });

  socket.on("user:online", async () => {
    try {
      await updateUserStatus(socket.userId, "online");
      broadcastUserStatus(socket.userId, "online");
    } catch (error) {
      console.error("Error setting user online:", error);
    }
  });
};

export const broadcastUserStatus = async (userId, status) => {
  try {
    const io = getIO();
    const friendships = await Friendship.find({
      status: "accepted",
      $or: [{ requester: userId }, { recipient: userId }],
    });

    const friendIds = friendships.map((friend) => {
      friend.requester.toString() == userId
        ? friend.recipient.toString()
        : friend.requester.toString();
    });

    friendIds.forEach((friendId) => {
      const socketId = getUserSocketId(friendId);
      if (socketId) {
        io.to(socketId).emit("friend:statusUpdate", {
          userId,
          status,
          lastSeen: new Date(),
        });
      }
    });
  } catch (error) {
    console.error("Error broadcasting user status:", error);
  }
};

async function updateUserStatus(userId, status) {
  await User.findByIdAndUpdate(userId, {
    status,
    lastSeen: new Date(),
  });
}


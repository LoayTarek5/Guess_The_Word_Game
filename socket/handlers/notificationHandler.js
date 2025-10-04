import { getIO } from "../socketServer.js";
import Notification from "../../models/Notification.js";

export const setupNotificationHandlers = (socket) => {
  socket.on("notification:markRead", async (notificationId) => {
    try {
      const notification = await Notification.findOneAndUpdate(
        { _id: notificationId, recipient: socket.userId },
        { isRead: true, readAt: new Date() },
        { new: true }
      );
      if (notification) {
        await emitNotificationStats(socket.userId);
      }
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  });

  socket.on("notification:requestStats", async () => {
    await emitNotificationStats(socket.userId);
  });
};

export const emitNotificationToUser = (userId, notification) => {
  const io = getIO();
  io.to(`user:${userId}`).emit("notification:new", notification);
};

export const emitNotificationUpdate = (userId, notificationId, update) => {
  const io = getIO();
  io.to(`user:${userId}`).emit("notification:update", {
    notificationId,
    update,
  });
};

export const emitNotificationDelete = (userId, notificationId) => {
  const io = getIO();
  io.to(`user:${userId}`).emit("notification:delete", {
    notificationId,
  });
};

export const emitNotificationStats = async (userId) => {
  try {
    const stats = await getNotificationStats(userId);
    const io = getIO();
    io.to(`user:${userId}`).emit("notification:stats", stats);
  } catch (error) {
    console.error("Error emitting notification stats:", error);
  }
};

async function getNotificationStats(userId) {
  const [total, unread, friendRequests, gameInvites] = await Promise.all([
    Notification.countDocuments({ recipient: userId }),
    Notification.countDocuments({ recipient: userId, isRead: false }),
    Notification.countDocuments({
      recipient: userId,
      type: "friend_request",
      isRead: false,
    }),
    Notification.countDocuments({
      recipient: userId,
      type: { $in: ["game_invitation", "room_invitation"] },
      isRead: false,
    }),
  ]);

  return { total, unread, friendRequests, gameInvites };
}

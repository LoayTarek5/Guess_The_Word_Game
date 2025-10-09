import { getIO, getUserSocketId } from "../socketServer.js";
import ChatMessage from "../../models/ChatMessage.js";
import Room from "../../models/Room.js";
import Game from "../../models/Games.js";
import Friendship from "../../models/Friendship.js";

export default function setupChatHandler(socket) {
  socket.on("chat:sendMessage", async (data) => {
    try {
      const { roomId, gameId, friendshipId, message, type = "text" } = data;
      const userId = socket.userId;
      if (!message || message.trim().length === 0) {
        return socket.emit("chat:error", {
          message: "Message cannot be empty",
        });
      }
      if (message.length > 500) {
        return socket.emit("chat:error", {
          message: "Message too long (max 500 characters)",
        });
      }
      // Determine chat context
      let chatType;
      let contextRef = {};
      let broadcastRoom;
      if (roomId) {
        const room = Room.findOne({ roomId }).populate(
          "players.user",
          "username avatar"
        );

        if (!room) {
          return socket.emit("chat:error", { message: "Room not found" });
        }
        const inRoom = room.players.some(
          (player) => player.user._id.toString() === userId.toString()
        );
        if (!inRoom) {
          return socket.emit("chat:error", {
            message: "You are not in this room",
          });
        }
        chatType = "room";
        contextRef = { room: room._id };
        broadcastRoom = `room:${roomId}`;
      } else if (gameId) {
        const game = await Game.findById(gameId).populate(
          "players.user",
          "username avatar"
        );
        if (!game) {
          return socket.emit("chat:error", { message: "Game not found" });
        }

        // Verify user is in game
        const isInGame = game.players.some(
          (p) => p.user._id.toString() === userId.toString()
        );
        if (!isInGame) {
          return socket.emit("chat:error", {
            message: "You are not in this game",
          });
        }

        chatType = "game";
        contextRef = { game: game._id };
        broadcastRoom = `game:${gameId}`;
      } else if (friendshipId) {
        const friendship = await Friendship.findById(friendshipId);
        if (!friendship || friendship.status !== "accepted") {
          return socket.emit("chat:error", {
            message: "Friendship not found or not accepted",
          });
        }

        const isParticipant =
          friendship.requester.toString() === userId.toString() ||
          friendship.recipient.toString() === userId.toString();

        if (!isParticipant) {
          return socket.emit("chat:error", {
            message: "You are not part of this friendship",
          });
        }
        chatType = "direct";
        contextRef = { friendship: friendship._id };
        const otherUserId =
          friendship.requester.toString() === userId.toString()
            ? friendship.recipient
            : friendship.requester;
        broadcastRoom = `user:${otherUserId}`;
      } else {
        return socket.emit("chat:error", { message: "Invalid chat context" });
      }
      const chatMessage = new ChatMessage({
        sender: userId,
        message: message.trim(),
        type,
        chatType,
        ...contextRef,
        timestamp: Date.now(),
      });

      await chatMessage.save();

      // Populate sender info
      await chatMessage.populate("sender", "username avatar");

      // Prepare message data for broadcast
      const messageData = {
        _id: chatMessage._id,
        userId: chatMessage.sender._id,
        username: chatMessage.sender.username,
        avatar: chatMessage.sender.avatar,
        message: chatMessage.message,
        type: chatMessage.type,
        chatType: chatMessage.chatType,
        timestamp: chatMessage.timestamp,
      };

      // Broadcast to room/game/direct
      const io = getIO();

      if (chatType === "direct") {
        // Send to both users in direct chat
        io.to(broadcastRoom).emit("chat:newMessage", messageData);
        io.to(`user:${userId}`).emit("chat:newMessage", messageData);
      } else {
        // Broadcast to room or game
        io.to(broadcastRoom).emit("chat:newMessage", messageData);
      }

      // Send confirmation to sender
      socket.emit("chat:messageSent", {
        success: true,
        messageId: chatMessage._id,
      });
    } catch (error) {
      console.error("Error sending message:", error);
      socket.emit("chat:error", { message: "Failed to send message" });
    }
  });

  socket.on("chat:loadHistory", async (data) => {
    try {
      const { roomId, gameId, friendshipId, limit = 50, before } = data;
      const userId = socket.userId;

      let query = {};
      let accessGranted = false;

      if (roomId) {
        const room = await Room.findOne({ roomId });
        if (!room) {
          return socket.emit("chat:error", { message: "Room not found" });
        }

        accessGranted = room.players.some(
          (p) => p.user.toString() === userId.toString()
        );
        query = { room: room._id, chatType: "room" };
      } else if (gameId) {
        const game = await Game.findById(gameId);
        if (!game) {
          return socket.emit("chat:error", { message: "Game not found" });
        }

        accessGranted = game.players.some(
          (p) => p.user.toString() === userId.toString()
        );
        query = { game: game._id, chatType: "game" };
      } else if (friendshipId) {
        const friendship = await Friendship.findById(friendshipId);
        if (!friendship || friendship.status !== "accepted") {
          return socket.emit("chat:error", { message: "Friendship not found" });
        }

        accessGranted =
          friendship.requester.toString() === userId.toString() ||
          friendship.recipient.toString() === userId.toString();

        query = { friendship: friendship._id, chatType: "direct" };
      } else {
        return socket.emit("chat:error", { message: "Invalid chat context" });
      }

      if (!accessGranted) {
        return socket.emit("chat:error", { message: "Access denied" });
      }

      // Add timestamp filter if provided
      if (before) {
        query.timestamp = { $lt: new Date(before) };
      }

      // Fetch messages
      const messages = await ChatMessage.find(query)
        .sort({ timestamp: -1 })
        .limit(limit)
        .populate("sender", "username avatar")
        .lean();

      // Reverse to get chronological order
      messages.reverse();

      socket.emit("chat:history", {
        messages,
        hasMore: messages.length === limit,
      });
    } catch (error) {
      console.error("Error loading chat history:", error);
      socket.emit("chat:error", { message: "Failed to load chat history" });
    }
  });
}

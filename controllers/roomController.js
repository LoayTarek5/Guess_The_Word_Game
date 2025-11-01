import mongoose from "mongoose";
import User from "../models/User.js";
import Games from "../models/Games.js";
import Notification from "../models/Notification.js";
import Friendship from "../models/Friendship.js";
import Room from "../models/Room.js";
import logger from "../utils/logger.js";
import {
  emitPlayerJoined,
  emitPlayerLeft,
  emitRoomSettingsUpdate,
  emitRoomInvitation,
} from "../socket/handlers/roomHandler.js";
import { emitNotificationToUser } from "../socket/handlers/notificationHandler.js";

class RoomController {
  async browseRooms(req, res) {
    try {
      const userId = req.user.userId;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 5;
      const skip = (page - 1) * limit;

      const query = {
        status: { $in: ["waiting"] },
        isPrivate: false,
        expiresAt: { $gt: new Date() },
      };

      const rooms = await Room.find(query)
        .populate("creator", "username avatar")
        .populate("players.user", "username avatar")
        .sort({ createdAt: -1, lastActivity: -1 })
        .skip(skip)
        .limit(limit)
        .lean();

      const availableRooms = rooms.filter((room) => {
        const currentPlayers = room.players?.length || 0;
        const maxPlayers = room.settings?.maxPlayers || 2;
        return currentPlayers < maxPlayers;
      });

      const totalRooms = await Room.countDocuments(query);

      const totalPages = Math.ceil(totalRooms / limit);
      const hasNextPage = page < totalPages;
      const hasPrevPage = page > 1;

      const formattedRooms = availableRooms.map((room) => {
        const currentPlayers = room.players?.length || 0;
        const maxPlayers = room.settings?.maxPlayers || 2;
        const isFull = currentPlayers >= maxPlayers;
        const creatorName = room.creator?.username || "Unknown";
        const creatorAvatar =
          room.creator?.avatar || creatorName.charAt(0).toUpperCase();

        const timeAgo = this.getTimeAgo(room.createdAt);

        return {
          roomId: room.roomId,
          roomCode: room.roomCode,
          roomName: room.roomName || `${creatorName}'s Room`,
          creator: {
            username: creatorName,
            avatar: creatorAvatar,
          },
          settings: {
            wordLength: room.settings?.wordLength || 5,
            maxTries: room.settings?.maxTries || 6,
            maxPlayers: maxPlayers,
            difficulty: room.settings?.difficulty || "normal",
            language: room.settings?.language || "en",
          },
          currentPlayers,
          maxPlayers,
          isFull,
          status: room.status,
          timeAgo,
          createdAt: room.createdAt,
        };
      });

      res.json({
        success: true,
        rooms: formattedRooms,
        pagination: {
          currentPage: page,
          totalPages,
          totalRooms,
          limit,
          hasNextPage,
          hasPrevPage,
          startIndex: skip + 1,
          endIndex: Math.min(skip + limit, totalRooms),
        },
      });
    } catch (error) {
      logger.error("Browse rooms error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to load rooms",
      });
    }
  }

  async createRoom(req, res) {
    try {
      const userId = req.user.userId;
      const { roomName, settings } = req.body;

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }
      const roomId = new mongoose.Types.ObjectId().toString();
      const roomCode = await Room.generateRoomCode();

      const room = new Room({
        roomId,
        roomCode,
        roomName: roomName || `${user.username}'s Room`,
        creator: userId,
        settings: {
          wordLength: settings.wordLength,
          maxPlayers: settings.maxPlayers,
          language: settings.language,
          maxTries: settings.maxTries,
          difficulty: settings.difficulty,
        },
        status: "waiting",
        players: [
          {
            user: userId,
            isHost: true,
            joinedAt: new Date(),
          },
        ],
        createdAt: new Date(),
        lastActivity: new Date(),
      });

      await User.findByIdAndUpdate(userId, {
        currentRoomId: roomId,
      });

      await room.save();

      await room.populate("players.user", "username avatar");

      logger.info(
        `Room created: ${roomCode} by user: ${userId} with Room ID: ${roomId}`
      );

      res.status(201).json({
        success: true,
        roomId: room.roomId,
        roomCode: room.roomCode,
        message: "Room created successfully",
      });
    } catch (error) {
      console.error("Room creation error:", error);

      if (error.name === "ValidationError") {
        return res.status(400).json({
          success: false,
          message: "Invalid room settings",
          errors: Object.values(error.errors).map((err) => err.message),
        });
      }

      res.status(500).json({
        success: false,
        message: "Failed to create room. Please try again.",
      });
    }
  }

  async getRoomDetails(req, res) {
    try {
      const { roomId } = req.params;
      const userId = req.user.userId;

      const room = await Room.findOne({ roomId })
        .populate("creator", "username avatar")
        .populate("players.user", "username avatar");

      if (!room) {
        await User.findByIdAndUpdate(userId, {
          currentRoomId: null,
        });
        return res.status(404).json({
          success: false,
          message: "Room not found",
        });
      }
      const isInRoom = room.players.some(
        (player) => player.user._id.toString() === userId
      );

      if (!isInRoom && room.status !== "waiting") {
        return res.status(403).json({
          success: false,
          message: "Access denied",
        });
      }

      res.json({
        success: true,
        room: {
          roomId: room.roomId,
          roomCode: room.roomCode,
          roomName: room.roomName,
          creator: room.creator,
          settings: room.settings,
          status: room.status,
          players: room.players,
          currentPlayers: room.currentPlayers,
          isFull: room.isFull,
          createdAt: room.createdAt,
          isHost: room.isHost(userId),
          isInRoom: isInRoom,
        },
      });
    } catch (error) {
      console.error("Get room error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch room details",
      });
    }
  }

  async joinRoom(req, res) {
    try {
      const { roomCode } = req.params;
      const userId = req.user.userId;

      if (!roomCode || roomCode.length !== 6) {
        return res.status(400).json({
          success: false,
          message: "Invalid room code format",
        });
      }

      const room = await Room.findOne({
        roomCode: roomCode.toUpperCase(),
        status: { $in: ["waiting"] },
      });

      if (!room) {
        return res.status(404).json({
          success: false,
          message: "Room not found or game already started",
        });
      }

      if (room.players.some((p) => p.user.toString() === userId)) {
        return res.json({
          success: true,
          roomId: room.roomId,
          message: "Already in room",
          alreadyJoined: true,
        });
      }

      await room.addPlayer(userId);

      const updatedRoom = await Room.findOne({ roomId: room.roomId }).populate(
        "players.user",
        "username avatar"
      );
      const newPlayer = updatedRoom.players.find(
        (p) => p.user._id.toString() === userId
      );

      res.json({
        success: true,
        roomId: room.roomId,
        message: "Successfully joined room",
      });

      emitPlayerJoined(room.roomId, {
        player: {
          user: {
            _id: userId,
            username: newPlayer.user.username,
            avatar: newPlayer.user.avatar,
          },
          isHost: false,
          joinedAt: newPlayer.joinedAt,
          isReady: false,
        },
        currentPlayers: updatedRoom.currentPlayers,
        isFull: updatedRoom.isFull,
      });

      logger.info(`User ${userId} joined room: ${roomCode}`);
    } catch (error) {
      if (error.message === "Room is full") {
        return res.status(400).json({
          success: false,
          message: "Room is full",
        });
      }

      if (error.message === "Player already in room") {
        return res.status(400).json({
          success: false,
          message: "You are already in this room",
        });
      }

      res.status(500).json({
        success: false,
        message: "Failed to join room",
      });
    }
  }

  async exitRoom(req, res) {
    try {
      const { roomId } = req.params;
      const userId = req.user.userId;

      const room = await Room.findOne({ roomId });

      if (!room) {
        return res.status(404).json({
          success: false,
          message: "Room not found",
        });
      }

      const exitResult = await room.exitRoom(userId);

      emitPlayerLeft(room.roomId, {
        userId,
        username: exitResult.username,
        newHost: exitResult.newHost,
        roomStatus: exitResult.roomStatus,
        remainingPlayers: exitResult.remainingPlayers,
      });

      res.json({
        success: true,
        message: "Successfully left the room",
        ...exitResult,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  async inviteFriends(req, res) {
    try {
      const { roomId } = req.params;
      const { friendIds } = req.body;
      const userId = req.user.userId;

      if (!friendIds || !Array.isArray(friendIds) || friendIds.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Please select at least one friend to invite",
        });
      }

      const room = await Room.findOne({ roomId })
        .populate("creator", "username")
        .populate("players.user", "username");

      if (!room) {
        return res.status(404).json({
          success: false,
          message: "Room not found",
        });
      }

      const isInRoom = room.players.some(
        (player) => player.user._id.toString() === userId
      );

      if (!isInRoom) {
        return res.status(403).json({
          success: false,
          message: "You must be in the room to invite friends",
        });
      }

      if (room.isFull) {
        return res.status(400).json({
          success: false,
          message: "Room is full",
        });
      }
      const inviter = await User.findById(String(userId))
        .select("username")
        .lean();
      const inviterName = inviter?.username ?? "Someone";

      const friendsId = Array.from(new Set(friendIds.map((id) => String(id))));

      if (friendsId.length === 0) {
        return res
          .status(400)
          .json({ success: false, message: "No valid friend ids provided" });
      }

      // fetch friendships in a single query
      const friendships = await Friendship.find({
        status: "accepted",
        $or: [
          { requester: userId, recipient: { $in: friendsId } },
          { recipient: userId, requester: { $in: friendsId } },
        ],
      })
        .select("requester recipient")
        .lean();

      // Build a Set of friend ids that are actually friends with userId
      const friendSet = new Set();
      const uidStr = String(userId);
      for (const f of friendships) {
        const r = String(f.requester);
        const p = String(f.recipient);
        if (r === uidStr && p !== uidStr) friendSet.add(p);
        else if (p === uidStr && r !== uidStr) friendSet.add(r);
      }

      // build a Set of players currently in the room for O(1) checks
      const playerSet = new Set(room.players.map((p) => String(p.user._id)));

      // filter friendIds to validFriendIds and collect notFriends/alreadyInRoom
      const notFriends = [];
      const alreadyInRoom = [];
      const candidateFriendIds = []; // friends & not in room

      for (const fid of friendsId) {
        if (!friendSet.has(fid)) {
          notFriends.push(fid);
          continue;
        }
        if (playerSet.has(fid)) {
          alreadyInRoom.push(fid);
          continue;
        }
        candidateFriendIds.push(fid);
      }

      // check for existing non-expired invitations to same room
      const now = new Date();
      const existingInvites = await Notification.find({
        recipient: { $in: candidateFriendIds },
        "data.roomInvitation.roomId": room.roomId,
        expiresAt: { $gt: now }, // only consider not-yet-expired invites as duplicates
        type: "room_invitation",
      })
        .select("recipient")
        .lean();

      const alreadyInvitedSet = new Set(
        existingInvites.map((n) => String(n.recipient))
      );

      const alreadyInvited = [];
      const toInvite = [];

      for (const fid of candidateFriendIds) {
        if (alreadyInvitedSet.has(fid)) {
          alreadyInvited.push(fid);
        } else {
          toInvite.push(fid);
        }
      }

      const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
      const notifications = toInvite.map((friendId) => ({
        recipient: friendId,
        sender: userId,
        type: "room_invitation",
        title: "Room Invitation",
        message: `${inviterName} invited you to join their game room`,
        data: {
          roomInvitation: {
            roomId: room.roomId,
            roomCode: room.roomCode,
            roomName: room.roomName,
            inviterId: userId,
          },
        },
        expiresAt,
        createdAt: new Date(),
      }));

      const chunkInsert = async (docs, chunkSize = 500) => {
        for (let i = 0; i < docs.length; i += chunkSize) {
          const chunk = docs.slice(i, i + chunkSize);
          await Notification.insertMany(chunk);
        }
      };

      if (notifications.length > 0) {
        if (notifications.length > 100) {
          await chunkInsert(notifications);
        } else {
          await Notification.insertMany(notifications);
        }
      }

      if (toInvite.length > 0) {
        emitRoomInvitation(toInvite, {
          roomId: room.roomId,
          roomCode: room.roomCode,
          roomName: room.roomName,
          inviter: {
            _id: userId,
            username: inviterName,
          },
          settings: {
            wordLength: room.settings.wordLength,
            maxPlayers: room.settings.maxPlayers,
            language: room.settings.language,
            maxTries: room.settings.maxTries,
            difficulty: room.settings.difficulty,
          },
          expiresAt: expiresAt,
          message: `${inviterName} invited you to join their game room`,
        });
      }

      for (const notification of notifications) {
        const formattedNotification = {
          _id: notification._id || new mongoose.Types.ObjectId(),
          type: notification.type,
          title: notification.title,
          message: notification.message,
          isRead: false,
          createdAt: notification.createdAt,
          sender: {
            _id: userId,
            username: inviterName,
          },
          data: notification.data,
          timeAgo: "Just now",
        };

        emitNotificationToUser(
          notification.recipient.toString(),
          formattedNotification
        );
      }

      logger.info(
        `User ${userId} invited ${toInvite.length} friends to room ${room.roomCode} (skipped in-room: ${alreadyInRoom.length}, not-friends: ${notFriends.length}, already-invited: ${alreadyInvited.length})`
      );

      return res.json({
        success: true,
        message: `Invited ${toInvite.length} friend(s)`,
        details: {
          invited: toInvite.length,
          alreadyInRoom: alreadyInRoom.length,
          notFriends: notFriends.length,
          alreadyInvited: alreadyInvited.length,
        },
      });
    } catch (error) {
      console.error("Invite friends error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to send invitations",
      });
    }
  }

  async getAvailableFriends(req, res) {
    try {
      const { roomId } = req.params;
      const userId = req.user.userId;
      logger.info(
        `Getting available friends for room: ${roomId}, user: ${userId}`
      );
      // Verify user is in room
      const room = await Room.findOne({ roomId }).populate(
        "players.user",
        "_id"
      );
      if (!room) {
        return res.status(404).json({
          success: false,
          message: "Room not found",
        });
      }

      const isInRoom = room.players.some(
        (player) => player.user._id.toString() === userId
      );

      if (!isInRoom) {
        return res.status(403).json({
          success: false,
          message: "Access denied",
        });
      }

      // Get player IDs already in room
      const playersInRoom = room.players.map((p) => p.user._id.toString());

      // Get friends who already have pending invitations to this room
      const pendingInvitations = await Notification.find({
        type: "room_invitation",
        "data.roomInvitation.roomId": roomId,
        isRead: false,
        expiresAt: { $gt: new Date() },
      })
        .select("recipient")
        .lean();

      const alreadyInvitedIds = pendingInvitations.map((inv) =>
        inv.recipient.toString()
      );

      // Get online friends not in room and not already invited
      const friendships = await Friendship.aggregate([
        {
          $match: {
            $or: [
              {
                requester: new mongoose.Types.ObjectId(userId),
                status: "accepted",
              },
              {
                recipient: new mongoose.Types.ObjectId(userId),
                status: "accepted",
              },
            ],
          },
        },
        {
          $lookup: {
            from: "users",
            localField: "requester",
            foreignField: "_id",
            as: "requesterData",
          },
        },
        {
          $lookup: {
            from: "users",
            localField: "recipient",
            foreignField: "_id",
            as: "recipientData",
          },
        },
        {
          $addFields: {
            friend: {
              $cond: [
                { $eq: ["$requester", new mongoose.Types.ObjectId(userId)] },
                { $arrayElemAt: ["$recipientData", 0] },
                { $arrayElemAt: ["$requesterData", 0] },
              ],
            },
          },
        },
        {
          $match: {
            "friend._id": {
              $nin: [
                ...playersInRoom.map((id) => new mongoose.Types.ObjectId(id)),
                ...alreadyInvitedIds.map(
                  (id) => new mongoose.Types.ObjectId(id)
                ),
              ],
            },
            $or: [
              { "friend.status": "online" },
              { "friend.status": "in match" },
              {
                "friend.lastSeen": {
                  $gt: new Date(Date.now() - 10 * 60 * 1000), // 10 minutes ago
                },
              },
            ],
          },
        },
        {
          $sort: {
            "friend.status": 1, // Online first
            "friend.lastSeen": -1,
          },
        },
        {
          $limit: 30, // Limit to 30 friends
        },
        {
          $project: {
            "friend._id": 1,
            "friend.username": 1,
            "friend.avatar": 1,
            "friend.status": 1,
            "friend.lastSeen": 1,
          },
        },
      ]);

      const availableFriends = friendships
        .filter((item) => item.friend && item.friend._id)
        .map((item) => ({
          id: item.friend._id,
          username: item.friend.username,
          avatar: item.friend.avatar || "/images/user-solid.svg",
          status: item.friend.status,
          lastSeen: item.friend.lastSeen,
          isOnline:
            ["online", "in match"].includes(item.friend.status) ||
            (item.friend.lastSeen &&
              new Date(item.friend.lastSeen) >
                new Date(Date.now() - 10 * 60 * 1000)),
        }));

      res.json({
        success: true,
        friends: availableFriends,
        count: availableFriends.length,
        roomInfo: {
          currentPlayers: room.currentPlayers,
          maxPlayers: room.settings.maxPlayers,
          availableSlots: room.settings.maxPlayers - room.currentPlayers,
        },
      });
    } catch (error) {
      logger.error("Error fetching available friends:", error);
      console.error("Full error:", error.stack);
      console.error("Error fetching available friends:", error);
      res.status(500).json({
        success: false,
        message: "Failed to load available friends",
      });
    }
  }

  async updateRoomSettings(req, res) {
    try {
      const { roomId } = req.params;
      const userId = req.user.userId;
      const { wordLength, maxTries, maxPlayers, language } = req.body;

      // Validate input
      if (!wordLength || !maxTries || !maxPlayers || !language) {
        return res.status(400).json({
          success: false,
          message: "Missing required settings",
        });
      }

      const room = await Room.findOne({ roomId });

      if (!room) {
        return res.status(404).json({
          success: false,
          message: "Room not found",
        });
      }

      // Check if user is the host
      if (!room.isHost(userId)) {
        return res.status(403).json({
          success: false,
          message: "Only the host can change room settings",
        });
      }

      // Check if game has already started
      if (room.status !== "waiting" && room.status !== "full") {
        return res.status(400).json({
          success: false,
          message: "Cannot change settings after game has started",
        });
      }

      const validWordLengths = [4, 5, 6, 7];
      const validMaxTries = [3, 4, 5, 6, 7, 8, 9, 10];
      const validMaxPlayers = [2, 3, 4];
      const validLanguages = ["en", "ar", "zh", "de", "es", "fr"];

      if (!validWordLengths.includes(parseInt(wordLength))) {
        return res.status(400).json({
          success: false,
          message: "Invalid word length",
        });
      }

      if (!validMaxTries.includes(parseInt(maxTries))) {
        return res.status(400).json({
          success: false,
          message: "Invalid max tries value",
        });
      }

      if (!validMaxPlayers.includes(parseInt(maxPlayers))) {
        return res.status(400).json({
          success: false,
          message: "Invalid max players value",
        });
      }

      const languageMap = {
        us: "en",
        en: "en",
        ar: "ar",
        zh: "zh",
        de: "de",
        es: "es",
        fr: "fr",
      };

      const mappedLanguage = languageMap[language] || language;

      if (!validLanguages.includes(mappedLanguage)) {
        return res.status(400).json({
          success: false,
          message: "Invalid language",
        });
      }

      // Check if reducing maxPlayers below current player count
      if (parseInt(maxPlayers) < room.currentPlayers) {
        return res.status(400).json({
          success: false,
          message: `Cannot reduce max players below current player count (${room.currentPlayers})`,
        });
      }

      const difficulty = this.calculateDifficulty(
        parseInt(wordLength),
        parseInt(maxTries)
      );

      room.settings = {
        ...room.settings,
        wordLength: parseInt(wordLength),
        maxTries: parseInt(maxTries),
        maxPlayers: parseInt(maxPlayers),
        language: mappedLanguage,
        difficulty: difficulty.toLowerCase(),
      };

      // Update room status based on new max players
      if (room.currentPlayers >= room.settings.maxPlayers) {
        room.status = "full";
      } else if (room.status === "full") {
        room.status = "waiting";
      }

      await room.save();

      const updater = await User.findById(userId).select("username");

      // Emit socket event to all players
      emitRoomSettingsUpdate(room.roomId, room.settings, updater.username);

      logger.info(`Room ${roomId} settings updated by host ${userId}`);

      res.json({
        success: true,
        message: "Room settings updated successfully",
        settings: room.settings,
        roomStatus: room.status,
      });
    } catch (error) {
      logger.error("Update room settings error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to update room settings",
      });
    }
  }

  calculateDifficulty(wordLength, maxTries) {
    const difficultyScore = wordLength * 2 + (9 - maxTries);

    if (difficultyScore <= 11) return "Beginner";
    if (difficultyScore <= 13) return "Easy";
    if (difficultyScore <= 15) return "Classic";
    if (difficultyScore <= 17) return "Hard";
    return "Expert";
  }

  getTimeAgo(date) {
    const seconds = Math.floor((new Date() - new Date(date)) / 1000);

    if (seconds < 60) return "Just now";
    if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
    return `${Math.floor(seconds / 86400)} days ago`;
  }
}

export default new RoomController();

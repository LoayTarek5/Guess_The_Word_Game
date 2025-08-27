import Notification from "../models/Notification.js";
import friendController from "./friendController.js";
import mongoose from "mongoose";

class NotificationController {
  async getNotifications(req, res) {
    try {
      const userId = req.user.userId;
      const {
        page = 1,
        limit = 8,
        type = "all",
        sort = "newest",
        search = "",
      } = req.query;

      const pageNum = parseInt(page);
      const limitNum = parseInt(limit);
      const skip = (pageNum - 1) * limitNum;

      let filterQuery = {
        recipient: userId,
      };

      if (type && type !== "all") {
        const typeMap = {
          "friend-requests": [
            "friend_request",
            "friend_accepted",
            "friend_rejected",
          ],
          "game-invites": [
            "game_invitation",
            "game_started",
            "your_turn",
            "turn_reminder",
            "game_completed",
            "match_result",
            "game_abandoned",
          ],
          achievements: ["achievement", "leaderboard_update"],
          messages: ["chat_message"],
          system: ["system"],
        };
        if (typeMap[type]) filterQuery.type = { $in: typeMap[type] };
      }
      if (search) {
        filterQuery.$or = [
          { title: { $regex: search, $options: "i" } },
          { message: { $regex: search, $options: "i" } },
        ];
      }

      let sortQuery = {};
      switch (sort) {
        case "oldest":
          sortQuery = { createdAt: 1 };
          break;
        case "priority":
          // Sort by unread first, then by newest
          sortQuery = { isRead: 1, createdAt: -1 };
          break;
        case "type":
          sortQuery = { type: 1, createdAt: -1 };
          break;
        case "newest":
        default:
          sortQuery = { createdAt: -1 };
          break;
      }

      const notifications = await Notification.find(filterQuery)
        .populate("sender", "username avatar")
        .populate("data.gameId", "gameId status")
        .sort(sortQuery)
        .limit(limitNum)
        .skip(skip)
        .lean();

      const totalNotifications = await Notification.countDocuments(filterQuery);

      // Get notification statistics
      const stats = await this.getNotificationStats(userId);
      // Calculate pagination info
      const totalPages = Math.ceil(totalNotifications / limitNum);

      res.json({
        success: true,
        data: {
          notifications: notifications.map(this.formatNotification.bind(this)),
          pagination: {
            currentPage: pageNum,
            totalPages,
            totalNotifications,
            hasNextPage: pageNum < totalPages,
            hasPrevPage: pageNum > 1,
            startIndex: skip + 1,
            endIndex: Math.min(skip + limitNum, totalNotifications),
          },
          stats,
        },
      });
    } catch (error) {
      console.error("Error fetching notifications:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch notifications",
      });
    }
  }

  async getNotificationStats(userId) {
    try {
      const pipeline = [
        { $match: { recipient: new mongoose.Types.ObjectId(userId) } },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            unread: {
              $sum: { $cond: [{ $eq: ["$isRead", false] }, 1, 0] },
            },
            friendRequests: {
              $sum: {
                $cond: [{ $in: ["$type", ["friend_request"]] }, 1, 0],
              },
            },
            gameInvites: {
              $sum: {
                $cond: [{ $in: ["$type", ["game_invitation"]] }, 1, 0],
              },
            },
          },
        },
      ];

      const [result] = await Notification.aggregate(pipeline);
      return (
        result || {
          total: 0,
          unread: 0,
          friendRequests: 0,
          gameInvites: 0,
        }
      );
    } catch (error) {
      console.error("Error getting notification stats:", error);
      return { total: 0, unread: 0, friendRequests: 0, gameInvites: 0 };
    }
  }

  async markNotificationAsRead(req, res) {
    try {
      const { notificationId } = req.params;
      const userId = req.user.userId;

      // Validate notificationId
      if (!mongoose.Types.ObjectId.isValid(notificationId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid notificationId",
        });
      }

      const notification = await Notification.findOneAndUpdate(
        { _id: notificationId, recipient: userId },
        { isRead: true, readAt: new Date() },
        { new: true }
      );

      if (!notification) {
        return res.status(404).json({
          success: false,
          message: "Notification not found",
        });
      }

      res.json({
        success: true,
        message: "Notification marked as read",
      });
    } catch (error) {
      console.error("Error marking notification as read:", error);
      res.status(500).json({
        success: false,
        message: "Failed to mark notification as read",
      });
    }
  }

  async markAllNotificationsAsRead(req, res) {
    try {
      const userId = req.user.userId;

      await Notification.updateMany(
        { recipient: userId, isRead: false },
        { $set: { isRead: true, readAt: new Date() } }
      );

      res.json({
        success: true,
        message: "All notifications marked as read",
      });
    } catch (error) {
      console.error("Error marking all notifications as read:", error);
      res.status(500).json({
        success: false,
        message: "Failed to mark all notifications as read",
      });
    }
  }

  async deleteNotification(req, res) {
    try {
      const { notificationId } = req.params;
      const userId = req.user.userId;

      if (notificationId) {
        if (!mongoose.Types.ObjectId.isValid(notificationId)) {
          return res
            .status(400)
            .json({ success: false, message: "Invalid notificationId" });
        }
      }

      const result = await Notification.findOneAndDelete({
        _id: notificationId,
        recipient: userId,
      });

      if (!result) {
        return res
          .status(404)
          .json({ success: false, message: "Notification not found" });
      }

      res.json({ success: true, message: "Notification deleted" });
    } catch (error) {
      res
        .status(500)
        .json({ success: false, message: "Failed to delete notification" });
    }
  }

  async handleNotificationAction(req, res) {
    try {
      const { notificationId } = req.params;
      const { action } = req.body;
      const userId = req.user.userId;

      // Validate notificationId early
      if (!mongoose.Types.ObjectId.isValid(notificationId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid notificationId",
        });
      }

      const notification = await Notification.findOne({
        _id: notificationId,
        recipient: userId,
      })
        .populate("data.friendRequestId")
        .populate("data.gameId");

      if (!notification) {
        return res.status(404).json({
          success: false,
          message: "Notification not found",
        });
      }

      if (notification.expiresAt && notification.expiresAt < new Date()) {
        return res.status(400).json({
          success: false,
          message: "This notification has expired",
        });
      }

      let result = {};

      switch (notification.type) {
        case "friend_request":
          result = await this.handleFriendRequestAction(
            notification,
            action,
            userId
          );
          break;
        case "game_invitation":
          result = await this.handleGameInvitationAction(
            notification,
            action,
            userId
          );
          break;
        default:
          return res.status(400).json({
            success: false,
            message: "Action not supported for this notification type",
          });
      }

      // Mark notification as read
      notification.isRead = true;
      notification.readAt = new Date();
      await notification.save();

      res.json({
        success: true,
        message: result.message,
        data: result.data,
      });
    } catch (error) {
      console.error("Error handling notification action:", error);
      res.status(500).json({
        success: false,
        message: "Failed to handle notification action",
      });
    }
  }

  async handleFriendRequestAction(notification, action, userId) {
    const mockReq = {
      params: { requestId: notification.data.friendRequestId },
      user: { userId },
    };

    let result = null;
    const mockRes = {
      _status: 200,
      status(code) {
        this._status = code;
        return this;
      },
      json(data) {
        result = data;
        return this;
      },
      send(data) {
        result = data;
        return this;
      },
    };

    try {
      if (action === "accept") {
        await friendController.acceptFriendRequest(mockReq, mockRes);
      } else if (action === "decline") {
        await friendController.declineFriendRequest(mockReq, mockRes);
      } else {
        throw new Error("Invalid action for friend request");
      }
    } catch (err) {
      const msg =
        (err && err.message) || "Failed to perform friend request action";
      throw new Error(msg);
    }

    if (!result || typeof result !== "object") {
      throw new Error("Friend controller did not return a valid response");
    }

    if (result.success === false) {
      throw new Error(result.message || "Friend action failed");
    }

    if (typeof result.success === "undefined") {
      if (mockRes._status >= 200 && mockRes._status < 300) {
        return {
          message: result.message || "Friend action completed",
          data: result.data,
        };
      } else {
        throw new Error(result.message || "Friend action failed");
      }
    }

    // Normal success path
    return {
      message: result.message || "Friend action completed",
      data: result.data,
    };
  }

  async handleGameInvitationAction(notification, action, userId) {
    const GameInvitation = mongoose.model("GameInvitation");

    const invitation = await GameInvitation.findOne({
      to: userId,
      gameId:
        notification.data.gameIdString || String(notification.data.gameId),
      status: "pending",
    });

    if (!invitation) {
      throw new Error("Game invitation not found or expired");
    }

    if (action === "accept") {
      await invitation.accept();
      return {
        message: "Game invitation accepted",
        data: { gameId: invitation.gameId },
      };
    } else if (action === "decline") {
      await invitation.decline();
      return { message: "Game invitation declined" };
    } else {
      throw new Error("Invalid action for game invitation");
    }
  }

  formatNotification(notification) {
    return {
      _id: notification._id,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      isRead: notification.isRead,
      createdAt: notification.createdAt,
      readAt: notification.readAt,
      sender: notification.sender,
      data: notification.data,
      timeAgo: this.getTimeAgo(notification.createdAt),
      priority: !notification.isRead ? "high" : "normal",
    };
  }

  getTimeAgo(date) {
    const now = new Date();
    const diffMs = now - new Date(date);
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  }
}

export default new NotificationController();

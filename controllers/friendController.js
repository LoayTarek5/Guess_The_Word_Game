import mongoose from "mongoose";
import User from "../models/User.js";
import Friendship from "../models/Friendship.js";
import Notification from "../models/Notification.js";
import logger from "../utils/logger.js";

class FriendController {
  async sendFriendRequest(req, res) {
    try {
      // Friend's Username
      const username = req.body.username;
      // Id of Requester
      const userId = req.user.userId;

      if (!username) {
        return res.status(400).json({
          success: false,
          message: "Username is required",
        });
      }

      const recipient = await User.findOne({ username });
      if (!recipient) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      if (recipient._id.toString() === userId) {
        return res.status(400).json({
          success: false,
          message: "Cannot send friend request to yourself",
        });
      }

      const existingFriendship = await Friendship.findOne({
        $or: [
          { requester: userId, recipient: recipient._id },
          { requester: recipient._id, recipient: userId },
        ],
      });

      if (existingFriendship) {
        let message = "";
        switch (existingFriendship.status) {
          case "accepted":
            message = "You are already friends";
            break;
          case "pending":
            message =
              existingFriendship.requester.toString() === userId
                ? "Friend request already sent"
                : "This user has already sent you a friend request";
            break;
          case "blocked":
            message = "Unable to send friend request";
            break;
          default:
            message = "Friend request already exists";
        }

        return res.status(400).json({
          success: false,
          message,
        });
      }

      // Create new friendship
      const friendship = new Friendship({
        requester: userId,
        recipient: recipient._id,
      });

      await friendship.save();

      await Notification.create({
        recipient: recipient._id,
        sender: userId,
        type: "friend_request",
        title: "New Friend Request",
        message: `${req.user.username} wants to be your friend`,
        data: { friendRequestId: friendship._id },
      });

      logger.info(
        `Friend request sent from ${req.user.username} to ${username}`
      );

      res.json({
        success: true,
        message: "Friend request sent successfully",
      });
    } catch (error) {
      logger.error("Send friend request error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to send friend request",
      });
    }
  }

  async cancelFriendRequest(req, res) {
    try {
      const { requestId } = req.params;
      const userId = req.user.userId;

      const friendship = await Friendship.findOne({
        _id: requestId,
        requester: userId,
        status: "pending",
      });

      if (!friendship) {
        return res.status(404).json({
          success: false,
          message: "Friend request not found",
        });
      }

      await Friendship.deleteOne({ _id: friendship._id });

      res.json({
        success: true,
        message: "Friend request cancelled",
      });
    } catch (error) {
      logger.error("Cancel friend request error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to cancel friend request",
      });
    }
  }

  async acceptFriendRequest(req, res) {
    try {
      const { requestId } = req.params;
      const userId = req.user.userId;

      const currentUser = await User.findById(userId, "username");

      if (!currentUser) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      const friendship = await Friendship.findOne({
        _id: requestId,
        recipient: userId,
        status: "pending",
      }).populate("requester", "username");

      if (!friendship) {
        return res.status(404).json({
          success: false,
          message: "Friend request not found",
        });
      }

      // Check if requester still exists
      if (!friendship.requester) {
        // Clean up orphaned friendship
        await Friendship.deleteOne({ _id: friendship._id });
        return res.status(404).json({
          success: false,
          message: "User who sent the request no longer exists",
        });
      }

      friendship.status = "accepted";
      await friendship.save();

      await Notification.create({
        recipient: friendship.requester,
        sender: userId,
        type: "friend_accepted",
        title: "Friend Request Accepted",
        message: `${currentUser.username} accepted your friend request`,
        data: { friendRequestId: friendship._id },
      });

      logger.info(
        `Friend request accepted: ${friendship.requester.username} -> ${req.user.username}`
      );

      res.json({
        success: true,
        message: "Friend request accepted",
      });
    } catch (error) {
      logger.error("Accept friend request error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to accept friend request",
      });
    }
  }

  async declineFriendRequest(req, res) {
    try {
      const { requestId } = req.params;
      const userId = req.user.userId;

      const friendship = await Friendship.findOne({
        _id: requestId,
        recipient: userId,
        status: "pending",
      }).populate("requester", "username");

      if (!friendship) {
        return res.status(404).json({
          success: false,
          message: "Friend request not found",
        });
      }

      // Check if requester still exists before logging
      if (friendship.requester) {
        logger.info(
          `Friend request declined: ${friendship.requester.username} -> ${req.user.username}`
        );
      }

      await Friendship.deleteOne({ _id: friendship._id });

      res.json({
        success: true,
        message: "Friend request declined",
      });
    } catch (error) {
      logger.error("Decline friend request error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to decline friend request",
      });
    }
  }

  // Get pending friend requests
  async getPendingRequests(req, res) {
    try {
      const userId = req.user.userId;
      const [received, sent] = await Promise.all([
        Friendship.getPendingRequests(userId),
        Friendship.getSentRequests(userId),
      ]);

      // Filter out requests with missing user data
      const validReceived = received
        .filter((req) => req.requester && req.requester._id)
        .map((req) => ({
          id: req._id,
          from: {
            id: req.requester._id,
            username: req.requester.username || "Unknown User",
            avatar: req.requester.avatar || "/images/user-solid.svg",
            level: req.requester.stats?.level || 1,
          },
          createdAt: req.createdAt,
        }));

      const validSent = sent
        .filter((req) => req.recipient && req.recipient._id)
        .map((req) => ({
          id: req._id,
          to: {
            id: req.recipient._id,
            username: req.recipient.username || "Unknown User",
            avatar: req.recipient.avatar || "/images/user-solid.svg",
            level: req.recipient.stats?.level || 1,
          },
          createdAt: req.createdAt,
        }));

      res.json({
        success: true,
        received: validReceived,
        sent: validSent,
      });
    } catch (error) {
      logger.error("Get pending requests error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to load pending requests",
      });
    }
  }

  // Remove friend
  async removeFriend(req, res) {
    try {
      const { friendId } = req.params;
      const userId = req.user.userId;

      const friendship = await Friendship.findOne({
        $or: [
          { requester: userId, recipient: friendId },
          { requester: friendId, recipient: userId },
        ],
        status: "accepted",
      });

      if (!friendship) {
        return res.status(404).json({
          success: false,
          message: "Friendship not found",
        });
      }

      await Friendship.deleteOne({ _id: friendship._id });

      res.json({
        success: true,
        message: "Friend removed successfully",
      });
    } catch (error) {
      logger.error("Remove friend error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to remove friend",
      });
    }
  }

  async getFriends(req, res) {
    try {
      const userId = req.user.userId;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 8;
      const skip = (page - 1) * limit;

      const totalFriends = await Friendship.countFriends(userId);

      const friendsShips = await Friendship.aggregate([
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
          $addFields: {
            isOnline: {
              $or: [
                { $eq: ["$friend.status", "online"] },
                { $eq: ["$friend.status", "in match"] },
                {
                  $gt: [
                    "$friend.lastSeen",
                    { $subtract: [new Date(), 5 * 60 * 1000] }, // 5 minutes ago
                  ],
                },
              ],
            },
            // Calculate sort priority
            sortPriority: {
              $switch: {
                branches: [
                  { case: { $eq: ["$friend.status", "in match"] }, then: 1 },
                  { case: { $eq: ["$friend.status", "online"] }, then: 2 },
                  {
                    case: {
                      $gt: [
                        "$friend.lastSeen",
                        { $subtract: [new Date(), 5 * 60 * 1000] },
                      ],
                    },
                    then: 3,
                  },
                  {
                    case: {
                      $gt: [
                        "$friend.lastSeen",
                        { $subtract: [new Date(), 60 * 60 * 1000] },
                      ],
                    },
                    then: 4,
                  },
                  {
                    case: {
                      $gt: [
                        "$friend.lastSeen",
                        { $subtract: [new Date(), 24 * 60 * 60 * 1000] },
                      ],
                    },
                    then: 5,
                  },
                ],
                default: 6,
              },
            },
          },
        },
        {
          $sort: {
            sortPriority: 1, // Online status priority first
            "friend.lastSeen": -1, // Most recent activity second
            "friend.username": 1, // Alphabetical third
          },
        },
        {
          $skip: skip,
        },
        {
          $limit: limit,
        },
        {
          $project: {
            "friend._id": 1,
            "friend.username": 1,
            "friend.avatar": 1,
            "friend.status": 1,
            "friend.stats": 1,
            "friend.lastSeen": 1,
            isOnline: 1,
          },
        },
      ]);

      // Format friends data
      const friends = friendsShips
        .filter((item) => item.friend && item.friend._id)
        .map((item) => ({
          id: item.friend._id,
          username: item.friend.username,
          avatar: item.friend.avatar,
          status: item.friend.status,
          level: item.friend.stats?.level || 1,
          lastSeen: item.friend.lastSeen,
          isOnline: item.isOnline,
        }));

      const totalPages = Math.ceil(totalFriends / limit);
      const onlineFriends = await Friendship.countOnlineFriends(userId);

      return res.json({
        success: true,
        friends,
        pagination: {
          currentPage: page,
          totalPages,
          totalFriends,
          friendsPerPage: limit,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
          startIndex: skip + 1,
          endIndex: Math.min(skip + limit, totalFriends),
        },
        count: {
          total: totalFriends,
          online: onlineFriends,
          showing: friends.length,
        },
      });
    } catch (error) {
      logger.error("Get friends error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to load friends",
      });
    }
  }
}

export default new FriendController();

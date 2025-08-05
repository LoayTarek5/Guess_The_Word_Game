import User from "../models/User.js";
import Friendship from "../models/Friendship.js";
import logger from "../utils/logger.js";

class FriendController {
  // list Of All Friends
  async getFriends(req, res) {
    try {
      const userId = req.user.userId;
      const friendsShips = await Friendship.getFriends(userId);
      // format friends's data
      const friends = friendsShips.map((friendShip) => {
        const friend =
          friendShip.requester._id.toString() == userId
            ? friendShip.recipient
            : friendShip.requester;
        return {
          id: friend._id,
          username: friend.username,
          avatar: friend.avatar,
          status: friend.status,
          level: friend.stats?.level || 1,
          lastSeen: friend.lastSeen,
          isOnline: Friendship.isUserOnline(friend.lastSeen, friend.status),
        };
      });

      // Sort friends: online first, then by username
      friends.sort((a, b) => {
        if (a.isOnline && !b.isOnline) return -1;
        if (!a.isOnline && b.isOnline) return 1;
        return a.username.localeCompare(b.username);
      });

      return res.json({
        success: true,
        friends,
        count: {
          total: friends.length,
          online: friends.filter((friend) => friend.isOnline).length,
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

      friendship.status = "accepted";
      await friendship.save();

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

      logger.info(
        `Friend request declined: ${friendship.requester.username} -> ${req.user.username}`
      );
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
      res.json({
        success: true,
        received: received.map((req) => ({
          id: req._id,
          from: {
            id: req.requester._id,
            username: req.requester.username,
            avatar: req.requester.avatar,
            level: req.requester.stats?.level || 1,
          },
          createdAt: req.createdAt,
        })),
        sent: sent.map((req) => ({
          id: req._id,
          to: {
            id: req.recipient._id,
            username: req.recipient.username,
            avatar: req.recipient.avatar,
            level: req.recipient.stats?.level || 1,
          },
          createdAt: req.createdAt,
        })),
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
}

export default new FriendController();

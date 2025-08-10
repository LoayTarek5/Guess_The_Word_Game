import express from "express";
import { requireAuth } from "../middleware/routeGuards.js";
import friendController from "../controllers/friendController.js";

const router = express.Router();

// Get friends list
router.get("/", requireAuth, friendController.getFriends);

// Send friend request
router.post("/request", requireAuth, friendController.sendFriendRequest);

// Get pending requests
router.get("/requests", requireAuth, friendController.getPendingRequests);

// Accept friend request
router.post(
  "/accept/:requestId",
  requireAuth,
  friendController.acceptFriendRequest
);

// Decline friend request
router.delete(
  "/decline/:requestId",
  requireAuth,
  friendController.declineFriendRequest
);

// Remove friend
router.delete("/remove/:friendId", requireAuth, friendController.removeFriend);

router.delete(
  "/cancel/:requestId",
  requireAuth,
  friendController.cancelFriendRequest
);

export default router;

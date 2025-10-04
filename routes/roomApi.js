import express from "express";
import { requireAuth } from "../middleware/routeGuards.js";
import roomController from "../controllers/roomController.js";

const router = express.Router();

router.post(
  "/create",
  requireAuth,
  roomController.createRoom.bind(roomController)
);
router.post(
  "/:roomId/invite",
  requireAuth,
  roomController.inviteFriends.bind(roomController)
);
router.post(
  "/join/:roomCode",
  requireAuth,
  roomController.joinRoom.bind(roomController)
);
router.post(
  "/:roomId/leave",
  requireAuth,
  roomController.exitRoom.bind(roomController)
);
router.get(
  "/:roomId",
  requireAuth,
  roomController.getRoomDetails.bind(roomController)
);
router.get(
  "/:roomId/available-friends",
  requireAuth,
  roomController.getAvailableFriends.bind(roomController)
);
router.put(
  "/:roomId/settings",
  requireAuth,
  roomController.updateRoomSettings.bind(roomController)
);

export default router;

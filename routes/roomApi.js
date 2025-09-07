import express from "express";
import { requireAuth } from "../middleware/routeGuards.js";
import roomController from "../controllers/roomController.js";

const router = express.Router();

router.post("/create", requireAuth, roomController.createRoom);
router.post('/join/:roomCode', requireAuth, roomController.joinRoom);
router.post('/:roomId/leave', requireAuth, roomController.exitRoom);
router.get("/:roomId", requireAuth, roomController.getRoomDetails);

export default router;

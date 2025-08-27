import express from "express";
import { requireAuth } from "../middleware/routeGuards.js";
import notificationController from "../controllers/notificationController.js";

const router = express.Router();

router.get("/", requireAuth, notificationController.getNotifications.bind(notificationController));

router.get("/stats", requireAuth, async (req, res) => {
  try {
    const stats = await notificationController.getNotificationStats(req.user.userId);
    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to get stats" });
  }
});

router.patch("/:notificationId/read", requireAuth, notificationController.markNotificationAsRead.bind(notificationController));

router.patch("/read-all", requireAuth, notificationController.markAllNotificationsAsRead.bind(notificationController));

router.post("/:notificationId/action", requireAuth, notificationController.handleNotificationAction.bind(notificationController));

router.delete("/:notificationId", requireAuth, notificationController.deleteNotification.bind(notificationController));

export default router;

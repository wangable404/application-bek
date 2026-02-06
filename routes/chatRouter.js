const Router = require("express");
const router = new Router();
const chatController = require("../controllers/chatController");
const authMiddleware = require("../middleware/middleware");

router.get(
  "/:applicationId/chat",
  authMiddleware,
  chatController.getByApplication,
);
router.post(
  "/:applicationId/chat/message",
  authMiddleware,
  chatController.sendMessage,
);
router.get("/", authMiddleware, chatController.getAllChats);
router.patch('/:chatId/read', authMiddleware, chatController.read)

module.exports = router;

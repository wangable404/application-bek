const Router = require("express");
const router = new Router();
const chatController = require("../controllers/chatController");
const authMiddleware = require("../middleware/middleware");

// Получить чат заявки
router.get(
  "/:applicationId/chat",
  authMiddleware,
  chatController.getByApplication
);

// Отправить сообщение
router.post(
  "/:applicationId/chat/message",
  authMiddleware,
  chatController.sendMessage
);

module.exports = router;

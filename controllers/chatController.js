const ApiError = require("../error/ApiError");
const { Chat, Message, Application, User } = require("../models/model");

class ChatController {
  async getByApplication(req, res, next) {
    try {
      const { applicationId } = req.params;
      const userId = req.user.id;

      const user = await User.findByPk(userId);
      if (!user) {
        return next(ApiError.badRequest("Пользователь не найден"));
      }

      const application = await Application.findByPk(applicationId);
      if (!application) {
        return next(ApiError.badRequest("Заявка не найдена"));
      }

      if (user.role === "USER" && application.userId !== userId) {
        return next(ApiError.forbidden("Нет доступа"));
      }

      const chat = await Chat.findOne({
        where: { applicationId: applicationId },
      });

      if (!chat) {
        return next(ApiError.badRequest("Чат не найден"));
      }

      const messages = await Message.findAll({
        where: { chatId: chat.id },
        include: [
          {
            model: User,
            attributes: ["id", "firstName", "lastName", "email", "role"],
          },
        ],
        order: [["createdAt", "ASC"]],
      });

      return res.json({
        chatId: chat.id,
        messages,
      });
    } catch (err) {
      return next(ApiError.badRequest(err.message));
    }
  }

  async sendMessage(req, res, next) {
    try {
      const { applicationId } = req.params;
      const { text } = req.body;
      const user = req.user;

      if (!text || !text.trim()) {
        return next(ApiError.badRequest("Сообщение пустое"));
      }

      const chat = await Chat.findOne({
        where: { applicationId },
      });

      if (!chat) {
        return next(ApiError.badRequest("Чат не найден"));
      }

      const message = await Message.create({
        chatId: chat.id,
        senderId: user.id,
        text: text.trim(),
      });

      const fullMessage = await Message.findByPk(message.id, {
        include: [
          {
            model: User,
            attributes: ["id", "firstName", "lastName", "role"],
          },
        ],
      });

      const io = req.app.get("io");
      io.to(`chat_${applicationId}`).emit("new_message", fullMessage);

      return res.json(fullMessage);
    } catch (err) {
      return next(ApiError.badRequest(err.message));
    }
  }
}

module.exports = new ChatController();

const path = require("path");
const fs = require("fs");
const { Op } = require("sequelize");
const ApiError = require("../error/ApiError");
const { Chat, Message, Application, User } = require("../models/model");
const { notifyChatMessage } = require("../services/notify.service");

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const ALLOWED_VIDEO_TYPES = [
  "video/mp4",
  "video/quicktime",
  "video/3gpp",
  "video/webm",
  "video/x-msvideo",
];
const MAX_IMAGE_SIZE = 15 * 1024 * 1024;
const MAX_VIDEO_SIZE = 100 * 1024 * 1024;

// Вложения чата хранятся отдельно от фотоотчётов (static/uploads/...) —
// static/chat/<chatId>/<file>, чтобы у каждого чата были свои файлы и не
// смешивались с чужими (и чтобы не разрастался один общий каталог чата).
async function saveChatAttachment(file, chatId) {
  const mimeType = file.mimetype;
  const isImage = ALLOWED_IMAGE_TYPES.includes(mimeType);
  const isVideo = ALLOWED_VIDEO_TYPES.includes(mimeType);

  if (!isImage && !isVideo) {
    throw new Error(
      "Неверный формат файла. Поддерживаются изображения (JPEG, PNG, WEBP, GIF) и видео (MP4, MOV, WEBM)",
    );
  }

  const maxSize = isImage ? MAX_IMAGE_SIZE : MAX_VIDEO_SIZE;
  if (file.size > maxSize) {
    throw new Error(
      `Размер файла не должен превышать ${Math.round(maxSize / 1024 / 1024)}MB`,
    );
  }

  const uploadDir = path.resolve(__dirname, "..", "static", "chat", String(chatId));
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  const ext = path.extname(file.name);
  const uniqueName = Date.now() + "-" + Math.round(Math.random() * 1e9) + ext;
  const filePath = path.join(uploadDir, uniqueName);
  await file.mv(filePath);

  const fileUrl = path.join("chat", String(chatId), uniqueName).replace(/\\/g, "/");

  return {
    type: isImage ? "image" : "video",
    fileUrl,
    fileName: file.name,
    mimeType,
    size: file.size,
  };
}

class ChatController {
  async getByApplication(req, res, next) {
    try {
      const { applicationId } = req.params;
      const user = req.user; // роль/id уже есть из JWT, повторный User.findByPk не нужен

      // Заявка и чат одним запросом (Application.hasOne(Chat)) вместо двух
      // последовательных — это самый частый способ открыть чат и из
      // приложения, и из бота, важно, чтобы он не тормозил.
      const application = await Application.findByPk(applicationId, {
        attributes: ["id", "userId"],
        include: [{ model: Chat, attributes: ["id"] }],
      });

      if (!application) {
        return next(ApiError.badRequest("Заявка не найдена"));
      }

      if (user.role === "USER" && application.userId !== user.id) {
        return next(ApiError.forbidden("Нет доступа"));
      }

      const chat = application.chat;
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

  async getArchivedChats(req, res, next) {
    try {
      const user = req.user;
      const userId = user.id;

      const chats = await Chat.findAll({
        where: {
          archived: true,
        },
        include: [
          {
            model: Application,
            attributes: ["id", "userId"],
            required: true,
            include: [
              {
                model: User,
                attributes: ["id", "firstName", "lastName", "role"],
              },
            ],
          },
          {
            model: Message,
            separate: true,
            limit: 1,
            order: [["createdAt", "DESC"]],
            include: [
              {
                model: User,
                attributes: ["id", "firstName", "lastName", "role"],
              },
            ],
          },
        ],
        order: [["updatedAt", "DESC"]],
      });

      // Фильтруем чаты для обычных пользователей
      const filteredChats =
        user.role === "USER"
          ? chats.filter((chat) => chat.application.userId === user.id)
          : chats;

      const chatsWithUnread = await Promise.all(
        filteredChats.map(async (chat) => {
          const chatData = chat.toJSON();

          const unreadCount = await Message.count({
            where: {
              chatId: chat.id,
              read: false,
              senderId: { [Op.ne]: userId },
            },
          });

          chatData.unreadCount = unreadCount;
          return chatData;
        }),
      );

      return res.json(chatsWithUnread);
    } catch (err) {
      return next(ApiError.badRequest(err.message));
    }
  }

  async archive(req, res, next) {
    try {
      const { chatId } = req.params;
      const userId = req.user.id;

      const chat = await Chat.findByPk(chatId, {
        include: [{ model: Application, attributes: ["id", "userId"] }],
      });

      if (!chat) {
        return next(ApiError.badRequest("Чат не найден"));
      }

      if (req.user.role === "USER" && chat.application.userId !== req.user.id) {
        return next(ApiError.forbidden("Нет доступа к этому чату"));
      }

      await chat.update({
        archived: true,
        archivedAt: new Date(),
        archivedBy: userId,
      });

      const io = req.app.get("io");
      if (io) {
        io.emit("chat_archived", {
          chatId: chat.id,
          applicationId: chat.applicationId,
          archivedBy: userId,
          archivedAt: chat.archivedAt,
        });

        io.emit("chat_updated", {
          chatId: chat.id,
          applicationId: chat.applicationId,
          archived: true,
        });
      }

      return res.json({
        success: true,
        chat: {
          id: chat.id,
          archived: chat.archived,
          archivedAt: chat.archivedAt,
        },
      });
    } catch (err) {
      return next(ApiError.badRequest(err.message));
    }
  }

  async unarchive(req, res, next) {
    try {
      const { chatId } = req.params;
      const userId = req.user.id;

      const chat = await Chat.findByPk(chatId, {
        include: [{ model: Application, attributes: ["id", "userId"] }],
      });

      if (!chat) {
        return next(ApiError.badRequest("Чат не найден"));
      }

      if (req.user.role === "USER" && chat.application.userId !== req.user.id) {
        return next(ApiError.forbidden("Нет доступа к этому чату"));
      }

      await chat.update({
        archived: false,
        archivedAt: null,
        archivedBy: null,
      });

      const io = req.app.get("io");
      if (io) {
        io.emit("chat_unarchived", {
          chatId: chat.id,
          applicationId: chat.applicationId,
          unarchivedBy: userId,
        });

        // Также отправляем общее обновление чатов
        io.emit("chat_updated", {
          chatId: chat.id,
          applicationId: chat.applicationId,
          archived: false,
        });
      }

      return res.json({
        success: true,
        chat: {
          id: chat.id,
          archived: chat.archived,
        },
      });
    } catch (err) {
      return next(ApiError.badRequest(err.message));
    }
  }

  async getAllChats(req, res, next) {
    try {
      const user = req.user;
      const userId = user.id;

      const chats = await Chat.findAll({
        where: {
          archived: false,
        },
        include: [
          {
            model: Application,
            attributes: [
              "id",
              "userId",
              "companyId",
              "clientBio",
              "clientPhone",
            ],
            required: true,
            include: [
              {
                model: User,
                as: "integrator", // ✅ интегратор которому назначена заявка
                attributes: ["id", "firstName", "lastName", "role"],
              },
              {
                model: User,
                as: "company", // ✅ компания которая создала заявку
                attributes: ["id", "firstName", "lastName", "role"],
              },
            ],
          },
          {
            model: Message,
            separate: true,
            limit: 1,
            order: [["createdAt", "DESC"]],
            include: [
              {
                model: User,
                attributes: ["id", "firstName", "lastName", "role"],
              },
            ],
          },
        ],
        order: [["updatedAt", "DESC"]],
      });

      const filteredChats =
        user.role === "USER"
          ? chats.filter((chat) => chat.application.userId === userId)
          : user.role === "COMPANY"
            ? chats.filter((chat) => chat.application.companyId === userId)
            : chats;

      const chatsWithUnread = await Promise.all(
        filteredChats.map(async (chat) => {
          const chatData = chat.toJSON();

          const unreadCount = await Message.count({
            where: {
              chatId: chat.id,
              read: false,
              senderId: { [Op.ne]: userId },
            },
          });

          chatData.unreadCount = unreadCount;
          return chatData;
        }),
      );

      return res.json(chatsWithUnread);
    } catch (err) {
      return next(ApiError.badRequest(err.message));
    }
  }

  async sendMessage(req, res, next) {
    try {
      const { applicationId } = req.params;
      const text = (req.body.text || "").trim();
      const user = req.user;
      const file = req.files?.attachment;

      if (!text && !file) {
        return next(ApiError.badRequest("Сообщение пустое"));
      }

      // Один запрос вместо двух (чат + заявка одним include) — раньше
      // здесь же был отдельный поход за PushToken, который вообще нигде
      // не использовался (мёртвый код).
      const chat = await Chat.findOne({
        where: { applicationId },
        include: [{ model: Application, attributes: ["id", "userId"] }],
      });

      if (!chat) {
        return next(ApiError.badRequest("Чат не найден"));
      }

      const io = req.app.get("io");

      if (chat.archived) {
        await chat.update({
          archived: false,
          archivedAt: null,
          archivedBy: null,
        });

        if (io) {
          io.emit("chat_unarchived", {
            chatId: chat.id,
            applicationId: chat.applicationId,
            unarchivedBy: user.id,
          });
        }
      }

      const attachment = file ? await saveChatAttachment(file, chat.id) : null;

      const message = await Message.create({
        chatId: chat.id,
        senderId: user.id,
        text: text || null,
        type: attachment ? attachment.type : "text",
        fileUrl: attachment?.fileUrl || null,
        fileName: attachment?.fileName || null,
        fileMimeType: attachment?.mimeType || null,
        fileSize: attachment?.size || null,
      });

      // Автора сообщения уже знаем из req.user (это он и есть) — не нужно
      // повторно идти в БД за тем же самым через Message.findByPk(...).
      const fullMessage = {
        ...message.toJSON(),
        user: {
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
        },
      };

      if (io) {
        io.to(`chat_${applicationId}`).emit("new_message", fullMessage);
        io.emit("chat_updated", {
          chatId: chat.id,
          applicationId,
          lastMessage: fullMessage,
        });
      }

      // Ничего из этого не должно задерживать ответ отправителю или
      // проваливать уже состоявшуюся отправку сообщения — оно уже создано
      // и разослано по сокету. touch updatedAt (для сортировки списка
      // чатов) и уведомление в push/MAX уходят фоном.
      chat.update({ updatedAt: new Date() }).catch((err) => {
        console.log("chat touch updatedAt error:", err.message);
      });

      if (user.id !== chat.application.userId) {
        // file.data — буфер уже прочитанного в память файла (express-fileupload
        // без useTempFiles), тот же файл, что только что сохранён на диск.
        // Передаём его напрямую в MAX вместо похода за файлом обратно по HTTP.
        notifyChatMessage(chat.application.userId, applicationId, {
          text,
          type: fullMessage.type,
          fileBuffer: file?.data,
          fileName: attachment?.fileName,
          mimeType: attachment?.mimeType,
        }).catch((err) => console.log("notifyChatMessage error:", err.message));
      }

      return res.json(fullMessage);
    } catch (err) {
      return next(ApiError.badRequest(err.message));
    }
  }

  async read(req, res, next) {
    try {
      const { chatId } = req.params;
      const userId = req.user.id;

      await Message.update(
        { read: true },
        {
          where: {
            chatId,
            senderId: { [Op.ne]: userId },
            read: false,
          },
        },
      );

      // ✅ Отправляем событие об обновлении прочитанных сообщений
      const io = req.app.get("io");
      if (io) {
        io.emit("messages_read", { chatId, userId });
      }

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
}

module.exports = new ChatController();

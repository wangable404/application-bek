// services/notify.service.js
const { maxSendMessage, maxSendAttachment } = require("./max.service");
const { PushToken, MaxChat, MaxBotSession } = require("../models/model");
const { sendPush } = require("./push.service");

// Значимые события (новая заявка, смена статуса и т.п.) — шлём в MAX
// всегда, это редкие и важные уведомления, как push в приложении.
async function notifyUser(userId, title, body, data = {}) {
  const [tokens, maxChats] = await Promise.all([
    PushToken.findAll({ where: { userId }, attributes: ["token"] }),
    MaxChat.findAll({ where: { userId }, attributes: ["chatId"] }),
  ]);

  const maxText = `${title}\n${body}`;

  await Promise.allSettled([
    sendPush(
      tokens.map((t) => t.token),
      title,
      body,
      data,
    ),
    ...maxChats.map((c) => maxSendMessage(c.chatId, maxText)),
  ]);
}

// Сообщения переписки — другое дело: их много, и если слать их в MAX
// всегда, они лезут прямо в середину другого сценария (например, во
// время заполнения фотоотчёта) и выглядят как случайные сообщения не по
// теме. Поэтому в MAX реплика уходит только пока пользователь реально
// держит открытым бот-чат именно по этой заявке — в остальных случаях
// он всё равно узнает про сообщение через push.
// message: { text, type: "text"|"image"|"video", fileBuffer?, fileName?, mimeType? }
// text по-прежнему принимается и как обычная строка — для обратной
// совместимости с местами, где вложений не бывает.
async function notifyChatMessage(userId, applicationId, message) {
  const { text, type, fileBuffer, fileName, mimeType } =
    typeof message === "string" ? { text: message, type: "text" } : message;

  const [tokens, maxChat] = await Promise.all([
    PushToken.findAll({ where: { userId }, attributes: ["token"] }),
    MaxChat.findOne({ where: { userId }, attributes: ["chatId"] }),
  ]);

  const pushBody =
    text || (type === "video" ? "🎥 Видео" : type === "image" ? "📷 Фото" : "");

  const tasks = [
    sendPush(
      tokens.map((t) => t.token),
      "Новое сообщение",
      pushBody,
      { screen: "/(tabs)/applications" },
    ),
  ];

  if (maxChat) {
    try {
      const session = await MaxBotSession.findOne({
        where: { chatId: maxChat.chatId },
      });
      const isOpenInThisChat =
        session?.scenario === "chat" &&
        String(session.applicationId) === String(applicationId);

      if (isOpenInThisChat) {
        if (fileBuffer) {
          tasks.push(
            maxSendAttachment(maxChat.chatId, fileBuffer, fileName, mimeType, text),
          );
        } else {
          tasks.push(maxSendMessage(maxChat.chatId, text));
        }
      }
    } catch (err) {
      // Не удалось даже проверить, открыт ли чат в MAX (та же сетевая
      // нестабильность до БД) — просто не шлём в MAX в этот раз, push
      // всё равно уйдёт.
      console.log("notifyChatMessage session lookup error:", err.message);
    }
  }

  await Promise.allSettled(tasks);
}

module.exports = { notifyUser, notifyChatMessage };

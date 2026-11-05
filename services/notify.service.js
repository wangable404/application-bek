// services/notify.service.js
const { maxSendMessage, maxSendAttachment } = require("./max.service");
const {
  applicationLinkKeyboard,
  chatLinkKeyboard,
  invitationLinkKeyboard,
} = require("../bot/max/keyboards");
const { PushToken, MaxChat, MaxBotSession } = require("../models/model");
const { sendPush } = require("./push.service");

async function notifyUser(userId, title, body, data = {}) {
  const [tokens, maxChats] = await Promise.all([
    PushToken.findAll({ where: { userId }, attributes: ["token"] }),
    MaxChat.findAll({ where: { userId }, attributes: ["chatId"] }),
  ]);

  const maxText = `${title}\n${body}`;
  const keyboard = data.applicationId
    ? applicationLinkKeyboard(data.applicationId)
    : data.invitationId
      ? invitationLinkKeyboard(data.invitationId)
      : undefined;

  await Promise.allSettled([
    sendPush(
      tokens.map((t) => t.token),
      title,
      body,
      data,
    ),
    ...maxChats.map((c) => maxSendMessage(c.chatId, maxText, keyboard)),
  ]);
}

// message: { text, type: "text"|"image"|"video", fileBuffer?, fileName?, mimeType? }
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
      } else {
        tasks.push(
          maxSendMessage(
            maxChat.chatId,
            `💬 Новое сообщение по заявке #${applicationId}${pushBody ? `: ${pushBody}` : ""}`,
            chatLinkKeyboard(applicationId),
          ),
        );
      }
    } catch (err) {
      console.log("notifyChatMessage session lookup error:", err.message);
    }
  }

  await Promise.allSettled(tasks);
}

module.exports = { notifyUser, notifyChatMessage };

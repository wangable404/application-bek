// services/notify.service.js
const { maxSendMessage } = require("./max.service");
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

  await Promise.all([
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
async function notifyChatMessage(userId, applicationId, text) {
  const [tokens, maxChat] = await Promise.all([
    PushToken.findAll({ where: { userId }, attributes: ["token"] }),
    MaxChat.findOne({ where: { userId }, attributes: ["chatId"] }),
  ]);

  const tasks = [
    sendPush(
      tokens.map((t) => t.token),
      "Новое сообщение",
      text,
      { screen: "/(tabs)/applications" },
    ),
  ];

  if (maxChat) {
    const session = await MaxBotSession.findOne({
      where: { chatId: maxChat.chatId },
    });
    const isOpenInThisChat =
      session?.scenario === "chat" &&
      String(session.applicationId) === String(applicationId);

    if (isOpenInThisChat) {
      tasks.push(maxSendMessage(maxChat.chatId, text));
    }
  }

  await Promise.all(tasks);
}

module.exports = { notifyUser, notifyChatMessage };

// services/notify.service.js
const { maxSendMessage } = require("./max.service");
const { PushToken, MaxChat } = require("../models/model");
const { sendPush } = require("./push.service");

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

module.exports = { notifyUser };

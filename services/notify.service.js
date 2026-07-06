// services/notify.service.js
const { tgSendMessage } = require("./telegram.service");
const { maxSendMessage } = require("./max.service");
const { PushToken, TelegramChat, MaxChat } = require("../models/model");
const { sendPush } = require("./push.service");

async function notifyUser(userId, title, body, data = {}) {
  const [pushTokens, tgChats, maxChats] = await Promise.all([
    PushToken.findAll({ where: { userId }, attributes: ["token"] }),
    TelegramChat.findAll({ where: { userId }, attributes: ["chatId"] }),
    MaxChat.findAll({ where: { userId }, attributes: ["chatId"] }),
  ]);

  const tgText = `<b>${title}</b>\n${body}`;
  const maxText = `${title}\n${body}`;

  await Promise.all([
    sendPush(pushTokens.map((t) => t.token), title, body, data),
    ...tgChats.map((c) => tgSendMessage(c.chatId, tgText)),
    ...maxChats.map((c) => maxSendMessage(c.chatId, maxText)),
  ]);
}

module.exports = { notifyUser };
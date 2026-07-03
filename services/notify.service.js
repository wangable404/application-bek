import { PushToken, TelegramChat } from "../models/model.js";
import { sendPush } from "./push.service.js";
import { tgSendMessage } from "./telegram.service.js";

export async function notifyUser(userId, title, body, data = {}) {
  const [pushTokens, tgChats] = await Promise.all([
    PushToken.findAll({ where: { userId }, attributes: ["token"] }),
    TelegramChat.findAll({ where: { userId }, attributes: ["chatId"] }),
  ]);

  const tgText = `<b>${title}</b>\n${body}`;

  await Promise.all([
    sendPush(pushTokens.map((t) => t.token), title, body, data),
    ...tgChats.map((c) => tgSendMessage(c.chatId, tgText)),
  ]);
}
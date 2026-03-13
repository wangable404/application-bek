import { Expo } from "expo-server-sdk";
import PushToken from "../models/PushToken.js";

const expo = new Expo();

export async function sendPush(tokens, title, body, data = {}) {
  console.log('================');
  console.log('started');
  console.log('================');
  
  const messages = tokens
    .filter((t) => Expo.isExpoPushToken(t))
    .map((token) => ({
      to: token,
      sound: "default",
      title,
      body,
      data,
    }));

  const chunks = expo.chunkPushNotifications(messages);
  const tickets = [];

  for (const chunk of chunks) {
    const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
    tickets.push(...ticketChunk);
  }

  /* проверяем ошибки */
  for (let i = 0; i < tickets.length; i++) {
    const ticket = tickets[i];

    if (ticket.status === "error") {
      if (ticket.details?.error === "DeviceNotRegistered") {
        const token = tokens[i];

        await PushToken.destroy({
          where: { token },
        });
      }
    }
  }
}
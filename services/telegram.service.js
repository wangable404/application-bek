import axios from "axios";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const API_URL = `https://api.telegram.org/bot${BOT_TOKEN}`;

export async function tgSendMessage(chatId, text) {
  try {
    await axios.post(`${API_URL}/sendMessage`, {
      chat_id: chatId,
      text,
      parse_mode: "HTML",
    });
  } catch (err) {
    console.log("telegram sendMessage error", err.response?.data || err.message);
  }
}

export async function setTelegramWebhook() {
  const webhookUrl = `${process.env.BACKEND_URL}/telegram/webhook`;
  try {
    const res = await axios.post(`${API_URL}/setWebhook`, {
      url: webhookUrl,
    });
    console.log("telegram webhook set:", res.data);
  } catch (err) {
    console.log("telegram setWebhook error", err.response?.data || err.message);
  }
}
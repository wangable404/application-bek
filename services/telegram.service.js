import axios from "axios";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const API_URL = `https://api.telegram.org/bot${BOT_TOKEN}`;
const RELAY_URL = process.env.TELEGRAM_RELAY_URL; // https://telegram-relay-xxxx.onrender.com
const RELAY_SECRET = process.env.RELAY_SECRET;

export async function tgSendMessage(chatId, text) {
  try {
    await axios.post(`${RELAY_URL}/send`, {
      secret: RELAY_SECRET,
      chatId,
      text,
    });
  } catch (err) {
    console.log(
      "telegram send via relay error:",
      err.response?.data || err.message,
    );
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

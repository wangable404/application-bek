// services/max.service.js
const axios = require("axios");

const MAX_API = "https://platform-api2.max.ru";
const TOKEN = process.env.MAX_BOT_TOKEN;

async function maxSendMessage(chatId, text) {
  try {
    await axios.post(
      `${MAX_API}/messages`,
      { text },
      {
        params: { chat_id: chatId },
        headers: { Authorization: TOKEN, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    console.log("max sendMessage error:", err.response?.data || err.message);
  }
}

async function setMaxWebhook(webhookUrl) {
  try {
    const res = await axios.post(
      `${MAX_API}/subscriptions`,
      {
        url: webhookUrl,
        update_types: ["bot_started", "message_created"],
        secret: process.env.MAX_WEBHOOK_SECRET,
      },
      { headers: { Authorization: TOKEN, "Content-Type": "application/json" } },
    );
    console.log("max webhook set:", res.data);
  } catch (err) {
    console.log("max setWebhook error:", err.response?.data || err.message);
  }
}

module.exports = { maxSendMessage, setMaxWebhook };
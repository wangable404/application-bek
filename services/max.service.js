// services/max.service.js
const axios = require("axios");

// const MAX_API = "https://platform-api2.max.ru";
const RELAY_API = process.env.RELAY_API;

async function maxSendMessage(chatId, text) {
  try {
    await axios.post(
      `${RELAY_API}/max/send`,
      { secret: process.env.SECRET, text, chatId },
    );
  } catch (err) {
    console.log("max sendMessage error:", err.response?.data || err.message);
  }
}

module.exports = { maxSendMessage };
import axios from "axios";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TG_API = `https://api.telegram.org/bot${BOT_TOKEN}`;


export async function tgSendMessage(chatId, text) {
  try {
    const response = await axios.post(`${TG_API}/sendMessage`, {
      chat_id: chatId,
      text,
      parse_mode: "HTML",
    });
    res.json(response.data);
  } catch (err) {
    console.log(
      "telegram sendMessage error:",
      err.response?.data || err.message,
    );
    res.status(500).json({ error: err.message });
  }
}

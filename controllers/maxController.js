const { MaxChat } = require("../models/model");
const { maxSendMessage } = require("../services/max.service");

class MaxController {
  async webhook(req, res) {
    try {
      const secret = req.headers["x-max-bot-api-secret"];
      if (secret !== process.env.MAX_WEBHOOK_SECRET) {
        return res.sendStatus(403);
      }

      const update = req.body;
      console.log(update, "max update");

      if (update.update_type === "bot_started") {
        const chatId = update.chat_id;
        const userId = update.payload;

        if (userId) {
          await MaxChat.upsert({ userId, chatId });
          await maxSendMessage(
            chatId,
            "✅ Уведомления подключены. Теперь вы будете получать сюда сообщения о новых заявках.",
          );
        }
      }

      return res.sendStatus(200);
    } catch (err) {
      console.log(err);
      return res.sendStatus(200);
    }
  }
}

module.exports = new MaxController();
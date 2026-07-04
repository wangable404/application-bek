const { TelegramChat } = require("../models/model");
const { tgSendMessage } = require("../services/telegram.service");

class TelegramController {
  async webhook(req, res) {
    try {
      const message = req.body.message;

      if (message?.text?.startsWith("/start")) {
        const chatId = message.chat.id;
        const parts = message.text.split(" ");
        const userId = parts[1];

        if (userId) {
          await TelegramChat.upsert({ userId, chatId });
          await tgSendMessage(
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

module.exports = new TelegramController();
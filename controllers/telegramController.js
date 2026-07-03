const { TelegramChat } = require("../models/model");
const { tgSendMessage } = require("../services/telegram.service");

class TelegramController {
  async webhook(req, res,next ) {
    try {
      const message = req.body.message;

      console.log(message);
      

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
        } else {
          await tgSendMessage(
            chatId,
            "Перейдите по ссылке из приложения, чтобы подключить уведомления.",
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
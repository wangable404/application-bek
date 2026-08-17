const dispatcher = require("../bot/max/dispatcher");

class MaxController {
  async webhook(req, res) {
    try {
      const secret = req.headers["x-max-bot-api-secret"];
      if (secret !== process.env.MAX_WEBHOOK_SECRET) {
        return res.sendStatus(403);
      }

      // Отвечаем 200 сразу, обработку не заставляем ждать вебхук (MAX ретраит
      // при таймауте), но и не проглатываем ошибки молча — они логируются
      // внутри dispatcher.
      res.sendStatus(200);
      await dispatcher.handleUpdate(req.body);
    } catch (err) {
      console.log("max webhook error:", err);
      if (!res.headersSent) res.sendStatus(200);
    }
  }
}

module.exports = new MaxController();
const Router = require("express");
const telegramController = require("../controllers/telegramController");
const router = new Router();

router.post("/webhook", telegramController.webhook);

module.exports = router;

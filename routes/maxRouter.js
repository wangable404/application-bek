// routes/maxRouter.js
const { Router } = require("express");
const maxController = require("../controllers/maxController");

const router = new Router();
router.post("/webhook", maxController.webhook);

module.exports = router;
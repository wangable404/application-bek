// cron/billing.cron.js
const cron = require("node-cron");
const { chargeDaily } = require("../services/subscription.service");

cron.schedule("0 0 * * *", async () => {
  console.log("[BILLING] Начало ежедневного списания...");
  await chargeDaily();
  console.log("[BILLING] Готово");
});
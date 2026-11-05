// routes/subscriptionRouter.js
const Router = require("express");
const subscriptionController = require("../controllers/subscriptionController");
const authMiddleware = require("../middleware/middleware");
const router = new Router();

router.get("/plans", authMiddleware, subscriptionController.getPlans);
router.post("/plans", authMiddleware, subscriptionController.createPlan);
router.patch("/plans/:id", authMiddleware, subscriptionController.updatePlan);
router.delete("/plans/:id", authMiddleware, subscriptionController.deletePlan);

router.post("/plan", authMiddleware, subscriptionController.choosePlan);
router.get("/status", authMiddleware, subscriptionController.getStatus);
router.post("/calc-days", authMiddleware, subscriptionController.calcDays);
router.get("/companies", authMiddleware, subscriptionController.getCompaniesWithDays);

router.post("/top-up", subscriptionController.topUp);
router.get("/payments", authMiddleware, subscriptionController.getPayments);

module.exports = router;
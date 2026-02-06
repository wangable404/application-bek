const Router = require("express");
const applicationController = require("../controllers/applicationController");
const authMiddleware = require("../middleware/middleware");
const router = new Router();

router.post("/create", applicationController.create);
router.get("/", authMiddleware, applicationController.getAll);
router.get('/:id', authMiddleware, applicationController.getOneAdmin)
router.get("/:userId/:dealId", applicationController.getOne);
router.post("/:userId/:dealId/reject", applicationController.reject);
router.post(
  "/:id/:status/status",
  authMiddleware,
  applicationController.changeStatus,
);
router.post("/:id/complete", applicationController.completeApplication);

module.exports = router;
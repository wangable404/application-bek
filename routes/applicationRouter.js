const Router = require('express')
const applicationController = require('../controllers/applicationController')
const authMiddleware = require('../middleware/middleware')
const router = new Router()

router.post('/create', applicationController.create)
router.get('/', authMiddleware, applicationController.getAll)
router.get('/:userId/:dealId', applicationController.getOne)
router.post('/:userId/:dealId/reject', applicationController.reject)
router.post('/:id/accept', authMiddleware, applicationController.acceptApp)
router.post('/:id/reject', authMiddleware, applicationController.rejectApp)

module.exports = router
const Router = require('express')
const applicationController = require('../controllers/applicationController')
const router = new Router()

router.post('/create', applicationController.create)
router.get('/', applicationController.getAll)
router.get('/:userId/:dealId', applicationController.getOne)

module.exports = router
const Router = require('express')
const userController = require('../controllers/userController')
const authMiddleware = require('../middleware/middleware')
const router = new Router()

router.post('/registration', userController.registration)
router.post('/login', userController.login)
router.get('/auth/check', authMiddleware, userController.check)
router.post('/verify-email', userController.verifyEmail)
router.post('/resend-code', userController.resendCode)
router.get('/', userController.getAll)

module.exports = router
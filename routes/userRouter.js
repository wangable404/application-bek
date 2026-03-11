const Router = require('express')
const userController = require('../controllers/userController')
const authMiddleware = require('../middleware/middleware')
const router = new Router()

router.post('/create', userController.create)
router.post('/registration', userController.registration)
router.post('/login', userController.login)
router.patch('/:id', authMiddleware, userController.update);
router.post('/verify-email', userController.verifyEmail)
router.post('/resend-code', userController.resendCode)
router.get('/auth/check', authMiddleware, userController.check)
router.get('/admin', authMiddleware, userController.getAllAdmin)
router.get('/', userController.getAll)
router.delete('/:id', userController.delete)

module.exports = router
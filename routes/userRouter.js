const Router = require('express')
const userController = require('../controllers/userController')
const authMiddleware = require('../middleware/middleware')
const router = new Router()

router.post('/create', authMiddleware, userController.create)
router.post('/push-token', authMiddleware, userController.savePushToken)
router.post('/registration', userController.registration)
router.post('/login', userController.login)
router.patch('/:id', authMiddleware, userController.update);
router.post('/verify-email', userController.verifyEmail)
router.post('/resend-code', userController.resendCode)
router.get('/auth/check', authMiddleware, userController.check)
router.get('/admin', authMiddleware, userController.getAllAdmin)
router.get('/company', authMiddleware, userController.getCompanys)
router.get('/', userController.getAll)
router.delete('/:id', authMiddleware, userController.delete)

router.post('/invite', authMiddleware, userController.inviteCreate)
router.get('/invite/companies', authMiddleware, userController.getCompanies)
router.get('/invite/integrators', authMiddleware, userController.getIntegrators)

module.exports = router
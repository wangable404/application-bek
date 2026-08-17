const Router = require('express')
const router = new Router()
const userRouter = require('./userRouter')
const applicationRouter = require('./applicationRouter')
const chatRouter = require('./chatRouter')
const subscriptionRouter = require('./subscriptionRouter')
const maxRouter = require('./maxRouter')

router.use('/user', userRouter)
router.use('/application', applicationRouter)
router.use('/chats', chatRouter)
router.use('/subscription', subscriptionRouter)
router.use('/max', maxRouter)

module.exports = router
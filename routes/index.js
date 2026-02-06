const Router = require('express')
const router = new Router()
const userRouter = require('./userRouter')
const applicationRouter = require('./applicationRouter')
const chatRouter = require('./chatRouter')

router.use('/user', userRouter)
router.use('/application', applicationRouter)
router.use('/chats', chatRouter)

module.exports = router
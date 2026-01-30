require('dotenv').config()
const express = require('express')
const sequelize = require('./db')
const cors = require('cors')
const model = require('./models/model')
const fileUpload = require('express-fileupload');
const router = require('./routes/index')

const PORT = process.env.PORT || 8000

const app = express()
app.use(cors())
app.use(express.json())

const start = async () => {
    try {
        await sequelize.authenticate()
        await sequelize.sync()
        app.get('/', (req, res) => {
            res.send('Dashboard is running!')
        })

        app.use(express.json())
        app.use(fileUpload());

        app.use('/api/v1/', router)

        app.listen(PORT, '0.0.0.0', () => {
            console.log(`Server is running on port ${PORT}`)
        })
    } catch (err) {
        console.log('Error connecting to the database:', err);
    }
}

start()
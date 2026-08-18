const { Sequelize } = require('sequelize')

module.exports = new Sequelize(
    process.env.DB_NAME,
    process.env.DB_USER,
    process.env.DB_PASSWORD,
    {
        host: process.env.DB_HOST,
        dialect: 'postgres',
        port: process.env.DB_PORT,
        dialectOptions: {
            ssl: {
                require: true,
                rejectUnauthorized: false,
            },
        },
        // Пул Neon (pooler-эндпоинт) сам закрывает простаивающие соединения
        // со своей стороны — если Sequelize отдаёт клиенту уже протухшее
        // соединение из своего пула, запрос падает с "Connection terminated
        // unexpectedly" (это и ловили в логах). idle меньше, чем таймаут
        // на стороне пулера, не даёт соединениям залёживаться настолько,
        // чтобы их успели прибить с той стороны.
        pool: {
            max: 5,
            min: 0,
            acquire: 30000,
            idle: 10000,
        },
        // Плюс — автоматический повтор самого запроса при обрыве
        // соединения посреди работы (не только при установке соединения,
        // это Sequelize и так ретраит по умолчанию).
        retry: {
            max: 3,
            match: [
                /Connection terminated unexpectedly/i,
                /ECONNRESET/i,
                /ETIMEDOUT/i,
                /SequelizeConnectionError/,
                /SequelizeConnectionRefusedError/,
                /SequelizeHostNotFoundError/,
                /SequelizeHostNotReachableError/,
                /SequelizeInvalidConnectionError/,
                /SequelizeConnectionTimedOutError/,
            ],
        },
    }
)
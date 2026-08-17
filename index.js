require("dotenv").config();
const express = require("express");
const http = require("http");
const sequelize = require("./db");
const cors = require("cors");
const model = require("./models/model");
const fileUpload = require("express-fileupload");
const errorHeandler = require("./middleware/ErrorHeadlingMiddleware");
const router = require("./routes/index");
const path = require("path");
const initSocket = require("./socket");

require("./cron/billing.cron");

const PORT = process.env.PORT || 8000;

const app = express();
app.use(cors());
app.use(express.json());
app.use(fileUpload({}));
app.use(express.static(path.resolve(__dirname, "static")));
app.use("/api/v1/", router);

app.use(errorHeandler);

app.get("/", (req, res) => {
  res.send("Dashboard is running!");
});

// В проекте нет отдельных миграций — новые таблицы (например, недавняя
// max_bot_sessions) создаются через sequelize.sync() на старте. Но это
// ~2 запроса на каждую модель при КАЖДОМ рестарте, даже когда схема не
// менялась, — на нестабильном канале до Neon (see ECONNRESET на проде)
// это просто лишние шансы оборваться на полпути. Поэтому sync можно
// выключить там, где схема уже накатана, выставив DB_SYNC=false в .env,
// и включать точечно (DB_SYNC=true) только когда добавлена новая модель.
const shouldSync = process.env.DB_SYNC !== "false";

const start = async () => {
  try {
    await sequelize.authenticate();

    if (shouldSync) {
      await sequelize.sync();
    } else {
      console.log("DB_SYNC=false — sequelize.sync() пропущен при старте");
    }

    const server = http.createServer(app);
    const io = initSocket(server);

    app.locals.io = io;
    app.set("io", io);

    console.log("Socket.io attached to app");

    server.listen(PORT, "0.0.0.0", () => {
      console.log(`Server is running on port ${PORT}`);
      console.log(`WebSocket доступен по ws://0.0.0.0:${PORT}`);
    });
  } catch (err) {
    console.log("Error connecting to the database:", err);
  }
};

start();

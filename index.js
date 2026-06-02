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

const start = async () => {
  try {
    await sequelize.authenticate();
    await sequelize.sync();

    const server = http.createServer(app);
    const io = initSocket(server);

    // Сохраняем io в app locals
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

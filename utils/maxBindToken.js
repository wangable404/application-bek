// utils/maxBindToken.js
//
// Токен для привязки MAX-аккаунта через deep link (?start=...).
// Раньше был JWT — но MAX обрезает/не передаёт payload диплинка длиннее
// 128 символов, а подписанный JWT с userId (UUID) внутри выходит далеко
// за этот лимит (реально наблюдали: MAX присылал bot_started вообще без
// payload). Поэтому здесь — короткий случайный opaque-токен, а сам userId
// и срок жизни хранятся на сервере (таблица max_bind_tokens), не в самом
// токене. Заодно он безопаснее JWT: даже частичный перехват токена не даёт
// расшифровать/угадать, чей это аккаунт.
const crypto = require("crypto");
const { MaxBindToken } = require("../models/model");

const TTL_MS = 15 * 60 * 1000;

async function generateBindToken(userId) {
  const token = crypto.randomBytes(18).toString("base64url");
  await MaxBindToken.create({
    token,
    userId,
    expiresAt: new Date(Date.now() + TTL_MS),
  });
  return token;
}

// Одноразовый: успешно проверенный токен сразу удаляется.
async function verifyBindToken(token) {
  if (!token) {
    throw new Error("Отсутствует токен привязки");
  }

  const record = await MaxBindToken.findOne({ where: { token } });
  if (!record) {
    throw new Error("Токен привязки не найден");
  }

  if (record.expiresAt.getTime() < Date.now()) {
    await record.destroy();
    throw new Error("Токен привязки истёк");
  }

  const userId = record.userId;
  await record.destroy();
  return userId;
}

module.exports = { generateBindToken, verifyBindToken };

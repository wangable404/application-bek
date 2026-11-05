// utils/maxBindToken.js
//
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

const jwt = require("jsonwebtoken");

const generateJwt = (
  id,
  firstName,
  lastName,
  email,
  city,
  phone,
  balance,
  role,
) => {
  const payload = {
    id,
    firstName,
    lastName,
    email,
    city,
    phone,
    balance,
    role,
  };
  return jwt.sign(payload, process.env.SECRET_KEY, { expiresIn: "24h" });
};

// Короткоживущий токен для привязки MAX-аккаунта через deep link (?start=...).
// Не голый userId: иначе перехвативший ссылку/скриншот мог бы привязать
// свой MAX-чат к чужому аккаунту и получить доступ к заявкам/чату/отчётам.
const generateBindToken = (userId) =>
  jwt.sign({ purpose: "max_bind", userId }, process.env.SECRET_KEY, {
    expiresIn: "15m",
  });

const verifyBindToken = (token) => {
  const decoded = jwt.verify(token, process.env.SECRET_KEY);
  if (decoded.purpose !== "max_bind") {
    throw new Error("Invalid token purpose");
  }
  return decoded.userId;
};

// Системный токен, которым MAX-бот вызывает внутренние REST-эндпоинты
// bek от имени привязанного пользователя (та же авторизация, что у фронта).
const generateSystemJwt = (user) =>
  generateJwt(
    user.id,
    user.firstName,
    user.lastName,
    user.email,
    user.city,
    user.phone,
    user.balance,
    user.role,
  );

module.exports = {
  generateJwt,
  generateBindToken,
  verifyBindToken,
  generateSystemJwt,
};

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
  generateSystemJwt,
};

const { User } = require("../models/model");
const ApiError = require("../error/ApiError");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const { sendVerificationMail } = require("../services/mailService");
const uuid = require('uuid')

const generateJwt = (id, firstName, lastName, email) => {
  const payload = { id, firstName, lastName, email };
  return jwt.sign(payload, process.env.SECRET_KEY, { expiresIn: "24h" });
};

class UserController {
  async registration(req, res, next) {
    try {
      const { firstName, lastName, email, password } = req.body;

      if(!firstName || !lastName || !email || !password){
        return next(ApiError.badRequest('Заполните все необходимые поля'))
      }

      const candidate = await User.findOne({ where: { email } });
      if (candidate) {
        return next(ApiError.badRequest("Пользователь уже существует"));
      }

      const code = Math.floor(100000 + Math.random() * 900000).toString();
      const expires = new Date(Date.now() + 10 * 60 * 1000);

      const hashPassword = await bcrypt.hash(password, 10);

      await User.create({
        firstName,
        lastName,
        email,
        password: hashPassword,
        emailCode: code,
        emailCodeExpires: expires,
      });

      await sendVerificationMail(email, code);

      return res.json({
        message: "Код подтверждения отправлен на почту",
      });
    } catch (err) {
      next(ApiError.badRequest(err.message));
    }
  }
  async resendCode(req, res, next) {
    try {
      const { email } = req.body;
      const user = await User.findOne({ where: { email } });
      if (!user) {
        return next(ApiError.badRequest("Пользователь не найден"));
      }

      const code = Math.floor(100000 + Math.random() * 900000).toString();
      const expires = new Date(Date.now() + 10 * 60 * 1000);

      user.emailCode = code;
      user.emailCodeExpires = expires;
      await user.save();

      await sendVerificationMail(email, code);

      return res.json({
        message: "Код подтверждения отправлен на почту",
      });
    } catch (err) {
      return next(ApiError.badRequest(err.message));
    }
  }
  async verifyEmail(req, res, next) {
    try {
      const { email, code } = req.body;

      const user = await User.findOne({ where: { email } });
      if (!user) {
        return next(ApiError.badRequest("Пользователь не найден"));
      }

      if (user.isVerified) {
        return next(ApiError.badRequest("Почта уже подтверждена"));
      }

      if (user.emailCode !== code || user.emailCodeExpires < new Date()) {
        return next(ApiError.badRequest("Неверный или просроченный код"));
      }

      user.isVerified = true;
      user.emailCode = null;
      user.emailCodeExpires = null;
      await user.save();

      const token = generateJwt(
        user.id,
        user.firstName,
        user.lastName,
        user.email,
      );

      return res.json({ token });
    } catch (err) {
      next(ApiError.badRequest(err.message));
    }
  }
  async login(req, res, next) {
    try {
      const { email, password } = req.body;
      const user = await User.findOne({ where: { email } });
      if (!user) {
        return next(ApiError.badRequest("Пользователь не найден"));
      }
      if (!user.isVerified) {
        return next(ApiError.forbidden("Подтвердите почту"));
      }
      const comparePassword = await bcrypt.compare(password, user.password);
      if (!comparePassword) {
        return next(ApiError.badRequest("Неверный пароль"));
      }
      const token = generateJwt(
        user.id,
        user.firstName,
        user.lastName,
        user.email,
      );
      return res.json({ token });
    } catch (err) {
      next(ApiError.badRequest(err.message));
    }
  }
  async getAll(req, res, next) {
    try {
      // const id = req.user.id;
      
      // const user = await User.findByPk(id);
      // if (user.role !== "ADMIN") {
      //   return next(ApiError.forbidden("Нет доступа"));
      // }
      const users = await User.findAll({
        attributes: ["id", "firstName", "lastName", "email", "role"],
      });
      return res.json(users);
    } catch (err) {
      return next(ApiError.badRequest(err.message));
    }
  }
}

module.exports = new UserController();

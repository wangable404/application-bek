const { User } = require("../models/model");
const ApiError = require("../error/ApiError");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const { sendVerificationMail } = require("../services/mailService");
const uuid = require("uuid");

const generateJwt = (id, firstName, lastName, email, role) => {
  const payload = { id, firstName, lastName, email, role };
  return jwt.sign(payload, process.env.SECRET_KEY, { expiresIn: "24h" });
};

class UserController {
  async create(req, res, next) {
    try {
      const user = req.user;

      if (user.role == "ADMIN") {
        return next(ApiError.badRequest("Нет доступа"));
      }

      const { firstName, lastName, email, password, role } = req.body;
      const create = await User.create({
        firstName,
        lastName,
        email,
        password,
        role,
      });
      return res.json(create);
    } catch (err) {
      return next(ApiError.badRequest(err.message));
    }
  }
  async registration(req, res, next) {
    try {
      const { firstName, lastName, email, password } = req.body;

      if (!firstName || !lastName || !email || !password) {
        return next(ApiError.badRequest("Заполните все необходимые поля"));
      }

      const user = await User.findOne({ where: { email } });

      const hashPassword = await bcrypt.hash(password, 10);

      const code = Math.floor(100000 + Math.random() * 900000).toString();
      const expires = new Date(Date.now() + 10 * 60 * 1000);

      if (user) {
        if (user.isVerified) {
          return next(ApiError.badRequest("Пользователь уже существует"));
        }

        await user.update({
          lastName,
          firstName,
          password: hashPassword,
          emailCode: code,
          emailCodeExpires: expires,
        });

        await sendVerificationMail(email, code);

        return res.json({
          message: "Код подтверждения повторно отправлен на почту",
        });
      }

      await User.create({
        firstName,
        lastName,
        email,
        password: hashPassword,
        emailCode: code,
        emailCodeExpires: expires,
        isVerified: false,
      });

      await sendVerificationMail(email, code);

      return res.json({
        message: "Код подтверждения отправлен на почту",
      });
    } catch (err) {
      console.error(err);
      return next(ApiError.internal("Ошибка регистрации"));
    }
  }

  async resendCode(req, res, next) {
    try {
      const { email } = req.body;
      const user = await User.findOne({ where: { email } });
      if (!user) {
        return next(ApiError.badRequest("Пользователь не найден"));
      }

      if (user.isVerified) {
        return next(ApiError.badRequest("Почта уже подтверждена"));
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
        user.role,
      );

      return res.json({ token });
    } catch (err) {
      next(ApiError.badRequest(err.message));
    }
  }
  async login(req, res, next) {
    try {
      const { email, password, isAdmin } = req.body;
      const user = await User.findOne({ where: { email } });
      if (!user) {
        return next(ApiError.badRequest("Пользователь не найден"));
      }

      if (isAdmin && user.role !== "ADMIN") {
        return next(ApiError.forbidden("Нет доступа"));
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
        user.role,
      );
      return res.json({ token });
    } catch (err) {
      next(ApiError.badRequest(err.message));
    }
  }
  async check(req, res, next) {
    try {
      const userId = req.user.id;
      const user = await User.findByPk(userId, {
        attributes: ["id", "firstName", "lastName", "email", "role"],
      });

      if (!user) {
        return next(ApiError.unauthorized("Пользователь не найден"));
      }

      return res.json({ user });
    } catch (err) {
      next(ApiError.badRequest(err.message));
    }
  }
  async getAll(req, res, next) {
    try {
      const users = await User.findAll({
        attributes: ["id", "firstName", "lastName", "email", "role"],
      });
      return res.json(users);
    } catch (err) {
      return next(ApiError.badRequest(err.message));
    }
  }

  async getAllAdmin(req, res, next) {
    try {
      const id = req.user.id;
      const user = await User.findByPk(id);
      if (user.role !== "ADMIN") {
        return next(ApiError.forbidden("Нет доступа"));
      }
      const users = await User.findAll();
      return res.json(users);
    } catch (err) {
      return next(ApiError.badRequest(err.message));
    }
  }

  async update(req, res, next) {
    try {
      const { id } = req.params;
      const { firstName, lastName, email, password, role } = req.body;
      const authUser = req.user;

      if (authUser.role !== "ADMIN") {
        return next(ApiError.forbidden("Нет доступа"));
      }

      const user = await User.findByPk(id);
      if (!user) {
        return next(ApiError.notFound("Пользователь не найден"));
      }

      if (firstName !== undefined) user.firstName = firstName;
      if (lastName !== undefined) user.lastName = lastName;
      if (email !== undefined) user.email = email;
      if (role !== undefined) user.role = role;

      if (password !== undefined) {
        // если используешь хеширование
        const hashPassword = await bcrypt.hash(password, 5);
        user.password = hashPassword;
      }

      await user.save();

      return res.json(user);
    } catch (err) {
      return next(ApiError.badRequest(err.message));
    }
  }

  async delete(req,res,next){
    try {
      const {id} = req.params;
      const user = await User.findByPk(id);
      if(!user){
        return next(ApiError.notFound("Пользователь не найден"));
      }

      if(user.role !== "ADMIN"){
        return next(ApiError.forbidden("Нет доступа"));
      }

      await user.destroy();
      return res.json({message:"Пользователь удален"});
    } catch (err) {
      return next(ApiError.badRequest(err.message));
    }
  }
}

module.exports = new UserController();

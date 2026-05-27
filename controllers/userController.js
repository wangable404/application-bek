const { User, PushToken, Application, Invitation } = require("../models/model");
const ApiError = require("../error/ApiError");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const uuid = require("uuid");
const { sendPush } = require("../services/push.service");

const generateJwt = (id, firstName, lastName, email, city, phone, role) => {
  const payload = { id, firstName, lastName, email, city, phone, role };
  return jwt.sign(payload, process.env.SECRET_KEY, { expiresIn: "24h" });
};

class UserController {
  async create(req, res, next) {
    try {
      const user = req.user;

      if (user.role !== "ADMIN") {
        return next(ApiError.badRequest("Нет доступа"));
      }

      const { firstName, lastName, phone, city, email, password, role } =
        req.body;

      const hashPassword = await bcrypt.hash(password, 10);

      const create = await User.create({
        firstName,
        lastName,
        email,
        phone,
        city,
        password: hashPassword,
        role,
        isVerified: true,
      });
      return res.json(create);
    } catch (err) {
      return next(ApiError.badRequest(err.message));
    }
  }
  async savePushToken(req, res) {
    const { token } = req.body;
    const userId = req.user.id;

    const existing = await PushToken.findOne({
      where: { token, userId },
    });

    if (!existing) {
      const other = await PushToken.findOne({ where: { token } });
      if (other) {
        other.userId = userId;
        await other.save();
      } else {
        await PushToken.create({ token, userId });
      }
    }

    res.json({ success: true });
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
          // emailCode: code,
          // emailCodeExpires: expires,
        });

        // await sendVerificationMail(email, code);

        return res.json({
          message: "Код подтверждения повторно отправлен на почту",
        });
      }

      await User.create({
        firstName,
        lastName,
        email,
        password: hashPassword,
        // emailCode: code,
        // emailCodeExpires: expires,
        isVerified: false,
      });

      // await sendVerificationMail(email, code);

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

      // await sendVerificationMail(email, code);

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

      if (isAdmin && user.role === "USER") {
        return next(ApiError.forbidden("Нет доступа"));
      }

      if (!isAdmin && user.role !== "USER") {
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
        user.city,
        user.phone,
        user.role,
      );
      return res.json({
        token,
        user: {
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          city: user.city,
          phone: user.phone,
          role: user.role,
        },
      });
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
        attributes: ["id", "firstName", "lastName", "email", "role", "city"],
        where: { role: "USER" },
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

      if (user.role !== "ADMIN" && user.role !== "COMPANY") {
        return next(ApiError.forbidden("Нет доступа"));
      }

      if (user.role === "ADMIN") {
        const users = await User.findAll({
          where: { role: "USER" },
          include: [{ model: Application, as: "assignedApplications" }],
        });
        return res.json(users);
      }

      if (user.role === "COMPANY") {
        const users = await User.findAll({
          where: { role: "USER", isVerified: true },
        });
        return res.json(users);
      }
    } catch (err) {
      return next(ApiError.badRequest(err.message));
    }
  }

  async getCompanys(req, res, next) {
    try {
      const user = req.user;

      if (user.role !== "ADMIN") {
        return next(ApiError.forbidden("Нет доступа"));
      }

      const companys = await User.findAll({ where: { role: "COMPANY" } });

      return res.json(companys);
    } catch (err) {
      return next(ApiError.badRequest(err.message));
    }
  }

  async update(req, res, next) {
    try {
      const { id } = req.params;
      const {
        firstName,
        lastName,
        email,
        phone,
        city,
        password,
        role,
        isVerified,
      } = req.body;
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
      if (phone !== undefined) user.phone = phone;
      if (city !== undefined) user.city = city;
      if (isVerified !== undefined) user.isVerified = isVerified;

      if (password !== undefined) {
        // если используешь хеширование
        const hashPassword = await bcrypt.hash(password, 10);
        user.password = hashPassword;
      }

      await user.save();

      return res.json(user);
    } catch (err) {
      return next(ApiError.badRequest(err.message));
    }
  }

  async delete(req, res, next) {
    try {
      const { id } = req.params;
      const deletedUser = await User.findByPk(id);
      if (!deletedUser) {
        return next(ApiError.notFound("Пользователь не найден"));
      }

      const user = req.user;

      if (user.role !== "ADMIN") {
        return next(ApiError.forbidden("Нет доступа"));
      }

      await deletedUser.destroy();
      return res.json({ message: "Пользователь удален" });
    } catch (err) {
      return next(ApiError.badRequest(err.message));
    }
  }

  async inviteCreate(req, res, next) {
    try {
      const { userId } = req.body;

      const user = req.user;

      if (user.role !== "COMPANY") {
        return next(ApiError.forbidden("Только компания может приглашать"));
      }

      const integrator = await User.findByPk(userId);
      if (!integrator) {
        return next(ApiError.notFound("Пользователь не найден"));
      }

      if (integrator.role !== "USER") {
        return next(
          ApiError.badRequest("Можно приглашать только интеграторов"),
        );
      }

      const existing = await Invitation.findOne({
        where: { userId, companyId: user.id },
      });
      if (existing) {
        return next(ApiError.badRequest("Пользователь уже приглашён"));
      }

      const tokens = await PushToken.findAll({
        where: { userId },
        attributes: ["token"],
      });

      await sendPush(
        tokens.map((t) => t.token),
        `Приглашение от компании`,
        `Компания ${user.firstName} ${user.lastName} приглашает вас в свою компанию`,
        {
          screen: `/(tabs)/companys`,
        },
      );

      const invitation = await Invitation.create({
        userId,
        companyId: user.id,
      });

      return res.json(invitation);
    } catch (err) {
      return next(ApiError.badRequest(err.message));
    }
  }

  async getCompanies(req, res, next) {
    try {
      const userId = req.user.id;

      const invitations = await Invitation.findAll({
        where: { userId },
        include: [{ model: User, as: "company" }],
      });

      return res.json(invitations);
    } catch (err) {
      return next(ApiError.badRequest(err.message));
    }
  }

  async getIntegrators(req, res, next) {
    try {
      const companyId = req.user.id;

      const invitations = await Invitation.findAll({
        where: { companyId },
        include: [{ model: User, as: "integrator" }],
      });

      return res.json(invitations);
    } catch (err) {
      return next(ApiError.badRequest(err.message));
    }
  }
}

module.exports = new UserController();

// controllers/subscriptionController.js
const { Plan, Payment, User } = require("../models/model");
const ApiError = require("../error/ApiError");
const {
  selectPlan,
  topUp,
  getDaysForAmount,
  checkAccess,
} = require("../services/subscription.service");
const { Op } = require("sequelize");

class SubscriptionController {
  // Все тарифы (публично)
  async getPlans(req, res, next) {
    try {
      const user = req.user;

      if (user.role == "ADMIN") {
        const plans = await Plan.findAll();

        return res.json(plans);
      }
      const plans = await Plan.findAll({ where: { isActive: true } });
      return res.json(plans);
    } catch (err) {
      return next(ApiError.badRequest(err.message));
    }
  }

  // Создать тариф (только ADMIN)
  async createPlan(req, res, next) {
    try {
      const user = req.user;
      if (user.role !== "ADMIN") {
        return next(ApiError.forbidden("Нет доступа"));
      }

      const { name, pricePerMonth, maxIntegrators } = req.body;
      if (!name || !pricePerMonth || !maxIntegrators) {
        return next(ApiError.badRequest("Заполните все поля"));
      }

      // pricePerDay считаем автоматически из pricePerMonth
      const pricePerDay = Math.round(pricePerMonth / 30);

      const plan = await Plan.create({
        name,
        pricePerMonth,
        pricePerDay,
        maxIntegrators,
      });

      return res.json(plan);
    } catch (err) {
      return next(ApiError.badRequest(err.message));
    }
  }

  // Обновить тариф (только ADMIN)
  async updatePlan(req, res, next) {
    try {
      const user = req.user;
      if (user.role !== "ADMIN") {
        return next(ApiError.forbidden("Нет доступа"));
      }

      const { id } = req.params;
      const { name, pricePerMonth, maxIntegrators, isActive } = req.body;

      const plan = await Plan.findByPk(id);
      if (!plan) {
        return next(ApiError.notFound("Тариф не найден"));
      }

      if (name !== undefined) plan.name = name;
      if (maxIntegrators !== undefined) plan.maxIntegrators = maxIntegrators;
      if (isActive !== undefined) plan.isActive = isActive;

      // При изменении цены пересчитываем дневную стоимость
      if (pricePerMonth !== undefined) {
        plan.pricePerMonth = pricePerMonth;
        plan.pricePerDay = Math.round(pricePerMonth / 30);
      }

      await plan.save();
      return res.json(plan);
    } catch (err) {
      return next(ApiError.badRequest(err.message));
    }
  }

  // Удалить тариф (только ADMIN)
  async deletePlan(req, res, next) {
    try {
      const user = req.user;
      if (user.role !== "ADMIN") {
        return next(ApiError.forbidden("Нет доступа"));
      }

      const { id } = req.params;
      const plan = await Plan.findByPk(id);
      if (!plan) {
        return next(ApiError.notFound("Тариф не найден"));
      }

      // Не удаляем физически — деактивируем,
      // чтобы не сломать пользователей на этом тарифе
      plan.isActive = false;
      await plan.save();

      return res.json({ message: "Тариф деактивирован" });
    } catch (err) {
      return next(ApiError.badRequest(err.message));
    }
  }

  // Выбрать / сменить тариф
  async choosePlan(req, res, next) {
    try {
      const { planId } = req.body;
      const userId = req.user.id;
      const user = await selectPlan(userId, planId);
      return res.json(user);
    } catch (err) {
      return next(ApiError.badRequest(err.message));
    }
  }

  // Статус подписки текущего пользователя
  async getStatus(req, res, next) {
    try {
      const user = req.user;

      if (user.role == "ADMIN") {
        return res.json({
          allowed: true,
          admin: true,
        });
      }

      const access = await checkAccess(req.user.id);
      return res.json(access);
    } catch (err) {
      return next(ApiError.badRequest(err.message));
    }
  }

  // Сколько дней даст сумма
  async calcDays(req, res, next) {
    try {
      const { amount } = req.body;
      const days = await getDaysForAmount(req.user.id, amount);
      return res.json({ days, amount });
    } catch (err) {
      return next(ApiError.badRequest(err.message));
    }
  }

  // Пополнить баланс (вебхук от платёжки)
  async topUp(req, res, next) {
    try {
      const { userId, amount, paymentRef } = req.body;
      const payment = await topUp(userId, amount, paymentRef);
      return res.json(payment);
    } catch (err) {
      return next(ApiError.badRequest(err.message));
    }
  }

  // История платежей текущего пользователя
  async getPayments(req, res, next) {
    try {
      const user = req.user;

      if (user.role == "ADMIN") {
        const payments = await Payment.findAll({
          order: [["createdAt", "DESC"]],
          include: [{ model: User, as: "user" }],
        });

        return res.json(payments);

        const result = payments.map((payment) => {
          const p = payment.toJSON();
          const balance = p.user?.balance ?? 0;
          const pricePerDay = p.user?.plan?.pricePerDay ?? 1;
          return {
            ...p,
            user: {
              ...p.user,
              balance,
              daysLeft: Math.floor(balance / pricePerDay),
            },
          };
        });

        return res.json(result);
      }

      const payments = await Payment.findAll({
        where: { userId: user.id },
        order: [["createdAt", "DESC"]],
      });
      return res.json(payments);
    } catch (err) {
      return next(ApiError.badRequest(err.message));
    }
  }

  // Все компании с остатком дней (только ADMIN)
  async getCompaniesWithDays(req, res, next) {
    try {
      const user = req.user;
      if (user.role !== "ADMIN") {
        return next(ApiError.forbidden("Нет доступа"));
      }

      const companies = await User.findAll({
        where: {
          role: "COMPANY",
          planId: { [Op.not]: null },
        },
        include: [
          {
            model: Plan,
            as: "plan",
            attributes: [
              "name",
              "pricePerMonth",
              "pricePerDay",
              "maxIntegrators",
              "isActive",
            ],
          },
        ],
        attributes: [
          "id",
          "firstName",
          "lastName",
          "email",
          "balance",
          "isBlocked",
          "trialEndsAt",
        ],
      });

      const result = companies.map((company) => {
        const c = company.toJSON();
        const pricePerDay = c.plan?.pricePerDay ?? 1;

        if (c.trialEndsAt && new Date(c.trialEndsAt) > new Date()) {
          const msLeft = new Date(c.trialEndsAt) - new Date();
          const trialDaysLeft = Math.ceil(msLeft / (1000 * 60 * 60 * 24));
          return {
            ...c,
            balance: c.balance,
            daysLeft: trialDaysLeft,
            status: "trial",
          };
        }

        if (c.isBlocked) {
          return {
            ...c,
            balance: c.balance,
            daysLeft: 0,
            status: "blocked",
          };
        }

        // Активен
        const daysLeft = Math.floor(c.balance / pricePerDay);
        return {
          ...c,
          balance: c.balance,
          daysLeft,
          status: daysLeft <= 3 ? "warning" : "active",
        };
      });

      result.sort((a, b) => {
        const order = { blocked: 0, warning: 1, trial: 2, active: 3 };
        return order[a.status] - order[b.status];
      });

      return res.json(result);
    } catch (err) {
      return next(ApiError.badRequest(err.message));
    }
  }
}

module.exports = new SubscriptionController();

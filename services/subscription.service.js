// services/subscription.service.js
const { User, Plan, Payment } = require("../models/model");
const { Op } = require("sequelize");

const TRIAL_DAYS = 7;

// Выбор тарифа при регистрации (или смена тарифа)
async function selectPlan(userId, planId) {
  const user = await User.findByPk(userId);
  const plan = await Plan.findByPk(planId);

  if (!plan || !plan.isActive) throw new Error("Тариф не найден");

  const isFirstTime = !user.planId;

  if (isFirstTime) {
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + TRIAL_DAYS);

    await user.update({ planId, trialEndsAt, isBlocked: false });
  } else {
    await user.update({ planId });
  }

  return user;
}

// Пополнение баланса
async function topUp(userId, amount, paymentRef = null) {
  if (paymentRef) {
    const existing = await Payment.findOne({ where: { paymentRef } });
    if (existing) return existing;
  }

  const user = await User.findByPk(userId);
  if (!user) throw new Error("Пользователь не найден");

  // Записываем платёж
  const payment = await Payment.create({
    userId,
    amount,
    paymentRef,
  });

  // Пополняем баланс
  user.balance = user.balance + amount;

  // Если был заблокирован — автоматически разблокируем
  if (user.isBlocked) {
    user.isBlocked = false;
  }

  await user.save();
  return payment;
}

// Узнать сколько дней даёт сумма по текущему тарифу
async function getDaysForAmount(userId, amount) {
  const user = await User.findByPk(userId, { include: [{ model: Plan }] });
  if (!user?.plan) throw new Error("Тариф не выбран");

  return Math.floor(amount / user.plan.pricePerDay);
}

// Списание за день (запускается cron-ом каждые сутки)
async function chargeDaily() {
  const users = await User.findAll({
    where: {
      planId: { [Op.not]: null },
      isBlocked: false,
      [Op.or]: [
        { trialEndsAt: null },
        { trialEndsAt: { [Op.lt]: new Date() } },
      ],
    },
    include: [{ model: Plan }],
  });

  for (const user of users) {
    const dailyPrice = user.plan.pricePerDay;

    if (user.balance >= dailyPrice) {
      // Достаточно денег — списываем
      user.balance -= dailyPrice;
      await user.save();
    } else {
      user.isBlocked = true;
      await user.save();
    }
  }
}

// Проверить доступ (используется в middleware)

async function checkAccess(userId) {
  const user = await User.findByPk(userId, {
    include: [{ model: Plan, as: "plan" }],
  });

  if (!user.planId) {
    return {
      allowed: false,
      reason: "no_plan",
    };
  }

  if (user.trialEndsAt && user.trialEndsAt > new Date()) {
    return {
      allowed: true,
      trial: true,
      trialEndsAt: user.trialEndsAt,
    };
  }

  if (user.isBlocked) {
    return {
      allowed: false,
      reason: "blocked",
    };
  }

  if (user.balance <= 0) {
    return {
      allowed: false,
      reason: "no_balance",
    };
  }

  return {
    allowed: true,
    trial: false,
    balance: user.balance,
    daysLeft: Math.floor(user.balance / user.plan.pricePerDay),
    plan: {
      name: user.plan.name,
      pricePerMonth: user.plan.pricePerMonth,
      pricePerDay: user.plan.pricePerDay,
      maxIntegrators: user.plan.maxIntegrators,
    }
  };
}

module.exports = {
  selectPlan,
  topUp,
  getDaysForAmount,
  chargeDaily,
  checkAccess,
};

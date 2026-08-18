// bot/max/dispatcher.js — единая точка входа для апдейтов MAX Bot API.
// Разбирает update_type и раздаёт управление сценариям. Всё общение с
// интегратором идёт инлайн-кнопками (attachments: inline_keyboard) —
// свободный текст принимается только там, где кнопкой это в принципе
// не заменить (дата, комментарий, IMEI, сообщения в чате), чтобы бот и
// мобильное приложение не путали пользователя двумя разными способами
// делать одно и то же.
const { MaxChat, User } = require("../../models/model");
const { verifyBindToken } = require("../../utils/maxBindToken");
const { maxSendMessage, maxAnswerCallback } = require("../../services/max.service");
const { getSession, resetSession } = require("./session");

const menu = require("./scenarios/menu");
const applications = require("./scenarios/applications");
const startWork = require("./scenarios/startWork");
const completeWork = require("./scenarios/completeWork");
const chat = require("./scenarios/chat");

async function resolveUser(chatId) {
  const maxChat = await MaxChat.findOne({ where: { chatId: String(chatId) } });
  if (!maxChat) return null;
  const user = await User.findByPk(maxChat.userId);
  return user;
}

// TODO: убрать после того, как вживую сверим реальный формат апдейтов MAX
// (message_callback/message_created/attachments) с тем, что предполагает
// код ниже — публичная документация местами отдавалась не полностью.
const DEBUG_LOG_UPDATES = process.env.MAX_DEBUG_LOG_UPDATES !== "false";

async function handleUpdate(update) {
  if (DEBUG_LOG_UPDATES) {
    console.log("MAX update:", JSON.stringify(update));
  }

  switch (update.update_type) {
    case "bot_started":
      return handleBotStarted(update);
    case "message_callback":
      return handleCallback(update);
    case "message_created":
      return handleMessage(update);
    default:
      // остальные типы (bot_added/removed, chat_title_changed и т.п.) боту не нужны
      return;
  }
}

async function handleBotStarted(update) {
  const chatId = String(update.chat_id);
  const token = update.payload;

  let userId;
  try {
    userId = await verifyBindToken(token);
  } catch (err) {
    await maxSendMessage(
      chatId,
      "Ссылка для привязки недействительна или устарела. Откройте приложение, " +
        "войдите заново и получите новую ссылку.",
    );
    return;
  }

  await MaxChat.upsert({ userId, chatId });
  await menu.showWelcome(chatId);
}

async function handleCallback(update) {
  // Реальный апдейт: chat_id лежит в update.message.recipient.chat_id
  // (message — это сообщение с кнопкой, под которой нажали), а не
  // в update.callback или в update.chat_id, как можно было бы ожидать
  // по аналогии с Telegram.
  const chatId = String(
    update.message?.recipient?.chat_id ?? update.callback?.chat_id ?? update.chat_id,
  );
  const callbackId = update.callback?.callback_id;
  const payload = update.callback?.payload || "";

  // Не ждём ответа MAX на answerCallback (это просто снимает "часики" с
  // кнопки) — он не влияет на дальнейшую логику, а ждать его синхронно
  // означало добавлять ещё один внешний round-trip к каждому нажатию,
  // даже для кнопок вроде "Пропустить", которые вообще не ходят в БД.
  if (callbackId) {
    maxAnswerCallback(callbackId);
  }

  const user = await resolveUser(chatId);
  if (!user) return notLinked(chatId);

  try {
    await routeCallback(chatId, user, payload);
  } catch (err) {
    console.log("max bot callback error:", err.response?.data || err.message);
    await maxSendMessage(chatId, friendlyErrorText(err));
  }
}

async function routeCallback(chatId, user, payload) {
  const [ns, action, arg] = payload.split(":");
  const session = await getSession(chatId, user.id);

  if (payload === "scenario:cancel") {
    await resetSession(chatId);
    return applications.listApplications(chatId, user);
  }

  if (ns === "menu") {
    switch (action) {
      case "root":
        return menu.showRoot(chatId);
      case "applications":
        return applications.listApplications(chatId, user);
      case "help":
        return menu.showHelp(chatId);
    }
    return;
  }

  if (ns === "app") {
    switch (action) {
      case "open":
        return applications.showCard(chatId, user, arg);
      case "accept":
        return applications.accept(chatId, user, arg);
      case "reject":
        return applications.reject(chatId, user, arg);
    }
    return;
  }

  if (ns === "work") {
    switch (action) {
      case "start":
        return startWork.begin(chatId, arg);
      case "complete":
        return completeWork.begin(chatId, arg);
      case "skip_comment":
        return startWork.skipComment(chatId);
      case "type":
        return startWork.onWorkType(chatId, session, arg);
      case "confirm":
        return startWork.confirm(chatId, user, session);
    }
    return;
  }

  if (ns === "complete") {
    switch (action) {
      case "photos_done":
        return completeWork.photosDone(chatId, session);
      case "add_equipment":
        return completeWork.addEquipment(chatId);
      case "equipment_done":
        return completeWork.equipmentDone(chatId, session);
      case "skip_imei":
        return completeWork.skipImei(chatId, session);
      case "skip_imei_photo":
        return completeWork.skipImeiPhoto(chatId, session);
      case "car_more_yes":
        return completeWork.addAnotherCar(chatId, session);
      case "car_more_no":
        return completeWork.finishCars(chatId, session);
      case "add_more_car":
        return completeWork.addAnotherCar(chatId, session);
      case "skip_additional":
        return completeWork.skipAdditionalWork(chatId);
      case "act_yes":
        return completeWork.onActSigned(chatId, session, true);
      case "act_no":
        return completeWork.onActSigned(chatId, session, false);
      case "submit":
        return completeWork.submit(chatId, user, session);
      case "restart":
        return completeWork.confirmRestart(chatId);
      case "restart_yes":
        return completeWork.restart(chatId, session);
      case "restart_no":
        return completeWork.showSummary(chatId, session.data);
    }
    return;
  }

  if (ns === "chat") {
    switch (action) {
      case "open":
        return chat.open(chatId, user, arg);
      case "exit":
        return chat.exit(chatId, user, session);
    }
    return;
  }
}

async function handleMessage(update) {
  const chatId = String(update.message?.recipient?.chat_id ?? update.chat_id);
  const user = await resolveUser(chatId);
  if (!user) return notLinked(chatId);

  const body = update.message?.body || {};
  const text = (body.text || "").trim();
  const attachments = body.attachments || [];
  const photo = attachments.find((a) => a.type === "image");

  try {
    const session = await getSession(chatId, user.id);

    if (photo && session.scenario === "complete_work") {
      return await completeWork.onPhoto(chatId, session, photo);
    }

    if (session.scenario === "chat") {
      if (text && text.trim().toLowerCase() === "выйти") {
        return await chat.exit(chatId, user, session);
      }
      if (text) return await chat.forward(chatId, user, session, text);
      return;
    }

    if (session.scenario === "start_work") {
      if (session.step === "date" && text) return await startWork.onDate(chatId, session, text);
      if (session.step === "comment" && text) return await startWork.onComment(chatId, text);
      return await hint(chatId);
    }

    if (session.scenario === "complete_work") {
      if (session.step === "brand" && text) return await completeWork.onBrand(chatId, text);
      if (session.step === "plate" && text) return await completeWork.onPlate(chatId, text);
      if (session.step === "equipment_name" && text)
        return await completeWork.onEquipmentName(chatId, session, text);
      if (session.step === "equipment_imei" && text)
        return await completeWork.onEquipmentImei(chatId, session, text);
      if (session.step === "additional_work" && text)
        return await completeWork.onAdditionalWork(chatId, text);
      return await hint(chatId);
    }

    // idle — свободный текст не ожидается, подсказываем меню
    const lower = text.toLowerCase();
    if (lower === "помощь") {
      return await menu.showHelp(chatId);
    }
    await menu.showRoot(chatId);
  } catch (err) {
    console.log("max bot message error:", err.response?.data || err.message);
    await maxSendMessage(chatId, friendlyErrorText(err));
  }
}

// Бэкенд обычно уже кладёт понятную причину в err.response.data.message
// (ApiError) — показываем её вместо немого "попробуйте ещё раз", иначе
// пользователь просто зацикливается на одной и той же ошибке. Кнопку
// меню сюда специально не добавляем — на любом шаге доступна "Отмена".
//
// Но часть ошибок, которые долетают в этом же поле — не валидация, а
// сырые технические сбои (обрыв соединения с БД, таймаут) — их бэкенд
// заворачивает в тот же ApiError.badRequest(err.message), не различая
// "это для пользователя" и "это для логов". Такие показывать как есть
// нельзя, это не читаемо и не помогает — вместо этого просто "повторите
// попытку" (что и работает — при повторном нажатии обычно проходит).
const INFRA_ERROR_PATTERNS = [
  /connection terminated/i,
  /econnreset/i,
  /etimedout/i,
  /econnaborted/i,
  /econnrefused/i,
  /timeout/i,
  /sequelize/i,
  /can't deserialize body/i,
];

function friendlyErrorText(err) {
  const backendMessage = err?.response?.data?.message || err?.message;
  const isInfraError =
    !err?.response ||
    INFRA_ERROR_PATTERNS.some((re) => re.test(backendMessage || ""));

  if (isInfraError) {
    return "⚠️ Не удалось выполнить, попробуйте ещё раз.";
  }
  return `⚠️ ${backendMessage}`;
}

async function hint(chatId) {
  await maxSendMessage(chatId, "Пожалуйста, воспользуйтесь кнопками выше.");
}

async function notLinked(chatId) {
  await maxSendMessage(
    chatId,
    "Ваш MAX-аккаунт ещё не привязан. Откройте приложение, войдите и нажмите " +
      "«Подключить MAX» на экране входа.",
  );
}

module.exports = { handleUpdate };

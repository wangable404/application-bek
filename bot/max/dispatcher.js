// bot/max/dispatcher.js — единая точка входа для апдейтов MAX Bot API.
// Разбирает update_type и раздаёт управление сценариям. Всё общение с
// интегратором идёт инлайн-кнопками (attachments: inline_keyboard) —
// свободный текст принимается только там, где кнопкой это в принципе
// не заменить (дата, комментарий, IMEI, сообщения в чате), чтобы бот и
// мобильное приложение не путали пользователя двумя разными способами
// делать одно и то же.
const { MaxChat, User } = require("../../models/model");
const { verifyBindToken } = require("../../utils/jwt");
const { maxSendMessage, maxAnswerCallback } = require("../../services/max.service");
const { getSession, resetSession } = require("./session");
const { mainMenuKeyboard } = require("./keyboards");

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
    userId = verifyBindToken(token);
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
  const chatId = String(update.callback?.chat_id ?? update.chat_id);
  const callbackId = update.callback?.callback_id;
  const payload = update.callback?.payload || "";

  if (callbackId) {
    await maxAnswerCallback(callbackId);
  }

  const user = await resolveUser(chatId);
  if (!user) return notLinked(chatId);

  try {
    await routeCallback(chatId, user, payload);
  } catch (err) {
    console.log("max bot callback error:", err.response?.data || err.message);
    await maxSendMessage(chatId, "⚠️ Что-то пошло не так, попробуйте ещё раз.", mainMenuKeyboard());
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
      case "start_work":
        return applications.listForAction(chatId, user, {
          statusFilter: ["accepted"],
          actionPrefix: "work:start",
          emptyText: "Нет заявок, готовых к началу работы (нужен статус «принята»).",
        });
      case "complete_work":
        return applications.listForAction(chatId, user, {
          statusFilter: ["in_progress"],
          actionPrefix: "work:complete",
          emptyText: "Нет заявок в работе, которые можно завершить.",
        });
      case "chat":
        return applications.listForAction(chatId, user, {
          statusFilter: null,
          actionPrefix: "chat:open",
          emptyText: "У вас пока нет заявок.",
        });
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
        return completeWork.equipmentDone(chatId);
      case "skip_imei":
        return completeWork.skipImei(chatId, session);
      case "skip_imei_photo":
        return completeWork.skipImeiPhoto(chatId, session);
      case "skip_additional":
        return completeWork.skipAdditionalWork(chatId);
      case "act_yes":
        return completeWork.onActSigned(chatId, session, true);
      case "act_no":
        return completeWork.onActSigned(chatId, session, false);
      case "submit":
        return completeWork.submit(chatId, user, session);
      case "restart":
        return completeWork.restart(chatId, session);
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
  const chatId = String(update.message?.chat_id ?? update.chat_id);
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
    if (["меню", "помощь", "start", "старт", "/start"].includes(lower)) {
      return await menu.showRoot(chatId);
    }
    await menu.showRoot(chatId);
  } catch (err) {
    console.log("max bot message error:", err.response?.data || err.message);
    await maxSendMessage(chatId, "⚠️ Что-то пошло не так, попробуйте ещё раз.", mainMenuKeyboard());
  }
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

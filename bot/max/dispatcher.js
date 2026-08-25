// bot/max/dispatcher.js — единая точка входа для апдейтов MAX Bot API.
// Разбирает update_type и раздаёт управление сценариям. Всё общение с
// интегратором идёт инлайн-кнопками (attachments: inline_keyboard) —
// свободный текст принимается только там, где кнопкой это в принципе
// не заменить (дата, комментарий, IMEI, сообщения в чате), чтобы бот и
// мобильное приложение не путали пользователя двумя разными способами
// делать одно и то же.
const { MaxChat, MaxBotSession, User } = require("../../models/model");
const sequelize = require("../../db");
const { verifyBindToken } = require("../../utils/maxBindToken");
const { maxSendMessage, maxAnswerCallback } = require("../../services/max.service");
const { getSession, setScenario, resetSession } = require("./session");
const { rebindConfirmKeyboard } = require("./keyboards");

const menu = require("./scenarios/menu");
const companies = require("./scenarios/companies");
const applications = require("./scenarios/applications");
const startWork = require("./scenarios/startWork");
const completeWork = require("./scenarios/completeWork");
const chat = require("./scenarios/chat");

async function resolveUser(chatId) {
  // Один запрос вместо двух (MaxChat -> User одним include) — на каждый
  // апдейт от MAX это вызывается всегда первым, вторая последовательная
  // БД-round-trip тут просто не нужна.
  const maxChat = await MaxChat.findOne({
    where: { chatId: String(chatId) },
    include: [{ model: User }],
  });
  if (!maxChat?.user) return null;

  // Компания, выбранная интегратором для работы в боте (аналог company
  // из AuthContext в приложении) — вешаем прямо на user, чтобы не тащить
  // maxChat отдельным параметром через все сценарии.
  maxChat.user.maxCompanyId = maxChat.companyId;
  return maxChat.user;
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

  const existing = await MaxChat.findOne({ where: { chatId } });

  // Этот же MAX-чат уже привязан к другому интегратору. chatId не
  // уникален на уровне БД (уникален только userId — один интегратор не
  // может держать сразу два MAX-аккаунта), поэтому единственная защита
  // от того, чтобы один MAX-аккаунт оказался привязан сразу к двум
  // интеграторам — явное подтверждение здесь перед переносом привязки.
  if (existing && existing.userId !== userId) {
    await getSession(chatId, userId);
    await setScenario(chatId, "rebind_confirm", null, {
      data: { pendingUserId: userId },
    });

    const nextUser = await User.findByPk(userId);
    await maxSendMessage(
      chatId,
      "⚠️ Этот MAX-аккаунт уже подключён к другому аккаунту интегратора.\n\n" +
        `Подключить его к аккаунту${nextUser?.email ? ` ${nextUser.email}` : ""} ` +
        "вместо прежнего? Прежнее подключение будет удалено полностью.",
      rebindConfirmKeyboard(),
    );
    return;
  }

  await MaxChat.upsert({ userId, chatId });
  await resetSession(chatId);
  await menu.showWelcome(chatId);
}

// Полностью переносит MAX-чат на нового пользователя: удаляет ВСЕ строки,
// которые могут столкнуться с новой привязкой (и по chatId, и по userId —
// например, если для этого chatId ещё с тех пор, когда он не был защищён
// от повторной привязки, успело накопиться несколько дублирующихся строк
// на разных пользователей — DB_SYNC=false, поэтому unique(chatId) в схеме
// на реальную БД так и не накатился), и создаёт одну свежую строку.
// Специально не UPDATE/upsert "на месте" — так результат не зависит от
// того, сколько именно строк реально совпадёт по chatId.
async function rebindMaxChat(chatId, userId) {
  await sequelize.transaction(async (t) => {
    await MaxChat.destroy({ where: { chatId }, transaction: t });
    await MaxChat.destroy({ where: { userId }, transaction: t });
    await MaxChat.create({ userId, chatId, companyId: null }, { transaction: t });
  });
}

// Решение "переподключить / отменить" по конфликту из handleBotStarted.
// Отдельная ветка (не routeCallback): пока подтверждения нет, chatId
// формально ещё привязан к прежнему пользователю, и resolveUser(chatId)
// вернул бы именно его — обрабатывать эти кнопки через обычный маршрут
// с "чужим" user было бы неправильно.
async function handleBindDecision(chatId, action) {
  const session = await MaxBotSession.findOne({ where: { chatId } });
  const pendingUserId =
    session?.scenario === "rebind_confirm" ? session.data?.pendingUserId : null;

  if (!pendingUserId) {
    // Кнопка нажата повторно после того, как решение уже принято
    // (или сессия истекла) — просто игнорируем, не пугаем ошибкой.
    return;
  }

  // Атомарно "захватываем" это решение через условие scenario = 'rebind_confirm'
  // прямо в WHERE — не отдельным SELECT, а потом UPDATE. MAX иногда дублирует
  // доставку одного и того же клика (например, когда наш ответ на
  // answerCallback не прошёл — "Can't deserialize body" в логах), и если оба
  // экземпляра события придут почти одновременно, сценарий сменить и правда
  // переподключить аккаунт сможет только один из них — у второго это условие
  // в WHERE уже ничего не найдёт, и он тихо выйдет ниже.
  const [claimed] = await MaxBotSession.update(
    { scenario: "idle", step: null, applicationId: null, data: {} },
    { where: { chatId, scenario: "rebind_confirm" } },
  );
  if (!claimed) return;

  if (action === "cancel") {
    await maxSendMessage(chatId, "Отменено. Прежнее подключение MAX не изменено.");
    return;
  }

  if (action === "confirm") {
    try {
      await rebindMaxChat(chatId, pendingUserId);
    } catch (err) {
      console.log(
        "max bind confirm error:",
        err.original?.message || err.response?.data || err.message || err,
      );
      await maxSendMessage(
        chatId,
        "⚠️ Не удалось переподключить аккаунт, попробуйте ещё раз.",
      );
      return;
    }

    const user = await resolveUser(chatId);
    await menu.showWelcome(chatId, user);
  }
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

  const [bindNs, bindAction] = payload.split(":");
  if (bindNs === "bind") {
    try {
      return await handleBindDecision(chatId, bindAction);
    } catch (err) {
      console.log(
        "max bind decision error:",
        err.original?.message || err.response?.data || err.message || err,
      );
      await maxSendMessage(chatId, friendlyErrorText(err));
      return;
    }
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

// Без выбранной компании работать с заявками нельзя — так же, как
// приложение не показывает список заявок, пока не выбрана компания на
// главном экране (application-app/app/(tabs)/index.tsx).
function requiresCompany(ns, action) {
  if (ns === "app" || ns === "work" || ns === "apps") return true;
  if (ns === "chat" && action === "open") return true;
  return false;
}

async function routeToApplicationsOrGate(chatId, user) {
  if (!user.maxCompanyId) {
    return companies.promptSelect(chatId, user);
  }
  return applications.listApplications(chatId, user);
}

async function routeCallback(chatId, user, payload) {
  const [ns, action, arg] = payload.split(":");
  const session = await getSession(chatId, user.id);

  if (payload === "scenario:cancel") {
    await resetSession(chatId);
    return routeToApplicationsOrGate(chatId, user);
  }

  if (ns === "menu") {
    switch (action) {
      case "root":
        return menu.showRoot(chatId, user);
      case "applications":
        return routeToApplicationsOrGate(chatId, user);
      case "help":
        return menu.showHelp(chatId, user);
    }
    return;
  }

  if (ns === "company") {
    switch (action) {
      case "menu":
        return companies.showMenu(chatId, user);
      case "select":
        return companies.selectCompany(chatId, user, arg);
      case "invites":
        return companies.showInvitations(chatId, user);
      case "accept":
        return companies.respondInvite(chatId, user, arg, true);
      case "reject":
        return companies.respondInvite(chatId, user, arg, false);
    }
    return;
  }

  if (requiresCompany(ns, action) && !user.maxCompanyId) {
    return companies.promptSelect(chatId, user);
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

  if (ns === "apps") {
    switch (action) {
      case "status":
        return applications.listByStatus(chatId, user, arg);
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
        return chat.open(chatId, user, session, arg);
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
  const media = attachments.find((a) => a.type === "image" || a.type === "video");

  try {
    const session = await getSession(chatId, user.id);

    if (photo && session.scenario === "complete_work") {
      return await completeWork.onPhoto(chatId, session, photo);
    }

    if (session.scenario === "chat") {
      if (text && text.trim().toLowerCase() === "выйти") {
        return await chat.exit(chatId, user, session);
      }
      if (media) return await chat.forwardAttachment(chatId, user, session, media, text);
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

    // idle — свободный текст не ожидается, кроме пары именных команд
    const lower = text.toLowerCase();
    if (lower === "помощь") {
      return await menu.showHelp(chatId, user);
    }
    if (lower === "компании" || lower === "компания") {
      return await companies.showMenu(chatId, user);
    }
    await menu.showRoot(chatId, user);
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

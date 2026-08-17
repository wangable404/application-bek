// bot/max/keyboards.js
// Билдеры инлайн-клавиатур MAX Bot API.
// Формат: attachments: [{ type: "inline_keyboard", payload: { buttons: [[...]] } }]
// (в отличие от Telegram, кнопки едут не в reply_markup, а как элемент attachments).

function inlineKeyboard(rows) {
  return {
    type: "inline_keyboard",
    payload: { buttons: rows },
  };
}

function callbackButton(text, payload) {
  return { type: "callback", text, payload };
}

function linkButton(text, url) {
  return { type: "link", text, url };
}

// payload инлайн-кнопок — короткие машинно-читаемые строки вида
// "action:arg1:arg2", их разбирает bot/max/dispatcher.js

const mainMenuKeyboard = () =>
  inlineKeyboard([
    [callbackButton("📋 Мои заявки", "menu:applications")],
    [callbackButton("▶️ Начать работу", "menu:start_work")],
    [callbackButton("✅ Завершить работу", "menu:complete_work")],
    [callbackButton("💬 Чат с менеджером", "menu:chat")],
    [callbackButton("❓ Помощь", "menu:help")],
  ]);

const backToMenuKeyboard = () =>
  inlineKeyboard([[callbackButton("⬅️ В меню", "menu:root")]]);

const cancelKeyboard = () =>
  inlineKeyboard([[callbackButton("✖️ Отмена", "scenario:cancel")]]);

const applicationsListKeyboard = (applications) =>
  inlineKeyboard([
    ...applications.map((app) => [
      callbackButton(
        `#${app.dealId} · ${app.city || ""} · ${statusLabel(app.status)}`,
        `app:open:${app.id}`,
      ),
    ]),
    [callbackButton("⬅️ В меню", "menu:root")],
  ]);

const applicationCardKeyboard = (app) => {
  const rows = [];

  if (app.status === "pending") {
    rows.push([
      callbackButton("✅ Принять", `app:accept:${app.id}`),
      callbackButton("❌ Отклонить", `app:reject:${app.id}`),
    ]);
  }

  if (app.status === "accepted") {
    rows.push([callbackButton("▶️ Начать работу", `work:start:${app.id}`)]);
  }

  if (app.status === "in_progress") {
    rows.push([
      callbackButton("✅ Завершить работу", `work:complete:${app.id}`),
    ]);
  }

  rows.push([callbackButton("💬 Открыть чат", `chat:open:${app.id}`)]);
  rows.push([callbackButton("⬅️ К списку заявок", "menu:applications")]);

  return inlineKeyboard(rows);
};

// Для многошагового накопления (фото авто): "Готово" завершает сбор.
const doneKeyboard = (donePayload) =>
  inlineKeyboard([
    [callbackButton("✅ Готово", donePayload)],
    [callbackButton("✖️ Отмена", "scenario:cancel")],
  ]);

// Для одиночного необязательного текстового поля: одна кнопка "Пропустить".
const skipKeyboard = (skipPayload) =>
  inlineKeyboard([
    [callbackButton("⏭️ Пропустить", skipPayload)],
    [callbackButton("✖️ Отмена", "scenario:cancel")],
  ]);

const yesNoKeyboard = (yesPayload, noPayload) =>
  inlineKeyboard([
    [callbackButton("Да", yesPayload), callbackButton("Нет", noPayload)],
    [callbackButton("✖️ Отмена", "scenario:cancel")],
  ]);

const completeWorkSummaryKeyboard = () =>
  inlineKeyboard([
    [callbackButton("📤 Отправить", "complete:submit")],
    [callbackButton("🔄 Начать заново", "complete:restart")],
    [callbackButton("✖️ Отмена", "scenario:cancel")],
  ]);

const chatExitKeyboard = () =>
  inlineKeyboard([[callbackButton("🚪 Выйти из чата", "chat:exit")]]);

function statusLabel(status) {
  const labels = {
    pending: "новая",
    accepted: "принята",
    in_progress: "в работе",
    review: "на проверке",
    completed: "завершена",
    approved: "одобрена",
    rejected: "отклонена",
  };
  return labels[status] || status;
}

module.exports = {
  inlineKeyboard,
  callbackButton,
  linkButton,
  mainMenuKeyboard,
  backToMenuKeyboard,
  cancelKeyboard,
  applicationsListKeyboard,
  applicationCardKeyboard,
  doneKeyboard,
  skipKeyboard,
  yesNoKeyboard,
  completeWorkSummaryKeyboard,
  chatExitKeyboard,
  statusLabel,
};

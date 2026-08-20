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

// Единственная точка входа. Дальше пользователь всегда идёт через
// конкретную заявку: её карточка сама показывает нужные действия по
// статусу (принять/отклонить, начать работу, завершить работу) и кнопку
// чата — так же, как в application-app/app/modal.tsx. Отдельных
// верхнеуровневых кнопок "Начать работу"/"Завершить работу"/"Чат" нет,
// чтобы не путать пользователя, к какой заявке они относятся.
//
// Без выбранной компании (как и в приложении — там это обязательный шаг
// на главном экране) работать с заявками нельзя, поэтому вместо
// "Все заявки" показываем только выбор компании.
const mainMenuKeyboard = (hasCompany) =>
  hasCompany
    ? inlineKeyboard([
        [callbackButton("📋 Все заявки", "menu:applications")],
        [callbackButton("🏢 Сменить компанию", "company:menu")],
      ])
    : inlineKeyboard([[callbackButton("🏢 Выбрать компанию", "company:menu")]]);

const backToMenuKeyboard = () =>
  inlineKeyboard([[callbackButton("⬅️ В меню", "menu:root")]]);

const cancelKeyboard = () =>
  inlineKeyboard([[callbackButton("✖️ Отмена", "scenario:cancel")]]);

const applicationsListKeyboard = (applications) =>
  inlineKeyboard([
    ...applications.map((app) => [
      callbackButton(
        `#${app.dealId} · ${app.clientBio || app.city || "—"} · ${statusLabel(app.status)}`,
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

const doneKeyboard = (donePayload) =>
  inlineKeyboard([
    [callbackButton("✅ Готово", donePayload)],
    [callbackButton("✖️ Отмена", "scenario:cancel")],
  ]);

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
    [callbackButton("🚗 Добавить ещё автомобиль", "complete:add_more_car")],
    [callbackButton("🔄 Начать всё заново", "complete:restart")],
    [callbackButton("✖️ Отмена", "scenario:cancel")],
  ]);

const restartConfirmKeyboard = () =>
  inlineKeyboard([
    [callbackButton("Да, стереть всё", "complete:restart_yes")],
    [callbackButton("Нет, вернуться", "complete:restart_no")],
  ]);

const carMoreKeyboard = () =>
  inlineKeyboard([
    [
      callbackButton("✅ Да, ещё авто", "complete:car_more_yes"),
      callbackButton("➡️ Нет, дальше", "complete:car_more_no"),
    ],
    [callbackButton("✖️ Отмена", "scenario:cancel")],
  ]);

const chatExitKeyboard = () =>
  inlineKeyboard([[callbackButton("🚪 Выйти из чата", "chat:exit")]]);

// Компании, к которым интегратор уже принят — выбор "текущей" (аналог
// setCompany в приложении). currentCompanyId подсвечивать нечем в чате
// (кнопки не умеют "активное" состояние), поэтому просто помечаем текст.
const companiesListKeyboard = (companies, currentCompanyId, pendingCount) => {
  const rows = companies.map((c) => [
    callbackButton(
      `${c.id === currentCompanyId ? "✅ " : ""}${c.firstName || ""} ${c.lastName || ""}`.trim(),
      `company:select:${c.id}`,
    ),
  ]);

  rows.push([
    callbackButton(
      pendingCount > 0 ? `✉️ Приглашения (${pendingCount})` : "✉️ Приглашения",
      "company:invites",
    ),
  ]);
  rows.push([callbackButton("⬅️ В меню", "menu:root")]);

  return inlineKeyboard(rows);
};

const invitationCardKeyboard = (invitation) =>
  inlineKeyboard([
    [
      callbackButton("✅ Принять", `company:accept:${invitation.id}`),
      callbackButton("❌ Отклонить", `company:reject:${invitation.id}`),
    ],
  ]);

const backToCompaniesKeyboard = () =>
  inlineKeyboard([[callbackButton("⬅️ К компаниям", "company:menu")]]);

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
  restartConfirmKeyboard,
  carMoreKeyboard,
  chatExitKeyboard,
  companiesListKeyboard,
  invitationCardKeyboard,
  backToCompaniesKeyboard,
  statusLabel,
};

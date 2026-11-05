// bot/max/keyboards.js

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


//
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

const APPLICATIONS_PAGE_SIZE = 30;

const applicationsListKeyboard = (applications, backPayload = "menu:applications") =>
  inlineKeyboard([
    ...applications.slice(0, APPLICATIONS_PAGE_SIZE).map((app) => [
      callbackButton(
        `#${app.dealId} · ${app.clientBio || app.city || "—"} · ${statusLabel(app.status)}`,
        `app:open:${app.id}`,
      ),
    ]),
    [callbackButton("⬅️ К статусам", backPayload)],
  ]);

const applicationsStatusMenuKeyboard = (tabs) =>
  inlineKeyboard([
    ...tabs.map((t) => [callbackButton(`${t.label} (${t.count})`, `apps:status:${t.key}`)]),
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
    rows.push([callbackButton("📆 Указать дату", `work:start:${app.id}`)]);
  }

  if (app.status === "in_progress") {
    rows.push([
      callbackButton("✅ Завершить работу", `work:complete:${app.id}`),
    ]);
  }

  rows.push([callbackButton("💬 Открыть чат", `chat:open:${app.id}`)]);
  rows.push([callbackButton("⬅️ К заявкам", "menu:applications")]);

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

const rebindConfirmKeyboard = () =>
  inlineKeyboard([
    [callbackButton("✅ Да, переподключить", "bind:confirm")],
    [callbackButton("✖️ Отмена", "bind:cancel")],
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

const applicationLinkKeyboard = (applicationId) =>
  inlineKeyboard([[callbackButton("📂 Открыть заявку", `app:open:${applicationId}`)]]);

const chatLinkKeyboard = (applicationId) =>
  inlineKeyboard([[callbackButton("💬 Открыть чат", `chat:open:${applicationId}`)]]);

const invitationLinkKeyboard = (invitationId) =>
  inlineKeyboard([
    [callbackButton("✉️ Перейти к приглашению", `company:open:${invitationId}`)],
  ]);

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
  APPLICATIONS_PAGE_SIZE,
  applicationsListKeyboard,
  applicationsStatusMenuKeyboard,
  applicationCardKeyboard,
  doneKeyboard,
  skipKeyboard,
  yesNoKeyboard,
  rebindConfirmKeyboard,
  completeWorkSummaryKeyboard,
  restartConfirmKeyboard,
  carMoreKeyboard,
  chatExitKeyboard,
  applicationLinkKeyboard,
  chatLinkKeyboard,
  invitationLinkKeyboard,
  companiesListKeyboard,
  invitationCardKeyboard,
  backToCompaniesKeyboard,
  statusLabel,
};

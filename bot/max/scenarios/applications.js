// bot/max/scenarios/applications.js — список заявок, карточка, принять/отклонить.
const { maxSendMessage } = require("../../../services/max.service");
const internalApi = require("../internalApi");
const {
  APPLICATIONS_PAGE_SIZE,
  applicationsListKeyboard,
  applicationsStatusMenuKeyboard,
  applicationCardKeyboard,
  statusLabel,
  backToMenuKeyboard,
} = require("../keyboards");

// Та же разбивка по статусам, что и в приложении
// (application-app/app/(tabs)/applications.tsx: STATUSES) — у компании
// заявок может быть и 200+, плоский список без фильтра по статусу
// бесполезен.
const STATUS_TABS = [
  { key: "all", label: "📋 Все" },
  { key: "pending", label: "⏳ В ожидании" },
  { key: "scheduled", label: "📅 Назначена дата" },
  { key: "in_progress", label: "⚙️ В работе" },
  { key: "review", label: "🔍 На проверке" },
  { key: "approved", label: "✅ Подтверждено" },
  { key: "rejected", label: "❌ Отклонено" },
];

// Копия фильтрации из application-app/app/(tabs)/applications.tsx
// (filteredAndSortedCards/getStatusCount) — "В ожидании" и "Назначена
// дата" оба разбирают status === "accepted" по наличию agreedDate.
function filterByStatus(applications, statusKey) {
  if (statusKey === "all") return applications;
  if (statusKey === "scheduled") {
    return applications.filter((a) => a.status === "accepted" && !!a.agreedDate);
  }
  if (statusKey === "pending") {
    return applications.filter(
      (a) => a.status === "pending" || (a.status === "accepted" && !a.agreedDate),
    );
  }
  return applications.filter((a) => a.status === statusKey);
}

function statusTabsWithCounts(applications) {
  return STATUS_TABS.map((t) => ({
    ...t,
    count: filterByStatus(applications, t.key).length,
  }));
}

async function listApplications(chatId, user) {
  const applications = await internalApi.getApplications(user, user.maxCompanyId);

  if (!applications.length) {
    await maxSendMessage(chatId, "У вас пока нет заявок.", backToMenuKeyboard());
    return;
  }

  await maxSendMessage(
    chatId,
    `Ваши заявки (${applications.length}). Выберите статус:`,
    applicationsStatusMenuKeyboard(statusTabsWithCounts(applications)),
  );
}

async function listByStatus(chatId, user, statusKey) {
  const applications = await internalApi.getApplications(user, user.maxCompanyId);
  const tab = STATUS_TABS.find((t) => t.key === statusKey);
  const filtered = filterByStatus(applications, statusKey);

  if (!filtered.length) {
    await maxSendMessage(
      chatId,
      `Нет заявок в статусе «${tab?.label || statusKey}».`,
      applicationsStatusMenuKeyboard(statusTabsWithCounts(applications)),
    );
    return;
  }

  const shown = Math.min(filtered.length, APPLICATIONS_PAGE_SIZE);
  const suffix = filtered.length > shown ? `, показаны первые ${shown}` : "";

  await maxSendMessage(
    chatId,
    `${tab?.label || statusKey} (${filtered.length}${suffix}):`,
    applicationsListKeyboard(filtered),
  );
}

function formatCard(app) {
  const lines = [
    `Заявка #${app.dealId}`,
    `Статус: ${statusLabel(app.status)}`,
  ];
  if (app.city) lines.push(`Город: ${app.city}`);
  if (app.clientBio) lines.push(`Клиент: ${app.clientBio}`);
  if (app.clientPhone) lines.push(`Телефон: ${app.clientPhone}`);
  if (app.carBrand) lines.push(`Марка авто: ${app.carBrand}`);
  if (app.date) lines.push(`Дата заявки: ${app.date}`);
  if (app.comment) lines.push(`Комментарий: ${app.comment}`);
  if (app.agreedDate) lines.push(`Согласованная дата: ${app.agreedDate}`);
  if (app.returnComment)
    lines.push(`⚠️ Возврат на доработку: ${app.returnComment}`);
  return lines.join("\n");
}

async function findApplication(user, applicationId) {
  const applications = await internalApi.getApplications(user, user.maxCompanyId);
  return applications.find((a) => String(a.id) === String(applicationId));
}

async function showCard(chatId, user, applicationId) {
  const app = await findApplication(user, applicationId);
  if (!app) {
    await maxSendMessage(chatId, "Заявка не найдена.", backToMenuKeyboard());
    return;
  }
  await maxSendMessage(chatId, formatCard(app), applicationCardKeyboard(app));
}

async function accept(chatId, user, applicationId) {
  await internalApi.changeStatus(user, applicationId, "accepted");
  await maxSendMessage(chatId, "🎉 Заявка принята. Теперь вы можете связаться с клиентом.");
  await showCard(chatId, user, applicationId);
}

async function reject(chatId, user, applicationId) {
  await internalApi.changeStatus(user, applicationId, "rejected");
  await maxSendMessage(chatId, "❌ Заявка отклонена.", backToMenuKeyboard());
}

module.exports = {
  listApplications,
  listByStatus,
  showCard,
  accept,
  reject,
  findApplication,
};

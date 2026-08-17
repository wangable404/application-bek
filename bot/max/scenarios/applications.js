// bot/max/scenarios/applications.js — список заявок, карточка, принять/отклонить.
const { maxSendMessage } = require("../../../services/max.service");
const internalApi = require("../internalApi");
const {
  applicationsListKeyboard,
  applicationCardKeyboard,
  statusLabel,
  backToMenuKeyboard,
} = require("../keyboards");

async function listApplications(chatId, user) {
  const applications = await internalApi.getApplications(user);

  if (!applications.length) {
    await maxSendMessage(chatId, "У вас пока нет заявок.", backToMenuKeyboard());
    return;
  }

  await maxSendMessage(
    chatId,
    `Ваши заявки (${applications.length}):`,
    applicationsListKeyboard(applications),
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
  const applications = await internalApi.getApplications(user);
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
  showCard,
  accept,
  reject,
  findApplication,
};

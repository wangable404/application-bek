// bot/max/scenarios/companies.js — выбор компании и приглашения.
// Аналог application-app/app/(screens)/companies.tsx и выбора компании на
// главном экране приложения: интегратор не может смотреть/вести заявки,
// пока не выбрал компанию, с которой работает (см. дispatcher.js — гейт
// перед app:/work:/chat:open).
const { maxSendMessage } = require("../../../services/max.service");
const { MaxChat } = require("../../../models/model");
const internalApi = require("../internalApi");
const {
  companiesListKeyboard,
  invitationCardKeyboard,
  backToCompaniesKeyboard,
} = require("../keyboards");
const { listApplications } = require("./applications");

function pendingOnly(invitations) {
  return invitations.filter((inv) => !inv.approved && !inv.rejected);
}

async function showMenu(chatId, user, { gated = false } = {}) {
  const [companies, invitations] = await Promise.all([
    internalApi.getCompanies(user),
    internalApi.getInvitations(user),
  ]);

  const acceptedCompanies = companies.map((inv) => inv.info).filter(Boolean);
  const pending = pendingOnly(invitations);

  let text = gated
    ? "⚠️ Сначала выберите компанию, с которой будете работать.\n\n"
    : "🏢 Компании\n\n";

  if (!acceptedCompanies.length) {
    text += pending.length
      ? "У вас пока нет ни одной компании. Есть приглашения, ожидающие ответа — примите одно из них."
      : "У вас пока нет компаний. Когда компания пригласит вас, приглашение появится здесь.";
  } else {
    text += "Выберите компанию, с которой будете работать:";
  }

  await maxSendMessage(
    chatId,
    text,
    companiesListKeyboard(acceptedCompanies, user.maxCompanyId, pending.length),
  );
}

async function promptSelect(chatId, user) {
  return showMenu(chatId, user, { gated: true });
}

async function selectCompany(chatId, user, companyId) {
  await MaxChat.update(
    { companyId },
    { where: { chatId: String(chatId) } },
  );

  await maxSendMessage(chatId, "✅ Компания выбрана.");

  // user переиспользуется дальше в этом же апдейте — обновляем на месте,
  // чтобы listApplications увидела уже выбранную компанию без лишнего похода в БД.
  user.maxCompanyId = companyId;
  await listApplications(chatId, user);
}

async function showInvitations(chatId, user) {
  const invitations = await internalApi.getInvitations(user);
  const pending = pendingOnly(invitations);

  if (!pending.length) {
    await maxSendMessage(
      chatId,
      "Нет приглашений, ожидающих ответа.",
      backToCompaniesKeyboard(),
    );
    return;
  }

  await maxSendMessage(chatId, `✉️ Приглашения, ожидающие ответа (${pending.length}):`);

  for (const invitation of pending) {
    const name =
      `${invitation.info?.firstName || ""} ${invitation.info?.lastName || ""}`.trim() ||
      "Компания";
    const lines = [`🏢 ${name}`];
    if (invitation.info?.city) lines.push(`Город: ${invitation.info.city}`);
    if (invitation.info?.phone) lines.push(`Телефон: ${invitation.info.phone}`);
    if (invitation.info?.description) lines.push(invitation.info.description);

    await maxSendMessage(chatId, lines.join("\n"), invitationCardKeyboard(invitation));
  }
}

async function respondInvite(chatId, user, invitationId, approved) {
  await internalApi.respondInvitation(user, invitationId, approved);
  await maxSendMessage(
    chatId,
    approved ? "✅ Приглашение принято." : "❌ Приглашение отклонено.",
  );
  await showMenu(chatId, user);
}

module.exports = {
  showMenu,
  promptSelect,
  selectCompany,
  showInvitations,
  respondInvite,
};

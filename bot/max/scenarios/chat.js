// bot/max/scenarios/chat.js — переписка по заявке через существующую
// модель Chat/Message (та же история, что видно в приложении и админке).
const { maxSendMessage } = require("../../../services/max.service");
const internalApi = require("../internalApi");
const { setScenario, resetSession } = require("../session");
const { chatExitKeyboard } = require("../keyboards");
const { showCard } = require("./applications");

const HISTORY_LIMIT = 10;

async function open(chatId, user, applicationId) {
  await setScenario(chatId, "chat", null, {
    applicationId,
    data: { applicationId },
  });

  const { chatId: internalChatId, messages } = await internalApi.getChat(
    user,
    applicationId,
  );
  await internalApi.markChatRead(user, internalChatId);

  const history = messages.slice(-HISTORY_LIMIT).map((m) => {
    const who = m.senderId === user.id ? "Вы" : m.user?.firstName || "Менеджер";
    return `${who}: ${m.text}`;
  });

  const intro =
    "💬 Менеджер скоро подключится к чату.\n" +
    "Чтобы выйти из чата, напишите «выйти».";

  const text = history.length
    ? `${intro}\n\n${history.join("\n")}`
    : intro;

  await maxSendMessage(chatId, text, chatExitKeyboard());
}

async function forward(chatId, user, session, text) {
  // Без "✓"-подтверждения — дальше это просто переписка, лишний ответ
  // бота на каждую реплику только мешает.
  await internalApi.sendChatMessage(user, session.data.applicationId, text);
}

async function exit(chatId, user, session) {
  const applicationId = session.data.applicationId;
  await resetSession(chatId);
  await maxSendMessage(chatId, "Вы вышли из чата.");
  await showCard(chatId, user, applicationId);
}

module.exports = { open, forward, exit };

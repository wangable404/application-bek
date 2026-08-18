// bot/max/scenarios/chat.js — переписка по заявке через существующую
// модель Chat/Message (та же история, что видно в приложении и админке).
const { maxSendMessage } = require("../../../services/max.service");
const internalApi = require("../internalApi");
const { setScenario, resetSession } = require("../session");
const { chatExitKeyboard } = require("../keyboards");
const { showCard } = require("./applications");

async function open(chatId, user, applicationId) {
  await setScenario(chatId, "chat", null, {
    applicationId,
    data: { applicationId },
  });

  // Сразу подключаем к чату, без истории и без ожидания похода в БД —
  // это просто должно быть быстро. Отметку "прочитано" делаем фоном,
  // на сам факт открытия чата это никак не влияет.
  await maxSendMessage(
    chatId,
    "💬 Вы подключены к чату с менеджером.\n" +
      "Чтобы выйти из чата, напишите «выйти».",
    chatExitKeyboard(),
  );

  internalApi
    .getChat(user, applicationId)
    .then(({ chatId: internalChatId }) => internalApi.markChatRead(user, internalChatId))
    .catch((err) => console.log("max chat markRead error:", err.message));
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

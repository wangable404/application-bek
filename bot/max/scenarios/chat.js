// bot/max/scenarios/chat.js — переписка по заявке через существующую
// модель Chat/Message (та же история, что видно в приложении и админке).
//
// Открытие чата должно быть мгновенным: никакой истории, никакого
// ожидания БД перед ответом. session сюда приходит уже загруженным из
// dispatcher.js (getSession уже вызывался, чтобы понять сценарий) — эти
// функции обновляют его напрямую (session.update), а не через
// session.js-хелперы, которые бы заново перезапрашивали ту же запись.
const { maxSendMessage } = require("../../../services/max.service");
const internalApi = require("../internalApi");
const { chatExitKeyboard } = require("../keyboards");
const { showCard } = require("./applications");

async function open(chatId, user, session, applicationId) {
  // Обновление сессии и отправка сообщения не зависят друг от друга —
  // запускаем параллельно, а не одно за другим.
  await Promise.all([
    session.update({
      scenario: "chat",
      step: null,
      applicationId,
      data: { applicationId },
    }),
    maxSendMessage(
      chatId,
      "💬 Вы подключены к чату с менеджером.\n" +
        "Чтобы выйти из чата, напишите «выйти».",
      chatExitKeyboard(),
    ),
  ]);

  // Отметка "прочитано" — фоном, никак не влияет на то, что чат уже открыт.
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
  await Promise.all([
    session.update({ scenario: "idle", step: null, applicationId: null, data: {} }),
    maxSendMessage(chatId, "Вы вышли из чата."),
  ]);
  await showCard(chatId, user, applicationId);
}

module.exports = { open, forward, exit };

//
const { maxSendMessage, maxDownloadAttachment } = require("../../../services/max.service");
const internalApi = require("../internalApi");
const { chatExitKeyboard } = require("../keyboards");
const { showCard } = require("./applications");

async function open(chatId, user, session, applicationId) {
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

  internalApi
    .getChat(user, applicationId)
    .then(({ chatId: internalChatId }) => internalApi.markChatRead(user, internalChatId))
    .catch((err) => console.log("max chat markRead error:", err.message));
}

async function forward(chatId, user, session, text) {
  await internalApi.sendChatMessage(user, session.data.applicationId, text);
}

async function forwardAttachment(chatId, user, session, attachment, caption) {
  const isVideo = attachment.type === "video";
  const buffer = await maxDownloadAttachment(attachment.payload?.url);

  if (!buffer) {
    await maxSendMessage(chatId, "⚠️ Не удалось загрузить файл, попробуйте ещё раз.");
    return;
  }

  const filename = `${isVideo ? "video" : "photo"}_${Date.now()}${isVideo ? ".mp4" : ".jpg"}`;
  const mimeType = isVideo ? "video/mp4" : "image/jpeg";

  await internalApi.sendChatAttachment(
    user,
    session.data.applicationId,
    { buffer, filename, mimeType },
    caption,
  );
}

async function exit(chatId, user, session) {
  const applicationId = session.data.applicationId;
  await Promise.all([
    session.update({ scenario: "idle", step: null, applicationId: null, data: {} }),
    maxSendMessage(chatId, "Вы вышли из чата."),
  ]);
  await showCard(chatId, user, applicationId);
}

module.exports = { open, forward, forwardAttachment, exit };

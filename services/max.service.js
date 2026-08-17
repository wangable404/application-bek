// services/max.service.js
// Прямой клиент MAX Bot API (https://dev.max.ru/docs-api).
// Раньше сообщения уходили через отдельный relay-сервис (application-tgbot);
// теперь бэкенд сам ходит в MAX API — relay для MAX не даёт никакой защиты
// от блокировок мобильного интернета (это трафик сервер-сервер и до, и после),
// а только добавляет лишний хоп и точку отказа.
const axios = require("axios");

const MAX_API = "https://platform-api2.max.ru";
const MAX_BOT_TOKEN = process.env.MAX_BOT_TOKEN;

const maxApi = axios.create({
  baseURL: MAX_API,
  headers: { Authorization: MAX_BOT_TOKEN },
});

/**
 * Отправить текстовое сообщение, опционально с инлайн-клавиатурой.
 * @param {string|number} chatId
 * @param {string} text
 * @param {object} [keyboard] - результат keyboards.js (attachments-объект inline_keyboard)
 */
async function maxSendMessage(chatId, text, keyboard) {
  try {
    const attachments = keyboard ? [keyboard] : undefined;
    const response = await maxApi.post(
      "/messages",
      { text, attachments },
      { params: { chat_id: chatId } },
    );
    return response.data;
  } catch (err) {
    console.log("max sendMessage error:", err.response?.data || err.message);
    return null;
  }
}

/**
 * Отправить фото по прямой ссылке (используется для показа уже загруженных
 * фотоотчётов пользователю в чате бота).
 */
async function maxSendPhotoByUrl(chatId, photoUrl, caption) {
  try {
    const uploadRes = await maxApi.post("/uploads", null, {
      params: { type: "image" },
    });
    const uploadUrl = uploadRes.data?.url;
    if (!uploadUrl) return null;

    const fileResponse = await axios.get(photoUrl, {
      responseType: "arraybuffer",
    });

    const form = new FormData();
    form.append(
      "file",
      new Blob([fileResponse.data]),
      "photo.jpg",
    );

    const uploaded = await axios.post(uploadUrl, form);
    const token = uploaded.data?.photos
      ? Object.values(uploaded.data.photos)[0]?.token
      : uploaded.data?.token;

    if (!token) return null;

    return maxApi.post(
      "/messages",
      {
        text: caption || "",
        attachments: [{ type: "image", payload: { token } }],
      },
      { params: { chat_id: chatId } },
    );
  } catch (err) {
    console.log("max sendPhoto error:", err.response?.data || err.message);
    return null;
  }
}

/**
 * Скачать фото/файл, присланный пользователем боту.
 * MAX присылает вложение в виде { type: "image", payload: { token, url } } —
 * url уже даёт прямой доступ к файлу, отдельный запрос за ссылкой не нужен.
 * @returns {Promise<Buffer|null>}
 */
async function maxDownloadAttachment(url) {
  try {
    const response = await axios.get(url, { responseType: "arraybuffer" });
    return Buffer.from(response.data);
  } catch (err) {
    console.log("max download attachment error:", err.message);
    return null;
  }
}

/**
 * Убрать "часики"/подтвердить нажатие инлайн-кнопки, опционально обновив
 * текст/клавиатуру сообщения, под которым была кнопка.
 */
async function maxAnswerCallback(callbackId, options = {}) {
  try {
    await maxApi.post(
      "/answers",
      {
        message: options.text
          ? {
              text: options.text,
              attachments: options.keyboard ? [options.keyboard] : undefined,
            }
          : undefined,
        notification: options.notification,
      },
      { params: { callback_id: callbackId } },
    );
  } catch (err) {
    console.log("max answerCallback error:", err.response?.data || err.message);
  }
}

module.exports = {
  maxSendMessage,
  maxSendPhotoByUrl,
  maxDownloadAttachment,
  maxAnswerCallback,
};

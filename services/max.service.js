// services/max.service.js
// Прямой клиент MAX Bot API (https://dev.max.ru/docs-api).
// Раньше сообщения уходили через отдельный relay-сервис (application-tgbot);
// теперь бэкенд сам ходит в MAX API — relay для MAX не даёт никакой защиты
// от блокировок мобильного интернета (это трафик сервер-сервер и до, и после),
// а только добавляет лишний хоп и точку отказа.
const axios = require("axios");
const https = require("https");

const MAX_API = "https://platform-api2.max.ru";
const MAX_BOT_TOKEN = process.env.MAX_BOT_TOKEN;

// keepAlive: без него каждый вызов (а на одно нажатие кнопки их обычно
// минимум два — answerCallback + ответное сообщение) заново поднимает
// TLS-соединение до platform-api2.max.ru, это и давало заметные задержки
// даже там, где нет никакой работы с БД.
const keepAliveAgent = new https.Agent({ keepAlive: true });

const maxApi = axios.create({
  baseURL: MAX_API,
  headers: { Authorization: MAX_BOT_TOKEN },
  httpsAgent: keepAliveAgent,
  timeout: 15000,
});

// Изредка запросы до platform-api2.max.ru рвутся на нестабильном канале
// прямо в процессе (видели и ECONNRESET, и "Can't deserialize body" —
// похоже на повреждение тела запроса при обрыве, а не баг в самом теле,
// раз оно не меняется и ошибка не всегда). Один быстрый повтор почти
// ничего не стоит, а для сообщений в чате — единственное, что реально
// решает жалобу "сообщения не доходят".
async function postWithRetry(path, body, config, attempts = 2) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      return await maxApi.post(path, body, config);
    } catch (err) {
      lastErr = err;
      if (i < attempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, 300 * (i + 1)));
      }
    }
  }
  throw lastErr;
}

/**
 * Отправить текстовое сообщение, опционально с инлайн-клавиатурой.
 * @param {string|number} chatId
 * @param {string} text
 * @param {object} [keyboard] - результат keyboards.js (attachments-объект inline_keyboard)
 */
async function maxSendMessage(chatId, text, keyboard) {
  try {
    const attachments = keyboard ? [keyboard] : undefined;
    const response = await postWithRetry(
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
      httpsAgent: keepAliveAgent,
      timeout: 30000,
    });

    const form = new FormData();
    form.append(
      "file",
      new Blob([fileResponse.data]),
      "photo.jpg",
    );

    const uploaded = await axios.post(uploadUrl, form, {
      httpsAgent: keepAliveAgent,
      timeout: 30000,
    });
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
    const response = await axios.get(url, {
      responseType: "arraybuffer",
      httpsAgent: keepAliveAgent,
      timeout: 30000,
    });
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
    // MAX требует, чтобы в теле обязательно был message ИЛИ notification —
    // пустой {} отклоняется ("`message` or `notification` required").
    // Раз мы почти всегда шлём отдельным сообщением что произошло дальше
    // (а не редактируем исходное сообщение с кнопкой), по умолчанию просто
    // убираем "часики" коротким тихим notification.
    const body = options.text
      ? {
          message: {
            text: options.text,
            attachments: options.keyboard ? [options.keyboard] : undefined,
          },
        }
      : { notification: { text: options.notification || " " } };

    await postWithRetry("/answers", body, { params: { callback_id: callbackId } });
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

// services/max.service.js
const axios = require("axios");
const https = require("https");

const MAX_API = "https://platform-api2.max.ru";
const MAX_BOT_TOKEN = process.env.MAX_BOT_TOKEN;

const keepAliveAgent = new https.Agent({ keepAlive: true });

const maxApi = axios.create({
  baseURL: MAX_API,
  headers: { Authorization: MAX_BOT_TOKEN },
  httpsAgent: keepAliveAgent,
  timeout: 15000,
});

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

const sendQueues = new Map();

function maxSendMessage(chatId, text, keyboard) {
  const key = String(chatId);
  const prev = sendQueues.get(key) || Promise.resolve();

  const run = prev.then(() => doSendMessage(chatId, text, keyboard));
  sendQueues.set(key, run.catch(() => {}));

  return run;
}

async function doSendMessage(chatId, text, keyboard) {
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

function maxSendAttachment(chatId, buffer, filename, mimeType, caption) {
  const key = String(chatId);
  const prev = sendQueues.get(key) || Promise.resolve();

  const run = prev.then(() =>
    doSendAttachment(chatId, buffer, filename, mimeType, caption),
  );
  sendQueues.set(key, run.catch(() => {}));

  return run;
}

async function doSendAttachment(chatId, buffer, filename, mimeType, caption) {
  try {
    const attachmentType = mimeType?.startsWith("video") ? "video" : "image";

    const uploadRes = await maxApi.post("/uploads", null, {
      params: { type: attachmentType },
    });
    const uploadUrl = uploadRes.data?.url;
    if (!uploadUrl) return null;

    const form = new FormData();
    form.append("file", new Blob([buffer], { type: mimeType }), filename);

    const uploaded = await axios.post(uploadUrl, form, {
      httpsAgent: keepAliveAgent,
      timeout: 60000,
    });
    const token =
      attachmentType === "image" && uploaded.data?.photos
        ? Object.values(uploaded.data.photos)[0]?.token
        : uploaded.data?.token;

    if (!token) return null;

    return maxApi.post(
      "/messages",
      {
        text: caption || "",
        attachments: [{ type: attachmentType, payload: { token } }],
      },
      { params: { chat_id: chatId } },
    );
  } catch (err) {
    console.log("max sendAttachment error:", err.response?.data || err.message);
    return null;
  }
}

async function maxSendPhotoByUrl(chatId, photoUrl, caption) {
  try {
    const fileResponse = await axios.get(photoUrl, {
      responseType: "arraybuffer",
      httpsAgent: keepAliveAgent,
      timeout: 30000,
    });

    return await maxSendAttachment(
      chatId,
      Buffer.from(fileResponse.data),
      "photo.jpg",
      "image/jpeg",
      caption,
    );
  } catch (err) {
    console.log("max sendPhoto error:", err.response?.data || err.message);
    return null;
  }
}

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

async function maxAnswerCallback(callbackId, options = {}) {
  try {
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
  maxSendAttachment,
  maxSendPhotoByUrl,
  maxDownloadAttachment,
  maxAnswerCallback,
};

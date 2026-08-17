// bot/max/internalApi.js
//
// MAX-бот не дублирует бизнес-логику: он вызывает те же REST-эндпоинты
// bek, что и мобильное приложение (application-app/app/modal.tsx),
// с тем же телом запроса. Это внутренний loopback-вызов в тот же процесс
// (127.0.0.1), а не поход на публичный BACKEND_URL — тот самый домен,
// который блокируется на мобильном интернете, здесь ни при чём:
// сервер стучится сам в себя.
const axios = require("axios");
const { generateSystemJwt } = require("../../utils/jwt");

const PORT = process.env.PORT || 8000;
const BASE_URL = `http://127.0.0.1:${PORT}/api/v1`;

function client(user) {
  const token = generateSystemJwt(user);
  return axios.create({
    baseURL: BASE_URL,
    headers: { Authorization: `Bearer ${token}` },
  });
}

async function getApplications(user) {
  const { data } = await client(user).get("/application/", {
    params: { userId: user.id },
  });
  return data;
}

async function changeStatus(user, applicationId, status) {
  const { data } = await client(user).post(
    `/application/${applicationId}/${status}/status`,
    {},
  );
  return data;
}

async function startWork(user, applicationId, { agreedDate, startWorkComment, workType }) {
  const { data } = await client(user).post(
    `/application/${applicationId}/start-work`,
    { agreedDate, startWorkComment, workType },
  );
  return data;
}

/**
 * @param {object} draft - собранный ходом диалога черновик
 * @param {string} draft.brand
 * @param {string} draft.stateNumber
 * @param {{buffer: Buffer, filename: string}[]} draft.photos
 * @param {{equipment: string, imei: string, imeiPhoto?: {buffer: Buffer, filename: string}}[]} draft.equipment
 * @param {string} [draft.completionComment]
 * @param {string} [draft.additionalWork]
 * @param {boolean} [draft.actSigned]
 */
async function completeApplication(user, applicationId, draft) {
  const form = new FormData();
  form.append("brand", draft.brand);
  form.append("stateNumber", draft.stateNumber);
  form.append("completionComment", draft.completionComment || "");
  form.append("additionalWork", draft.additionalWork || "");
  form.append("actSigned", draft.actSigned ? "true" : "false");
  form.append("sendType", "default");

  for (const photo of draft.photos) {
    form.append("photos", new Blob([photo.buffer]), photo.filename);
  }

  draft.equipment.forEach((eq, index) => {
    form.append(`equipment[${index}].equipment`, eq.equipment);
    if (eq.imei) form.append(`equipment[${index}].imei`, eq.imei);
    if (eq.imeiPhoto) {
      form.append(
        `equipment[${index}].imeiPhoto`,
        new Blob([eq.imeiPhoto.buffer]),
        eq.imeiPhoto.filename,
      );
    }
  });

  const { data } = await client(user).post(
    `/application/${applicationId}/complete`,
    form,
  );
  return data;
}

async function getChat(user, applicationId) {
  const { data } = await client(user).get(`/chats/${applicationId}/chat`);
  return data;
}

async function sendChatMessage(user, applicationId, text) {
  const { data } = await client(user).post(
    `/chats/${applicationId}/chat/message`,
    { text },
  );
  return data;
}

async function markChatRead(user, chatId) {
  const { data } = await client(user).patch(`/chats/${chatId}/read`);
  return data;
}

module.exports = {
  getApplications,
  changeStatus,
  startWork,
  completeApplication,
  getChat,
  sendChatMessage,
  markChatRead,
};

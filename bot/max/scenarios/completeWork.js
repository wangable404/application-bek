// bot/max/scenarios/completeWork.js — FSM «Завершить работу»:
// фото авто -> марка -> госномер -> оборудование (имя, IMEI, фото IMEI)
// x N -> доп. работы -> акт -> сводка -> отправка.
//
// Фото не скачиваются сразу: во время диалога в data хранится только
// { token, url, filename } от MAX (JSON-совместимо, JSONB-колонка session.data
// не хранит бинарные данные). Реальные байты скачиваются с MAX и заливаются
// в POST /application/:id/complete только на шаге "Отправить" — это тот же
// multipart-запрос, что делает мобильное приложение.
const {
  maxSendMessage,
  maxDownloadAttachment,
} = require("../../../services/max.service");
const internalApi = require("../internalApi");
const { setScenario, setStep, patchData, resetSession } = require("../session");
const {
  cancelKeyboard,
  doneKeyboard,
  skipKeyboard,
  yesNoKeyboard,
  completeWorkSummaryKeyboard,
} = require("../keyboards");
const { showCard } = require("./applications");

async function begin(chatId, applicationId) {
  await setScenario(chatId, "complete_work", "photos", {
    applicationId,
    data: { applicationId, photos: [], equipment: [] },
  });
  await maxSendMessage(
    chatId,
    "✅ Завершение работы.\n\n" +
      "Шаг 1. Пришлите одно или несколько фото автомобиля. Когда всё " +
      "отправите — нажмите «Готово».",
    doneKeyboard("complete:photos_done"),
  );
}

async function onPhoto(chatId, session, attachment) {
  const photo = {
    token: attachment.payload?.token,
    url: attachment.payload?.url,
    filename: `photo_${Date.now()}.jpg`,
  };

  if (session.step === "photos") {
    const photos = [...(session.data.photos || []), photo];
    await patchData(chatId, { photos });
    await maxSendMessage(
      chatId,
      `Фото добавлено (всего: ${photos.length}). Пришлите ещё или нажмите «Готово».`,
      doneKeyboard("complete:photos_done"),
    );
    return;
  }

  if (session.step === "equipment_photo") {
    const equipment = [...(session.data.equipment || [])];
    const current = { ...session.data.currentEquipment, imeiPhoto: photo };
    await patchData(chatId, { currentEquipment: current });
    await finishEquipmentEntry(chatId, { ...session.data, currentEquipment: current, equipment });
    return;
  }
}

async function photosDone(chatId, session) {
  if (!(session.data.photos || []).length) {
    await maxSendMessage(
      chatId,
      "Нужно хотя бы одно фото автомобиля.",
      doneKeyboard("complete:photos_done"),
    );
    return;
  }
  await setStep(chatId, "brand");
  await maxSendMessage(chatId, "Шаг 2. Укажите марку автомобиля.", cancelKeyboard());
}

async function onBrand(chatId, text) {
  await patchData(chatId, { brand: text.trim() });
  await setStep(chatId, "plate");
  await maxSendMessage(chatId, "Шаг 3. Укажите госномер автомобиля.", cancelKeyboard());
}

async function onPlate(chatId, text) {
  await patchData(chatId, { stateNumber: text.trim() });
  await askAddEquipment(chatId);
}

async function askAddEquipment(chatId) {
  await setStep(chatId, "equipment_ask");
  await maxSendMessage(
    chatId,
    "Добавить оборудование (трекер/датчик и т.п.)?",
    yesNoKeyboard("complete:add_equipment", "complete:equipment_done"),
  );
}

async function addEquipment(chatId) {
  await setStep(chatId, "equipment_name", { currentEquipment: {} });
  await maxSendMessage(chatId, "Название/тип оборудования (текстом).", cancelKeyboard());
}

async function onEquipmentName(chatId, session, text) {
  const current = { ...session.data.currentEquipment, equipment: text.trim() };
  await patchData(chatId, { currentEquipment: current });
  await setStep(chatId, "equipment_imei");
  await maxSendMessage(
    chatId,
    "IMEI оборудования (текстом) — или «Пропустить».",
    skipKeyboard("complete:skip_imei"),
  );
}

async function onEquipmentImei(chatId, session, text) {
  const current = { ...session.data.currentEquipment, imei: text.trim() };
  await patchData(chatId, { currentEquipment: current });
  await askEquipmentPhoto(chatId);
}

async function skipImei(chatId, session) {
  const current = { ...session.data.currentEquipment, imei: null };
  await patchData(chatId, { currentEquipment: current });
  await askEquipmentPhoto(chatId);
}

async function askEquipmentPhoto(chatId) {
  await setStep(chatId, "equipment_photo");
  await maxSendMessage(
    chatId,
    "Фото с IMEI оборудования — или «Пропустить».",
    skipKeyboard("complete:skip_imei_photo"),
  );
}

async function skipImeiPhoto(chatId, session) {
  await finishEquipmentEntry(chatId, session.data);
}

async function finishEquipmentEntry(chatId, data) {
  const equipment = [...(data.equipment || []), data.currentEquipment];
  await patchData(chatId, { equipment, currentEquipment: null });
  await maxSendMessage(chatId, `Оборудование добавлено (всего: ${equipment.length}).`);
  await askAddEquipment(chatId);
}

async function equipmentDone(chatId) {
  await setStep(chatId, "additional_work");
  await maxSendMessage(
    chatId,
    "Дополнительные работы (текстом) — или «Пропустить».",
    skipKeyboard("complete:skip_additional"),
  );
}

async function onAdditionalWork(chatId, text) {
  await patchData(chatId, { additionalWork: text.trim() });
  await askActSigned(chatId);
}

async function skipAdditionalWork(chatId) {
  await patchData(chatId, { additionalWork: "" });
  await askActSigned(chatId);
}

async function askActSigned(chatId) {
  await setStep(chatId, "act_signed");
  await maxSendMessage(
    chatId,
    "Акт подписан клиентом?",
    yesNoKeyboard("complete:act_yes", "complete:act_no"),
  );
}

async function onActSigned(chatId, session, signed) {
  await patchData(chatId, { actSigned: signed });
  await showSummary(chatId, { ...session.data, actSigned: signed });
}

async function showSummary(chatId, data) {
  await setStep(chatId, "summary");
  const lines = [
    "📋 Сводка перед отправкой:",
    `Фото авто: ${(data.photos || []).length}`,
    `Марка: ${data.brand}`,
    `Госномер: ${data.stateNumber}`,
    `Оборудование: ${(data.equipment || []).length}`,
    ...(data.equipment || []).map(
      (eq, i) =>
        `  ${i + 1}. ${eq.equipment}${eq.imei ? `, IMEI ${eq.imei}` : ""}${eq.imeiPhoto ? " (+фото)" : ""}`,
    ),
    `Доп. работы: ${data.additionalWork || "—"}`,
    `Акт подписан: ${data.actSigned ? "да" : "нет"}`,
  ];
  await maxSendMessage(chatId, lines.join("\n"), completeWorkSummaryKeyboard());
}

async function restart(chatId, session) {
  await begin(chatId, session.data.applicationId);
}

async function submit(chatId, user, session) {
  const data = session.data;

  await maxSendMessage(chatId, "Загружаю фотоотчёт, подождите…");

  const photos = [];
  for (const p of data.photos || []) {
    const buffer = await maxDownloadAttachment(p.url);
    if (buffer) photos.push({ buffer, filename: p.filename });
  }

  const equipment = [];
  for (const eq of data.equipment || []) {
    let imeiPhoto = null;
    if (eq.imeiPhoto) {
      const buffer = await maxDownloadAttachment(eq.imeiPhoto.url);
      if (buffer) imeiPhoto = { buffer, filename: eq.imeiPhoto.filename };
    }
    equipment.push({ equipment: eq.equipment, imei: eq.imei, imeiPhoto });
  }

  await internalApi.completeApplication(user, data.applicationId, {
    brand: data.brand,
    stateNumber: data.stateNumber,
    completionComment: "",
    additionalWork: data.additionalWork,
    actSigned: data.actSigned,
    photos,
    equipment,
  });

  await resetSession(chatId);
  await maxSendMessage(
    chatId,
    "🎉 Фотоотчёт отправлен, заявка на проверке. Спасибо!",
  );
  await showCard(chatId, user, data.applicationId);
}

module.exports = {
  begin,
  onPhoto,
  photosDone,
  onBrand,
  onPlate,
  askAddEquipment,
  addEquipment,
  onEquipmentName,
  onEquipmentImei,
  skipImei,
  skipImeiPhoto,
  equipmentDone,
  onAdditionalWork,
  skipAdditionalWork,
  onActSigned,
  restart,
  submit,
};

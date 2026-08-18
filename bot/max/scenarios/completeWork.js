// bot/max/scenarios/completeWork.js — FSM «Завершить работу».
//
// Один автомобиль: фото авто -> марка -> госномер -> оборудование (имя,
// IMEI, фото IMEI) x N -> «добавить ещё авто?». Это повторяет
// application-app/app/modal.tsx, где отчёт тоже собирается по машинам
// (completionData.cars) и каждая машина шлётся отдельным
// POST/PUT .../complete — здесь то же самое: submit() отправляет один
// внутренний запрос на автомобиль.
//
// Доп. работы и акт — общие на весь отчёт, спрашиваются один раз после
// того как все автомобили добавлены.
//
// Фото не скачиваются сразу: во время диалога в data хранится только
// { token, url, filename } от MAX (JSON-совместимо, JSONB-колонка session.data
// не хранит бинарные данные). Реальные байты скачиваются с MAX и заливаются
// в POST /application/:id/complete только на шаге "Отправить".
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
  carMoreKeyboard,
  completeWorkSummaryKeyboard,
  restartConfirmKeyboard,
} = require("../keyboards");
const { showCard } = require("./applications");

function carIndexOf(data) {
  return (data.cars || []).length + 1;
}

function currentCarFromData(data) {
  return {
    photos: data.photos || [],
    brand: data.brand,
    stateNumber: data.stateNumber,
    equipment: data.equipment || [],
  };
}

const EMPTY_CAR_FIELDS = {
  photos: [],
  brand: undefined,
  stateNumber: undefined,
  equipment: [],
  currentEquipment: null,
};

async function begin(chatId, applicationId) {
  await setScenario(chatId, "complete_work", "photos", {
    applicationId,
    data: {
      applicationId,
      cars: [],
      ...EMPTY_CAR_FIELDS,
      additionalWork: undefined,
      actSigned: undefined,
      submitting: false,
    },
  });
  await maxSendMessage(
    chatId,
    "✅ Завершение работы.\n\n" +
      "Автомобиль 1. Шаг 1. Пришлите одно или несколько фото автомобиля. " +
      "Когда всё отправите — нажмите «Готово».",
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
      `Автомобиль ${carIndexOf(session.data)}: фото добавлено (всего: ${photos.length}). Пришлите ещё или нажмите «Готово».`,
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
  await maxSendMessage(
    chatId,
    `Автомобиль ${carIndexOf(session.data)}. Шаг 2. Укажите марку автомобиля.`,
    cancelKeyboard(),
  );
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

// Оборудование для текущего автомобиля закончено — фиксируем машину
// целиком в data.cars и спрашиваем, нужен ли ещё один автомобиль
// (как кнопка "Добавить автомобиль" в приложении).
async function equipmentDone(chatId, session) {
  const cars = [...(session.data.cars || []), currentCarFromData(session.data)];
  await patchData(chatId, { cars, ...EMPTY_CAR_FIELDS });
  await setStep(chatId, "car_more");
  await maxSendMessage(
    chatId,
    `Автомобиль ${cars.length} сохранён в отчёте. Добавить ещё один автомобиль?`,
    carMoreKeyboard(),
  );
}

// Пользователь хочет добавить ещё один автомобиль (либо сразу после
// предыдущего, либо позже — прямо со сводки).
async function addAnotherCar(chatId, session) {
  await setStep(chatId, "photos");
  await maxSendMessage(
    chatId,
    `Автомобиль ${carIndexOf(session.data)}. Шаг 1. Пришлите фото автомобиля. Когда всё отправите — нажмите «Готово».`,
    doneKeyboard("complete:photos_done"),
  );
}

// Автомобили закончены — если доп.работы/акт уже спрашивали раньше
// (машину добавили прямо со сводки), не переспрашиваем, а сразу
// возвращаемся к сводке.
async function finishCars(chatId, session) {
  if (session.data.actSigned !== undefined) {
    return showSummary(chatId, session.data);
  }
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
  const cars = data.cars || [];

  const lines = [`📋 Сводка перед отправкой (автомобилей: ${cars.length}):`, ""];

  cars.forEach((car, i) => {
    lines.push(`Автомобиль ${i + 1}: ${car.brand}, ${car.stateNumber}`);
    lines.push(`  Фото: ${(car.photos || []).length}`);
    lines.push(`  Оборудование: ${(car.equipment || []).length}`);
    (car.equipment || []).forEach((eq, j) => {
      lines.push(
        `    ${j + 1}. ${eq.equipment}${eq.imei ? `, IMEI ${eq.imei}` : ""}${eq.imeiPhoto ? " (+фото)" : ""}`,
      );
    });
  });

  lines.push("");
  lines.push(`Доп. работы: ${data.additionalWork || "—"}`);
  lines.push(`Акт подписан: ${data.actSigned ? "да" : "нет"}`);

  await maxSendMessage(chatId, lines.join("\n"), completeWorkSummaryKeyboard());
}

async function confirmRestart(chatId) {
  await maxSendMessage(
    chatId,
    "⚠️ Все введённые данные (все автомобили, фото, оборудование) будут " +
      "удалены. Начать заново?",
    restartConfirmKeyboard(),
  );
}

async function restart(chatId, session) {
  await begin(chatId, session.data.applicationId);
}

async function submit(chatId, user, session) {
  const data = session.data;

  if (data.submitting) {
    await maxSendMessage(chatId, "⏳ Отчёт уже отправляется, подождите…");
    return;
  }

  if (!(data.cars || []).length) {
    await maxSendMessage(chatId, "Нет ни одного добавленного автомобиля.");
    return;
  }

  // Защита от повторной отправки: пока запрос(ы) к бэкенду выполняются,
  // повторное нажатие "Отправить" (например, если показалось, что первое
  // не сработало) не запускает всё заново — иначе можно было продублировать
  // фотоотчёт в БД. Флаг снимается либо при успехе (resetSession), либо
  // явно в catch — чтобы после настоящей ошибки повтор всё же был возможен.
  await patchData(chatId, { submitting: true });

  try {
    await maxSendMessage(
      chatId,
      `Загружаю фотоотчёт (${data.cars.length} авто), подождите…`,
    );

    for (const car of data.cars) {
      const photos = [];
      for (const p of car.photos || []) {
        const buffer = await maxDownloadAttachment(p.url);
        if (buffer) photos.push({ buffer, filename: p.filename });
      }

      const equipment = [];
      for (const eq of car.equipment || []) {
        let imeiPhoto = null;
        if (eq.imeiPhoto) {
          const buffer = await maxDownloadAttachment(eq.imeiPhoto.url);
          if (buffer) imeiPhoto = { buffer, filename: eq.imeiPhoto.filename };
        }
        equipment.push({ equipment: eq.equipment, imei: eq.imei, imeiPhoto });
      }

      await internalApi.completeApplication(user, data.applicationId, {
        brand: car.brand,
        stateNumber: car.stateNumber,
        completionComment: "",
        additionalWork: data.additionalWork,
        actSigned: data.actSigned,
        photos,
        equipment,
      });
    }

    await resetSession(chatId);
    await maxSendMessage(
      chatId,
      "🎉 Фотоотчёт отправлен, заявка на проверке. Спасибо!",
    );
    await showCard(chatId, user, data.applicationId);
  } catch (err) {
    await patchData(chatId, { submitting: false });
    throw err;
  }
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
  addAnotherCar,
  finishCars,
  onAdditionalWork,
  skipAdditionalWork,
  onActSigned,
  showSummary,
  confirmRestart,
  restart,
  submit,
};

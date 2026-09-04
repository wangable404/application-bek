// bot/max/scenarios/startWork.js — FSM «Начать работу»:
// дата -> комментарий -> тип работ -> подтверждение.
const { maxSendMessage } = require("../../../services/max.service");
const internalApi = require("../internalApi");
const { setScenario, setStep, patchData } = require("../session");
const {
  cancelKeyboard,
  skipKeyboard,
  inlineKeyboard,
  callbackButton,
  yesNoKeyboard,
} = require("../keyboards");
const { showCard } = require("./applications");

const WORK_TYPES = [
  ["service", "Сервисные работы"],
  ["transition", "Переход"],
  ["installation", "Установка"],
];

async function begin(chatId, applicationId) {
  await setScenario(chatId, "start_work", "date", {
    applicationId,
    data: { applicationId },
  });
  await maxSendMessage(
    chatId,
    "▶️ Начало работы.\n\nШаг 1 из 3. Укажите согласованную с клиентом дату (в свободной форме, например «20.08.2026»).",
    cancelKeyboard(),
  );
}

async function onDate(chatId, session, text) {
  await patchData(chatId, { agreedDate: text.trim() });
  await setStep(chatId, "comment");
  await maxSendMessage(
    chatId,
    "Шаг 2 из 3. Комментарий к началу работы (необязательно) — напишите текстом или нажмите «Пропустить».",
    skipKeyboard("work:skip_comment"),
  );
}

async function onComment(chatId, text) {
  await patchData(chatId, { startWorkComment: text.trim() });
  await askWorkType(chatId);
}

async function skipComment(chatId) {
  await patchData(chatId, { startWorkComment: "" });
  await askWorkType(chatId);
}

async function askWorkType(chatId) {
  await setStep(chatId, "work_type");
  await maxSendMessage(
    chatId,
    "Шаг 3 из 3. Выберите тип работ:",
    inlineKeyboard([
      ...WORK_TYPES.map(([value, label]) => [
        callbackButton(label, `work:type:${value}`),
      ]),
      [callbackButton("✖️ Отмена", "scenario:cancel")],
    ]),
  );
}

async function onWorkType(chatId, session, value) {
  await patchData(chatId, { workType: value });
  const data = { ...session.data, workType: value };
  const label = WORK_TYPES.find(([v]) => v === value)?.[1] || value;

  await setStep(chatId, "confirm");
  await maxSendMessage(
    chatId,
    `Проверьте данные:\n\nДата: ${data.agreedDate}\nКомментарий: ${data.startWorkComment || "—"}\nТип работ: ${label}\n\nНачать работу?`,
    yesNoKeyboard("work:confirm", "scenario:cancel"),
  );
}

async function confirm(chatId, user, session) {
  const { applicationId, agreedDate, startWorkComment, workType } = session.data;
  await internalApi.startWork(user, applicationId, {
    agreedDate,
    startWorkComment,
    workType,
  });
  await internalApi.changeStatus(user, applicationId, "in_progress");

  const { resetSession } = require("../session");
  await resetSession(chatId);

  await maxSendMessage(
    chatId,
    "🎉 Работа начата. После окончания не забудьте отправить фотоотчёт («Завершить работу»).",
  );
  await showCard(chatId, user, applicationId);
}

module.exports = {
  begin,
  onDate,
  onComment,
  skipComment,
  onWorkType,
  confirm,
};

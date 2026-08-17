// bot/max/scenarios/menu.js — главное меню и помощь.
const { maxSendMessage } = require("../../../services/max.service");
const { mainMenuKeyboard } = require("../keyboards");
const { resetSession } = require("../session");

const CAPABILITIES_TEXT =
  "📋 Мои заявки — список заявок и их статусы\n" +
  "▶️ Начать работу — указать согласованную дату и тип работ по принятой заявке\n" +
  "✅ Завершить работу — пошагово отправить фотоотчёт: фото авто, марка, " +
  "госномер, список оборудования с фото IMEI, акт\n" +
  "💬 Чат с менеджером — переписка по конкретной заявке\n\n" +
  "Всё управляется кнопками под сообщениями бота. Текстом нужно вводить только " +
  "то, что кнопкой не выбрать (даты, комментарии, IMEI, сообщения в чате).\n" +
  "На любом шаге можно нажать «Отмена», чтобы вернуться к списку заявок.";

const WELCOME_TEXT =
  "👋 Аккаунт подключён. Это бот-интегратор — здесь можно работать с " +
  "заявками так же, как в приложении.\n\n" +
  `${CAPABILITIES_TEXT}`;

const HELP_TEXT = `❓ Что умеет бот\n\n${CAPABILITIES_TEXT}`;

async function showWelcome(chatId) {
  await maxSendMessage(chatId, WELCOME_TEXT, mainMenuKeyboard());
}

async function showRoot(chatId) {
  await resetSession(chatId);
  await maxSendMessage(chatId, "Главное меню:", mainMenuKeyboard());
}

async function showHelp(chatId) {
  await maxSendMessage(chatId, HELP_TEXT, mainMenuKeyboard());
}

module.exports = { showWelcome, showRoot, showHelp };

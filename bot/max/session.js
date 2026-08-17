// bot/max/session.js — состояние диалога (FSM) для конкретного MAX-чата.
const { MaxBotSession } = require("../../models/model");

async function getSession(chatId, userId) {
  const [session] = await MaxBotSession.findOrCreate({
    where: { chatId },
    defaults: { chatId, userId, scenario: "idle", step: null, data: {} },
  });
  return session;
}

async function setScenario(chatId, scenario, step = null, extra = {}) {
  const session = await MaxBotSession.findOne({ where: { chatId } });
  if (!session) return null;
  return session.update({ scenario, step, ...extra });
}

async function setStep(chatId, step, dataPatch) {
  const session = await MaxBotSession.findOne({ where: { chatId } });
  if (!session) return null;
  const nextData = dataPatch
    ? { ...session.data, ...dataPatch }
    : session.data;
  return session.update({ step, data: nextData });
}

async function patchData(chatId, dataPatch) {
  const session = await MaxBotSession.findOne({ where: { chatId } });
  if (!session) return null;
  return session.update({ data: { ...session.data, ...dataPatch } });
}

async function resetSession(chatId) {
  const session = await MaxBotSession.findOne({ where: { chatId } });
  if (!session) return null;
  return session.update({
    scenario: "idle",
    step: null,
    applicationId: null,
    data: {},
  });
}

module.exports = {
  getSession,
  setScenario,
  setStep,
  patchData,
  resetSession,
};

// Her müşteri (chat id) için konuşma geçmişini bellekte tutar.
// Not: Süreç yeniden başladığında (deploy, restart) bu bellek sıfırlanır.
// Kalıcı geçmiş istenirse ileride bir DB'ye taşınabilir.

const sessions = new Map();
const MAX_HISTORY = 20; // son N mesaj tutulur, token maliyetini sınırlar

function getHistory(chatId) {
  if (!sessions.has(chatId)) sessions.set(chatId, []);
  return sessions.get(chatId);
}

function setHistory(chatId, history) {
  const trimmed = history.slice(-MAX_HISTORY);
  sessions.set(chatId, trimmed);
}

function resetHistory(chatId) {
  sessions.delete(chatId);
}

module.exports = { getHistory, setHistory, resetHistory };

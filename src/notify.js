function formatOrderMessage(order, fromNumber) {
  return [
    '🛒 *YENİ SİPARİŞ*',
    `👤 Ad Soyad: ${order.full_name}`,
    `📍 Adres: ${order.address}`,
    `📞 Telefon: ${order.phone}`,
    `🧾 Ürün: ${order.product}`,
    `📏 Beden: ${order.size}`,
    `🔢 Adet: ${order.quantity}`,
    fromNumber ? `💬 Müşteri WhatsApp: ${fromNumber}` : null
  ].filter(Boolean).join('\n');
}

async function notifyOwner(client, order, fromNumber) {
  const ownerNumber = process.env.OWNER_WHATSAPP_NUMBER;
  if (!ownerNumber) {
    console.warn('OWNER_WHATSAPP_NUMBER tanımlı değil, bildirim gönderilemedi.');
    return;
  }
  const chatId = `${ownerNumber}@c.us`;
  const message = formatOrderMessage(order, fromNumber);
  await client.sendMessage(chatId, message);
}

module.exports = { notifyOwner, formatOrderMessage };

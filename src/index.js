require('dotenv').config();
const express = require('express');
const qrcodeTerminal = require('qrcode-terminal');
const QRCode = require('qrcode');
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');

const { handleTurn } = require('./claudeClient');
const { getHistory, setHistory, resetHistory } = require('./sessions');
const { notifyOwner } = require('./notify');

// ---- Express: Render'ın web service olarak ayakta tutması + QR'ı tarayıcıdan görmek için ----
const app = express();
const PORT = process.env.PORT || 3000;
let lastQr = null;
let clientReady = false;

app.get('/', (req, res) => res.send(clientReady ? 'Bot çalışıyor ✅' : 'Bot başlatılıyor / QR bekleniyor...'));

app.get('/qr', async (req, res) => {
  if (!lastQr) return res.send('QR henüz üretilmedi ya da zaten bağlı.');
  const dataUrl = await QRCode.toDataURL(lastQr);
  res.send(`<img src="${dataUrl}" style="width:300px" />`);
});

app.listen(PORT, () => console.log(`HTTP sunucu ${PORT} portunda ayakta (Render health check + /qr).`));

// ---- WhatsApp istemcisi ----
const client = new Client({
  authStrategy: new LocalAuth({ dataPath: '.wwebjs_auth' }),
  puppeteer: {
    headless: true,
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu'
    ]
  }
});

client.on('qr', (qr) => {
  lastQr = qr;
  console.log('QR alındı. Terminalden okutabilir ya da /qr adresinden görebilirsin.');
  qrcodeTerminal.generate(qr, { small: true });
});

client.on('ready', () => {
  clientReady = true;
  console.log('WhatsApp istemcisi hazır ✅');
});

client.on('disconnected', (reason) => {
  clientReady = false;
  console.warn('Bağlantı koptu:', reason);
});

client.on('message', async (msg) => {
  try {
    // Grupları ve durum güncellemelerini yok say, sadece bire bir müşteri mesajlarını işle
    const chat = await msg.getChat();
    if (chat.isGroup) return;
    if (msg.from === 'status@broadcast') return;

    const chatId = msg.from;

    // Basit reset komutu
    if (msg.body.trim().toLowerCase() === '/reset') {
      resetHistory(chatId);
      await msg.reply('Sohbeti sıfırladım, baştan başlayalım 🙂');
      return;
    }

    const history = getHistory(chatId);
    history.push({ role: 'user', content: msg.body });

    const { replyText, events, updatedHistory } = await handleTurn(history);
    setHistory(chatId, updatedHistory);

    // Tool olaylarını işle: ürün fotoğrafı gönderme, sipariş bildirimi
    for (const ev of events) {
      if (ev.type === 'photo') {
        for (const imageUrl of ev.product.images) {
          try {
            const media = await MessageMedia.fromUrl(imageUrl, { unsafeMime: true });
            await client.sendMessage(chatId, media, { caption: ev.product.name });
          } catch (err) {
            console.error('Görsel gönderilemedi:', imageUrl, err.message);
          }
        }
      } else if (ev.type === 'order') {
        await notifyOwner(client, ev.order, chatId.replace('@c.us', ''));
      }
    }

    if (replyText && replyText.trim()) {
      await msg.reply(replyText);
    }
  } catch (err) {
    console.error('Mesaj işlenirken hata:', err);
    try { await msg.reply('Üzgünüm, bir hata oluştu. Birazdan tekrar dener misin?'); } catch (_) {}
  }
});

client.initialize();

# WhatsApp Sipariş Botu (whatsapp-web.js + Claude API)

Müşteriyle sohbet ederek ad-soyad, adres, telefon, ürün, beden (boy/kiloya göre önerilen) ve
adet bilgisini toplayan, ürün görseli gönderebilen ve sipariş netleştiğinde sana WhatsApp'tan
bildirim atan bot.

## 1) Yerelde deneme

```bash
npm install
cp .env.example .env
# .env içine ANTHROPIC_API_KEY ve OWNER_WHATSAPP_NUMBER değerlerini gir
npm start
```

Terminalde çıkan QR kodu WhatsApp > Bağlı Cihazlar > Cihaz Bağla ile okut.

`data/products.json` dosyasındaki `images` alanlarını gerçek ürün görsel linkleriyle
(herkese açık URL) değiştir.

## 2) GitHub'a yükleme

```bash
git init
git add .
git commit -m "ilk sürüm"
git branch -M main
git remote add origin https://github.com/KULLANICI_ADIN/wa-order-bot.git
git push -u origin main
```

## 3) Render.com'da deploy

1. Render.com > **New +** > **Web Service**
2. GitHub reponu bağla (wa-order-bot)
3. Render, repodaki `Dockerfile`'ı otomatik algılar → **Environment: Docker** seç
   (algılamazsa manuel seç; `render.yaml` dosyası da bunu otomatik ayarlar)
4. **Plan**: Free
5. **Environment Variables** kısmına ekle:
   - `ANTHROPIC_API_KEY` → Claude API anahtarın
   - `OWNER_WHATSAPP_NUMBER` → bildirimlerin geleceği numara (örn. 905xxxxxxxxx, başında + yok)
6. **Create Web Service** ile deploy et.

## 4) QR kodu okutma

Deploy tamamlanınca:

- Render'daki **Logs** sekmesinden QR kodun terminal çıktısını görebilirsin, **veya**
- Servisin adresine `/qr` ekleyerek taraycıdan görsel QR görebilirsin
  (örn. `https://wa-order-bot.onrender.com/qr`)

QR'ı WhatsApp'tan okut, bot hazır olduğunda `/` adresinde "Bot çalışıyor ✅" yazar.

## Önemli notlar

- **Ücretsiz Render planı**: dosya sistemi kalıcı değildir, her yeni deploy'da (veya servis
  uykuya geçip tekrar uyandığında) WhatsApp oturumu sıfırlanır ve QR'ı tekrar okutman gerekir.
  Bunu kabul ettiğini belirttin — sorun değil, sadece bilgi amaçlı.
- **Uyku modu**: Render'ın ücretsiz web servisleri ~15 dakika istek almazsa uykuya geçer.
  Botun sürekli ayakta kalmasını istiyorsan (ör. UptimeRobot ile) `/` adresine periyodik
  ping atılabilir, ya da ileride ücretli plana geçilebilir.
- **Ürün/beden yönetimi**: Şu an `data/products.json` dosyasından okunuyor. İleride panel
  eklemek istediğinde bu dosyayı bir veritabanına veya küçük bir admin API'sine taşımak yeterli
  — `claudeClient.js` içindeki `loadCatalog()` fonksiyonunu değiştirmen yeterli olur.
- **Sohbet geçmişi**: Şu an bellekte tutuluyor (`src/sessions.js`), servis yeniden başlarsa
  sıfırlanır. Sipariş bildirimleri kalıcı bir kayıt istemediğin için ayrıca dosyaya/DB'ye
  yazılmıyor, sadece sana WhatsApp mesajı olarak gidiyor.
- `/reset` yazan müşterinin sohbeti sıfırlanır (test için kullanışlı).

const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs');
const path = require('path');

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const catalogPath = path.join(__dirname, '..', 'data', 'products.json');
function loadCatalog() {
  return JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
}

function buildSystemPrompt() {
  const catalog = loadCatalog();
  return `Sen bir WhatsApp satış asistanısın. Müşteriyle Türkçe, samimi, kısa ve net WhatsApp mesajları şeklinde konuşuyorsun (uzun paragraflar yazma).

Görevin:
1. Müşteriye ürünleri tanıt, istenirse "send_product_photo" tool'unu kullanarak ürün görseli gönder.
2. Müşteri beden konusunda kararsızsa boy (cm) ve kiloyu (kg) sor, sonra "suggest_size" tool'unu çağırarak uygun bedeni öner.
3. Sipariş için şu bilgileri sırayla ve doğal bir sohbet akışıyla topla: Ad Soyad, Teslimat Adresi, Telefon Numarası, Ürün, Beden, Adet.
4. Tüm bilgiler toplandığında müşteriye özet geçip onay al, onay gelince "complete_order" tool'unu çağır.
5. complete_order çağrıldıktan sonra müşteriye siparişin alındığını, en kısa sürede işleme alınacağını söyle.

Kurallar:
- Bilgi eksikse asla varsayım yapma, sor.
- Tek seferde çok soru sorma, sohbeti doğal tut.
- Fiyat/stok bilgisini sadece katalogda varsa ver.
- Katalogdaki ürünler: ${JSON.stringify(catalog.products.map(p => ({ id: p.id, name: p.name, price: p.price, sizes: p.sizes })))}`;
}

const tools = [
  {
    name: 'send_product_photo',
    description: 'Belirtilen ürünün görsel(ler)ini müşteriye WhatsApp üzerinden gönderir.',
    input_schema: {
      type: 'object',
      properties: {
        product_id: { type: 'string', description: 'Katalogdaki ürün id değeri' }
      },
      required: ['product_id']
    }
  },
  {
    name: 'suggest_size',
    description: 'Boy (cm) ve kiloya (kg) göre beden tablosundan uygun bedeni bulur.',
    input_schema: {
      type: 'object',
      properties: {
        height_cm: { type: 'number' },
        weight_kg: { type: 'number' }
      },
      required: ['height_cm', 'weight_kg']
    }
  },
  {
    name: 'complete_order',
    description: 'Tüm sipariş bilgileri netleşip müşteri onayladığında çağrılır. Siparişi işleme sokar.',
    input_schema: {
      type: 'object',
      properties: {
        full_name: { type: 'string', description: 'Ad Soyad' },
        address: { type: 'string', description: 'Teslimat adresi' },
        phone: { type: 'string', description: 'Telefon numarası' },
        product: { type: 'string', description: 'Sipariş edilen ürün adı' },
        size: { type: 'string', description: 'Beden' },
        quantity: { type: 'number', description: 'Adet' }
      },
      required: ['full_name', 'address', 'phone', 'product', 'size', 'quantity']
    }
  }
];

function suggestSizeLocal(heightCm, weightKg) {
  const catalog = loadCatalog();
  for (const row of catalog.sizeChart) {
    const [hMin, hMax] = row.heightCm;
    const [wMin, wMax] = row.weightKg;
    if (heightCm >= hMin && heightCm <= hMax && weightKg >= wMin && weightKg <= wMax) {
      return row.size;
    }
  }
  // En yakın bedeni ortalama farkına göre bul
  let best = catalog.sizeChart[0];
  let bestDiff = Infinity;
  for (const row of catalog.sizeChart) {
    const hMid = (row.heightCm[0] + row.heightCm[1]) / 2;
    const wMid = (row.weightKg[0] + row.weightKg[1]) / 2;
    const diff = Math.abs(heightCm - hMid) + Math.abs(weightKg - wMid);
    if (diff < bestDiff) { bestDiff = diff; best = row; }
  }
  return best.size;
}

/**
 * Bir kullanıcı mesajını Claude'a gönderir, tool çağrılarını yönetir,
 * ve { replyText, events } döner. events: [{type:'photo', productId}, {type:'order', order}]
 */
async function handleTurn(history) {
  const catalog = loadCatalog();
  const events = [];
  let messages = [...history];

  for (let i = 0; i < 5; i++) { // en fazla 5 tool-use döngüsü
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 700,
      system: buildSystemPrompt(),
      tools,
      messages
    });

    const toolUses = response.content.filter(b => b.type === 'tool_use');

    if (toolUses.length === 0) {
      const text = response.content
        .filter(b => b.type === 'text')
        .map(b => b.text)
        .join('\n');
      return { replyText: text, events, updatedHistory: [...messages, { role: 'assistant', content: response.content }] };
    }

    messages.push({ role: 'assistant', content: response.content });

    const toolResults = [];
    for (const tu of toolUses) {
      if (tu.name === 'send_product_photo') {
        const product = catalog.products.find(p => p.id === tu.input.product_id);
        if (product) events.push({ type: 'photo', product });
        toolResults.push({
          type: 'tool_result',
          tool_use_id: tu.id,
          content: product ? 'Görsel gönderildi.' : 'Ürün bulunamadı.'
        });
      } else if (tu.name === 'suggest_size') {
        const size = suggestSizeLocal(tu.input.height_cm, tu.input.weight_kg);
        toolResults.push({
          type: 'tool_result',
          tool_use_id: tu.id,
          content: `Önerilen beden: ${size}`
        });
      } else if (tu.name === 'complete_order') {
        events.push({ type: 'order', order: tu.input });
        toolResults.push({
          type: 'tool_result',
          tool_use_id: tu.id,
          content: 'Sipariş kaydedildi.'
        });
      }
    }
    messages.push({ role: 'user', content: toolResults });
  }

  return { replyText: 'Bir saniye, hemen bakıyorum...', events, updatedHistory: messages };
}

module.exports = { handleTurn, loadCatalog };

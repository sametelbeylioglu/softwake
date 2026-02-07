# SoftWake — Yumuşak Uyanış Alarmı

Belirlenen saatte yumuşak frekanslarla **5 dakika boyunca kademeli uyandırıp otomatik kapanan** alarm.

## Çalıştırma

Tarayıcıda `index.html` dosyasını açın. Hepsi bu.

### Yerel sunucu (opsiyonel, bildirimler için önerilir)

```bash
# Node.js varsa:
npx serve .

# Python varsa:
python -m http.server 8000
```

## iPhone'da kullanma

1. iPhone Safari'de aynı adresi açın (aynı WiFi ağında)
2. Veya dosyaları bir hosting'e yükleyin
3. Safari → "Ana Ekrana Ekle" → tam ekran PWA deneyimi

## Dosya Yapısı

```
SoftWake/
├── index.html          → Ana sayfa
├── css/style.css       → iOS tarzı koyu tema
├── js/
│   ├── store.js        → Alarm CRUD + localStorage
│   ├── engine.js       → 5 dk ses motoru (Web Audio API)
│   ├── picker.js       → iOS wheel saat seçici
│   └── app.js          → Uygulama kontrolcüsü + UI
└── README.md
```

## Ses Motoru

| Zaman | Frekans | Ses | Efekt |
|-------|---------|-----|-------|
| 0–2 dk | 432 Hz | Çok düşük | Dalgalı modülasyon |
| 2–4 dk | 432→528 Hz | Kademeli artış | Pink noise eklenir |
| 4–5 dk | 528 Hz söner | Ambient | Doğal uyanış |
| 5:00 | — | Sessizlik | Otomatik kapanır |

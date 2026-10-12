# ⚽ Krampon — Futbol Kariyeri

New Star Soccer tarzında, mobil öncelikli bir futbol kariyer simülasyonu. 17 yaşında, 1. Lig'in küçük bir kulübünde başlarsın. Antrenman yapar, maçlarda kritik anları kendin oynar, transferlerle yükselir ve Süper Lig'de efsane olmaya çalışırsın.

Tarayıcıda çalışır. iPhone'da ve Android'de **ana ekrana eklenip uygulama gibi** (tam ekran, çevrimdışı) oynanır.

## Özellikler

- **Oyuncu oluşturma:** İsim, forma numarası, mevki (Forvet / Orta Saha / Defans) ve görünüş (ten, saç modeli, saç rengi).
- **5 özellik:** Hız, Şut, Pas, Defans, Dayanıklılık. Başlangıç değerleri mevkiye göre dağıtılır. Mevkinin ana özelliği ×1.5, yan özelliği ×1.25 hızla gelişir.
- **Haftalık takvim:** Her hafta 4 zaman hakkı var. Antrenman, Dinlen, Takımla Yemek, Taraftar & Medya, Hocayla Görüş ve Reklam Çekimi arasından seçim yapılır.
- **Maç motoru:** 90 dakika canlı anlatım ve skor tabelası. Oyuncunun kritik anlarında (şut, pas, müdahale) mini oyun açılır. Maç sonunda not, prim, ilişki ve moral değişimi gelir.
- **4 animasyonlu mini oyun (Canvas):**
  - **Şut:** Kaydırarak yön ve güç verilir. Kaleci tepki verip uçar, ceza sahası dışından atılan şutlarda araya savunmacı girer; gollerde ağ dalgalanır.
  - **Pas:** Pas yollarını okuman gerekir. Rakipler koridorları kapatır, yer değiştirir ve pres yapar.
  - **Müdahale:** Sürükleyerek rakibi karşılarsın, dokunarak kayarak müdahale edersin. Rakip çalım da atar.
  - **Sürat / Dayanıklılık koşusu:** SOL-SAĞ ritmiyle koşulur. Dayanıklılık modunda nefes barı da yönetilir.
- **Kulüp ve lig:** 24 kurgusal kulüp, 2 lig (Süper Lig, 1. Lig). Çift devreli fikstür, puan tablosu ve diğer maçların simülasyonu.
- **İlişkiler:** Teknik direktör, takım arkadaşları, taraftar, sponsor, federasyon ve kulüp yönetimi. Sponsor reklam gelirini, federasyon ceza riskini, yönetim sözleşme yenilemeyi etkiler. İlk 11'e girmek OVR, hoca ilişkisi, form ve morale bağlıdır.
- **Para ve yaşam tarzı:** Maaş, galibiyet/gol/asist primleri ve sözleşme süresi. Devre arası ve sezon sonu transfer teklifleri gelir; her teklifte forma şansı tahmini gösterilir. 20 eşyalık mağazada araç, ev, gelişim ve yaşam ürünleri var.
- **Metin olayları ve moral:** 28 seçimli olay (röportaj, parti, sakatlık, sponsor, milli takım çağrısı...). Moral ve yorgunluk mini oyun performansını etkiler.
- **Chirp (sosyal medya):** Oyun içi zaman tüneli. İki parodi gazeteci hesabı var: *Fabricio Romana* ("It's a deal!") kesinleşen transferleri ve büyük dedikoduları, *Yağız Sapanca* ("Flaş Gelişme:") form düşüşü, sakatlık ve kulüp içi haberleri paylaşır. Her tweetin altına 3-4 taraftar botu yorum yazar; yorumlar Türkçe duygu analiziyle olumlu/olumsuz etiketlenir. Maçtan sonra ana ekrandan Mütevazı, Egoist veya Agresif bir paylaşım yapılabilir. Her biri Hoca, Taraftar, Takım, Sponsor, Federasyon ve Yönetim ilişkilerini değiştirir. Agresif paylaşım PFDK'dan para cezası ya da 1 maç men getirebilir.
- **Sezon sonu:** Şampiyonluk, gol krallığı, sezonun oyuncusu ve genç oyuncu ödülleri. Yaşlanma, sözleşme yenileme ve emeklilik.
- **Ses ve titreşim:** Bütün sesler WebAudio ile üretilir; dışarıdan dosya yüklenmez. Titreşim Android'de çalışır.
- **Kayıt:** Oyun otomatik kaydedilir (localStorage). Kayıt kodu dışa ve içe aktarılarak başka cihaza taşınabilir.

## Klasör yapısı

```
web/     Tarayıcı oyunu (JavaScript + Canvas, Vite ile derlenir) ← Render'da yayınlanan
unity/   Unity (C#) prototip scriptleri: ana menü, oyuncu oluşturma, 3 mini oyun
```

```
web/src/
  core/      Oyun mantığı (arayüzden bağımsız, Node'da test edilir)
    data.js       Denge tablosu: statlar, mevkiler, kulüpler, mağaza
    player.js     OVR, gelişim, yorgunluk, yaşlanma
    league.js     Fikstür, maç simülasyonu, puan tablosu
    match.js      Maç motoru: ilk 11 kararı, kritik anlar, anlatım, not
    economy.js    Maaş, eşyalar, transfer teklifleri
    events.js     Metin olayları
    game.js       Hafta akışı, sezon sonu
    storage.js    Kayıt
    chirp/        Sosyal medya: modeller, tetikleyiciler, paylaşımlar, ilişkiler, duygu analizi
  games/     Canvas mini oyunları (shot, pass, tackle, sprint)
  ui/        Ekranlar, SVG çizimler (avatar, arma, ikonlar), akışlar
web/tests/   Birim testleri (node --test)
web/scripts/ Denge simülasyonu ve ikon üretici
```

## Geliştirme

```bash
cd web
npm install
npm run dev        # http://localhost:5173 (telefondan aynı ağdaki IP ile açılabilir)
npm test           # mantık testleri
npm run simulate   # farklı mevkilerle çok sezonluk denge simülasyonu
npm run build      # dist/ klasörüne üretim derlemesi
```

`?autoplay=1` parametresiyle açıldığında mini oyunlar otomatik sonuçlanır. Bu mod hızlı akış testi içindir.

## Render'da yayınlama

Repoda `render.yaml` hazır. İki yoldan biri seçilebilir:

1. **Blueprint:** Render panelinde *New → Blueprint* seç ve bu repoyu bağla.
2. **Elle:** *New → Static Site* oluştur, şu ayarları gir:
   - Build Command: `cd web && npm ci && npm run build`
   - Publish Directory: `web/dist`
   - Ortam değişkeni: `NODE_VERSION = 22`

## Telefona yükleme

- **iPhone / iPad:** Safari'de siteyi aç, **Paylaş → Ana Ekrana Ekle**.
- **Android:** Chrome menüsü (⋮) → **Uygulamayı yükle** ya da **Ana ekrana ekle**.

Not: Kulüp ve oyuncu isimleri kurgusaldır.

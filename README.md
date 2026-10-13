# ⚽ Krampon — Futbol Kariyeri

New Star Soccer tarzında, mobil öncelikli bir futbol kariyer simülasyonu. 17 yaşında, 1. Lig'in küçük bir kulübünde başlarsın. Antrenman yapar, maçlarda kritik anları kendin oynar, transferlerle yükselir ve Süper Lig'de efsane olmaya çalışırsın.

Tarayıcıda çalışır. iPhone'da ve Android'de **ana ekrana eklenip uygulama gibi** (tam ekran, çevrimdışı) oynanır.

## Özellikler

- **Başlangıç akışı:** Oyuncu yalnızca ismini yazar; görünüş rastgele oluşur, forma numarasını kulüp boştaki genç numaralarından (33, 48, 99…) verir. "Oyuna Başla" ile **Seçmeler Kampı** açılır: Pas (hareketli hedefe pas), Şut (köşe hedefleri) ve Çalım (dubalar arasından geçiş) istasyonları hem oyunu öğretir hem yeteneği ölçer. Her istasyonda 3 hak vardır; her hata 1 hak götürür, ilk deneme ısınmadır. Kalan haklar **seçme skoru**dur (0–9). Raporda scout bir mevki önerir; oyuncu Forvet / Orta Saha / Defans arasından seçer, kalan haklar ilgili özelliğe başlangıç katkısı olur.
- **Başlangıç teklifleri:** 9–7 hak → A, B, C · 6–4 hak → A, B · 3 ve altı → A. **A** alt lig takımı (ilk sezon ilk 11 garantisi), **B** Süper Lig kulübüyle 3 yıllık sözleşme + 1. Lig'e 1 yıllık forma şartlı kiralık (sezon sonunda ana kulübe dönüş), **C** dev kulübün U-17 takımı (U-17 Gelişim Ligi, antrenman gelişimi +%25, sezon sonunda A takım sözleşmesi ya da gelişim için kiralık). Kiralıkta ve altyapıdayken devre arası transferi kapalıdır.
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
- **Mentorluk ve rol model:** Her sezonun ilk haftasında, 26 yaş ve altındaysan kadrodaki tecrübeli isimlerden (32+ yaş, Kaptan veya Yıldız Oyuncu, kulüp nüfuzu 75'in üstünde) en fazla 3 aday listelenir; birini sezonun mentoru seçersin. Mentorun karakteri bir bonus verir: *Çalışkan* antrenman gelişimini %20 hızlandırır, *Lider* nüfuz kazancını %20 artırır ve Takım Uyumu kayıplarını yarıya indirir, *Soğukkanlı* büyük maçlarda (derbi, sezon finali, zirve, kader maçı) heyecanı %20 azaltıp mini oyun nişangahını yavaşlatır. Mentoru haftada bir kahveye ya da yemeğe davet edersin (−20 enerji, +10 ilişki); her buluşmada bağlama uygun bir diyalog çıkar. 26 yaşını geçince roller değişir: kulüp nüfuzun 80'in üstündeyse 20 yaş ve altı gençler senden mentorluk ister; kabul edersen her hafta nüfuz +2, kulüp sadakati, hoca ve yönetim ilişkisi artar.
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
    mentor/       Mentorluk: MentorManager, kadro (yapay zekâ oyuncular), diyaloglar, büyük maçlar
    onboarding/   Seçmeler kampı (TryoutSession, hak sistemi), başlangıç teklifleri, forma numarası
  games/     Canvas mini oyunları (shot, pass, tackle, sprint)
  assets/    Sprite atlası ve yükleyicisi
  ui/        Ekranlar, SVG çizimler (avatar, arma, ikonlar), akışlar
web/tests/   Birim testleri (node --test)
web/scripts/ Denge simülasyonu, ikon üretici ve sprite atlası üretici (scripts/atlas/)
```

## Görsel paket (sprite atlası)

Oyundaki piksel görseller **Football Championship Megapack – Top-Down Pixel Art Sports Collection** paketinden gelir. Paket 20 serbest yerleşimli önizleme sayfasından oluşur (≈31 MB). Oyuna sayfaların tamamı değil, seçilen ~100 sprite tek bir atlas olarak girer:

| Dosya | Görevi |
|---|---|
| `web/assets-src/` | Ham paket (ZIP ya da PNG'ler). **Repoya girmez** (`.gitignore`). |
| `web/scripts/atlas/slice.py` | Sayfalardaki sprite'ları alfa kanalından bulur, satır/sütun adresi verir. |
| `web/scripts/atlas/manifest.json` | Oyunda kullanılan sprite'lar: `ad → [sayfa, satır, sütun]` ve boyut sınırı. |
| `web/scripts/atlas/build_atlas.py` | Seçilenleri kırpar, küçültür, tek dokuya paketler. |
| `web/src/assets/sprites/atlas.webp` · `.png` · `.json` | Üretilen atlas (~180 KB) ve çerçeve koordinatları. |
| `web/src/assets/sprites.js` | Çalışma zamanı: `sprite()` (DOM), `drawSprite()` / `spritePattern()` (Canvas). |
| `web/src/ui/spriteMap.js` | Oyun kavramı → sprite eşlemesi (aksiyonlar, antrenman, ödüller, olaylar, maç anlatımı). |

Yeni sprite eklemek için:

```bash
cd web
python3 scripts/atlas/slice.py assets-src/ /tmp/slices    # numaralı önizlemeler: /tmp/slices/debug-NN.png
# manifest.json'a "ad": [sayfa, satır, sütun] ekle
npm run atlas -- assets-src/football-megapack.zip          # atlası yeniden üret
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

Üç yoldan biri seçilebilir:

1. **Docker web servisi (şu an kullanılan):** Kök dizindeki `Dockerfile` oyunu testlerle birlikte derler ve `web/server.mjs` ile `PORT` üzerinden sunar. Render'da *New → Web Service → Docker* yeterli, ek ayar gerekmez.
2. **Blueprint:** Render panelinde *New → Blueprint* seç ve bu repoyu bağla.
3. **Static Site (elle):** *New → Static Site* oluştur, şu ayarları gir:
   - Build Command: `cd web && npm ci && npm run build`
   - Publish Directory: `web/dist`
   - Ortam değişkeni: `NODE_VERSION = 22`

## Telefona yükleme

- **iPhone / iPad:** Safari'de siteyi aç, **Paylaş → Ana Ekrana Ekle**.
- **Android:** Chrome menüsü (⋮) → **Uygulamayı yükle** ya da **Ana ekrana ekle**.

Not: Kulüp ve oyuncu isimleri kurgusaldır.

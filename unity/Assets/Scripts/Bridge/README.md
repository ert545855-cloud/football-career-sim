# Unity ↔ Web köprüsü (3B mod)

Web kariyerindeki (Krampon) maç anlarını — pas ve şut — Unity'deki 3B çizerek pas/şut sisteminde oynatır.

## Nasıl çalışır?

1. Web oyunu maçta bir pas/şut anı geldiğinde Unity WebGL derlemesini (bir kez) yükler.
2. `SendMessage("WebBridge", "StartMoment", json)` ile anı başlatır. JSON, `MomentRequest` sınıfının alanlarını taşır:
   - an türü (pas/şut) ve bağlamı (oyun kurma, son pas, ceza sahası, penaltı)
   - oyuncunun etkin pas, şut ve hız yetenekleri (statlar × yorgunluk)
   - büyük maç heyecanı ve kaleci gücü
   - iki takımın forma renkleri
3. `WebBridge` bağlama uygun bir diziliş kurar (`MomentLevels`) ve stat profilini uygular. Heyecan arttıkça ağır çekim kısalır.
4. Oyuncu pası ya da şutu yapınca sonuç `KB_SendResult` ile web'e döner (`Plugins/WebGL/KramponBridge.jslib`). Golde ağır çekim tekrarı bittikten sonra döner.
5. Web, sonucu 2B mini oyunun sonucuyla aynı biçimde işler: gol, asist, maç notu, gelişim.

## Derleme (Unity 2021.3+ / Unity 6)

1. Yeni bir sahne aç (ör. `Bridge.unity`). Boş bir GameObject ekle ve **WebBridge** bileşenini ver. Başka bir şey gerekmez; saha, kale, oyuncular ve kamera kodla kurulur.
2. **File → Build Profiles (Build Settings) → Web/WebGL** seç. Yalnızca bu sahneyi ekle.
3. **Player Settings → Publishing Settings:**
   - Compression Format: **Disabled**. Sıkıştırmayı web sunucusu (server.mjs) yapar.
   - Name Files As Hashes: **kapalı**
   - Data Caching: açık (tarayıcı derlemeyi önbelleğe alır)
4. **Player Settings → Resolution and Presentation:** Run In Background açık.
5. **Build** de ve çıktı klasörünün adını **`krampon`** koy. Unity dosyaları klasör adıyla adlandırır.
6. Çıktıdaki `Build/` klasörünü `web/public/unity/Build/` içine kopyala:
   - `krampon.loader.js`
   - `krampon.data`
   - `krampon.framework.js`
   - `krampon.wasm`

   `StreamingAssets` klasörü varsa onu da `web/public/unity/` altına kopyala.
7. GitHub'a gönder. Render yeniden yayınladıktan sonra web oyununda **Ayarlar → 3B mod (Unity)** görünür.

## Editörde deneme

WebBridge bileşeninin ⋮ menüsünde iki komut var: **Editörde dene: pas** ve **Editörde dene: şut**. Sonuç JSON'u konsola yazılır.

## Notlar

- Derleme boyutu genelde 15–30 MB olur; ilk açılışta indirilir, sonra tarayıcı önbelleğinden gelir.
- 3B yüklenemezse (eski cihaz, bağlantı yok) oyun sessizce 2B mini oyuna döner.
- Titreşim WebGL'de `navigator.vibrate` ile çalışır (Android). iOS Safari titreşimi desteklemez.

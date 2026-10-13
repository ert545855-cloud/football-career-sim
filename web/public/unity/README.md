# Unity 3B derlemesi buraya

Bu klasöre Unity WebGL derlemesini koyduğunda web oyununda **Ayarlar → 3B mod (Unity)** seçeneği görünür.
Açıkken maçtaki pas ve şut anları 3B sahnede oynanır; yüklenemezse oyun otomatik olarak 2B mini oyuna döner.

Beklenen dosyalar:

```
web/public/unity/Build/krampon.loader.js
web/public/unity/Build/krampon.data
web/public/unity/Build/krampon.framework.js
web/public/unity/Build/krampon.wasm
```

Derleme adımları: `unity/Assets/Scripts/Bridge/README.md`.

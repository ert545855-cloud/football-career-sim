# Çizerek Pas Sistemi (3B, Unity)

Score! Hero / New Star Soccer tarzı pas mekaniği. Oyuncu pas moduna girer, zaman ağır çekime geçer, kamera oyuncunun arkasına süzülür. Oyuncu parmağıyla (ya da fareyle) topa dokunup kavisli bir hat çizer. Parmağını kaldırınca zaman normale döner ve top çizilen Bezier eğrisinde falsolu şekilde uçar. Çizim başladığı andan itibaren en yakın iki rakip baskıya koşar.

Namespace: `FootballCareer.Passing` · Unity 2021.3 LTS ve üstü (Unity 6 dahil) · Built-in ve URP ile çalışır.

## Dosyalar

| Dosya | Görevi |
|---|---|
| `PasManager.cs` | Akışı yönetir: durum makinesi, ağır çekim, girdi ve çizim, Bezier önizleme (LineRenderer), baskı ve top kapma, sonuç olayları |
| `BallController.cs` | Topu yol üzerinde sabit hızla taşır, falso dönüşünü uygular, çarpışma ve ulaşma kontrolünü yapar (SphereCast + OverlapSphere, NonAlloc) |
| `EnemyAI.cs` | Rakip yapay zekâsı (NavMeshAgent): bekleme, pasöre baskı, iniş noktasına baskı, araya girme, yerine dönme |
| `GoalFrame.cs` | Kale: kale çizgisi, direkler ve üst direk analitik olarak tanımlanır (collider gerekmez). Gol, direk ve aut kararını verir; kale ağzına nişan alınmasını sağlar |
| `GoalkeeperAI.cs` | Kaleci: topa göre konum alır, çizgiden çıkıp açıyı daraltır. Şutun geçeceği noktayı ve süresini hesaplayıp plonjon yapar |
| `PassReceiver.cs` | Takım arkadaşı: hedef halkası, pası karşılamak için koşu. Pası atan oyuncuda da bulunur |
| `PassCameraController.cs` | Üç kamera modu arasında gerçek zamanlı yumuşak geçiş: yayın, oyuncu arkası (3. şahıs) ve top takibi |
| `PassPath.cs` | Çizimden kübik Bezier üretir, yay uzunluğu tablosunu tutar (sabit hız için) ve falso açısını hesaplar |
| `PassTypes.cs` | `PassState`, `PassOutcome`, `PassResult` ve `PassResultEvent` tipleri |
| `PassSkillProfile.cs` | Oyuncu statlarını oynanış çarpanlarına çevirir: ağır çekim, mesafe, hız, isabet sapması, falso ustalığı, top koruma |
| `CareerStatsBridge.cs` | Kariyer profilini PasManager'a uygular; isabetli pas ve gol statları geliştirir |
| `Feedback/PassFeedback.cs` | His: titreşim, ses ve kamera sarsıntısı (vuruş, pas ulaştı, gol, kurtarış, direk, başarısız) |
| `Feedback/GoalReplay.cs` | Gol tekrarı: son vuruşu kaydeder, golden sonra yandan ağır çekimde yeniden oynatır |
| `Feedback/ProceduralSfx.cs` | Ses dosyası olmadan kodla üretilen efektler (vuruş, ağlar, tribün, direk, düdük) |
| `../Core/Haptics.cs` + `Plugins/iOS/FCHaptics.mm` + `Plugins/WebGL/FCHaptics.jslib` | Platformlar arası titreşim |
| `Levels/PassLevel.cs` | Bölüm verisi (ScriptableObject): diziliş, hedef, hak, yıldız eşikleri, zorluk |
| `Levels/LevelRunner.cs` | Bölümü kurar; hedef, puan, hak ve yıldızları yönetir, en iyi sonucu kaydeder |
| `Levels/LevelScoring.cs` | Puanlama ve yıldız hesabı (`LevelScoring`), kayıt ve kilitler (`LevelProgress`) |
| `Levels/BuiltInLevels.cs` | Hazır 8 bölüm ve serbest oyun |
| `Levels/PrefabFormationSpawner.cs` | Bölüm dizilişini sizin oyuncu prefab'larınızla kurar |
| `Demo/PassDemoBootstrap.cs` | Boş sahnede her şeyi kodla kurar, bölüm menüsünü çizer (deneme için) |
| `Demo/PitchBuilder.cs` | Deneme sahnesinin saha, kale ve oyuncularını ilkel şekillerle üretir |
| `../Core/InputCompat.cs` | Dokunma ve fare girdisini tek API'de toplar. Eski Input Manager ile yeni Input System'i destekler |

## En hızlı deneme (1 dakika)

1. Yeni, boş bir sahne açın (File > New Scene > Basic).
2. Boş bir GameObject oluşturun ve `PassDemoBootstrap` ekleyin.
3. Play'e basın. Saha, NavMesh, top, kamera ve pas çizgisi çalışma anında kurulur, bölüm menüsü açılır.
   Bir bölüm ya da **Serbest Oyun** seçin.
   - **Space** tuşuna basın ya da ekrana dokunun: ağır çekim başlar ve kamera oyuncunun arkasına geçer.
   - Topa tıklayın, sürükleyin ve bırakın: pas atılır.
   - Çizgiyi kale ağzına çekerseniz şut olur. Kalenin neresine çizerseniz (köşe, üst, yerden) oraya vurulur.
   - **Esc**: rakip baskısı başlamadıysa pas modundan çıkar.

## Kendi sahnenize kurulum

### 1. Saha ve NavMesh
- Saha zeminini **Navigation Static** yapıp bake edin:
  - Unity 2021: Window > AI > Navigation > Bake.
  - 2022 ve üstü: AI Navigation paketindeki `NavMeshSurface` bileşenini ekleyip **Bake**'e basın.
- NavMesh yoksa rakipler yine çalışır, düz çizgide yürürler. Konsolda bir uyarı görürsünüz.

### 2. Top
- Bir küre ekleyin (ölçek 0.22 → yarıçap 0.11 m). `BallController` ekleyin; Rigidbody otomatik eklenir ve kinematik yapılır.
- İsteğe bağlı:
  - `Trail Renderer` ekleyip `trail` alanına bağlayın. Uçuşta açılır, falsonun izini gösterir.
  - Dönüşün görünmesi için desenli bir top modeli kullanın.

### 3. Oyuncular
- **Takım arkadaşları ve pası atan oyuncu:** `PassReceiver` ekleyin.
  - `highlight` alanına ayak altındaki halka renderer'ını bağlayın. Halka hedeflenince yanar.
  - Collider gereklidir (kapsül olabilir).
- **Rakipler:** `NavMeshAgent` ve `EnemyAI` ekleyin. Collider gereklidir.
- Hareket eden oyunculara **kinematik Rigidbody** eklemek fizik performansı için önerilir.
- Pivot önerisi: oyuncu kökü yerde (y = 0), gövde çocuk nesne. Böylece NavMeshAgent `baseOffset` gerektirmez.

### 4. Kamera
- Main Camera'ya `PassCameraController` ekleyin. Değerler hazırdır:
  - yayın kamerası: ofset (0, 16, −13)
  - pas modu: oyuncunun 7 m arkası, 4.5 m yükseklik
- Cinemachine kullanıyorsanız bu bileşeni bir "rig" nesnesine ekleyip sanal kamerayla takip ettirebilirsiniz.

### 5. Pas çizgisi
- Boş bir nesneye `LineRenderer` ekleyin ve **Use World Space** açık olsun.
- Malzeme olarak köşe rengi destekleyen bir shader seçin. Çizgi rengi koddan değişir:
  - Built-in: `Sprites/Default`
  - URP: `Universal Render Pipeline/Particles/Unlit`
- Genişlik: 0.25. İsteğe bağlı: Width eğrisi 1 → 0.5, End Cap Vertices 4.

### 6. Kale ve kaleci (şut için)
- Kale çizgisinin ortasına, zemin hizasında boş bir nesne koyun ve `GoalFrame` ekleyin.
  - Mavi ok (forward) **sahaya** baksın.
  - Hücum ettiğiniz kalede `attackTarget` açık olsun.
- Kaleciye `GoalkeeperAI` ekleyin ve `goal` alanına bu kaleyi bağlayın.
  - `body`: dalışta yana yatan gövde, collider'ı da taşır.
  - `skill` (0–1): zor toplarda kurtarma olasılığı.
- Kalecide `EnemyAI` **olmasın**: kaleci baskıya çıkmaz, kalesini korur.

### 7. PasManager
- Sahnede tek bir nesneye `PasManager` ekleyin ve alanları bağlayın:
  - `ball`, `passer` (topu ilk alan oyuncu), `cameraRig`, `line`
  - `cam` boşsa Main Camera kullanılır.
  - `teammates` / `enemies` listeleri boşsa sahnedekiler otomatik bulunur (`autoFindPlayers`).
  - `pitchBounds`: sahanın sınırları. Varsayılan 68 × 105 m ve (0, 0, 0) merkezli. Dışına çıkan top **OutOfBounds** sayılır.

### 8. (İsteğe bağlı) Katmanlar
- Oyuncuları bir **Players** katmanına alın ve `BallController > playerMask` alanında yalnızca o katmanı seçin.
- Böylece fizik sorguları zemini ve dekoru hiç görmez. Zorunlu değildir; filtreleme bileşene göre de yapılır.

## Bölümler (Score! Hero tarzı)

Her bölümün bir **hedefi**, birkaç **hakkı** ve **yıldız eşikleri** vardır:

| Hedef | Açıklama |
|---|---|
| `CompletePasses` | `targetCount` kadar isabetli pas |
| `ScoreGoal` | Gol at. `passBudget` > 0 ise en fazla o kadar pasla |
| `ScoreCurvedGoal` | Falsolu bir vuruşla gol (\|falso\| ≥ 0.25) |
| `ScoreLongRange` | En az `targetCount` metreden gol |
| `FreePlay` | Serbest oyun: bitmez, hak gitmez |

**Deneme kuralları:**
- Başarısız pas ya da şut 1 hak götürür. Pozisyon baştan kurulur ve deneme puanı sıfırlanır.
- Hedefe uymayan gol hak götürmez, yalnızca pozisyon yeniden kurulur. Örnek: falsolu gol istenen bölümde düz atılan gol.
- Hedefi tamamlayan denemenin puanı yıldızları belirler:
  - **1 yıldız:** hedef tamamlandı.
  - **2 ve 3 yıldız:** puan `twoStarScore` / `threeStarScore` eşiklerini geçti.

**Puan:**
- İsabetli pas: 100 + falso (en fazla 80) + metre başına 2.
- Gol: 500 + falso (en fazla 300) + 12 m'den uzak her metre için 10 + köşeye 150.

**Kayıt ve kilitler:**
- En iyi yıldız ve puan `PlayerPrefs`'te saklanır (WebGL'de tarayıcıda).
- Bir bölüm, bir öncekinden en az 1 yıldız alınınca açılır.

**Bölüm başına zorluk:**
- `slowTimeScale`
- rakiplerin baskı ve araya girme hızları
- baskıya koşan rakip sayısı: 0 verilirse rakipler baraj gibi yerinde durur.
- kalecinin yeteneği

**Kendi bölümleriniz:**
1. Create > Football Career > Pas Bölümü ile bir bölüm oluşturun.
2. `LevelRunner > levels` listesine sürükleyin. Liste boşsa hazır bölümler kullanılır.
3. Oyuncuları kendi prefab'larınızla kurmak için sahneye `PrefabFormationSpawner` ekleyip `LevelRunner > spawnerBehaviour` alanına bağlayın.

**Arayüz:** `LevelRunner` arayüzden bağımsızdır.
- Bilgiler: `State`, `Score`, `LivesLeft`, `PassesUsed`, `StarsEarned`, `Message`.
- Olaylar: `Changed`, `LevelWon`, `LevelLost`.
- Komutlar: `Load(i)`, `StartPlay()`, `Retry()`, `Next()`, `Quit()`.
- Demo bunları IMGUI ile çizer; kendi Canvas'ınıza aynı şekilde bağlayabilirsiniz.

## His: titreşim, ses, sarsıntı, gol tekrarı

`PasManager`'ın yanına `PassFeedback` ve `GoalReplay` ekleyin (demo ekler).

**Titreşim (`Core/Haptics`):**

| An | Desen |
|---|---|
| Pas moduna giriş | Çok hafif tık |
| Çizime başlama | Hafif tık |
| Pas vuruşu | Orta |
| Şut vuruşu | Sert |
| Pas arkadaşa ulaştı | Çift hafif tık |
| **GOL** | Ritmik, uzun kutlama titreşimi (~0.7 sn) |
| Kurtarış / direk / başarısız | Kendi desenleri |

- **Android:** `VibrationEffect.createWaveform` ile güç ayarlı desenler.
- **iOS:** Taptic Engine (`FCHaptics.mm`, Unity Xcode projesine otomatik ekler).
- **WebGL:** `navigator.vibrate` (Android tarayıcıları; iOS Safari desteklemez).
- Oyuncu titreşimi kapatabilir: `Haptics.Enabled = false` (kayıtlıdır).

**Ses:**
- `PassFeedback`'e kendi kayıtlarınızı verin. Boş bırakılanlar kodla üretilir; bu sayede proje ses dosyası olmadan da sesli çalışır.
- Ses seviyesi `volume`, tribün sesi `crowdVolume` ile ayarlanır.

**Kamera sarsıntısı:**
- Şutta hafif, golde güçlü, direkte keskin.
- Yumuşak geçişleri bozmaz.
- `PassCameraController.Shake(m, sn)` ile kodla da tetiklenebilir. `SetShakeMultiplier(0)` kapatır.

**Gol tekrarı:**
- Her vuruşta top ve oyuncuların pozları kaydedilir.
- Gol olursa ağlar 0.9 sn sallanır. Ardından oyun durur ve son vuruş kalenin yanından, %40 hızda yeniden oynatılır.
- Ekrana dokunmak tekrarı geçer.
- Tekrar sürerken `PasManager` dizilişi sıfırlamaz (`HoldResolve`).
- UI için olaylar: `ReplayStarted` / `ReplayEnded`.

## Statların etkisi (kariyer bağlantısı)

`PasManager`'ın yanına `CareerStatsBridge` ekleyin. Aktif kariyer profilinin (`GameSession.Current`) statları oynanışı etkiler; oynanış da statları geliştirir. Statlar Inspector ve bölüm ayarlarının **üzerine çarpan** olarak uygulanır.

| Stat | Etkisi (stat 0 → 100) |
|---|---|
| **Pas** | Ağır çekim ×1.30 → ×0.70 (iyi pasöre daha çok düşünme süresi). En uzak pas ×0.80 → ×1.10. Pas hızı. Yanal sapma 30 m'de 1.8 m → 0. Çizilen kavisin uygulanan kısmı %63 → %100 |
| **Şut** | Şut hızı ×0.94 → ×1.20. Kale ağzında sapma 1 m → 0. Falso ustalığı %63 → %100 |
| **Hız** (+%30 Dayanıklılık) | Rakibin top kapma mesafesi ×1.14 → ×0.80 |
| **Enerji** | Düştükçe hepsi zayıflar (`FatigueMultiplier`) |

- Stat 0 bile çaresiz değildir: etki %25 tabandan başlar.
- Önizleme çizgisi uygulanabilecek kavisi gösterir, yani sürpriz olmaz. Sapma ise pas atıldığında rastgele eklenir; küçük sapmalar sık, büyükleri seyrek görülür.
- **Gelişim:**
  - İsabetli pas Pas statına, gol Şut statına gelişim puanı yazar.
  - Falsolu vuruşlar %60'a kadar daha çok puan verir.
  - Mevki çarpanları geçerlidir.
  - İsteğe bağlı olarak her deneme enerji harcar (`spendEnergy`).
- Kariyer kaydı yoksa nötr profil kullanılır. Demo menüsünde Pas/Şut kaydırıcılarıyla etkiyi deneyebilirsiniz.
- Kodla uygulamak için: `pas.ApplySkill(PassSkillProfile.FromProfile(profil))` ya da `FromSkills(pas, şut, hız)` (0–1).

## Oyuna bağlama (sonuçları dinleme)

```csharp
using FootballCareer.Passing;
using UnityEngine;

public class PassStats : MonoBehaviour
{
    [SerializeField] private PasManager pas;
    private int isabetli, toplam;

    private void OnEnable()  { pas.PassFinished += OnPass; }
    private void OnDisable() { pas.PassFinished -= OnPass; }

    private void OnPass(PassResult r)
    {
        toplam++;
        if (r.Success) isabetli++;
        Debug.Log(r.Describe() + "  uzunluk=" + r.pathLength.ToString("F1") + " m  falso=" + r.curve.ToString("F2"));
        // r.outcome: Completed / Intercepted / OutOfBounds / Stolen / Missed
        // r.receiver (başarılıysa topu alan), r.interceptor (kesen/kapan rakip)
    }
}
```

- Aynı sonuç Inspector'dan `onPassFinished` (UnityEvent) olayıyla da alınabilir.
- `onPassModeEntered` ve `onDrawStarted` olayları ses ve titreşim efektleri için uygundur.
- Kendi UI düğmenizden pas moduna girmek için `pas.EnterPassMode()` çağırın.
- Pozisyonu yeniden başlatmak için `pas.ResetPlay()`, topu başka bir oyuncuya vermek için (taç, serbest vuruş…) `pas.GiveBallTo(oyuncu)` kullanın.
- `pas.Pressure` (0–1) rakip baskısı çubuğu çizmek için kullanılabilir.

## Mekanik ayrıntıları

**Ağır çekim.**
- `Time.timeScale` yumuşakça 0.15'e iner (`slowTimeScale`).
- `Time.fixedDeltaTime` da aynı oranda küçülür. Ağır çekimde de saniyede 50 fizik adımı kalır, hareket takılmaz.
- Kamera, hedef halkası ve rakip yol yenileme **gerçek zamanla** çalışır. Ağır çekimden etkilenmezler.
- Parmak kalktığı an zaman **anında** 1.0'a döner.
- `PasManager` devre dışı kalırsa ya da sahne değişirse zaman ölçeği otomatik geri yüklenir.

**Çizim → Bezier.**
- Çizgi topun konumundan başlar. Çizim, topun ekrandaki konumuna `startTouchRadius` (ekran yüksekliğinin %22'si) yakınlıkta başlamalıdır.
- Dokunuşlar yerdeki düzleme ışınlanır ve 0.4 m aralıkla nokta toplanır.
- Eğri çizimin başından, 1/3'ünden, 2/3'ünden ve ucundan **geçecek** şekilde uydurulur (kübik Bezier, iki bilinmeyenli denklemin çözümü).
- Aşırı zikzaklı çizimlerde kontrol noktaları sınırlandırılır.
- Uzun paslara mesafeyle orantılı bir yay eklenir (`loftPerMeter`). Top `reachHeight` (2.1 m) üstündeyken kimse ona ulaşamaz, bu yüzden araya giren rakibin üstünden aşırtma mümkündür.
- Çizgi rengi:
  - **yeşil:** hedefte arkadaş var ve yol temiz.
  - **turuncu:** yolda rakip var.
  - **beyaz:** hedefte arkadaş yok.

**Top.**
- Yay uzunluğu tablosu sayesinde eğri boyunca sabit hızla gider. Hız 12–26 m/sn arasındadır; uzun pas daha serttir.
- Dönüş iki bileşenlidir:
  - yuvarlanma: ilerleme yönüne dik eksende, hız ÷ yarıçap.
  - yan dönüş (falso): dikey eksende, eğrinin toplam dönüş açısıyla orantılı. Sola kıvrılan pas sola döner.
- Her fizik adımında önceki konumdan yenisine SphereCast atılır. Hızlı top oyuncuların içinden geçmez.
- Yol bitince kimse almadıysa top yerde yuvarlanır ve yavaşlar. Yine kimse almazsa sonuç **Missed** olur.

**Şut.**
- Çizginin ucu kale ağzına (kalenin dikey düzlemine) değerse çizgi **sarı** olur ve pas değil şut atılır.
- Hedefin **yüksekliği** de çizimden alınır: üst köşe, orta, yerden.
- Şut daha sert (18–32 m/sn) ve daha düz gider.
- Yoldan geçen takım arkadaşları şutu almaz; rakipler ise önüne atlayıp şutu bloklayabilir.
- **Kaleci:**
  - Topun kendi hizasından geçeceği noktayı ve varış süresini hesaplar.
  - Tepki süresinden sonra plonjon yapar. Falsolu şutlar tepki süresini uzatır.
  - Rahat topları tutar. Zor toplarda yeteneğine göre ya yetişir ya parmak ucuyla kaçırır. Köşeler ve yakın mesafeden sert şutlar çoğu zaman gol olur.
- **Sonuçlar:**

| Durum | Sonuç |
|---|---|
| Top direklerin arasından geçti | **Goal** (top ağlarda durur) |
| Kaleci tuttu | **Saved** |
| Direğe ya da üst direğe çarptı | **HitFrame** (top seker) |
| Kalenin yanından ya da üstünden gitti | **Wide** |

- Şuttan sonra diziliş baştan kurulur (`resetAfterShot`).

**Rakipler.**
- Çizim başlayınca en yakın 2 rakip baskıya koşar (`pressersCount`):
  - 1. rakip pasöre koşar.
  - 2. rakip tahmini iniş noktasına koşar. Bu hedef çizim değiştikçe güncellenir.
- Rakipler ağır çekimde yavaşlar ama durmaz. Bir rakip pasöre `stealRadius` (1.1 m) kadar yaklaşırsa top kapılır (**Stolen**).
- Pas modunda hiç çizmeden `pressureAfterIdleAim` (3 sn) beklenirse baskı yine başlar.
- Pas atılınca tüm rakipler araya girme moduna geçer. Topun kalan yolunda, topa ondan önce varabilecekleri en erken noktaya koşarlar (tepki süresi 0.15 sn).

**Sonuç.**

| Durum | Sonuç |
|---|---|
| Top bir arkadaşa ulaştı | **Completed**. Topu alan oyuncu yeni pasör olur |
| Top rakibe çarptı ya da rakip araya girdi | **Intercepted** |
| Top saha dışına çıktı | **OutOfBounds** |
| Çizerken çok beklendi | **Stolen** |
| Top kimseye ulaşmadı | **Missed** |

Başarısız pastan sonra `autoResetOnFail` açıksa diziliş 1 saniye sonra baştan kurulur.

## Ayar önerileri

| Ne istiyorsunuz? | Alan |
|---|---|
| Daha zor (rakip daha çabuk gelsin) | `EnemyAI.pressSpeed` ↑, `PasManager.slowTimeScale` ↑ (0.2–0.25) |
| Daha kolay | `PasManager.stealRadius` ↓, `EnemyAI.reactionTime` ↑, `BallController.receiveRadius` ↑ |
| Daha kavisli paslar | `BallController.sideSpinDegPerSec` ↑ (yalnızca görsel), çizim serbest |
| Daha yüksek paslar | `PasManager.loftPerMeter` ↑ / `maxLoft` ↑ |
| Kamera oyuncuya daha yakın | `PassCameraController.aimDistance` ↓, `aimHeight` ↓ |

## Girdi

`Core/InputCompat` iki girdi sisteminde de çalışır (Project Settings > Player > Active Input Handling):
- Eski Input Manager'da önce dokunma, yoksa fare okunur.
- Yeni Input System'de `Pointer.current` kullanılır.

Pas çizimi Canvas düğmelerinin üstünde başlamaz (`EventSystem.IsPointerOverGameObject`).

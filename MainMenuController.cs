using FootballCareer.Core;
using UnityEngine;
using UnityEngine.Events;
using UnityEngine.SceneManagement;
using UnityEngine.UI;

namespace FootballCareer.UI
{
    /// <summary>
    /// Ana Menü kontrolcüsü.
    ///
    /// KURULUM ÖZETİ:
    ///   1) Bu script'i Canvas'a (veya Canvas altındaki boş bir "MainMenu" objesine) ekle.
    ///   2) Inspector'daki alanlara butonları ve panelleri sürükle-bırak.
    ///   3) Butonların OnClick listesine Inspector'dan bir şey EKLEME — bağlantıyı
    ///      bu script Awake() içinde kodla yapıyor. İkisini birden yaparsan
    ///      fonksiyon iki kez çalışır.
    ///
    /// Tüm buton fonksiyonları public olduğu için istersen Inspector'daki
    /// OnClick'ten de bağlayabilirsin; o zaman ilgili Button alanını boş bırak.
    /// </summary>
    [DisallowMultipleComponent]
    public class MainMenuController : MonoBehaviour
    {
        // ─────────────────────────────────────────────────────────────
        // INSPECTOR ALANLARI
        // ─────────────────────────────────────────────────────────────

        [Header("Ana Menü Butonları")]
        [SerializeField] private Button newCareerButton;
        [SerializeField] private Button continueButton;
        [SerializeField] private Button settingsButton;
        [SerializeField] private Button exitButton;

        [Header("Ayarlar Paneli")]
        [Tooltip("Başlangıçta kapalı olmalı. İçinde tam ekran, yarı saydam bir Image " +
                 "(Raycast Target açık) olursa arkadaki menü butonlarına tıklanmaz.")]
        [SerializeField] private GameObject settingsPanel;
        [SerializeField] private Button settingsCloseButton;

        [Header("Üzerine Yazma Onayı (Opsiyonel)")]
        [Tooltip("Kayıt varken 'Yeni Kariyer'e basılırsa gösterilir. " +
                 "Boş bırakılırsa onay sorulmadan oyuncu oluşturmaya geçilir.")]
        [SerializeField] private GameObject overwriteConfirmPanel;
        [SerializeField] private Button overwriteConfirmButton;
        [SerializeField] private Button overwriteCancelButton;

        [Header("Sahneler (File > Build Profiles > Scene List'e eklenmiş olmalı)")]
        [SerializeField] private string playerCreationSceneName = SceneNames.PlayerCreation;
        [SerializeField] private string careerSceneName         = SceneNames.CareerHub;

        [Header("Kayıt Kontrolü")]
        [Tooltip("File: diskte kayıt dosyası var mı bakar (önerilen).\n" +
                 "PlayerPrefsFlag: PlayerPrefs'teki 0/1 bayrağına bakar.")]
        [SerializeField] private SaveCheckMode saveCheckMode = SaveCheckMode.File;

        // Sahne yüklenirken çift tıklamayı engellemek için
        private bool isLoadingScene;

        // ─────────────────────────────────────────────────────────────
        // UNITY YAŞAM DÖNGÜSÜ
        // ─────────────────────────────────────────────────────────────

        private void Awake()
        {
            ValidateReferences();
            BindButtons();

            // Paneller editörde açık unutulsa bile oyun her zaman kapalı başlasın
            SetActiveSafe(settingsPanel, false);
            SetActiveSafe(overwriteConfirmPanel, false);

            ConfigurePlatformSpecificUI();
        }

        // OnEnable, Awake'ten hemen sonra ve menü her yeniden aktif olduğunda çalışır.
        // Böylece oyundan menüye dönüldüğünde "Devam Et" durumu tazelenir.
        private void OnEnable()
        {
            RefreshContinueButton();
        }

        private void Update()
        {
            // Android'in fiziksel/sanal "Geri" tuşu Unity'de Escape olarak gelir.
            if (BackPressedThisFrame())
            {
                HandleBack();
            }
        }

        private void OnDestroy()
        {
            UnbindButtons();
        }

        // ─────────────────────────────────────────────────────────────
        // 1) YENİ KARİYER
        // ─────────────────────────────────────────────────────────────

        /// <summary>
        /// "Yeni Kariyer" butonu. Kayıt varsa önce onay ister, yoksa
        /// doğrudan oyuncu oluşturma ekranına geçer.
        /// </summary>
        public void OnNewCareerClicked()
        {
            bool hasExistingSave = SaveSystem.HasSave(saveCheckMode);

            if (hasExistingSave && overwriteConfirmPanel != null)
            {
                overwriteConfirmPanel.SetActive(true);
                return;
            }

            StartNewCareer();
        }

        private void OnOverwriteConfirmed()
        {
            CloseOverwriteConfirm();
            StartNewCareer();
        }

        public void CloseOverwriteConfirm()
        {
            SetActiveSafe(overwriteConfirmPanel, false);
        }

        private void StartNewCareer()
        {
            // DİKKAT: Eski kaydı burada SİLMİYORUZ.
            // Oyuncu, oluşturma ekranında vazgeçip menüye dönebilir.
            // Eski kayıt, yeni oyuncu oluşturma tamamlanıp ilk kez
            // SaveSystem.Save(...) çağrıldığında zaten üzerine yazılacak.
            LoadScene(playerCreationSceneName);
        }

        // ─────────────────────────────────────────────────────────────
        // 2) DEVAM ET
        // ─────────────────────────────────────────────────────────────

        /// <summary>
        /// Kayıt durumuna göre "Devam Et" butonunu aktif/pasif yapar.
        /// Kayıt oluşturduktan veya sildikten sonra elle de çağırabilirsin.
        /// </summary>
        public void RefreshContinueButton()
        {
            if (continueButton == null) return;

            bool canContinue = !isLoadingScene && SaveSystem.HasSave(saveCheckMode);

            // interactable = false olunca Button, Inspector'daki "Disabled Color"
            // rengine geçer ve tıklamaları yok sayar.
            continueButton.interactable = canContinue;
        }

        /// <summary>"Devam Et" butonu. Kayıtlı kariyerin ana ekranına geçer.</summary>
        public void OnContinueClicked()
        {
            // Güvenlik: buton aktifken kayıt arka planda silinmiş olabilir
            if (!SaveSystem.HasSave(saveCheckMode))
            {
                Debug.LogWarning("[MainMenu] Devam edilecek kayıt bulunamadı.");
                RefreshContinueButton();
                return;
            }

            // Kaydı şimdi yüklüyoruz ki bozuksa kariyer sahnesine hiç gitmeyelim.
            if (!GameSession.EnsureLoaded())
            {
                Debug.LogError("[MainMenu] Kayıt okunamadı (bozuk olabilir). " +
                               "Yeni Kariyer ile baştan başlayabilirsin.");
                return;
            }

            LoadScene(careerSceneName);
        }

        // ─────────────────────────────────────────────────────────────
        // 3) AYARLAR
        // ─────────────────────────────────────────────────────────────

        public void OpenSettings()   => SetSettingsVisible(true);
        public void CloseSettings()  => SetSettingsVisible(false);
        public void ToggleSettings() => SetSettingsVisible(!IsOpen(settingsPanel));

        private void SetSettingsVisible(bool visible)
        {
            if (settingsPanel == null)
            {
                Debug.LogWarning("[MainMenu] Settings Panel atanmamış.");
                return;
            }

            settingsPanel.SetActive(visible);
        }

        // ─────────────────────────────────────────────────────────────
        // 4) ÇIKIŞ
        // ─────────────────────────────────────────────────────────────

        /// <summary>Oyunu kapatır. Editörde Play modunu durdurur.</summary>
        public void OnExitClicked()
        {
#if UNITY_EDITOR
            // Application.Quit() editörde hiçbir şey yapmaz; test için Play'i durduruyoruz.
            UnityEditor.EditorApplication.isPlaying = false;
#else
            Application.Quit();
#endif
        }

        // ─────────────────────────────────────────────────────────────
        // YARDIMCILAR
        // ─────────────────────────────────────────────────────────────

        private void BindButtons()
        {
            AddListener(newCareerButton,        OnNewCareerClicked);
            AddListener(continueButton,         OnContinueClicked);
            AddListener(settingsButton,         OpenSettings);
            AddListener(settingsCloseButton,    CloseSettings);
            AddListener(exitButton,             OnExitClicked);
            AddListener(overwriteConfirmButton, OnOverwriteConfirmed);
            AddListener(overwriteCancelButton,  CloseOverwriteConfirm);
        }

        private void UnbindButtons()
        {
            RemoveListener(newCareerButton,        OnNewCareerClicked);
            RemoveListener(continueButton,         OnContinueClicked);
            RemoveListener(settingsButton,         OpenSettings);
            RemoveListener(settingsCloseButton,    CloseSettings);
            RemoveListener(exitButton,             OnExitClicked);
            RemoveListener(overwriteConfirmButton, OnOverwriteConfirmed);
            RemoveListener(overwriteCancelButton,  CloseOverwriteConfirm);
        }

        private static void AddListener(Button button, UnityAction action)
        {
            if (button != null) button.onClick.AddListener(action);
        }

        private static void RemoveListener(Button button, UnityAction action)
        {
            if (button != null) button.onClick.RemoveListener(action);
        }

        /// <summary>Sahneyi güvenli şekilde yükler; yüklenirken menüyü kilitler.</summary>
        private void LoadScene(string sceneName)
        {
            if (isLoadingScene) return;

            if (string.IsNullOrWhiteSpace(sceneName))
            {
                Debug.LogError("[MainMenu] Sahne adı boş.");
                return;
            }

            if (!Application.CanStreamedLevelBeLoaded(sceneName))
            {
                Debug.LogError($"[MainMenu] '{sceneName}' sahnesi bulunamadı. " +
                               "File > Build Profiles > Scene List'e ekli mi ve adı doğru mu?");
                return;
            }

            isLoadingScene = true;
            SetMenuInteractable(false);
            SceneManager.LoadSceneAsync(sceneName);
        }

        private void SetMenuInteractable(bool interactable)
        {
            SetInteractableSafe(newCareerButton, interactable);
            SetInteractableSafe(settingsButton,  interactable);
            SetInteractableSafe(exitButton,      interactable);
            // "Devam Et" yalnızca kayıt varsa açılabilir
            SetInteractableSafe(continueButton,  interactable && SaveSystem.HasSave(saveCheckMode));
        }

        /// <summary>Geri tuşu: en üstteki paneli kapatır.</summary>
        private void HandleBack()
        {
            if (IsOpen(overwriteConfirmPanel)) { CloseOverwriteConfirm(); return; }
            if (IsOpen(settingsPanel))         { CloseSettings();         return; }

            // Ana menüdeyken geri tuşu şimdilik bir şey yapmıyor.
            // İstersen ileride burada "Çıkmak istiyor musun?" onayı açabiliriz.
        }

        private static bool BackPressedThisFrame()
        {
#if ENABLE_LEGACY_INPUT_MANAGER
            return Input.GetKeyDown(KeyCode.Escape);
#elif ENABLE_INPUT_SYSTEM
            // Projede sadece yeni Input System açıksa eski Input sınıfı hata verir.
            var keyboard = UnityEngine.InputSystem.Keyboard.current;
            return keyboard != null && keyboard.escapeKey.wasPressedThisFrame;
#else
            return false;
#endif
        }

        private void ConfigurePlatformSpecificUI()
        {
#if UNITY_IOS || UNITY_WEBGL
            // iOS: Apple, uygulamaların kendini kapatmasını önermez (App Review riski).
            // WebGL: Application.Quit() tarayıcıda çalışmaz.
            if (exitButton != null) exitButton.gameObject.SetActive(false);
#endif
        }

        private void ValidateReferences()
        {
            if (newCareerButton == null) Debug.LogWarning("[MainMenu] New Career Button atanmamış.", this);
            if (continueButton  == null) Debug.LogWarning("[MainMenu] Continue Button atanmamış.", this);
            if (settingsButton  == null) Debug.LogWarning("[MainMenu] Settings Button atanmamış.", this);
            if (exitButton      == null) Debug.LogWarning("[MainMenu] Exit Button atanmamış.", this);
            if (settingsPanel   == null) Debug.LogWarning("[MainMenu] Settings Panel atanmamış.", this);
        }

        private static bool IsOpen(GameObject panel) => panel != null && panel.activeSelf;

        private static void SetActiveSafe(GameObject go, bool active)
        {
            if (go != null) go.SetActive(active);
        }

        private static void SetInteractableSafe(Button button, bool interactable)
        {
            if (button != null) button.interactable = interactable;
        }

        // ─────────────────────────────────────────────────────────────
        // TEST ARAÇLARI (sadece Editör'de derlenir, build'e girmez)
        // Kullanım: Inspector'da bu bileşenin başlığına sağ tıkla → DEBUG / ...
        // ─────────────────────────────────────────────────────────────
#if UNITY_EDITOR
        [ContextMenu("DEBUG / Test Forveti Kaydet")]
        private void DebugCreateTestSave()
        {
            // Gerçek bir profil kaydediyoruz ki "Devam Et" ile kariyer ekranı da test edilebilsin
            GameSession.StartNewCareer(PlayerProfile.Create("Test Oyuncu", PlayerPosition.Forward));
            RefreshContinueButton();
            Debug.Log($"[MainMenu] Test kaydı oluşturuldu: {SaveSystem.SaveFilePath}");
        }

        [ContextMenu("DEBUG / Kaydı Sil")]
        private void DebugDeleteSave()
        {
            SaveSystem.DeleteSave();
            GameSession.Clear();
            RefreshContinueButton();
            Debug.Log("[MainMenu] Kayıt silindi.");
        }

        [ContextMenu("DEBUG / Kayıt Klasörünü Aç")]
        private void DebugRevealSaveFolder()
        {
            UnityEditor.EditorUtility.RevealInFinder(Application.persistentDataPath);
        }
#endif
    }
}

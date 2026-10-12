using System;
using FootballCareer.Core;
using TMPro;
using UnityEngine;
using UnityEngine.UI;
using Random = UnityEngine.Random;

namespace FootballCareer.UI
{
    /// <summary>
    /// "PlayerCreation" sahnesinin yöneticisi.
    /// Akış: İsim gir → Mevki seç (statlar canlı önizlenir) → Oluştur
    ///       → Profil kaydedilir → CareerHub (mini oyun test ekranı) açılır.
    ///
    /// Kurulum: Canvas'a (veya altındaki bir objeye) ekle, Inspector alanlarını doldur.
    /// Butonların OnClick'ine Inspector'dan bir şey ekleme; bağlantıyı kod yapıyor.
    /// </summary>
    public class PlayerCreationUI : MonoBehaviour
    {
        [Serializable]
        private class PositionOption
        {
            public PlayerPosition position;
            public Button button = null; // "= null": Inspector'dan atanır, derleyici uyarısını susturur
            [Tooltip("Seçiliyken açılacak çerçeve/vurgu objesi (opsiyonel).")]
            public GameObject selectedIndicator = null;
        }

        [Header("İsim")]
        [SerializeField] private TMP_InputField nameInput;
        [Tooltip("Mobil tarayıcıda hızlı test için rastgele isim (opsiyonel).")]
        [SerializeField] private Button randomNameButton;

        [Header("Mevki Seçimi (3 satır: Forvet, Orta Saha, Defans)")]
        [SerializeField] private PositionOption[] positionOptions =
        {
            new PositionOption { position = PlayerPosition.Forward },
            new PositionOption { position = PlayerPosition.Midfielder },
            new PositionOption { position = PlayerPosition.Defender }
        };
        [SerializeField] private Color normalOptionColor   = new Color(0.22f, 0.26f, 0.32f);
        [SerializeField] private Color selectedOptionColor = new Color(0.16f, 0.62f, 0.34f);
        [SerializeField] private TMP_Text positionDescriptionText;

        [Header("Stat Önizleme")]
        [SerializeField] private StatPanelView statPreview;
        [Tooltip("Toplam stat puanı (opsiyonel).")]
        [SerializeField] private TMP_Text totalText;

        [Header("Alt Butonlar")]
        [SerializeField] private Button createButton;
        [SerializeField] private Button backButton;
        [Tooltip("'Bir mevki seç' gibi uyarıların yazıldığı metin.")]
        [SerializeField] private TMP_Text validationText;

        [Header("Sahneler")]
        [SerializeField] private string nextSceneName = SceneNames.CareerHub;
        [SerializeField] private string backSceneName = SceneNames.MainMenu;

        private static readonly string[] RandomFirstNames =
            { "Arda", "Kerem", "Emir", "Yusuf", "Mert", "Burak", "Can", "Efe", "Barış", "Ozan" };
        private static readonly string[] RandomLastNames =
            { "Yılmaz", "Kaya", "Demir", "Çelik", "Şahin", "Aydın", "Öztürk", "Arslan", "Doğan", "Koç" };

        private PlayerPosition? selectedPosition;

        private string CurrentName => nameInput != null ? nameInput.text : string.Empty;

        // ─────────────────────────────────────────────────────────────
        // UNITY YAŞAM DÖNGÜSÜ
        // (Butonlar sahneyle birlikte yok olduğu için dinleyicileri ayrıca
        //  temizlemeye gerek yok.)
        // ─────────────────────────────────────────────────────────────

        private void Awake()
        {
            if (nameInput != null)
            {
                nameInput.characterLimit = PlayerProfile.MaxNameLength;
                nameInput.onValueChanged.AddListener(OnNameChanged);
            }

            foreach (PositionOption option in positionOptions)
            {
                if (option == null || option.button == null) continue;

                PlayerPosition position = option.position; // lambda için yerel kopya
                option.button.onClick.AddListener(() => SelectPosition(position));
            }

            if (randomNameButton != null) randomNameButton.onClick.AddListener(FillRandomName);
            if (createButton != null)     createButton.onClick.AddListener(OnCreateClicked);
            if (backButton != null)       backButton.onClick.AddListener(OnBackClicked);
        }

        private void Start()
        {
            // Başlangıçta hiçbir mevki seçili değil; önizleme boş başlar
            UpdatePositionVisuals();
            if (statPreview != null)
            {
                statPreview.Show(new PlayerStats(), instant: true);
                statPreview.ClearHighlights();
            }
            SetText(positionDescriptionText, "Mevkini seç: başlangıç özelliklerin ona göre dağıtılacak.");
            SetText(totalText, string.Empty);
            RefreshValidation();
        }

        private void Update()
        {
            if (InputCompat.BackKeyDown()) OnBackClicked();
        }

        // ─────────────────────────────────────────────────────────────
        // MEVKİ
        // ─────────────────────────────────────────────────────────────

        public void SelectPosition(PlayerPosition position)
        {
            selectedPosition = position;
            UpdatePositionVisuals();

            PlayerStats preview = PositionPresets.GetStartingStats(position);
            if (statPreview != null)
            {
                statPreview.Show(preview);
                statPreview.HighlightForPosition(position);
            }

            SetText(positionDescriptionText, position.ToDescription());
            SetText(totalText, $"Toplam: {preview.Total}");
            RefreshValidation();
        }

        // Inspector OnClick'ten bağlamak istersen (enum parametre seçilemediği için int)
        public void SelectPositionByIndex(int index)
        {
            if (Enum.IsDefined(typeof(PlayerPosition), index))
                SelectPosition((PlayerPosition)index);
        }

        private void UpdatePositionVisuals()
        {
            foreach (PositionOption option in positionOptions)
            {
                if (option == null) continue;

                bool isSelected = selectedPosition.HasValue && selectedPosition.Value == option.position;

                if (option.selectedIndicator != null)
                    option.selectedIndicator.SetActive(isSelected);

                if (option.button != null && option.button.image != null)
                    option.button.image.color = isSelected ? selectedOptionColor : normalOptionColor;
            }
        }

        // ─────────────────────────────────────────────────────────────
        // İSİM
        // ─────────────────────────────────────────────────────────────

        private void OnNameChanged(string _)
        {
            RefreshValidation();
        }

        public void FillRandomName()
        {
            if (nameInput == null) return;

            string first = RandomFirstNames[Random.Range(0, RandomFirstNames.Length)];
            string last  = RandomLastNames[Random.Range(0, RandomLastNames.Length)];
            nameInput.text = first + " " + last; // onValueChanged → RefreshValidation
        }

        // ─────────────────────────────────────────────────────────────
        // OLUŞTUR / GERİ
        // ─────────────────────────────────────────────────────────────

        private void RefreshValidation()
        {
            string message = null;

            if (!PlayerProfile.IsValidName(CurrentName))
                message = $"İsim en az {PlayerProfile.MinNameLength} karakter olmalı.";
            else if (!selectedPosition.HasValue)
                message = "Bir mevki seç.";

            if (createButton != null)
                createButton.interactable = message == null && !SceneLoader.IsLoading;

            SetText(validationText, message ?? string.Empty);
        }

        public void OnCreateClicked()
        {
            if (SceneLoader.IsLoading) return;

            if (!selectedPosition.HasValue || !PlayerProfile.IsValidName(CurrentName))
            {
                RefreshValidation();
                return;
            }

            PlayerProfile profile = PlayerProfile.Create(CurrentName, selectedPosition.Value);

            // Eski kariyerin üzerine burada yazılır (Ana Menü'deki onaydan sonra)
            if (!GameSession.StartNewCareer(profile))
                Debug.LogWarning("[PlayerCreation] Kayıt yazılamadı; oyun bu oturumda bellekten devam edecek.");

            Debug.Log($"[PlayerCreation] {profile.PlayerName} ({profile.Position.ToDisplayName()}) oluşturuldu: {profile.Stats}");

            if (createButton != null) createButton.interactable = false;
            SceneLoader.Load(nextSceneName);
        }

        public void OnBackClicked()
        {
            SceneLoader.Load(backSceneName);
        }

        private static void SetText(TMP_Text target, string value)
        {
            if (target != null) target.text = value;
        }
    }
}

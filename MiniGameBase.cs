using System;
using FootballCareer.Core;
using FootballCareer.UI;
using TMPro;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;

namespace FootballCareer.MiniGames
{
    /// <summary>
    /// Tüm mini oyunların ortak iskeleti (Template Method deseni).
    ///
    /// Burada yapılan ortak işler:
    ///  - Paneli açma/kapama, Başla / Tekrar Dene / Kapat butonları
    ///  - Enerji harcama (Dayanıklılık) ve statlardan "etkin yetenek" hesaplama
    ///  - Dokunma/fare (TapInputButton) ve masaüstünde Space tuşu girdisi
    ///  - Sonucu ekranda gösterip Hub'a haber verme
    ///
    /// Yeni bir mini oyun yazarken sadece şunları doldurursun:
    ///  DisplayName, DefaultWeighting, IsSetupValid,
    ///  OnRoundStarted (turu hazırla), OnRoundUpdate (her kare), OnActionPressed (oyuncu bastı).
    /// </summary>
    public abstract class MiniGameBase : MonoBehaviour
    {
        [Header("Ortak UI")]
        [SerializeField] protected TMP_Text titleText;
        [Tooltip("Stat, etkin yetenek ve enerji bilgisinin yazıldığı metin.")]
        [SerializeField] protected TMP_Text infoText;
        [SerializeField] protected TMP_Text resultText;
        [SerializeField] protected Button startButton;
        [Tooltip("Başla butonunun yazısı (opsiyonel; 'Tekrar Dene' olarak değişir).")]
        [SerializeField] protected TMP_Text startButtonLabel;
        [SerializeField] protected Button closeButton;
        [Tooltip("Zamanlama butonu (ŞUT!, MÜDAHALE!). Üzerinde TapInputButton olmalı. " +
                 "Pas oyunu kullanmaz, boş bırakılabilir.")]
        [SerializeField] protected TapInputButton actionButton;

        [Header("Sonuç Renkleri")]
        [SerializeField] private Color neutralColor = Color.white;
        [SerializeField] private Color successColor = new Color(0.35f, 0.9f, 0.45f);
        [SerializeField] private Color failColor    = new Color(1f, 0.42f, 0.42f);

        [Header("Stat Ağırlıkları")]
        [Tooltip("Kapalıyken oyunun kendi varsayılan ağırlıkları kullanılır.")]
        [SerializeField] private bool overrideWeighting;
        [SerializeField] private StatWeighting customWeighting;

        [Header("Klavye")]
        [Tooltip("Masaüstü tarayıcıda Space tuşu ile de aksiyon yapılabilsin.")]
        [SerializeField] private bool allowKeyboardAction = true;

        // ─────────────────────────────────────────────────────────────
        // OLAYLAR (Hub bunları dinler)
        // ─────────────────────────────────────────────────────────────

        /// <summary>Tur başladı (enerji harcandı).</summary>
        public event Action<MiniGameBase> RoundStarted;
        /// <summary>Tur bitti; sonuç ekte.</summary>
        public event Action<MiniGameBase, MiniGameResult> RoundCompleted;
        /// <summary>Panel kapandı.</summary>
        public event Action<MiniGameBase> Closed;

        // ─────────────────────────────────────────────────────────────
        // DURUM
        // ─────────────────────────────────────────────────────────────

        public abstract string DisplayName { get; }
        protected abstract StatWeighting DefaultWeighting { get; }

        public StatWeighting Weighting   => overrideWeighting ? customWeighting : DefaultWeighting;
        public StatType      TrainedStat => Weighting.primary;
        public MiniGameState State       { get; private set; }
        public bool          IsOpen      => gameObject.activeSelf;

        protected PlayerProfile Profile   { get; private set; }
        /// <summary>Bu turun 0–1 arası etkin yeteneği (tur başında sabitlenir).</summary>
        protected float         Skill     { get; private set; }
        /// <summary>Tur başladığından beri geçen süre (saniye).</summary>
        protected float         RoundTime { get; private set; }

        // ─────────────────────────────────────────────────────────────
        // ALT SINIFLARIN DOLDURACAĞI KISIMLAR
        // ─────────────────────────────────────────────────────────────

        /// <summary>Inspector referansları tam mı? false ise tur başlamaz.</summary>
        protected abstract bool IsSetupValid();

        /// <summary>Turu hazırla: zorluğu skill'e göre ayarla, objeleri yerleştir.</summary>
        protected abstract void OnRoundStarted(float skill);

        /// <summary>Tur sürerken her kare çağrılır.</summary>
        protected abstract void OnRoundUpdate(float deltaTime);

        /// <summary>Oyuncu aksiyon butonuna bastı (veya Space).</summary>
        protected virtual void OnActionPressed() { }

        /// <summary>Panel açıldığında / tur dışında görselleri sıfırla.</summary>
        protected virtual void OnEnterIdle() { }

        /// <summary>Tur sonucu belli oldu (görsel temizlik için).</summary>
        protected virtual void OnRoundFinished(MiniGameResult result) { }

        /// <summary>Tur oynanırken panel kapatıldı.</summary>
        protected virtual void OnRoundAborted() { }

        // ─────────────────────────────────────────────────────────────
        // UNITY YAŞAM DÖNGÜSÜ
        // ─────────────────────────────────────────────────────────────

        protected virtual void Awake()
        {
            if (startButton != null)  startButton.onClick.AddListener(StartRound);
            if (closeButton != null)  closeButton.onClick.AddListener(Close);
            if (actionButton != null) actionButton.Pressed += HandleActionInput;
        }

        protected virtual void OnDestroy()
        {
            if (actionButton != null) actionButton.Pressed -= HandleActionInput;
        }

        protected virtual void Update()
        {
            if (State != MiniGameState.Playing) return;

            RoundTime += Time.deltaTime;

            if (allowKeyboardAction && actionButton != null && InputCompat.ActionKeyDown())
                HandleActionInput();

            // Aksiyon turu bitirmiş olabilir; bittiyse güncellemeyi atla
            if (State == MiniGameState.Playing)
                OnRoundUpdate(Time.deltaTime);
        }

        // ─────────────────────────────────────────────────────────────
        // GENEL API
        // ─────────────────────────────────────────────────────────────

        public void Open(PlayerProfile profile)
        {
            Profile = profile;
            gameObject.SetActive(true);
            if (titleText != null) titleText.text = DisplayName;
            EnterIdle();
        }

        public void Close()
        {
            if (State == MiniGameState.Playing) OnRoundAborted();

            State = MiniGameState.Idle;
            gameObject.SetActive(false);

            Action<MiniGameBase> handler = Closed;
            if (handler != null) handler(this);
        }

        public void StartRound()
        {
            if (State == MiniGameState.Playing) return;

            // Space tuşu "seçili butona tıkla" (Submit) olarak da çalışır.
            // Başla butonu seçili kalırsa Space yeni tur açar; seçimi bırakıyoruz.
            if (EventSystem.current != null) EventSystem.current.SetSelectedGameObject(null);

            if (!IsSetupValid())
            {
                Debug.LogError($"[{GetType().Name}] Inspector'da atanmamış referans var.", this);
                ShowResult("Kurulum eksik: Inspector'daki boş alanları doldur.", neutralColor);
                return;
            }

            if (Profile == null)
            {
                ShowResult("Profil yok! Önce oyuncu oluştur.", failColor);
                return;
            }

            // Yetenek, enerji düşmeden ÖNCEKİ yorgunlukla hesaplanır
            float skill = StatCheck.GetEffectiveSkill(Profile, Weighting);

            if (!Profile.TryConsumeEnergyForAttempt())
            {
                ShowResult("Çok yorgunsun! Ana ekranda dinlen.", failColor);
                RefreshInfo();
                return;
            }

            Skill     = skill;
            RoundTime = 0f;
            State     = MiniGameState.Playing;

            SetStartButton(false, null);
            SetActionInteractable(true);
            ShowResult(string.Empty, neutralColor);

            OnRoundStarted(Skill);
            RefreshInfo();

            Action<MiniGameBase> handler = RoundStarted;
            if (handler != null) handler(this);
        }

        // ─────────────────────────────────────────────────────────────
        // ALT SINIFLAR İÇİN YARDIMCILAR
        // ─────────────────────────────────────────────────────────────

        /// <summary>Turu bitirir, sonucu gösterir ve Hub'a bildirir.</summary>
        protected void FinishRound(MiniGameResult result)
        {
            if (State != MiniGameState.Playing) return;

            State = MiniGameState.Finished;
            SetActionInteractable(false);
            ShowResult(result.Message, result.Success ? successColor : failColor);
            SetStartButton(true, "Tekrar Dene");

            OnRoundFinished(result);

            Action<MiniGameBase, MiniGameResult> handler = RoundCompleted;
            if (handler != null) handler(this, result);

            RefreshInfo();
        }

        /// <summary>
        /// Objeyi ebeveyninin ortasına sabitler. Böylece anchoredPosition
        /// "ebeveynin merkezine göre konum" olur ve hesaplar basitleşir.
        /// </summary>
        protected static void CenterAnchors(RectTransform rectTransform)
        {
            if (rectTransform == null) return;

            Vector2 center = new Vector2(0.5f, 0.5f);
            rectTransform.anchorMin = center;
            rectTransform.anchorMax = center;
            rectTransform.pivot     = center;
        }

        /// <summary>Info metnini güncel stat/enerji ile yeniden yazar.</summary>
        protected void RefreshInfo()
        {
            if (infoText == null || Profile == null) return;

            StatWeighting w = Weighting;
            string line1 = $"{w.primary.ToDisplayName()}: {Profile.Stats.Get(w.primary)}";
            if (w.HasSecondary)
                line1 += $"   {w.secondary.ToDisplayName()}: {Profile.Stats.Get(w.secondary)} (%{Mathf.RoundToInt(w.secondaryWeight * 100f)})";

            float previewSkill = StatCheck.GetEffectiveSkill(Profile, w);
            string line2 = $"Etkin yetenek: %{Mathf.RoundToInt(previewSkill * 100f)}" +
                           $"   Enerji: {Mathf.RoundToInt(Profile.Energy)}" +
                           $" (deneme başı -{Mathf.RoundToInt(Profile.GetAttemptEnergyCost())})";

            infoText.text = line1 + "\n" + line2;
        }

        // ─────────────────────────────────────────────────────────────
        // İÇ İŞLEYİŞ
        // ─────────────────────────────────────────────────────────────

        private void EnterIdle()
        {
            State = MiniGameState.Idle;
            SetActionInteractable(false);
            SetStartButton(true, "Başla");
            ShowResult("Hazır olduğunda BAŞLA'ya bas.", neutralColor);
            OnEnterIdle();
            RefreshInfo();
        }

        private void HandleActionInput()
        {
            if (State != MiniGameState.Playing) return;
            OnActionPressed();
        }

        private void SetActionInteractable(bool interactable)
        {
            if (actionButton != null) actionButton.Interactable = interactable;
        }

        private void SetStartButton(bool interactable, string label)
        {
            if (startButton != null) startButton.interactable = interactable;
            if (startButtonLabel != null && label != null) startButtonLabel.text = label;
        }

        private void ShowResult(string message, Color color)
        {
            if (resultText == null) return;
            resultText.text  = message;
            resultText.color = color;
        }
    }
}

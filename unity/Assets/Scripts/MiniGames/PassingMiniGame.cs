using FootballCareer.Core;
using FootballCareer.UI;
using TMPro;
using UnityEngine;
using UnityEngine.UI;

namespace FootballCareer.MiniGames
{
    /// <summary>
    /// PAS VERME (Orta Saha testi)
    ///
    /// Takım arkadaşlarından biri BOŞTA (yeşil), diğerleri MARKAJDA (kırmızı).
    /// Zaman barı dolmadan boştaki arkadaşa dokun → başarılı pas.
    /// Markajlı arkadaşa dokunursan veya süre dolarsa top kaptırılır.
    ///
    /// Pas stat'ı yükseldikçe süre uzar (oyunu daha iyi okuyorsun).
    /// </summary>
    public class PassingMiniGame : MiniGameBase
    {
        [Header("Pas — Sahne Referansları")]
        [Tooltip("Takım arkadaşı butonları (en az 2, önerilen 3–4). " +
                 "Üzerlerine TapInputButton otomatik eklenir.")]
        [SerializeField] private Button[] teammateButtons;
        [Tooltip("Image Type = Filled. Süre dolarken 0'dan 1'e dolar.")]
        [SerializeField] private Image timeBarFill;

        [Header("Pas — Görünüm")]
        [SerializeField] private Color openColor   = new Color(0.25f, 0.8f, 0.35f);
        [SerializeField] private Color markedColor = new Color(0.85f, 0.3f, 0.3f);
        [SerializeField] private Color idleColor   = new Color(0.45f, 0.5f, 0.58f);

        // Varsayılanlar: başlangıç orta sahası (Pas 25) ≈ 1.3 sn, stat 0 = 0.9 sn, stat 100 = 2.5 sn.
        [Header("Pas — Zorluk (stat 0 → stat 100)")]
        [SerializeField] private float timeLimitAtZero = 0.9f;
        [SerializeField] private float timeLimitAtMax  = 2.5f;

        private TapInputButton[] teammateTaps;
        private TMP_Text[]       teammateLabels;
        private int              correctIndex = -1;
        private float            timeLimit;

        public override string DisplayName => "Pas Verme";

        protected override StatWeighting DefaultWeighting =>
            new StatWeighting(StatType.Passing, StatType.Passing, 0f);

        protected override void Awake()
        {
            base.Awake();

            int count = teammateButtons != null ? teammateButtons.Length : 0;
            teammateTaps   = new TapInputButton[count];
            teammateLabels = new TMP_Text[count];

            for (int i = 0; i < count; i++)
            {
                Button button = teammateButtons[i];
                if (button == null) continue;

                // Zamanlamada gecikme olmasın diye basış anını yakalayan bileşen
                TapInputButton tap = button.GetComponent<TapInputButton>();
                if (tap == null) tap = button.gameObject.AddComponent<TapInputButton>();

                int index = i; // lambda için yerel kopya
                tap.Pressed += () => OnTeammatePressed(index);

                teammateTaps[i]   = tap;
                teammateLabels[i] = button.GetComponentInChildren<TMP_Text>(true);
            }
        }

        protected override bool IsSetupValid()
        {
            if (timeBarFill == null || teammateButtons == null || teammateButtons.Length < 2) return false;

            foreach (Button button in teammateButtons)
                if (button == null) return false;

            return true;
        }

        protected override void OnEnterIdle()
        {
            correctIndex = -1;
            if (timeBarFill != null) timeBarFill.fillAmount = 0f;

            for (int i = 0; i < TeammateCount; i++)
                SetTeammate(i, idleColor, "#" + (i + 2), false);
        }

        protected override void OnRoundAborted()
        {
            OnEnterIdle();
        }

        protected override void OnRoundStarted(float skill)
        {
            timeLimit    = StatCheck.Scale(skill, timeLimitAtZero, timeLimitAtMax);
            correctIndex = Random.Range(0, TeammateCount);
            timeBarFill.fillAmount = 0f;

            for (int i = 0; i < TeammateCount; i++)
            {
                bool isOpen = i == correctIndex;
                SetTeammate(i, isOpen ? openColor : markedColor, isOpen ? "BOŞTA" : "MARKAJ", true);
            }
        }

        protected override void OnRoundUpdate(float deltaTime)
        {
            float progress = RoundTime / timeLimit;
            timeBarFill.fillAmount = Mathf.Clamp01(progress);

            if (progress >= 1f)
                FinishRound(MiniGameResult.Fail("Geç kaldın, top kaptırıldı!", TrainedStat));
        }

        protected override void OnRoundFinished(MiniGameResult result)
        {
            // Renkler kalsın (doğru cevap görünsün) ama tıklanamasın
            for (int i = 0; i < TeammateCount; i++)
                if (teammateTaps[i] != null) teammateTaps[i].Interactable = false;
        }

        // ─────────────────────────────────────────────────────────────

        private int TeammateCount => teammateTaps != null ? teammateTaps.Length : 0;

        private void OnTeammatePressed(int index)
        {
            if (State != MiniGameState.Playing) return;

            if (index == correctIndex)
            {
                float accuracy = 1f - Mathf.Clamp01(RoundTime / timeLimit);
                string message = accuracy >= 0.6f ? "Jilet gibi pas!" : "Pas arkadaşına ulaştı.";
                FinishRound(MiniGameResult.Win(accuracy, message, TrainedStat));
            }
            else
            {
                FinishRound(MiniGameResult.Fail("Markajlı oyuncuya attın, araya girildi!", TrainedStat));
            }
        }

        private void SetTeammate(int index, Color color, string label, bool interactable)
        {
            if (teammateButtons[index] == null) return;

            if (teammateButtons[index].image != null) teammateButtons[index].image.color = color;
            if (teammateLabels[index] != null)        teammateLabels[index].text = label;
            if (teammateTaps[index] != null)          teammateTaps[index].Interactable = interactable;
        }
    }
}

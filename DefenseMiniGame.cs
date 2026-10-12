using FootballCareer.Core;
using UnityEngine;

namespace FootballCareer.MiniGames
{
    /// <summary>
    /// SAVUNMA / MÜDAHALE (Defans testi)
    ///
    /// Rakip şeridin üstünden sana doğru koşar. Rakip MÜDAHALE BÖLGESİ'nin
    /// içindeyken MÜDAHALE'ye bas → top kapıldı.
    /// Erken basarsan rakip çalımlar, geç kalırsan geçip gider.
    ///
    /// Defans (%70) ve Hız (%30) yükseldikçe:
    ///  - Müdahale bölgesi büyür
    ///  - Rakip sana göre yavaş görünür (pozisyon alma + yetişme)
    /// </summary>
    public class DefenseMiniGame : MiniGameBase
    {
        [Header("Savunma — Sahne Referansları")]
        [Tooltip("Rakibin yukarıdan aşağı koştuğu dikey şerit.")]
        [SerializeField] private RectTransform lane;
        [Tooltip("Yaklaşan rakip. lane'in ÇOCUĞU olmalı.")]
        [SerializeField] private RectTransform opponent;
        [Tooltip("Müdahale bölgesi. lane'in ÇOCUĞU olmalı. Yüksekliği stat'a göre ayarlanır.")]
        [SerializeField] private RectTransform tackleZone;

        // Zamanlama penceresi ≈ bölge yüksekliği ÷ rakip hızı.
        // Varsayılanlar: başlangıç defansı (~%21) ≈ 0.27 sn, stat 0 ≈ 0.18 sn, stat 100 ≈ 1 sn.
        [Header("Savunma — Zorluk (stat 0 → stat 100)")]
        [SerializeField] private float zoneHeightAtZero    = 100f;
        [SerializeField] private float zoneHeightAtMax     = 260f;
        [SerializeField] private float opponentSpeedAtZero = 550f;
        [SerializeField] private float opponentSpeedAtMax  = 250f;
        [Range(0f, 0.5f)]
        [SerializeField] private float speedVariation      = 0.15f;
        [Tooltip("Bölge merkezinin şeritteki yüksekliği (0 = en alt, 1 = en üst).")]
        [Range(0.05f, 0.6f)]
        [SerializeField] private float zoneCenterNormalized = 0.25f;
        [Tooltip("Rakip koşmaya başlamadan önceki rastgele bekleme (ezber ritmi bozar).")]
        [SerializeField] private Vector2 startDelayRange = new Vector2(0.2f, 0.8f);

        private float opponentSpeed;
        private float zoneTop;
        private float zoneBottom;
        private float startDelay;

        public override string DisplayName => "Savunma / Müdahale";

        protected override StatWeighting DefaultWeighting =>
            new StatWeighting(StatType.Defending, StatType.Speed, 0.3f);

        protected override bool IsSetupValid()
        {
            return lane != null && opponent != null && tackleZone != null;
        }

        protected override void OnEnterIdle()
        {
            if (opponent != null) opponent.gameObject.SetActive(false);
        }

        protected override void OnRoundStarted(float skill)
        {
            CenterAnchors(opponent);
            CenterAnchors(tackleZone);

            float laneHeight = lane.rect.height;
            float zoneHeight = StatCheck.Scale(skill, zoneHeightAtZero, zoneHeightAtMax);
            float zoneCenter = -laneHeight * 0.5f + laneHeight * zoneCenterNormalized;

            tackleZone.anchoredPosition = new Vector2(0f, zoneCenter);
            tackleZone.sizeDelta        = new Vector2(tackleZone.sizeDelta.x, zoneHeight);
            zoneTop    = zoneCenter + zoneHeight * 0.5f;
            zoneBottom = zoneCenter - zoneHeight * 0.5f;

            opponentSpeed = StatCheck.Scale(skill, opponentSpeedAtZero, opponentSpeedAtMax)
                            * Random.Range(1f - speedVariation, 1f + speedVariation);

            // Rakip şeridin en üstünden başlar
            opponent.anchoredPosition = new Vector2(0f, laneHeight * 0.5f - opponent.rect.height * 0.5f);
            opponent.gameObject.SetActive(true);

            startDelay = Random.Range(startDelayRange.x, startDelayRange.y);
        }

        protected override void OnRoundUpdate(float deltaTime)
        {
            if (RoundTime < startDelay) return;

            Vector2 position = opponent.anchoredPosition;
            position.y -= opponentSpeed * deltaTime;
            opponent.anchoredPosition = position;

            if (position.y < zoneBottom)
                FinishRound(MiniGameResult.Fail("Rakip seni geçti! Geç kaldın.", TrainedStat));
        }

        protected override void OnActionPressed()
        {
            float y = opponent.anchoredPosition.y;

            if (y > zoneTop)
            {
                FinishRound(MiniGameResult.Fail("Erken daldın, rakip çalımladı!", TrainedStat));
                return;
            }

            float zoneCenter = (zoneTop + zoneBottom) * 0.5f;
            float halfHeight = Mathf.Max(1f, (zoneTop - zoneBottom) * 0.5f);
            float accuracy   = 1f - Mathf.Abs(y - zoneCenter) / halfHeight;

            string message = accuracy >= 0.7f ? "Tertemiz kayarak müdahale!" : "Topu kaptın!";
            FinishRound(MiniGameResult.Win(accuracy, message, TrainedStat));
        }
    }
}

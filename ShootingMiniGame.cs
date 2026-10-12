using FootballCareer.Core;
using UnityEngine;

namespace FootballCareer.MiniGames
{
    /// <summary>
    /// ŞUT ÇEKME (Forvet testi)
    ///
    /// Kale içinde hedef rastgele dolaşır; ortada sabit bir nişangah (isabet alanı) vardır.
    /// Hedef nişangahın içindeyken ŞUT'a bas → GOL.
    ///
    /// Şut stat'ı yükseldikçe:
    ///  - İsabet alanı büyür (daha affedici)
    ///  - Hedef yavaşlar (daha fazla kontrol)
    /// </summary>
    public class ShootingMiniGame : MiniGameBase
    {
        [Header("Şut — Sahne Referansları")]
        [Tooltip("Hedefin içinde gezindiği alan (kale ağzı).")]
        [SerializeField] private RectTransform goalArea;
        [Tooltip("Rastgele hareket eden hedef. goalArea'nın ÇOCUĞU olmalı.")]
        [SerializeField] private RectTransform target;
        [Tooltip("Ortadaki nişangah. Boyutu isabet alanını gösterir. goalArea'nın ÇOCUĞU olmalı.")]
        [SerializeField] private RectTransform aimZone;

        // Hedef nişangahın ortasından geçerken pencere ≈ 2 × yarıçap ÷ hız.
        // Varsayılanlar: başlangıç forveti (Şut 25) ≈ 0.3 sn, stat 0 ≈ 0.17 sn, stat 100 ≈ 1.4 sn.
        [Header("Şut — Zorluk (stat 0 → stat 100)")]
        [SerializeField] private float hitRadiusAtZero   = 50f;
        [SerializeField] private float hitRadiusAtMax    = 150f;
        [SerializeField] private float targetSpeedAtZero = 600f;
        [SerializeField] private float targetSpeedAtMax  = 220f;
        [Range(0f, 0.5f)]
        [SerializeField] private float speedVariation    = 0.1f;
        [Tooltip("Bu sürede şut çekilmezse tur kaybedilir (saniye).")]
        [SerializeField] private float timeLimit         = 6f;

        private float   hitRadius;
        private float   targetSpeed;
        private Vector2 destination;

        public override string DisplayName => "Şut Çekme";

        protected override StatWeighting DefaultWeighting =>
            new StatWeighting(StatType.Shooting, StatType.Shooting, 0f);

        protected override bool IsSetupValid()
        {
            return goalArea != null && target != null && aimZone != null;
        }

        protected override void OnEnterIdle()
        {
            if (target != null) target.gameObject.SetActive(false);
        }

        protected override void OnRoundStarted(float skill)
        {
            CenterAnchors(target);
            CenterAnchors(aimZone);

            hitRadius   = StatCheck.Scale(skill, hitRadiusAtZero, hitRadiusAtMax);
            targetSpeed = StatCheck.Scale(skill, targetSpeedAtZero, targetSpeedAtMax)
                          * Random.Range(1f - speedVariation, 1f + speedVariation);

            // Nişangah ortada; boyutu isabet alanını oyuncuya gösterir
            aimZone.anchoredPosition = Vector2.zero;
            aimZone.sizeDelta        = Vector2.one * hitRadius * 2f;

            // Hedef nişangahın dışında başlasın ki "bedava gol" olmasın
            target.anchoredPosition = RandomPointOutsideAim();
            destination             = RandomPointInGoal();
            target.gameObject.SetActive(true);
        }

        protected override void OnRoundUpdate(float deltaTime)
        {
            target.anchoredPosition = Vector2.MoveTowards(
                target.anchoredPosition, destination, targetSpeed * deltaTime);

            if ((target.anchoredPosition - destination).sqrMagnitude < 1f)
                destination = RandomPointInGoal();

            if (RoundTime >= timeLimit)
                FinishRound(MiniGameResult.Fail("Süre doldu, şut çekemedin!", TrainedStat));
        }

        protected override void OnActionPressed()
        {
            float distance = Vector2.Distance(target.anchoredPosition, aimZone.anchoredPosition);

            if (distance <= hitRadius)
            {
                float accuracy = 1f - distance / hitRadius;
                string message = accuracy >= 0.75f ? "GOOOL! Doksana çaktın!" : "GOL! Top ağlarla buluştu.";
                FinishRound(MiniGameResult.Win(accuracy, message, TrainedStat));
            }
            else
            {
                string message = distance <= hitRadius * 1.5f ? "Direkten döndü!" : "Auta gitti...";
                FinishRound(MiniGameResult.Fail(message, TrainedStat));
            }
        }

        // ─────────────────────────────────────────────────────────────

        private Vector2 RandomPointInGoal()
        {
            Rect area    = goalArea.rect;
            Vector2 half = target.rect.size * 0.5f;

            float maxX = Mathf.Max(0f, area.width  * 0.5f - half.x);
            float maxY = Mathf.Max(0f, area.height * 0.5f - half.y);

            return new Vector2(Random.Range(-maxX, maxX), Random.Range(-maxY, maxY));
        }

        private Vector2 RandomPointOutsideAim()
        {
            // Birkaç deneme; kale çok küçükse son noktayı kabul et
            Vector2 point = RandomPointInGoal();
            for (int i = 0; i < 10 && point.magnitude <= hitRadius * 1.2f; i++)
                point = RandomPointInGoal();
            return point;
        }
    }
}

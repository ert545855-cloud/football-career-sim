using System.Collections.Generic;
using UnityEngine;

namespace FootballCareer.Passing
{
    /// <summary>Kalecinin bir şut karşısındaki şansı.</summary>
    public enum SaveChance
    {
        /// <summary>Rahat kurtarır.</summary>
        Easy,
        /// <summary>Ancak uzanarak; kalecinin yeteneğine bağlı.</summary>
        Stretch,
        /// <summary>Yetişemez.</summary>
        Unreachable,
    }

    /// <summary>
    /// KALECİ YAPAY ZEKÂSI.
    ///
    ///  • Konum alma: topa göre kale çizgisinde yana kayar ve top yaklaştıkça çizgiden çıkıp açıyı daraltır
    ///    (oyun zamanıyla → ağır çekimde o da yavaşlar).
    ///  • Şut: topun izleyeceği yolu bilir; kendi hizasından geçeceği noktayı ve varış süresini hesaplar.
    ///    Tepki süresinden (falsolu şutlarda daha uzun) sonra o noktaya doğru plonjon yapar.
    ///    Yetişebiliyorsa topu tutar; zor toplarda yeteneğine göre yetişir ya da parmak ucuyla kaçırır.
    ///  • Topu tutma: elleri (gövde + el yüksekliği) topa catchRadius kadar yaklaşırsa BallController "kurtarış" sayar.
    ///    Gövdedeki collider'a çarpan top da kurtarılmış sayılır.
    /// </summary>
    [DisallowMultipleComponent]
    public class GoalkeeperAI : MonoBehaviour
    {
        private enum State { Positioning, Diving, Holding }

        /// <summary>Sahnedeki etkin kaleciler (BallController her adımda ellerini kontrol eder).</summary>
        public static readonly List<GoalkeeperAI> All = new List<GoalkeeperAI>(2);

        [Tooltip("Korunan kale.")]
        [SerializeField] private GoalFrame goal;
        [Tooltip("Dalışta yana yatan gövde (collider'ı taşır). Boşsa ilk çocuk.")]
        [SerializeField] private Transform body;

        [Header("Konum alma (açı daraltma)")]
        [Tooltip("Top uzaktayken çizginin bu kadar önünde durur (metre).")]
        [SerializeField] private float lineOffset = 0.5f;
        [Tooltip("Top ceza sahasına girince en fazla bu kadar çıkar (metre).")]
        [SerializeField] private float maxStepOut = 2.5f;
        [Tooltip("Topun yanal konumunu ne oranda takip eder.")]
        [SerializeField, Range(0f, 1f)] private float lateralFollow = 0.35f;
        [SerializeField] private float positionSpeed = 4.5f;

        [Header("Refleks ve uzanma")]
        [Tooltip("0 = amatör, 1 = dünya yıldızı. Zor toplarda kurtarma olasılığını ve tepkiyi etkiler.")]
        [SerializeField, Range(0f, 1f)] private float skill = 0.6f;
        [Tooltip("Şuta tepki süresi (saniye).")]
        [SerializeField] private float reactionTime = 0.22f;
        [Tooltip("Falso (|curve| = 1) başına eklenen tepki süresi: kavisli top kaleciyi şaşırtır.")]
        [SerializeField] private float curveReactionPenalty = 0.15f;
        [Tooltip("Yerinden kıpırdamadan kollarıyla uzanabildiği mesafe.")]
        [SerializeField] private float standReach = 0.8f;
        [Tooltip("Plonjon hızı (m/sn).")]
        [SerializeField] private float diveSpeed = 5.5f;
        [Tooltip("Ellerinin ulaşabildiği en uzak mesafe (metre).")]
        [SerializeField] private float maxDiveReach = 3.4f;
        [SerializeField] private float handHeight = 1.25f;
        [SerializeField] private float maxHandHeight = 2.6f;
        [Tooltip("Ellerin topu tutabildiği yarıçap.")]
        [SerializeField] private float catchRadius = 0.45f;

        public GoalFrame Goal { get { return goal; } }
        /// <summary>Ellerin dünya konumu.</summary>
        public Vector3 HandsPosition { get { return transform.position + Vector3.up * handY; } }
        public bool IsDiving { get { return state == State.Diving; } }
        /// <summary>Son şut için verdiği karar (UI / hata ayıklama).</summary>
        public SaveChance LastDecision { get { return lastDecision; } }

        private State state = State.Positioning;
        private Transform ball;
        private float handY;
        private Vector3 bodyRestPos;
        private Quaternion bodyRestRot;
        private Vector3 homePosition;

        // Dalış
        private float diveClock;
        private float diveReaction;
        private Vector2 diveStart;     // ağız koordinatı (yanal, el yüksekliği)
        private Vector2 diveDir;
        private float diveTotal;
        private float diveDepth;
        private SaveChance lastDecision = SaveChance.Unreachable;

        private void Awake()
        {
            if (body == null && transform.childCount > 0) body = transform.GetChild(0);
            if (body != null)
            {
                bodyRestPos = body.localPosition;
                bodyRestRot = body.localRotation;
            }
            handY = handHeight;
            homePosition = transform.position;
        }

        private void OnEnable() { if (!All.Contains(this)) All.Add(this); }
        private void OnDisable() { All.Remove(this); }

        // ─────────────────────────── API ───────────────────────────

        /// <summary>Kodla kurulum için (bodyTransform null ise mevcut gövde korunur).</summary>
        public void Setup(GoalFrame protectedGoal, Transform bodyTransform, float keeperSkill)
        {
            goal = protectedGoal;
            if (bodyTransform != null) body = bodyTransform;
            skill = Mathf.Clamp01(keeperSkill);
            if (body != null)
            {
                bodyRestPos = body.localPosition;
                bodyRestRot = body.localRotation;
            }
            ResetToHome();
        }

        /// <summary>Kalecinin yeteneğini değiştirir (bölüm zorluğu için).</summary>
        public void SetSkill(float value) { skill = Mathf.Clamp01(value); }

        /// <summary>Konum alırken izlenecek top.</summary>
        public void Track(Transform ballTransform) { ball = ballTransform; }

        /// <summary>Kaleye yerleş, plonjonu bırak.</summary>
        public void ResetToHome()
        {
            state = State.Positioning;
            handY = handHeight;
            if (goal != null)
            {
                transform.position = goal.Center + goal.Normal * lineOffset;
                transform.rotation = Quaternion.LookRotation(goal.Normal);
            }
            else transform.position = homePosition;
            ResetBody();
        }

        /// <summary>
        /// Şut çekildi: topun yolunu ve hızını bilerek plonjon planla.
        /// </summary>
        public void OnShot(PassPath path, float speed)
        {
            if (goal == null || path == null || !path.IsValid || state == State.Holding) return;

            // Topun kalecinin hizasından (çizgiye olan uzaklığı) geçtiği nokta ve varış süresi
            float myDepth = Mathf.Max(0f, goal.SignedDistance(transform.position));
            const int samples = 64;
            float prevS = 0f;
            float prevD = goal.SignedDistance(path.EvaluateAtDistance(0f));
            float crossS = -1f;
            for (int i = 1; i <= samples; i++)
            {
                float s = path.Length * i / samples;
                float d = goal.SignedDistance(path.EvaluateAtDistance(s));
                if (d <= myDepth)
                {
                    float k = Mathf.Abs(prevD - d) > 1e-5f ? (prevD - myDepth) / (prevD - d) : 1f;
                    crossS = Mathf.Lerp(prevS, s, k);
                    break;
                }
                prevS = s;
                prevD = d;
            }
            if (crossS < 0f) return; // top kaleciye ulaşmıyor

            Vector3 p = path.EvaluateAtDistance(crossS);
            Vector2 target = goal.MouthCoords(p);
            Vector2 me = new Vector2(goal.MouthCoords(transform.position).x, handY);

            // Açıkça auta giden topa uzanmaz, izler
            if (Mathf.Abs(target.x) > goal.Width * 0.5f + 0.35f || target.y > goal.Height + 0.35f) return;

            float timeToBall = crossS / Mathf.Max(0.1f, speed);
            diveReaction = reactionTime + curveReactionPenalty * Mathf.Abs(path.Curve) + (1f - skill) * 0.08f;
            Vector2 delta = target - me;
            float needed = delta.magnitude;
            lastDecision = Decide(needed, timeToBall, diveReaction, standReach, diveSpeed, maxDiveReach);

            float coverage = Mathf.Min(maxDiveReach, standReach + diveSpeed * Mathf.Max(0f, timeToBall - diveReaction));
            float reach;
            switch (lastDecision)
            {
                case SaveChance.Easy:
                    reach = needed;
                    break;
                case SaveChance.Stretch:
                    // Zor top: yeteneğe göre ya yetişir ya parmak ucuyla kaçırır
                    reach = Random.value < Mathf.Lerp(0.25f, 0.9f, skill) ? needed : Mathf.Max(0f, needed - catchRadius - 0.35f);
                    break;
                default:
                    reach = Mathf.Min(needed, coverage) * 0.9f;
                    break;
            }

            diveStart = me;
            diveDir = needed > 1e-4f ? delta / needed : Vector2.zero;
            diveTotal = reach;
            diveDepth = myDepth;
            diveClock = 0f;
            state = State.Diving;
        }

        /// <summary>
        /// Saf karar fonksiyonu (test edilebilir): gereken uzanma, topun varış süresi ve kalecinin
        /// fiziksel sınırlarına göre kurtarış şansı.
        /// </summary>
        public static SaveChance Decide(float needed, float timeToBall, float reaction, float standReach, float diveSpeed, float maxReach)
        {
            if (needed > maxReach) return SaveChance.Unreachable;
            float t = timeToBall - reaction;
            if (t <= 0f) return needed <= standReach * 0.5f ? SaveChance.Stretch : SaveChance.Unreachable;
            float coverage = Mathf.Min(maxReach, standReach + diveSpeed * t);
            if (needed <= coverage * 0.7f) return SaveChance.Easy;
            if (needed <= coverage) return SaveChance.Stretch;
            return SaveChance.Unreachable;
        }

        /// <summary>Top ellerin yakınında mı? (BallController her fizik adımında sorar)</summary>
        public bool TryCatch(Vector3 ballPosition, float ballRadius)
        {
            if (state == State.Holding || !isActiveAndEnabled) return false;
            Vector3 h = HandsPosition;
            float r = catchRadius + ballRadius;
            if ((ballPosition - h).sqrMagnitude > r * r) return false;
            state = State.Holding;
            return true;
        }

        /// <summary>Top tutuldu (gövde çarpması dahil): pozu koru.</summary>
        public void OnCaught() { state = State.Holding; }

        // ─────────────────────────── Döngü ───────────────────────────

        private void Update()
        {
            if (goal == null) return;
            if (state == State.Positioning) UpdatePositioning(Time.deltaTime);
            else if (state == State.Diving) UpdateDive(Time.deltaTime);
        }

        private void UpdatePositioning(float dt)
        {
            float lateral = 0f, depth = lineOffset;
            Vector3 look = goal.Center + goal.Normal * 10f;
            if (ball != null)
            {
                Vector3 b = ball.position;
                float dist = goal.SignedDistance(b);
                lateral = Mathf.Clamp(goal.MouthCoords(b).x * lateralFollow, -(goal.Width * 0.5f - 1f), goal.Width * 0.5f - 1f);
                // Top yaklaştıkça çizgiden çık (açıyı daralt)
                depth = Mathf.Lerp(maxStepOut, lineOffset, Mathf.Clamp01((dist - 8f) / 25f));
                look = b;
            }
            Vector3 target = goal.Center + goal.Lateral * lateral + goal.Normal * depth;
            target.y = transform.position.y;
            transform.position = Vector3.MoveTowards(transform.position, target, positionSpeed * dt);

            Vector3 face = look - transform.position;
            face.y = 0f;
            if (face.sqrMagnitude > 0.01f)
            {
                transform.rotation = Quaternion.RotateTowards(transform.rotation, Quaternion.LookRotation(face), 360f * dt);
            }
            handY = Mathf.MoveTowards(handY, handHeight, 2f * dt);
            ResetBody();
        }

        private void UpdateDive(float dt)
        {
            diveClock += dt;
            float t = diveClock - diveReaction;
            if (t <= 0f) return; // henüz tepki vermedi

            // İlk 0.12 sn kollar uzanır (standReach), sonra gövdeyle plonjon
            float disp = Mathf.Min(diveTotal, standReach * Mathf.Clamp01(t / 0.12f) + diveSpeed * t);
            Vector2 hands = diveStart + diveDir * disp;
            handY = Mathf.Clamp(hands.y, 0.15f, maxHandHeight);

            Vector3 pos = goal.Center + goal.Lateral * hands.x + goal.Normal * diveDepth;
            pos.y = transform.position.y;
            transform.position = pos;

            if (body != null)
            {
                // Yana yatış: yanal plonjon ne kadar uzunsa o kadar yatar; alçak toplarda gövde de alçalır
                float lateralDisp = hands.x - diveStart.x;
                float roll = Mathf.Clamp(Mathf.Abs(lateralDisp) / 1.6f, 0f, 1f) * 80f;
                // Kaleci sahaya bakar: kendi sağı = −Lateral. Sağa dalışta gövde sağa yatar.
                float sign = Vector3.Dot(goal.Lateral * lateralDisp, transform.right) >= 0f ? -1f : 1f;
                body.localRotation = bodyRestRot * Quaternion.AngleAxis(sign * roll, Vector3.forward);
                Vector3 lp = bodyRestPos;
                lp.y = Mathf.Lerp(bodyRestPos.y, Mathf.Clamp(handY - 0.35f, 0.35f, 1.6f), Mathf.Clamp01(disp / 1f));
                body.localPosition = lp;
            }
        }

        private void ResetBody()
        {
            if (body == null) return;
            body.localPosition = bodyRestPos;
            body.localRotation = bodyRestRot;
        }

        private void OnDrawGizmosSelected()
        {
            Gizmos.color = new Color(0.2f, 1f, 0.9f, 0.7f);
            Gizmos.DrawWireSphere(HandsPosition, catchRadius);
            Gizmos.color = new Color(0.2f, 1f, 0.9f, 0.25f);
            Gizmos.DrawWireSphere(HandsPosition, maxDiveReach);
        }
    }
}

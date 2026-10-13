using System;
using UnityEngine;

namespace FootballCareer.Passing
{
    /// <summary>
    /// TOP — oyuncuda taşınır, pas/şut atılınca çizilen Bezier yolunu SABİT HIZLA takip eder.
    ///
    ///  • Uçuşta kinematik Rigidbody + MovePosition (fizik adımında), interpolasyon açık → akıcı görüntü.
    ///  • Her adımda bir önceki konumdan yenisine SphereCast atılır: hızlı top oyuncuların içinden geçip gitmez.
    ///  • "Ulaşma" kontrolü: takım arkadaşı receiveRadius, rakip interceptRadius içine girerse topa ulaşmış sayılır
    ///    (top reachHeight'tan yüksekteyse kimse ulaşamaz → havadan aşırtma mümkün).
    ///  • Kaleci: elleri (GoalkeeperAI.TryCatch) ya da gövdesi topa değerse kurtarış.
    ///  • Kale: top kale çizgisini geçtiği an GoalFrame sorulur → GOL / direk / aut.
    ///  • Falso: yolun dönüş yönüne göre dikey eksende (yan dönüş) + ilerleme yönüne dik eksende (yuvarlanma) döner.
    ///  • Yolun sonunda kimse almadıysa top yerde yuvarlanır, sürtünmeyle yavaşlar; yine kimse almazsa "boşa gitti".
    ///  • Sonuç bildirildikten sonra top görsel olarak süzülmeye devam eder (ağlara gider, direkten seker, auta çıkar).
    ///
    /// Bellek ayırmaz: çarpışma sorguları önceden ayrılmış dizilerle (NonAlloc) yapılır.
    /// </summary>
    [RequireComponent(typeof(Rigidbody))]
    [DisallowMultipleComponent]
    public class BallController : MonoBehaviour
    {
        private enum Phase { Free, Held, Path, Rolling, Coast }

        [Header("Top")]
        [Tooltip("Topun yarıçapı (FIFA 5 numara ≈ 0.11 m).")]
        [SerializeField] private float radius = 0.11f;
        [Tooltip("Dönüşü gösterilecek görsel (boşsa topun kendisi döner).")]
        [SerializeField] private Transform spinVisual;
        [Tooltip("Uçuşta açılan iz (isteğe bağlı).")]
        [SerializeField] private TrailRenderer trail;

        [Header("Ulaşma / çarpışma")]
        [Tooltip("Takım arkadaşının topa ulaşabildiği mesafe (ayak/göğüs).")]
        [SerializeField] private float receiveRadius = 1.0f;
        [Tooltip("Rakibin araya girip topa dokunabildiği mesafe.")]
        [SerializeField] private float interceptRadius = 0.7f;
        [Tooltip("Top bu yükseklikten (zeminden) yüksekteyken kimse ulaşamaz.")]
        [SerializeField] private float reachHeight = 2.1f;
        [Tooltip("Oyuncu katmanları (performans için yalnızca oyuncuları seçin).")]
        [SerializeField] private LayerMask playerMask = ~0;
        [Tooltip("Pası atan oyuncu, top bu kadar uzaklaşana kadar yok sayılır.")]
        [SerializeField] private float ignorePasserDistance = 1.6f;

        [Header("Falso / dönüş")]
        [Tooltip("|falso| = 1 (≈90° kıvrılan pas) iken yan dönüş hızı (derece/sn).")]
        [SerializeField] private float sideSpinDegPerSec = 1080f;

        [Header("Kimse almazsa")]
        [Tooltip("Yol bittikten sonra yerde yuvarlanırken yavaşlama (m/sn²).")]
        [SerializeField] private float rollFriction = 7f;
        [Tooltip("Yol sonundaki hız çarpanı (yere değince hız kaybı).")]
        [SerializeField, Range(0f, 1f)] private float landingSpeedFactor = 0.55f;
        [Tooltip("En fazla bu kadar yuvarlanır, sonra 'boşa gitti' sayılır.")]
        [SerializeField] private float looseBallTime = 1.6f;

        [Header("Sonuç sonrası süzülme (görsel)")]
        [SerializeField] private float coastTime = 1.4f;
        [SerializeField] private float gravity = 9.81f;

        /// <summary>Uçuş/yuvarlanma bitince: sonuç ve temas bilgisi.</summary>
        public event Action<BallContact> FlightFinished;

        public float Radius { get { return radius; } }
        public bool InFlight { get { return phase == Phase.Path || phase == Phase.Rolling; } }
        /// <summary>Topu ayağında tutan oyuncu (uçuşta null).</summary>
        public Transform Carrier { get { return carrier; } }
        /// <summary>Uçuş süresi (saniye).</summary>
        public float FlightTime { get { return flightTime; } }
        /// <summary>Anlık hız vektörü (kamera takibi ve yapay zekâ için).</summary>
        public Vector3 Velocity { get { return velocity; } }

        private Rigidbody rb;
        private Phase phase = Phase.Free;
        private Transform carrier;
        private Vector3 carryOffset;
        private PassPath path;
        private Transform passer;
        private bool isShot;
        private Bounds pitch;
        private bool hasPitch;
        private float distanceAlong;
        private float speed;
        private float flightTime;
        private float rollTime;
        private float coastClock;
        private GoalFrame coastGoal; // ağlara giden topu durdurmak için
        private float sideSpin;
        private float groundY;
        private Vector3 velocity;

        // NonAlloc tamponları (her adımda yeniden kullanılır)
        private readonly RaycastHit[] sweepHits = new RaycastHit[12];
        private readonly Collider[] reachHits = new Collider[24];

        private void Awake()
        {
            rb = GetComponent<Rigidbody>();
            rb.isKinematic = true;
            rb.useGravity = false;
            rb.interpolation = RigidbodyInterpolation.Interpolate;
            if (spinVisual == null) spinVisual = transform;
            if (trail != null) trail.emitting = false;
            groundY = radius;
        }

        // ─────────────────────────── Dış API ───────────────────────────

        /// <summary>Topu bir oyuncunun ayağına bağlar (localOffset: oyuncuya göre, ör. 0,0,0.45 = ayağının önü).</summary>
        public void AttachTo(Transform newCarrier, Vector3 localOffset)
        {
            carrier = newCarrier;
            carryOffset = localOffset;
            phase = newCarrier != null ? Phase.Held : Phase.Free;
            velocity = Vector3.zero;
            if (trail != null) trail.emitting = false;
            if (newCarrier != null) SnapToCarrier();
        }

        /// <summary>Kodla kurulum için (ör. demo sahnesi): uçuş izini ve dönüş görselini atar.</summary>
        public void SetVisuals(TrailRenderer trailRenderer, Transform spin)
        {
            trail = trailRenderer;
            spinVisual = spin != null ? spin : transform;
            if (trail != null) trail.emitting = false;
        }

        /// <summary>Uçuş izini temizler (top ışınlanınca, ör. tekrar başında, iz çizgisi oluşmasın).</summary>
        public void ClearTrail()
        {
            if (trail != null) trail.Clear();
        }

        /// <summary>Saha sınırları (XZ). Dışına çıkan top "dışarıda" sayılır.</summary>
        public void SetPitchBounds(Bounds bounds)
        {
            pitch = bounds;
            hasPitch = true;
        }

        /// <summary>
        /// Pası/şutu başlatır: top yol boyunca sabit hızla ilerler.
        /// </summary>
        /// <param name="passPath">Çizimden kurulmuş Bezier yolu (uçuş boyunca değiştirilmemeli).</param>
        /// <param name="passSpeed">Yol boyunca hız (m/sn).</param>
        /// <param name="from">Pası atan oyuncu (kendi topuna çarpmasın diye yok sayılır).</param>
        /// <param name="shot">Şut mu? Şutta takım arkadaşları topu "almaz" (yoldan geçen arkadaş şutu kesmesin).</param>
        public void Launch(PassPath passPath, float passSpeed, Transform from, bool shot = false)
        {
            path = passPath;
            speed = Mathf.Max(1f, passSpeed);
            passer = from;
            isShot = shot;
            carrier = null;
            distanceAlong = 0f;
            flightTime = 0f;
            rollTime = 0f;
            groundY = path.P0.y;
            // Falso: yolun toplam dönüşü kadar yan dönüş (sola kıvrılan pas sola döner)
            sideSpin = sideSpinDegPerSec * Mathf.Clamp(path.TurnDegrees / 90f, -1f, 1f);
            rb.position = path.EvaluateAtDistance(0f);
            transform.position = rb.position;
            phase = Phase.Path;
            if (trail != null)
            {
                trail.Clear();
                trail.emitting = true;
            }
        }

        // ─────────────────────────── Döngü ───────────────────────────

        private void LateUpdate()
        {
            if (phase == Phase.Held && carrier != null) SnapToCarrier();
        }

        private void FixedUpdate()
        {
            float dt = Time.fixedDeltaTime;
            switch (phase)
            {
                case Phase.Path: StepAlongPath(dt); break;
                case Phase.Rolling: StepRolling(dt); break;
                case Phase.Coast: StepCoast(dt); break;
            }
        }

        private void StepAlongPath(float dt)
        {
            flightTime += dt;
            Vector3 from = rb.position;
            distanceAlong = Mathf.Min(path.Length, distanceAlong + speed * dt);
            Vector3 to = path.EvaluateAtDistance(distanceAlong);
            velocity = (to - from) / Mathf.Max(dt, 1e-5f);
            rb.MovePosition(to);
            Spin(path.TangentAtDistance(distanceAlong), speed, dt);

            if (CheckContacts(from, to)) return;
            if (CheckGoals(from, to)) return;
            if (IsOut(to))
            {
                Finish(PassOutcome.OutOfBounds, to);
                return;
            }
            if (distanceAlong >= path.Length - 1e-3f)
            {
                // Yol bitti, kimse almadı: yere düşüp yuvarlanır
                Vector3 dir = path.TangentAtDistance(path.Length);
                dir.y = 0f;
                velocity = (dir.sqrMagnitude > 1e-6f ? dir.normalized : transform.forward) * speed * landingSpeedFactor;
                rollTime = 0f;
                phase = Phase.Rolling;
            }
        }

        private void StepRolling(float dt)
        {
            flightTime += dt;
            rollTime += dt;
            float v = velocity.magnitude;
            float newV = Mathf.Max(0f, v - rollFriction * dt);
            velocity = v > 1e-4f ? velocity * (newV / v) : Vector3.zero;
            Vector3 from = rb.position;
            Vector3 to = from + velocity * dt;
            to.y = groundY;
            rb.MovePosition(to);
            if (newV > 0.01f) Spin(velocity / newV, newV, dt);

            if (CheckContacts(from, to)) return;
            if (CheckGoals(from, to)) return;
            if (IsOut(to))
            {
                Finish(PassOutcome.OutOfBounds, to);
                return;
            }
            if (newV < 0.25f || rollTime >= looseBallTime) Finish(PassOutcome.Missed, to);
        }

        /// <summary>Sonuçtan sonra görsel süzülme: yerçekimi, sekme, ağlarda durma. Temas kontrolü yok.</summary>
        private void StepCoast(float dt)
        {
            coastClock += dt;
            Vector3 p = rb.position;
            velocity.y -= gravity * dt;
            p += velocity * dt;
            if (p.y < groundY)
            {
                p.y = groundY;
                velocity.y = -velocity.y * 0.35f;
                velocity.x *= 0.8f;
                velocity.z *= 0.8f;
            }
            // Ağlar: kalenin arkasına netDepth kadar girince top hızını kaybeder
            if (coastGoal != null && coastGoal.SignedDistance(p) < -coastGoal.NetDepth * 0.85f)
            {
                velocity *= 0.15f;
                coastGoal = null;
            }
            rb.MovePosition(p);
            float v = velocity.magnitude;
            if (v > 0.05f) Spin(velocity / v, v, dt);
            if (coastClock >= coastTime || (v < 0.05f && p.y <= groundY + 1e-3f))
            {
                phase = Phase.Free;
                velocity = Vector3.zero;
                if (trail != null) trail.emitting = false;
            }
        }

        // ─────────────────────────── Temas ───────────────────────────

        /// <summary>Adım boyunca çarpma (SphereCast) ve ulaşma (OverlapSphere + kaleci elleri) kontrolü. Sonuç bulunduysa true.</summary>
        private bool CheckContacts(Vector3 from, Vector3 to)
        {
            // 1) Fiziksel çarpışma: bir önceki konumdan yenisine süpürme (tünelleme olmaz)
            Vector3 delta = to - from;
            float dist = delta.magnitude;
            if (dist > 1e-4f)
            {
                int n = Physics.SphereCastNonAlloc(from, radius, delta / dist, sweepHits, dist, playerMask, QueryTriggerInteraction.Ignore);
                EnemyAI hitEnemy = null;
                PassReceiver hitMate = null;
                GoalkeeperAI hitKeeper = null;
                float bestEnemy = float.MaxValue, bestMate = float.MaxValue, bestKeeper = float.MaxValue;
                for (int i = 0; i < n; i++)
                {
                    Collider col = sweepHits[i].collider;
                    if (col == null || IsIgnored(col)) continue;
                    float d = sweepHits[i].distance;
                    GoalkeeperAI k = col.GetComponentInParent<GoalkeeperAI>();
                    if (k != null) { if (d < bestKeeper) { hitKeeper = k; bestKeeper = d; } continue; }
                    EnemyAI e = col.GetComponentInParent<EnemyAI>();
                    if (e != null) { if (d < bestEnemy) { hitEnemy = e; bestEnemy = d; } continue; }
                    if (isShot) continue; // şutta arkadaşlar topu almaz
                    PassReceiver r = col.GetComponentInParent<PassReceiver>();
                    if (r != null && r.transform != passer && d < bestMate) { hitMate = r; bestMate = d; }
                }
                // Önce hangisine çarptıysa o
                if (hitKeeper != null && bestKeeper <= bestEnemy && bestKeeper <= bestMate)
                {
                    hitKeeper.OnCaught();
                    return FinishSaved(hitKeeper, to);
                }
                if (hitEnemy != null && bestEnemy <= bestMate) { FinishIntercepted(hitEnemy, to); return true; }
                if (hitMate != null) { FinishCompleted(hitMate, to); return true; }
            }

            // 2) Kaleci elleri: plonjondaki kaleci havadaki topa da uzanır
            for (int i = 0; i < GoalkeeperAI.All.Count; i++)
            {
                GoalkeeperAI k = GoalkeeperAI.All[i];
                if (k != null && k.TryCatch(to, radius)) return FinishSaved(k, to);
            }

            // 3) Ulaşma: top yeterince alçaktaysa yakındaki oyuncu ayağını/göğsünü uzatır
            if (to.y - groundY > reachHeight) return false;
            float probe = Mathf.Max(receiveRadius, interceptRadius);
            int m = Physics.OverlapSphereNonAlloc(to, probe, reachHits, playerMask, QueryTriggerInteraction.Ignore);
            EnemyAI nearEnemy = null;
            PassReceiver nearMate = null;
            float de = float.MaxValue, dm = float.MaxValue;
            for (int i = 0; i < m; i++)
            {
                Collider col = reachHits[i];
                if (col == null || IsIgnored(col)) continue;
                EnemyAI e = col.GetComponentInParent<EnemyAI>();
                if (e != null)
                {
                    float d = HorizontalDistance(e.transform.position, to);
                    if (d <= interceptRadius && d < de) { nearEnemy = e; de = d; }
                    continue;
                }
                if (isShot) continue;
                PassReceiver r = col.GetComponentInParent<PassReceiver>();
                if (r != null && r.transform != passer)
                {
                    float d = HorizontalDistance(r.transform.position, to);
                    if (d <= receiveRadius && d < dm) { nearMate = r; dm = d; }
                }
            }
            if (nearEnemy != null && de <= dm) { FinishIntercepted(nearEnemy, to); return true; }
            if (nearMate != null) { FinishCompleted(nearMate, to); return true; }
            return false;
        }

        /// <summary>Top bu adımda bir kalenin çizgisini geçti mi? Geçtiyse gol / direk / aut.</summary>
        private bool CheckGoals(Vector3 from, Vector3 to)
        {
            for (int i = 0; i < GoalFrame.All.Count; i++)
            {
                GoalFrame g = GoalFrame.All[i];
                Vector3 cross;
                if (g == null || !g.TryCrossing(from, to, out cross)) continue;

                GoalCross kind = g.Classify(cross, radius);
                Vector3 v = velocity;
                PassOutcome outcome;
                if (kind == GoalCross.Inside)
                {
                    outcome = PassOutcome.Goal;
                    coastGoal = g; // ağlarda dursun
                }
                else if (kind == GoalCross.Frame)
                {
                    outcome = PassOutcome.HitFrame;
                    // Direkten sekme: çizgiye dik bileşeni ters çevir, enerji kaybı + hafif sapma
                    Vector3 n = g.Normal;
                    float vn = Vector3.Dot(v, n);
                    v = (v - 2f * vn * n) * 0.45f + g.Lateral * UnityEngine.Random.Range(-1.5f, 1.5f);
                    coastGoal = null;
                }
                else
                {
                    outcome = PassOutcome.Wide;
                    coastGoal = null;
                }
                StartCoast(cross, v);
                Emit(new BallContact { outcome = outcome, goal = g, point = cross });
                return true;
            }
            return false;
        }

        /// <summary>Topun kendisi ve (top henüz yakındayken) pası atan oyuncu yok sayılır.</summary>
        private bool IsIgnored(Collider col)
        {
            if (col.attachedRigidbody == rb || col.transform.IsChildOf(transform)) return true;
            if (passer != null && col.transform.IsChildOf(passer))
            {
                return distanceAlong < ignorePasserDistance || phase == Phase.Path;
            }
            return false;
        }

        private bool IsOut(Vector3 p)
        {
            if (!hasPitch) return false;
            return p.x < pitch.min.x || p.x > pitch.max.x || p.z < pitch.min.z || p.z > pitch.max.z;
        }

        // ─────────────────────────── Sonuç ───────────────────────────

        private void FinishCompleted(PassReceiver r, Vector3 at)
        {
            StopAt(at);
            Emit(new BallContact { outcome = PassOutcome.Completed, receiver = r, point = at });
        }

        private void FinishIntercepted(EnemyAI e, Vector3 at)
        {
            StopAt(at);
            Emit(new BallContact { outcome = PassOutcome.Intercepted, interceptor = e, point = at });
        }

        private bool FinishSaved(GoalkeeperAI k, Vector3 at)
        {
            StopAt(at);
            Emit(new BallContact { outcome = PassOutcome.Saved, keeper = k, point = at });
            return true;
        }

        private void Finish(PassOutcome outcome, Vector3 at)
        {
            // Aut / boşa giden top görsel olarak süzülmeye devam eder
            StartCoast(at, velocity);
            coastGoal = null;
            Emit(new BallContact { outcome = outcome, point = at });
        }

        private void StopAt(Vector3 at)
        {
            phase = Phase.Free;
            velocity = Vector3.zero;
            if (trail != null) trail.emitting = false;
        }

        private void StartCoast(Vector3 at, Vector3 v)
        {
            phase = Phase.Coast;
            coastClock = 0f;
            velocity = v;
        }

        /// <summary>
        /// Olayı yayınlar. Dinleyici (PasManager) topu birine bağlayabilir (AttachTo → Held);
        /// bu yüzden faz, olaydan ÖNCE ayarlanır.
        /// </summary>
        private void Emit(BallContact contact)
        {
            if (FlightFinished != null) FlightFinished(contact);
        }

        // ─────────────────────────── Görsel ───────────────────────────

        /// <summary>
        /// Yuvarlanma (ilerleme yönüne dik eksen, hız/yarıçap) + yan dönüş (falso, dikey eksen).
        /// </summary>
        private void Spin(Vector3 direction, float linearSpeed, float dt)
        {
            Vector3 flat = new Vector3(direction.x, 0f, direction.z);
            Quaternion rot = spinVisual.rotation;
            if (flat.sqrMagnitude > 1e-6f)
            {
                Vector3 rollAxis = Vector3.Cross(Vector3.up, flat.normalized);
                float rollDeg = linearSpeed / radius * Mathf.Rad2Deg * dt;
                rot = Quaternion.AngleAxis(rollDeg, rollAxis) * rot;
            }
            if (phase == Phase.Path && Mathf.Abs(sideSpin) > 0.01f)
            {
                rot = Quaternion.AngleAxis(sideSpin * dt, Vector3.up) * rot;
            }
            if (spinVisual == transform) rb.MoveRotation(rot);
            else spinVisual.rotation = rot;
        }

        private void SnapToCarrier()
        {
            Vector3 p = carrier.TransformPoint(carryOffset);
            p.y = groundY;
            rb.position = p;
            transform.position = p;
        }

        private static float HorizontalDistance(Vector3 a, Vector3 b)
        {
            float dx = a.x - b.x, dz = a.z - b.z;
            return Mathf.Sqrt(dx * dx + dz * dz);
        }

        private void OnDrawGizmosSelected()
        {
            Gizmos.color = new Color(0.3f, 1f, 0.4f, 0.6f);
            Gizmos.DrawWireSphere(transform.position, receiveRadius);
            Gizmos.color = new Color(1f, 0.3f, 0.3f, 0.6f);
            Gizmos.DrawWireSphere(transform.position, interceptRadius);
        }
    }
}

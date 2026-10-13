using UnityEngine;
using UnityEngine.AI;

namespace FootballCareer.Passing
{
    /// <summary>
    /// RAKİP YAPAY ZEKÂSI (NavMeshAgent).
    ///
    /// Modlar:
    ///  • Hold         — dizilişinde bekler.
    ///  • PressPasser  — pas çizimi başlayınca pasörün üstüne koşar. Yeterince yaklaşırsa PasManager topu "kaptırır".
    ///  • PressLanding — çizilen pasın tahmini iniş noktasına koşar (hedef her karede güncellenir).
    ///  • Intercept    — pas atıldı: topun yolunda, topa ondan ÖNCE varabileceği en erken noktaya koşar;
    ///                   yetişemiyorsa iniş noktasına, yol bittiyse topun kendisine.
    ///  • Return       — dizilişine geri yürür.
    ///
    /// Ağır çekim: NavMeshAgent oyun zamanıyla hareket eder → zaman 0.15'e inince rakipler de
    /// yavaşlar ama durmaz; oyuncu çizimde oyalanırsa yine de yetişirler. Yol yenileme ise GERÇEK
    /// zamanla yapılır, böylece ağır çekimde de hedef değişikliklerine anında tepki verirler.
    /// NavMesh yoksa (sahne bake edilmemişse) doğrudan düz çizgide yürüyerek çalışmaya devam eder.
    /// </summary>
    [RequireComponent(typeof(NavMeshAgent))]
    [DisallowMultipleComponent]
    public class EnemyAI : MonoBehaviour
    {
        public enum Mode { Hold, PressPasser, PressLanding, Intercept, Return }

        [Header("Hızlar (m/sn, oyun zamanı)")]
        [SerializeField] private float holdSpeed = 3.5f;
        [SerializeField] private float pressSpeed = 7.5f;
        [SerializeField] private float interceptSpeed = 8.5f;
        [SerializeField] private float acceleration = 40f;
        [SerializeField] private float angularSpeed = 900f;

        [Header("Yol yenileme (gerçek zaman)")]
        [Tooltip("En geç bu aralıkla hedef yeniden hesaplanır (saniye).")]
        [SerializeField] private float repathInterval = 0.12f;
        [Tooltip("Hedef bu kadar kaydıysa beklemeden yeniden yol hesaplanır (metre).")]
        [SerializeField] private float repathDistance = 0.25f;

        [Header("Araya girme")]
        [Tooltip("Pas atıldığında tepki gecikmesi (saniye).")]
        [SerializeField] private float reactionTime = 0.15f;
        [Tooltip("Topa ayakla/vücutla uzanma mesafesi (BallController.interceptRadius'a yakın tutun).")]
        [SerializeField] private float reach = 0.6f;
        [Tooltip("Top bu yükseklikten yüksekteyken araya girilemez (BallController.reachHeight ile aynı).")]
        [SerializeField] private float reachHeight = 2.1f;
        [Tooltip("Yol üzerinde denenecek nokta sayısı.")]
        [SerializeField, Range(8, 64)] private int interceptSamples = 24;

        [Header("Top")]
        [Tooltip("Top kapılınca bu rakibe göre konumu.")]
        [SerializeField] private Vector3 ballOffset = new Vector3(0f, 0f, 0.45f);

        [Header("Görsel (isteğe bağlı)")]
        [Tooltip("Baskıdayken rengi değişen renderer.")]
        [SerializeField] private Renderer indicator;
        [SerializeField] private Color calmColor = new Color(0.85f, 0.2f, 0.2f);
        [SerializeField] private Color alertColor = new Color(1f, 0.55f, 0.1f);

        public Mode CurrentMode { get { return mode; } }
        /// <summary>Pasöre ya da iniş noktasına baskı yapıyor mu?</summary>
        public bool IsPressing { get { return mode == Mode.PressPasser || mode == Mode.PressLanding; } }
        public Vector3 BallOffset { get { return ballOffset; } }
        public Vector3 HomePosition { get { return homePosition; } }
        /// <summary>Şu an koştuğu hedef nokta (hata ayıklama / UI için).</summary>
        public Vector3 CurrentTarget { get { return lastDestination; } }

        private static readonly int BaseColorId = Shader.PropertyToID("_BaseColor"); // URP
        private static readonly int ColorId = Shader.PropertyToID("_Color");         // Built-in

        private NavMeshAgent agent;
        private MaterialPropertyBlock block;
        private Mode mode = Mode.Hold;
        private Vector3 homePosition;
        private Quaternion homeRotation;

        // Baskı
        private PasManager manager;
        private Transform pressTarget;

        // Araya girme
        private PassPath path;
        private float ballSpeed;
        private float launchTime;
        private Transform ball;
        private Vector3 interceptPoint;

        // Yol bulma
        private Vector3 lastDestination;
        private float repathTimer;

        private void Awake()
        {
            agent = GetComponent<NavMeshAgent>();
            agent.acceleration = acceleration;
            agent.angularSpeed = angularSpeed;
            agent.speed = holdSpeed;
            homePosition = transform.position;
            homeRotation = transform.rotation;
            lastDestination = homePosition;
        }

        private void Start()
        {
            // Agent NavMesh'e oturmadıysa en yakın NavMesh noktasına yerleştir; yine olmazsa NavMesh'siz moda geç
            if (agent.enabled && !agent.isOnNavMesh)
            {
                NavMeshHit hit;
                if (NavMesh.SamplePosition(transform.position, out hit, 2f, NavMesh.AllAreas)) agent.Warp(hit.position);
                if (!agent.isOnNavMesh)
                {
                    Debug.LogWarning(name + ": NavMesh bulunamadı, düz çizgide hareket edilecek. (Sahneyi bake edin.)", this);
                    agent.enabled = false;
                }
            }
            ApplyIndicator();
        }

        // ─────────────────────────── PasManager API ───────────────────────────

        /// <summary>Çizim başladı: pasöre (targetLanding=false) ya da tahmini iniş noktasına (true) bas.</summary>
        public void StartPress(PasManager owner, Transform passer, bool targetLanding)
        {
            manager = owner;
            pressTarget = passer;
            SetMode(targetLanding ? Mode.PressLanding : Mode.PressPasser, pressSpeed);
        }

        /// <summary>Pas atıldı: topun yolunu ve hızını bilerek araya girme noktasına koş.</summary>
        /// <param name="passPath">Topun izlediği yol (uçuş boyunca değişmez).</param>
        /// <param name="speed">Topun yol boyunca hızı (m/sn).</param>
        /// <param name="ballTransform">Yol bitince (top yuvarlanırken) kovalanacak top.</param>
        public void StartIntercept(PassPath passPath, float speed, Transform ballTransform)
        {
            path = passPath;
            ballSpeed = Mathf.Max(0.1f, speed);
            ball = ballTransform;
            launchTime = Time.time;
            interceptPoint = ComputeInterceptPoint(true);
            SetMode(Mode.Intercept, interceptSpeed);
        }

        /// <summary>Olduğu yerde dur (sonuç gösterilirken).</summary>
        public void Stop()
        {
            SetMode(Mode.Hold, holdSpeed);
            if (UseAgent) agent.ResetPath();
        }

        /// <summary>Baskıyı bırak, dizilişine yürüyerek dön.</summary>
        public void Release()
        {
            SetMode(Mode.Return, holdSpeed);
        }

        /// <summary>Dizilişe dön. warp=true ise anında ışınlanır.</summary>
        public void ResetToHome(bool warp)
        {
            if (!warp)
            {
                Release();
                return;
            }
            SetMode(Mode.Hold, holdSpeed);
            if (UseAgent)
            {
                agent.ResetPath();
                agent.Warp(homePosition);
            }
            else transform.position = homePosition;
            transform.rotation = homeRotation;
            lastDestination = homePosition;
        }

        /// <summary>Diziliş konumunu şimdiki konum yapar.</summary>
        public void CaptureHome()
        {
            homePosition = transform.position;
            homeRotation = transform.rotation;
        }

        /// <summary>Bölüm zorluğu için hızlar (m/sn).</summary>
        public void SetSpeeds(float press, float intercept)
        {
            pressSpeed = Mathf.Max(0.5f, press);
            interceptSpeed = Mathf.Max(0.5f, intercept);
            if (agent != null && agent.enabled && mode != Mode.Hold && mode != Mode.Return) agent.speed = CurrentSpeed();
        }

        /// <summary>Kodla kurulum için: baskı göstergesi renderer'ı.</summary>
        public void SetIndicator(Renderer r)
        {
            indicator = r;
            ApplyIndicator();
        }

        /// <summary>Bir noktaya yatay (XZ) uzaklık.</summary>
        public float HorizontalDistanceTo(Vector3 point)
        {
            Vector3 p = transform.position;
            float dx = p.x - point.x, dz = p.z - point.z;
            return Mathf.Sqrt(dx * dx + dz * dz);
        }

        // ─────────────────────────── Döngü ───────────────────────────

        private bool UseAgent { get { return agent.enabled && agent.isOnNavMesh; } }

        private void Update()
        {
            if (mode == Mode.Hold) return;

            // Gerçek zamanla: ağır çekimde de hedef değişikliklerine hızlı tepki
            repathTimer -= Time.unscaledDeltaTime;
            bool timeUp = repathTimer <= 0f;
            if (timeUp && mode == Mode.Intercept) interceptPoint = ComputeInterceptPoint(false);

            Vector3 target = TargetPoint();
            if (timeUp || (target - lastDestination).sqrMagnitude > repathDistance * repathDistance)
            {
                MoveTo(target);
                repathTimer = repathInterval;
            }

            if (!UseAgent) StepWithoutNavMesh(target);

            if (mode == Mode.Return && HorizontalDistanceTo(homePosition) < 0.3f)
            {
                SetMode(Mode.Hold, holdSpeed);
                transform.rotation = homeRotation;
            }
        }

        private Vector3 TargetPoint()
        {
            switch (mode)
            {
                case Mode.PressPasser:
                    return pressTarget != null ? pressTarget.position : transform.position;
                case Mode.PressLanding:
                    return manager != null ? manager.PredictedLanding : transform.position;
                case Mode.Intercept:
                    return interceptPoint;
                case Mode.Return:
                    return homePosition;
                default:
                    return transform.position;
            }
        }

        /// <summary>
        /// Topun kalan yolunda, rakibin (tepki süresi + koşu) topa ondan önce ya da aynı anda varabileceği
        /// EN ERKEN noktayı bulur. Top çok yüksekte olan noktalar atlanır (aşırtma pas).
        /// Yetişemiyorsa iniş noktasına, yol bittiyse topun kendisine koşar.
        /// </summary>
        private Vector3 ComputeInterceptPoint(bool includeReaction)
        {
            if (path == null || !path.IsValid) return transform.position;
            float ballDist = ballSpeed * (Time.time - launchTime);
            if (ballDist >= path.Length) return ball != null ? Ground(ball.position) : Ground(path.P3);

            Vector3 me = transform.position;
            float delay = includeReaction ? reactionTime : 0f;
            float groundY = path.P0.y;
            int n = interceptSamples;
            for (int i = 1; i <= n; i++)
            {
                float s = Mathf.Lerp(ballDist, path.Length, (float)i / n);
                Vector3 p = path.EvaluateAtDistance(s);
                if (p.y - groundY > reachHeight) continue; // top kafa üstünden geçiyor
                float ballTime = (s - ballDist) / ballSpeed;
                float dx = p.x - me.x, dz = p.z - me.z;
                float run = Mathf.Max(0f, Mathf.Sqrt(dx * dx + dz * dz) - reach);
                if (delay + run / interceptSpeed <= ballTime) return Ground(p);
            }
            return Ground(path.P3);
        }

        private void MoveTo(Vector3 target)
        {
            lastDestination = target;
            if (UseAgent) agent.SetDestination(target);
        }

        /// <summary>NavMesh yoksa: düz çizgide, oyun zamanıyla yürü.</summary>
        private void StepWithoutNavMesh(Vector3 target)
        {
            Vector3 pos = transform.position;
            target.y = pos.y;
            float stop = mode == Mode.PressPasser ? 0.6f : 0.05f;
            Vector3 to = target - pos;
            float d = to.magnitude;
            if (d <= stop) return;
            float step = Mathf.Min(d - stop, CurrentSpeed() * Time.deltaTime);
            Vector3 dir = to / d;
            transform.position = pos + dir * step;
            transform.rotation = Quaternion.RotateTowards(transform.rotation, Quaternion.LookRotation(dir), angularSpeed * Time.deltaTime);
        }

        private float CurrentSpeed()
        {
            switch (mode)
            {
                case Mode.PressPasser:
                case Mode.PressLanding: return pressSpeed;
                case Mode.Intercept: return interceptSpeed;
                default: return holdSpeed;
            }
        }

        private void SetMode(Mode newMode, float speed)
        {
            mode = newMode;
            repathTimer = 0f; // bir sonraki karede hemen yol hesapla
            if (agent.enabled)
            {
                agent.speed = speed;
                // Baskıda/araya girerken fren yapmadan tam hızla koş; dönüşte yumuşak dur
                agent.autoBraking = newMode == Mode.Return || newMode == Mode.Hold;
                agent.stoppingDistance = newMode == Mode.PressPasser ? 0.6f : 0f;
            }
            ApplyIndicator();
        }

        private void ApplyIndicator()
        {
            if (indicator == null) return;
            if (block == null) block = new MaterialPropertyBlock();
            Color c = mode == Mode.Hold || mode == Mode.Return ? calmColor : alertColor;
            indicator.GetPropertyBlock(block);
            block.SetColor(BaseColorId, c);
            block.SetColor(ColorId, c);
            indicator.SetPropertyBlock(block);
        }

        private Vector3 Ground(Vector3 p)
        {
            p.y = transform.position.y;
            return p;
        }

        private void OnDrawGizmosSelected()
        {
            if (mode == Mode.Hold) return;
            Gizmos.color = alertColor;
            Gizmos.DrawLine(transform.position, lastDestination);
            Gizmos.DrawWireSphere(lastDestination, 0.3f);
        }
    }
}

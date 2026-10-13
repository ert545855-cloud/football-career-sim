using System;
using System.Collections.Generic;
using FootballCareer.Core;
using UnityEngine;
using UnityEngine.Events;

namespace FootballCareer.Passing
{
    /// <summary>
    /// PAS YÖNETİCİSİ — Score! Hero / New Star Soccer tarzı "çizerek pas" akışını yönetir.
    ///
    /// Akış (durum makinesi):
    ///   Idle ──(dokun / Space)──▶ Aiming ──(topa dokunup sürükle)──▶ Drawing ──(parmağı kaldır)──▶ InFlight ──▶ Resolving ──▶ Idle
    ///
    ///  1) AĞIR ÇEKİM + KAMERA: Pas moduna girince Time.timeScale yumuşakça 0.15'e iner, kamera oyuncunun
    ///     arkasına süzülür (PassCameraController.SetAim). Fizik adımı da ölçeklenir → ağır çekimde de akıcı.
    ///  2) ÇİZİM + KAVİS: Parmak/fare yerdeki düzleme ışınlanır, noktalar toplanır, her karede kübik Bezier
    ///     (PassPath) uydurulur ve LineRenderer ile canlı gösterilir. Çizgi rengi: yeşil = temiz hedef,
    ///     turuncu = rakip yolda, beyaz = hedefte arkadaş yok, sarı = kaleye şut.
    ///  3) BASKI: Çizim başladığı an en yakın 2 rakip (EnemyAI) koşmaya başlar: biri pasöre, biri tahmini iniş
    ///     noktasına. Ağır çekim yüzünden yavaşlar ama durmazlar; oyuncu oyalanırsa top kapılır (Stolen).
    ///  4) SONUÇ: Parmak kalkınca zaman ANINDA 1.0'a döner ve top çizilen yolda fırlar (BallController).
    ///     Arkadaşa ulaşırsa başarılı (alan oyuncu yeni pasör olur); rakibe çarparsa/kesilirse ya da
    ///     dışarı çıkarsa başarısız.
    ///  5) ŞUT: Çizgi kale ağzına (GoalFrame'in dikey düzlemine) değerse pas değil ŞUT olur: hedef yüksekliği
    ///     çizimden alınır (üst köşe, yerden…), top daha sert gider, kaleci (GoalkeeperAI) plonjon yapar.
    ///     Sonuç: GOL, kurtarış, direk ya da aut.
    /// </summary>
    [DefaultExecutionOrder(-20)] // girdi + zaman ölçeği, diğer oyun nesnelerinden önce
    [DisallowMultipleComponent]
    public class PasManager : MonoBehaviour
    {
        [Header("Referanslar")]
        [SerializeField] private BallController ball;
        [Tooltip("Top ayağındaki oyuncu (üzerinde PassReceiver olması önerilir).")]
        [SerializeField] private Transform passer;
        [Tooltip("Boşsa Camera.main.")]
        [SerializeField] private Camera cam;
        [SerializeField] private PassCameraController cameraRig;
        [Tooltip("Pas önizleme çizgisi (World Space, malzemesi atanmış).")]
        [SerializeField] private LineRenderer line;
        [SerializeField] private List<PassReceiver> teammates = new List<PassReceiver>();
        [SerializeField] private List<EnemyAI> enemies = new List<EnemyAI>();
        [Tooltip("Şut çekilen kale (boşsa sahnedeki 'hücum hedefi' kale).")]
        [SerializeField] private GoalFrame targetGoal;
        [Tooltip("Rakip kaleci (boşsa hedef kaleyi koruyan kaleci bulunur).")]
        [SerializeField] private GoalkeeperAI keeper;
        [Tooltip("Listeler boşsa sahnedeki tüm PassReceiver / EnemyAI / GoalFrame / GoalkeeperAI bileşenlerini bulur.")]
        [SerializeField] private bool autoFindPlayers = true;

        [Header("Ağır çekim")]
        [SerializeField, Range(0.05f, 1f)] private float slowTimeScale = 0.15f;
        [Tooltip("Ağır çekime giriş hızı (büyük = daha ani).")]
        [SerializeField] private float timeBlendSpeed = 12f;

        [Header("Çizim")]
        [Tooltip("Çizimdeki noktalar arası en az mesafe (metre).")]
        [SerializeField] private float minPointSpacing = 0.4f;
        [Tooltip("Bundan kısa çizimler pas sayılmaz, tekrar çizilir (metre).")]
        [SerializeField] private float minPassDistance = 3f;
        [Tooltip("Hedef top en fazla bu kadar uzağa (metre).")]
        [SerializeField] private float maxPassDistance = 45f;
        [Tooltip("Çizim topun ekrandaki konumuna bu kadar yakın başlamalı (ekran yüksekliğinin oranı, 0 = her yerden).")]
        [SerializeField, Range(0f, 0.5f)] private float startTouchRadius = 0.22f;
        [SerializeField] private int maxDrawPoints = 128;
        [Tooltip("Kamera yerine oturmasa bile bu kadar gerçek saniye sonra çizime izin ver.")]
        [SerializeField] private float cameraSettleTimeout = 0.45f;

        [Header("Yol ve hız")]
        [Tooltip("Metre başına yay yüksekliği (uzun paslar havadan gider).")]
        [SerializeField] private float loftPerMeter = 0.05f;
        [SerializeField] private float maxLoft = 2.2f;
        [SerializeField] private float minPassSpeed = 12f;
        [Tooltip("Yolun her metresi için eklenen hız (uzun pas = sert pas).")]
        [SerializeField] private float speedPerMeter = 0.45f;
        [SerializeField] private float maxPassSpeed = 26f;

        [Header("Şut")]
        [SerializeField] private float minShotSpeed = 18f;
        [Tooltip("Şut mesafesinin her metresi için eklenen hız.")]
        [SerializeField] private float shotSpeedPerMeter = 0.5f;
        [SerializeField] private float maxShotSpeed = 32f;
        [Tooltip("Şutta metre başına yay (paslardan çok daha düz).")]
        [SerializeField] private float shotLoftPerMeter = 0.012f;
        [Tooltip("Kale çerçevesinin bu kadar dışına çizilen nişan da şut sayılır (auta vurabilmek için).")]
        [SerializeField] private float goalAimMargin = 2.5f;
        [Tooltip("Şut hedefi kale çizgisinin bu kadar arkasına uzatılır (top çizgiyi yolun sonundan ÖNCE geçsin).")]
        [SerializeField] private float shotOvershoot = 0.3f;
        [Tooltip("Gol ya da şut sonrası diziliş yeniden kurulur.")]
        [SerializeField] private bool resetAfterShot = true;

        [Header("Önizleme")]
        [SerializeField, Range(8, 96)] private int previewSamples = 40;
        [Tooltip("İniş noktasına bu kadar yakın arkadaş hedef sayılır (metre).")]
        [SerializeField] private float targetRadius = 2.2f;
        [Tooltip("Yola bu kadar yakın rakip varsa çizgi turuncu olur (metre).")]
        [SerializeField] private float contestRadius = 1.4f;
        [SerializeField] private Color clearColor = new Color(0.35f, 1f, 0.45f, 1f);
        [SerializeField] private Color contestedColor = new Color(1f, 0.62f, 0.15f, 1f);
        [SerializeField] private Color noTargetColor = new Color(1f, 1f, 1f, 0.85f);
        [SerializeField] private Color shotColor = new Color(1f, 0.85f, 0.2f, 1f);

        [Header("Baskı")]
        [Tooltip("Çizim başlayınca baskıya koşan rakip sayısı.")]
        [SerializeField] private int pressersCount = 2;
        [Tooltip("Rakip pasöre bu kadar yaklaşırsa topu kapar (metre).")]
        [SerializeField] private float stealRadius = 1.1f;
        [Tooltip("Pas modunda çizime başlamadan bu kadar gerçek saniye beklenirse baskı yine başlar (0 = kapalı).")]
        [SerializeField] private float pressureAfterIdleAim = 3f;

        [Header("Saha ve sonuç")]
        [SerializeField] private Bounds pitchBounds = new Bounds(Vector3.zero, new Vector3(68f, 10f, 105f));
        [Tooltip("Sonuç bu kadar gerçek saniye gösterilir.")]
        [SerializeField] private float resultHoldTime = 1f;
        [Tooltip("Başarısız pastan sonra diziliş baştan kurulur.")]
        [SerializeField] private bool autoResetOnFail = true;
        [Tooltip("Idle'da ekrana dokunmak pas moduna sokar (kapalıysa yalnızca Space / EnterPassMode()).")]
        [SerializeField] private bool enterOnTap = true;

        [Header("Olaylar")]
        public UnityEvent onPassModeEntered = new UnityEvent();
        public UnityEvent onDrawStarted = new UnityEvent();
        public PassResultEvent onPassFinished = new PassResultEvent();

        /// <summary>Pas sonuçlandı (kodla abone olmak için).</summary>
        public event Action<PassResult> PassFinished;
        /// <summary>Durum değişti.</summary>
        public event Action<PassState> StateChanged;

        // ─────────────────────────── Dışa açık durum ───────────────────────────

        public PassState State { get { return state; } }
        public Transform Passer { get { return passer; } }
        public BallController Ball { get { return ball; } }
        /// <summary>Çizilen pasın tahmini iniş noktası (rakip baskısı buraya koşar).</summary>
        public Vector3 PredictedLanding { get { return predictedLanding; } }
        /// <summary>Çizimin hedeflediği arkadaş (yoksa null).</summary>
        public PassReceiver TargetReceiver { get { return target; } }
        /// <summary>Şu anki (ya da son atılan) pas yolu.</summary>
        public PassPath CurrentPath { get { return path; } }
        /// <summary>0 = rakip uzakta, 1 = top kapılmak üzere (UI baskı çubuğu için).</summary>
        public float Pressure { get { return pressure; } }
        public bool IsSlowMotion { get { return Time.timeScale < 0.999f; } }
        public PassResult LastResult { get { return lastResult; } }
        /// <summary>Çizilen çizgi kaleye mi (şut)?</summary>
        public bool IsShotAimed { get { return shotAimed; } }
        public GoalFrame TargetGoal { get { return targetGoal; } }
        public GoalkeeperAI Keeper { get { return keeper; } }
        /// <summary>Pas moduna girilebilir mi? (top pasörün ayağında ve sistem boşta)</summary>
        public bool CanEnterPassMode { get { return state == PassState.Idle && HasBall; } }

        // ─────────────────────────── İç durum ───────────────────────────

        private PassState state = PassState.Idle;
        private readonly PassPath path = new PassPath();
        private readonly List<Vector3> drawn = new List<Vector3>(128);
        private readonly List<EnemyAI> sortBuffer = new List<EnemyAI>(16);
        private Comparison<EnemyAI> byDistanceToPasser;
        private Vector3[] previewBuffer;

        private Plane groundPlane;
        private float spacing;
        private float stateClock;           // durumdaki gerçek süre
        private Vector3 aimDir;
        private Vector3 predictedLanding;
        private PassReceiver target;
        private bool contested;
        private bool tailOnGoal;            // çizginin canlı ucu kale ağzında mı
        private bool shotAimed;             // kurulan yol bir şut mu
        private bool launchedShot;
        private bool pressureActive;
        private float pressureStartDistance;
        private float pressure;
        private float launchSpeed;
        private Transform launchPasser;
        private PassResult lastResult;

        // Zaman ölçeği
        private float baseFixedDelta = 0.02f;
        private float targetTimeScale = 1f;
        private bool timeBlending;
        private bool ownsTimeScale;

        // Sıfırlama için başlangıç dizilişi
        private Transform startPasser;
        private Vector3 startPasserPos;
        private Quaternion startPasserRot;

        private BallController boundBall;
        private bool initialized;

        // ─────────────────────────── Kurulum ───────────────────────────

        private void Awake()
        {
            baseFixedDelta = Time.fixedDeltaTime;
            byDistanceToPasser = CompareByDistanceToPasser;
        }

        private void OnEnable()
        {
            BindBall();
        }

        private void Start()
        {
            Initialize();
        }

        private void OnDisable()
        {
            if (boundBall != null) boundBall.FlightFinished -= OnFlightFinished;
            boundBall = null;
            RestoreTime();
        }

        /// <summary>
        /// Kodla kurulum (Inspector yerine). AddComponent'ten hemen sonra, Start'tan önce çağırın.
        /// </summary>
        public void Setup(BallController ballController, Transform startingPasser, Camera camera,
                          PassCameraController rig, LineRenderer previewLine, Bounds pitch)
        {
            ball = ballController;
            passer = startingPasser;
            cam = camera;
            cameraRig = rig;
            line = previewLine;
            pitchBounds = pitch;
            BindBall();
            if (initialized) Initialize();
        }

        /// <summary>Kodla kurulum: şut çekilecek kale ve onu koruyan kaleci.</summary>
        public void SetGoal(GoalFrame goal, GoalkeeperAI goalkeeper)
        {
            targetGoal = goal;
            keeper = goalkeeper;
            if (keeper != null && ball != null) keeper.Track(ball.transform);
        }

        /// <summary>
        /// Yeni diziliş yükler (bölüm başlangıcı): listeleri değiştirir, ilk pasörü ayarlar ve her şeyi sıfırlar.
        /// teammates listesi pasörü de içermeli.
        /// </summary>
        public void LoadFormation(Transform startingPasser, IList<PassReceiver> mates, IList<EnemyAI> foes, GoalkeeperAI goalkeeper)
        {
            teammates.Clear();
            for (int i = 0; i < mates.Count; i++) AddTeammate(mates[i]);
            enemies.Clear();
            for (int i = 0; i < foes.Count; i++) AddEnemy(foes[i]);
            keeper = goalkeeper;
            passer = startingPasser;
            startPasser = startingPasser;
            if (startingPasser != null)
            {
                startPasserPos = startingPasser.position;
                startPasserRot = startingPasser.rotation;
            }
            if (keeper != null && ball != null) keeper.Track(ball.transform);
            if (initialized) ResetPlay();
            else if (ball != null && passer != null) ball.AttachTo(passer, OffsetFor(passer));
        }

        /// <summary>Ağır çekim oranı (bölüm zorluğu / oyuncu statı).</summary>
        public void SetSlowTimeScale(float scale) { slowTimeScale = Mathf.Clamp(scale, 0.05f, 1f); }

        /// <summary>Çizim başlayınca baskıya koşan rakip sayısı (0 = kimse basmaz).</summary>
        public void SetPressersCount(int count) { pressersCount = Mathf.Max(0, count); }

        public void AddTeammate(PassReceiver r) { if (r != null && !teammates.Contains(r)) teammates.Add(r); }
        public void AddEnemy(EnemyAI e) { if (e != null && !enemies.Contains(e)) enemies.Add(e); }

        private void Initialize()
        {
            initialized = true;
            if (cam == null) cam = Camera.main;
            if (autoFindPlayers)
            {
                if (teammates.Count == 0) teammates.AddRange(FindAll<PassReceiver>());
                if (enemies.Count == 0) enemies.AddRange(FindAll<EnemyAI>());
                if (targetGoal == null)
                {
                    GoalFrame[] goals = FindAll<GoalFrame>();
                    for (int i = 0; i < goals.Length && targetGoal == null; i++) if (goals[i].IsAttackTarget) targetGoal = goals[i];
                }
                if (keeper == null && targetGoal != null)
                {
                    GoalkeeperAI[] keepers = FindAll<GoalkeeperAI>();
                    for (int i = 0; i < keepers.Length && keeper == null; i++) if (keepers[i].Goal == targetGoal) keeper = keepers[i];
                }
            }
            teammates.RemoveAll(IsNull);
            enemies.RemoveAll(IsNull);

            if (previewBuffer == null || previewBuffer.Length != previewSamples) previewBuffer = new Vector3[previewSamples];
            HideLine();

            if (ball != null)
            {
                ball.SetPitchBounds(pitchBounds);
                if (passer != null && ball.Carrier == null) ball.AttachTo(passer, OffsetFor(passer));
                if (keeper != null) keeper.Track(ball.transform);
            }
            startPasser = passer;
            if (passer != null)
            {
                startPasserPos = passer.position;
                startPasserRot = passer.rotation;
            }
            if (cameraRig != null && ball != null)
            {
                cameraRig.SetDefault(ball.transform);
                cameraRig.Snap();
            }
        }

        private void BindBall()
        {
            if (boundBall == ball) return;
            if (boundBall != null) boundBall.FlightFinished -= OnFlightFinished;
            boundBall = ball;
            if (boundBall != null && isActiveAndEnabled) boundBall.FlightFinished += OnFlightFinished;
            else boundBall = null;
        }

        // ─────────────────────────── Ana döngü ───────────────────────────

        private void Update()
        {
            UpdateTimeScale();
            switch (state)
            {
                case PassState.Idle: UpdateIdle(); break;
                case PassState.Aiming: UpdateAiming(); break;
                case PassState.Drawing: UpdateDrawing(); break;
                case PassState.InFlight: break; // BallController sonucu olayla bildirir
                case PassState.Resolving: UpdateResolving(); break;
            }
        }

        private void UpdateIdle()
        {
            if (!HasBall) return;
            Vector2 pos;
            if (InputCompat.ActionKeyDown() || (enterOnTap && InputCompat.PointerDown(out pos) && !InputCompat.IsPointerOverUI()))
            {
                EnterPassMode();
            }
        }

        /// <summary>
        /// PAS MODU: zamanı yavaşlat, kamerayı oyuncunun arkasına al. UI düğmesinden de çağrılabilir.
        /// </summary>
        public bool EnterPassMode()
        {
            if (!CanEnterPassMode) return false;
            if (cam == null) cam = Camera.main;
            if (cam == null)
            {
                Debug.LogError("PasManager: kamera yok (cam alanını atayın ya da sahnede MainCamera etiketli kamera olsun).", this);
                return false;
            }
            SetState(PassState.Aiming);
            pressureActive = false;
            pressure = 0f;
            BlendTimeTo(slowTimeScale);
            aimDir = ComputeAimDirection();
            // Henüz çizim yok: iniş tahmini = pas koridoru (çizimden önce baskı başlarsa rakip buraya koşar)
            predictedLanding = passer.position + aimDir * 12f;
            if (cameraRig != null) cameraRig.SetAim(passer, aimDir);
            onPassModeEntered.Invoke();
            return true;
        }

        /// <summary>Pas modundan çık (yalnızca baskı başlamadıysa; aksi halde kaçış olmaz).</summary>
        public bool CancelPassMode()
        {
            if (state != PassState.Aiming || pressureActive) return false;
            BlendTimeTo(1f);
            if (cameraRig != null && ball != null) cameraRig.SetDefault(ball.transform);
            SetState(PassState.Idle);
            return true;
        }

        private void UpdateAiming()
        {
            stateClock += Time.unscaledDeltaTime;

            // Çizime başlamadan oyalanmak da cezasız değil
            if (!pressureActive && pressureAfterIdleAim > 0f && stateClock >= pressureAfterIdleAim) StartPressure();
            if (pressureActive && CheckSteal()) return;

            if (InputCompat.BackKeyDown() && CancelPassMode()) return;

            Vector2 pos;
            if (InputCompat.PointerDown(out pos) && !InputCompat.IsPointerOverUI() && CameraReady() && TouchNearBall(pos))
            {
                BeginDraw(pos);
            }
        }

        // ─────────────────────────── Çizim ───────────────────────────

        private void BeginDraw(Vector2 screenPos)
        {
            Vector3 b = ball.transform.position;
            groundPlane = new Plane(Vector3.up, new Vector3(0f, b.y - ball.Radius, 0f));
            spacing = minPointSpacing;
            drawn.Clear();
            drawn.Add(b);
            AddScreenPoint(screenPos);

            SetState(PassState.Drawing);
            if (!pressureActive) StartPressure();
            onDrawStarted.Invoke();
        }

        private void UpdateDrawing()
        {
            stateClock += Time.unscaledDeltaTime;

            Vector2 pos;
            bool released = InputCompat.PointerUp(out pos);
            bool held = !released && InputCompat.PointerHeld(out pos);
            if (released || held) AddScreenPoint(pos);

            // Top oyuncunun ayağında (oyuncu dönerken) hareket eder → yolun başını topa sabitle
            drawn[0] = ball.transform.position;
            RebuildPreview();
            TurnPasserAlongPath();

            if (CheckSteal()) return;
            if (!held) Release(); // parmak kalktı (ya da dokunma iptal oldu)
        }

        /// <summary>
        /// Ekran noktasını sahaya ışınlar ve çizime ekler.
        ///  • Işın, yere değmeden önce kale ağzının dikey düzlemine çarpıyorsa uç KALEDEDİR (şut; yükseklik dahil).
        ///  • Değilse yerdeki düzleme düşer (pas).
        /// Son eleman "canlı uç"tur: parmağı her karede izler; önceki noktadan yeterince uzaklaşınca kalıcı olur.
        /// </summary>
        private void AddScreenPoint(Vector2 screenPos)
        {
            Ray ray = cam.ScreenPointToRay(screenPos);
            float enter;
            bool groundHit = groundPlane.Raycast(ray, out enter) && enter <= cam.farClipPlane;

            Vector3 goalPoint;
            float goalEnter;
            if (targetGoal != null && targetGoal.RaycastMouth(ray, goalAimMargin, out goalPoint, out goalEnter)
                && (!groundHit || goalEnter < enter)
                && HorizontalDistance(drawn[0], goalPoint) <= maxPassDistance)
            {
                // Hedef ağlara doğru biraz uzatılır: top çizgiyi yolun bitiminden ÖNCE, nişan yüksekliğinde geçsin
                SetTail(goalPoint - targetGoal.Normal * shotOvershoot, true);
                return;
            }
            if (!groundHit) return; // ufkun üstü

            Vector3 p = ray.GetPoint(enter);
            p.y = drawn[0].y;

            // Topa olan uzaklığı sınırla
            Vector3 fromBall = p - drawn[0];
            fromBall.y = 0f;
            if (fromBall.sqrMagnitude > maxPassDistance * maxPassDistance) p = drawn[0] + fromBall.normalized * maxPassDistance;
            SetTail(p, false);
        }

        private void SetTail(Vector3 p, bool onGoal)
        {
            tailOnGoal = onGoal;
            if (drawn.Count == 1)
            {
                drawn.Add(p);
                return;
            }
            int last = drawn.Count - 1;
            drawn[last] = p; // canlı ucu taşı
            // Kale ağzındaki uç kalıcı yapılmaz: parmak kaleden çıkarsa çizgi yere geri döner
            if (!onGoal && HorizontalDistance(drawn[last - 1], p) >= spacing)
            {
                drawn.Add(p); // ucu kalıcı yap, yeni canlı uç aç
                if (drawn.Count >= maxDrawPoints) Decimate();
            }
        }

        /// <summary>Nokta sınırı aşılınca her iki noktadan birini at (yol yalnızca 4 noktayı kullanır, şekil korunur).</summary>
        private void Decimate()
        {
            int write = 1;
            for (int read = 2; read < drawn.Count - 1; read += 2) drawn[write++] = drawn[read];
            drawn[write++] = drawn[drawn.Count - 1];
            drawn.RemoveRange(write, drawn.Count - write);
            spacing *= 2f;
        }

        /// <summary>Bezier yolunu kur, hedefi/tehlikeyi değerlendir, LineRenderer'ı güncelle.</summary>
        private void RebuildPreview()
        {
            if (drawn.Count < 2)
            {
                HideLine();
                return;
            }
            float ballY = drawn[0].y;
            shotAimed = tailOnGoal && targetGoal != null;
            if (shotAimed) path.Build(drawn, ballY, shotLoftPerMeter, maxLoft, drawn[drawn.Count - 1].y - ballY);
            else path.Build(drawn, ballY, loftPerMeter, maxLoft);
            predictedLanding = path.P3;

            SetTarget(shotAimed ? null : FindReceiverNear(predictedLanding, targetRadius));
            contested = IsContested();

            if (line == null) return;
            Color c = shotAimed ? (contested ? contestedColor : shotColor)
                                : target == null ? noTargetColor : (contested ? contestedColor : clearColor);
            path.SampleInto(previewBuffer);
            line.positionCount = previewBuffer.Length;
            line.SetPositions(previewBuffer);
            line.startColor = c;
            line.endColor = new Color(c.r, c.g, c.b, c.a * 0.55f);
            line.enabled = path.IsValid;
        }

        /// <summary>Yolun üzerinde (top alçaktayken) bir rakip var mı?</summary>
        private bool IsContested()
        {
            for (int i = 0; i < enemies.Count; i++)
            {
                EnemyAI e = enemies[i];
                if (e == null || !e.isActiveAndEnabled) continue;
                float along;
                float d = path.ClosestHorizontal(e.transform.position, out along);
                if (d < contestRadius && along > 1.5f) return true;
            }
            return false;
        }

        /// <summary>Pasör, gerçekçilik için çizginin başlangıç yönüne döner (oyun zamanıyla, ağır çekimde yavaş).</summary>
        private void TurnPasserAlongPath()
        {
            if (!path.IsValid) return;
            Vector3 t = path.TangentAtDistance(0f);
            t.y = 0f;
            if (t.sqrMagnitude < 1e-4f) return;
            Quaternion want = Quaternion.LookRotation(t);
            passer.rotation = Quaternion.Slerp(passer.rotation, want, 1f - Mathf.Exp(-10f * Time.deltaTime));
        }

        // ─────────────────────────── Pas ───────────────────────────

        private void Release()
        {
            if (!path.IsValid || HorizontalDistance(path.P0, path.P3) < minPassDistance)
            {
                // Çok kısa çizim: pas sayılmaz, ağır çekimde tekrar çizilir (baskı sürer)
                HideLine();
                SetTarget(null);
                SetState(PassState.Aiming);
                return;
            }
            Launch();
        }

        private void Launch()
        {
            // Parmak kalktı: zaman ANINDA normale döner
            SetTimeScaleImmediate(1f);

            launchedShot = shotAimed;
            launchSpeed = launchedShot
                ? Mathf.Clamp(minShotSpeed + shotSpeedPerMeter * path.Length, minShotSpeed, maxShotSpeed)
                : Mathf.Clamp(minPassSpeed + speedPerMeter * path.Length, minPassSpeed, maxPassSpeed);
            launchPasser = passer;
            ball.Launch(path, launchSpeed, passer, launchedShot);
            if (launchedShot && keeper != null) keeper.OnShot(path, launchSpeed);

            // Pasör vuruş yönüne döner
            Vector3 t = path.TangentAtDistance(0f);
            t.y = 0f;
            if (t.sqrMagnitude > 1e-4f) passer.rotation = Quaternion.LookRotation(t);

            if (line != null)
            {
                // Çizgi, uçuş boyunca soluk bir rehber olarak kalır
                line.startColor = new Color(line.startColor.r, line.startColor.g, line.startColor.b, 0.35f);
                line.endColor = new Color(line.endColor.r, line.endColor.g, line.endColor.b, 0.2f);
            }

            SetState(PassState.InFlight);
            if (cameraRig != null) cameraRig.SetFollow(ball);

            for (int i = 0; i < enemies.Count; i++)
            {
                if (enemies[i] != null && enemies[i].isActiveAndEnabled) enemies[i].StartIntercept(path, launchSpeed, ball.transform);
            }

            // Hedeflenen arkadaş (yoksa inişe en yakın olan) topu karşılamaya koşar (şutta değil)
            PassReceiver runner = launchedShot ? null : target != null ? target : FindReceiverNear(predictedLanding, float.MaxValue);
            if (runner != null && HorizontalDistance(runner.transform.position, predictedLanding) <= runner.RunRange + targetRadius)
            {
                runner.OnPassLaunched(predictedLanding);
            }
        }

        private void OnFlightFinished(BallContact contact)
        {
            if (state != PassState.InFlight) return;

            PassOutcome outcome = contact.outcome;
            PassReceiver receiver = contact.receiver;
            EnemyAI interceptor = contact.interceptor;
            PassResult r = new PassResult
            {
                outcome = outcome,
                passer = launchPasser,
                receiver = receiver,
                interceptor = interceptor,
                keeper = contact.keeper,
                isShot = launchedShot,
                point = contact.point,
                pathLength = path.Length,
                curve = path.Curve,
                flightTime = ball.FlightTime,
            };

            if (outcome == PassOutcome.Completed && receiver != null)
            {
                // Başarılı: top arkadaşın ayağında, artık pasör o
                receiver.StopRun();
                if (launchPasser != null) receiver.FaceTowards(launchPasser.position);
                ball.AttachTo(receiver.transform, receiver.BallOffset);
                passer = receiver.transform;
            }
            else if (outcome == PassOutcome.Intercepted && interceptor != null)
            {
                ball.AttachTo(interceptor.transform, interceptor.BallOffset);
            }
            else if (outcome == PassOutcome.Saved && contact.keeper != null)
            {
                ball.AttachTo(contact.keeper.transform, new Vector3(0f, 0f, 0.5f));
            }
            FinishPass(r);
        }

        // ─────────────────────────── Baskı ───────────────────────────

        /// <summary>En yakın N rakibi baskıya gönder: 1. pasöre, 2. iniş noktasına (sonrakiler sırayla).</summary>
        private void StartPressure()
        {
            pressureActive = true;
            sortBuffer.Clear();
            for (int i = 0; i < enemies.Count; i++)
            {
                if (enemies[i] != null && enemies[i].isActiveAndEnabled) sortBuffer.Add(enemies[i]);
            }
            if (sortBuffer.Count == 0) return;
            sortBuffer.Sort(byDistanceToPasser);

            int count = Mathf.Min(pressersCount, sortBuffer.Count);
            for (int i = 0; i < count; i++) sortBuffer[i].StartPress(this, passer, i % 2 == 1);
            // Gösterge, en yakın rakibin (basmasa bile) uzaklığına göre dolar
            pressureStartDistance = Mathf.Max(stealRadius + 0.5f, sortBuffer[0].HorizontalDistanceTo(passer.position));
        }

        /// <summary>Bir rakip pasöre yeterince yaklaştıysa top kapılır. Ayrıca baskı göstergesini günceller.</summary>
        private bool CheckSteal()
        {
            float nearest = float.MaxValue;
            EnemyAI thief = null;
            for (int i = 0; i < enemies.Count; i++)
            {
                EnemyAI e = enemies[i];
                if (e == null || !e.isActiveAndEnabled) continue;
                float d = e.HorizontalDistanceTo(passer.position);
                if (d < nearest)
                {
                    nearest = d;
                    thief = e;
                }
            }
            if (thief == null) return false;
            pressure = 1f - Mathf.Clamp01((nearest - stealRadius) / Mathf.Max(0.01f, pressureStartDistance - stealRadius));
            if (nearest > stealRadius) return false;

            // Oyalandın, top gitti
            SetTimeScaleImmediate(1f);
            ball.AttachTo(thief.transform, thief.BallOffset);
            FinishPass(new PassResult
            {
                outcome = PassOutcome.Stolen,
                passer = passer,
                interceptor = thief,
                pathLength = state == PassState.Drawing ? path.Length : 0f,
                curve = state == PassState.Drawing ? path.Curve : 0f,
            });
            return true;
        }

        // ─────────────────────────── Sonuç ───────────────────────────

        private void FinishPass(PassResult result)
        {
            lastResult = result;
            HideLine();
            SetTarget(null);
            pressureActive = false;
            pressure = 0f;

            for (int i = 0; i < teammates.Count; i++) if (teammates[i] != null) teammates[i].StopRun();
            for (int i = 0; i < enemies.Count; i++)
            {
                if (enemies[i] == null) continue;
                if (result.Success) enemies[i].Release(); // dizilişe dön
                else enemies[i].Stop();                   // sonuç gösterilirken donsunlar
            }

            SetState(PassState.Resolving);
            onPassFinished.Invoke(result);
            if (PassFinished != null) PassFinished(result);
        }

        private void UpdateResolving()
        {
            stateClock += Time.unscaledDeltaTime;
            if (stateClock < resultHoldTime) return;

            if ((lastResult.isShot && resetAfterShot) || (!lastResult.Success && autoResetOnFail))
            {
                ResetPlay();
                return;
            }
            SetState(PassState.Idle);
            if (cameraRig != null && ball != null) cameraRig.SetDefault(ball.transform);
        }

        /// <summary>Dizilişi baştan kurar: herkes yerine, top ilk pasöre.</summary>
        public void ResetPlay()
        {
            SetTimeScaleImmediate(1f);
            HideLine();
            SetTarget(null);
            pressureActive = false;
            pressure = 0f;

            for (int i = 0; i < teammates.Count; i++) if (teammates[i] != null) teammates[i].ResetHome();
            for (int i = 0; i < enemies.Count; i++) if (enemies[i] != null) enemies[i].ResetToHome(true);
            if (keeper != null) keeper.ResetToHome();

            passer = startPasser;
            if (passer != null && passer.GetComponent<PassReceiver>() == null)
            {
                passer.position = startPasserPos;
                passer.rotation = startPasserRot;
            }
            if (ball != null && passer != null) ball.AttachTo(passer, OffsetFor(passer));

            SetState(PassState.Idle);
            if (cameraRig != null && ball != null) cameraRig.SetDefault(ball.transform);
        }

        /// <summary>
        /// Topu bir oyuncuya ver ve onu pasör yap (maç akışından: taç, serbest vuruş, top kazanma…).
        /// autoResetOnFail kapalıyken başarısız pastan sonra oyunu sürdürmek için kullanılır.
        /// </summary>
        public void GiveBallTo(Transform player)
        {
            if (player == null || ball == null || state == PassState.InFlight) return;
            SetTimeScaleImmediate(1f);
            HideLine();
            SetTarget(null);
            pressureActive = false;
            passer = player;
            ball.AttachTo(passer, OffsetFor(passer));
            SetState(PassState.Idle);
            if (cameraRig != null) cameraRig.SetDefault(ball.transform);
        }

        // ─────────────────────────── Zaman ───────────────────────────

        /// <summary>Zaman ölçeğini hedefe doğru yumuşakça kaydır (gerçek zamanla).</summary>
        private void UpdateTimeScale()
        {
            if (!timeBlending) return;
            float k = 1f - Mathf.Exp(-timeBlendSpeed * Time.unscaledDeltaTime);
            float s = Mathf.Lerp(Time.timeScale, targetTimeScale, k);
            if (Mathf.Abs(s - targetTimeScale) < 0.005f)
            {
                s = targetTimeScale;
                timeBlending = false;
            }
            ApplyTimeScale(s);
        }

        private void BlendTimeTo(float scale)
        {
            targetTimeScale = scale;
            timeBlending = true;
        }

        private void SetTimeScaleImmediate(float scale)
        {
            targetTimeScale = scale;
            timeBlending = false;
            ApplyTimeScale(scale);
        }

        /// <summary>Fizik adımı da ölçeklenir: ağır çekimde saniyedeki fizik adımı sayısı aynı kalır → akıcı hareket.</summary>
        private void ApplyTimeScale(float scale)
        {
            Time.timeScale = scale;
            Time.fixedDeltaTime = baseFixedDelta * scale;
            ownsTimeScale = scale < 0.999f;
        }

        private void RestoreTime()
        {
            if (!ownsTimeScale && !timeBlending) return;
            timeBlending = false;
            ApplyTimeScale(1f);
        }

        // ─────────────────────────── Yardımcılar ───────────────────────────

        private bool HasBall { get { return ball != null && passer != null && ball.Carrier == passer; } }

        private void SetState(PassState s)
        {
            state = s;
            stateClock = 0f;
            if (StateChanged != null) StateChanged(s);
        }

        private bool CameraReady()
        {
            return cameraRig == null || cameraRig.IsSettled || stateClock >= cameraSettleTimeout;
        }

        /// <summary>Dokunuş topun ekrandaki konumuna yeterince yakın mı?</summary>
        private bool TouchNearBall(Vector2 screenPos)
        {
            if (startTouchRadius <= 0f) return true;
            Vector3 sp = cam.WorldToScreenPoint(ball.transform.position);
            if (sp.z < 0f) return false; // top kameranın arkasında
            float r = startTouchRadius * Screen.height;
            float dx = sp.x - screenPos.x, dy = sp.y - screenPos.y;
            return dx * dx + dy * dy <= r * r;
        }

        /// <summary>Kameranın bakacağı yön: pasör hariç arkadaşların ağırlık merkezi (yoksa pasörün önü).</summary>
        private Vector3 ComputeAimDirection()
        {
            Vector3 sum = Vector3.zero;
            int n = 0;
            for (int i = 0; i < teammates.Count; i++)
            {
                PassReceiver r = teammates[i];
                if (r == null || r.transform == passer || !r.isActiveAndEnabled) continue;
                sum += r.transform.position;
                n++;
            }
            // Kale yakınsa (şut mesafesi) kamera kaleyi de kadraja alsın
            if (targetGoal != null && HorizontalDistance(passer.position, targetGoal.Center) < 40f)
            {
                sum += targetGoal.Center * 2f;
                n += 2;
            }
            Vector3 dir = n > 0 ? sum / n - passer.position : passer.forward;
            dir.y = 0f;
            return dir.sqrMagnitude > 1e-4f ? dir.normalized : Vector3.forward;
        }

        /// <summary>Bir noktaya en yakın arkadaş (pasör hariç), maxDistance içinde.</summary>
        private PassReceiver FindReceiverNear(Vector3 point, float maxDistance)
        {
            PassReceiver best = null;
            float bestD = maxDistance;
            for (int i = 0; i < teammates.Count; i++)
            {
                PassReceiver r = teammates[i];
                if (r == null || r.transform == passer || !r.isActiveAndEnabled) continue;
                float d = HorizontalDistance(r.transform.position, point);
                if (d <= bestD)
                {
                    bestD = d;
                    best = r;
                }
            }
            return best;
        }

        private void SetTarget(PassReceiver r)
        {
            if (target == r) return;
            if (target != null) target.SetTargeted(false);
            target = r;
            if (target != null) target.SetTargeted(true);
        }

        private void HideLine()
        {
            if (line == null) return;
            line.enabled = false;
            line.positionCount = 0;
        }

        private static Vector3 OffsetFor(Transform t)
        {
            PassReceiver r = t.GetComponent<PassReceiver>();
            return r != null ? r.BallOffset : new Vector3(0f, 0f, 0.45f);
        }

        private int CompareByDistanceToPasser(EnemyAI a, EnemyAI b)
        {
            Vector3 p = passer.position;
            return a.HorizontalDistanceTo(p).CompareTo(b.HorizontalDistanceTo(p));
        }

        private static float HorizontalDistance(Vector3 a, Vector3 b)
        {
            float dx = a.x - b.x, dz = a.z - b.z;
            return Mathf.Sqrt(dx * dx + dz * dz);
        }

        private static bool IsNull<T>(T o) where T : UnityEngine.Object { return o == null; }

        private static T[] FindAll<T>() where T : UnityEngine.Object
        {
#if UNITY_2022_2_OR_NEWER
            return FindObjectsByType<T>(FindObjectsSortMode.None);
#else
            return FindObjectsOfType<T>();
#endif
        }

        private void OnDrawGizmosSelected()
        {
            Gizmos.color = new Color(1f, 1f, 1f, 0.25f);
            Gizmos.DrawWireCube(pitchBounds.center, pitchBounds.size);
            if (!path.IsValid) return;
            Gizmos.color = Color.yellow;
            Vector3 prev = path.EvaluateT(0f);
            for (int i = 1; i <= 24; i++)
            {
                Vector3 p = path.EvaluateT(i / 24f);
                Gizmos.DrawLine(prev, p);
                prev = p;
            }
            Gizmos.DrawWireSphere(predictedLanding, targetRadius);
        }
    }
}

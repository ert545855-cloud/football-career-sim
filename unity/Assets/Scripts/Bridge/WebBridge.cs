using System;
using System.Runtime.InteropServices;
using FootballCareer.Passing;
using FootballCareer.Passing.Demo;
using FootballCareer.Passing.Feedback;
using FootballCareer.Passing.Levels;
using UnityEngine;
using UnityEngine.AI;

namespace FootballCareer.Bridge
{
    /// <summary>Web oyunundan gelen "kritik an" isteği (JSON).</summary>
    [Serializable]
    public class MomentRequest
    {
        /// <summary>"pass" ya da "shot"</summary>
        public string type = "pass";
        /// <summary>pass: "buildup" | "final"; shot: "box" | "penalty"</summary>
        public string context = "buildup";
        /// <summary>Etkin yetenekler (0–1, yorgunluk dahil).</summary>
        public float passing = 0.5f, shooting = 0.5f, speed = 0.5f;
        /// <summary>Büyük maç heyecanı (0–1): ağır çekim kısalır.</summary>
        public float nerves;
        /// <summary>Kaleci gücü (0–1).</summary>
        public float keeper = 0.5f;
        /// <summary>Forma renkleri (#rrggbb).</summary>
        public string myColor = "#2563eb", oppColor = "#b91c1c";
        public int seed;
    }

    /// <summary>Unity'nin web oyununa döndürdüğü sonuç (web'deki mini oyun sonucuyla aynı biçim).</summary>
    [Serializable]
    public class MomentResult
    {
        public bool success;
        public float accuracy;
        /// <summary>pass: success | intercept | stolen | out | missed — shot: goal | save | post | wide</summary>
        public string outcome;
        public float curve;
        public float distance;
    }

    /// <summary>
    /// UNITY ↔ WEB KÖPRÜSÜ — 3B pas/şut oyununu web kariyerinin maç anlarında kullanır.
    ///
    ///  • Web (JS): <c>unityInstance.SendMessage("WebBridge", "StartMoment", json)</c> → bu sınıf diziliş kurar.
    ///  • Oyuncu pası/şutu yapınca sonuç <c>KB_SendResult</c> ile web'e döner (Plugins/WebGL/KramponBridge.jslib).
    ///  • Gol olursa ağır çekim tekrar bittikten sonra döner.
    ///
    /// Kurulum: boş bir sahneye boş bir GameObject ekleyip bu bileşeni verin, sahneyi WebGL'e derleyin
    /// (ayrıntılar: Scripts/Bridge/README.md). Editörde ve WebGL dışı derlemelerde sonuçlar konsola yazılır;
    /// test için Inspector'daki "Editörde dene" düğmesini (ContextMenu) kullanabilirsiniz.
    /// </summary>
    [DisallowMultipleComponent]
    public class WebBridge : MonoBehaviour
    {
        [SerializeField] private Vector2 pitchSize = new Vector2(68f, 105f);
        [SerializeField] private Material lineMaterial;
        [Tooltip("Golden sonra tekrarın bitmesi için en fazla bekleme (gerçek saniye).")]
        [SerializeField] private float maxReplayWait = 6f;

#if UNITY_WEBGL && !UNITY_EDITOR
        [DllImport("__Internal")] private static extern void KB_Ready();
        [DllImport("__Internal")] private static extern void KB_SendResult(string json);
        [DllImport("__Internal")] private static extern void KB_Log(string text);
#else
        private static void KB_Ready() { Debug.Log("[WebBridge] hazır"); }
        private static void KB_SendResult(string json) { Debug.Log("[WebBridge] sonuç: " + json); }
        private static void KB_Log(string text) { Debug.Log("[WebBridge] " + text); }
#endif

        private PitchBuilder builder;
        private PasManager manager;
        private PassCameraController rig;
        private BallController ball;
        private GoalReplay replay;
        private NavMeshDataInstance navMesh;
        private MomentRequest active;
        private MomentResult pendingResult;
        private float waitUntil, readyAt;

        public bool Busy { get { return active != null; } }

        private void Awake()
        {
            gameObject.name = "WebBridge"; // JS SendMessage bu ada gönderir
            transform.SetPositionAndRotation(Vector3.zero, Quaternion.identity);
            builder = new PitchBuilder(transform, lineMaterial, pitchSize);
            builder.BuildPitch();
            navMesh = builder.BakeNavMesh();
            PitchBuilder.EnsureLight();
            ball = builder.CreateBall();
            GoalFrame goal = builder.BuildGoal();
            Camera cam = PitchBuilder.SetupCamera();
            rig = cam.GetComponent<PassCameraController>();
            if (rig == null) rig = cam.gameObject.AddComponent<PassCameraController>();
            rig.SetDefault(ball.transform);
            rig.Snap();

            manager = gameObject.AddComponent<PasManager>();
            manager.Setup(ball, null, cam, rig, builder.CreatePassLine(), builder.PitchBounds);
            manager.SetGoal(goal, null);
            manager.PassFinished += OnPassFinished;
            manager.enabled = false;

            gameObject.AddComponent<PassFeedback>().Setup(manager, rig);
            replay = gameObject.AddComponent<GoalReplay>();
            replay.Setup(manager, rig);
        }

        private void Start()
        {
            KB_Ready();
        }

        private void OnDestroy()
        {
            if (manager != null) manager.PassFinished -= OnPassFinished;
            if (navMesh.valid) navMesh.Remove();
        }

        // ─────────────────────────── Web'den gelenler ───────────────────────────

        /// <summary>JS: SendMessage("WebBridge", "StartMoment", json)</summary>
        public void StartMoment(string json)
        {
            MomentRequest req;
            try
            {
                req = JsonUtility.FromJson<MomentRequest>(json);
            }
            catch (Exception e)
            {
                KB_Log("Geçersiz istek: " + e.Message);
                return;
            }
            if (req == null) return;
            if (req.seed != 0) UnityEngine.Random.InitState(req.seed);

            PassLevel level = MomentLevels.Build(req);
            builder.TeamColor = ParseColor(req.myColor, PitchBuilder.Blue);
            builder.OppColor = ParseColor(req.oppColor, PitchBuilder.Red);
            FormationHandles f = builder.Spawn(level);

            manager.ApplySkill(PassSkillProfile.FromSkills(req.passing, req.shooting, req.speed));
            // Heyecan: ağır çekim daha kısa (zaman daha hızlı akar)
            manager.SetSlowTimeScale(Mathf.Clamp(level.slowTimeScale * (1f + Mathf.Clamp01(req.nerves) * 0.8f), 0.05f, 0.6f));
            manager.SetPressersCount(level.pressersCount);
            for (int i = 0; i < f.enemies.Count; i++) f.enemies[i].SetSpeeds(level.enemyPressSpeed, level.enemyInterceptSpeed);
            if (f.keeper != null) f.keeper.SetSkill(level.keeperSkill);
            manager.SetGoal(manager.TargetGoal, f.keeper);
            manager.LoadFormation(f.passer, f.teammates, f.enemies, f.keeper);
            manager.enabled = true;
            active = req;
            pendingResult = null;
            KB_Log("An başladı: " + req.type + "/" + req.context);
        }

        /// <summary>JS: SendMessage("WebBridge", "Abort") — oyuncu anı kapattı (başarısız sayılır).</summary>
        public void Abort()
        {
            if (active == null) return;
            Send(new MomentResult { success = false, accuracy = 0f, outcome = active.type == "shot" ? "wide" : "missed" });
        }

        // ─────────────────────────── Sonuç ───────────────────────────

        private void OnPassFinished(PassResult r)
        {
            if (active == null || pendingResult != null) return;
            bool shot = active.type == "shot";
            var res = new MomentResult { curve = r.curve, distance = r.pathLength };
            switch (r.outcome)
            {
                case PassOutcome.Goal: res.success = true; res.outcome = "goal"; break;
                case PassOutcome.Completed: res.success = !shot; res.outcome = shot ? "wide" : "success"; break;
                case PassOutcome.Saved: res.outcome = "save"; break;
                case PassOutcome.HitFrame: res.outcome = "post"; break;
                case PassOutcome.Wide: res.outcome = "wide"; break;
                case PassOutcome.Intercepted: res.outcome = shot ? "block" : "intercept"; break;
                case PassOutcome.Stolen: res.outcome = shot ? "timeout" : "stolen"; break;
                case PassOutcome.OutOfBounds: res.outcome = shot ? "wide" : "out"; break;
                default: res.outcome = shot ? "wide" : "missed"; break;
            }
            // İsabet: falso ve mesafe ödüllendirilir (web'de asist şansını etkiler)
            res.accuracy = res.success ? Mathf.Clamp01(0.45f + 0.3f * Mathf.Min(1f, Mathf.Abs(r.curve) * 1.5f) + Mathf.Min(0.25f, r.pathLength / 120f)) : 0f;
            pendingResult = res;
            manager.enabled = false; // ikinci bir pas başlamasın
            readyAt = Time.unscaledTime + 1.2f;
            waitUntil = Time.unscaledTime + maxReplayWait;
        }

        private void Update()
        {
            if (pendingResult == null) return;
            bool replaying = replay != null && replay.IsReplaying;
            if (replaying && Time.unscaledTime < waitUntil) return; // gol tekrarı sürüyor (en fazla maxReplayWait)
            if (!replaying && Time.unscaledTime < readyAt) return;   // sonucu kısa süre göster / tekrarın başlamasını bekle
            Send(pendingResult);
        }

        private void Send(MomentResult res)
        {
            active = null;
            pendingResult = null;
            manager.enabled = false;
            Time.timeScale = 1f;
            builder.Despawn();
            KB_SendResult(JsonUtility.ToJson(res));
        }

        private static Color ParseColor(string hex, Color fallback)
        {
            Color c;
            return !string.IsNullOrEmpty(hex) && ColorUtility.TryParseHtmlString(hex, out c) ? c : fallback;
        }

        [ContextMenu("Editörde dene: pas")]
        private void TryPass() { StartMoment("{\"type\":\"pass\",\"context\":\"buildup\",\"passing\":0.6}"); }

        [ContextMenu("Editörde dene: şut")]
        private void TryShot() { StartMoment("{\"type\":\"shot\",\"context\":\"box\",\"shooting\":0.6,\"keeper\":0.6}"); }
    }

    /// <summary>Web'deki maç anlarının 3B dizilişleri (her çağrıda biraz rastgele).</summary>
    public static class MomentLevels
    {
        private static Vector3 V(float x, float z) { return new Vector3(x, 0f, z); }
        private static float R(float a, float b) { return UnityEngine.Random.Range(a, b); }

        public static PassLevel Build(MomentRequest req)
        {
            PassLevel l;
            if (req.type == "shot" && req.context == "penalty")
            {
                l = PassLevel.Create("m-penalty", "Penaltı", "", LevelObjective.ScoreGoal, 1, V(0f, 41.5f), new Vector3[0], new Vector3[0], Mathf.Clamp01(req.keeper + 0.1f), 0, 0);
                l.pressersCount = 0;
                l.slowTimeScale = 0.25f;
            }
            else if (req.type == "shot")
            {
                float x = R(-10f, 10f);
                l = PassLevel.Create("m-shot", "Şut", "", LevelObjective.ScoreGoal, 1, V(x, R(32f, 37f)), new Vector3[0],
                    new[] { V(x * 0.6f + R(-2f, 2f), R(39f, 42f)), V(x + R(-6f, 6f), R(30f, 34f)) }, Mathf.Clamp01(req.keeper), 0, 0);
                l.pressersCount = 1;
            }
            else if (req.context == "final")
            {
                l = PassLevel.Create("m-final-pass", "Son pas", "", LevelObjective.CompletePasses, 1, V(R(-8f, 8f), 24f),
                    new[] { V(-12f + R(-2f, 2f), 40f), V(R(-3f, 3f), 44f), V(12f + R(-2f, 2f), 39f) },
                    new[] { V(-6f, 33f), V(4f, 35f), V(-1f, 41f), V(9f, 44f) }, Mathf.Clamp01(req.keeper), 0, 0);
            }
            else
            {
                l = PassLevel.Create("m-buildup", "Oyun kurma", "", LevelObjective.CompletePasses, 1, V(R(-4f, 4f), -6f),
                    new[] { V(-16f + R(-3f, 3f), 8f), V(R(-4f, 4f), 18f), V(15f + R(-3f, 3f), 10f) },
                    new[] { V(-7f, 2f), V(5f, 6f), V(-1f, 11f) }, -1f, 0, 0);
            }
            l.lives = 1;
            return l;
        }
    }
}

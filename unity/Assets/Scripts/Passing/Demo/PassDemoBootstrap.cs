using FootballCareer.Core;
using FootballCareer.Passing.Feedback;
using FootballCareer.Passing.Levels;
using UnityEngine;
using UnityEngine.AI;

namespace FootballCareer.Passing.Demo
{
    /// <summary>
    /// TEK TIKLA DENEME SAHNESİ — boş bir sahnede boş bir GameObject'e ekleyip Play'e basın.
    ///
    /// Çalışma anında kurar: saha, kale, NavMesh, top, kamera, pas çizgisi, PasManager ve LevelRunner.
    /// Menüden bölüm seçilir (yıldızlar kaydedilir, bölümler sırayla açılır) ya da serbest oynanır.
    /// Arayüz OnGUI ile çizilir (prefab/Canvas gerektirmez).
    ///
    /// Gerçek oyunda bu dosyaya ihtiyaç yok: aynı bileşenleri sahnenizde Inspector'dan bağlayın (README).
    /// </summary>
    [DisallowMultipleComponent]
    public class PassDemoBootstrap : MonoBehaviour
    {
        [SerializeField] private Vector2 pitchSize = new Vector2(68f, 105f);
        [Tooltip("Pas çizgisi ve iz için malzeme. Boşsa Sprites/Default bulunur.")]
        [SerializeField] private Material lineMaterial;

        private PitchBuilder builder;
        private PasManager manager;
        private PassCameraController rig;
        private BallController ball;
        private LevelRunner runner;
        private CareerStatsBridge bridge;
        private GoalReplay replay;
        private NavMeshDataInstance navMesh;
        private float demoPassing = 50f, demoShooting = 50f;

        private string banner;
        private Color bannerColor;
        private float bannerUntil;
        private GUIStyle boxStyle, titleStyle, bannerStyle, buttonStyle, smallStyle;
        private Texture2D starOn, starOff;

        private void Awake()
        {
            transform.SetPositionAndRotation(Vector3.zero, Quaternion.identity); // saha dünya merkezinde kurulur
            builder = new PitchBuilder(transform, lineMaterial, pitchSize);
            builder.BuildPitch();
            navMesh = builder.BakeNavMesh(); // oyunculardan ÖNCE: NavMeshAgent eklenirken NavMesh hazır olmalı
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
            manager.enabled = false; // bölüm seçilene kadar

            // Kariyer kaydı varsa statlar oynanışı etkiler ve isabetli pas/gol stat geliştirir
            bridge = gameObject.AddComponent<CareerStatsBridge>();
            bridge.Setup(manager);
            if (!bridge.HasCareer) ApplyDemoSkill();

            // His: titreşim + ses + kamera sarsıntısı, gol tekrarı
            gameObject.AddComponent<PassFeedback>().Setup(manager, rig);
            replay = gameObject.AddComponent<GoalReplay>();
            replay.Setup(manager, rig);

            runner = gameObject.AddComponent<LevelRunner>();
            runner.Setup(manager, builder);
            runner.Changed += OnRunnerChanged;

            starOn = MakeStar(new Color(1f, 0.82f, 0.2f));
            starOff = MakeStar(new Color(1f, 1f, 1f, 0.22f));
        }

        private void OnDestroy()
        {
            if (manager != null) manager.PassFinished -= OnPassFinished;
            if (runner != null) runner.Changed -= OnRunnerChanged;
            if (navMesh.valid) navMesh.Remove();
        }

        /// <summary>Menüye dönülünce kamera sahayı genel plandan göstersin.</summary>
        private void OnRunnerChanged(LevelRunner r)
        {
            if (r.State == LevelState.Won) PlayWhistle();
            if (r.State == LevelState.None && rig != null && ball != null)
            {
                ball.AttachTo(null, Vector3.zero);
                ball.transform.position = new Vector3(0f, ball.Radius, 0f);
                rig.SetDefault(ball.transform);
            }
        }

        private void PlayWhistle()
        {
            AudioSource src = GetComponent<AudioSource>();
            if (src != null) src.PlayOneShot(ProceduralSfx.Get(ProceduralSfx.Kind.Whistle), 0.6f);
        }

        private void OnPassFinished(PassResult r)
        {
            banner = r.Describe();
            bannerColor = r.Success ? new Color(0.45f, 1f, 0.5f) : new Color(1f, 0.45f, 0.4f);
            bannerUntil = Time.unscaledTime + 1.6f;
        }

        // ─────────────────────────── Arayüz (IMGUI) ───────────────────────────

        private void OnGUI()
        {
            if (runner == null) return;
            float scale = Mathf.Max(1f, Screen.height / 720f);
            GUI.matrix = Matrix4x4.Scale(new Vector3(scale, scale, 1f));
            float w = Screen.width / scale, h = Screen.height / scale;
            EnsureStyles();

            switch (runner.State)
            {
                case LevelState.None: DrawMenu(w, h); break;
                case LevelState.Intro: DrawIntro(w, h); break;
                case LevelState.Playing: DrawHud(w, h); break;
                case LevelState.Won: DrawHud(w, h); if (!ReplayActive) DrawWon(w, h); break;
                case LevelState.Lost: DrawHud(w, h); DrawLost(w, h); break;
            }
            if (replay.IsReplaying)
            {
                GUI.color = new Color(1f, 0.25f, 0.25f);
                GUI.DrawTexture(new Rect(w - 150f, 70f, 14f, 14f), Texture2D.whiteTexture);
                GUI.color = Color.white;
                GUI.Label(new Rect(w - 130f, 62f, 120f, 30f), "TEKRAR", titleStyle);
                GUI.Label(new Rect(0f, h - 40f, w, 30f), "Geçmek için dokun", smallStyle);
            }
        }

        private void DrawMenu(float w, float h)
        {
            float cw = Mathf.Min(w - 24f, 520f), x = (w - cw) / 2f, y = 24f;
            GUI.Box(new Rect(x, y, cw, h - 48f), "", boxStyle);
            GUI.Label(new Rect(x, y + 12f, cw, 40f), "ÇİZEREK PAS & ŞUT", titleStyle);
            GUI.Label(new Rect(x, y + 50f, cw, 24f), "Toplam yıldız: " + LevelProgress.TotalStars(runner.Levels) + " / " + (runner.Levels.Count - 1) * 3, smallStyle);

            // Stat etkisi: kariyer yoksa kaydırıcılarla denenir
            float sy = y + 80f;
            if (bridge.HasCareer)
            {
                GUI.Label(new Rect(x + 16f, sy, cw - 32f, 44f), "Kariyer statların oynanışı etkiliyor; isabetli pas ve gol stat geliştirir.\n" + SkillSummary(), smallStyle);
            }
            else
            {
                GUI.Label(new Rect(x + 16f, sy, 110f, 22f), "Pas: " + Mathf.RoundToInt(demoPassing), smallStyle);
                float np = GUI.HorizontalSlider(new Rect(x + 130f, sy + 6f, cw - 150f, 16f), demoPassing, 0f, 100f);
                GUI.Label(new Rect(x + 16f, sy + 24f, 110f, 22f), "Şut: " + Mathf.RoundToInt(demoShooting), smallStyle);
                float ns = GUI.HorizontalSlider(new Rect(x + 130f, sy + 30f, cw - 150f, 16f), demoShooting, 0f, 100f);
                if (!Mathf.Approximately(np, demoPassing) || !Mathf.Approximately(ns, demoShooting))
                {
                    demoPassing = np;
                    demoShooting = ns;
                    ApplyDemoSkill();
                }
                GUI.Label(new Rect(x + 16f, sy + 48f, cw - 32f, 22f), SkillSummary(), smallStyle);
            }

            // Ayarlar: titreşim ve ses
            if (GUI.Button(new Rect(x + 16f, sy + 70f, (cw - 40f) / 2f, 34f), "Titreşim: " + (Haptics.Enabled ? "Açık" : "Kapalı"), buttonStyle))
                Haptics.Enabled = !Haptics.Enabled;
            if (GUI.Button(new Rect(x + 24f + (cw - 40f) / 2f, sy + 70f, (cw - 40f) / 2f, 34f), "Ses: " + (AudioListener.volume > 0f ? "Açık" : "Kapalı"), buttonStyle))
                AudioListener.volume = AudioListener.volume > 0f ? 0f : 1f;

            float rowH = 44f, top = sy + 112f;
            for (int i = 0; i < runner.Levels.Count; i++)
            {
                PassLevel l = runner.Levels[i];
                Rect r = new Rect(x + 16f, top + i * (rowH + 5f), cw - 32f, rowH);
                bool unlocked = LevelProgress.IsUnlocked(runner.Levels, i);
                GUI.enabled = unlocked;
                string label = l.objective == LevelObjective.FreePlay ? "  " + l.title : "  " + (i + 1) + ". " + l.title;
                if (!unlocked) label += "   (kilitli)";
                if (GUI.Button(r, label, buttonStyle)) runner.Load(i);
                GUI.enabled = true;
                if (l.objective != LevelObjective.FreePlay) DrawStars(new Rect(r.xMax - 96f, r.y + 11f, 84f, 24f), LevelProgress.GetStars(l.id));
            }
        }

        private void DrawIntro(float w, float h)
        {
            PassLevel l = runner.Current;
            Rect card = Card(w, h, 300f);
            GUI.Label(new Rect(card.x, card.y + 16f, card.width, 36f), l.title, titleStyle);
            GUI.Label(new Rect(card.x + 20f, card.y + 60f, card.width - 40f, 70f), l.description, smallStyle);
            GUI.Label(new Rect(card.x + 20f, card.y + 134f, card.width - 40f, 30f), "HEDEF: " + l.ObjectiveText(), boxStyle);
            string extra = l.objective == LevelObjective.FreePlay ? "" : "Hak: " + l.lives + "   ·   2 yıldız: " + l.twoStarScore + "   ·   3 yıldız: " + l.threeStarScore + " puan";
            GUI.Label(new Rect(card.x + 20f, card.y + 172f, card.width - 40f, 26f), extra, smallStyle);
            if (GUI.Button(new Rect(card.x + 20f, card.yMax - 72f, card.width * 0.55f - 30f, 52f), "Başla", buttonStyle)) runner.StartPlay();
            if (GUI.Button(new Rect(card.x + card.width * 0.55f, card.yMax - 72f, card.width * 0.45f - 20f, 52f), "Menü", buttonStyle)) runner.Quit();
        }

        private void DrawHud(float w, float h)
        {
            PassLevel l = runner.Current;
            if (l == null) return;
            bool free = l.objective == LevelObjective.FreePlay;

            string hint;
            switch (manager.State)
            {
                case PassState.Idle: hint = "Pas moduna geçmek için ekrana dokun ya da SPACE'e bas."; break;
                case PassState.Aiming: hint = "Ağır çekim! Topa dokun, arkadaşına çiz. Kaleye çizersen ŞUT!"; break;
                case PassState.Drawing: hint = manager.IsShotAimed ? "Sarı = şut. Köşeler ve falso kaleciyi zorlar!" : "Yeşil = temiz, turuncu = rakip yolda. Acele et!"; break;
                default: hint = runner.Message; break;
            }
            string status = free ? "Serbest oyun" : "Puan: " + runner.Score + "   ·   Hak: " + runner.LivesLeft + "/" + l.lives
                + (l.passBudget > 0 ? "   ·   Pas: " + runner.PassesUsed + "/" + l.passBudget : "");
            GUI.Box(new Rect(12f, 12f, Mathf.Min(w - 150f, 600f), 84f), l.title + " — " + l.ObjectiveText() + "\n" + status + "\n" + hint, boxStyle);
            if (GUI.Button(new Rect(w - 126f, 12f, 114f, 44f), "Menü", buttonStyle)) runner.Quit();

            // Baskı çubuğu
            if (manager.State == PassState.Aiming || manager.State == PassState.Drawing)
            {
                float bw = Mathf.Min(w - 24f, 320f);
                Rect bar = new Rect((w - bw) / 2f, h - 46f, bw, 14f);
                GUI.color = new Color(0f, 0f, 0f, 0.5f);
                GUI.DrawTexture(bar, Texture2D.whiteTexture);
                GUI.color = Color.Lerp(new Color(0.4f, 1f, 0.4f), new Color(1f, 0.25f, 0.2f), manager.Pressure);
                GUI.DrawTexture(new Rect(bar.x, bar.y, bar.width * manager.Pressure, bar.height), Texture2D.whiteTexture);
                GUI.color = Color.white;
                GUI.Label(new Rect(bar.x, bar.y - 22f, bar.width, 20f), "RAKİP BASKISI", smallStyle);
            }
            else if (runner.State == LevelState.Playing && manager.State == PassState.Idle)
            {
                if (GUI.Button(new Rect(12f, h - 64f, 150f, 48f), "Pas Modu", buttonStyle)) manager.EnterPassMode();
            }

            if (!string.IsNullOrEmpty(banner) && Time.unscaledTime < bannerUntil)
            {
                bannerStyle.normal.textColor = bannerColor;
                GUI.Label(new Rect(0f, h * 0.3f, w, 60f), banner, bannerStyle);
            }
        }

        private void DrawWon(float w, float h)
        {
            Rect card = Card(w, h, 290f);
            GUI.Label(new Rect(card.x, card.y + 16f, card.width, 36f), "BÖLÜM TAMAM!", titleStyle);
            DrawStars(new Rect(card.x + card.width / 2f - 84f, card.y + 62f, 168f, 48f), runner.StarsEarned);
            GUI.Label(new Rect(card.x, card.y + 120f, card.width, 28f), "Puan: " + runner.Score + (runner.NewBest ? "   ·   YENİ REKOR!" : ""), smallStyle);
            GUI.Label(new Rect(card.x + 20f, card.y + 150f, card.width - 40f, 40f), runner.Message, smallStyle);
            float bw = (card.width - 60f) / 3f, by = card.yMax - 72f;
            GUI.enabled = runner.HasNext;
            if (GUI.Button(new Rect(card.x + 20f, by, bw, 52f), "Sonraki", buttonStyle)) runner.Next();
            GUI.enabled = true;
            if (GUI.Button(new Rect(card.x + 30f + bw, by, bw, 52f), "Tekrar", buttonStyle)) runner.Retry();
            if (GUI.Button(new Rect(card.x + 40f + 2f * bw, by, bw, 52f), "Menü", buttonStyle)) runner.Quit();
        }

        private void DrawLost(float w, float h)
        {
            Rect card = Card(w, h, 240f);
            GUI.Label(new Rect(card.x, card.y + 16f, card.width, 36f), "Bölüm başarısız", titleStyle);
            GUI.Label(new Rect(card.x + 20f, card.y + 64f, card.width - 40f, 60f), runner.Message + "\nHakların bitti. Bir daha dene!", smallStyle);
            float bw = (card.width - 50f) / 2f, by = card.yMax - 72f;
            if (GUI.Button(new Rect(card.x + 20f, by, bw, 52f), "Tekrar", buttonStyle)) runner.Retry();
            if (GUI.Button(new Rect(card.x + 30f + bw, by, bw, 52f), "Menü", buttonStyle)) runner.Quit();
        }

        private bool ReplayActive { get { return replay != null && (replay.IsReplaying || replay.IsPending); } }

        /// <summary>Kariyer kaydı yokken stat etkisini denemek için (kaydırıcılar).</summary>
        private void ApplyDemoSkill()
        {
            manager.ApplySkill(PassSkillProfile.FromSkills(demoPassing / 100f, demoShooting / 100f, 0.5f));
        }

        private string SkillSummary()
        {
            PassSkillProfile k = manager.Skill;
            return "Ağır çekim ×" + k.timeScaleFactor.ToString("0.00") + "  ·  pas sapması " + k.passErrorMeters.ToString("0.0")
                + " m  ·  şut sapması " + k.shotErrorMeters.ToString("0.0") + " m  ·  falso %" + Mathf.RoundToInt(k.shotCurveFidelity * 100f);
        }

        private Rect Card(float w, float h, float height)
        {
            float cw = Mathf.Min(w - 24f, 460f);
            Rect r = new Rect((w - cw) / 2f, (h - height) / 2f, cw, height);
            GUI.Box(r, "", boxStyle);
            GUI.Box(r, "", boxStyle); // iki kat: daha koyu zemin
            return r;
        }

        private void DrawStars(Rect area, int count)
        {
            float s = Mathf.Min(area.height, area.width / 3f);
            for (int i = 0; i < 3; i++)
            {
                GUI.DrawTexture(new Rect(area.x + i * s, area.y, s, s), i < count ? starOn : starOff);
            }
        }

        private void EnsureStyles()
        {
            if (boxStyle != null) return;
            boxStyle = new GUIStyle(GUI.skin.box) { fontSize = 16, alignment = TextAnchor.MiddleLeft, wordWrap = true };
            boxStyle.normal.textColor = Color.white;
            titleStyle = new GUIStyle(GUI.skin.label) { fontSize = 26, fontStyle = FontStyle.Bold, alignment = TextAnchor.MiddleCenter };
            titleStyle.normal.textColor = Color.white;
            smallStyle = new GUIStyle(GUI.skin.label) { fontSize = 16, alignment = TextAnchor.MiddleCenter, wordWrap = true };
            smallStyle.normal.textColor = new Color(0.9f, 0.93f, 1f);
            bannerStyle = new GUIStyle(GUI.skin.label) { fontSize = 34, fontStyle = FontStyle.Bold, alignment = TextAnchor.MiddleCenter };
            buttonStyle = new GUIStyle(GUI.skin.button) { fontSize = 18, alignment = TextAnchor.MiddleLeft };
        }

        /// <summary>Yazı tipinden bağımsız yıldız simgesi (5 köşeli, kenarı yumuşatılmış).</summary>
        private static Texture2D MakeStar(Color color)
        {
            const int n = 48;
            var tex = new Texture2D(n, n, TextureFormat.RGBA32, false);
            var pts = new Vector2[10];
            for (int i = 0; i < 10; i++)
            {
                float a = Mathf.PI / 2f + i * Mathf.PI / 5f;
                float rad = (i % 2 == 0 ? 0.48f : 0.2f) * n;
                pts[i] = new Vector2(n / 2f + Mathf.Cos(a) * rad, n / 2f + Mathf.Sin(a) * rad);
            }
            var clear = new Color(color.r, color.g, color.b, 0f);
            for (int y = 0; y < n; y++)
            {
                for (int x = 0; x < n; x++)
                {
                    // 2×2 alt örnekleme ile kenar yumuşatma
                    int hits = 0;
                    for (int s = 0; s < 4; s++)
                    {
                        if (Inside(pts, new Vector2(x + 0.25f + 0.5f * (s % 2), y + 0.25f + 0.5f * (s / 2)))) hits++;
                    }
                    tex.SetPixel(x, y, hits == 0 ? clear : new Color(color.r, color.g, color.b, color.a * hits / 4f));
                }
            }
            tex.Apply();
            return tex;
        }

        private static bool Inside(Vector2[] poly, Vector2 p)
        {
            bool inside = false;
            for (int i = 0, j = poly.Length - 1; i < poly.Length; j = i++)
            {
                if ((poly[i].y > p.y) != (poly[j].y > p.y)
                    && p.x < (poly[j].x - poly[i].x) * (p.y - poly[i].y) / (poly[j].y - poly[i].y) + poly[i].x)
                    inside = !inside;
            }
            return inside;
        }
    }
}

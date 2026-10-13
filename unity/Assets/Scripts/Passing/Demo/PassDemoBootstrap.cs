using System.Collections.Generic;
using UnityEngine;
using UnityEngine.AI;
using UnityEngine.Rendering;

namespace FootballCareer.Passing.Demo
{
    /// <summary>
    /// TEK TIKLA DENEME SAHNESİ — boş bir sahnede boş bir GameObject'e ekleyip Play'e basın.
    ///
    /// Çalışma anında kurar: saha + çizgiler, NavMesh (runtime bake), top, pasör + 3 arkadaş (mavi),
    /// 5 rakip (kırmızı, NavMeshAgent + EnemyAI), kamera, pas çizgisi ve PasManager.
    /// Ekranda yönerge, baskı çubuğu ve sonuç yazısı gösterir (OnGUI — prefab/Canvas gerektirmez).
    ///
    /// Gerçek oyunda bu dosyaya ihtiyaç yok: aynı bileşenleri sahnenizde Inspector'dan bağlayın (README).
    /// </summary>
    [DisallowMultipleComponent]
    public class PassDemoBootstrap : MonoBehaviour
    {
        [Header("Saha")]
        [SerializeField] private Vector2 pitchSize = new Vector2(68f, 105f);

        [Header("Diziliş (yerde, y = 0)")]
        [SerializeField] private Vector3 passerPosition = new Vector3(0f, 0f, 8f);
        [SerializeField] private Vector3[] teammatePositions =
        {
            new Vector3(-15f, 0f, 22f),
            new Vector3(14f, 0f, 24f),
            new Vector3(-2f, 0f, 34f),
        };
        [SerializeField] private Vector3[] enemyPositions =
        {
            new Vector3(-4f, 0f, 14f),
            new Vector3(6f, 0f, 17f),
            new Vector3(-9f, 0f, 28f),
            new Vector3(6f, 0f, 31f),
            new Vector3(1f, 0f, 42f),
        };
        [Tooltip("Rakip kalecinin yeteneği (0–1).")]
        [SerializeField, Range(0f, 1f)] private float keeperSkill = 0.6f;

        [Header("Görsel (boşsa otomatik)")]
        [Tooltip("Pas çizgisi ve iz için malzeme. Boşsa Sprites/Default bulunur.")]
        [SerializeField] private Material lineMaterial;

        private static readonly Color Grass = new Color(0.20f, 0.55f, 0.24f);
        private static readonly Color GrassDark = new Color(0.15f, 0.42f, 0.18f);
        private static readonly Color Blue = new Color(0.20f, 0.45f, 0.95f);
        private static readonly Color Red = new Color(0.85f, 0.20f, 0.20f);

        private PasManager manager;
        private NavMeshDataInstance navMesh;
        private string banner;
        private Color bannerColor;
        private float bannerUntil;
        private int attempts, completed, shots, goals;
        private GUIStyle boxStyle, bannerStyle, buttonStyle;

        private void Awake()
        {
            transform.SetPositionAndRotation(Vector3.zero, Quaternion.identity); // saha dünya merkezinde kurulur
            if (lineMaterial == null) lineMaterial = CreateLineMaterial();

            BuildPitch();
            BakeNavMesh(); // oyunculardan ÖNCE: NavMeshAgent eklenirken NavMesh hazır olmalı
            EnsureLight();

            BallController ball = CreateBall();
            Transform passer = CreatePlayer("Pasör", passerPosition, Quaternion.identity, Blue, false).transform;

            var receivers = new List<PassReceiver>();
            receivers.Add(passer.GetComponent<PassReceiver>());
            for (int i = 0; i < teammatePositions.Length; i++)
            {
                Quaternion face = Quaternion.LookRotation(Flat(passerPosition - teammatePositions[i]));
                receivers.Add(CreatePlayer("Arkadaş " + (i + 1), teammatePositions[i], face, Blue, false).GetComponent<PassReceiver>());
            }
            var enemies = new List<EnemyAI>();
            for (int i = 0; i < enemyPositions.Length; i++)
            {
                Quaternion face = Quaternion.LookRotation(Flat(passerPosition - enemyPositions[i]));
                enemies.Add(CreatePlayer("Rakip " + (i + 1), enemyPositions[i], face, Red, true).GetComponent<EnemyAI>());
            }

            Camera cam = SetupCamera();
            PassCameraController rig = cam.GetComponent<PassCameraController>();
            if (rig == null) rig = cam.gameObject.AddComponent<PassCameraController>();

            GoalFrame goal = BuildGoal();
            GoalkeeperAI keeper = CreateKeeper(goal);

            manager = gameObject.AddComponent<PasManager>();
            manager.Setup(ball, passer, cam, rig, CreatePassLine(),
                new Bounds(Vector3.zero, new Vector3(pitchSize.x, 20f, pitchSize.y)));
            manager.SetGoal(goal, keeper);
            for (int i = 0; i < receivers.Count; i++) manager.AddTeammate(receivers[i]);
            for (int i = 0; i < enemies.Count; i++) manager.AddEnemy(enemies[i]);
            manager.PassFinished += OnPassFinished;
        }

        private void OnDestroy()
        {
            if (manager != null) manager.PassFinished -= OnPassFinished;
            if (navMesh.valid) navMesh.Remove();
        }

        private void OnPassFinished(PassResult r)
        {
            if (r.isShot)
            {
                shots++;
                if (r.outcome == PassOutcome.Goal) goals++;
            }
            else
            {
                attempts++;
                if (r.Success) completed++;
            }
            banner = r.Describe();
            bannerColor = r.Success ? new Color(0.45f, 1f, 0.5f) : new Color(1f, 0.45f, 0.4f);
            bannerUntil = Time.unscaledTime + 1.6f;
        }

        // ─────────────────────────── Sahne kurulumu ───────────────────────────

        private void BuildPitch()
        {
            // Saha dışı (koyu çim) + saha
            // (Collider'sız: NavMesh kutu kaynağından üretilir, top da yerle fiziksel temas kullanmaz)
            Primitive(PrimitiveType.Plane, "Çevre", transform, new Vector3(0f, -0.01f, 0f),
                new Vector3((pitchSize.x + 16f) / 10f, 1f, (pitchSize.y + 16f) / 10f), GrassDark, true);
            Primitive(PrimitiveType.Plane, "Saha", transform, Vector3.zero,
                new Vector3(pitchSize.x / 10f, 1f, pitchSize.y / 10f), Grass, true);

            // Çizgiler: kenar, kale çizgileri, orta saha
            float hx = pitchSize.x / 2f, hz = pitchSize.y / 2f, w = 0.12f;
            Line(new Vector3(-hx, 0f, 0f), new Vector3(w, 0.02f, pitchSize.y));
            Line(new Vector3(hx, 0f, 0f), new Vector3(w, 0.02f, pitchSize.y));
            Line(new Vector3(0f, 0f, -hz), new Vector3(pitchSize.x, 0.02f, w));
            Line(new Vector3(0f, 0f, hz), new Vector3(pitchSize.x, 0.02f, w));
            Line(Vector3.zero, new Vector3(pitchSize.x, 0.02f, w));

            // Hücum edilen kalenin ceza sahası (40.32 × 16.5) ve kale alanı (18.32 × 5.5)
            BoxLines(hz, 40.32f, 16.5f, w);
            BoxLines(hz, 18.32f, 5.5f, w);

            // Orta yuvarlak
            var circle = new GameObject("Orta Yuvarlak").AddComponent<LineRenderer>();
            circle.transform.SetParent(transform, false);
            circle.sharedMaterial = lineMaterial;
            circle.useWorldSpace = true;
            circle.loop = true;
            circle.widthMultiplier = w;
            circle.alignment = LineAlignment.TransformZ;
            circle.transform.rotation = Quaternion.Euler(90f, 0f, 0f);
            circle.shadowCastingMode = ShadowCastingMode.Off;
            const int seg = 64;
            circle.positionCount = seg;
            for (int i = 0; i < seg; i++)
            {
                float a = i * Mathf.PI * 2f / seg;
                circle.SetPosition(i, new Vector3(Mathf.Cos(a) * 9.15f, 0.015f, Mathf.Sin(a) * 9.15f));
            }
        }

        /// <summary>Kale çizgisine (z = goalZ) dayalı dikdörtgen saha çizgileri.</summary>
        private void BoxLines(float goalZ, float width, float depth, float w)
        {
            float hw = width / 2f, zFront = goalZ - depth;
            Line(new Vector3(0f, 0f, zFront), new Vector3(width, 0.02f, w));
            Line(new Vector3(-hw, 0f, goalZ - depth / 2f), new Vector3(w, 0.02f, depth));
            Line(new Vector3(hw, 0f, goalZ - depth / 2f), new Vector3(w, 0.02f, depth));
        }

        /// <summary>
        /// Kale: GoalFrame (analitik direk/üst direk) + görsel direkler ve ağ çizgileri.
        /// Kale çizgisinin ortasında, sahaya (−z) bakar.
        /// </summary>
        private GoalFrame BuildGoal()
        {
            const float gw = 7.32f, gh = 2.44f, r = 0.06f, depth = 2f;
            var root = new GameObject("Kale");
            root.transform.SetParent(transform, false);
            root.transform.SetPositionAndRotation(new Vector3(0f, 0f, pitchSize.y / 2f), Quaternion.LookRotation(Vector3.back));
            GoalFrame goal = root.AddComponent<GoalFrame>();
            goal.Configure(gw, gh, true);

            // Direkler (Cylinder: yükseklik 2 birim → y ölçeği h/2) ve üst direk; yerel x = kalenin yanı
            float px = gw / 2f + r;
            Primitive(PrimitiveType.Cylinder, "Direk", root.transform, new Vector3(-px, gh / 2f + r / 2f, 0f), new Vector3(2 * r, (gh + r) / 2f, 2 * r), Color.white, true);
            Primitive(PrimitiveType.Cylinder, "Direk", root.transform, new Vector3(px, gh / 2f + r / 2f, 0f), new Vector3(2 * r, (gh + r) / 2f, 2 * r), Color.white, true);
            GameObject bar = Primitive(PrimitiveType.Cylinder, "Üst Direk", root.transform, new Vector3(0f, gh + r, 0f), new Vector3(2 * r, px + r, 2 * r), Color.white, true);
            bar.transform.localRotation = Quaternion.Euler(0f, 0f, 90f);

            // Ağ: arka yüz, tavan ve yanlar (zikzak çizgilerle tek LineRenderer'lar)
            var pts = new List<Vector3>();
            for (float x = -px; x <= px + 1e-3f; x += 0.5f) { pts.Add(new Vector3(x, 0f, -depth)); pts.Add(new Vector3(x, gh, -depth)); pts.Add(new Vector3(x, gh, 0f)); pts.Add(new Vector3(x, gh, -depth)); }
            NetLine(root.transform, pts);
            pts.Clear();
            for (float y = 0f; y <= gh + 1e-3f; y += 0.5f) { pts.Add(new Vector3(-px, y, 0f)); pts.Add(new Vector3(-px, y, -depth)); pts.Add(new Vector3(px, y, -depth)); pts.Add(new Vector3(px, y, 0f)); pts.Add(new Vector3(px, y, -depth)); pts.Add(new Vector3(-px, y, -depth)); }
            NetLine(root.transform, pts);
            return goal;
        }

        private void NetLine(Transform parent, List<Vector3> localPoints)
        {
            var lr = new GameObject("Ağ").AddComponent<LineRenderer>();
            lr.transform.SetParent(parent, false);
            lr.sharedMaterial = lineMaterial;
            lr.useWorldSpace = false;
            lr.widthMultiplier = 0.025f;
            lr.startColor = lr.endColor = new Color(1f, 1f, 1f, 0.55f);
            lr.shadowCastingMode = ShadowCastingMode.Off;
            lr.positionCount = localPoints.Count;
            lr.SetPositions(localPoints.ToArray());
        }

        /// <summary>Kaleci: kök yerde, gövde (kapsül + collider) çocuk; dalışta gövde yana yatar.</summary>
        private GoalkeeperAI CreateKeeper(GoalFrame goal)
        {
            var root = new GameObject("Kaleci");
            root.transform.SetParent(transform, false);
            root.transform.SetPositionAndRotation(goal.Center + goal.Normal * 0.5f, Quaternion.LookRotation(goal.Normal));
            GameObject body = Primitive(PrimitiveType.Capsule, "Gövde", root.transform, new Vector3(0f, 0.95f, 0f), new Vector3(0.85f, 0.95f, 0.85f), new Color(0.75f, 0.95f, 0.15f), false);
            Primitive(PrimitiveType.Cube, "Yön", body.transform, new Vector3(0f, 0.35f, 0.45f), new Vector3(0.35f, 0.15f, 0.3f), Color.white, true);
            Rigidbody rb = root.AddComponent<Rigidbody>();
            rb.isKinematic = true;
            rb.useGravity = false;
            GoalkeeperAI gk = root.AddComponent<GoalkeeperAI>();
            gk.Setup(goal, body.transform, keeperSkill);
            return gk;
        }

        private void Line(Vector3 center, Vector3 size)
        {
            Primitive(PrimitiveType.Cube, "Çizgi", transform, center + new Vector3(0f, 0.01f, 0f), size, Color.white, true);
        }

        /// <summary>
        /// Çalışma anında NavMesh: saha boyutunda tek bir kutu kaynağından üretilir (sahne bake etmeye gerek yok).
        /// Kendi sahnenizde bunun yerine Window > AI > Navigation (ya da NavMeshSurface) ile bake edin.
        /// </summary>
        private void BakeNavMesh()
        {
            var sources = new List<NavMeshBuildSource>(1);
            var src = new NavMeshBuildSource
            {
                shape = NavMeshBuildSourceShape.Box,
                size = new Vector3(pitchSize.x + 12f, 0.2f, pitchSize.y + 12f),
                transform = Matrix4x4.TRS(new Vector3(0f, -0.1f, 0f), Quaternion.identity, Vector3.one),
                area = 0,
            };
            sources.Add(src);
            var bounds = new Bounds(Vector3.zero, new Vector3(pitchSize.x + 20f, 6f, pitchSize.y + 20f));
            NavMeshData data = NavMeshBuilder.BuildNavMeshData(NavMesh.GetSettingsByID(0), sources, bounds, Vector3.zero, Quaternion.identity);
            if (data != null) navMesh = NavMesh.AddNavMeshData(data);
            else Debug.LogWarning("NavMesh oluşturulamadı; rakipler NavMesh'siz modda yürüyecek.");
        }

        private static void EnsureLight()
        {
#if UNITY_2022_2_OR_NEWER
            Light existing = FindFirstObjectByType<Light>();
#else
            Light existing = FindObjectOfType<Light>();
#endif
            if (existing != null) return;
            var light = new GameObject("Güneş").AddComponent<Light>();
            light.type = LightType.Directional;
            light.intensity = 1.1f;
            light.shadows = LightShadows.Soft;
            light.transform.rotation = Quaternion.Euler(50f, -30f, 0f);
        }

        private BallController CreateBall()
        {
            GameObject go = Primitive(PrimitiveType.Sphere, "Top", transform, new Vector3(0f, 0.11f, 0f), Vector3.one * 0.22f, Color.white, false);
            // Dönüş görünsün diye yüzeye siyah lekeler
            Vector3[] spots = { Vector3.forward, Vector3.back, Vector3.left, Vector3.right, Vector3.up, Vector3.down };
            for (int i = 0; i < spots.Length; i++)
            {
                Primitive(PrimitiveType.Sphere, "Leke", go.transform, spots[i] * 0.42f, Vector3.one * 0.32f, new Color(0.08f, 0.08f, 0.1f), true);
            }
            BallController ball = go.AddComponent<BallController>(); // Rigidbody'yi RequireComponent ekler

            TrailRenderer trail = go.AddComponent<TrailRenderer>();
            trail.sharedMaterial = lineMaterial;
            trail.time = 0.45f;
            trail.minVertexDistance = 0.1f;
            trail.widthMultiplier = 0.16f;
            trail.widthCurve = AnimationCurve.Linear(0f, 1f, 1f, 0f);
            trail.startColor = new Color(1f, 1f, 1f, 0.7f);
            trail.endColor = new Color(1f, 1f, 1f, 0f);
            trail.shadowCastingMode = ShadowCastingMode.Off;
            ball.SetVisuals(trail, go.transform);
            return ball;
        }

        /// <summary>
        /// Oyuncu: kök yerde (y = 0) boş nesne; gövde (kapsül + collider) çocuk. Böylece NavMeshAgent baseOffset gerektirmez.
        /// </summary>
        private GameObject CreatePlayer(string playerName, Vector3 position, Quaternion rotation, Color color, bool enemy)
        {
            var root = new GameObject(playerName);
            root.transform.SetParent(transform, false);
            // Konum/yön bileşenler eklenmeden ÖNCE: EnemyAI/PassReceiver dizilişi Awake'te kaydeder
            root.transform.SetPositionAndRotation(new Vector3(position.x, 0f, position.z), rotation);

            GameObject body = Primitive(PrimitiveType.Capsule, "Gövde", root.transform, new Vector3(0f, 0.9f, 0f), new Vector3(0.8f, 0.9f, 0.8f), color, false);
            // Burun: baktığı yön görünsün
            Primitive(PrimitiveType.Cube, "Yön", body.transform, new Vector3(0f, 0.35f, 0.45f), new Vector3(0.35f, 0.15f, 0.3f), Color.white, true);

            // Hareket eden collider'lar için kinematik Rigidbody (fizik motoru için en verimli kurulum)
            Rigidbody rb = root.AddComponent<Rigidbody>();
            rb.isKinematic = true;
            rb.useGravity = false;

            if (enemy)
            {
                NavMeshAgent agent = root.AddComponent<NavMeshAgent>();
                agent.radius = 0.4f;
                agent.height = 1.8f;
                agent.baseOffset = 0f;
                EnemyAI ai = root.AddComponent<EnemyAI>();
                ai.SetIndicator(body.GetComponent<Renderer>());
            }
            else
            {
                PassReceiver receiver = root.AddComponent<PassReceiver>();
                // Hedef halkası (ayak altında, collider'sız)
                GameObject ring = Primitive(PrimitiveType.Cylinder, "Hedef Halkası", root.transform, new Vector3(0f, 0.02f, 0f), new Vector3(1.8f, 0.01f, 1.8f), new Color(1f, 0.95f, 0.3f), true);
                Renderer rr = ring.GetComponent<Renderer>();
                rr.shadowCastingMode = ShadowCastingMode.Off;
                receiver.SetHighlight(rr);
            }
            return root;
        }

        private Camera SetupCamera()
        {
            Camera cam = Camera.main;
            if (cam == null)
            {
                var go = new GameObject("Main Camera");
                go.tag = "MainCamera";
                cam = go.AddComponent<Camera>();
            }
            cam.nearClipPlane = 0.1f;
            cam.farClipPlane = 400f;
            cam.clearFlags = CameraClearFlags.SolidColor;
            cam.backgroundColor = new Color(0.45f, 0.65f, 0.85f);
            return cam;
        }

        private LineRenderer CreatePassLine()
        {
            var lr = new GameObject("Pas Çizgisi").AddComponent<LineRenderer>();
            lr.transform.SetParent(transform, false);
            lr.sharedMaterial = lineMaterial;
            lr.useWorldSpace = true;
            lr.widthMultiplier = 0.26f;
            lr.widthCurve = AnimationCurve.Linear(0f, 1f, 1f, 0.5f);
            lr.numCapVertices = 4;
            lr.numCornerVertices = 2;
            lr.shadowCastingMode = ShadowCastingMode.Off;
            lr.receiveShadows = false;
            lr.positionCount = 0;
            lr.enabled = false;
            return lr;
        }

        private static Material CreateLineMaterial()
        {
            // Köşe renklerini (LineRenderer.startColor/endColor) destekleyen shader'lar, sırayla
            string[] names = { "Sprites/Default", "Universal Render Pipeline/Particles/Unlit", "Legacy Shaders/Particles/Alpha Blended", "Unlit/Color" };
            for (int i = 0; i < names.Length; i++)
            {
                Shader s = Shader.Find(names[i]);
                if (s != null) return new Material(s);
            }
            Debug.LogWarning("Çizgi shader'ı bulunamadı; Inspector'dan lineMaterial atayın.");
            return null;
        }

        private static Vector3 Flat(Vector3 v)
        {
            v.y = 0f;
            return v.sqrMagnitude > 1e-6f ? v : Vector3.forward;
        }

        /// <summary>Renkli, isteğe bağlı collider'sız primitive.</summary>
        private static GameObject Primitive(PrimitiveType type, string objName, Transform parent, Vector3 localPos, Vector3 scale, Color color, bool removeCollider)
        {
            GameObject go = GameObject.CreatePrimitive(type);
            go.name = objName;
            go.transform.SetParent(parent, false);
            go.transform.localPosition = localPos;
            go.transform.localScale = scale;
            if (removeCollider)
            {
                Collider c = go.GetComponent<Collider>();
                if (c != null) Destroy(c);
            }
            Renderer r = go.GetComponent<Renderer>();
            if (r != null) r.material.color = color; // URP Lit ve Standard'da [MainColor]
            return go;
        }

        // ─────────────────────────── Ekran yazıları (IMGUI) ───────────────────────────

        private void OnGUI()
        {
            if (manager == null) return;
            float scale = Mathf.Max(1f, Screen.height / 720f);
            GUI.matrix = Matrix4x4.Scale(new Vector3(scale, scale, 1f));
            float w = Screen.width / scale, h = Screen.height / scale;
            EnsureStyles();

            // Yönerge
            string hint;
            switch (manager.State)
            {
                case PassState.Idle: hint = "Pas moduna geçmek için ekrana dokun ya da SPACE'e bas."; break;
                case PassState.Aiming: hint = "Ağır çekim! Topa dokun, arkadaşına (istersen kavisli) çizgi çiz. Kaleye çizersen ŞUT!"; break;
                case PassState.Drawing: hint = manager.IsShotAimed
                        ? "Sarı = şut. Köşelere ve falsolu vur, kaleciyi şaşırt!"
                        : "Parmağını kaldırınca pas atılır. Yeşil = temiz, turuncu = rakip yolda. Acele et!"; break;
                case PassState.InFlight: hint = manager.IsShotAimed ? "Şut!" : "Pas yolda…"; break;
                default: hint = ""; break;
            }
            GUI.Box(new Rect(12f, 12f, Mathf.Min(w - 24f, 560f), 64f), hint + "\nİsabetli pas: " + completed + " / " + attempts + "   ·   Gol: " + goals + " / " + shots, boxStyle);

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
                GUI.Label(new Rect(bar.x, bar.y - 22f, bar.width, 20f), "RAKİP BASKISI", boxStyle);
            }

            // Sonuç
            if (!string.IsNullOrEmpty(banner) && Time.unscaledTime < bannerUntil)
            {
                bannerStyle.normal.textColor = bannerColor;
                GUI.Label(new Rect(0f, h * 0.32f, w, 60f), banner, bannerStyle);
            }

            // Düğmeler
            if (GUI.Button(new Rect(12f, h - 64f, 150f, 48f), "Pas Modu", buttonStyle)) manager.EnterPassMode();
            if (GUI.Button(new Rect(w - 162f, h - 64f, 150f, 48f), "Sıfırla", buttonStyle)) manager.ResetPlay();
        }

        private void EnsureStyles()
        {
            if (boxStyle != null) return;
            boxStyle = new GUIStyle(GUI.skin.box) { fontSize = 16, alignment = TextAnchor.MiddleLeft, wordWrap = true };
            boxStyle.normal.textColor = Color.white;
            bannerStyle = new GUIStyle(GUI.skin.label) { fontSize = 34, fontStyle = FontStyle.Bold, alignment = TextAnchor.MiddleCenter };
            buttonStyle = new GUIStyle(GUI.skin.button) { fontSize = 18 };
        }
    }
}

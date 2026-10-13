using System.Collections.Generic;
using FootballCareer.Passing.Levels;
using UnityEngine;
using UnityEngine.AI;
using UnityEngine.Rendering;

namespace FootballCareer.Passing.Demo
{
    /// <summary>
    /// Deneme sahnesini İLKEL ŞEKİLLERLE kodla kurar: saha ve çizgiler, kale ve ağ, NavMesh, ışık, top, kamera,
    /// pas çizgisi; bölüm dizilişlerini de (IFormationSpawner) kapsül oyuncularla üretir.
    /// Gerçek oyunda bunun yerine kendi sahnenizi + PrefabFormationSpawner kullanın.
    /// </summary>
    public sealed class PitchBuilder : IFormationSpawner
    {
        public static readonly Color Grass = new Color(0.20f, 0.55f, 0.24f);
        public static readonly Color GrassDark = new Color(0.15f, 0.42f, 0.18f);
        public static readonly Color Blue = new Color(0.20f, 0.45f, 0.95f);
        public static readonly Color Red = new Color(0.85f, 0.20f, 0.20f);
        public static readonly Color KeeperColor = new Color(0.75f, 0.95f, 0.15f);

        private readonly Transform root;
        private readonly Vector2 pitchSize;
        private readonly Material lineMaterial;
        private readonly List<GameObject> spawned = new List<GameObject>(16);
        private GoalFrame goal;

        public Material LineMaterial { get { return lineMaterial; } }
        public Vector2 PitchSize { get { return pitchSize; } }
        public GoalFrame Goal { get { return goal; } }
        public Bounds PitchBounds { get { return new Bounds(Vector3.zero, new Vector3(pitchSize.x, 20f, pitchSize.y)); } }

        public PitchBuilder(Transform parent, Material material, Vector2 size)
        {
            root = parent;
            pitchSize = size;
            lineMaterial = material != null ? material : CreateLineMaterial();
        }

        // ─────────────────────────── Saha ───────────────────────────

        public void BuildPitch()
        {
            // Collider'sız: NavMesh kutu kaynağından üretilir, top da yerle fiziksel temas kullanmaz
            Primitive(PrimitiveType.Plane, "Çevre", root, new Vector3(0f, -0.01f, 0f),
                new Vector3((pitchSize.x + 16f) / 10f, 1f, (pitchSize.y + 16f) / 10f), GrassDark, true);
            Primitive(PrimitiveType.Plane, "Saha", root, Vector3.zero,
                new Vector3(pitchSize.x / 10f, 1f, pitchSize.y / 10f), Grass, true);

            float hx = pitchSize.x / 2f, hz = pitchSize.y / 2f, w = 0.12f;
            Line(new Vector3(-hx, 0f, 0f), new Vector3(w, 0.02f, pitchSize.y));
            Line(new Vector3(hx, 0f, 0f), new Vector3(w, 0.02f, pitchSize.y));
            Line(new Vector3(0f, 0f, -hz), new Vector3(pitchSize.x, 0.02f, w));
            Line(new Vector3(0f, 0f, hz), new Vector3(pitchSize.x, 0.02f, w));
            Line(Vector3.zero, new Vector3(pitchSize.x, 0.02f, w));
            // Hücum edilen kalenin ceza sahası (40.32 × 16.5) ve kale alanı (18.32 × 5.5)
            BoxLines(hz, 40.32f, 16.5f, w);
            BoxLines(hz, 18.32f, 5.5f, w);

            var circle = new GameObject("Orta Yuvarlak").AddComponent<LineRenderer>();
            circle.transform.SetParent(root, false);
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

        private void BoxLines(float goalZ, float width, float depth, float w)
        {
            float hw = width / 2f, zFront = goalZ - depth;
            Line(new Vector3(0f, 0f, zFront), new Vector3(width, 0.02f, w));
            Line(new Vector3(-hw, 0f, goalZ - depth / 2f), new Vector3(w, 0.02f, depth));
            Line(new Vector3(hw, 0f, goalZ - depth / 2f), new Vector3(w, 0.02f, depth));
        }

        private void Line(Vector3 center, Vector3 size)
        {
            Primitive(PrimitiveType.Cube, "Çizgi", root, center + new Vector3(0f, 0.01f, 0f), size, Color.white, true);
        }

        /// <summary>
        /// Çalışma anında NavMesh: saha boyutunda tek bir kutu kaynağından üretilir (sahne bake etmeye gerek yok).
        /// Dönen örneği sahne kapanırken Remove() edin.
        /// </summary>
        public NavMeshDataInstance BakeNavMesh()
        {
            var sources = new List<NavMeshBuildSource>(1);
            sources.Add(new NavMeshBuildSource
            {
                shape = NavMeshBuildSourceShape.Box,
                size = new Vector3(pitchSize.x + 12f, 0.2f, pitchSize.y + 12f),
                transform = Matrix4x4.TRS(new Vector3(0f, -0.1f, 0f), Quaternion.identity, Vector3.one),
                area = 0,
            });
            var bounds = new Bounds(Vector3.zero, new Vector3(pitchSize.x + 20f, 6f, pitchSize.y + 20f));
            NavMeshData data = NavMeshBuilder.BuildNavMeshData(NavMesh.GetSettingsByID(0), sources, bounds, Vector3.zero, Quaternion.identity);
            if (data != null) return NavMesh.AddNavMeshData(data);
            Debug.LogWarning("NavMesh oluşturulamadı; rakipler NavMesh'siz modda yürüyecek.");
            return new NavMeshDataInstance();
        }

        public static void EnsureLight()
        {
#if UNITY_2022_2_OR_NEWER
            Light existing = Object.FindFirstObjectByType<Light>();
#else
            Light existing = Object.FindObjectOfType<Light>();
#endif
            if (existing != null) return;
            var light = new GameObject("Güneş").AddComponent<Light>();
            light.type = LightType.Directional;
            light.intensity = 1.1f;
            light.shadows = LightShadows.Soft;
            light.transform.rotation = Quaternion.Euler(50f, -30f, 0f);
        }

        // ─────────────────────────── Kale ───────────────────────────

        /// <summary>Hücum edilen kale (+z ucu): GoalFrame + görsel direkler ve ağ.</summary>
        public GoalFrame BuildGoal()
        {
            const float gw = 7.32f, gh = 2.44f, r = 0.06f, depth = 2f;
            var g = new GameObject("Kale");
            g.transform.SetParent(root, false);
            g.transform.SetPositionAndRotation(new Vector3(0f, 0f, pitchSize.y / 2f), Quaternion.LookRotation(Vector3.back));
            goal = g.AddComponent<GoalFrame>();
            goal.Configure(gw, gh, true);

            // Direkler (Cylinder: yükseklik 2 birim → y ölçeği h/2) ve üst direk; yerel x = kalenin yanı
            float px = gw / 2f + r;
            Primitive(PrimitiveType.Cylinder, "Direk", g.transform, new Vector3(-px, (gh + r) / 2f, 0f), new Vector3(2 * r, (gh + r) / 2f, 2 * r), Color.white, true);
            Primitive(PrimitiveType.Cylinder, "Direk", g.transform, new Vector3(px, (gh + r) / 2f, 0f), new Vector3(2 * r, (gh + r) / 2f, 2 * r), Color.white, true);
            GameObject bar = Primitive(PrimitiveType.Cylinder, "Üst Direk", g.transform, new Vector3(0f, gh + r, 0f), new Vector3(2 * r, px + r, 2 * r), Color.white, true);
            bar.transform.localRotation = Quaternion.Euler(0f, 0f, 90f);

            // Ağ: dikey teller (arka yüz + tavan) ve yatay teller (yanlar + arka); yön değiştirerek tek çizgi
            var pts = new List<Vector3>();
            int k = 0;
            for (float x = -px; x <= px + 1e-3f; x += 0.5f, k++)
            {
                if (k % 2 == 0) { pts.Add(new Vector3(x, 0f, -depth)); pts.Add(new Vector3(x, gh, -depth)); pts.Add(new Vector3(x, gh, 0f)); }
                else { pts.Add(new Vector3(x, gh, 0f)); pts.Add(new Vector3(x, gh, -depth)); pts.Add(new Vector3(x, 0f, -depth)); }
            }
            NetLine(g.transform, pts);
            pts.Clear();
            k = 0;
            for (float y = 0f; y <= gh + 1e-3f; y += 0.5f, k++)
            {
                if (k % 2 == 0) { pts.Add(new Vector3(-px, y, 0f)); pts.Add(new Vector3(-px, y, -depth)); pts.Add(new Vector3(px, y, -depth)); pts.Add(new Vector3(px, y, 0f)); }
                else { pts.Add(new Vector3(px, y, 0f)); pts.Add(new Vector3(px, y, -depth)); pts.Add(new Vector3(-px, y, -depth)); pts.Add(new Vector3(-px, y, 0f)); }
            }
            NetLine(g.transform, pts);
            return goal;
        }

        private void NetLine(Transform parent, List<Vector3> localPoints)
        {
            var lr = new GameObject("Ağ").AddComponent<LineRenderer>();
            lr.transform.SetParent(parent, false);
            lr.sharedMaterial = lineMaterial;
            lr.useWorldSpace = false;
            lr.widthMultiplier = 0.025f;
            lr.startColor = new Color(1f, 1f, 1f, 0.55f);
            lr.endColor = new Color(1f, 1f, 1f, 0.55f);
            lr.shadowCastingMode = ShadowCastingMode.Off;
            lr.positionCount = localPoints.Count;
            lr.SetPositions(localPoints.ToArray());
        }

        // ─────────────────────────── Top, kamera, çizgi ───────────────────────────

        public BallController CreateBall()
        {
            GameObject go = Primitive(PrimitiveType.Sphere, "Top", root, new Vector3(0f, 0.11f, 0f), Vector3.one * 0.22f, Color.white, false);
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

        public static Camera SetupCamera()
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

        public LineRenderer CreatePassLine()
        {
            var lr = new GameObject("Pas Çizgisi").AddComponent<LineRenderer>();
            lr.transform.SetParent(root, false);
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

        // ─────────────────────────── Diziliş (IFormationSpawner) ───────────────────────────

        public FormationHandles Spawn(PassLevel level)
        {
            Despawn();
            Vector3 goalPos = goal != null ? goal.Center : new Vector3(0f, 0f, pitchSize.y / 2f);
            var h = new FormationHandles
            {
                teammates = new List<PassReceiver>(level.teammates.Length + 1),
                enemies = new List<EnemyAI>(level.enemies.Length),
            };

            GameObject p = CreatePlayer("Pasör", level.passer, Face(level.passer, goalPos), Blue, false);
            h.passer = p.transform;
            h.teammates.Add(p.GetComponent<PassReceiver>());
            for (int i = 0; i < level.teammates.Length; i++)
            {
                Vector3 pos = level.teammates[i];
                h.teammates.Add(CreatePlayer("Arkadaş " + (i + 1), pos, Face(pos, level.passer), Blue, false).GetComponent<PassReceiver>());
            }
            for (int i = 0; i < level.enemies.Length; i++)
            {
                Vector3 pos = level.enemies[i];
                h.enemies.Add(CreatePlayer("Rakip " + (i + 1), pos, Face(pos, level.passer), Red, true).GetComponent<EnemyAI>());
            }
            if (level.hasKeeper && goal != null) h.keeper = CreateKeeper(goal, level.keeperSkill);
            return h;
        }

        public void Despawn()
        {
            for (int i = 0; i < spawned.Count; i++) if (spawned[i] != null) Object.Destroy(spawned[i]);
            spawned.Clear();
        }

        /// <summary>
        /// Oyuncu: kök yerde (y = 0) boş nesne; gövde (kapsül + collider) çocuk. Böylece NavMeshAgent baseOffset gerektirmez.
        /// </summary>
        public GameObject CreatePlayer(string playerName, Vector3 position, Quaternion rotation, Color color, bool enemy)
        {
            var go = new GameObject(playerName);
            go.transform.SetParent(root, false);
            // Konum/yön bileşenler eklenmeden ÖNCE: EnemyAI/PassReceiver dizilişi Awake'te kaydeder
            go.transform.SetPositionAndRotation(new Vector3(position.x, 0f, position.z), rotation);
            spawned.Add(go);

            GameObject body = Primitive(PrimitiveType.Capsule, "Gövde", go.transform, new Vector3(0f, 0.9f, 0f), new Vector3(0.8f, 0.9f, 0.8f), color, false);
            Primitive(PrimitiveType.Cube, "Yön", body.transform, new Vector3(0f, 0.35f, 0.45f), new Vector3(0.35f, 0.15f, 0.3f), Color.white, true);

            // Hareket eden collider'lar için kinematik Rigidbody (fizik motoru için en verimli kurulum)
            Rigidbody rb = go.AddComponent<Rigidbody>();
            rb.isKinematic = true;
            rb.useGravity = false;

            if (enemy)
            {
                NavMeshAgent agent = go.AddComponent<NavMeshAgent>();
                agent.radius = 0.4f;
                agent.height = 1.8f;
                agent.baseOffset = 0f;
                EnemyAI ai = go.AddComponent<EnemyAI>();
                ai.SetIndicator(body.GetComponent<Renderer>());
            }
            else
            {
                PassReceiver receiver = go.AddComponent<PassReceiver>();
                GameObject ring = Primitive(PrimitiveType.Cylinder, "Hedef Halkası", go.transform, new Vector3(0f, 0.02f, 0f), new Vector3(1.8f, 0.01f, 1.8f), new Color(1f, 0.95f, 0.3f), true);
                Renderer rr = ring.GetComponent<Renderer>();
                rr.shadowCastingMode = ShadowCastingMode.Off;
                receiver.SetHighlight(rr);
            }
            return go;
        }

        /// <summary>Kaleci: kök yerde, gövde (kapsül + collider) çocuk; dalışta gövde yana yatar.</summary>
        public GoalkeeperAI CreateKeeper(GoalFrame protectedGoal, float skill)
        {
            var go = new GameObject("Kaleci");
            go.transform.SetParent(root, false);
            go.transform.SetPositionAndRotation(protectedGoal.Center + protectedGoal.Normal * 0.5f, Quaternion.LookRotation(protectedGoal.Normal));
            spawned.Add(go);
            GameObject body = Primitive(PrimitiveType.Capsule, "Gövde", go.transform, new Vector3(0f, 0.95f, 0f), new Vector3(0.85f, 0.95f, 0.85f), KeeperColor, false);
            Primitive(PrimitiveType.Cube, "Yön", body.transform, new Vector3(0f, 0.35f, 0.45f), new Vector3(0.35f, 0.15f, 0.3f), Color.white, true);
            Rigidbody rb = go.AddComponent<Rigidbody>();
            rb.isKinematic = true;
            rb.useGravity = false;
            GoalkeeperAI gk = go.AddComponent<GoalkeeperAI>();
            gk.Setup(protectedGoal, body.transform, skill);
            return gk;
        }

        // ─────────────────────────── Yardımcılar ───────────────────────────

        public static Material CreateLineMaterial()
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

        private static Quaternion Face(Vector3 from, Vector3 to)
        {
            Vector3 d = to - from;
            d.y = 0f;
            return d.sqrMagnitude > 1e-4f ? Quaternion.LookRotation(d) : Quaternion.identity;
        }

        /// <summary>Renkli, isteğe bağlı collider'sız primitive.</summary>
        public static GameObject Primitive(PrimitiveType type, string objName, Transform parent, Vector3 localPos, Vector3 scale, Color color, bool removeCollider)
        {
            GameObject go = GameObject.CreatePrimitive(type);
            go.name = objName;
            go.transform.SetParent(parent, false);
            go.transform.localPosition = localPos;
            go.transform.localScale = scale;
            if (removeCollider)
            {
                Collider c = go.GetComponent<Collider>();
                if (c != null) Object.Destroy(c);
            }
            Renderer r = go.GetComponent<Renderer>();
            if (r != null) r.material.color = color; // URP Lit ve Standard'da [MainColor]
            return go;
        }
    }
}

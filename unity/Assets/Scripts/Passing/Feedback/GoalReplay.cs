using System;
using System.Collections.Generic;
using FootballCareer.Core;
using UnityEngine;
using UnityEngine.AI;

namespace FootballCareer.Passing.Feedback
{
    /// <summary>
    /// GOL TEKRARI — her vuruşta top ve oyuncuların konumlarını kaydeder; gol olursa kısa bir "ağlar sallansın"
    /// süresinden sonra oyunu dondurur (timeScale 0) ve son vuruşu yandan, AĞIR ÇEKİMDE yeniden oynatır.
    /// Ekrana dokunmak tekrarı geçer.
    ///
    ///  • Kayıt: LateUpdate'te (çizilen pozlar), halka tampon, bellek ayırmadan.
    ///  • Oynatma: kayıtlı kareler arasında doğrusal ara değer (dönüşte Slerp).
    ///  • NavMeshAgent'lar oynatma boyunca kapatılır (konumu ezmesinler), sonra son konumda açılır.
    ///  • PasManager'ın sonuç ekranı tekrar bitene kadar tutulur (HoldResolve) → diziliş erken sıfırlanmaz.
    /// </summary>
    [DefaultExecutionOrder(-10)]
    [DisallowMultipleComponent]
    public class GoalReplay : MonoBehaviour
    {
        [SerializeField] private PasManager manager;
        [SerializeField] private PassCameraController cameraRig;
        [SerializeField] private bool replayGoals = true;
        [Tooltip("Golden sonra tekrar başlamadan önce akan süre (gerçek saniye).")]
        [SerializeField] private float postRoll = 0.9f;
        [Tooltip("Oynatma hızı (0.4 = %40 ağır çekim).")]
        [SerializeField, Range(0.1f, 1f)] private float replaySpeed = 0.4f;
        [Tooltip("En fazla kaydedilen süre (saniye).")]
        [SerializeField] private float maxSeconds = 6f;
        [Tooltip("Tekrar kamerasının kaleye göre konumu: yan (m), saha içine (m), yükseklik (m).")]
        [SerializeField] private Vector3 cameraOffset = new Vector3(10f, 2.4f, 9f);

        public event Action ReplayStarted;
        public event Action ReplayEnded;

        public bool IsReplaying { get { return replaying; } }
        public bool IsPending { get { return pending; } }

        private const int FrameRate = 60;

        private readonly List<Transform> targets = new List<Transform>(24);
        private readonly List<NavMeshAgent> agents = new List<NavMeshAgent>(16);
        private readonly List<Rigidbody> bodies = new List<Rigidbody>(4);
        private readonly List<RigidbodyInterpolation> bodyModes = new List<RigidbodyInterpolation>(4);
        private Vector3[] positions = new Vector3[0];
        private Quaternion[] rotations = new Quaternion[0];
        private float[] times = new float[0];
        private int frameCount;
        private int maxFrames;
        private bool recording, pending, replaying, holding;
        private float recordStart, pendingAt, replayClock, savedTimeScale = 1f;

        private void Awake()
        {
            if (manager == null) manager = GetComponent<PasManager>();
            maxFrames = Mathf.CeilToInt(maxSeconds * FrameRate);
        }

        private void OnEnable() { Bind(true); }

        private void OnDisable()
        {
            Bind(false);
            if (replaying) EndReplay();
        }

        public void Setup(PasManager passManager, PassCameraController rig)
        {
            Bind(false);
            manager = passManager;
            cameraRig = rig;
            if (isActiveAndEnabled) Bind(true);
        }

        private void Bind(bool on)
        {
            if (manager == null) return;
            if (on)
            {
                manager.Launched += OnLaunched;
                manager.PassFinished += OnFinished;
            }
            else
            {
                manager.Launched -= OnLaunched;
                manager.PassFinished -= OnFinished;
            }
        }

        // ─────────────────────────── Kayıt ───────────────────────────

        private void OnLaunched(bool isShot)
        {
            if (replaying) return;
            CollectTargets();
            int needed = maxFrames * targets.Count;
            if (positions.Length < needed)
            {
                positions = new Vector3[needed];
                rotations = new Quaternion[needed];
            }
            if (times.Length < maxFrames) times = new float[maxFrames];
            frameCount = 0;
            recordStart = Time.time;
            recording = true;
            pending = false;
        }

        private void CollectTargets()
        {
            targets.Clear();
            if (manager.Ball != null) targets.Add(manager.Ball.transform);
            IList<PassReceiver> mates = manager.Teammates;
            for (int i = 0; i < mates.Count; i++) if (mates[i] != null) targets.Add(mates[i].transform);
            IList<EnemyAI> foes = manager.Enemies;
            for (int i = 0; i < foes.Count; i++) if (foes[i] != null) targets.Add(foes[i].transform);
            GoalkeeperAI k = manager.Keeper;
            if (k != null)
            {
                targets.Add(k.transform);
                if (k.Body != null) targets.Add(k.Body); // plonjon pozu
            }
        }

        private void LateUpdate()
        {
            if (!recording) return;
            if (frameCount >= maxFrames)
            {
                // Halka tampon yerine basit kaydırma: en eski yarıyı at (nadiren olur; uzun yuvarlanan toplar)
                int half = maxFrames / 2, n = targets.Count;
                Array.Copy(times, half, times, 0, maxFrames - half);
                Array.Copy(positions, half * n, positions, 0, (maxFrames - half) * n);
                Array.Copy(rotations, half * n, rotations, 0, (maxFrames - half) * n);
                frameCount = maxFrames - half;
            }
            float t = Time.time - recordStart;
            if (frameCount > 0 && t - times[frameCount - 1] < 1f / FrameRate) return;
            times[frameCount] = t;
            int b = frameCount * targets.Count;
            for (int i = 0; i < targets.Count; i++)
            {
                Transform tr = targets[i];
                if (tr == null) continue;
                positions[b + i] = tr.position;
                rotations[b + i] = tr.rotation;
            }
            frameCount++;
        }

        private void OnFinished(PassResult r)
        {
            if (!recording) return;
            if (replayGoals && r.outcome == PassOutcome.Goal && frameCount > 2)
            {
                pending = true;
                pendingAt = Time.unscaledTime + postRoll; // ağlar sallansın, kayıt sürsün
                manager.HoldResolve();
                holding = true;
            }
            else recording = false;
        }

        // ─────────────────────────── Oynatma ───────────────────────────

        private void Update()
        {
            if (pending && Time.unscaledTime >= pendingAt) StartReplay();
            if (!replaying) return;

            replayClock += Time.unscaledDeltaTime * replaySpeed;
            float end = times[frameCount - 1];
            Vector2 tap;
            if (replayClock >= end || InputCompat.PointerDown(out tap) || InputCompat.ActionKeyDown())
            {
                EndReplay();
                return;
            }
            ApplyAt(replayClock);
        }

        private void StartReplay()
        {
            pending = false;
            recording = false;
            replaying = true;
            replayClock = 0f;
            savedTimeScale = Time.timeScale > 0f ? Time.timeScale : 1f;
            Time.timeScale = 0f;

            // Ajanlar ve Rigidbody ara değerlemesi konumu ezmesin
            agents.Clear();
            bodies.Clear();
            bodyModes.Clear();
            for (int i = 0; i < targets.Count; i++)
            {
                if (targets[i] == null) continue;
                NavMeshAgent a = targets[i].GetComponent<NavMeshAgent>();
                if (a != null && a.enabled)
                {
                    a.enabled = false;
                    agents.Add(a);
                }
                Rigidbody rb = targets[i].GetComponent<Rigidbody>();
                if (rb != null && rb.interpolation != RigidbodyInterpolation.None)
                {
                    bodies.Add(rb);
                    bodyModes.Add(rb.interpolation);
                    rb.interpolation = RigidbodyInterpolation.None;
                }
            }

            ApplyAt(0f);
            if (manager.Ball != null) manager.Ball.ClearTrail();
            if (cameraRig != null && manager.TargetGoal != null && manager.Ball != null)
            {
                GoalFrame g = manager.TargetGoal;
                Vector3 pos = g.Center + g.Lateral * cameraOffset.x + g.Normal * cameraOffset.z + Vector3.up * cameraOffset.y;
                cameraRig.SetReplay(pos, manager.Ball.transform);
                cameraRig.Snap(); // ani geçiş (televizyon kesmesi)
            }
            if (ReplayStarted != null) ReplayStarted();
        }

        private void EndReplay()
        {
            replaying = false;
            if (frameCount > 0) ApplyAt(times[frameCount - 1]); // son (gerçek) konumlar
            for (int i = 0; i < agents.Count; i++)
            {
                if (agents[i] == null) continue;
                agents[i].enabled = true;
                agents[i].Warp(agents[i].transform.position);
            }
            agents.Clear();
            for (int i = 0; i < bodies.Count; i++)
            {
                if (bodies[i] == null) continue;
                bodies[i].position = bodies[i].transform.position;
                bodies[i].interpolation = bodyModes[i];
            }
            bodies.Clear();
            bodyModes.Clear();
            if (manager != null && manager.Ball != null) manager.Ball.ClearTrail();
            Time.timeScale = savedTimeScale;
            if (cameraRig != null && manager != null && manager.Ball != null) cameraRig.SetDefault(manager.Ball.transform);
            if (holding && manager != null) manager.ReleaseResolve();
            holding = false;
            if (ReplayEnded != null) ReplayEnded();
        }

        /// <summary>Kayıtlı iki kare arasında ara değerle pozları uygular.</summary>
        private void ApplyAt(float t)
        {
            if (frameCount == 0) return;
            int hi = 1;
            while (hi < frameCount && times[hi] < t) hi++;
            if (hi >= frameCount) hi = frameCount - 1;
            int lo = Mathf.Max(0, hi - 1);
            float span = times[hi] - times[lo];
            float k = span > 1e-5f ? Mathf.Clamp01((t - times[lo]) / span) : 1f;
            int n = targets.Count, bl = lo * n, bh = hi * n;
            for (int i = 0; i < n; i++)
            {
                Transform tr = targets[i];
                if (tr == null) continue;
                tr.SetPositionAndRotation(Vector3.Lerp(positions[bl + i], positions[bh + i], k),
                                          Quaternion.Slerp(rotations[bl + i], rotations[bh + i], k));
            }
        }
    }
}

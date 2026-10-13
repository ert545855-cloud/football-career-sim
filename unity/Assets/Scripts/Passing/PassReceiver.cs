using UnityEngine;
using UnityEngine.AI;

namespace FootballCareer.Passing
{
    /// <summary>
    /// TAKIM ARKADAŞI — pas alabilen oyuncu. Pası atan oyuncunun üzerinde de bulunur
    /// (başarılı pastan sonra topu alan arkadaş yeni pasör olur).
    ///
    ///  • Çizim sırasında hedeflenince halkası yanar (SetTargeted).
    ///  • Pas atılınca topun ineceği noktaya doğru koşar (en fazla runRange metre) → ara pası karşılar.
    ///  • NavMeshAgent varsa onunla, yoksa doğrudan yürür (NavMesh şart değil).
    /// </summary>
    [DisallowMultipleComponent]
    public class PassReceiver : MonoBehaviour
    {
        [Header("Top")]
        [Tooltip("Top ayaktayken oyuncuya göre konumu (0,0,0.45 = ayağının önü).")]
        [SerializeField] private Vector3 ballOffset = new Vector3(0f, 0f, 0.45f);

        [Header("Pası karşılama")]
        [Tooltip("Pas atılınca inişe doğru en fazla bu kadar koşar (metre).")]
        [SerializeField] private float runRange = 7f;
        [Tooltip("Koşu hızı (m/sn).")]
        [SerializeField] private float runSpeed = 6f;

        [Header("Görsel")]
        [Tooltip("Hedeflendiğinde yanan işaret (ör. ayağının altında halka). İsteğe bağlı.")]
        [SerializeField] private Renderer highlight;
        [Tooltip("Hedef halkasının nabız hızı.")]
        [SerializeField] private float pulseSpeed = 9f;

        /// <summary>Top ayağındayken oyuncuya göre konumu.</summary>
        public Vector3 BallOffset { get { return ballOffset; } }
        /// <summary>Başlangıç (diziliş) konumu.</summary>
        public Vector3 HomePosition { get { return homePosition; } }
        public bool IsTargeted { get { return targeted; } }
        public bool IsRunning { get { return running; } }
        public float RunRange { get { return runRange; } }

        private NavMeshAgent agent;
        private Vector3 homePosition;
        private Quaternion homeRotation;
        private Vector3 runTarget;
        private bool running;
        private bool targeted;
        private Vector3 highlightScale = Vector3.one;

        private void Awake()
        {
            agent = GetComponent<NavMeshAgent>();
            homePosition = transform.position;
            homeRotation = transform.rotation;
            if (highlight != null)
            {
                highlightScale = highlight.transform.localScale;
                highlight.enabled = false;
            }
        }

        /// <summary>Kodla kurulum için: hedef işaretini atar.</summary>
        public void SetHighlight(Renderer marker)
        {
            highlight = marker;
            if (highlight != null)
            {
                highlightScale = highlight.transform.localScale;
                highlight.enabled = targeted;
            }
        }

        /// <summary>Diziliş konumunu şimdiki konum yapar (oyun içinde oyuncular yer değiştirdiyse).</summary>
        public void CaptureHome()
        {
            homePosition = transform.position;
            homeRotation = transform.rotation;
        }

        /// <summary>Çizilen pas bu oyuncuyu hedefliyor mu? (halkayı yakar/söndürür)</summary>
        public void SetTargeted(bool on)
        {
            if (targeted == on) return;
            targeted = on;
            if (highlight != null)
            {
                highlight.enabled = on;
                highlight.transform.localScale = highlightScale;
            }
        }

        /// <summary>Pas atıldı: topun ineceği noktaya doğru koş (runRange ile sınırlı).</summary>
        public void OnPassLaunched(Vector3 landing)
        {
            Vector3 to = landing - transform.position;
            to.y = 0f;
            float d = to.magnitude;
            if (d < 0.05f) return;
            runTarget = transform.position + to * (Mathf.Min(d, runRange) / d);
            runTarget.y = transform.position.y;
            running = true;
            if (UseAgent)
            {
                agent.speed = runSpeed;
                agent.SetDestination(runTarget);
            }
        }

        /// <summary>Koşuyu bırak (top alındı / pas bitti).</summary>
        public void StopRun()
        {
            running = false;
            if (UseAgent) agent.ResetPath();
        }

        /// <summary>Yüzünü bir noktaya çevirir (yatay).</summary>
        public void FaceTowards(Vector3 point)
        {
            Vector3 d = point - transform.position;
            d.y = 0f;
            if (d.sqrMagnitude > 1e-4f) transform.rotation = Quaternion.LookRotation(d);
        }

        /// <summary>Diziliş konumuna ışınla.</summary>
        public void ResetHome()
        {
            StopRun();
            SetTargeted(false);
            if (UseAgent) agent.Warp(homePosition);
            else transform.position = homePosition;
            transform.rotation = homeRotation;
        }

        private bool UseAgent { get { return agent != null && agent.enabled && agent.isOnNavMesh; } }

        private void Update()
        {
            // Hedef halkası: gerçek zamanlı nabız (ağır çekimde de canlı görünsün)
            if (targeted && highlight != null)
            {
                float k = 1f + 0.1f * Mathf.Sin(Time.unscaledTime * pulseSpeed);
                highlight.transform.localScale = highlightScale * k;
            }

            if (!running || UseAgent)
            {
                if (running && !agent.pathPending && agent.remainingDistance <= 0.1f) running = false;
                return;
            }
            // NavMesh'siz koşu: oyun zamanıyla (ağır çekimde yavaş)
            Vector3 pos = transform.position;
            Vector3 next = Vector3.MoveTowards(pos, runTarget, runSpeed * Time.deltaTime);
            Vector3 dir = next - pos;
            dir.y = 0f;
            transform.position = next;
            if (dir.sqrMagnitude > 1e-6f) transform.rotation = Quaternion.LookRotation(dir);
            if ((next - runTarget).sqrMagnitude < 0.0025f) running = false;
        }

        private void OnDrawGizmosSelected()
        {
            Gizmos.color = new Color(0.3f, 0.6f, 1f, 0.5f);
            Gizmos.DrawWireSphere(transform.position, runRange);
        }
    }
}

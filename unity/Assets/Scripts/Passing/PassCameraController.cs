using UnityEngine;

namespace FootballCareer.Passing
{
    /// <summary>
    /// PAS KAMERASI — üç mod arasında yumuşak geçiş yapar:
    ///  • Default : yayın kamerası (topun üstünden, geniş açı).
    ///  • Aim     : pas modu — oyuncunun ARKASINA geçer (3. şahıs), pas atılacak bölgeye bakar.
    ///  • Follow  : pas atıldı — topu arkasından, uçuş yönüne bakarak izler (falsoyu gösterir).
    ///
    /// Tüm yumuşatma GERÇEK zamanla (unscaledDeltaTime) yapılır: zaman 0.15'e indiğinde kamera
    /// ağır çekime girmez, oyuncunun arkasına akıcı şekilde süzülür.
    /// Kameranın kendisine (ya da bir "rig" kökü) eklenir.
    /// </summary>
    [DisallowMultipleComponent]
    public class PassCameraController : MonoBehaviour
    {
        public enum Mode { Default, Aim, Follow }

        [Tooltip("FOV'u değiştirilecek kamera (boşsa bu nesnedeki ya da ana kamera).")]
        [SerializeField] private Camera cam;
        [Tooltip("Varsayılan modda izlenecek hedef (genelde top).")]
        [SerializeField] private Transform defaultTarget;

        [Header("Yayın kamerası (Default)")]
        [SerializeField] private Vector3 defaultOffset = new Vector3(0f, 16f, -13f);
        [SerializeField] private float defaultFov = 50f;

        [Header("Pas modu — oyuncunun arkası (Aim)")]
        [Tooltip("Oyuncunun ne kadar arkasında durur (metre).")]
        [SerializeField] private float aimDistance = 7f;
        [Tooltip("Yerden yükseklik (metre). Daha yüksek = pas alanı daha net görünür.")]
        [SerializeField] private float aimHeight = 4.5f;
        [Tooltip("Oyuncunun kaç metre önüne bakar.")]
        [SerializeField] private float aimLookAhead = 14f;
        [SerializeField] private float aimFov = 58f;

        [Header("Top takibi (Follow)")]
        [SerializeField] private float followDistance = 8f;
        [SerializeField] private float followHeight = 4.5f;
        [SerializeField] private float followLookAhead = 6f;
        [SerializeField] private float followFov = 55f;

        [Header("Yumuşatma (gerçek zaman)")]
        [SerializeField] private float smoothTime = 0.28f;
        [SerializeField] private float rotationSharpness = 8f;
        [SerializeField] private float fovSharpness = 6f;
        [Tooltip("Bu kadar yakınsa kamera 'yerine oturdu' sayılır (metre / derece).")]
        [SerializeField] private float settleDistance = 0.2f;
        [SerializeField] private float settleAngle = 3f;

        public Mode CurrentMode { get { return mode; } }
        /// <summary>Kamera hedef konumuna oturdu mu? (PasManager çizime izin vermeden önce bakar.)</summary>
        public bool IsSettled { get { return settled; } }

        private Mode mode = Mode.Default;
        private Transform focus;
        private Vector3 aimDir = Vector3.forward;
        private BallController followBall;
        private Vector3 followDir = Vector3.forward;
        private Vector3 velocity;
        private bool settled;

        private void Awake()
        {
            if (cam == null) cam = GetComponent<Camera>();
            if (cam == null) cam = Camera.main;
        }

        // ─────────────────────────── API ───────────────────────────

        /// <summary>Yayın kamerasına dön.</summary>
        public void SetDefault(Transform target)
        {
            if (target != null) defaultTarget = target;
            mode = Mode.Default;
            settled = false;
        }

        /// <summary>Pas modu: oyuncunun arkasına geç, direction yönüne bak.</summary>
        public void SetAim(Transform passer, Vector3 direction)
        {
            focus = passer;
            direction.y = 0f;
            aimDir = direction.sqrMagnitude > 1e-6f ? direction.normalized : Flat(passer.forward);
            mode = Mode.Aim;
            settled = false;
        }

        /// <summary>Pas atıldı: topu uçuş yönünün arkasından izle.</summary>
        public void SetFollow(BallController ball)
        {
            followBall = ball;
            followDir = aimDir;
            mode = Mode.Follow;
            settled = false;
        }

        /// <summary>Geçiş yapmadan hedef konuma ışınla (sahne başlangıcı / sıfırlama).</summary>
        public void Snap()
        {
            Vector3 pos, look;
            float fov;
            if (!Desired(out pos, out look, out fov)) return;
            transform.position = pos;
            transform.rotation = LookRotation(look - pos);
            if (cam != null) cam.fieldOfView = fov;
            velocity = Vector3.zero;
            settled = true;
        }

        // ─────────────────────────── Döngü ───────────────────────────

        private void LateUpdate()
        {
            float dt = Time.unscaledDeltaTime;
            if (dt <= 0f) return;
            Vector3 pos, look;
            float fov;
            if (!Desired(out pos, out look, out fov)) return;

            transform.position = Vector3.SmoothDamp(transform.position, pos, ref velocity, smoothTime, Mathf.Infinity, dt);
            // Bakış, kameranın ŞİMDİKİ konumundan hesaplanır → geçiş sırasında da hedef kadrajda kalır
            Quaternion want = LookRotation(look - transform.position);
            transform.rotation = Quaternion.Slerp(transform.rotation, want, 1f - Mathf.Exp(-rotationSharpness * dt));
            if (cam != null) cam.fieldOfView = Mathf.Lerp(cam.fieldOfView, fov, 1f - Mathf.Exp(-fovSharpness * dt));

            settled = (transform.position - pos).sqrMagnitude < settleDistance * settleDistance
                      && Quaternion.Angle(transform.rotation, want) < settleAngle;
        }

        /// <summary>Moda göre hedef konum, bakış noktası ve FOV.</summary>
        private bool Desired(out Vector3 pos, out Vector3 look, out float fov)
        {
            switch (mode)
            {
                case Mode.Aim:
                    if (focus == null) break;
                    Vector3 f = focus.position;
                    f.y = 0f;
                    pos = f - aimDir * aimDistance + Vector3.up * aimHeight;
                    look = f + aimDir * aimLookAhead;
                    fov = aimFov;
                    return true;

                case Mode.Follow:
                    if (followBall == null) break;
                    Vector3 v = followBall.Velocity;
                    v.y = 0f;
                    // Hızlı uçuşta yönü topun hızından al (falsoyla döner); top yavaşlayınca son yönü koru
                    if (v.sqrMagnitude > 1f) followDir = Vector3.Slerp(followDir, v.normalized, 1f - Mathf.Exp(-6f * Time.unscaledDeltaTime));
                    Vector3 b = followBall.transform.position;
                    pos = new Vector3(b.x, 0f, b.z) - followDir * followDistance + Vector3.up * followHeight;
                    look = b + followDir * followLookAhead;
                    fov = followFov;
                    return true;
            }

            if (defaultTarget != null)
            {
                pos = defaultTarget.position + defaultOffset;
                look = defaultTarget.position;
                fov = defaultFov;
                return true;
            }
            pos = transform.position;
            look = transform.position + transform.forward;
            fov = cam != null ? cam.fieldOfView : defaultFov;
            return false;
        }

        private static Quaternion LookRotation(Vector3 dir)
        {
            return dir.sqrMagnitude > 1e-6f ? Quaternion.LookRotation(dir) : Quaternion.identity;
        }

        private static Vector3 Flat(Vector3 v)
        {
            v.y = 0f;
            return v.sqrMagnitude > 1e-6f ? v.normalized : Vector3.forward;
        }
    }
}

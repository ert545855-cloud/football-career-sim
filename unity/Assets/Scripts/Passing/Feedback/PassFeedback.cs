using FootballCareer.Core;
using UnityEngine;

namespace FootballCareer.Passing.Feedback
{
    /// <summary>
    /// HİS — pas ve şutun ELDE, KULAKTA ve GÖZDE hissedilmesi:
    ///  • Titreşim (Haptics): pas modu tıkı, çizime başlama, vuruş (pas orta / şut sert), pas ulaştı (çift tık),
    ///    GOL (ritmik uzun titreşim), kurtarış, direk, başarısız.
    ///  • Ses: vuruş, top kontrolü, ağlar + tribün coşkusu, direk "çın"ı, tribün iç çekişi. Klip verilmezse
    ///    ProceduralSfx ile üretilir (dosyasız çalışır).
    ///  • Kamera sarsıntısı: şutta hafif, golde güçlü, direkte keskin.
    /// PasManager'ın yanına ekleyin; referanslar boşsa aynı nesnede / sahnede aranır.
    /// </summary>
    [DisallowMultipleComponent]
    public class PassFeedback : MonoBehaviour
    {
        [SerializeField] private PasManager manager;
        [SerializeField] private PassCameraController cameraRig;

        [Header("Titreşim")]
        [SerializeField] private bool haptics = true;

        [Header("Ses (boş olanlar kodla üretilir)")]
        [SerializeField] private AudioSource source;
        [SerializeField] private AudioClip passKick;
        [SerializeField] private AudioClip shotKick;
        [SerializeField] private AudioClip control;
        [SerializeField] private AudioClip net;
        [SerializeField] private AudioClip cheer;
        [SerializeField] private AudioClip groan;
        [SerializeField] private AudioClip post;
        [SerializeField, Range(0f, 1f)] private float volume = 0.9f;
        [Tooltip("Tribün sesleri (coşku / iç çekiş) için ayrı çarpan.")]
        [SerializeField, Range(0f, 1f)] private float crowdVolume = 0.7f;
        [SerializeField] private bool generateMissingClips = true;

        [Header("Kamera sarsıntısı (metre)")]
        [SerializeField] private float shotShake = 0.05f;
        [SerializeField] private float goalShake = 0.28f;
        [SerializeField] private float postShake = 0.2f;
        [SerializeField] private float saveShake = 0.1f;

        public bool HapticsOn { get { return haptics && Haptics.Enabled; } }

        private void Awake()
        {
            if (manager == null) manager = GetComponent<PasManager>();
            if (source == null)
            {
                source = gameObject.AddComponent<AudioSource>();
                source.playOnAwake = false;
                source.spatialBlend = 0f;
            }
            if (generateMissingClips)
            {
                if (passKick == null) passKick = ProceduralSfx.Get(ProceduralSfx.Kind.PassKick);
                if (shotKick == null) shotKick = ProceduralSfx.Get(ProceduralSfx.Kind.ShotKick);
                if (control == null) control = ProceduralSfx.Get(ProceduralSfx.Kind.Thud);
                if (net == null) net = ProceduralSfx.Get(ProceduralSfx.Kind.Net);
                if (cheer == null) cheer = ProceduralSfx.Get(ProceduralSfx.Kind.Cheer);
                if (groan == null) groan = ProceduralSfx.Get(ProceduralSfx.Kind.Groan);
                if (post == null) post = ProceduralSfx.Get(ProceduralSfx.Kind.Post);
            }
        }

        private void OnEnable() { Bind(true); }
        private void OnDisable() { Bind(false); }

        /// <summary>Kodla kurulum için.</summary>
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
                manager.onPassModeEntered.AddListener(OnModeEntered);
                manager.onDrawStarted.AddListener(OnDrawStarted);
            }
            else
            {
                manager.Launched -= OnLaunched;
                manager.PassFinished -= OnFinished;
                manager.onPassModeEntered.RemoveListener(OnModeEntered);
                manager.onDrawStarted.RemoveListener(OnDrawStarted);
            }
        }

        // ─────────────────────────── Anlar ───────────────────────────

        private void OnModeEntered() { Buzz(HapticPattern.Select); }

        private void OnDrawStarted() { Buzz(HapticPattern.Tap); }

        private void OnLaunched(bool isShot)
        {
            Play(isShot ? shotKick : passKick, isShot ? 1f : 0.75f);
            Buzz(isShot ? HapticPattern.ShotKick : HapticPattern.PassKick);
            if (isShot) ShakeCam(shotShake, 0.15f);
        }

        private void OnFinished(PassResult r)
        {
            switch (r.outcome)
            {
                case PassOutcome.Completed:
                    Play(control, 0.6f);
                    Buzz(HapticPattern.Received);
                    break;
                case PassOutcome.Goal:
                    Play(net, 1f);
                    Play(cheer, crowdVolume);
                    Buzz(HapticPattern.Goal);
                    ShakeCam(goalShake, 0.6f);
                    break;
                case PassOutcome.Saved:
                    Play(control, 0.9f);
                    Play(groan, crowdVolume * 0.8f);
                    Buzz(HapticPattern.Saved);
                    ShakeCam(saveShake, 0.25f);
                    break;
                case PassOutcome.HitFrame:
                    Play(post, 1f);
                    Play(groan, crowdVolume);
                    Buzz(HapticPattern.Post);
                    ShakeCam(postShake, 0.35f);
                    break;
                case PassOutcome.Intercepted:
                case PassOutcome.Stolen:
                    Play(control, 0.7f);
                    Play(groan, crowdVolume * 0.5f);
                    Buzz(HapticPattern.Fail);
                    break;
                default: // Wide, OutOfBounds, Missed
                    Play(groan, crowdVolume * (r.isShot ? 0.9f : 0.5f));
                    Buzz(HapticPattern.Fail);
                    break;
            }
        }

        // ─────────────────────────── Yardımcılar ───────────────────────────

        private void Play(AudioClip clip, float gain)
        {
            if (clip == null || source == null || volume <= 0f) return;
            source.PlayOneShot(clip, volume * gain);
        }

        private void Buzz(HapticPattern p)
        {
            if (haptics) Haptics.Play(p);
        }

        private void ShakeCam(float amplitude, float duration)
        {
            if (cameraRig != null) cameraRig.Shake(amplitude, duration);
        }
    }
}

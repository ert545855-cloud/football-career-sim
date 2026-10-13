using System;
using FootballCareer.Core;
using UnityEngine;

namespace FootballCareer.Passing
{
    /// <summary>
    /// KARİYER ↔ PAS OYUNU KÖPRÜSÜ (iki yönlü).
    ///
    ///  1) Statlar oynanışı etkiler: aktif kariyer profilinin (GameSession.Current) Pas, Şut, Hız statları ve
    ///     enerjisi PassSkillProfile'a çevrilip PasManager'a uygulanır. Profil değişince yeniden uygulanır.
    ///  2) Oynanış statları geliştirir: isabetli pas Pas statına, gol Şut statına gelişim puanı yazar
    ///     (falsolu olanlar daha çok). Mevki çarpanları PlayerProfile.ApplyTraining'de uygulanır.
    ///     İsteğe bağlı olarak her deneme enerji harcar (mini oyunlarla aynı kural).
    ///
    /// Sahnede PasManager'ın yanına ekleyin. Kariyer kaydı yoksa nötr profil kullanılır (demo gibi).
    /// </summary>
    [DisallowMultipleComponent]
    public class CareerStatsBridge : MonoBehaviour
    {
        [SerializeField] private PasManager manager;
        [Tooltip("Statlar pas/şut oynanışını etkilesin.")]
        [SerializeField] private bool applyStats = true;
        [Tooltip("İsabetli pas ve gol, statlara gelişim puanı versin.")]
        [SerializeField] private bool trainOnSuccess = true;
        [Tooltip("İsabetli pas başına Pas gelişimi (1 = bir stat puanı).")]
        [SerializeField] private float passTraining = 0.2f;
        [Tooltip("Gol başına Şut gelişimi.")]
        [SerializeField] private float goalTraining = 0.4f;
        [Tooltip("Falsolu vuruşlarda ek çarpan (|falso| = 1 iken +%60).")]
        [SerializeField] private float curveBonus = 0.6f;
        [Tooltip("Her pas/şut denemesi enerji harcasın (yarım mini oyun denemesi kadar).")]
        [SerializeField] private bool spendEnergy = false;

        /// <summary>Bir stat tam puan arttı (UI'da "+1 PAS" göstermek için).</summary>
        public event Action<StatType, int> StatGained;

        public bool HasCareer { get { return GameSession.HasProfile; } }

        private void Awake()
        {
            if (manager == null) manager = GetComponent<PasManager>();
        }

        private void OnEnable()
        {
            GameSession.ProfileChanged += OnProfileChanged;
            if (manager != null) manager.PassFinished += OnPassFinished;
            GameSession.EnsureLoaded();
            Apply();
        }

        private void OnDisable()
        {
            GameSession.ProfileChanged -= OnProfileChanged;
            if (manager != null) manager.PassFinished -= OnPassFinished;
        }

        /// <summary>Kodla kurulum için.</summary>
        public void Setup(PasManager passManager)
        {
            if (manager != null && isActiveAndEnabled) manager.PassFinished -= OnPassFinished;
            manager = passManager;
            if (manager != null && isActiveAndEnabled) manager.PassFinished += OnPassFinished;
            Apply();
        }

        /// <summary>Profilin statlarını PasManager'a uygular.</summary>
        public void Apply()
        {
            if (manager == null) return;
            manager.ApplySkill(applyStats && GameSession.HasProfile
                ? PassSkillProfile.FromProfile(GameSession.Current)
                : PassSkillProfile.Neutral);
        }

        private void OnProfileChanged(PlayerProfile p) { Apply(); }

        private void OnPassFinished(PassResult r)
        {
            PlayerProfile profile = GameSession.Current;
            if (profile == null) return;
            bool changed = false;

            if (spendEnergy && r.outcome != PassOutcome.Stolen)
            {
                profile.RestoreEnergy(-profile.GetAttemptEnergyCost() * 0.5f);
                changed = true;
            }
            if (trainOnSuccess)
            {
                float curve = 1f + curveBonus * Mathf.Min(1f, Mathf.Abs(r.curve));
                if (r.outcome == PassOutcome.Completed) changed |= Train(profile, StatType.Passing, passTraining * curve);
                else if (r.outcome == PassOutcome.Goal) changed |= Train(profile, StatType.Shooting, goalTraining * curve);
            }
            if (!changed) return;
            GameSession.Save();
            GameSession.NotifyChanged(); // → Apply(): yeni stat ve enerjiyle
        }

        private bool Train(PlayerProfile profile, StatType stat, float amount)
        {
            int gained = profile.ApplyTraining(stat, amount);
            if (gained > 0 && StatGained != null) StatGained(stat, gained);
            return true; // kısmi ilerleme de kaydedilmeli
        }
    }
}

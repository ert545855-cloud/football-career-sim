using System;
using FootballCareer.Core;
using FootballCareer.MiniGames;
using UnityEngine;

namespace FootballCareer.Passing
{
    /// <summary>
    /// OYUNCU STATLARININ PAS/ŞUT OYNANIŞINA ETKİSİ.
    ///
    ///  Pas statı   → ağır çekim ne kadar yavaş (çizmek için zaman), en uzak pas, pas hızı,
    ///                isabet sapması, çizilen kavisin ne kadarının uygulanabildiği.
    ///  Şut statı   → şut hızı, isabet sapması, falso ustalığı.
    ///  Hız statı   → baskı altında topu koruma (rakibin top kapma mesafesi).
    ///  Dayanıklılık → enerji düştükçe hepsi zayıflar (PlayerProfile.FatigueMultiplier).
    ///
    /// Değerler "çarpan" olarak tutulur; bölüm/Inspector ayarlarının ÜZERİNE uygulanır.
    /// Yeni başlayan da oynayabilsin diye etki %25 tabandan başlar (stat 0 bile tamamen çaresiz değildir).
    /// </summary>
    [Serializable]
    public struct PassSkillProfile
    {
        /// <summary>Ağır çekim oranı çarpanı (küçük = daha yavaş zaman = daha çok düşünme süresi).</summary>
        public float timeScaleFactor;
        /// <summary>En uzak pas çarpanı.</summary>
        public float distanceFactor;
        public float passSpeedFactor;
        /// <summary>30 metrelik pasta en büyük yanal sapma (metre). Kısa paslarda orantılı azalır.</summary>
        public float passErrorMeters;
        /// <summary>Çizilen kavisin ne kadarı uygulanır (0 = dümdüz, 1 = çizildiği gibi).</summary>
        public float passCurveFidelity;
        public float shotSpeedFactor;
        /// <summary>Kale ağzında en büyük sapma (metre; yanal tam, dikey %60).</summary>
        public float shotErrorMeters;
        public float shotCurveFidelity;
        /// <summary>Rakibin top kapma mesafesi çarpanı (hızlı oyuncu topu daha iyi korur).</summary>
        public float stealRadiusFactor;

        /// <summary>Etkisiz profil: Inspector/bölüm ayarları olduğu gibi kullanılır, sapma yok.</summary>
        public static PassSkillProfile Neutral
        {
            get
            {
                return new PassSkillProfile
                {
                    timeScaleFactor = 1f, distanceFactor = 1f, passSpeedFactor = 1f, passErrorMeters = 0f, passCurveFidelity = 1f,
                    shotSpeedFactor = 1f, shotErrorMeters = 0f, shotCurveFidelity = 1f, stealRadiusFactor = 1f,
                };
            }
        }

        /// <summary>0–1 etkin yeteneklerden (yorgunluk dahil) profil.</summary>
        public static PassSkillProfile FromSkills(float passing, float shooting, float speed)
        {
            float p = Ease(passing), s = Ease(shooting), v = Ease(speed);
            return new PassSkillProfile
            {
                timeScaleFactor = Mathf.Lerp(1.5f, 0.7f, p),
                distanceFactor = Mathf.Lerp(0.7f, 1.1f, p),
                passSpeedFactor = Mathf.Lerp(0.85f, 1.15f, p),
                passErrorMeters = Mathf.Lerp(2.4f, 0f, p),
                passCurveFidelity = Mathf.Lerp(0.55f, 1f, p),
                shotSpeedFactor = Mathf.Lerp(0.85f, 1.2f, s),
                shotErrorMeters = Mathf.Lerp(1.3f, 0f, s),
                shotCurveFidelity = Mathf.Lerp(0.5f, 1f, s),
                stealRadiusFactor = Mathf.Lerp(1.25f, 0.8f, v),
            };
        }

        /// <summary>Kariyer profilinden (statlar + yorgunluk).</summary>
        public static PassSkillProfile FromProfile(PlayerProfile profile)
        {
            if (profile == null) return Neutral;
            return FromSkills(
                StatCheck.GetEffectiveSkill(profile, new StatWeighting(StatType.Passing, StatType.Passing, 0f)),
                StatCheck.GetEffectiveSkill(profile, new StatWeighting(StatType.Shooting, StatType.Shooting, 0f)),
                StatCheck.GetEffectiveSkill(profile, new StatWeighting(StatType.Speed, StatType.Stamina, 0.3f)));
        }

        /// <summary>%25 taban: stat 0 → 0.25, stat 100 → 1.</summary>
        private static float Ease(float skill) { return 0.25f + 0.75f * Mathf.Clamp01(skill); }
    }
}

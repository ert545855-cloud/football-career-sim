using System;
using FootballCareer.Core;
using UnityEngine;

namespace FootballCareer.MiniGames
{
    public enum MiniGameState
    {
        Idle,     // Panel açık, "Başla" bekleniyor
        Playing,  // Tur oynanıyor
        Finished  // Tur bitti, sonuç gösteriliyor
    }

    /// <summary>Bir mini oyun turunun sonucu.</summary>
    public struct MiniGameResult
    {
        public bool     Success;
        public float    Accuracy;    // 0–1: ne kadar iyi (başarısızsa 0)
        public string   Message;     // Ekranda gösterilecek yorum
        public StatType TrainedStat; // Bu oyunun geliştirdiği stat

        public static MiniGameResult Win(float accuracy, string message, StatType trainedStat)
        {
            return new MiniGameResult
            {
                Success     = true,
                Accuracy    = Mathf.Clamp01(accuracy),
                Message     = message,
                TrainedStat = trainedStat
            };
        }

        public static MiniGameResult Fail(string message, StatType trainedStat)
        {
            return new MiniGameResult
            {
                Success     = false,
                Accuracy    = 0f,
                Message     = message,
                TrainedStat = trainedStat
            };
        }
    }

    /// <summary>
    /// Bir mini oyunun hangi statlardan etkilendiği.
    /// Örn. Savunma: %70 Defans + %30 Hız.
    /// </summary>
    [Serializable]
    public struct StatWeighting
    {
        public StatType primary;
        public StatType secondary;
        [Range(0f, 1f)] public float secondaryWeight;

        public StatWeighting(StatType primary, StatType secondary, float secondaryWeight)
        {
            this.primary         = primary;
            this.secondary       = secondary;
            this.secondaryWeight = secondaryWeight;
        }

        public bool HasSecondary => secondaryWeight > 0f && secondary != primary;
    }

    /// <summary>Statları mini oyun zorluğuna çeviren hesaplar.</summary>
    public static class StatCheck
    {
        /// <summary>
        /// 0–1 arası "etkin yetenek":
        /// (ana stat × (1−w) + yan stat × w) / 100 × yorgunluk çarpanı
        /// Örn. Şut 25 olan dinç forvet → 0.25; enerjisi bitmiş haliyle → 0.15
        /// </summary>
        public static float GetEffectiveSkill(PlayerProfile profile, StatWeighting weighting)
        {
            if (profile == null || profile.Stats == null) return 0f;

            float w         = Mathf.Clamp01(weighting.secondaryWeight);
            float primary   = profile.Stats.GetNormalized(weighting.primary);
            float secondary = profile.Stats.GetNormalized(weighting.secondary);
            float blended   = primary * (1f - w) + secondary * w;

            return Mathf.Clamp01(blended * profile.FatigueMultiplier);
        }

        /// <summary>
        /// Yeteneğe göre iki değer arasında geçiş yapar.
        /// skill 0 → atZero (en zor), skill 1 → atMax (en kolay).
        /// </summary>
        public static float Scale(float skill, float atZero, float atMax)
        {
            return Mathf.Lerp(atZero, atMax, skill);
        }
    }
}

using System.Collections.Generic;
using UnityEngine;

namespace FootballCareer.Passing.Levels
{
    /// <summary>
    /// Bölüm puanlaması (saf fonksiyonlar, test edilebilir).
    ///  • İsabetli pas: 100 + falso (en fazla 80) + mesafe (metre başına 2).
    ///  • Gol: 500 + falso (en fazla 300) + 12 m'den uzak her metre için 10 + köşe bonusu 150.
    ///  • Yıldız: hedef tamamlandıysa 1; puan eşiklerine göre 2 ve 3.
    /// </summary>
    public static class LevelScoring
    {
        public const float CurvedThreshold = 0.25f;
        public const int CornerBonus = 150;

        public static int PassPoints(float curve, float length)
        {
            return 100 + Mathf.RoundToInt(80f * Mathf.Min(1f, Mathf.Abs(curve))) + Mathf.RoundToInt(2f * Mathf.Max(0f, length));
        }

        /// <param name="mouth">Topun kale ağzını geçtiği nokta (x = merkezden yanal, y = yükseklik).</param>
        /// <param name="goalWidth">Kale genişliği (köşe tanımı için).</param>
        public static int GoalPoints(float curve, float length, Vector2 mouth, float goalWidth, float goalHeight)
        {
            int pts = 500 + Mathf.RoundToInt(300f * Mathf.Min(1f, Mathf.Abs(curve)))
                    + Mathf.RoundToInt(10f * Mathf.Max(0f, length - 12f));
            if (IsCorner(mouth, goalWidth, goalHeight)) pts += CornerBonus;
            return pts;
        }

        /// <summary>Köşe: direklere yakın (dış %30) ya da üst direğe yakın (üst %35).</summary>
        public static bool IsCorner(Vector2 mouth, float goalWidth, float goalHeight)
        {
            return Mathf.Abs(mouth.x) > goalWidth * 0.5f * 0.7f || mouth.y > goalHeight * 0.65f;
        }

        public static bool IsCurved(float curve) { return Mathf.Abs(curve) >= CurvedThreshold; }

        public static int Stars(bool objectiveMet, int score, int twoStarScore, int threeStarScore)
        {
            if (!objectiveMet) return 0;
            if (score >= threeStarScore) return 3;
            if (score >= twoStarScore) return 2;
            return 1;
        }
    }

    /// <summary>
    /// Bölüm ilerlemesi (en iyi yıldız ve puan) — PlayerPrefs'te saklanır, WebGL'de tarayıcıda kalır.
    /// Bir bölüm, bir öncekinden en az 1 yıldız alınınca açılır.
    /// </summary>
    public static class LevelProgress
    {
        private const string Prefix = "fc.passlevel.";

        public static int GetStars(string id) { return PlayerPrefs.GetInt(Prefix + id + ".stars", 0); }
        public static int GetBestScore(string id) { return PlayerPrefs.GetInt(Prefix + id + ".score", 0); }

        /// <summary>Sonucu kaydeder; yıldız ya da puan rekoru kırıldıysa true.</summary>
        public static bool Submit(string id, int stars, int score)
        {
            bool better = false;
            if (stars > GetStars(id))
            {
                PlayerPrefs.SetInt(Prefix + id + ".stars", stars);
                better = true;
            }
            if (score > GetBestScore(id))
            {
                PlayerPrefs.SetInt(Prefix + id + ".score", score);
                better = true;
            }
            if (better) PlayerPrefs.Save();
            return better;
        }

        public static bool IsUnlocked(IList<PassLevel> levels, int index)
        {
            if (index <= 0) return true;
            if (index >= levels.Count) return false;
            if (levels[index].objective == LevelObjective.FreePlay) return true;
            // Serbest oyun bölümleri kilit zincirine dahil değil
            for (int i = index - 1; i >= 0; i--)
            {
                if (levels[i].objective == LevelObjective.FreePlay) continue;
                return GetStars(levels[i].id) > 0;
            }
            return true;
        }

        public static int TotalStars(IList<PassLevel> levels)
        {
            int sum = 0;
            for (int i = 0; i < levels.Count; i++) sum += GetStars(levels[i].id);
            return sum;
        }

        /// <summary>Tüm bölüm ilerlemesini siler.</summary>
        public static void ResetAll(IList<PassLevel> levels)
        {
            for (int i = 0; i < levels.Count; i++)
            {
                PlayerPrefs.DeleteKey(Prefix + levels[i].id + ".stars");
                PlayerPrefs.DeleteKey(Prefix + levels[i].id + ".score");
            }
            PlayerPrefs.Save();
        }
    }
}

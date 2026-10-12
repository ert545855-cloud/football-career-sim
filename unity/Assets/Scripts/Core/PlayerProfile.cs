using System;
using System.Text.RegularExpressions;
using UnityEngine;

namespace FootballCareer.Core
{
    /// <summary>
    /// Kariyerin kaydedilen verisi: isim, mevki, 5 stat, enerji ve gelişim ilerlemesi.
    /// SaveSystem bu sınıfı JSON olarak diske (Web'de tarayıcıya) yazar.
    ///
    /// Dayanıklılık (Stamina) burada kullanılır:
    ///  - Her mini oyun denemesi enerji harcar; dayanıklılık yüksekse maliyet düşer.
    ///  - Enerji azaldıkça "yorgunluk çarpanı" düşer ve tüm statlar daha az etkili olur.
    /// </summary>
    [Serializable]
    public class PlayerProfile
    {
        public const int    CurrentVersion = 1;
        public const int    MinNameLength  = 2;
        public const int    MaxNameLength  = 20;
        public const float  MaxEnergy      = 100f;
        public const string DefaultName    = "Yeni Oyuncu";

        // Enerji maliyeti: Dayanıklılık 0 iken 15, 100 iken 5 enerji
        private const float MaxAttemptCost = 15f;
        private const float MinAttemptCost = 5f;

        // Yorgunluk: enerji 0'a inince statlar %60 etkinlikle çalışır
        private const float MinFatigueMultiplier = 0.6f;

        // ─────────────────────────────────────────────────────────────
        // KAYDEDİLEN ALANLAR
        // Yeni alan eklersen eski kayıtlarda varsayılan değerini alır;
        // gerekirse EnsureValid() içinde düzelt ve CurrentVersion'ı artır.
        // ─────────────────────────────────────────────────────────────

        [SerializeField] private int            version = CurrentVersion;
        [SerializeField] private string         playerName;
        [SerializeField] private PlayerPosition position;
        [SerializeField] private PlayerStats    stats = new PlayerStats();
        [SerializeField] private float          energy = MaxEnergy;
        [SerializeField] private float[]        trainingProgress = new float[PlayerStats.Count];
        [SerializeField] private string         createdAtUtc;

        public int            Version          => version;
        public string         PlayerName       => playerName;
        public PlayerPosition Position         => position;
        public PlayerStats    Stats            => stats;
        public float          Energy           => energy;
        public float          EnergyNormalized => Mathf.Clamp01(energy / MaxEnergy);
        public string         CreatedAtUtc     => createdAtUtc;

        /// <summary>JsonUtility için boş kurucu. Yeni oyuncu için Create() kullan.</summary>
        public PlayerProfile() { }

        // ─────────────────────────────────────────────────────────────
        // OLUŞTURMA
        // ─────────────────────────────────────────────────────────────

        /// <summary>Seçilen mevkinin başlangıç statlarıyla yeni oyuncu oluşturur.</summary>
        public static PlayerProfile Create(string rawName, PlayerPosition position)
        {
            var profile = new PlayerProfile
            {
                version          = CurrentVersion,
                playerName       = SanitizeName(rawName),
                position         = position,
                stats            = PositionPresets.GetStartingStats(position),
                energy           = MaxEnergy,
                trainingProgress = new float[PlayerStats.Count],
                createdAtUtc     = DateTime.UtcNow.ToString("o")
            };
            return profile;
        }

        /// <summary>İsim kullanılabilir mi? (Temizlendikten sonra en az 2 karakter)</summary>
        public static bool IsValidName(string rawName)
        {
            return CleanName(rawName).Length >= MinNameLength;
        }

        /// <summary>İsmi temizler; geçersizse varsayılan ismi döner.</summary>
        public static string SanitizeName(string rawName)
        {
            string cleaned = CleanName(rawName);
            return cleaned.Length >= MinNameLength ? cleaned : DefaultName;
        }

        private static string CleanName(string rawName)
        {
            if (string.IsNullOrWhiteSpace(rawName)) return string.Empty;

            // TextMeshPro <b>, <color> gibi etiketleri biçim olarak yorumlar;
            // isimde etiket olmasın diye önce etiketleri, sonra kalan < > işaretlerini atıyoruz.
            string cleaned = Regex.Replace(rawName, "<[^>]*>", string.Empty)
                                  .Replace("<", string.Empty).Replace(">", string.Empty).Trim();
            if (cleaned.Length > MaxNameLength) cleaned = cleaned.Substring(0, MaxNameLength).Trim();
            return cleaned;
        }

        // ─────────────────────────────────────────────────────────────
        // ENERJİ / DAYANIKLILIK
        // ─────────────────────────────────────────────────────────────

        /// <summary>Bir mini oyun denemesinin enerji maliyeti (dayanıklılığa göre).</summary>
        public float GetAttemptEnergyCost()
        {
            return Mathf.Lerp(MaxAttemptCost, MinAttemptCost, stats.GetNormalized(StatType.Stamina));
        }

        public bool HasEnergyForAttempt()
        {
            return energy >= GetAttemptEnergyCost();
        }

        /// <summary>Enerji yetiyorsa düşer ve true döner; yetmiyorsa hiçbir şey yapmaz.</summary>
        public bool TryConsumeEnergyForAttempt()
        {
            float cost = GetAttemptEnergyCost();
            if (energy < cost) return false;

            energy = Mathf.Max(0f, energy - cost);
            return true;
        }

        /// <summary>
        /// Yorgunluk çarpanı: enerji doluyken 1.0, boşken 0.6.
        /// Mini oyunlardaki "etkin yetenek" bununla çarpılır.
        /// </summary>
        public float FatigueMultiplier => Mathf.Lerp(MinFatigueMultiplier, 1f, EnergyNormalized);

        public void RestoreEnergy(float amount)
        {
            energy = Mathf.Clamp(energy + amount, 0f, MaxEnergy);
        }

        public void RestoreEnergyFull()
        {
            energy = MaxEnergy;
        }

        // ─────────────────────────────────────────────────────────────
        // GELİŞİM (mevki çarpanlı)
        // ─────────────────────────────────────────────────────────────

        /// <summary>
        /// Stat'a gelişim puanı ekler. Miktar mevki çarpanıyla büyür ve
        /// biriktikçe tam puana dönüşür (örn. 0.5 + 0.5 → +1 stat).
        /// </summary>
        /// <returns>Bu çağrıda kazanılan tam stat puanı (genelde 0 veya 1).</returns>
        public int ApplyTraining(StatType stat, float baseAmount)
        {
            if (baseAmount <= 0f) return 0;
            EnsureValid();

            int index = (int)stat;
            trainingProgress[index] += baseAmount * PositionPresets.GetGrowthMultiplier(position, stat);

            int gained = 0;
            while (trainingProgress[index] >= 1f && stats.Get(stat) < PlayerStats.MaxValue)
            {
                trainingProgress[index] -= 1f;
                stats.Add(stat, 1);
                gained++;
            }

            // Tavana ulaşan stat'ta birikim tutmanın anlamı yok
            if (stats.Get(stat) >= PlayerStats.MaxValue) trainingProgress[index] = 0f;

            return gained;
        }

        /// <summary>Bir sonraki stat puanına ne kadar kaldığı (0–1).</summary>
        public float GetTrainingProgress(StatType stat)
        {
            EnsureValid();
            return Mathf.Clamp01(trainingProgress[(int)stat]);
        }

        // ─────────────────────────────────────────────────────────────
        // KAYIT GÜVENLİĞİ
        // ─────────────────────────────────────────────────────────────

        /// <summary>
        /// Eski, eksik veya elle bozulmuş kayıtları güvenli hale getirir.
        /// Kayıt yüklendikten hemen sonra çağrılır (GameSession bunu yapıyor).
        /// </summary>
        public void EnsureValid()
        {
            if (!Enum.IsDefined(typeof(PlayerPosition), position))
                position = PlayerPosition.Forward;

            if (stats == null)
                stats = PositionPresets.GetStartingStats(position);
            stats.ClampAll();

            if (trainingProgress == null || trainingProgress.Length != PlayerStats.Count)
            {
                var fixedProgress = new float[PlayerStats.Count];
                if (trainingProgress != null)
                    Array.Copy(trainingProgress, fixedProgress, Mathf.Min(trainingProgress.Length, fixedProgress.Length));
                trainingProgress = fixedProgress;
            }

            if (string.IsNullOrWhiteSpace(playerName))
                playerName = DefaultName;

            energy  = Mathf.Clamp(energy, 0f, MaxEnergy);
            version = CurrentVersion;
        }
    }
}

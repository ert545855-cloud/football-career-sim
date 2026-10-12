using System;
using UnityEngine;

namespace FootballCareer.Core
{
    /// <summary>
    /// Oyuncunun 5 temel özelliği.
    /// Sayısal değerler dizi indeksi olarak da kullanılıyor; sırayı DEĞİŞTİRME
    /// (eski kayıtlardaki gelişim verisi kayar). Yeni stat eklersen sona ekle.
    /// </summary>
    public enum StatType
    {
        Speed     = 0, // Hız
        Shooting  = 1, // Şut
        Passing   = 2, // Pas
        Defending = 3, // Defans
        Stamina   = 4  // Dayanıklılık
    }

    /// <summary>Stat isimlerinin ekranda görünen Türkçe karşılıkları.</summary>
    public static class StatTypeExtensions
    {
        public static string ToDisplayName(this StatType stat)
        {
            switch (stat)
            {
                case StatType.Speed:     return "Hız";
                case StatType.Shooting:  return "Şut";
                case StatType.Passing:   return "Pas";
                case StatType.Defending: return "Defans";
                case StatType.Stamina:   return "Dayanıklılık";
                default:                 return stat.ToString();
            }
        }

        public static string ToShortName(this StatType stat)
        {
            switch (stat)
            {
                case StatType.Speed:     return "HIZ";
                case StatType.Shooting:  return "ŞUT";
                case StatType.Passing:   return "PAS";
                case StatType.Defending: return "DEF";
                case StatType.Stamina:   return "DAY";
                default:                 return stat.ToString();
            }
        }
    }

    /// <summary>
    /// 5 özelliği tutan veri sınıfı. JsonUtility ile kaydedilebilir.
    /// Değerler her zaman MinValue–MaxValue (0–100) aralığında tutulur.
    /// </summary>
    [Serializable]
    public class PlayerStats
    {
        public const int MinValue = 0;
        public const int MaxValue = 100;
        public const int Count    = 5;

        /// <summary>Döngülerde kullanmak için tüm stat türleri (sabit sıra).</summary>
        public static readonly StatType[] All =
        {
            StatType.Speed, StatType.Shooting, StatType.Passing, StatType.Defending, StatType.Stamina
        };

        // JsonUtility, [SerializeField] işaretli private alanları da kaydeder.
        // Alanları private tutuyoruz ki dışarıdan 0–100 sınır kontrolü atlanamasın.
        [SerializeField] private int speed;
        [SerializeField] private int shooting;
        [SerializeField] private int passing;
        [SerializeField] private int defending;
        [SerializeField] private int stamina;

        /// <summary>JsonUtility'nin kayıttan okurken kullandığı boş kurucu.</summary>
        public PlayerStats() { }

        public PlayerStats(int speed, int shooting, int passing, int defending, int stamina)
        {
            Set(StatType.Speed,     speed);
            Set(StatType.Shooting,  shooting);
            Set(StatType.Passing,   passing);
            Set(StatType.Defending, defending);
            Set(StatType.Stamina,   stamina);
        }

        public int Speed     => speed;
        public int Shooting  => shooting;
        public int Passing   => passing;
        public int Defending => defending;
        public int Stamina   => stamina;

        public int Get(StatType type)
        {
            switch (type)
            {
                case StatType.Speed:     return speed;
                case StatType.Shooting:  return shooting;
                case StatType.Passing:   return passing;
                case StatType.Defending: return defending;
                case StatType.Stamina:   return stamina;
                default: throw new ArgumentOutOfRangeException(nameof(type), type, null);
            }
        }

        public void Set(StatType type, int value)
        {
            value = Mathf.Clamp(value, MinValue, MaxValue);

            switch (type)
            {
                case StatType.Speed:     speed     = value; break;
                case StatType.Shooting:  shooting  = value; break;
                case StatType.Passing:   passing   = value; break;
                case StatType.Defending: defending = value; break;
                case StatType.Stamina:   stamina   = value; break;
                default: throw new ArgumentOutOfRangeException(nameof(type), type, null);
            }
        }

        public void Add(StatType type, int delta)
        {
            Set(type, Get(type) + delta);
        }

        /// <summary>0–1 arası değer. Mini oyun zorluğu bununla hesaplanır.</summary>
        public float GetNormalized(StatType type)
        {
            return Get(type) / (float)MaxValue;
        }

        public int Total
        {
            get
            {
                int sum = 0;
                foreach (StatType t in All) sum += Get(t);
                return sum;
            }
        }

        /// <summary>
        /// Kayıttan okunan değerleri sınırlar içine çeker.
        /// (JsonUtility alanlara doğrudan yazar, Set()'teki kontrolden geçmez.)
        /// </summary>
        public void ClampAll()
        {
            foreach (StatType t in All) Set(t, Get(t));
        }

        public PlayerStats Clone()
        {
            return new PlayerStats(speed, shooting, passing, defending, stamina);
        }

        public override string ToString()
        {
            return $"HIZ {speed} | ŞUT {shooting} | PAS {passing} | DEF {defending} | DAY {stamina}";
        }
    }
}

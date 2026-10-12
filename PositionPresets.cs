using System;

namespace FootballCareer.Core
{
    /// <summary>Oyuncunun seçebileceği mevkiler.</summary>
    public enum PlayerPosition
    {
        Forward    = 0, // Forvet
        Midfielder = 1, // Orta Saha
        Defender   = 2  // Defans
    }

    /// <summary>
    /// OYUN DENGESİ TABLOSU — mevkiye göre başlangıç statları ve gelişim çarpanları.
    /// Denge ayarı yapmak istediğinde SADECE bu dosyayı değiştirmen yeterli;
    /// UI ve mini oyunlar değerleri buradan okur.
    /// </summary>
    public static class PositionPresets
    {
        public static readonly PlayerPosition[] All =
        {
            PlayerPosition.Forward, PlayerPosition.Midfielder, PlayerPosition.Defender
        };

        // ─────────────────────────────────────────────────────────────
        // 1) BAŞLANGIÇ STATLARI
        // Not: Toplamlar eşit değil (FV 77, OS 82, DF 79). Eşitlemek istersen
        // buradaki sayıları değiştirmen yeterli.
        // ─────────────────────────────────────────────────────────────

        public static PlayerStats GetStartingStats(PlayerPosition position)
        {
            switch (position)
            {
                case PlayerPosition.Forward:
                    return new PlayerStats(speed: 20, shooting: 25, passing: 12, defending: 5,  stamina: 15);

                case PlayerPosition.Midfielder:
                    return new PlayerStats(speed: 15, shooting: 12, passing: 25, defending: 10, stamina: 20);

                case PlayerPosition.Defender:
                    return new PlayerStats(speed: 12, shooting: 5,  passing: 15, defending: 25, stamina: 22);

                default:
                    throw new ArgumentOutOfRangeException(nameof(position), position, null);
            }
        }

        // ─────────────────────────────────────────────────────────────
        // 2) MEVKİ ÇARPANLARI (gelişim hızı)
        // Mini oyunda/antrenmanda kazanılan gelişim bu çarpanla büyür:
        // forvet şutu, orta saha pası, defans defansı daha hızlı geliştirir.
        // ─────────────────────────────────────────────────────────────

        public const float PrimaryGrowth   = 1.5f;  // mevkinin ana özelliği
        public const float SecondaryGrowth = 1.25f; // mevkinin yan özelliği
        public const float DefaultGrowth   = 1.0f;  // diğerleri

        public static StatType GetPrimaryStat(PlayerPosition position)
        {
            switch (position)
            {
                case PlayerPosition.Forward:    return StatType.Shooting;
                case PlayerPosition.Midfielder: return StatType.Passing;
                case PlayerPosition.Defender:   return StatType.Defending;
                default: throw new ArgumentOutOfRangeException(nameof(position), position, null);
            }
        }

        public static StatType GetSecondaryStat(PlayerPosition position)
        {
            switch (position)
            {
                case PlayerPosition.Forward:    return StatType.Speed;
                case PlayerPosition.Midfielder: return StatType.Stamina;
                case PlayerPosition.Defender:   return StatType.Stamina;
                default: throw new ArgumentOutOfRangeException(nameof(position), position, null);
            }
        }

        public static float GetGrowthMultiplier(PlayerPosition position, StatType stat)
        {
            if (stat == GetPrimaryStat(position))   return PrimaryGrowth;
            if (stat == GetSecondaryStat(position)) return SecondaryGrowth;
            return DefaultGrowth;
        }
    }

    /// <summary>Mevki isimlerinin ekranda görünen Türkçe karşılıkları.</summary>
    public static class PlayerPositionExtensions
    {
        public static string ToDisplayName(this PlayerPosition position)
        {
            switch (position)
            {
                case PlayerPosition.Forward:    return "Forvet";
                case PlayerPosition.Midfielder: return "Orta Saha";
                case PlayerPosition.Defender:   return "Defans";
                default:                        return position.ToString();
            }
        }

        public static string ToDescription(this PlayerPosition position)
        {
            switch (position)
            {
                case PlayerPosition.Forward:
                    return "Golcü. Şut ve hız öne çıkar; şut çekme testinde parlar.";
                case PlayerPosition.Midfielder:
                    return "Oyun kurucu. Pas ve dayanıklılık öne çıkar; pas testinde parlar.";
                case PlayerPosition.Defender:
                    return "Duvar. Defans ve dayanıklılık öne çıkar; müdahale testinde parlar.";
                default:
                    return string.Empty;
            }
        }
    }
}

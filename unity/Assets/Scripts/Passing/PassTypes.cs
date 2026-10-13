using System;
using UnityEngine;
using UnityEngine.Events;

namespace FootballCareer.Passing
{
    /// <summary>Pas sisteminin durum makinesi.</summary>
    public enum PassState
    {
        /// <summary>Top oyuncuda, normal zaman. Pas moduna geçilmeyi bekler.</summary>
        Idle,
        /// <summary>Pas modu: zaman yavaş, kamera oyuncunun arkasına geçiyor / geçti. Çizim bekleniyor.</summary>
        Aiming,
        /// <summary>Parmak ekranda, kavisli pas hattı çiziliyor. Rakipler baskıda.</summary>
        Drawing,
        /// <summary>Parmak kalktı, zaman normal; top çizilen Bezier eğrisinde uçuyor.</summary>
        InFlight,
        /// <summary>Sonuç gösteriliyor (kısa bekleme), sonra Idle'a dönülür.</summary>
        Resolving,
    }

    /// <summary>Pasın sonucu.</summary>
    public enum PassOutcome
    {
        /// <summary>Top bir takım arkadaşına ulaştı.</summary>
        Completed,
        /// <summary>Top uçarken bir rakibe çarptı / rakip araya girdi.</summary>
        Intercepted,
        /// <summary>Top saha dışına çıktı.</summary>
        OutOfBounds,
        /// <summary>Oyuncu çizerken çok bekledi, rakip topu ayağından aldı.</summary>
        Stolen,
        /// <summary>Top kimseye ulaşmadan durdu (boşa giden pas).</summary>
        Missed,
    }

    /// <summary>Pas sonucu verisi (UI, istatistik, kariyer sistemi için).</summary>
    [Serializable]
    public struct PassResult
    {
        public PassOutcome outcome;
        /// <summary>Pası atan oyuncu.</summary>
        public Transform passer;
        /// <summary>Başarılı pasta topu alan takım arkadaşı (yoksa null).</summary>
        public PassReceiver receiver;
        /// <summary>Topu kesen / kapan rakip (yoksa null).</summary>
        public EnemyAI interceptor;
        /// <summary>Çizilen yolun uzunluğu (metre).</summary>
        public float pathLength;
        /// <summary>Falso miktarı (0 = dümdüz, ~0.3+ = belirgin kavis). İşaret: + sola, − sağa kıvrılır.</summary>
        public float curve;
        /// <summary>Topun havada kaldığı süre (saniye).</summary>
        public float flightTime;

        public bool Success { get { return outcome == PassOutcome.Completed; } }

        /// <summary>Türkçe kısa açıklama (UI'da göstermek için).</summary>
        public string Describe()
        {
            switch (outcome)
            {
                case PassOutcome.Completed: return Mathf.Abs(curve) > 0.18f ? "Falsolu pas, isabetli!" : "İsabetli pas!";
                case PassOutcome.Intercepted: return "Rakip araya girdi!";
                case PassOutcome.OutOfBounds: return "Top dışarı çıktı!";
                case PassOutcome.Stolen: return "Çok bekledin, top kaptırıldı!";
                default: return "Pas boşa gitti.";
            }
        }
    }

    /// <summary>Inspector'dan bağlanabilen sonuç olayı.</summary>
    [Serializable]
    public class PassResultEvent : UnityEvent<PassResult> { }
}

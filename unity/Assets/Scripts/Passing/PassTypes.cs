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
        /// <summary>GOL! Top kale çizgisini direklerin arasından geçti.</summary>
        Goal,
        /// <summary>Kaleci kurtardı (ya da kaleye gelen topu aldı).</summary>
        Saved,
        /// <summary>Top direğe / üst direğe çarptı.</summary>
        HitFrame,
        /// <summary>Şut kalenin yanından ya da üstünden auta gitti.</summary>
        Wide,
    }

    /// <summary>BallController'ın uçuş sonunda bildirdiği temas bilgisi.</summary>
    public struct BallContact
    {
        public PassOutcome outcome;
        /// <summary>Topu alan arkadaş (Completed).</summary>
        public PassReceiver receiver;
        /// <summary>Topu kesen rakip (Intercepted).</summary>
        public EnemyAI interceptor;
        /// <summary>Kurtaran kaleci (Saved).</summary>
        public GoalkeeperAI keeper;
        /// <summary>Çizgisi geçilen kale (Goal / HitFrame / Wide).</summary>
        public GoalFrame goal;
        /// <summary>Temas / çizgiyi geçme noktası.</summary>
        public Vector3 point;
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
        /// <summary>Şutu kurtaran kaleci (yoksa null).</summary>
        public GoalkeeperAI keeper;
        /// <summary>Kaleye çizilen şut muydu?</summary>
        public bool isShot;
        /// <summary>Topun kale çizgisini geçtiği / tutulduğu nokta.</summary>
        public Vector3 point;
        /// <summary>Çizilen yolun uzunluğu (metre).</summary>
        public float pathLength;
        /// <summary>Falso miktarı (0 = dümdüz, ~0.3+ = belirgin kavis). İşaret: + sola, − sağa kıvrılır.</summary>
        public float curve;
        /// <summary>Topun havada kaldığı süre (saniye).</summary>
        public float flightTime;

        /// <summary>Başarılı pas ya da gol.</summary>
        public bool Success { get { return outcome == PassOutcome.Completed || outcome == PassOutcome.Goal; } }

        /// <summary>Türkçe kısa açıklama (UI'da göstermek için).</summary>
        public string Describe()
        {
            switch (outcome)
            {
                case PassOutcome.Completed: return Mathf.Abs(curve) > 0.18f ? "Falsolu pas, isabetli!" : "İsabetli pas!";
                case PassOutcome.Intercepted: return "Rakip araya girdi!";
                case PassOutcome.OutOfBounds: return "Top dışarı çıktı!";
                case PassOutcome.Stolen: return "Çok bekledin, top kaptırıldı!";
                case PassOutcome.Goal: return Mathf.Abs(curve) > 0.18f ? "GOOOL! Falsolu bir vuruş!" : "GOOOL!";
                case PassOutcome.Saved: return isShot ? "Kaleci kurtardı!" : "Kaleci topu aldı.";
                case PassOutcome.HitFrame: return "Direkten döndü!";
                case PassOutcome.Wide: return "Top auta gitti.";
                default: return isShot ? "Şut kaleyi bulmadı." : "Pas boşa gitti.";
            }
        }
    }

    /// <summary>Inspector'dan bağlanabilen sonuç olayı.</summary>
    [Serializable]
    public class PassResultEvent : UnityEvent<PassResult> { }
}

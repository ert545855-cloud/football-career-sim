using System;
using UnityEngine;

namespace FootballCareer.Core
{
    /// <summary>
    /// Sahneler arasında "şu an oynanan kariyer"i tutan merkez.
    /// Sahne değişince MonoBehaviour'lar yok olur ama static veri yaşamaya devam eder;
    /// böylece PlayerCreation → CareerHub geçişinde profil kaybolmaz.
    ///
    /// Kural: Profili değiştiren kod iş bitince GameSession.Save() çağırır.
    /// </summary>
    public static class GameSession
    {
        public static PlayerProfile Current { get; private set; }

        public static bool HasProfile => Current != null;

        /// <summary>Profil değiştiğinde (yeni kariyer, yükleme, temizleme) haber verir.</summary>
        public static event Action<PlayerProfile> ProfileChanged;

        /// <summary>Yeni kariyeri aktif yapar ve hemen kaydeder (eski kaydın üzerine yazar).</summary>
        public static bool StartNewCareer(PlayerProfile profile)
        {
            if (profile == null) throw new ArgumentNullException(nameof(profile));

            Current = profile;
            bool saved = Save();
            NotifyChanged();
            return saved;
        }

        /// <summary>
        /// Profil bellekteyse true döner; değilse kayıttan yüklemeyi dener.
        /// Kariyer sahnesi açılırken çağrılır.
        /// </summary>
        public static bool EnsureLoaded()
        {
            if (Current != null) return true;

            PlayerProfile loaded;
            if (!SaveSystem.TryLoad(out loaded)) return false;

            loaded.EnsureValid();
            Current = loaded;
            NotifyChanged();
            return true;
        }

        public static bool Save()
        {
            if (Current == null)
            {
                Debug.LogWarning("[GameSession] Kaydedilecek profil yok.");
                return false;
            }

            return SaveSystem.Save(Current);
        }

        /// <summary>Profili kod içinden değiştirdiysen UI'ın tazelenmesi için çağır.</summary>
        public static void NotifyChanged()
        {
            Action<PlayerProfile> handler = ProfileChanged;
            if (handler != null) handler(Current);
        }

        /// <summary>Bellekteki profili bırakır (kayda dokunmaz).</summary>
        public static void Clear()
        {
            Current = null;
            NotifyChanged();
        }

        // Project Settings > Editor > "Enter Play Mode Options" ile Domain Reload
        // kapatılırsa static alanlar Play'ler arasında temizlenmez. Elle sıfırlıyoruz.
        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.SubsystemRegistration)]
        private static void ResetStatics()
        {
            Current        = null;
            ProfileChanged = null;
        }
    }
}

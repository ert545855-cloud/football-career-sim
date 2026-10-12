using UnityEngine;
using UnityEngine.SceneManagement;

namespace FootballCareer.Core
{
    /// <summary>
    /// Sahne isimleri tek yerde. Sahne adını değiştirirsen sadece burayı güncelle.
    /// Bu sahnelerin hepsi File > Build Profiles > Scene List'te olmalı.
    /// </summary>
    public static class SceneNames
    {
        public const string MainMenu       = "MainMenu";
        public const string PlayerCreation = "PlayerCreation";
        public const string CareerHub      = "CareerHub";
    }

    /// <summary>
    /// Güvenli sahne geçişi: sahne var mı kontrol eder, yüklenirken
    /// ikinci bir yüklemeyi (çift tıklama) engeller.
    /// </summary>
    public static class SceneLoader
    {
        public static bool IsLoading { get; private set; }

        public static bool Load(string sceneName)
        {
            if (IsLoading) return false;

            if (string.IsNullOrWhiteSpace(sceneName))
            {
                Debug.LogError("[SceneLoader] Sahne adı boş.");
                return false;
            }

            if (!Application.CanStreamedLevelBeLoaded(sceneName))
            {
                Debug.LogError($"[SceneLoader] '{sceneName}' sahnesi bulunamadı. " +
                               "File > Build Profiles > Scene List'e ekli mi ve adı doğru mu?");
                return false;
            }

            AsyncOperation operation = SceneManager.LoadSceneAsync(sceneName);
            if (operation == null) return false;

            IsLoading = true;
            operation.completed += op => IsLoading = false;
            return true;
        }

        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.SubsystemRegistration)]
        private static void ResetStatics()
        {
            IsLoading = false;
        }
    }
}

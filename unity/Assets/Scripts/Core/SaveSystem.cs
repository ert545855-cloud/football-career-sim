using System;
using System.IO;
using UnityEngine;

namespace FootballCareer.Core
{
    /// <summary>
    /// "Kayıtlı oyun var mı?" sorusunun NASIL cevaplanacağını belirler.
    /// </summary>
    public enum SaveCheckMode
    {
        /// <summary>
        /// Kaydın kendisine bakar (mobil/PC'de dosya, Web'de tarayıcı deposu).
        /// ÖNERİLEN: Gerçeğin tek kaynağı kaydın kendisidir.
        /// </summary>
        File,

        /// <summary>
        /// PlayerPrefs'teki 0/1 bayrağına bakar.
        /// Hızlıdır ama kayıt silinirse/bozulursa bayrak yanlış "var" diyebilir.
        /// </summary>
        PlayerPrefsFlag
    }

    /// <summary>
    /// Kariyer kaydını yazan/okuyan TEK yer.
    ///
    /// Mimari not: UI bu sınıfın içini bilmez; sadece HasSave / Save / TryLoad /
    /// DeleteSave çağırır. Platform farkları aşağıdaki "DEPOLAMA KATMANI"nda gizli.
    ///
    /// PLATFORMLAR:
    ///  - Android / iOS / PC: persistentDataPath altında JSON dosyası.
    ///  - Web (WebGL): JSON, PlayerPrefs içinde tutulur. Sebep: Web'de dosyaya
    ///    yazılan veri, JavaScript ile ayrıca FS.syncfs çağrılmadan tarayıcı
    ///    deposuna (IndexedDB) kalıcı olarak geçmez. PlayerPrefs.Save() bu
    ///    senkronizasyonu kendisi tetikler. Web'de PlayerPrefs sınırı ~1 MB;
    ///    tek oyuncu profili bunun çok altında.
    /// </summary>
    public static class SaveSystem
    {
        private const string SaveFileName = "career_save.json";
        private const string HasSaveKey   = "FC_HasSave";  // 0/1 bayrağı
        private const string SaveJsonKey  = "FC_SaveJson"; // Web'de kaydın kendisi

        /// <summary>Dosya tabanlı platformlarda kayıt dosyasının tam yolu.</summary>
        public static string SaveFilePath =>
            Path.Combine(Application.persistentDataPath, SaveFileName);

        /// <summary>Bu platformda kayıt PlayerPrefs'te mi tutuluyor? (Web = evet)</summary>
        public static bool UsesPlayerPrefsStorage
        {
            get
            {
#if UNITY_WEBGL && !UNITY_EDITOR
                return true;
#else
                return false;
#endif
            }
        }

        // ─────────────────────────────────────────────────────────────
        // GENEL API
        // ─────────────────────────────────────────────────────────────

        /// <summary>
        /// Devam edilebilir bir kayıt var mı?
        /// "Devam Et" butonunun aktifliği bu fonksiyona bağlıdır.
        /// </summary>
        public static bool HasSave(SaveCheckMode mode = SaveCheckMode.File)
        {
            if (mode == SaveCheckMode.PlayerPrefsFlag)
                return PlayerPrefs.GetInt(HasSaveKey, 0) == 1;

            return StorageExists();
        }

        /// <summary>
        /// Veriyi JSON olarak kaydeder. T, [System.Serializable] işaretli bir sınıf olmalı
        /// (örn. PlayerProfile).
        /// </summary>
        public static bool Save<T>(T data) where T : class
        {
            if (data == null)
            {
                Debug.LogError("[SaveSystem] Kaydedilecek veri null.");
                return false;
            }

            try
            {
                // Web'de yer kazanmak için girintisiz, dosyada okunabilir olsun diye girintili
                string json = JsonUtility.ToJson(data, !UsesPlayerPrefsStorage);
                WriteStorage(json);

                PlayerPrefs.SetInt(HasSaveKey, 1);
                PlayerPrefs.Save(); // Web'de IndexedDB'ye yazmayı bu satır tetikler
                return true;
            }
            catch (Exception e)
            {
                Debug.LogError($"[SaveSystem] Kayıt yazılamadı: {e}");
                return false;
            }
        }

        /// <summary>
        /// Kaydı okur. Başarılıysa true döner ve data doludur.
        /// Kullanım: if (SaveSystem.TryLoad(out PlayerProfile profile)) { ... }
        /// </summary>
        public static bool TryLoad<T>(out T data) where T : class
        {
            data = null;
            if (!StorageExists()) return false;

            try
            {
                string json = ReadStorage();
                if (string.IsNullOrEmpty(json)) return false;

                data = JsonUtility.FromJson<T>(json);
                return data != null;
            }
            catch (Exception e)
            {
                Debug.LogError($"[SaveSystem] Kayıt okunamadı (bozuk olabilir): {e}");
                return false;
            }
        }

        /// <summary>Kaydı ve PlayerPrefs bayrağını tamamen siler.</summary>
        public static void DeleteSave()
        {
            try
            {
                DeleteStorage();
            }
            catch (Exception e)
            {
                Debug.LogError($"[SaveSystem] Kayıt silinemedi: {e}");
            }

            PlayerPrefs.DeleteKey(HasSaveKey);
            PlayerPrefs.Save();
        }

        // ─────────────────────────────────────────────────────────────
        // DEPOLAMA KATMANI (platforma göre)
        // ─────────────────────────────────────────────────────────────

        private static bool StorageExists()
        {
            if (UsesPlayerPrefsStorage)
                return !string.IsNullOrEmpty(PlayerPrefs.GetString(SaveJsonKey, string.Empty));

            try
            {
                var info = new FileInfo(SaveFilePath);
                return info.Exists && info.Length > 0;
            }
            catch (Exception e)
            {
                Debug.LogWarning($"[SaveSystem] Kayıt kontrolü başarısız: {e.Message}");
                return false;
            }
        }

        private static void WriteStorage(string json)
        {
            if (UsesPlayerPrefsStorage)
            {
                PlayerPrefs.SetString(SaveJsonKey, json);
                return;
            }

            // Önce geçici dosyaya yaz, sonra asıl dosyanın yerine koy.
            // Uygulama yazma sırasında kapanırsa asıl kayıt bozuk bir
            // dosyayla ezilmemiş olur.
            string tempPath = SaveFilePath + ".tmp";
            File.WriteAllText(tempPath, json);
            if (File.Exists(SaveFilePath)) File.Delete(SaveFilePath);
            File.Move(tempPath, SaveFilePath);
        }

        private static string ReadStorage()
        {
            if (UsesPlayerPrefsStorage)
                return PlayerPrefs.GetString(SaveJsonKey, string.Empty);

            return File.ReadAllText(SaveFilePath);
        }

        private static void DeleteStorage()
        {
            if (UsesPlayerPrefsStorage)
            {
                PlayerPrefs.DeleteKey(SaveJsonKey);
                return;
            }

            if (File.Exists(SaveFilePath)) File.Delete(SaveFilePath);
        }
    }
}

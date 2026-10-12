using UnityEngine;

namespace FootballCareer.Core
{
    /// <summary>
    /// Klavye kısayolları için eski Input Manager ve yeni Input System'le
    /// aynı kodun derlenmesini sağlar (Project Settings > Player > Active Input Handling).
    ///
    /// Not: Dokunma ve fare tıklaması BURADAN geçmez; onları Unity UI'ın
    /// EventSystem'i yönetir ve mobil web + masaüstü web'de aynı şekilde çalışır.
    /// Buradaki tuşlar sadece masaüstü tarayıcıda test kolaylığı içindir.
    /// </summary>
    public static class InputCompat
    {
        /// <summary>Aksiyon tuşu (Space): Şut / Müdahale.</summary>
        public static bool ActionKeyDown()
        {
#if ENABLE_LEGACY_INPUT_MANAGER
            return Input.GetKeyDown(KeyCode.Space);
#elif ENABLE_INPUT_SYSTEM
            var keyboard = UnityEngine.InputSystem.Keyboard.current;
            return keyboard != null && keyboard.spaceKey.wasPressedThisFrame;
#else
            return false;
#endif
        }

        /// <summary>Geri tuşu (Escape). Android'in geri tuşu da Escape olarak gelir.</summary>
        public static bool BackKeyDown()
        {
#if ENABLE_LEGACY_INPUT_MANAGER
            return Input.GetKeyDown(KeyCode.Escape);
#elif ENABLE_INPUT_SYSTEM
            var keyboard = UnityEngine.InputSystem.Keyboard.current;
            return keyboard != null && keyboard.escapeKey.wasPressedThisFrame;
#else
            return false;
#endif
        }
    }
}

using UnityEngine;
using UnityEngine.EventSystems;

namespace FootballCareer.Core
{
    /// <summary>
    /// Eski Input Manager ile yeni Input System'de aynı kodun derlenmesini sağlar
    /// (Project Settings > Player > Active Input Handling: "Input Manager", "Input System" ya da "Both").
    ///
    ///  • Tuşlar (Space / Escape): masaüstü tarayıcıda ve editörde test kolaylığı.
    ///  • İşaretçi (Pointer*): dokunma VE fare tek API'den gelir. Pas çizimi gibi dünya üzerinde
    ///    sürükleme gereken oyun içi girdiler içindir; menü düğmeleri yine EventSystem'den geçer.
    /// </summary>
    public static class InputCompat
    {
        // ─────────────────────────── Tuşlar ───────────────────────────

        /// <summary>Aksiyon tuşu (Space): Şut / Müdahale / Pas modu.</summary>
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

        // ─────────────────────────── İşaretçi (dokunma + fare) ───────────────────────────
        // Önce dokunma (ilk parmak), yoksa farenin sol tuşu. Konum: ekran pikseli (sol-alt = 0,0).

        /// <summary>Bu karede ekrana dokunuldu / sol tık basıldı mı?</summary>
        public static bool PointerDown(out Vector2 position)
        {
#if ENABLE_LEGACY_INPUT_MANAGER
            if (Input.touchCount > 0)
            {
                Touch t = Input.GetTouch(0);
                position = t.position;
                return t.phase == TouchPhase.Began;
            }
            position = Input.mousePosition;
            return Input.GetMouseButtonDown(0);
#elif ENABLE_INPUT_SYSTEM
            var p = UnityEngine.InputSystem.Pointer.current;
            if (p == null) { position = Vector2.zero; return false; }
            position = p.position.ReadValue();
            return p.press.wasPressedThisFrame;
#else
            position = Vector2.zero;
            return false;
#endif
        }

        /// <summary>Parmak ekranda / sol tuş basılı mı? (Bırakıldığı karede false.)</summary>
        public static bool PointerHeld(out Vector2 position)
        {
#if ENABLE_LEGACY_INPUT_MANAGER
            if (Input.touchCount > 0)
            {
                Touch t = Input.GetTouch(0);
                position = t.position;
                return t.phase != TouchPhase.Ended && t.phase != TouchPhase.Canceled;
            }
            position = Input.mousePosition;
            return Input.GetMouseButton(0);
#elif ENABLE_INPUT_SYSTEM
            var p = UnityEngine.InputSystem.Pointer.current;
            if (p == null) { position = Vector2.zero; return false; }
            position = p.position.ReadValue();
            return p.press.isPressed;
#else
            position = Vector2.zero;
            return false;
#endif
        }

        /// <summary>Bu karede parmak kalktı / sol tuş bırakıldı mı? (position = bırakılan nokta)</summary>
        public static bool PointerUp(out Vector2 position)
        {
#if ENABLE_LEGACY_INPUT_MANAGER
            if (Input.touchCount > 0)
            {
                Touch t = Input.GetTouch(0);
                position = t.position;
                return t.phase == TouchPhase.Ended || t.phase == TouchPhase.Canceled;
            }
            position = Input.mousePosition;
            return Input.GetMouseButtonUp(0);
#elif ENABLE_INPUT_SYSTEM
            var p = UnityEngine.InputSystem.Pointer.current;
            if (p == null) { position = Vector2.zero; return false; }
            position = p.position.ReadValue();
            return p.press.wasReleasedThisFrame;
#else
            position = Vector2.zero;
            return false;
#endif
        }

        /// <summary>İşaretçi bir UI öğesinin (Canvas düğmesi vb.) üzerinde mi? Öyleyse oyun içi girdi yok sayılmalı.</summary>
        public static bool IsPointerOverUI()
        {
            EventSystem es = EventSystem.current;
            if (es == null) return false;
#if ENABLE_LEGACY_INPUT_MANAGER
            if (Input.touchCount > 0) return es.IsPointerOverGameObject(Input.GetTouch(0).fingerId);
#endif
            return es.IsPointerOverGameObject();
        }
    }
}

using System;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;

namespace FootballCareer.UI
{
    /// <summary>
    /// Parmak veya fare ekrana DEĞDİĞİ AN tetiklenen buton.
    ///
    /// Neden gerekli? Normal Button.onClick, parmak KALKINCA tetiklenir. Zamanlama
    /// oyunlarında bu 100–200 ms gecikme ve "bastım ama saymadı" hissi demek.
    /// Bu bileşen basış anını yakalar; dokunmatik (mobil tarayıcı) ve fare
    /// (masaüstü tarayıcı) için aynı şekilde çalışır.
    ///
    /// Kullanım: Bir Button objesine ekle. Button sadece görsel geri bildirim
    /// (basılı rengi, Disabled rengi) için kalır; onClick'ine bir şey bağlama.
    /// </summary>
    [DisallowMultipleComponent]
    public class TapInputButton : MonoBehaviour, IPointerDownHandler
    {
        [Tooltip("Aynı objedeki Button. interactable=false iken basışlar yok sayılır. " +
                 "Boş bırakılırsa otomatik bulunur.")]
        [SerializeField] private Selectable selectable;

        /// <summary>Basış anında tetiklenir.</summary>
        public event Action Pressed;

        public bool Interactable
        {
            get
            {
                Selectable s = GetSelectable();
                return s == null || s.IsInteractable();
            }
            set
            {
                Selectable s = GetSelectable();
                if (s != null) s.interactable = value;
            }
        }

        // Editörde bileşen eklenince otomatik doldurur
        private void Reset()
        {
            selectable = GetComponent<Selectable>();
        }

        public void OnPointerDown(PointerEventData eventData)
        {
            // Fare: sadece sol tık. Dokunmatik basışlar Unity'de "Left" olarak gelir.
            if (eventData.button != PointerEventData.InputButton.Left) return;
            if (!Interactable) return;

            Action handler = Pressed;
            if (handler != null) handler();
        }

        private Selectable GetSelectable()
        {
            // Kod ile AddComponent edildiyse veya alan boşsa burada bulunur
            if (selectable == null) selectable = GetComponent<Selectable>();
            return selectable;
        }
    }
}

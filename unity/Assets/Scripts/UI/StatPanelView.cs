using FootballCareer.Core;
using UnityEngine;

namespace FootballCareer.UI
{
    /// <summary>
    /// 5 StatBarView'ı tek seferde yönetir. Çocuklarındaki barları kendisi bulur;
    /// Inspector'da tek tek bağlamana gerek yok. Her barın "Stat" alanını
    /// doğru seçmen yeterli.
    /// </summary>
    public class StatPanelView : MonoBehaviour
    {
        private StatBarView[] bars;

        private void Awake()
        {
            CacheBars();
        }

        public void Show(PlayerStats stats, bool instant = false)
        {
            CacheBars();
            foreach (StatBarView bar in bars) bar.Show(stats, instant);
        }

        /// <summary>Mevkinin ana ve yan statlarını renkle vurgular.</summary>
        public void HighlightForPosition(PlayerPosition position)
        {
            CacheBars();
            StatType primary   = PositionPresets.GetPrimaryStat(position);
            StatType secondary = PositionPresets.GetSecondaryStat(position);

            foreach (StatBarView bar in bars)
                bar.SetHighlighted(bar.Stat == primary || bar.Stat == secondary);
        }

        public void ClearHighlights()
        {
            CacheBars();
            foreach (StatBarView bar in bars) bar.SetHighlighted(false);
        }

        private void CacheBars()
        {
            // Panel kapalıyken de çağrılabilir; o yüzden Awake'e güvenmiyoruz
            if (bars == null) bars = GetComponentsInChildren<StatBarView>(true);
        }
    }
}

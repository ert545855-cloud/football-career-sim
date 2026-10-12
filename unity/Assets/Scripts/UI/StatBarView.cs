using FootballCareer.Core;
using TMPro;
using UnityEngine;
using UnityEngine.UI;

namespace FootballCareer.UI
{
    /// <summary>
    /// Tek bir özelliği (örn. Şut) "etiket + sayı + dolum barı" olarak gösterir.
    /// Hem oyuncu oluşturma önizlemesinde hem kariyer ekranında kullanılır.
    /// </summary>
    public class StatBarView : MonoBehaviour
    {
        [Tooltip("Bu bar hangi özelliği gösteriyor?")]
        [SerializeField] private StatType stat;

        [SerializeField] private TMP_Text labelText;
        [SerializeField] private TMP_Text valueText;

        [Tooltip("Image Type = Filled, Fill Method = Horizontal olmalı.")]
        [SerializeField] private Image fillImage;

        [Tooltip("Barın hedef değere kayma hızı (saniyede tam bar). 0 = anında.")]
        [SerializeField] private float animationSpeed = 2f;

        [Header("Vurgu (mevkinin öne çıkan statları)")]
        [SerializeField] private Color normalLabelColor    = Color.white;
        [SerializeField] private Color highlightLabelColor = new Color(1f, 0.82f, 0.25f);

        private float targetFill;

        public StatType Stat => stat;

        private void Awake()
        {
            if (labelText != null) labelText.text = stat.ToDisplayName();
        }

        public void Show(PlayerStats stats, bool instant = false)
        {
            if (stats == null) return;
            SetValue(stats.Get(stat), instant);
        }

        public void SetValue(int value, bool instant = false)
        {
            if (valueText != null) valueText.text = value.ToString();

            targetFill = Mathf.Clamp01(value / (float)PlayerStats.MaxValue);

            // Obje kapalıyken Update çalışmaz; o durumda da doğrudan uygula
            if (instant || animationSpeed <= 0f || !isActiveAndEnabled)
                ApplyFill(targetFill);
        }

        public void SetHighlighted(bool highlighted)
        {
            if (labelText != null)
                labelText.color = highlighted ? highlightLabelColor : normalLabelColor;
        }

        private void Update()
        {
            if (fillImage == null || Mathf.Approximately(fillImage.fillAmount, targetFill)) return;

            fillImage.fillAmount = Mathf.MoveTowards(
                fillImage.fillAmount, targetFill, animationSpeed * Time.unscaledDeltaTime);
        }

        private void ApplyFill(float value)
        {
            if (fillImage != null) fillImage.fillAmount = value;
        }
    }
}

using System;
using System.Collections.Generic;
using FootballCareer.Core;
using FootballCareer.MiniGames;
using TMPro;
using UnityEngine;
using UnityEngine.UI;

namespace FootballCareer.UI
{
    /// <summary>
    /// "CareerHub" sahnesinin yöneticisi: profil özeti, enerji, 3 mini oyun girişi.
    ///
    /// - Sahne açılınca profili GameSession'dan alır (yoksa kayıttan yükler,
    ///   o da yoksa Ana Menü'ye döner).
    /// - Mini oyunları açar, sonuçlarını dinler, mevki çarpanlı gelişimi uygular
    ///   ve her denemeden sonra kaydeder.
    /// </summary>
    public class MiniGameHubUI : MonoBehaviour
    {
        [Header("Profil Özeti")]
        [SerializeField] private TMP_Text playerNameText;
        [SerializeField] private TMP_Text positionText;
        [SerializeField] private StatPanelView statPanel;

        [Header("Enerji (Dayanıklılık)")]
        [Tooltip("Image Type = Filled, Horizontal.")]
        [SerializeField] private Image energyFill;
        [SerializeField] private TMP_Text energyText;
        [SerializeField] private Button restButton;

        [Header("Mini Oyunlar")]
        [SerializeField] private ShootingMiniGame shootingGame;
        [SerializeField] private PassingMiniGame  passingGame;
        [SerializeField] private DefenseMiniGame  defenseGame;
        [SerializeField] private Button shootingButton;
        [SerializeField] private Button passingButton;
        [SerializeField] private Button defenseButton;
        [Tooltip("Mini oyun açıkken gizlenecek Hub içeriği (opsiyonel).")]
        [SerializeField] private GameObject hubContent;

        [Header("Gelişim (mevki çarpanlı)")]
        [Tooltip("Başarılı denemede ana stat'a eklenen temel gelişim. " +
                 "İsabetle ve mevki çarpanıyla ölçeklenir. 0 = gelişim kapalı (saf test).")]
        [SerializeField] private float trainingPerSuccess = 0.5f;

        [Header("Günlük")]
        [SerializeField] private TMP_Text logText;
        [SerializeField] private int maxLogLines = 6;

        [Header("Gezinme")]
        [SerializeField] private Button backToMenuButton;

        private readonly List<string> logLines = new List<string>();
        private MiniGameBase[] games;
        private MiniGameBase activeGame;
        private int attempts;
        private int successes;

        // ─────────────────────────────────────────────────────────────
        // UNITY YAŞAM DÖNGÜSÜ
        // ─────────────────────────────────────────────────────────────

        private void Awake()
        {
            games = new MiniGameBase[] { shootingGame, passingGame, defenseGame };

            foreach (MiniGameBase game in games)
            {
                if (game == null) continue;
                game.RoundStarted   += OnRoundStarted;
                game.RoundCompleted += OnRoundCompleted;
                game.Closed         += OnGameClosed;
                game.gameObject.SetActive(false); // paneller kapalı başlasın
            }

            Bind(shootingButton,   () => OpenGame(shootingGame));
            Bind(passingButton,    () => OpenGame(passingGame));
            Bind(defenseButton,    () => OpenGame(defenseGame));
            Bind(restButton,       Rest);
            Bind(backToMenuButton, BackToMenu);
        }

        private void Start()
        {
            if (!GameSession.EnsureLoaded())
            {
                Debug.LogWarning("[Hub] Profil bulunamadı, Ana Menü'ye dönülüyor.");
                SceneLoader.Load(SceneNames.MainMenu);
                return;
            }

            GameSession.ProfileChanged += OnProfileChanged;

            PlayerProfile profile = GameSession.Current;
            RefreshAll(instant: true);
            MarkRecommendedGame(profile.Position);
            AddLog($"Hoş geldin {profile.PlayerName}! Mevkin: {profile.Position.ToDisplayName()}.");
        }

        private void Update()
        {
            // Geri tuşu: açık mini oyunu kapat
            if (activeGame != null && InputCompat.BackKeyDown())
                activeGame.Close();
        }

        private void OnDestroy()
        {
            GameSession.ProfileChanged -= OnProfileChanged;

            if (games == null) return;
            foreach (MiniGameBase game in games)
            {
                if (game == null) continue;
                game.RoundStarted   -= OnRoundStarted;
                game.RoundCompleted -= OnRoundCompleted;
                game.Closed         -= OnGameClosed;
            }
        }

        // ─────────────────────────────────────────────────────────────
        // MİNİ OYUN AKIŞI
        // ─────────────────────────────────────────────────────────────

        public void OpenGame(MiniGameBase game)
        {
            if (game == null)
            {
                Debug.LogWarning("[Hub] Bu mini oyun Inspector'da atanmamış.");
                return;
            }

            if (activeGame != null && activeGame != game) activeGame.Close();

            activeGame = game;
            SetActiveSafe(hubContent, false);
            game.Open(GameSession.Current);
        }

        private void OnGameClosed(MiniGameBase game)
        {
            if (activeGame == game) activeGame = null;
            SetActiveSafe(hubContent, true);
            RefreshAll(instant: false);
        }

        private void OnRoundStarted(MiniGameBase game)
        {
            // Enerji harcandı: hemen kaydet ki sayfa yenilemek enerji kazandırmasın
            GameSession.Save();
            RefreshEnergy();
        }

        private void OnRoundCompleted(MiniGameBase game, MiniGameResult result)
        {
            attempts++;
            if (result.Success) successes++;

            PlayerProfile profile = GameSession.Current;
            string line = $"{game.DisplayName}: {(result.Success ? "BAŞARILI" : "BAŞARISIZ")} - {result.Message}";

            if (result.Success && trainingPerSuccess > 0f && profile != null)
            {
                // İsabet iyi olunca daha çok gelişim; mevki çarpanı ApplyTraining içinde
                float amount = trainingPerSuccess * Mathf.Lerp(0.5f, 1f, result.Accuracy);
                int gained   = profile.ApplyTraining(result.TrainedStat, amount);

                if (gained > 0)
                    line += $"  (+{gained} {result.TrainedStat.ToDisplayName()}!)";
            }

            AddLog(line);
            GameSession.Save();
            RefreshAll(instant: false);
        }

        // ─────────────────────────────────────────────────────────────
        // BUTONLAR
        // ─────────────────────────────────────────────────────────────

        public void Rest()
        {
            PlayerProfile profile = GameSession.Current;
            if (profile == null) return;

            profile.RestoreEnergyFull();
            GameSession.Save();
            RefreshEnergy();
            AddLog("Dinlendin, enerjin doldu.");
        }

        public void BackToMenu()
        {
            if (activeGame != null) activeGame.Close();
            GameSession.Save();
            SceneLoader.Load(SceneNames.MainMenu);
        }

        // ─────────────────────────────────────────────────────────────
        // GÖRÜNÜM
        // ─────────────────────────────────────────────────────────────

        private void OnProfileChanged(PlayerProfile profile)
        {
            RefreshAll(instant: false);
        }

        private void RefreshAll(bool instant)
        {
            PlayerProfile profile = GameSession.Current;
            if (profile == null) return;

            SetText(playerNameText, profile.PlayerName);
            SetText(positionText, profile.Position.ToDisplayName());

            if (statPanel != null)
            {
                statPanel.Show(profile.Stats, instant);
                statPanel.HighlightForPosition(profile.Position);
            }

            RefreshEnergy();
        }

        private void RefreshEnergy()
        {
            PlayerProfile profile = GameSession.Current;
            if (profile == null) return;

            if (energyFill != null) energyFill.fillAmount = profile.EnergyNormalized;
            SetText(energyText, $"Enerji {Mathf.RoundToInt(profile.Energy)}/{Mathf.RoundToInt(PlayerProfile.MaxEnergy)}");
            if (restButton != null) restButton.interactable = profile.Energy < PlayerProfile.MaxEnergy;
        }

        /// <summary>Mevkiye uygun testin butonuna "Mevkine uygun" notu ekler.</summary>
        private void MarkRecommendedGame(PlayerPosition position)
        {
            Button recommended;
            switch (position)
            {
                case PlayerPosition.Forward:    recommended = shootingButton; break;
                case PlayerPosition.Midfielder: recommended = passingButton;  break;
                case PlayerPosition.Defender:   recommended = defenseButton;  break;
                default:                        recommended = null;           break;
            }

            if (recommended == null) return;

            TMP_Text label = recommended.GetComponentInChildren<TMP_Text>(true);
            if (label != null) label.text += "\n<size=70%>Mevkine uygun</size>";
        }

        private void AddLog(string line)
        {
            logLines.Insert(0, line);
            while (logLines.Count > Mathf.Max(1, maxLogLines)) logLines.RemoveAt(logLines.Count - 1);

            if (logText == null) return;

            string header = attempts > 0 ? $"Bu oturum: {successes}/{attempts} başarılı\n" : string.Empty;
            logText.text  = header + string.Join("\n", logLines.ToArray());
        }

        // ─────────────────────────────────────────────────────────────

        private static void Bind(Button button, Action action)
        {
            if (button != null) button.onClick.AddListener(() => action());
        }

        private static void SetText(TMP_Text target, string value)
        {
            if (target != null) target.text = value;
        }

        private static void SetActiveSafe(GameObject target, bool active)
        {
            if (target != null) target.SetActive(active);
        }
    }
}

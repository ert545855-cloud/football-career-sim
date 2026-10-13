using System;
using System.Collections.Generic;
using UnityEngine;

namespace FootballCareer.Passing.Levels
{
    public enum LevelState
    {
        /// <summary>Bölüm yüklü değil (menü).</summary>
        None,
        /// <summary>Bölüm kuruldu, tanıtım kartı gösteriliyor; oyun bekliyor.</summary>
        Intro,
        Playing,
        Won,
        Lost,
    }

    /// <summary>
    /// BÖLÜM YÖNETİCİSİ — bir PassLevel'ı sahaya kurar, PasManager'ın sonuçlarını dinleyip hedefi, puanı,
    /// canları ve yıldızları yönetir; en iyi sonucu LevelProgress'e kaydeder.
    ///
    /// Deneme mantığı (Score! Hero gibi): başarısız pas/şut = 1 can gider, pozisyon baştan kurulur, deneme
    /// puanı sıfırlanır. Hedefi tamamlayan denemenin puanı yıldızları belirler.
    /// UI'dan bağımsızdır: durumu ve olayları dinleyip kendi arayüzünüzü çizin (demo IMGUI ile çizer).
    /// </summary>
    [DisallowMultipleComponent]
    public class LevelRunner : MonoBehaviour
    {
        [SerializeField] private PasManager manager;
        [Tooltip("Bölümler (sırayla). Boşsa hazır bölümler (BuiltInLevels) kullanılır.")]
        [SerializeField] private List<PassLevel> levels = new List<PassLevel>();
        [Tooltip("IFormationSpawner uygulayan bileşen (ör. PrefabFormationSpawner). Kodla SetSpawner da kullanılabilir.")]
        [SerializeField] private MonoBehaviour spawnerBehaviour;

        /// <summary>Durum, puan, can ya da mesaj değişti (UI tazelemek için).</summary>
        public event Action<LevelRunner> Changed;
        /// <summary>Bölüm kazanıldı: yıldız sayısı.</summary>
        public event Action<PassLevel, int> LevelWon;
        public event Action<PassLevel> LevelLost;

        public IList<PassLevel> Levels { get { return levels; } }
        public PassLevel Current { get { return current; } }
        public int CurrentIndex { get { return currentIndex; } }
        public LevelState State { get { return state; } }
        /// <summary>Bu denemenin puanı.</summary>
        public int Score { get { return score; } }
        public int LivesLeft { get { return livesLeft; } }
        /// <summary>Bu denemede atılan isabetli pas sayısı.</summary>
        public int PassesUsed { get { return passesUsed; } }
        /// <summary>Kazanınca alınan yıldız.</summary>
        public int StarsEarned { get { return starsEarned; } }
        public bool NewBest { get { return newBest; } }
        /// <summary>Son sonuçla ilgili kısa mesaj (UI).</summary>
        public string Message { get { return message; } }
        public bool HasNext { get { return currentIndex + 1 < levels.Count && LevelProgress.IsUnlocked(levels, currentIndex + 1); } }

        private IFormationSpawner spawner;
        private PassLevel current;
        private int currentIndex = -1;
        private LevelState state = LevelState.None;
        private int score, livesLeft, passesUsed, completedPasses, starsEarned;
        private bool newBest;
        private string message = "";

        private void Awake()
        {
            if (levels.Count == 0) levels.AddRange(BuiltInLevels.Create());
            if (spawner == null && spawnerBehaviour != null) spawner = spawnerBehaviour as IFormationSpawner;
        }

        private void OnEnable() { if (manager != null) manager.PassFinished += OnPassFinished; }
        private void OnDisable() { if (manager != null) manager.PassFinished -= OnPassFinished; }

        /// <summary>Kodla kurulum.</summary>
        public void Setup(PasManager passManager, IFormationSpawner formationSpawner)
        {
            if (manager != null) manager.PassFinished -= OnPassFinished;
            manager = passManager;
            spawner = formationSpawner;
            if (manager != null && isActiveAndEnabled) manager.PassFinished += OnPassFinished;
        }

        // ─────────────────────────── Akış ───────────────────────────

        /// <summary>Bölümü kurar ve tanıtım kartına geçer (oyun StartPlay ile başlar).</summary>
        public bool Load(int index)
        {
            if (index < 0 || index >= levels.Count || manager == null || spawner == null) return false;
            if (!LevelProgress.IsUnlocked(levels, index)) return false;

            current = levels[index];
            currentIndex = index;
            FormationHandles f = spawner.Spawn(current);

            manager.SetSlowTimeScale(current.slowTimeScale);
            manager.SetPressersCount(current.pressersCount);
            for (int i = 0; i < f.enemies.Count; i++) f.enemies[i].SetSpeeds(current.enemyPressSpeed, current.enemyInterceptSpeed);
            if (f.keeper != null) f.keeper.SetSkill(current.keeperSkill);
            manager.SetGoal(manager.TargetGoal, f.keeper);
            manager.LoadFormation(f.passer, f.teammates, f.enemies, f.keeper);
            manager.enabled = false; // tanıtım kartı kapanana kadar girdi yok

            livesLeft = current.lives;
            starsEarned = 0;
            newBest = false;
            ResetAttempt();
            message = current.ObjectiveText();
            SetState(LevelState.Intro);
            return true;
        }

        /// <summary>Tanıtım kartı kapandı: oyun başlasın.</summary>
        public void StartPlay()
        {
            if (state != LevelState.Intro) return;
            manager.enabled = true;
            SetState(LevelState.Playing);
        }

        public void Retry() { Load(currentIndex); }

        public bool Next() { return HasNext && Load(currentIndex + 1); }

        /// <summary>Menüye dön: oyuncuları kaldır.</summary>
        public void Quit()
        {
            if (manager != null) manager.enabled = false;
            if (spawner != null) spawner.Despawn();
            current = null;
            currentIndex = -1;
            SetState(LevelState.None);
        }

        // ─────────────────────────── Sonuçlar ───────────────────────────

        private void OnPassFinished(PassResult r)
        {
            if (state != LevelState.Playing || current == null) return;
            bool free = current.objective == LevelObjective.FreePlay;

            if (r.outcome == PassOutcome.Completed)
            {
                passesUsed++;
                completedPasses++;
                score += LevelScoring.PassPoints(r.curve, r.pathLength);
                message = "İsabetli pas! +" + LevelScoring.PassPoints(r.curve, r.pathLength);
                if (!free && current.passBudget > 0 && current.NeedsGoal && passesUsed > current.passBudget)
                {
                    FailAttempt("Pas hakkın bitti, gol atmalıydın!", true);
                    return;
                }
                if (current.objective == LevelObjective.CompletePasses && completedPasses >= current.targetCount) Win();
                else Changed?.Invoke(this);
                return;
            }

            if (r.outcome == PassOutcome.Goal)
            {
                int pts = GoalPoints(r);
                score += pts;
                if (free)
                {
                    message = r.Describe() + " +" + pts;
                    ResetAttempt();
                    Changed?.Invoke(this);
                    return;
                }
                string why;
                if (GoalMeetsObjective(r, out why))
                {
                    message = r.Describe() + " +" + pts;
                    Win();
                }
                else
                {
                    // Gol var ama bölümün istediği gol değil: can gitmez, yeniden dene
                    message = why;
                    ResetAttempt();
                    Changed?.Invoke(this);
                }
                return;
            }

            // Başarısız pas / şut
            if (free)
            {
                message = r.Describe();
                ResetAttempt();
                Changed?.Invoke(this);
                return;
            }
            FailAttempt(r.Describe(), false);
        }

        private bool GoalMeetsObjective(PassResult r, out string why)
        {
            why = "";
            switch (current.objective)
            {
                case LevelObjective.ScoreGoal:
                    return true;
                case LevelObjective.ScoreCurvedGoal:
                    why = "Gol! Ama bu bölümde falsolu bir vuruş lazım.";
                    return LevelScoring.IsCurved(r.curve);
                case LevelObjective.ScoreLongRange:
                    why = "Gol! Ama en az " + current.targetCount + " metreden vurmalısın.";
                    return r.pathLength >= current.targetCount;
                case LevelObjective.CompletePasses:
                    why = "Güzel gol, ama bu bölümde hedef pas!";
                    return false;
                default:
                    return false;
            }
        }

        private int GoalPoints(PassResult r)
        {
            GoalFrame g = manager.TargetGoal;
            Vector2 mouth = g != null ? g.MouthCoords(r.point) : Vector2.zero;
            float w = g != null ? g.Width : 7.32f, h = g != null ? g.Height : 2.44f;
            return LevelScoring.GoalPoints(r.curve, r.pathLength, mouth, w, h);
        }

        /// <param name="forceReset">Başarılı pas olduğu hâlde deneme bittiyse (pas sınırı) dizilişi biz sıfırlarız.</param>
        private void FailAttempt(string why, bool forceReset)
        {
            livesLeft--;
            message = why;
            ResetAttempt();
            if (livesLeft <= 0)
            {
                manager.enabled = false;
                SetState(LevelState.Lost);
                LevelLost?.Invoke(current);
                return;
            }
            // Başarısız sonuçlarda PasManager dizilişi kendisi sıfırlar (autoResetOnFail)
            if (forceReset) manager.ResetPlay();
            Changed?.Invoke(this);
        }

        private void Win()
        {
            int finalScore = score;
            starsEarned = LevelScoring.Stars(true, finalScore, current.twoStarScore, current.threeStarScore);
            newBest = LevelProgress.Submit(current.id, starsEarned, finalScore);
            manager.enabled = false; // top ağlarda/arkadaşta kalsın, girdi dursun
            SetState(LevelState.Won);
            LevelWon?.Invoke(current, starsEarned);
        }

        private void ResetAttempt()
        {
            score = 0;
            passesUsed = 0;
            completedPasses = 0;
        }

        private void SetState(LevelState s)
        {
            state = s;
            Changed?.Invoke(this);
        }
    }
}

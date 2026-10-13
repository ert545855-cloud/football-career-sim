using UnityEngine;

namespace FootballCareer.Passing.Levels
{
    /// <summary>Bölümün kazanma şartı.</summary>
    public enum LevelObjective
    {
        /// <summary>targetCount kadar isabetli pas.</summary>
        CompletePasses,
        /// <summary>Gol at (passBudget > 0 ise en fazla o kadar pasla).</summary>
        ScoreGoal,
        /// <summary>Falsolu (kavisli) bir golle skor yap.</summary>
        ScoreCurvedGoal,
        /// <summary>En az targetCount metreden gol at.</summary>
        ScoreLongRange,
        /// <summary>Serbest oyun: bitmez, can gitmez.</summary>
        FreePlay,
    }

    /// <summary>
    /// PAS/ŞUT BÖLÜMÜ (Score! Hero tarzı). Diziliş, hedef, can sayısı, yıldız eşikleri ve zorluk.
    ///
    /// Proje penceresinde: Create > Football Career > Pas Bölümü. Ya da kodla:
    /// <c>ScriptableObject.CreateInstance&lt;PassLevel&gt;()</c> (bkz. BuiltInLevels).
    ///
    /// Koordinatlar: zemin (y = 0), saha merkezi (0,0,0), hücum edilen kale +z ucunda (z = +52.5).
    /// </summary>
    [CreateAssetMenu(menuName = "Football Career/Pas Bölümü", fileName = "PassLevel")]
    public class PassLevel : ScriptableObject
    {
        [Header("Kimlik")]
        [Tooltip("Kayıt anahtarı — yayından sonra DEĞİŞTİRMEYİN (yıldızlar bu kimlikle saklanır).")]
        public string id = "level-01";
        public string title = "İlk Pas";
        [TextArea(2, 4)] public string description = "";

        [Header("Hedef")]
        public LevelObjective objective = LevelObjective.ScoreGoal;
        [Tooltip("CompletePasses: gereken isabetli pas. ScoreLongRange: en az şut mesafesi (metre).")]
        public int targetCount = 1;
        [Tooltip("Golden önce en fazla kaç pas (0 = sınırsız). Aşılırsa deneme başarısız.")]
        public int passBudget = 0;
        [Tooltip("Başarısız deneme hakkı.")]
        [Range(1, 5)] public int lives = 3;

        [Header("Yıldızlar (hedef tamamlanınca 1 yıldız)")]
        public int twoStarScore = 700;
        public int threeStarScore = 1000;

        [Header("Diziliş")]
        public Vector3 passer = new Vector3(0f, 0f, 10f);
        public Vector3[] teammates = new Vector3[0];
        public Vector3[] enemies = new Vector3[0];
        public bool hasKeeper = true;
        [Range(0f, 1f)] public float keeperSkill = 0.6f;

        [Header("Zorluk")]
        [Range(0.05f, 1f)] public float slowTimeScale = 0.15f;
        [Tooltip("Rakiplerin baskı hızı (m/sn).")]
        public float enemyPressSpeed = 7.5f;
        [Tooltip("Rakiplerin araya girme hızı (m/sn).")]
        public float enemyInterceptSpeed = 8.5f;
        [Tooltip("Çizim başlayınca baskıya koşan rakip sayısı (0 = baraj gibi yerinde dururlar).")]
        [Range(0, 4)] public int pressersCount = 2;

        /// <summary>Ekranda gösterilecek hedef cümlesi.</summary>
        public string ObjectiveText()
        {
            switch (objective)
            {
                case LevelObjective.CompletePasses:
                    return targetCount + " isabetli pas yap";
                case LevelObjective.ScoreGoal:
                    return passBudget > 0 ? "En fazla " + passBudget + " pasla gol at" : "Gol at";
                case LevelObjective.ScoreCurvedGoal:
                    return "Falsolu bir vuruşla gol at";
                case LevelObjective.ScoreLongRange:
                    return targetCount + " metreden uzaktan gol at";
                default:
                    return "Serbest oyun: pas ver, şut çek";
            }
        }

        /// <summary>Hedef gol mü gerektiriyor?</summary>
        public bool NeedsGoal
        {
            get
            {
                return objective == LevelObjective.ScoreGoal || objective == LevelObjective.ScoreCurvedGoal
                    || objective == LevelObjective.ScoreLongRange;
            }
        }

        /// <summary>Kodla bölüm üretmek için kısayol.</summary>
        public static PassLevel Create(string id, string title, string description, LevelObjective objective, int targetCount,
                                       Vector3 passer, Vector3[] teammates, Vector3[] enemies, float keeperSkill,
                                       int twoStars, int threeStars)
        {
            PassLevel l = CreateInstance<PassLevel>();
            l.name = id;
            l.id = id;
            l.title = title;
            l.description = description;
            l.objective = objective;
            l.targetCount = targetCount;
            l.passer = passer;
            l.teammates = teammates ?? new Vector3[0];
            l.enemies = enemies ?? new Vector3[0];
            l.hasKeeper = keeperSkill >= 0f;
            l.keeperSkill = Mathf.Clamp01(keeperSkill);
            l.twoStarScore = twoStars;
            l.threeStarScore = threeStars;
            return l;
        }
    }
}

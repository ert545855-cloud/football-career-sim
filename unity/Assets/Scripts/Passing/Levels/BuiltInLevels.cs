using System.Collections.Generic;
using UnityEngine;

namespace FootballCareer.Passing.Levels
{
    /// <summary>
    /// Hazır bölümler (kodla üretilir; asset gerekmez). Kendi bölümlerinizi Create > Football Career > Pas Bölümü
    /// ile oluşturup LevelRunner'ın listesine ekleyebilirsiniz; liste boşsa bunlar kullanılır.
    /// Zorluk sırası: pas → kavisli pas → ilk gol → ver-kaç → falso → kalabalık savunma → uzaktan → final.
    /// </summary>
    public static class BuiltInLevels
    {
        private static Vector3 V(float x, float z) { return new Vector3(x, 0f, z); }

        public static List<PassLevel> Create()
        {
            var list = new List<PassLevel>(9);

            list.Add(PassLevel.Create("l01-ilk-pas", "İlk Pas",
                "Ağır çekimde topa dokun, arkadaşına doğru çiz ve bırak. Çizgi yeşilse yol temiz.",
                LevelObjective.CompletePasses, 2,
                V(0f, 0f), new[] { V(-12f, 10f), V(10f, 18f) }, new[] { V(3f, 9f) }, 0.45f, 300, 380));

            list.Add(PassLevel.Create("l02-rakibi-dolan", "Rakibi Dolan Pas",
                "Rakip tam arada! Çizgiyi onun etrafından kavisli çiz; top da o kavisle döner.",
                LevelObjective.CompletePasses, 1,
                V(0f, 4f), new[] { V(0f, 24f) }, new[] { V(0f, 14f), V(9f, 20f) }, 0.45f, 180, 210));

            list.Add(PassLevel.Create("l03-ilk-gol", "İlk Gol",
                "Çizgiyi kale ağzına çek: çizgi sarıya döner, bu bir şut. Köşeler kaleciye zor gelir.",
                LevelObjective.ScoreGoal, 1,
                V(0f, 30f), new Vector3[0], new[] { V(-3f, 38f) }, 0.45f, 700, 850));

            PassLevel l4 = PassLevel.Create("l04-ver-kac", "Ver-Kaç",
                "Tek pasla arkadaşını boşa çıkar, o da bitirsin.",
                LevelObjective.ScoreGoal, 1,
                V(-10f, 22f), new[] { V(6f, 34f) }, new[] { V(-4f, 30f), V(2f, 41f), V(10f, 28f) }, 0.55f, 800, 1000);
            l4.passBudget = 1;
            list.Add(l4);

            PassLevel l5 = PassLevel.Create("l05-falso", "Falsolu Vuruş",
                "Baraj kaleyi kapattı. Topu barajın dışından kavisle kaleye sok.",
                LevelObjective.ScoreCurvedGoal, 1,
                V(-14f, 34f), new Vector3[0], new[] { V(-10.5f, 39.5f), V(-9f, 40.5f), V(-7.5f, 41.5f) }, 0.6f, 850, 1000);
            l5.pressersCount = 0; // baraj yerinde durur
            list.Add(l5);

            PassLevel l6 = PassLevel.Create("l06-kalabalik", "Kalabalık Savunma",
                "Altı savunmacı, en fazla üç pas. Rakipler hızlı basıyor, çizimde oyalanma.",
                LevelObjective.ScoreGoal, 1,
                V(0f, 5f), new[] { V(-14f, 20f), V(13f, 24f), V(-3f, 32f) },
                new[] { V(-4f, 12f), V(6f, 15f), V(-9f, 27f), V(6f, 30f), V(0f, 40f), V(-6f, 44f) }, 0.65f, 1000, 1300);
            l6.passBudget = 3;
            l6.enemyPressSpeed = 8f;
            list.Add(l6);

            list.Add(PassLevel.Create("l07-uzaktan", "Uzaktan Füze",
                "25 metreden uzaktan bir şutla ağları havalandır.",
                LevelObjective.ScoreLongRange, 25,
                V(0f, 22f), new Vector3[0], new[] { V(-6f, 30f), V(5f, 33f) }, 0.55f, 830, 1000));

            PassLevel l8 = PassLevel.Create("l08-final", "Final",
                "Kupa finali, son dakika. Yedi rakip, usta bir kaleci ve yalnızca iki hakkın var.",
                LevelObjective.ScoreGoal, 1,
                V(0f, -5f), new[] { V(-16f, 12f), V(15f, 18f), V(-4f, 26f), V(8f, 36f) },
                new[] { V(-3f, 4f), V(5f, 8f), V(-10f, 18f), V(9f, 25f), V(-2f, 32f), V(4f, 42f), V(-6f, 44f) }, 0.85f, 1300, 1700);
            l8.passBudget = 4;
            l8.lives = 2;
            l8.slowTimeScale = 0.2f;
            l8.enemyPressSpeed = 8.5f;
            l8.enemyInterceptSpeed = 9f;
            list.Add(l8);

            PassLevel free = PassLevel.Create("free-play", "Serbest Oyun",
                "Süre ve can yok: pas ver, şut çek, dene.",
                LevelObjective.FreePlay, 0,
                V(0f, 8f), new[] { V(-15f, 22f), V(14f, 24f), V(-2f, 34f) },
                new[] { V(-4f, 14f), V(6f, 17f), V(-9f, 28f), V(6f, 31f), V(1f, 42f) }, 0.6f, int.MaxValue, int.MaxValue);
            free.lives = 5;
            list.Add(free);

            return list;
        }
    }
}

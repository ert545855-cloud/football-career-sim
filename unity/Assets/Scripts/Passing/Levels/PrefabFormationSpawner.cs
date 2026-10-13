using System.Collections.Generic;
using UnityEngine;

namespace FootballCareer.Passing.Levels
{
    /// <summary>
    /// Bölüm dizilişini KENDİ PREFAB'LARINIZLA kurar.
    ///  • teammatePrefab: PassReceiver + collider (pasör de bundan üretilir).
    ///  • enemyPrefab   : NavMeshAgent + EnemyAI + collider.
    ///  • keeperPrefab  : GoalkeeperAI + collider (goal alanı bu bileşendeki kaleye bağlanır).
    /// Oyuncular sahaya bakacak şekilde (pasör kaleye, rakipler pasöre) döndürülür.
    /// </summary>
    [DisallowMultipleComponent]
    public class PrefabFormationSpawner : MonoBehaviour, IFormationSpawner
    {
        [SerializeField] private PassReceiver teammatePrefab;
        [SerializeField] private EnemyAI enemyPrefab;
        [SerializeField] private GoalkeeperAI keeperPrefab;
        [Tooltip("Kalecinin koruyacağı kale (hücum edilen kale).")]
        [SerializeField] private GoalFrame goal;
        [Tooltip("Üretilen oyuncuların ebeveyni (boşsa bu nesne).")]
        [SerializeField] private Transform container;

        private readonly List<GameObject> spawned = new List<GameObject>(16);

        public FormationHandles Spawn(PassLevel level)
        {
            Despawn();
            Transform parent = container != null ? container : transform;
            Vector3 goalPos = goal != null ? goal.Center : new Vector3(0f, 0f, 52.5f);

            var h = new FormationHandles
            {
                teammates = new List<PassReceiver>(level.teammates.Length + 1),
                enemies = new List<EnemyAI>(level.enemies.Length),
            };

            PassReceiver p = Instantiate(teammatePrefab, level.passer, Face(level.passer, goalPos), parent);
            p.name = "Pasör";
            spawned.Add(p.gameObject);
            h.passer = p.transform;
            h.teammates.Add(p);

            for (int i = 0; i < level.teammates.Length; i++)
            {
                PassReceiver r = Instantiate(teammatePrefab, level.teammates[i], Face(level.teammates[i], level.passer), parent);
                r.name = "Arkadaş " + (i + 1);
                spawned.Add(r.gameObject);
                h.teammates.Add(r);
            }
            for (int i = 0; i < level.enemies.Length; i++)
            {
                EnemyAI e = Instantiate(enemyPrefab, level.enemies[i], Face(level.enemies[i], level.passer), parent);
                e.name = "Rakip " + (i + 1);
                spawned.Add(e.gameObject);
                h.enemies.Add(e);
            }
            if (level.hasKeeper && keeperPrefab != null && goal != null)
            {
                GoalkeeperAI k = Instantiate(keeperPrefab, goal.Center + goal.Normal * 0.5f, Quaternion.LookRotation(goal.Normal), parent);
                k.name = "Kaleci";
                k.Setup(goal, null, level.keeperSkill);
                spawned.Add(k.gameObject);
                h.keeper = k;
            }
            return h;
        }

        public void Despawn()
        {
            for (int i = 0; i < spawned.Count; i++) if (spawned[i] != null) Destroy(spawned[i]);
            spawned.Clear();
        }

        private static Quaternion Face(Vector3 from, Vector3 to)
        {
            Vector3 d = to - from;
            d.y = 0f;
            return d.sqrMagnitude > 1e-4f ? Quaternion.LookRotation(d) : Quaternion.identity;
        }
    }
}

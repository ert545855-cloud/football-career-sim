using System.Collections.Generic;
using UnityEngine;

namespace FootballCareer.Passing.Levels
{
    /// <summary>Bir bölüm için sahaya dizilen oyuncular.</summary>
    public struct FormationHandles
    {
        public Transform passer;
        public List<PassReceiver> teammates; // pasör dahil
        public List<EnemyAI> enemies;
        public GoalkeeperAI keeper;          // bölümde kaleci yoksa null
    }

    /// <summary>
    /// Bölüm dizilişini sahaya koyan/kaldıran nesne. LevelRunner bunu kullanır.
    ///  • PrefabFormationSpawner: kendi oyuncu prefab'larınızla (gerçek oyun).
    ///  • Demo.PitchBuilder: ilkel şekillerle (deneme sahnesi).
    /// </summary>
    public interface IFormationSpawner
    {
        FormationHandles Spawn(PassLevel level);
        void Despawn();
    }
}

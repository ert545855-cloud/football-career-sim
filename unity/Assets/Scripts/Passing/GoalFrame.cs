using System.Collections.Generic;
using UnityEngine;

namespace FootballCareer.Passing
{
    /// <summary>Topun kale çizgisini geçtiği noktanın sınıflandırması.</summary>
    public enum GoalCross
    {
        /// <summary>Direklerin arasından, üst direğin altından → GOL.</summary>
        Inside,
        /// <summary>Direğe ya da üst direğe çarptı.</summary>
        Frame,
        /// <summary>Kalenin yanından ya da üstünden auta.</summary>
        Wide,
    }

    /// <summary>
    /// KALE — kale çizgisini, direkleri ve üst direği analitik olarak tanımlar (collider gerekmez).
    ///
    /// Kurulum: nesneyi kale çizgisinin ORTASINA, zemin hizasına koyun; mavi ok (forward) SAHAYA baksın.
    ///  • Top çizgiyi geçtiği an BallController burayı sorar: içeride mi, direkte mi, dışarıda mı?
    ///  • PasManager çizim sırasında parmağın kale ağzına (dikey düzleme) değip değmediğini buradan sorar:
    ///    değiyorsa çizgi şut olur ve hedef YÜKSEKLİĞİ de çizimden alınır (üst köşe, yerden vb.).
    /// Ölçüler FIFA standardı: 7.32 × 2.44 m, direk çapı 12 cm.
    /// </summary>
    [DisallowMultipleComponent]
    public class GoalFrame : MonoBehaviour
    {
        /// <summary>Sahnedeki etkin kaleler (BallController her adımda bunları kontrol eder).</summary>
        public static readonly List<GoalFrame> All = new List<GoalFrame>(2);

        [Tooltip("Direklerin iç kenarları arası (metre).")]
        [SerializeField] private float width = 7.32f;
        [Tooltip("Zeminden üst direğin alt kenarına (metre).")]
        [SerializeField] private float height = 2.44f;
        [SerializeField] private float postRadius = 0.06f;
        [Tooltip("Ağların derinliği (top içeride bu kadar ilerleyip durur).")]
        [SerializeField] private float netDepth = 2f;
        [Tooltip("Oyuncunun şut çektiği (hücum ettiği) kale mi?")]
        [SerializeField] private bool attackTarget = true;

        public float Width { get { return width; } }
        public float Height { get { return height; } }
        public float NetDepth { get { return netDepth; } }
        public bool IsAttackTarget { get { return attackTarget; } }

        /// <summary>Kale çizgisinin ortası (zemin).</summary>
        public Vector3 Center { get { return transform.position; } }

        /// <summary>Sahaya bakan yatay normal.</summary>
        public Vector3 Normal
        {
            get
            {
                Vector3 f = transform.forward;
                f.y = 0f;
                return f.sqrMagnitude > 1e-6f ? f.normalized : Vector3.forward;
            }
        }

        /// <summary>Kale çizgisi boyunca yatay eksen (sahadan kaleye bakan birinin SAĞI).</summary>
        public Vector3 Lateral { get { return Vector3.Cross(Vector3.up, -Normal); } }

        private void OnEnable() { if (!All.Contains(this)) All.Add(this); }
        private void OnDisable() { All.Remove(this); }

        /// <summary>Kodla kurulum için.</summary>
        public void Configure(float goalWidth, float goalHeight, bool isAttackTarget)
        {
            width = goalWidth;
            height = goalHeight;
            attackTarget = isAttackTarget;
        }

        // ─────────────────────────── Geometri ───────────────────────────

        /// <summary>Noktanın kale çizgisine işaretli uzaklığı: + saha tarafı, − kalenin içi/arkası.</summary>
        public float SignedDistance(Vector3 p)
        {
            Vector3 c = Center;
            Vector3 n = Normal;
            return (p.x - c.x) * n.x + (p.z - c.z) * n.z;
        }

        /// <summary>Noktanın kale ağzındaki konumu: x = yanal (merkezden), y = yerden yükseklik.</summary>
        public Vector2 MouthCoords(Vector3 p)
        {
            Vector3 d = p - Center;
            Vector3 l = Lateral;
            return new Vector2(d.x * l.x + d.z * l.z, d.y);
        }

        /// <summary>Ağız koordinatından dünya noktası (çizgi üzerinde).</summary>
        public Vector3 MouthToWorld(float lateral, float y)
        {
            Vector3 p = Center + Lateral * lateral;
            p.y = Center.y + y;
            return p;
        }

        /// <summary>
        /// Bir adımda (from → to) top kale çizgisini sahadan dışarı doğru geçti mi? Geçtiyse kesişim noktası.
        /// Kalenin yanından geçen çizgi de "geçiş" sayılır (sonuç Classify ile belirlenir).
        /// </summary>
        public bool TryCrossing(Vector3 from, Vector3 to, out Vector3 point)
        {
            float d0 = SignedDistance(from), d1 = SignedDistance(to);
            if (d0 > 0f && d1 <= 0f)
            {
                float t = d0 / (d0 - d1);
                point = Vector3.Lerp(from, to, t);
                // Yalnızca kalenin çevresindeki geçişler ilgilendirir (saha dışına uzak geçişleri saha sınırı yakalar)
                Vector2 m = MouthCoords(point);
                if (Mathf.Abs(m.x) <= width * 0.5f + 6f) return true;
            }
            point = Vector3.zero;
            return false;
        }

        /// <summary>Kale çizgisinden geçen topun (merkez) sonucu.</summary>
        public GoalCross Classify(Vector3 crossing, float ballRadius)
        {
            Vector2 m = MouthCoords(crossing);
            float ax = Mathf.Abs(m.x);
            float y = m.y;
            float hit = postRadius + ballRadius;
            float postAxis = width * 0.5f + postRadius;
            float barAxis = height + postRadius;

            // Direkler (dikey silindir, yerden üst direğe)
            if (y <= barAxis && Mathf.Abs(ax - postAxis) < hit) return GoalCross.Frame;
            // Üst direk (yatay silindir)
            if (ax <= postAxis && Mathf.Abs(y - barAxis) < hit) return GoalCross.Frame;
            if (ax < width * 0.5f && y < height) return GoalCross.Inside;
            return GoalCross.Wide;
        }

        /// <summary>
        /// Ekran ışını kale ağzının (dikey) düzlemine sahadan çarpıyor mu? margin: çerçevenin dışına
        /// bu kadar taşan nişanlar da kabul edilir (oyuncu auta da vurabilsin).
        /// </summary>
        public bool RaycastMouth(Ray ray, float margin, out Vector3 point, out float enter)
        {
            Vector3 n = Normal;
            point = Vector3.zero;
            enter = 0f;
            float denom = Vector3.Dot(ray.direction, n);
            if (denom > -1e-4f) return false; // ışın sahaya doğru ya da paralel
            enter = Vector3.Dot(Center - ray.origin, n) / denom;
            if (enter <= 0f) return false;
            point = ray.GetPoint(enter);
            Vector2 m = MouthCoords(point);
            return Mathf.Abs(m.x) <= width * 0.5f + margin && m.y >= 0f && m.y <= height + margin;
        }

        private void OnDrawGizmos()
        {
            Gizmos.color = attackTarget ? new Color(1f, 0.85f, 0.2f) : Color.white;
            float hw = width * 0.5f;
            Vector3 bl = MouthToWorld(-hw, 0f), br = MouthToWorld(hw, 0f);
            Vector3 tl = MouthToWorld(-hw, height), tr = MouthToWorld(hw, height);
            Gizmos.DrawLine(bl, tl);
            Gizmos.DrawLine(tl, tr);
            Gizmos.DrawLine(tr, br);
            Vector3 back = -Normal * netDepth;
            Gizmos.color = new Color(1f, 1f, 1f, 0.35f);
            Gizmos.DrawLine(tl, tl + back);
            Gizmos.DrawLine(tr, tr + back);
            Gizmos.DrawLine(bl + back, br + back);
            Gizmos.DrawLine(tl + back, tr + back);
        }
    }
}

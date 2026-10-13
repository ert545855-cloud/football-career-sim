using System.Collections.Generic;
using UnityEngine;

namespace FootballCareer.Passing
{
    /// <summary>
    /// Çizilen pas hattından üretilen 3B KÜBİK BEZIER yolu.
    ///
    ///  • Yatay düzlemde (XZ) eğri, oyuncunun parmağıyla çizdiği hattan uydurulur:
    ///    eğri, çizimin %0'ından (top), %33'ünden, %66'sından ve %100'ünden (hedef) GEÇER.
    ///  • Dikeyde (Y) pas uzunluğuyla orantılı bir parabol yayı (loft) eklenir.
    ///  • Şutlarda bitiş noktası yerden yüksekte olabilir (EndLift: üst köşe, orta yükseklik…);
    ///    yükseklik yol boyunca doğrusal artar.
    ///  • Yay uzunluğu tablosu (LUT) sayesinde top eğri boyunca SABİT hızla ilerler
    ///    (Bezier'in t parametresi eşit aralıklı değildir; doğrudan t ile ilerlemek topu hızlandırıp yavaşlatırdı).
    ///
    /// Bellek ayırmaz: aynı örnek tekrar tekrar Build() edilir (çizim sırasında her karede).
    /// </summary>
    public sealed class PassPath
    {
        /// <summary>Yay uzunluğu tablosunun çözünürlüğü.</summary>
        public const int LutSamples = 48;

        /// <summary>Kontrol noktaları (Y = topun zemindeki merkez yüksekliği).</summary>
        public Vector3 P0, P1, P2, P3;
        /// <summary>Yolun ortasındaki ek yükseklik (metre).</summary>
        public float Loft;
        /// <summary>Bitişteki ek yükseklik (metre). Paslarda 0, şutlarda kale ağzındaki hedef yüksekliği.</summary>
        public float EndLift;

        /// <summary>3B yay uzunluğu (metre).</summary>
        public float Length { get; private set; }
        /// <summary>Başlangıç ile bitiş yönü arasındaki dönüş (derece). Negatif = sola kıvrılan (falso), pozitif = sağa.</summary>
        public float TurnDegrees { get; private set; }
        /// <summary>Falso miktarı: + sola, − sağa (|1| ≈ 90° dönüş).</summary>
        public float Curve { get { return -TurnDegrees / 90f; } }
        public bool IsValid { get { return Length > 0.01f; } }

        private readonly float[] lut = new float[LutSamples + 1];

        // ─────────────────────────── Kurulum ───────────────────────────

        /// <summary>
        /// Çizilen noktalardan (dünya, zemin düzlemi) yolu kurar.
        /// </summary>
        /// <param name="drawn">drawn[0] = topun konumu, son eleman = hedef. En az 2 nokta.</param>
        /// <param name="ballY">Topun zemindeki merkez yüksekliği (yarıçap).</param>
        /// <param name="loftPerMeter">Her metre için yay yüksekliği (0.06 → 30 m pasta 1.8 m).</param>
        /// <param name="maxLoft">En fazla yay yüksekliği.</param>
        /// <param name="endLift">Bitişte yerden ek yükseklik (şut hedefi). Paslarda 0.</param>
        public void Build(List<Vector3> drawn, float ballY, float loftPerMeter, float maxLoft, float endLift = 0f)
        {
            EndLift = Mathf.Max(0f, endLift);
            int n = drawn.Count;
            P0 = Flat(drawn[0], ballY);
            P3 = Flat(drawn[n - 1], ballY);
            Vector3 chord = P3 - P0;
            float c = chord.magnitude;

            if (n < 4 || PolylineLength(drawn) < 0.75f || c < 0.01f)
            {
                // Düz pas
                P1 = Vector3.Lerp(P0, P3, 1f / 3f);
                P2 = Vector3.Lerp(P0, P3, 2f / 3f);
            }
            else
            {
                // Eğri, çizimin 1/3 ve 2/3 noktalarından (Q1, Q2) geçsin:
                //   B(1/3) = Q1, B(2/3) = Q2 denklemlerinin P1, P2 için çözümü.
                Vector3 q1 = Flat(PointAtFraction(drawn, 1f / 3f), ballY);
                Vector3 q2 = Flat(PointAtFraction(drawn, 2f / 3f), ballY);
                P1 = (-5f * P0 + 18f * q1 - 9f * q2 + 2f * P3) / 6f;
                P2 = (2f * P0 - 9f * q1 + 18f * q2 - 5f * P3) / 6f;
                // Aşırı zikzak çizimlerde kontrol noktalarını sınırla (top kendi etrafında dönmesin)
                float limit = Mathf.Max(1f, c * 0.9f);
                P1 = ClampAround(P1, Vector3.Lerp(P0, P3, 1f / 3f), limit);
                P2 = ClampAround(P2, Vector3.Lerp(P0, P3, 2f / 3f), limit);
            }

            Loft = Mathf.Min(maxLoft, c * loftPerMeter);
            Finish();
        }

        /// <summary>
        /// Kavisi k ile ölçekler (0 = dümdüz, 1 = çizildiği gibi); uç noktalar değişmez.
        /// Oyuncunun falso ustalığı: düşük statta çizilen kavisin ancak bir kısmı uygulanabilir.
        /// </summary>
        public void ScaleCurve(float k)
        {
            k = Mathf.Clamp01(k);
            if (k >= 0.999f) return;
            P1 = Vector3.Lerp(Vector3.Lerp(P0, P3, 1f / 3f), P1, k);
            P2 = Vector3.Lerp(Vector3.Lerp(P0, P3, 2f / 3f), P2, k);
            Finish();
        }

        /// <summary>
        /// Bitişi kaydırır (isabet sapması). Yatay bileşen eğrinin sonunu, dikey bileşen bitiş yüksekliğini (EndLift) değiştirir;
        /// eğrinin şekli korunur (kontrol noktaları orantılı kayar).
        /// </summary>
        public void ShiftEnd(Vector3 delta)
        {
            Vector3 flat = new Vector3(delta.x, 0f, delta.z);
            P1 += flat * (1f / 3f);
            P2 += flat * (2f / 3f);
            P3 += flat;
            EndLift = Mathf.Max(0f, EndLift + delta.y);
            Finish();
        }

        /// <summary>LUT ve dönüş açısını yeniden hesaplar.</summary>
        private void Finish()
        {
            RebuildLut();
            Vector3 t0 = Flat(DerivativeT(0f), 0f);
            Vector3 t1 = Flat(DerivativeT(1f), 0f);
            TurnDegrees = (t0.sqrMagnitude > 1e-6f && t1.sqrMagnitude > 1e-6f) ? Vector3.SignedAngle(t0, t1, Vector3.up) : 0f;
        }

        // ─────────────────────────── Değerlendirme ───────────────────────────

        /// <summary>Bezier parametresi t (0–1) için 3B konum.</summary>
        public Vector3 EvaluateT(float t)
        {
            float u = 1f - t;
            Vector3 p = (u * u * u) * P0 + (3f * u * u * t) * P1 + (3f * u * t * t) * P2 + (t * t * t) * P3;
            p.y += 4f * Loft * t * u + EndLift * t; // parabol yay (t=0.5'te +Loft) + bitişe doğru yükselme
            return p;
        }

        /// <summary>t'ye göre türev (teğet, normalize edilmemiş).</summary>
        public Vector3 DerivativeT(float t)
        {
            float u = 1f - t;
            Vector3 d = (3f * u * u) * (P1 - P0) + (6f * u * t) * (P2 - P1) + (3f * t * t) * (P3 - P2);
            d.y += 4f * Loft * (1f - 2f * t) + EndLift;
            return d;
        }

        /// <summary>Yol üzerindeki mesafeyi (s, metre) Bezier parametresine çevirir.</summary>
        public float DistanceToT(float s)
        {
            if (s <= 0f) return 0f;
            if (s >= Length) return 1f;
            // İkili arama: lut[i] <= s < lut[i+1]
            int lo = 0, hi = LutSamples;
            while (hi - lo > 1)
            {
                int mid = (lo + hi) >> 1;
                if (lut[mid] <= s) lo = mid; else hi = mid;
            }
            float seg = lut[hi] - lut[lo];
            float frac = seg > 1e-6f ? (s - lut[lo]) / seg : 0f;
            return (lo + frac) / LutSamples;
        }

        /// <summary>Başlangıçtan s metre ilerideki konum (sabit hızlı ilerleme için).</summary>
        public Vector3 EvaluateAtDistance(float s) { return EvaluateT(DistanceToT(s)); }

        /// <summary>s metredeki birim teğet (uçuş yönü).</summary>
        public Vector3 TangentAtDistance(float s)
        {
            Vector3 d = DerivativeT(DistanceToT(s));
            return d.sqrMagnitude > 1e-8f ? d.normalized : (P3 - P0).normalized;
        }

        /// <summary>Yolu eşit aralıklı örnekleyip tampona yazar (LineRenderer önizlemesi için, bellek ayırmaz).</summary>
        public void SampleInto(Vector3[] buffer)
        {
            int n = buffer.Length;
            if (n == 0) return;
            if (n == 1) { buffer[0] = P0; return; }
            for (int i = 0; i < n; i++) buffer[i] = EvaluateAtDistance(Length * i / (n - 1));
        }

        /// <summary>
        /// Bir noktaya (XZ düzleminde) en yakın yol noktası. Rakip yapay zekâsı araya girme noktasını bulmak için kullanır.
        /// </summary>
        /// <param name="point">Dünya konumu.</param>
        /// <param name="distanceAlong">En yakın noktanın yol başından uzaklığı (metre).</param>
        /// <returns>Yatay mesafe (metre).</returns>
        public float ClosestHorizontal(Vector3 point, out float distanceAlong)
        {
            float best = float.MaxValue;
            distanceAlong = 0f;
            for (int i = 0; i <= LutSamples; i++)
            {
                Vector3 p = EvaluateT((float)i / LutSamples);
                float dx = p.x - point.x, dz = p.z - point.z;
                float d2 = dx * dx + dz * dz;
                if (d2 < best)
                {
                    best = d2;
                    distanceAlong = lut[i];
                }
            }
            return Mathf.Sqrt(best);
        }

        // ─────────────────────────── Yardımcılar ───────────────────────────

        private void RebuildLut()
        {
            lut[0] = 0f;
            Vector3 prev = EvaluateT(0f);
            for (int i = 1; i <= LutSamples; i++)
            {
                Vector3 p = EvaluateT((float)i / LutSamples);
                lut[i] = lut[i - 1] + Vector3.Distance(prev, p);
                prev = p;
            }
            Length = lut[LutSamples];
        }

        private static Vector3 Flat(Vector3 v, float y) { return new Vector3(v.x, y, v.z); }

        private static Vector3 ClampAround(Vector3 p, Vector3 center, float maxDistance)
        {
            Vector3 d = p - center;
            return d.sqrMagnitude > maxDistance * maxDistance ? center + d.normalized * maxDistance : p;
        }

        /// <summary>Kırık çizginin toplam uzunluğu.</summary>
        public static float PolylineLength(List<Vector3> pts)
        {
            float len = 0f;
            for (int i = 1; i < pts.Count; i++) len += Vector3.Distance(pts[i - 1], pts[i]);
            return len;
        }

        /// <summary>Kırık çizgi üzerinde, toplam uzunluğun f oranındaki nokta.</summary>
        public static Vector3 PointAtFraction(List<Vector3> pts, float f)
        {
            float target = PolylineLength(pts) * Mathf.Clamp01(f);
            float acc = 0f;
            for (int i = 1; i < pts.Count; i++)
            {
                float seg = Vector3.Distance(pts[i - 1], pts[i]);
                if (acc + seg >= target && seg > 1e-6f) return Vector3.Lerp(pts[i - 1], pts[i], (target - acc) / seg);
                acc += seg;
            }
            return pts[pts.Count - 1];
        }
    }
}

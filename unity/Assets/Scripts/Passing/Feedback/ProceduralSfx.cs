using System;
using System.Collections.Generic;
using UnityEngine;

namespace FootballCareer.Passing.Feedback
{
    /// <summary>
    /// Ses dosyası olmadan çalışabilmek için kodla üretilen efektler (sentez). Gerçek oyunda PassFeedback'e
    /// kendi kayıtlarınızı verin; boş bırakılanlar buradan üretilir. Her ses bir kez üretilip önbelleğe alınır.
    ///
    /// Örnekleyiciler saf fonksiyonlardır (float[] döner) → konsolda test edilebilir.
    /// </summary>
    public static class ProceduralSfx
    {
        public const int Rate = 44100;

        public enum Kind { PassKick, ShotKick, Thud, Net, Cheer, Groan, Post, Whistle }

        private static readonly Dictionary<Kind, AudioClip> Cache = new Dictionary<Kind, AudioClip>();

        public static AudioClip Get(Kind kind)
        {
            AudioClip clip;
            if (Cache.TryGetValue(kind, out clip) && clip != null) return clip;
            float[] data = Samples(kind);
            clip = AudioClip.Create("sfx-" + kind, data.Length, 1, Rate, false);
            clip.SetData(data, 0);
            Cache[kind] = clip;
            return clip;
        }

        public static float[] Samples(Kind kind)
        {
            switch (kind)
            {
                case Kind.PassKick: return Kick(0.11f, 0.7f, 11);
                case Kind.ShotKick: return Kick(0.16f, 1f, 12);
                case Kind.Thud: return Thud();
                case Kind.Net: return Net();
                case Kind.Cheer: return Cheer();
                case Kind.Groan: return Groan();
                case Kind.Post: return Post();
                default: return Whistle();
            }
        }

        // ─────────────────────────── Sentezleyiciler ───────────────────────────

        /// <summary>Vuruş: aşağı kayan düşük frekans "gümbürtü" + kısa çıt (ayak–top teması).</summary>
        private static float[] Kick(float seconds, float gain, int seed)
        {
            var rnd = new System.Random(seed);
            int n = (int)(seconds * Rate);
            var s = new float[n];
            double phase = 0;
            for (int i = 0; i < n; i++)
            {
                float t = (float)i / Rate;
                float f = 50f + 95f * Mathf.Exp(-t * 30f);
                phase += 2 * Math.PI * f / Rate;
                float body = (float)Math.Sin(phase) * Mathf.Exp(-t * 26f);
                float click = Noise(rnd) * Mathf.Exp(-t * 420f) * 0.7f;
                s[i] = (body * 0.9f + click) * gain;
            }
            return Normalize(s, 0.9f * gain);
        }

        /// <summary>Top ayakta/göğüste durur, kaleci tutar: tok ve kısa.</summary>
        private static float[] Thud()
        {
            var rnd = new System.Random(21);
            int n = (int)(0.12f * Rate);
            var s = new float[n];
            double phase = 0;
            for (int i = 0; i < n; i++)
            {
                float t = (float)i / Rate;
                phase += 2 * Math.PI * (60f + 40f * Mathf.Exp(-t * 40f)) / Rate;
                s[i] = (float)Math.Sin(phase) * Mathf.Exp(-t * 35f) + Noise(rnd) * Mathf.Exp(-t * 300f) * 0.35f;
            }
            return Normalize(s, 0.7f);
        }

        /// <summary>Ağlar: yüksek geçirgenli gürültü "hışırtısı".</summary>
        private static float[] Net()
        {
            var rnd = new System.Random(31);
            int n = (int)(0.6f * Rate);
            var s = new float[n];
            float y = 0f, prev = 0f;
            for (int i = 0; i < n; i++)
            {
                float t = (float)i / Rate;
                float x = Noise(rnd);
                y = 0.86f * (y + x - prev); // tek kutuplu yüksek geçiren
                prev = x;
                float env = Mathf.Min(1f, t / 0.01f) * Mathf.Exp(-t * 6.5f);
                s[i] = y * env;
            }
            return Normalize(s, 0.55f);
        }

        /// <summary>Tribün coşkusu: alçak geçirgenli gürültü + dalgalanma + rastgele "sesler".</summary>
        private static float[] Cheer()
        {
            var rnd = new System.Random(41);
            int n = (int)(3.2f * Rate);
            var s = new float[n];
            float lp1 = 0f, lp2 = 0f, swell = 0.7f;
            float a1 = LowpassAlpha(900f), a2 = LowpassAlpha(2400f);
            var voices = new float[10];
            var vPhase = new double[10];
            for (int v = 0; v < voices.Length; v++) voices[v] = 280f + (float)rnd.NextDouble() * 700f;
            for (int i = 0; i < n; i++)
            {
                float t = (float)i / Rate;
                float x = Noise(rnd);
                lp1 += a1 * (x - lp1);
                lp2 += a2 * (x - lp2);
                if (i % 2205 == 0) swell = Mathf.Clamp(swell + ((float)rnd.NextDouble() - 0.45f) * 0.25f, 0.55f, 1f);
                float voice = 0f;
                for (int v = 0; v < voices.Length; v++)
                {
                    vPhase[v] += 2 * Math.PI * voices[v] * (1f + 0.02f * Mathf.Sin(t * (3f + v))) / Rate;
                    voice += (float)Math.Sin(vPhase[v]) * (0.5f + 0.5f * Mathf.Sin(t * (1.3f + v * 0.7f) + v));
                }
                float env = Mathf.Min(1f, t / 0.25f) * (t < 2.0f ? 1f : Mathf.Exp(-(t - 2.0f) * 2.2f));
                s[i] = (lp1 * 1.4f + (lp2 - lp1) * 0.6f + voice * 0.012f) * swell * env;
            }
            return Normalize(s, 0.6f);
        }

        /// <summary>"Ooo…" tribün iç çekişi: düşük gürültü + inen bir ünlü.</summary>
        private static float[] Groan()
        {
            var rnd = new System.Random(51);
            int n = (int)(1.4f * Rate);
            var s = new float[n];
            float lp = 0f, a = LowpassAlpha(450f);
            double phase = 0;
            for (int i = 0; i < n; i++)
            {
                float t = (float)i / Rate;
                lp += a * (Noise(rnd) - lp);
                float f = 230f - 50f * Mathf.Clamp01(t / 1.2f);
                phase += 2 * Math.PI * f / Rate;
                float vowel = (float)(Math.Sin(phase) + 0.4 * Math.Sin(2 * phase) + 0.2 * Math.Sin(3 * phase));
                float env = Mathf.Min(1f, t / 0.12f) * Mathf.Exp(-t * 1.6f);
                s[i] = (lp * 2.2f + vowel * 0.08f) * env;
            }
            return Normalize(s, 0.5f);
        }

        /// <summary>Direk: uyumsuz kısmi tonlarla metalik "çın".</summary>
        private static float[] Post()
        {
            var rnd = new System.Random(61);
            int n = (int)(0.9f * Rate);
            var s = new float[n];
            float[] freqs = { 523f, 1187f, 1873f, 2711f, 3637f };
            float[] amps = { 1f, 0.6f, 0.45f, 0.3f, 0.2f };
            float[] decay = { 4f, 6f, 8f, 11f, 14f };
            for (int i = 0; i < n; i++)
            {
                float t = (float)i / Rate;
                float v = Noise(rnd) * Mathf.Exp(-t * 500f) * 0.8f;
                for (int k = 0; k < freqs.Length; k++) v += amps[k] * Mathf.Sin(2f * Mathf.PI * freqs[k] * t) * Mathf.Exp(-t * decay[k]);
                s[i] = v;
            }
            return Normalize(s, 0.6f);
        }

        /// <summary>Hakem düdüğü (bölüm başı/sonu).</summary>
        private static float[] Whistle()
        {
            int n = (int)(0.45f * Rate);
            var s = new float[n];
            double phase = 0;
            for (int i = 0; i < n; i++)
            {
                float t = (float)i / Rate;
                float f = 2650f + 140f * Mathf.Sin(t * 2f * Mathf.PI * 32f); // titreşimli
                phase += 2 * Math.PI * f / Rate;
                float env = Mathf.Min(1f, t / 0.02f) * Mathf.Min(1f, (0.45f - t) / 0.05f);
                s[i] = (float)Math.Sin(phase) * env;
            }
            return Normalize(s, 0.4f);
        }

        // ─────────────────────────── Yardımcılar ───────────────────────────

        private static float Noise(System.Random rnd) { return (float)(rnd.NextDouble() * 2.0 - 1.0); }

        private static float LowpassAlpha(float cutoffHz) { return 1f - Mathf.Exp(-2f * Mathf.PI * cutoffHz / Rate); }

        /// <summary>Tepe değeri peak'e ölçekler (kırpılma olmaz).</summary>
        public static float[] Normalize(float[] s, float peak)
        {
            float max = 0f;
            for (int i = 0; i < s.Length; i++) max = Mathf.Max(max, Mathf.Abs(s[i]));
            if (max < 1e-6f) return s;
            float k = peak / max;
            for (int i = 0; i < s.Length; i++) s[i] *= k;
            return s;
        }
    }
}

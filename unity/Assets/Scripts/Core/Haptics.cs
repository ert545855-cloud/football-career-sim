using System;
using System.Runtime.InteropServices;
using UnityEngine;

namespace FootballCareer.Core
{
    /// <summary>Oyun içi titreşim anları.</summary>
    public enum HapticPattern
    {
        /// <summary>Hafif dokunuş (çizime başlama, UI).</summary>
        Tap,
        /// <summary>Çok hafif seçim tıkı (pas moduna giriş).</summary>
        Select,
        /// <summary>Pas vuruşu (orta).</summary>
        PassKick,
        /// <summary>Şut vuruşu (sert).</summary>
        ShotKick,
        /// <summary>Pas arkadaşa ulaştı (çift hafif tık).</summary>
        Received,
        /// <summary>GOL! (ritmik, uzun kutlama titreşimi).</summary>
        Goal,
        /// <summary>Kaleci kurtardı.</summary>
        Saved,
        /// <summary>Direkten döndü (keskin + titreşen).</summary>
        Post,
        /// <summary>Başarısız pas / top kaptırma.</summary>
        Fail,
        Warning,
    }

    /// <summary>
    /// TİTREŞİM (haptik) — oyuncu attığı golü ve pası elinde hissetsin.
    ///
    ///  • Android: Vibrator + VibrationEffect.createWaveform (API 26+) → güç (amplitude) kontrollü desenler;
    ///    eski sürümlerde süre deseni. VIBRATE izni Handheld.Vibrate referansı sayesinde Unity tarafından eklenir.
    ///  • iOS: Taptic Engine (UIImpactFeedbackGenerator / UINotificationFeedbackGenerator) —
    ///    Assets/Plugins/iOS/FCHaptics.mm.
    ///  • WebGL: navigator.vibrate (Android tarayıcıları; iOS Safari desteklemez) — Assets/Plugins/WebGL/FCHaptics.jslib.
    ///  • Editör / masaüstü: sessizce hiçbir şey yapmaz.
    /// Oyuncu ayarlardan kapatabilir (Enabled, PlayerPrefs'te saklanır).
    /// </summary>
    public static class Haptics
    {
        private const string PrefKey = "fc.haptics";

        /// <summary>Desenler: [titreşim ms, bekleme ms, titreşim ms, …] ve her titreşimin gücü (1–255).</summary>
        private struct Pattern
        {
            public long[] onOff;
            public int[] strength;
            public Pattern(long[] onOff, int[] strength) { this.onOff = onOff; this.strength = strength; }
        }

        private static readonly Pattern[] Patterns =
        {
            new Pattern(new long[] { 12 }, new[] { 90 }),                                   // Tap
            new Pattern(new long[] { 7 }, new[] { 60 }),                                    // Select
            new Pattern(new long[] { 24 }, new[] { 150 }),                                  // PassKick
            new Pattern(new long[] { 42 }, new[] { 255 }),                                  // ShotKick
            new Pattern(new long[] { 10, 45, 14 }, new[] { 110, 130 }),                     // Received
            new Pattern(new long[] { 70, 60, 70, 60, 70, 90, 260 }, new[] { 255, 200, 255, 255 }), // Goal
            new Pattern(new long[] { 50, 70, 40 }, new[] { 220, 150 }),                     // Saved
            new Pattern(new long[] { 16, 25, 90 }, new[] { 255, 120 }),                     // Post
            new Pattern(new long[] { 70, 55, 70 }, new[] { 170, 170 }),                     // Fail
            new Pattern(new long[] { 30, 40, 30 }, new[] { 140, 140 }),                     // Warning
        };

        /// <summary>Oyuncu ayarı (varsayılan açık).</summary>
        public static bool Enabled
        {
            get { return PlayerPrefs.GetInt(PrefKey, 1) == 1; }
            set
            {
                PlayerPrefs.SetInt(PrefKey, value ? 1 : 0);
                PlayerPrefs.Save();
            }
        }

        /// <summary>Bu platformda titreşim mümkün mü?</summary>
        public static bool IsSupported
        {
            get
            {
#if UNITY_EDITOR
                return false;
#elif UNITY_ANDROID || UNITY_IOS || UNITY_WEBGL
                return true;
#else
                return false;
#endif
            }
        }

        /// <summary>Son çalınan desen (test / hata ayıklama).</summary>
        public static HapticPattern? LastPlayed { get; private set; }

        /// <summary>Deseni çalar (kapalıysa ya da desteklenmiyorsa hiçbir şey yapmaz).</summary>
        public static void Play(HapticPattern pattern)
        {
            if (!Enabled) return;
            LastPlayed = pattern;
            int i = (int)pattern;
            if (i < 0 || i >= Patterns.Length) return;
#if UNITY_EDITOR
            // Editörde titreşim yok
#elif UNITY_ANDROID
            AndroidPlay(Patterns[i]);
#elif UNITY_IOS
            IosPlay(pattern);
#elif UNITY_WEBGL
            WebPlay(Patterns[i]);
#endif
        }

        /// <summary>Toplam desen süresi (ms) — art arda çalmaları seyreltmek için.</summary>
        public static int DurationMs(HapticPattern pattern)
        {
            long sum = 0;
            foreach (long v in Patterns[(int)pattern].onOff) sum += v;
            return (int)sum;
        }

        // ─────────────────────────── Android ───────────────────────────
#if UNITY_ANDROID && !UNITY_EDITOR
        private static AndroidJavaObject vibrator;
        private static AndroidJavaClass effectClass;
        private static int sdk = -1;

        private static void AndroidPlay(Pattern p)
        {
            try
            {
                if (vibrator == null)
                {
                    using (var unity = new AndroidJavaClass("com.unity3d.player.UnityPlayer"))
                    using (var activity = unity.GetStatic<AndroidJavaObject>("currentActivity"))
                    {
                        vibrator = activity.Call<AndroidJavaObject>("getSystemService", "vibrator");
                    }
                    using (var version = new AndroidJavaClass("android.os.Build$VERSION")) sdk = version.GetStatic<int>("SDK_INT");
                }
                if (vibrator == null) return;

                // Android deseni "bekle, titre, bekle, titre…" ile başlar → başa 0 ms bekleme eklenir
                long[] timings = new long[p.onOff.Length + 1];
                int[] amps = new int[p.onOff.Length + 1];
                for (int i = 0; i < p.onOff.Length; i++)
                {
                    timings[i + 1] = p.onOff[i];
                    amps[i + 1] = i % 2 == 0 ? Mathf.Clamp(p.strength[Mathf.Min(i / 2, p.strength.Length - 1)], 1, 255) : 0;
                }
                if (sdk >= 26)
                {
                    if (effectClass == null) effectClass = new AndroidJavaClass("android.os.VibrationEffect");
                    using (AndroidJavaObject effect = effectClass.CallStatic<AndroidJavaObject>("createWaveform", timings, amps, -1))
                    {
                        vibrator.Call("vibrate", effect);
                    }
                }
                else
                {
                    vibrator.Call("vibrate", timings, -1);
                }
            }
            catch (Exception)
            {
                Handheld.Vibrate();
            }
        }
#endif

        // ─────────────────────────── iOS ───────────────────────────
#if UNITY_IOS && !UNITY_EDITOR
        [DllImport("__Internal")] private static extern void _fcHapticImpact(int style);   // 0 hafif, 1 orta, 2 sert
        [DllImport("__Internal")] private static extern void _fcHapticNotify(int type);    // 0 başarı, 1 uyarı, 2 hata

        private static void IosPlay(HapticPattern p)
        {
            switch (p)
            {
                case HapticPattern.Tap:
                case HapticPattern.Select:
                case HapticPattern.Received: _fcHapticImpact(0); break;
                case HapticPattern.PassKick: _fcHapticImpact(1); break;
                case HapticPattern.ShotKick:
                case HapticPattern.Post: _fcHapticImpact(2); break;
                case HapticPattern.Goal: _fcHapticNotify(0); break;
                case HapticPattern.Saved:
                case HapticPattern.Warning: _fcHapticNotify(1); break;
                default: _fcHapticNotify(2); break;
            }
        }
#endif

        // ─────────────────────────── WebGL ───────────────────────────
#if UNITY_WEBGL && !UNITY_EDITOR
        [DllImport("__Internal")] private static extern int FC_Vibrate(int[] pattern, int length);

        private static void WebPlay(Pattern p)
        {
            var ms = new int[p.onOff.Length];
            for (int i = 0; i < ms.Length; i++) ms[i] = (int)p.onOff[i];
            FC_Vibrate(ms, ms.Length);
        }
#endif
    }
}

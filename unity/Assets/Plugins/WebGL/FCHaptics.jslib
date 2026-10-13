// WebGL titreşim köprüsü — FootballCareer.Core.Haptics (C#) [DllImport("__Internal")] ile çağırır.
// navigator.vibrate: Android tarayıcılarında çalışır; iOS Safari desteklemez (sessizce 0 döner).
mergeInto(LibraryManager.library, {
  FC_Vibrate: function (ptr, length) {
    if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return 0;
    var pattern = [];
    for (var i = 0; i < length; i++) pattern.push(HEAP32[(ptr >> 2) + i]);
    try {
      return navigator.vibrate(pattern) ? 1 : 0;
    } catch (e) {
      return 0;
    }
  }
});

// Unity (WebGL) → web oyunu köprüsü. C# tarafı: FootballCareer.Bridge.WebBridge ([DllImport("__Internal")]).
// Web tarafı window.KramponBridge = { onReady(), onResult(json), onLog(text) } tanımlar (web/src/games/unity3d.js).
mergeInto(LibraryManager.library, {
  KB_Ready: function () {
    try {
      if (window.KramponBridge && typeof window.KramponBridge.onReady === 'function') window.KramponBridge.onReady();
    } catch (e) { console.error(e); }
  },
  KB_SendResult: function (jsonPtr) {
    var json = UTF8ToString(jsonPtr);
    try {
      if (window.KramponBridge && typeof window.KramponBridge.onResult === 'function') window.KramponBridge.onResult(json);
    } catch (e) { console.error(e); }
  },
  KB_Log: function (textPtr) {
    var text = UTF8ToString(textPtr);
    if (window.KramponBridge && typeof window.KramponBridge.onLog === 'function') window.KramponBridge.onLog(text);
    else console.log('[Unity] ' + text);
  }
});

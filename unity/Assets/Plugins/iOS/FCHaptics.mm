// Taptic Engine köprüsü — FootballCareer.Core.Haptics (C#) [DllImport("__Internal")] ile çağırır.
// Unity bu dosyayı iOS derlemesinde Xcode projesine otomatik ekler.
#import <UIKit/UIKit.h>

extern "C" {

// style: 0 = hafif, 1 = orta, 2 = sert
void _fcHapticImpact(int style)
{
    if (@available(iOS 10.0, *)) {
        UIImpactFeedbackStyle s = style <= 0 ? UIImpactFeedbackStyleLight
                                : (style == 1 ? UIImpactFeedbackStyleMedium : UIImpactFeedbackStyleHeavy);
        UIImpactFeedbackGenerator *g = [[UIImpactFeedbackGenerator alloc] initWithStyle:s];
        [g prepare];
        [g impactOccurred];
    }
}

// type: 0 = başarı (gol), 1 = uyarı (kurtarış), 2 = hata (başarısız)
void _fcHapticNotify(int type)
{
    if (@available(iOS 10.0, *)) {
        UINotificationFeedbackType t = type <= 0 ? UINotificationFeedbackTypeSuccess
                                     : (type == 1 ? UINotificationFeedbackTypeWarning : UINotificationFeedbackTypeError);
        UINotificationFeedbackGenerator *g = [[UINotificationFeedbackGenerator alloc] init];
        [g prepare];
        [g notificationOccurred:t];
    }
}

}

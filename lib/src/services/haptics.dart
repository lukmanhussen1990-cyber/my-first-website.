import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';

import 'settings_store.dart';

/// Short vibrations. On Android a tiny platform channel drives the Vibrator
/// directly (reliable even when system touch feedback is disabled); other
/// platforms fall back to [HapticFeedback].
class Haptics {
  Haptics._();

  static const _channel = MethodChannel('com.myapps.blockblast/haptics');
  static bool _channelBroken = false;

  static Future<void> _vibrate(int ms, int amplitude, Future<void> Function() fallback) async {
    final store = SettingsStore.instance;
    if (!store.vibrationOn) return;
    if (!kIsWeb && defaultTargetPlatform == TargetPlatform.android && !_channelBroken) {
      try {
        await _channel.invokeMethod('vibrate', {'ms': ms, 'amplitude': amplitude});
        return;
      } on MissingPluginException {
        _channelBroken = true;
      } catch (_) {
        // fall through to the framework haptics
      }
    }
    try {
      await fallback();
    } catch (_) {}
  }

  /// Barely-there tick when a piece lands.
  static Future<void> tick() => _vibrate(12, 60, HapticFeedback.selectionClick);

  /// Light tap used for line clears.
  static Future<void> light() => _vibrate(25, 90, HapticFeedback.lightImpact);

  /// Stronger buzz for big combos.
  static Future<void> medium() => _vibrate(40, 170, HapticFeedback.mediumImpact);

  /// Long buzz for game over.
  static Future<void> heavy() => _vibrate(120, 200, HapticFeedback.heavyImpact);
}

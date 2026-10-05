import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Persistent settings, best score and the in-progress game.
class SettingsStore extends ChangeNotifier {
  SettingsStore._(this._prefs);

  static SettingsStore? _instance;
  static SettingsStore get instance => _instance!;

  final SharedPreferences? _prefs;

  static const _kBest = 'best_score';
  static const _kSound = 'sound_on';
  static const _kMusic = 'music_on';
  static const _kVibration = 'vibration_on';
  static const _kSavedGame = 'saved_game_v1';

  int _best = 0;
  bool _sound = true;
  bool _music = true;
  bool _vibration = true;

  static Future<SettingsStore> load() async {
    SharedPreferences? prefs;
    try {
      prefs = await SharedPreferences.getInstance();
    } catch (e) {
      debugPrint('SharedPreferences unavailable: $e');
    }
    final store = SettingsStore._(prefs);
    store._best = prefs?.getInt(_kBest) ?? 0;
    store._sound = prefs?.getBool(_kSound) ?? true;
    store._music = prefs?.getBool(_kMusic) ?? true;
    store._vibration = prefs?.getBool(_kVibration) ?? true;
    _instance = store;
    return store;
  }

  /// In-memory store for tests.
  @visibleForTesting
  static SettingsStore memory() => _instance = SettingsStore._(null);

  int get bestScore => _best;
  bool get soundOn => _sound;
  bool get musicOn => _music;
  bool get vibrationOn => _vibration;

  /// Records [score] if it beats the best. Returns true when it did.
  bool submitScore(int score) {
    if (score <= _best) return false;
    _best = score;
    _prefs?.setInt(_kBest, score);
    notifyListeners();
    return true;
  }

  set soundOn(bool v) {
    _sound = v;
    _prefs?.setBool(_kSound, v);
    notifyListeners();
  }

  set musicOn(bool v) {
    _music = v;
    _prefs?.setBool(_kMusic, v);
    notifyListeners();
  }

  set vibrationOn(bool v) {
    _vibration = v;
    _prefs?.setBool(_kVibration, v);
    notifyListeners();
  }

  Map<String, dynamic>? loadSavedGame() {
    final raw = _prefs?.getString(_kSavedGame);
    if (raw == null) return null;
    try {
      final decoded = jsonDecode(raw);
      return decoded is Map<String, dynamic> ? decoded : null;
    } catch (_) {
      return null;
    }
  }

  void saveGame(Map<String, dynamic> json) {
    _prefs?.setString(_kSavedGame, jsonEncode(json));
  }

  void clearSavedGame() {
    _prefs?.remove(_kSavedGame);
  }
}

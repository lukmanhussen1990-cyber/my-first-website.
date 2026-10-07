import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Persistent settings, best score, the in-progress game and small app
/// records (premium entitlement cache, ad pacing).
///
/// Keys from version 1.0 are unchanged so an update keeps the player's
/// best score, settings and saved game.
class SettingsStore extends ChangeNotifier {
  SettingsStore._(this._prefs);

  static SettingsStore? _instance;
  static SettingsStore get instance => _instance!;

  final SharedPreferences? _prefs;

  /// Backing map used when SharedPreferences is unavailable (tests).
  final Map<String, Object> _memory = {};

  static const _kBest = 'best_score';
  static const _kSound = 'sound_on';
  static const _kMusic = 'music_on';
  static const _kVibration = 'vibration_on';
  static const _kSavedGame = 'saved_game_v1';
  static const _kSkin = 'block_skin';

  int _best = 0;
  bool _sound = true;
  bool _music = true;
  bool _vibration = true;
  String _skin = 'classic';

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
    store._skin = prefs?.getString(_kSkin) ?? 'classic';
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

  /// Selected block skin id (premium skins only render while Premium is active).
  String get skinId => _skin;

  /// Records [score] if it beats the best. Returns true when it did.
  bool submitScore(int score) {
    if (score <= _best) return false;
    _best = score;
    _setInt(_kBest, score);
    notifyListeners();
    return true;
  }

  set soundOn(bool v) {
    _sound = v;
    _setBool(_kSound, v);
    notifyListeners();
  }

  set musicOn(bool v) {
    _music = v;
    _setBool(_kMusic, v);
    notifyListeners();
  }

  set vibrationOn(bool v) {
    _vibration = v;
    _setBool(_kVibration, v);
    notifyListeners();
  }

  set skinId(String v) {
    _skin = v;
    writeString(_kSkin, v);
    notifyListeners();
  }

  Map<String, dynamic>? loadSavedGame() {
    final raw = readString(_kSavedGame);
    if (raw == null) return null;
    try {
      final decoded = jsonDecode(raw);
      return decoded is Map<String, dynamic> ? decoded : null;
    } catch (_) {
      return null;
    }
  }

  void saveGame(Map<String, dynamic> json) => writeString(_kSavedGame, jsonEncode(json));

  void clearSavedGame() => removeKey(_kSavedGame);

  // ---------------------------------------------------------------------------
  // Generic small records.
  // ---------------------------------------------------------------------------

  String? readString(String key) {
    final prefs = _prefs;
    if (prefs != null) return prefs.getString(key);
    final v = _memory[key];
    return v is String ? v : null;
  }

  void writeString(String key, String value) {
    final prefs = _prefs;
    if (prefs != null) {
      prefs.setString(key, value);
    } else {
      _memory[key] = value;
    }
  }

  int? readInt(String key) {
    final prefs = _prefs;
    if (prefs != null) return prefs.getInt(key);
    final v = _memory[key];
    return v is int ? v : null;
  }

  void writeInt(String key, int value) => _setInt(key, value);

  void removeKey(String key) {
    final prefs = _prefs;
    if (prefs != null) {
      prefs.remove(key);
    } else {
      _memory.remove(key);
    }
  }

  void _setInt(String key, int value) {
    final prefs = _prefs;
    if (prefs != null) {
      prefs.setInt(key, value);
    } else {
      _memory[key] = value;
    }
  }

  void _setBool(String key, bool value) {
    final prefs = _prefs;
    if (prefs != null) {
      prefs.setBool(key, value);
    } else {
      _memory[key] = value;
    }
  }
}

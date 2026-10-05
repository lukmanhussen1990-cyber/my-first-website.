import 'package:audioplayers/audioplayers.dart';
import 'package:flutter/foundation.dart';

import 'settings_store.dart';

enum Sfx { pickup, drop, clear, combo, gameOver, invalid, click, newBest }

/// Sound effects + looping background music.
class Sound {
  Sound._();
  static final Sound instance = Sound._();

  static const Map<Sfx, String> _files = {
    Sfx.pickup: 'sounds/pickup.ogg',
    Sfx.drop: 'sounds/drop.ogg',
    Sfx.clear: 'sounds/clear.ogg',
    Sfx.combo: 'sounds/combo.ogg',
    Sfx.gameOver: 'sounds/game_over.ogg',
    Sfx.invalid: 'sounds/invalid.ogg',
    Sfx.click: 'sounds/click.ogg',
    Sfx.newBest: 'sounds/new_best.ogg',
  };

  static const int _voices = 3;

  final Map<Sfx, List<AudioPlayer>> _players = {};
  final Map<Sfx, int> _next = {};
  AudioPlayer? _music;
  bool _ready = false;
  bool _musicPlaying = false;
  bool _appInForeground = true;

  Future<void>? _initFuture;

  /// Set by widget tests: no platform audio is touched at all.
  static bool disabled = false;

  /// Loads all sounds once; safe to call repeatedly.
  Future<void> init() => disabled ? Future.value() : (_initFuture ??= _init());

  Future<void> _init() async {
    try {
      await AudioPlayer.global.setAudioContext(
        AudioContextConfig(focus: AudioContextConfigFocus.mixWithOthers).build(),
      );
    } catch (e) {
      debugPrint('audio context: $e');
    }
    for (final entry in _files.entries) {
      final list = <AudioPlayer>[];
      for (var i = 0; i < _voices; i++) {
        try {
          final p = AudioPlayer();
          await p.setPlayerMode(PlayerMode.lowLatency);
          await p.setReleaseMode(ReleaseMode.stop);
          await p.setSource(AssetSource(entry.value));
          list.add(p);
        } catch (e) {
          debugPrint('sfx ${entry.key}: $e');
        }
      }
      _players[entry.key] = list;
      _next[entry.key] = 0;
    }
    try {
      final m = AudioPlayer();
      await m.setReleaseMode(ReleaseMode.loop);
      await m.setVolume(0.32);
      await m.setSource(AssetSource('sounds/music.ogg'));
      _music = m;
    } catch (e) {
      debugPrint('music: $e');
    }
    _ready = true;
    SettingsStore.instance.addListener(_syncMusic);
    _syncMusic();
  }

  void play(Sfx sfx, {double volume = 1.0}) {
    if (!_ready || !SettingsStore.instance.soundOn) return;
    final list = _players[sfx];
    if (list == null || list.isEmpty) return;
    final i = _next[sfx]! % list.length;
    _next[sfx] = i + 1;
    final p = list[i];
    () async {
      try {
        await p.stop();
        await p.setVolume(volume);
        await p.resume();
      } catch (e) {
        debugPrint('play $sfx: $e');
      }
    }();
  }

  void setForeground(bool foreground) {
    _appInForeground = foreground;
    _syncMusic();
  }

  void _syncMusic() {
    final m = _music;
    if (m == null) return;
    final want = SettingsStore.instance.musicOn && _appInForeground;
    if (want && !_musicPlaying) {
      _musicPlaying = true;
      m.resume().catchError((Object e) => debugPrint('music resume: $e'));
    } else if (!want && _musicPlaying) {
      _musicPlaying = false;
      m.pause().catchError((Object e) => debugPrint('music pause: $e'));
    }
  }
}

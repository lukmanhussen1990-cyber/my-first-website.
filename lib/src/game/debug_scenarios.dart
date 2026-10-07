import 'dart:math';

import 'package:flutter/foundation.dart';

import '../logic/board.dart';
import '../logic/game.dart';
import '../logic/shapes.dart';

/// Deterministic board setups used only by the web build for automated
/// visual testing (`?scenario=<name>`). Never active on Android.
class DebugScenarios {
  static String? get requested {
    if (!kIsWeb) return null;
    return Uri.base.queryParameters['scenario'];
  }

  static bool get skipSplash => kIsWeb && Uri.base.queryParameters.containsKey('game');

  /// `?screen=home|premium` opens that screen directly (web QA only).
  static String? get screen => kIsWeb ? Uri.base.queryParameters['screen'] : null;

  /// `?premium=1` simulates an active subscription (web QA only).
  static bool get premiumPreview => kIsWeb && Uri.base.queryParameters['premium'] == '1';

  /// `?skin=neon` picks a block skin (web QA only).
  static String? get skin => kIsWeb ? Uri.base.queryParameters['skin'] : null;

  static Board _board(List<String> rows) {
    final b = Board();
    for (var r = 0; r < 8; r++) {
      for (var c = 0; c < 8; c++) {
        final ch = rows[r][c];
        if (ch != '.') b.set(r, c, int.parse(ch));
      }
    }
    return b;
  }

  static Piece _p(String id, int color) => Piece(kShapeById[id]!, color);

  static GameState? build(String name) {
    switch (name) {
      case 'demo':
        return GameState.custom(
          board: _board([
            '2225...5',
            '.255.6.5',
            '.000.6..',
            '.0...6.4',
            '.02500.4',
            '....1...',
            '5...12..',
            '...112..',
          ]),
          tray: [_p('l_270', 0), _p('t_up', 1), _p('h2', 6)],
          score: 206,
          random: Random(1),
        );
      case 'clear':
        return GameState.custom(
          board: _board([
            '........',
            '........',
            '........',
            '...2....',
            '..22....',
            '0000.33.',
            '1234560.',
            '6543210.',
          ]),
          tray: [_p('v2', 4), _p('dot', 2), _p('corner_a', 3)],
          score: 120,
          random: Random(2),
        );
      case 'combo':
        return GameState.custom(
          board: _board([
            '........',
            '........',
            '........',
            '........',
            '........',
            '0123456.',
            '6543210.',
            '0246135.',
          ]),
          tray: [_p('dot', 1), _p('dot', 5), _p('dot', 6)],
          score: 300,
          random: Random(3),
        );
      case 'over':
        return GameState.custom(
          board: _board([
            '0.1.2.3.',
            '.4.5.6.0',
            '1.2.3.4.',
            '.5.6.0.1',
            '2.3.4.5.',
            '.6.0.1.2',
            '3.4.5.6.',
            '.0.1.2.3',
          ]),
          tray: [_p('dot', 2), _p('sq3', 5), _p('h5', 0)],
          score: 512,
          random: Random(4),
        );
    }
    return null;
  }
}

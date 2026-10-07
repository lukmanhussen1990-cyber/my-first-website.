import 'dart:math';

import 'package:blockblast/src/logic/board.dart';
import 'package:blockblast/src/logic/game.dart';
import 'package:blockblast/src/logic/hint.dart';
import 'package:blockblast/src/logic/shapes.dart';
import 'package:flutter_test/flutter_test.dart';

Board boardFrom(List<String> rows) {
  final b = Board();
  for (var r = 0; r < 8; r++) {
    for (var c = 0; c < 8; c++) {
      if (rows[r][c] != '.') b.set(r, c, int.parse(rows[r][c]));
    }
  }
  return b;
}

Piece p(String id, [int color = 1]) => Piece(kShapeById[id]!, color);

/// A stuck position: only a 3x3 left in the tray and no 3x3 space.
GameState stuckGame() {
  final game = GameState.custom(
    board: boardFrom([
      '11111.11',
      '22.22222',
      '3333.333',
      '444.4444',
      '55555.55',
      '6.666666',
      '000000.0',
      '1111111.',
    ]),
    tray: [p('sq3'), null, null],
    score: 420,
    combo: 3,
    random: Random(7),
  );
  return game;
}

void main() {
  group('revive', () {
    test('only works once the game is over', () {
      final game = GameState.custom(board: Board(), tray: [p('dot'), null, null]);
      expect(game.gameOver, isFalse);
      expect(game.revive(), isNull);
    });

    test('empties the two fullest rows and columns and continues the game', () {
      final game = stuckGame();
      expect(game.gameOver, isTrue);
      final filledBefore = game.board.filledCount;

      final result = game.revive();
      expect(result, isNotNull);
      expect(result!.lines.rows.length, 2);
      expect(result.lines.cols.length, 2);
      for (final r in result.lines.rows) {
        for (var c = 0; c < 8; c++) {
          expect(game.board.isEmptyAt(r, c), isTrue);
        }
      }
      for (final c in result.lines.cols) {
        for (var r = 0; r < 8; r++) {
          expect(game.board.isEmptyAt(r, c), isTrue);
        }
      }
      expect(game.board.filledCount, filledBefore - result.clearedCells.length);
      expect(game.gameOver, isFalse);
      expect(game.anyTrayPieceFits(), isTrue);
      // Free second chance: no points, combo resets.
      expect(game.score, 420);
      expect(game.combo, 0);
      expect(game.revivesUsed, 1);
    });

    test('random stuck boards always become playable', () {
      final rng = Random(42);
      var revived = 0;
      for (var i = 0; i < 300 && revived < 40; i++) {
        final cells = List<int>.generate(64, (_) => rng.nextDouble() < 0.82 ? rng.nextInt(7) : Board.empty);
        final game = GameState.custom(
          board: Board.fromCells(cells),
          tray: [p('sq3'), p('h5'), p('bigl_a')],
          random: Random(i),
        );
        if (!game.gameOver) continue;
        revived++;
        expect(game.revive(), isNotNull);
        expect(game.gameOver, isFalse);
        expect(game.anyTrayPieceFits(), isTrue);
      }
      expect(revived, greaterThan(10));
    });
  });

  group('saved games', () {
    test('hint and revive counters survive a save', () {
      final game = GameState.custom(board: Board(), tray: [p('dot'), p('h2'), null], hintsUsed: 2, revivesUsed: 1);
      final restored = GameState.fromJson(game.toJson())!;
      expect(restored.hintsUsed, 2);
      expect(restored.revivesUsed, 1);
    });

    test('saves from version 1.0 still load', () {
      final v10 = {
        'v': 1,
        'board': List<int>.filled(64, Board.empty)..[0] = 3,
        'tray': [
          {'s': 'h3', 'c': 2},
          null,
          {'s': 'dot', 'c': 5},
        ],
        'score': 168,
        'combo': 1,
        'moves': 12,
      };
      final restored = GameState.fromJson(v10)!;
      expect(restored.score, 168);
      expect(restored.board.get(0, 0), 3);
      expect(restored.hintsUsed, 0);
      expect(restored.revivesUsed, 0);
    });
  });

  group('hints', () {
    test('suggest the move that completes a line', () {
      final game = GameState.custom(
        board: boardFrom([
          '1111.111',
          '........',
          '........',
          '........',
          '........',
          '........',
          '........',
          '........',
        ]),
        tray: [p('sq2'), p('dot'), p('h2')],
      );
      final hint = HintSolver.find(game)!;
      expect(hint.linesCleared, 1);
      expect(game.canPlace(hint.slot, hint.row, hint.col), isTrue);
      final copy = GameState.fromJson(game.toJson())!;
      expect(copy.place(hint.slot, hint.row, hint.col)!.linesCleared, 1);
    });

    test('keep the rest of the tray placeable', () {
      // Only the bottom-right 3x3 can take the big square; the hint must not
      // spend that space on the single block.
      final game = GameState.custom(
        board: boardFrom([
          '1111.111',
          '22222222'.replaceRange(4, 5, '.'),
          '33333...',
          '44444...',
          '55555...',
          '666666.6',
          '0000000.',
          '1111111.',
        ]),
        tray: [p('dot'), p('sq3'), null],
      );
      final hint = HintSolver.find(game)!;
      final next = GameState.fromJson(game.toJson())!..place(hint.slot, hint.row, hint.col);
      final big = next.tray.whereType<Piece>().where((x) => x.shape.id == 'sq3');
      if (big.isNotEmpty) {
        expect(next.board.canFitAnywhere(big.first.shape), isTrue);
      }
    });

    test('are always legal moves and fast enough to compute on tap', () {
      final rng = Random(3);
      final sw = Stopwatch()..start();
      var checked = 0;
      for (var i = 0; i < 200; i++) {
        final cells = List<int>.generate(64, (_) => rng.nextDouble() < 0.5 ? rng.nextInt(7) : Board.empty);
        final game = GameState.custom(
          board: Board.fromCells(cells),
          tray: [for (var s = 0; s < 3; s++) Piece(kShapes[rng.nextInt(kShapes.length)], s)],
          random: Random(i),
        );
        final hint = HintSolver.find(game);
        if (game.gameOver) {
          expect(hint, isNull);
          continue;
        }
        expect(hint, isNotNull);
        expect(game.canPlace(hint!.slot, hint.row, hint.col), isTrue);
        checked++;
      }
      sw.stop();
      expect(checked, greaterThan(50));
      // Debug-mode VM; release builds are several times faster.
      expect(sw.elapsedMilliseconds / 200, lessThan(150));
    });
  });
}

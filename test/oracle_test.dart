import 'dart:math';

import 'package:blockblast/src/logic/game.dart';
import 'package:flutter_test/flutter_test.dart';

/// Independent re-implementation of the rules used as a test oracle.
class Oracle {
  final List<List<bool>> cells = List.generate(8, (_) => List.filled(8, false));
  int score = 0;
  int combo = 0;

  ({int lines, int points}) place(List<List<int>> shape, int row, int col) {
    for (final c in shape) {
      final r = row + c[0], cc = col + c[1];
      if (r < 0 || r > 7 || cc < 0 || cc > 7 || cells[r][cc]) {
        throw StateError('oracle: invalid placement');
      }
    }
    for (final c in shape) {
      cells[row + c[0]][col + c[1]] = true;
    }
    final fullRows = [for (var r = 0; r < 8; r++) if (cells[r].every((x) => x)) r];
    final fullCols = [
      for (var c = 0; c < 8; c++)
        if (List.generate(8, (r) => cells[r][c]).every((x) => x)) c,
    ];
    for (final r in fullRows) {
      for (var c = 0; c < 8; c++) {
        cells[r][c] = false;
      }
    }
    for (final c in fullCols) {
      for (var r = 0; r < 8; r++) {
        cells[r][c] = false;
      }
    }
    final n = fullRows.length + fullCols.length;
    var points = shape.length;
    if (n > 0) {
      combo += 1;
      var base = 0;
      for (var k = 1; k <= n; k++) {
        base += 10 * k; // 10, 30, 60, 100, ...
      }
      points += base * combo;
    } else {
      combo = 0;
    }
    score += points;
    return (lines: n, points: points);
  }
}

void main() {
  test('engine matches an independent rules oracle over many random games', () {
    final rng = Random(2024);
    var totalMoves = 0, totalClears = 0, maxCombo = 0, multiLine = 0;
    for (var gameNo = 0; gameNo < 60; gameNo++) {
      final game = GameState(random: Random(1000 + gameNo));
      final oracle = Oracle();
      var guard = 0;
      while (!game.gameOver && guard++ < 400) {
        // Collect every legal move, prefer ones that clear lines sometimes so
        // combos and multi-line clears are exercised.
        final moves = <List<int>>[];
        for (var s = 0; s < 3; s++) {
          final p = game.tray[s];
          if (p == null) continue;
          for (var r = 0; r < 8; r++) {
            for (var c = 0; c < 8; c++) {
              if (game.board.canPlace(p.shape, r, c)) moves.add([s, r, c]);
            }
          }
        }
        expect(moves, isNotEmpty, reason: 'game not over but no legal move');
        List<int> pick = moves[rng.nextInt(moves.length)];
        if (rng.nextDouble() < 0.7) {
          var best = -1;
          for (final m in moves) {
            final p = game.tray[m[0]]!;
            final n = game.board.linesCompletedBy(p.shape, m[1], m[2]).count;
            if (n > best) {
              best = n;
              pick = m;
            }
          }
        }
        final piece = game.tray[pick[0]]!;
        final shape = [for (final c in piece.shape.cells) [c.r, c.c]];
        final expected = oracle.place(shape, pick[1], pick[2]);
        final result = game.place(pick[0], pick[1], pick[2])!;

        expect(result.linesCleared, expected.lines);
        expect(result.totalPoints, expected.points);
        expect(game.score, oracle.score);
        expect(game.combo, oracle.combo);
        for (var r = 0; r < 8; r++) {
          for (var c = 0; c < 8; c++) {
            expect(!game.board.isEmptyAt(r, c), oracle.cells[r][c], reason: 'cell $r,$c');
          }
        }
        totalMoves++;
        if (expected.lines > 0) totalClears++;
        if (expected.lines > 1) multiLine++;
        maxCombo = max(maxCombo, oracle.combo);
      }
      expect(game.gameOver, isTrue);
      // Game over means: no tray piece fits anywhere (checked independently).
      for (final p in game.tray) {
        if (p == null) continue;
        for (var r = 0; r < 8; r++) {
          for (var c = 0; c < 8; c++) {
            final fits = p.shape.cells.every((cell) {
              final rr = r + cell.r, cc = c + cell.c;
              return rr < 8 && cc < 8 && !oracle.cells[rr][cc];
            });
            expect(fits, isFalse);
          }
        }
      }
    }
    // The run must actually have exercised the interesting rules.
    expect(totalMoves, greaterThan(1000));
    expect(totalClears, greaterThan(100));
    expect(multiLine, greaterThan(10));
    expect(maxCombo, greaterThanOrEqualTo(3));
  });
}

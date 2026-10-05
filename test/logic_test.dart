import 'dart:math';

import 'package:blockblast/src/logic/board.dart';
import 'package:blockblast/src/logic/game.dart';
import 'package:blockblast/src/logic/shapes.dart';
import 'package:flutter_test/flutter_test.dart';

PieceShape shape(String id) => kShapeById[id]!;

/// Builds a board from 8 strings ('#' = filled with color 0, '.' = empty).
Board boardFrom(List<String> rows) {
  assert(rows.length == 8);
  final b = Board();
  for (var r = 0; r < 8; r++) {
    for (var c = 0; c < 8; c++) {
      if (rows[r][c] == '#') b.set(r, c, 0);
    }
  }
  return b;
}

void main() {
  group('Shapes', () {
    test('ids are unique and cells are normalized', () {
      final ids = <String>{};
      for (final s in kShapes) {
        expect(ids.add(s.id), isTrue, reason: 'duplicate ${s.id}');
        expect(s.cells.map((c) => c.r).reduce(min), 0);
        expect(s.cells.map((c) => c.c).reduce(min), 0);
        expect(s.cells.toSet().length, s.cells.length);
        expect(s.weight, greaterThan(0));
      }
    });

    test('catalog contains every required family', () {
      expect(shape('dot').size, 1);
      for (final n in [2, 3, 4, 5]) {
        expect(shape('h$n').cols, n);
        expect(shape('h$n').rows, 1);
        expect(shape('v$n').rows, n);
        expect(shape('v$n').cols, 1);
      }
      expect(shape('sq2').size, 4);
      expect(shape('sq3').size, 9);
      expect(shape('rect23').rows, 2);
      expect(shape('rect23').cols, 3);
      expect(shape('rect32').rows, 3);
      expect(shape('rect32').cols, 2);
      for (final id in ['l_0', 'l_90', 'l_180', 'l_270', 'j_0', 'j_90', 'j_180', 'j_270']) {
        expect(shape(id).size, 4);
      }
      for (final id in ['bigl_a', 'bigl_b', 'bigl_c', 'bigl_d']) {
        expect(shape(id).size, 5);
        expect(shape(id).rows, 3);
        expect(shape(id).cols, 3);
      }
      for (final id in ['t_up', 't_down', 't_left', 't_right', 's_h', 's_v', 'z_h', 'z_v']) {
        expect(shape(id).size, 4);
      }
      for (final id in ['corner_a', 'corner_b', 'corner_c', 'corner_d']) {
        expect(shape(id).size, 3);
      }
      expect(shape('diag2_a').size, 2);
      expect(shape('diag3_a').size, 3);
      expect(shape('diag3_b').cells, containsAll([const Cell(0, 2), const Cell(1, 1), const Cell(2, 0)]));
    });
  });

  group('Placement validation', () {
    test('accepts empty in-bounds cells', () {
      final b = Board();
      expect(b.canPlace(shape('sq3'), 0, 0), isTrue);
      expect(b.canPlace(shape('sq3'), 5, 5), isTrue);
      expect(b.canPlace(shape('h5'), 7, 3), isTrue);
    });

    test('rejects out-of-bounds placements', () {
      final b = Board();
      expect(b.canPlace(shape('sq3'), 6, 0), isFalse);
      expect(b.canPlace(shape('sq3'), 0, 6), isFalse);
      expect(b.canPlace(shape('h5'), 0, 4), isFalse);
      expect(b.canPlace(shape('v5'), 4, 0), isFalse);
      expect(b.canPlace(shape('dot'), -1, 0), isFalse);
      expect(b.canPlace(shape('dot'), 0, 8), isFalse);
    });

    test('rejects overlap but allows filling holes of a shape', () {
      final b = Board()..set(1, 1, 3);
      expect(b.canPlace(shape('sq2'), 0, 0), isFalse);
      expect(b.canPlace(shape('sq2'), 1, 1), isFalse);
      expect(b.canPlace(shape('sq2'), 2, 2), isTrue);
      // The diagonal piece only needs (0,0) and (1,1)... so with (1,1) taken
      // it must fail, while the other diagonal fits around it.
      expect(b.canPlace(shape('diag2_a'), 0, 0), isFalse);
      expect(b.canPlace(shape('diag2_b'), 0, 0), isTrue);
    });

    test('canFitAnywhere detects a single remaining hole', () {
      final rows = List.filled(8, '########');
      rows[4] = '###.####';
      final b = boardFrom(rows);
      expect(b.canFitAnywhere(shape('dot')), isTrue);
      expect(b.canFitAnywhere(shape('h2')), isFalse);
      expect(b.canFitAnywhere(shape('v2')), isFalse);
    });
  });

  group('Line clearing', () {
    test('detects and clears a full row', () {
      final b = boardFrom([
        '........',
        '........',
        '########',
        '........',
        '........',
        '........',
        '........',
        '........',
      ]);
      final lines = b.fullLines();
      expect(lines.rows, [2]);
      expect(lines.cols, isEmpty);
      final removed = b.clearLines(lines);
      expect(removed.length, 8);
      expect(b.isCompletelyEmpty, isTrue);
    });

    test('row + column intersection removed once', () {
      final rows = List.filled(8, '...#....');
      rows[5] = '########';
      final b = boardFrom(rows);
      final lines = b.fullLines();
      expect(lines.rows, [5]);
      expect(lines.cols, [3]);
      expect(lines.count, 2);
      final removed = b.clearLines(lines);
      expect(removed.length, 15);
      expect(b.isCompletelyEmpty, isTrue);
    });

    test('linesCompletedBy previews the clear without mutating', () {
      final b = boardFrom([
        '#######.',
        '#######.',
        '........',
        '........',
        '........',
        '........',
        '........',
        '........',
      ]);
      final preview = b.linesCompletedBy(shape('v2'), 0, 7);
      expect(preview.rows, [0, 1]);
      expect(b.get(0, 7), Board.empty);
      expect(b.linesCompletedBy(shape('v2'), 1, 0), same(LineSet.empty));
    });
  });

  group('Scoring', () {
    test('line bonus table', () {
      expect(Scoring.lineBonus(0), 0);
      expect(Scoring.lineBonus(1), 10);
      expect(Scoring.lineBonus(2), 30);
      expect(Scoring.lineBonus(3), 60);
      expect(Scoring.lineBonus(4), 100);
      expect(Scoring.lineBonus(5), 150);
    });

    test('placement gives one point per cell', () {
      final g = GameState.custom(
        board: Board(),
        tray: [Piece(shape('sq3'), 0), Piece(shape('dot'), 1), Piece(shape('h5'), 2)],
      );
      final r = g.place(0, 0, 0)!;
      expect(r.placementPoints, 9);
      expect(r.lineBonus, 0);
      expect(g.score, 9);
      expect(g.combo, 0);
    });

    test('single line clear gives +10 on top of the cells', () {
      final g = GameState.custom(
        board: boardFrom([
          '###.....',
          '........',
          '........',
          '........',
          '........',
          '........',
          '........',
          '........',
        ]),
        tray: [Piece(shape('h5'), 4), Piece(shape('dot'), 1), Piece(shape('dot'), 2)],
      );
      final r = g.place(0, 0, 3)!;
      expect(r.clearedLines.rows, [0]);
      expect(r.lineBonus, 10);
      expect(g.score, 5 + 10);
      expect(r.combo, 1);
      expect(r.isCombo, isFalse);
      expect(g.board.isCompletelyEmpty, isTrue);
      expect(r.boardCleared, isTrue);
    });

    test('double line clear gives +30', () {
      final g = GameState.custom(
        board: boardFrom([
          '######..',
          '######..',
          '........',
          '........',
          '........',
          '........',
          '........',
          '........',
        ]),
        tray: [Piece(shape('sq2'), 4), Piece(shape('dot'), 1), Piece(shape('dot'), 2)],
      );
      final r = g.place(0, 0, 6)!;
      expect(r.linesCleared, 2);
      expect(r.lineBonus, 30);
      expect(g.score, 4 + 30);
      expect(r.praise, 'Good!');
    });

    test('combo multiplies the line bonus and resets on a dry move', () {
      final g = GameState.custom(
        board: boardFrom([
          '#######.',
          '#######.',
          '#######.',
          '........',
          '........',
          '........',
          '........',
          '........',
        ]),
        tray: [Piece(shape('dot'), 0), Piece(shape('dot'), 1), Piece(shape('dot'), 2)],
      );
      final r1 = g.place(0, 0, 7)!;
      expect(r1.lineBonus, 10);
      expect(r1.combo, 1);
      final r2 = g.place(1, 1, 7)!;
      expect(r2.combo, 2);
      expect(r2.isCombo, isTrue);
      expect(r2.lineBonus, 20); // 10 x combo 2
      final r3 = g.place(2, 2, 7)!;
      expect(r3.combo, 3);
      expect(r3.lineBonus, 30); // 10 x combo 3
      expect(g.score, 3 + 10 + 20 + 30);
      // Tray refilled; a move that clears nothing resets the streak.
      expect(r3.trayRefilled, isTrue);
      expect(g.board.isCompletelyEmpty, isTrue);
      const slot = 0;
      final p = g.tray[slot]!;
      // On an empty board no single piece can complete a line.
      final placed = g.place(slot, 0, 0);
      expect(placed, isNotNull, reason: 'shape ${p.shape.id}');
      expect(placed!.linesCleared, 0);
      expect(g.combo, 0);
    });

    test('combo applies the multiplier to multi-line clears', () {
      final g = GameState.custom(
        board: boardFrom([
          '######..',
          '######..',
          '.......#',
          '.......#',
          '.......#',
          '.......#',
          '.......#',
          '.......#',
        ]),
        tray: [Piece(shape('sq2'), 0), Piece(shape('dot'), 1), Piece(shape('dot'), 2)],
        combo: 2,
      );
      final r = g.place(0, 0, 6)!;
      // Rows 0,1 and column 7 -> 3 lines = 60, combo 3 -> 180.
      expect(r.linesCleared, 3);
      expect(r.combo, 3);
      expect(r.lineBonus, 180);
      expect(r.praise, 'Great!');
    });
  });

  group('Tray and game over', () {
    test('invalid drop leaves state untouched', () {
      final b = Board()..set(0, 0, 1);
      final g = GameState.custom(
        board: b,
        tray: [Piece(shape('sq2'), 0), Piece(shape('dot'), 1), Piece(shape('dot'), 2)],
      );
      expect(g.place(0, 0, 0), isNull);
      expect(g.place(0, 7, 7), isNull);
      expect(g.tray[0], isNotNull);
      expect(g.score, 0);
    });

    test('tray refills only after all three pieces are used', () {
      final g = GameState.custom(
        board: Board(),
        tray: [Piece(shape('dot'), 0), Piece(shape('dot'), 1), Piece(shape('dot'), 2)],
        random: Random(7),
      );
      expect(g.place(0, 0, 0)!.trayRefilled, isFalse);
      expect(g.tray.where((p) => p != null).length, 2);
      expect(g.place(1, 7, 7)!.trayRefilled, isFalse);
      final r = g.place(2, 3, 3)!;
      expect(r.trayRefilled, isTrue);
      expect(g.tray.every((p) => p != null), isTrue);
    });

    test('game over when no remaining piece fits', () {
      // Checkerboard: no two orthogonally adjacent holes.
      final rows = [
        for (var r = 0; r < 8; r++)
          String.fromCharCodes([for (var c = 0; c < 8; c++) ((r + c).isEven ? '#' : '.').codeUnitAt(0)]),
      ];
      final g = GameState.custom(
        board: boardFrom(rows),
        tray: [Piece(shape('h2'), 0), Piece(shape('sq2'), 1), Piece(shape('v3'), 2)],
      );
      expect(g.gameOver, isTrue);
      expect(g.place(0, 0, 1), isNull);
    });

    test('not game over while one piece still fits', () {
      final rows = [
        for (var r = 0; r < 8; r++)
          String.fromCharCodes([for (var c = 0; c < 8; c++) ((r + c).isEven ? '#' : '.').codeUnitAt(0)]),
      ];
      final g = GameState.custom(
        board: boardFrom(rows),
        tray: [Piece(shape('h2'), 0), Piece(shape('diag2_a'), 1), Piece(shape('v3'), 2)],
      );
      expect(g.gameOver, isFalse);
      expect(g.pieceFits(0), isFalse);
      expect(g.pieceFits(1), isTrue);
    });

    test('placing the last fitting piece can end the game', () {
      // Checkerboard: only single cells (and diagonals) fit.
      final rows = [
        for (var r = 0; r < 8; r++)
          String.fromCharCodes([for (var c = 0; c < 8; c++) ((r + c).isEven ? '#' : '.').codeUnitAt(0)]),
      ];
      final g = GameState.custom(
        board: boardFrom(rows),
        tray: [Piece(shape('dot'), 0), Piece(shape('h3'), 1), Piece(shape('sq2'), 2)],
      );
      expect(g.gameOver, isFalse);
      final r = g.place(0, 0, 1)!;
      expect(r.linesCleared, 0);
      expect(r.trayRefilled, isFalse);
      expect(r.gameOver, isTrue);
      expect(g.gameOver, isTrue);
    });

    test('generator is fair on an empty board and pieces use 7 colors', () {
      final g = GameState(random: Random(42));
      final colors = <int>{};
      for (var i = 0; i < 200; i++) {
        g.board = Board();
        g.refillTray();
        for (final p in g.tray) {
          expect(p, isNotNull);
          expect(g.board.canFitAnywhere(p!.shape), isTrue);
          colors.add(p.color);
        }
        // The three pieces of a set get distinct colors.
        expect(g.tray.map((p) => p!.color).toSet().length, 3);
      }
      expect(colors.length, kColorCount);
    });

    test('random play never places an invalid piece and ends cleanly', () {
      final rng = Random(1234);
      for (var game = 0; game < 30; game++) {
        final g = GameState(random: Random(game));
        var guard = 0;
        while (!g.gameOver && guard++ < 2000) {
          final options = <List<int>>[];
          for (var s = 0; s < 3; s++) {
            final p = g.tray[s];
            if (p == null) continue;
            for (var r = 0; r < 8; r++) {
              for (var c = 0; c < 8; c++) {
                if (g.board.canPlace(p.shape, r, c)) options.add([s, r, c]);
              }
            }
          }
          expect(options, isNotEmpty);
          final o = options[rng.nextInt(options.length)];
          final before = g.score;
          final res = g.place(o[0], o[1], o[2]);
          expect(res, isNotNull);
          expect(g.score, before + res!.totalPoints);
          expect(g.board.fullLines().isEmpty, isTrue);
        }
        expect(g.gameOver, isTrue);
        expect(g.anyTrayPieceFits(), isFalse);
      }
    });
  });

  group('Persistence', () {
    test('save / restore round trip', () {
      final g = GameState(random: Random(3));
      final slot = g.tray.indexWhere((p) => p != null);
      g.place(slot, 0, 0);
      final json = g.toJson();
      final restored = GameState.fromJson(json)!;
      expect(restored.board.cells, g.board.cells);
      expect(restored.score, g.score);
      expect(restored.combo, g.combo);
      for (var i = 0; i < 3; i++) {
        expect(restored.tray[i]?.shape.id, g.tray[i]?.shape.id);
        expect(restored.tray[i]?.color, g.tray[i]?.color);
      }
    });

    test('corrupt data is rejected', () {
      expect(GameState.fromJson(null), isNull);
      expect(
        GameState.fromJson({
          'board': [1, 2, 3],
        }),
        isNull,
      );
      expect(
        GameState.fromJson({
          'board': List.filled(64, 99),
          'tray': [null, null, null],
          'score': 0,
        }),
        isNull,
      );
    });
  });
}

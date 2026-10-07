import 'board.dart';
import 'game.dart';

/// A suggested move: drop the tray piece in [slot] with its top-left cell
/// at ([row], [col]).
class Hint {
  final int slot;
  final int row;
  final int col;
  final int linesCleared;

  const Hint(this.slot, this.row, this.col, this.linesCleared);

  @override
  String toString() => 'Hint(slot $slot at $row,$col, lines $linesCleared)';
}

/// Finds a good move for the current tray.
///
/// Every legal placement is scored on what it leaves behind: cleared lines,
/// whether the remaining tray pieces can still all be placed, and how
/// "clean" the board stays (few isolated holes and ragged edges).
class HintSolver {
  HintSolver._();

  static Hint? find(GameState game) {
    if (game.gameOver) return null;
    Hint? best;
    var bestScore = double.negativeInfinity;
    final board = game.board;
    for (var slot = 0; slot < GameState.traySize; slot++) {
      final piece = game.tray[slot];
      if (piece == null) continue;
      final rest = [
        for (var i = 0; i < GameState.traySize; i++)
          if (i != slot && game.tray[i] != null) game.tray[i]!,
      ];
      final shape = piece.shape;
      for (var r = 0; r <= Board.size - shape.rows; r++) {
        for (var c = 0; c <= Board.size - shape.cols; c++) {
          if (!board.canPlace(shape, r, c)) continue;
          final next = board.copy()..place(shape, piece.color, r, c);
          final lines = next.fullLines();
          next.clearLines(lines);
          final score = _evaluate(next, lines.count, rest);
          if (score > bestScore) {
            bestScore = score;
            best = Hint(slot, r, c, lines.count);
          }
        }
      }
    }
    return best;
  }

  static double _evaluate(Board b, int lines, List<Piece> rest) {
    var s = lines * 40.0 + (lines >= 2 ? lines * 15.0 : 0);
    if (rest.isNotEmpty) {
      if (GameState.canPlaceAll(b, rest, budget: 900)) {
        s += 120;
      } else {
        for (final p in rest) {
          s += b.canFitAnywhere(p.shape) ? 20 : -150;
        }
      }
    }
    s -= _isolatedHoles(b) * 12;
    s -= _transitions(b) * 1.5;
    return s;
  }

  /// Empty cells closed in on all four sides (hard to ever fill).
  static int _isolatedHoles(Board b) {
    var n = 0;
    bool blocked(int r, int c) => !Board.inBounds(r, c) || !b.isEmptyAt(r, c);
    for (var r = 0; r < Board.size; r++) {
      for (var c = 0; c < Board.size; c++) {
        if (b.isEmptyAt(r, c) && blocked(r - 1, c) && blocked(r + 1, c) && blocked(r, c - 1) && blocked(r, c + 1)) {
          n++;
        }
      }
    }
    return n;
  }

  /// Number of filled/empty changes along rows and columns (raggedness).
  static int _transitions(Board b) {
    var n = 0;
    for (var i = 0; i < Board.size; i++) {
      for (var j = 0; j < Board.size - 1; j++) {
        if (b.isEmptyAt(i, j) != b.isEmptyAt(i, j + 1)) n++;
        if (b.isEmptyAt(j, i) != b.isEmptyAt(j + 1, i)) n++;
      }
    }
    return n;
  }
}

import 'shapes.dart';

/// A cell that was removed by a line clear, with the color it had.
class ClearedCell {
  final int r;
  final int c;
  final int color;
  const ClearedCell(this.r, this.c, this.color);
}

/// Rows / columns that are (or would become) full.
class LineSet {
  final List<int> rows;
  final List<int> cols;
  const LineSet(this.rows, this.cols);

  static const empty = LineSet([], []);

  int get count => rows.length + cols.length;
  bool get isEmpty => count == 0;
  bool get isNotEmpty => count > 0;

  bool containsCell(int r, int c) => rows.contains(r) || cols.contains(c);
}

/// The 8x8 playing field. Each cell stores a color index, or [Board.empty].
class Board {
  static const int size = 8;
  static const int empty = -1;

  final List<int> _cells;

  Board() : _cells = List<int>.filled(size * size, empty);

  Board.fromCells(List<int> cells) : _cells = List<int>.of(cells) {
    if (cells.length != size * size) {
      throw ArgumentError('Board needs ${size * size} cells, got ${cells.length}');
    }
  }

  Board copy() => Board.fromCells(_cells);

  List<int> get cells => List.unmodifiable(_cells);

  int get(int r, int c) => _cells[r * size + c];

  void set(int r, int c, int color) => _cells[r * size + c] = color;

  bool isEmptyAt(int r, int c) => get(r, c) == empty;

  bool get isCompletelyEmpty => _cells.every((v) => v == empty);

  int get filledCount => _cells.where((v) => v != empty).length;

  static bool inBounds(int r, int c) => r >= 0 && r < size && c >= 0 && c < size;

  /// True when every cell of [shape], anchored with its top-left at
  /// ([row], [col]), lands inside the board on an empty cell.
  bool canPlace(PieceShape shape, int row, int col) {
    if (row < 0 || col < 0 || row + shape.rows > size || col + shape.cols > size) {
      return false;
    }
    for (final cell in shape.cells) {
      if (_cells[(row + cell.r) * size + col + cell.c] != empty) return false;
    }
    return true;
  }

  /// Writes the piece into the board. Caller must check [canPlace] first.
  void place(PieceShape shape, int color, int row, int col) {
    assert(canPlace(shape, row, col));
    for (final cell in shape.cells) {
      _cells[(row + cell.r) * size + col + cell.c] = color;
    }
  }

  bool canFitAnywhere(PieceShape shape) {
    for (var r = 0; r <= size - shape.rows; r++) {
      for (var c = 0; c <= size - shape.cols; c++) {
        if (canPlace(shape, r, c)) return true;
      }
    }
    return false;
  }

  /// Rows and columns that are completely filled right now.
  LineSet fullLines() {
    final rows = <int>[];
    final cols = <int>[];
    for (var r = 0; r < size; r++) {
      var full = true;
      for (var c = 0; c < size; c++) {
        if (_cells[r * size + c] == empty) {
          full = false;
          break;
        }
      }
      if (full) rows.add(r);
    }
    for (var c = 0; c < size; c++) {
      var full = true;
      for (var r = 0; r < size; r++) {
        if (_cells[r * size + c] == empty) {
          full = false;
          break;
        }
      }
      if (full) cols.add(c);
    }
    return LineSet(rows, cols);
  }

  /// Lines that would be completed if [shape] were placed at ([row], [col]).
  /// Returns [LineSet.empty] when the placement is invalid.
  LineSet linesCompletedBy(PieceShape shape, int row, int col) {
    if (!canPlace(shape, row, col)) return LineSet.empty;
    final probe = copy()..place(shape, 0, row, col);
    return probe.fullLines();
  }

  /// Empties every cell of the given lines and returns what was removed.
  /// A cell at a row/column intersection is reported once.
  List<ClearedCell> clearLines(LineSet lines) {
    final removed = <ClearedCell>[];
    for (var r = 0; r < size; r++) {
      for (var c = 0; c < size; c++) {
        if (lines.containsCell(r, c)) {
          final v = _cells[r * size + c];
          if (v != empty) {
            removed.add(ClearedCell(r, c, v));
            _cells[r * size + c] = empty;
          }
        }
      }
    }
    return removed;
  }

  @override
  String toString() {
    final b = StringBuffer();
    for (var r = 0; r < size; r++) {
      for (var c = 0; c < size; c++) {
        b.write(isEmptyAt(r, c) ? '.' : '#');
      }
      if (r < size - 1) b.writeln();
    }
    return b.toString();
  }
}

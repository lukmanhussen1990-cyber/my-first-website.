/// Piece shape catalog for the 8x8 block puzzle.
///
/// Every shape is described with an ASCII pattern ('#' = block) so the
/// catalog stays readable. Cells are normalized so the top-left of the
/// bounding box is (0, 0).
library;

class Cell {
  final int r;
  final int c;
  const Cell(this.r, this.c);

  @override
  bool operator ==(Object other) => other is Cell && other.r == r && other.c == c;

  @override
  int get hashCode => r * 31 + c;

  @override
  String toString() => '($r,$c)';
}

class PieceShape {
  final String id;
  final List<Cell> cells;
  final int rows;
  final int cols;

  /// Relative spawn weight (higher = more frequent).
  final int weight;

  const PieceShape._(this.id, this.cells, this.rows, this.cols, this.weight);

  factory PieceShape.fromPattern(String id, List<String> pattern, {int weight = 10}) {
    final cells = <Cell>[];
    for (var r = 0; r < pattern.length; r++) {
      for (var c = 0; c < pattern[r].length; c++) {
        if (pattern[r][c] == '#') cells.add(Cell(r, c));
      }
    }
    if (cells.isEmpty) {
      throw ArgumentError('Shape $id has no cells');
    }
    final minR = cells.map((e) => e.r).reduce((a, b) => a < b ? a : b);
    final minC = cells.map((e) => e.c).reduce((a, b) => a < b ? a : b);
    final norm = [for (final c in cells) Cell(c.r - minR, c.c - minC)];
    final rows = norm.map((e) => e.r).reduce((a, b) => a > b ? a : b) + 1;
    final cols = norm.map((e) => e.c).reduce((a, b) => a > b ? a : b) + 1;
    return PieceShape._(id, List.unmodifiable(norm), rows, cols, weight);
  }

  int get size => cells.length;

  @override
  String toString() => 'PieceShape($id)';
}

/// All shapes available in the game, keyed by id.
final List<PieceShape> kShapes = _buildShapes();

final Map<String, PieceShape> kShapeById = {for (final s in kShapes) s.id: s};

List<PieceShape> _buildShapes() {
  PieceShape s(String id, List<String> p, int w) => PieceShape.fromPattern(id, p, weight: w);
  return [
    // Single block.
    s('dot', ['#'], 6),

    // Straight lines (horizontal + vertical).
    s('h2', ['##'], 9),
    s('v2', ['#', '#'], 9),
    s('h3', ['###'], 9),
    s('v3', ['#', '#', '#'], 9),
    s('h4', ['####'], 7),
    s('v4', ['#', '#', '#', '#'], 7),
    s('h5', ['#####'], 5),
    s('v5', ['#', '#', '#', '#', '#'], 5),

    // Squares.
    s('sq2', ['##', '##'], 9),
    s('sq3', ['###', '###', '###'], 4),

    // Rectangles 2x3 and 3x2.
    s('rect23', ['###', '###'], 6),
    s('rect32', ['##', '##', '##'], 6),

    // Small 3-cell corners (4 rotations).
    s('corner_a', ['##', '#.'], 8),
    s('corner_b', ['##', '.#'], 8),
    s('corner_c', ['#.', '##'], 8),
    s('corner_d', ['.#', '##'], 8),

    // L tetrominoes (4 rotations) and J tetrominoes (4 rotations).
    s('l_0', ['#.', '#.', '##'], 5),
    s('l_90', ['###', '#..'], 5),
    s('l_180', ['##', '.#', '.#'], 5),
    s('l_270', ['..#', '###'], 5),
    s('j_0', ['.#', '.#', '##'], 5),
    s('j_90', ['#..', '###'], 5),
    s('j_180', ['##', '#.', '#.'], 5),
    s('j_270', ['###', '..#'], 5),

    // Big 3x3 L corners (4 rotations).
    s('bigl_a', ['#..', '#..', '###'], 4),
    s('bigl_b', ['###', '#..', '#..'], 4),
    s('bigl_c', ['###', '..#', '..#'], 4),
    s('bigl_d', ['..#', '..#', '###'], 4),

    // T shapes (4 rotations).
    s('t_down', ['###', '.#.'], 6),
    s('t_up', ['.#.', '###'], 6),
    s('t_right', ['#.', '##', '#.'], 6),
    s('t_left', ['.#', '##', '.#'], 6),

    // S and Z (both orientations).
    s('s_h', ['.##', '##.'], 5),
    s('s_v', ['#.', '##', '.#'], 5),
    s('z_h', ['##.', '.##'], 5),
    s('z_v', ['.#', '##', '#.'], 5),

    // Diagonals (2 and 3 cells, both directions).
    s('diag2_a', ['#.', '.#'], 3),
    s('diag2_b', ['.#', '#.'], 3),
    s('diag3_a', ['#..', '.#.', '..#'], 2),
    s('diag3_b', ['..#', '.#.', '#..'], 2),
  ];
}

import 'dart:math';

import 'board.dart';
import 'shapes.dart';

/// Number of block colors (red, orange, yellow, green, light blue, blue, purple).
const int kColorCount = 7;

/// A concrete piece sitting in the tray: a shape plus a color index.
class Piece {
  final PieceShape shape;
  final int color;
  const Piece(this.shape, this.color);

  Map<String, dynamic> toJson() => {'s': shape.id, 'c': color};

  static Piece? fromJson(Object? json) {
    if (json is! Map) return null;
    final shape = kShapeById[json['s']];
    final color = json['c'];
    if (shape == null || color is! int || color < 0 || color >= kColorCount) return null;
    return Piece(shape, color);
  }
}

/// Scoring rules.
class Scoring {
  /// Points for clearing [lines] lines in a single move, before the combo
  /// multiplier: 1 -> 10, 2 -> 30, 3 -> 60, 4 -> 100, 5 -> 150 ...
  static int lineBonus(int lines) => lines <= 0 ? 0 : 10 * lines * (lines + 1) ~/ 2;

  /// Praise label shown for big clears (null for small ones).
  static String? praiseFor(int lines, int combo) {
    if (lines >= 6) return 'Unbelievable!';
    if (lines == 5) return 'Amazing!';
    if (lines == 4) return 'Excellent!';
    if (lines == 3) return 'Great!';
    if (lines == 2) return 'Good!';
    if (lines == 1 && combo >= 6) return 'Great!';
    if (lines == 1 && combo >= 4) return 'Good!';
    return null;
  }
}

/// Everything the UI needs to animate the outcome of a drop.
class MoveResult {
  final Piece piece;
  final int row;
  final int col;
  final List<Cell> placedCells;
  final LineSet clearedLines;
  final List<ClearedCell> clearedCells;
  final int placementPoints;
  final int lineBonus;
  final int combo;
  final String? praise;
  final bool trayRefilled;
  final bool gameOver;
  final bool boardCleared;

  const MoveResult({
    required this.piece,
    required this.row,
    required this.col,
    required this.placedCells,
    required this.clearedLines,
    required this.clearedCells,
    required this.placementPoints,
    required this.lineBonus,
    required this.combo,
    required this.praise,
    required this.trayRefilled,
    required this.gameOver,
    required this.boardCleared,
  });

  int get totalPoints => placementPoints + lineBonus;
  int get linesCleared => clearedLines.count;
  bool get isCombo => combo >= 2 && linesCleared > 0;
}

/// Outcome of a revive: the lines that were emptied (for the animation).
class ReviveResult {
  final LineSet lines;
  final List<ClearedCell> clearedCells;
  final bool trayRefilled;

  const ReviveResult(this.lines, this.clearedCells, this.trayRefilled);
}

/// Pure game model: board, tray, score, combo and game-over detection.
class GameState {
  static const int traySize = 3;

  final Random _rng;
  Board board;
  final List<Piece?> tray;
  int score;

  /// Number of consecutive moves (including the last one) that cleared at
  /// least one line. 0 when the last move cleared nothing.
  int combo;
  int moves;
  bool gameOver;

  /// Hints and revives used in this game (allowances depend on the tier).
  int hintsUsed;
  int revivesUsed;

  GameState({Random? random})
    : _rng = random ?? Random(),
      board = Board(),
      tray = List<Piece?>.filled(traySize, null),
      score = 0,
      combo = 0,
      moves = 0,
      hintsUsed = 0,
      revivesUsed = 0,
      gameOver = false {
    refillTray();
    gameOver = !anyTrayPieceFits();
  }

  GameState._restored({
    required Random random,
    required this.board,
    required List<Piece?> tray,
    required this.score,
    required this.combo,
    required this.moves,
    this.hintsUsed = 0,
    this.revivesUsed = 0,
  }) : _rng = random,
       tray = List<Piece?>.of(tray),
       gameOver = false {
    if (this.tray.every((p) => p == null)) refillTray();
    gameOver = !anyTrayPieceFits();
  }

  /// Test / restore helper: build a state from explicit parts.
  factory GameState.custom({
    required Board board,
    required List<Piece?> tray,
    int score = 0,
    int combo = 0,
    int moves = 0,
    int hintsUsed = 0,
    int revivesUsed = 0,
    Random? random,
  }) {
    assert(tray.length == traySize);
    return GameState._restored(
      random: random ?? Random(),
      board: board,
      tray: tray,
      score: score,
      combo: combo,
      moves: moves,
      hintsUsed: hintsUsed,
      revivesUsed: revivesUsed,
    );
  }

  bool get trayEmpty => tray.every((p) => p == null);

  bool anyTrayPieceFits() {
    for (final p in tray) {
      if (p != null && board.canFitAnywhere(p.shape)) return true;
    }
    return false;
  }

  bool pieceFits(int slot) {
    final p = tray[slot];
    return p != null && board.canFitAnywhere(p.shape);
  }

  bool canPlace(int slot, int row, int col) {
    final p = tray[slot];
    return p != null && !gameOver && board.canPlace(p.shape, row, col);
  }

  /// Drops the piece from [slot] with its top-left cell at ([row], [col]).
  /// Returns null when the move is not allowed (state is unchanged).
  MoveResult? place(int slot, int row, int col) {
    if (slot < 0 || slot >= traySize) return null;
    final piece = tray[slot];
    if (piece == null || gameOver) return null;
    if (!board.canPlace(piece.shape, row, col)) return null;

    board.place(piece.shape, piece.color, row, col);
    tray[slot] = null;
    moves++;

    final placed = [for (final c in piece.shape.cells) Cell(row + c.r, col + c.c)];
    final placementPoints = piece.shape.size;

    final lines = board.fullLines();
    final cleared = board.clearLines(lines);
    var bonus = 0;
    if (lines.isNotEmpty) {
      combo++;
      bonus = Scoring.lineBonus(lines.count) * combo;
    } else {
      combo = 0;
    }
    score += placementPoints + bonus;

    var refilled = false;
    if (trayEmpty) {
      refillTray();
      refilled = true;
    }
    gameOver = !anyTrayPieceFits();

    return MoveResult(
      piece: piece,
      row: row,
      col: col,
      placedCells: placed,
      clearedLines: lines,
      clearedCells: cleared,
      placementPoints: placementPoints,
      lineBonus: bonus,
      combo: combo,
      praise: lines.isNotEmpty ? Scoring.praiseFor(lines.count, combo) : null,
      trayRefilled: refilled,
      gameOver: gameOver,
      boardCleared: lines.isNotEmpty && board.isCompletelyEmpty,
    );
  }

  // ---------------------------------------------------------------------------
  // Revive
  // ---------------------------------------------------------------------------

  /// Second chance after the game ended: empties the two fullest rows and
  /// the two fullest columns (no points, combo resets) and makes sure at
  /// least one tray piece fits again. Returns null when the game isn't over.
  ReviveResult? revive() {
    if (!gameOver) return null;
    int filledRow(int r) => [for (var c = 0; c < Board.size; c++) board.isEmptyAt(r, c) ? 0 : 1].fold(0, (a, b) => a + b);
    int filledCol(int c) => [for (var r = 0; r < Board.size; r++) board.isEmptyAt(r, c) ? 0 : 1].fold(0, (a, b) => a + b);
    // Fullest first; ties go to lines nearer the middle (more useful space).
    int byFill(int a, int b, int Function(int) fill) {
      final d = fill(b).compareTo(fill(a));
      if (d != 0) return d;
      return (2 * a - 7).abs().compareTo((2 * b - 7).abs());
    }

    final rows = List<int>.generate(Board.size, (i) => i)..sort((a, b) => byFill(a, b, filledRow));
    final cols = List<int>.generate(Board.size, (i) => i)..sort((a, b) => byFill(a, b, filledCol));
    final lines = LineSet(rows.take(2).toList()..sort(), cols.take(2).toList()..sort());
    final cleared = board.clearLines(lines);
    combo = 0;
    revivesUsed++;
    var refilled = false;
    if (!anyTrayPieceFits()) {
      refillTray();
      refilled = true;
    }
    if (!anyTrayPieceFits()) {
      // Practically impossible after emptying four lines, but never leave
      // the player stuck: a single block always fits.
      tray[0] = Piece(kShapeById['dot']!, _rng.nextInt(kColorCount));
      refilled = true;
    }
    gameOver = false;
    return ReviveResult(lines, cleared, refilled);
  }

  // ---------------------------------------------------------------------------
  // Piece generation
  // ---------------------------------------------------------------------------

  PieceShape _randomShape() {
    final total = kShapes.fold<int>(0, (sum, s) => sum + s.weight);
    var roll = _rng.nextInt(total);
    for (final s in kShapes) {
      roll -= s.weight;
      if (roll < 0) return s;
    }
    return kShapes.last;
  }

  List<Piece> _randomSet() {
    final colors = List<int>.generate(kColorCount, (i) => i)..shuffle(_rng);
    return [for (var i = 0; i < traySize; i++) Piece(_randomShape(), colors[i])];
  }

  /// Fills the tray with three new pieces. Like the original game the
  /// generator is "fair": it prefers a set that can be fully placed on the
  /// current board, and otherwise a set where at least one piece fits.
  void refillTray() {
    List<Piece>? fallback;
    for (var attempt = 0; attempt < 12; attempt++) {
      final set = _randomSet();
      if (_setFullyPlaceable(board, set)) {
        _setTray(set);
        return;
      }
      if (fallback == null && set.any((p) => board.canFitAnywhere(p.shape))) {
        fallback = set;
      }
    }
    _setTray(fallback ?? _randomSet());
  }

  void _setTray(List<Piece> set) {
    for (var i = 0; i < traySize; i++) {
      tray[i] = set[i];
    }
  }

  static bool _setFullyPlaceable(Board board, List<Piece> pieces) => canPlaceAll(board, pieces);

  /// Depth-first search: can all [pieces] be placed in some order (clearing
  /// lines in between)? Bounded by [budget] placement checks so it never
  /// stalls the UI thread (an exhausted search counts as "yes").
  static bool canPlaceAll(Board board, List<Piece> pieces, {int budget = 6000}) {
    bool solve(Board b, List<Piece> remaining) {
      if (remaining.isEmpty) return true;
      for (var i = 0; i < remaining.length; i++) {
        final p = remaining[i];
        final rest = [...remaining]..removeAt(i);
        for (var r = 0; r <= Board.size - p.shape.rows; r++) {
          for (var c = 0; c <= Board.size - p.shape.cols; c++) {
            if (--budget < 0) return true; // give up searching: assume OK
            if (!b.canPlace(p.shape, r, c)) continue;
            final next = b.copy()..place(p.shape, p.color, r, c);
            next.clearLines(next.fullLines());
            if (solve(next, rest)) return true;
          }
        }
      }
      return false;
    }

    return solve(board, pieces);
  }

  // ---------------------------------------------------------------------------
  // Persistence
  // ---------------------------------------------------------------------------

  Map<String, dynamic> toJson() => {
    'v': 1,
    'board': board.cells,
    'tray': [for (final p in tray) p?.toJson()],
    'score': score,
    'combo': combo,
    'moves': moves,
    'hints': hintsUsed,
    'revives': revivesUsed,
  };

  /// Restores a saved game. Returns null for missing/corrupt/finished data.
  static GameState? fromJson(Object? json, {Random? random}) {
    try {
      if (json is! Map) return null;
      final cells = (json['board'] as List).cast<int>();
      if (cells.length != Board.size * Board.size) return null;
      if (cells.any((v) => v < Board.empty || v >= kColorCount)) return null;
      final trayJson = json['tray'] as List;
      if (trayJson.length != traySize) return null;
      final tray = [for (final t in trayJson) Piece.fromJson(t)];
      final state = GameState._restored(
        random: random ?? Random(),
        board: Board.fromCells(cells),
        tray: tray,
        score: (json['score'] as num).toInt(),
        combo: (json['combo'] as num?)?.toInt() ?? 0,
        moves: (json['moves'] as num?)?.toInt() ?? 0,
        // Added in 1.1; saves from 1.0 have neither.
        hintsUsed: (json['hints'] as num?)?.toInt() ?? 0,
        revivesUsed: (json['revives'] as num?)?.toInt() ?? 0,
      );
      if (state.gameOver) return null;
      return state;
    } catch (_) {
      return null;
    }
  }
}

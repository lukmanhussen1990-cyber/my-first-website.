import 'dart:math' as math;

import 'package:flutter/animation.dart';
import 'package:flutter/foundation.dart';

import '../logic/board.dart';
import '../logic/game.dart';
import '../logic/hint.dart';
import '../logic/shapes.dart';
import '../premium/premium_service.dart';
import '../services/ads_service.dart';
import '../services/haptics.dart';
import '../services/settings_store.dart';
import '../services/sound.dart';
import '../ui/palette.dart';
import 'debug_scenarios.dart';
import 'layout.dart';

/// Floating text kinds drawn by the painter.
enum FloatKind { plus, combo, praise, scorePlus }

class FloatingText {
  final String text;
  final FloatKind kind;
  final Offset origin;
  final double duration;
  final int color;
  double t = 0;
  final double delay;

  FloatingText(this.text, this.kind, this.origin, {this.duration = 1.0, this.color = 0, this.delay = 0});

  bool get done => t >= duration + delay;
}

class Particle {
  Offset pos;
  Offset vel;
  final double size;
  double rot;
  final double spin;
  final double life;
  final Color color;
  final bool sparkle;
  double age = 0;

  Particle({
    required this.pos,
    required this.vel,
    required this.size,
    required this.rot,
    required this.spin,
    required this.life,
    required this.color,
    this.sparkle = false,
  });
}

/// A board cell that is being blasted away.
class ClearingCell {
  final int r;
  final int c;
  final int color;
  final double delay;
  double t = 0;
  bool burst = false;

  ClearingCell(this.r, this.c, this.color, this.delay);

  static const double flash = 0.08;
  static const double duration = 0.26;
  bool get done => t >= delay + duration;
}

/// Glowing outline + fading tint left where a full row/column was cleared
/// (like the original game's line blast).
class ClearBeam {
  final bool isRow;
  final int index;
  final int color;
  double t = 0;

  ClearBeam(this.isRow, this.index, this.color);

  static const double duration = 0.7;
  bool get done => t >= duration;
}

class DragState {
  final int slot;
  final Piece piece;
  final Offset startPointer;
  final Offset startCenter;
  Offset pointer;
  double lift = 0;

  /// True once the finger travelled far enough to count as a drag; a plain
  /// tap on a tray piece never drops it on the board.
  bool moved = false;
  int? hoverRow;
  int? hoverCol;
  LineSet hoverLines = LineSet.empty;

  DragState(this.slot, this.piece, this.startPointer, this.startCenter) : pointer = startPointer;
}

class ReturnAnim {
  final int slot;
  final Piece piece;
  final Offset fromCenter;
  final double fromCell;
  double t = 0;
  static const double duration = 0.2;

  ReturnAnim(this.slot, this.piece, this.fromCenter, this.fromCell);
}

/// Game-over sequence: short pause, optional revive offer, gray sweep, popup.
enum OverPhase { none, waiting, reviveOffer, graying, popup }

enum HintOutcome { shown, noneLeft, noMove }

/// Owns the game model plus every animation on the game screen.
class GameController extends ChangeNotifier {
  GameController({GameState? restored}) {
    final store = SettingsStore.instance;
    final scenario = DebugScenarios.requested;
    final debugGame = scenario != null ? DebugScenarios.build(scenario) : null;
    if (restored != null) {
      game = restored;
    } else if (debugGame != null) {
      game = debugGame;
    } else {
      final saved = store.loadSavedGame();
      game = (saved != null ? GameState.fromJson(saved) : null) ?? GameState();
    }
    displayScore = game.score.toDouble();
    bestAtStart = store.bestScore;
    _spawnTray();
  }

  late GameState game;
  GameLayout? layout;

  final math.Random _rng = math.Random();

  double displayScore = 0;
  int bestAtStart = 0;
  bool newBest = false;
  double newBestT = 0;

  /// 1 -> 0 bounce of the crown/best score when it is updated live.
  double bestBump = 0;

  /// 1 -> 0 bump of the big score number when points land.
  double scoreBump = 0;

  DragState? drag;
  ReturnAnim? returning;
  final List<double> traySpawn = [1, 1, 1];
  final List<ClearingCell> clearing = [];
  final List<ClearBeam> beams = [];
  final List<Particle> particles = [];
  final List<FloatingText> texts = [];
  final Map<int, double> placedPop = {};

  OverPhase overPhase = OverPhase.none;
  double overT = 0;
  double comboFlash = 0;
  int lastComboColor = 0;

  /// 1 -> 0 board shake after big clears.
  double shake = 0;

  /// Suggested move currently highlighted, and its animation clock.
  Hint? hint;
  double hintT = 0;
  static const double hintPulseSeconds = 5;

  /// Called by the screen when the game-over popup should appear.
  VoidCallback? onShowGameOver;

  /// Called when the player is stuck and may revive.
  VoidCallback? onShowRevive;

  bool get isGameOver => game.gameOver;

  /// True while any animation, effect or drag needs per-frame updates.
  bool get isAnimating =>
      drag != null ||
      returning != null ||
      traySpawn.any((t) => t < 1) ||
      placedPop.isNotEmpty ||
      clearing.isNotEmpty ||
      beams.isNotEmpty ||
      particles.isNotEmpty ||
      texts.isNotEmpty ||
      comboFlash > 0 ||
      shake > 0 ||
      (hint != null && hintT < hintPulseSeconds) ||
      bestBump > 0 ||
      scoreBump > 0 ||
      (newBest && newBestT < 1) ||
      displayScore != game.score ||
      overPhase == OverPhase.waiting ||
      overPhase == OverPhase.graying;

  int get bestScore => math.max(SettingsStore.instance.bestScore, game.score);

  int get hintsLeft => math.max(0, PremiumService.instance.hintsPerGame - game.hintsUsed);

  int get revivesLeft => math.max(0, PremiumService.instance.revivesPerGame - game.revivesUsed);

  /// Premium players revive instantly; free players by watching an ad, so
  /// they are only offered a revive when an ad is ready.
  bool get canOfferRevive =>
      revivesLeft > 0 && (!PremiumService.instance.revivesNeedAd || AdsService.instance.rewardedReady);

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  void newGame() {
    SettingsStore.instance.clearSavedGame();
    game = GameState();
    displayScore = 0;
    bestAtStart = SettingsStore.instance.bestScore;
    newBest = false;
    newBestT = 0;
    drag = null;
    returning = null;
    clearing.clear();
    beams.clear();
    particles.clear();
    texts.clear();
    placedPop.clear();
    overPhase = OverPhase.none;
    overT = 0;
    hint = null;
    shake = 0;
    _spawnTray();
    _save();
    notifyListeners();
  }

  void _spawnTray() {
    for (var i = 0; i < 3; i++) {
      traySpawn[i] = -0.12 * i; // quick, slightly staggered pop-in
    }
  }

  void _save() {
    if (game.gameOver) {
      SettingsStore.instance.clearSavedGame();
    } else {
      SettingsStore.instance.saveGame(game.toJson());
    }
  }

  void saveNow() => _save();

  /// Repaint after outside state changed (Premium status, skins).
  void refresh() => notifyListeners();

  // ---------------------------------------------------------------------------
  // Input
  // ---------------------------------------------------------------------------

  bool get inputLocked => overPhase != OverPhase.none || game.gameOver;

  /// Geometry of the piece in [slot] while it rests in the tray.
  Offset trayCenter(int slot) => layout!.slotCenters[slot];

  void pointerDown(Offset p) {
    final l = layout;
    if (l == null || inputLocked || drag != null) return;
    final slot = l.slotAt(p);
    if (slot == null) return;
    final piece = game.tray[slot];
    if (piece == null || traySpawn[slot] < 0.6) return;
    if (returning?.slot == slot) returning = null;
    drag = DragState(slot, piece, p, trayCenter(slot));
    Sound.instance.play(Sfx.pickup, volume: 0.7);
    _updateHover();
    notifyListeners();
  }

  void pointerMove(Offset p) {
    final d = drag;
    if (d == null) return;
    d.pointer = p;
    if (!d.moved && (p - d.startPointer).distance > (layout?.cell ?? 40) * 0.25) {
      d.moved = true;
    }
    _updateHover();
    notifyListeners();
  }

  void pointerUp() {
    final d = drag;
    if (d == null) return;
    drag = null;
    final row = d.hoverRow;
    final col = d.hoverCol;
    if (row != null && col != null && game.canPlace(d.slot, row, col)) {
      _commitMove(d, row, col);
    } else {
      final geo = dragGeometry(d);
      returning = ReturnAnim(d.slot, d.piece, geo.center, geo.cell);
      if (d.lift > 0.5) Sound.instance.play(Sfx.invalid, volume: 0.45);
    }
    notifyListeners();
  }

  void pointerCancel() {
    final d = drag;
    if (d == null) return;
    drag = null;
    final geo = dragGeometry(d);
    returning = ReturnAnim(d.slot, d.piece, geo.center, geo.cell);
    notifyListeners();
  }

  /// Center and cell size of the dragged piece right now.
  ({Offset center, double cell}) dragGeometry(DragState d, {bool full = false}) {
    final l = layout!;
    final lift = full ? 1.0 : Curves.easeOut.transform(d.lift.clamp(0.0, 1.0));
    final cell = l.trayCell + (l.cell - l.trayCell) * lift;
    final shape = d.piece.shape;
    final liftOffset = Offset(0, -(shape.rows * l.cell / 2 + l.cell * 1.15));
    final initial = d.startCenter - d.startPointer;
    final offset = Offset.lerp(initial, liftOffset, lift)!;
    return (center: d.pointer + offset, cell: cell);
  }

  void _updateHover() {
    final d = drag!;
    final l = layout!;
    if (!d.moved) {
      d.hoverRow = null;
      d.hoverCol = null;
      d.hoverLines = LineSet.empty;
      return;
    }
    final geo = dragGeometry(d, full: true);
    final shape = d.piece.shape;
    final left = geo.center.dx - shape.cols * l.cell / 2;
    final top = geo.center.dy - shape.rows * l.cell / 2;
    final col = ((left - l.gridRect.left) / l.cell).round();
    final row = ((top - l.gridRect.top) / l.cell).round();
    int? hr;
    int? hc;
    if (game.board.canPlace(shape, row, col)) {
      hr = row;
      hc = col;
    } else {
      // Small tolerance: try the neighbouring snap cell the piece is closest to.
      final fx = (left - l.gridRect.left) / l.cell;
      final fy = (top - l.gridRect.top) / l.cell;
      final candidates = <List<int>>[
        [row, fx > col ? col + 1 : col - 1],
        [fy > row ? row + 1 : row - 1, col],
      ];
      for (final cnd in candidates) {
        final dist = math.max((cnd[0] - fy).abs(), (cnd[1] - fx).abs());
        if (dist < 0.75 && game.board.canPlace(shape, cnd[0], cnd[1])) {
          hr = cnd[0];
          hc = cnd[1];
          break;
        }
      }
    }
    if (hr != d.hoverRow || hc != d.hoverCol) {
      d.hoverRow = hr;
      d.hoverCol = hc;
      d.hoverLines = (hr != null && hc != null) ? game.board.linesCompletedBy(shape, hr, hc) : LineSet.empty;
    }
  }

  // ---------------------------------------------------------------------------
  // Moves
  // ---------------------------------------------------------------------------

  void _commitMove(DragState d, int row, int col) {
    final l = layout!;
    final result = game.place(d.slot, row, col);
    if (result == null) return;
    hint = null;

    Sound.instance.play(Sfx.drop, volume: 0.9);
    for (final c in result.placedCells) {
      placedPop[c.r * Board.size + c.c] = 0;
    }
    _dust(result.placedCells, result.piece.color);
    if (result.linesCleared == 0) Haptics.tick();

    // Center of the placed piece (for floating text).
    var cx = 0.0, cy = 0.0;
    for (final c in result.placedCells) {
      final rect = l.cellRect(c.r, c.c);
      cx += rect.center.dx;
      cy += rect.center.dy;
    }
    final dropCenter = Offset(cx / result.placedCells.length, cy / result.placedCells.length);

    if (result.linesCleared > 0) {
      lastComboColor = result.piece.color;
      // Blast cells in a wave spreading from the drop point.
      for (final cc in result.clearedCells) {
        final rect = l.cellRect(cc.r, cc.c);
        final dist = (rect.center - dropCenter).distance / l.cell;
        clearing.add(ClearingCell(cc.r, cc.c, result.piece.color, dist * 0.012));
      }
      for (final r in result.clearedLines.rows) {
        beams.add(ClearBeam(true, r, result.piece.color));
      }
      for (final c in result.clearedLines.cols) {
        beams.add(ClearBeam(false, c, result.piece.color));
      }
      final linesCenter = _linesCenter(result.clearedLines, dropCenter);
      final bonusText = '+${result.lineBonus}';
      texts.add(
        FloatingText(
          bonusText,
          FloatKind.plus,
          linesCenter + Offset(0, -l.cell * 0.9),
          duration: 1.0,
          color: result.piece.color,
          // Like the original, the bonus pops in just after the blast/combo.
          delay: result.isCombo ? 0.22 : 0.08,
        ),
      );
      if (result.isCombo) {
        texts.add(
          FloatingText(
            'Combo ${result.combo}',
            FloatKind.combo,
            linesCenter + Offset(0, l.cell * 0.15),
            duration: 1.25,
            color: result.piece.color,
          ),
        );
        comboFlash = 1;
        Sound.instance.play(Sfx.combo, rate: math.min(1.0 + 0.06 * (result.combo - 2), 1.5));
      } else {
        Sound.instance.play(Sfx.clear, rate: math.min(1.0 + 0.05 * (result.linesCleared - 1), 1.3));
      }
      if (result.praise != null) {
        final y = l.gridRect.top + l.gridRect.height * (linesCenter.dy < l.gridRect.center.dy ? 0.68 : 0.3);
        texts.add(
          FloatingText(
            result.praise!,
            FloatKind.praise,
            Offset(l.gridRect.center.dx, y),
            duration: 1.3,
            delay: 0.12,
            color: result.linesCleared,
          ),
        );
      }
      if (result.linesCleared >= 3 || result.combo >= 3) {
        Haptics.medium();
      } else {
        Haptics.light();
      }
      if (result.linesCleared >= 3 || result.combo >= 4) shake = 1;
    }

    scoreBump = result.linesCleared > 0 ? 1.0 : 0.6;

    // "+N" beside the score for moves that cleared lines.
    if (result.linesCleared > 0) {
      texts.add(
        FloatingText(
          '+${result.totalPoints}',
          FloatKind.scorePlus,
          l.scoreCenter + Offset(l.u * 13, -l.u * 4),
          duration: 1.0,
        ),
      );
    }

    // Live best score (crown) and new-record celebration.
    if (SettingsStore.instance.submitScore(game.score)) {
      bestBump = 1;
      if (!newBest && bestAtStart > 0) {
        newBest = true;
        newBestT = 0;
        Sound.instance.play(Sfx.newBest, volume: 0.8);
      }
    }

    if (result.trayRefilled) _spawnTray();

    if (result.gameOver) {
      overPhase = OverPhase.waiting;
      overT = 0;
    }
    debugPrint(
      'BB_MOVE n=${game.moves} piece=${result.piece.shape.id} at=$row,$col '
      'score=${game.score} lines=${result.linesCleared} combo=${result.combo} over=${result.gameOver}',
    );
    _save();
  }

  // ---------------------------------------------------------------------------
  // Hints & revives
  // ---------------------------------------------------------------------------

  /// Highlights a good move. Uses one of this game's hints.
  HintOutcome requestHint() {
    if (inputLocked) return HintOutcome.noMove;
    if (hint != null) {
      hintT = 0; // already showing: pulse it again for free
      notifyListeners();
      return HintOutcome.shown;
    }
    if (hintsLeft <= 0) return HintOutcome.noneLeft;
    final h = HintSolver.find(game);
    if (h == null) return HintOutcome.noMove;
    game.hintsUsed++;
    hint = h;
    hintT = 0;
    Sound.instance.play(Sfx.pickup, volume: 0.6);
    debugPrint('BB_HINT slot=${h.slot} at=${h.row},${h.col} left=$hintsLeft');
    _save();
    notifyListeners();
    return HintOutcome.shown;
  }

  /// Cells of the hinted placement (board indices).
  Set<int> hintCells() {
    final h = hint;
    if (h == null) return const {};
    final piece = game.tray[h.slot];
    if (piece == null) return const {};
    return {for (final Cell c in piece.shape.cells) (h.row + c.r) * Board.size + h.col + c.c};
  }

  /// Second chance: empties the fullest lines and continues the game.
  void revive() {
    if (overPhase != OverPhase.reviveOffer) return;
    final l = layout;
    final result = game.revive();
    if (result == null) return;
    overPhase = OverPhase.none;
    overT = 0;
    hint = null;
    final center = l?.gridRect.center ?? Offset.zero;
    if (l != null) {
      for (final cc in result.clearedCells) {
        final dist = (l.cellRect(cc.r, cc.c).center - center).distance / l.cell;
        clearing.add(ClearingCell(cc.r, cc.c, cc.color, dist * 0.02));
      }
      final color = _rng.nextInt(kColorCount);
      for (final r in result.lines.rows) {
        beams.add(ClearBeam(true, r, color));
      }
      for (final c in result.lines.cols) {
        beams.add(ClearBeam(false, c, color));
      }
      texts.add(FloatingText('Revived!', FloatKind.praise, center, duration: 1.3, delay: 0.1, color: 5));
    }
    if (result.trayRefilled) _spawnTray();
    comboFlash = 1;
    lastComboColor = 3;
    shake = 0.6;
    Sound.instance.play(Sfx.combo, rate: 1.1);
    Haptics.medium();
    debugPrint('BB_REVIVE used=${game.revivesUsed} left=$revivesLeft');
    _save();
    notifyListeners();
  }

  /// The player passed on the revive: finish the game-over sequence.
  void declineRevive() {
    if (overPhase != OverPhase.reviveOffer) return;
    _startGraying();
    notifyListeners();
  }

  void _startGraying() {
    overPhase = OverPhase.graying;
    overT = 0;
    Sound.instance.play(Sfx.gameOver);
    Haptics.heavy();
  }

  /// A few specks of dust around a freshly placed piece.
  void _dust(List<Cell> cells, int color) {
    final l = layout;
    if (l == null) return;
    final glow = Palette.blocks[color].glow;
    final occupied = {for (final c in cells) c.r * Board.size + c.c};
    var n = 0;
    for (final c in cells) {
      if (n >= 10) break;
      // Only cells on the piece's lower edge.
      if (occupied.contains((c.r + 1) * Board.size + c.c)) continue;
      final rect = l.cellRect(c.r, c.c);
      for (final side in const [-1.0, 1.0]) {
        particles.add(
          Particle(
            pos: Offset(rect.center.dx + side * rect.width * 0.3, rect.bottom - rect.height * 0.05),
            vel: Offset(side * l.cell * (0.6 + _rng.nextDouble() * 0.8), -l.cell * (0.4 + _rng.nextDouble() * 0.6)),
            size: l.cell * (0.06 + _rng.nextDouble() * 0.05),
            rot: _rng.nextDouble() * math.pi,
            spin: (_rng.nextDouble() - 0.5) * 6,
            life: 0.28 + _rng.nextDouble() * 0.12,
            color: glow.withValues(alpha: 0.85),
          ),
        );
        n++;
      }
    }
  }

  Offset _linesCenter(LineSet lines, Offset fallback) {
    final l = layout!;
    if (lines.isEmpty) return fallback;
    double x = 0, y = 0;
    var n = 0;
    for (final r in lines.rows) {
      x += fallback.dx;
      y += l.cellRect(r, 0).center.dy;
      n++;
    }
    for (final c in lines.cols) {
      x += l.cellRect(0, c).center.dx;
      y += fallback.dy;
      n++;
    }
    final p = Offset(x / n, y / n);
    // Keep text inside the board.
    return Offset(
      p.dx.clamp(l.gridRect.left + l.cell * 2, l.gridRect.right - l.cell * 2),
      p.dy.clamp(l.gridRect.top + l.cell * 1.2, l.gridRect.bottom - l.cell * 1.2),
    );
  }

  void _burst(ClearingCell c) {
    final l = layout!;
    final rect = l.cellRect(c.r, c.c);
    final base = Palette.blocks[c.color];
    for (var i = 0; i < 6; i++) {
      final a = _rng.nextDouble() * math.pi * 2;
      final speed = l.cell * (0.8 + _rng.nextDouble() * (i < 2 ? 5.5 : 2.4));
      particles.add(
        Particle(
          pos: rect.center + Offset((_rng.nextDouble() - 0.5) * l.cell * 0.8, (_rng.nextDouble() - 0.5) * l.cell * 0.8),
          vel: Offset(math.cos(a) * speed, math.sin(a) * speed - l.cell * 1.6),
          size: l.cell * (0.09 + _rng.nextDouble() * 0.15),
          rot: _rng.nextDouble() * math.pi,
          spin: (_rng.nextDouble() - 0.5) * 10,
          life: 0.45 + _rng.nextDouble() * 0.5,
          color: i.isEven ? base.top : base.face,
        ),
      );
    }
    if (_rng.nextDouble() < 0.5) {
      final a = _rng.nextDouble() * math.pi * 2;
      final speed = l.cell * (0.6 + _rng.nextDouble() * 2.0);
      particles.add(
        Particle(
          pos: rect.center,
          vel: Offset(math.cos(a) * speed, math.sin(a) * speed - l.cell * 1.2),
          size: l.cell * (0.16 + _rng.nextDouble() * 0.14),
          rot: 0,
          spin: (_rng.nextDouble() - 0.5) * 4,
          life: 0.45 + _rng.nextDouble() * 0.4,
          color: const Color(0xFFFFFFFF),
          sparkle: true,
        ),
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Frame update
  // ---------------------------------------------------------------------------

  /// Advances all animations by [dt] seconds. Returns true if anything moved.
  bool tick(double dt) {
    if (layout == null) return false;
    var dirty = false;
    final l = layout!;

    final d = drag;
    if (d != null && d.lift < 1) {
      d.lift = math.min(1, d.lift + dt / 0.085);
      dirty = true;
    }
    // Keep the "lines will clear" highlight pulsing while hovering.
    if (d != null && d.hoverRow != null && d.hoverLines.isNotEmpty) dirty = true;

    final r = returning;
    if (r != null) {
      r.t += dt;
      if (r.t >= ReturnAnim.duration) returning = null;
      dirty = true;
    }

    for (var i = 0; i < 3; i++) {
      if (traySpawn[i] < 1) {
        traySpawn[i] = math.min(1, traySpawn[i] + dt / 0.2);
        dirty = true;
      }
    }

    if (placedPop.isNotEmpty) {
      final keys = placedPop.keys.toList();
      for (final k in keys) {
        final v = placedPop[k]! + dt / 0.16;
        if (v >= 1) {
          placedPop.remove(k);
        } else {
          placedPop[k] = v;
        }
      }
      dirty = true;
    }

    if (clearing.isNotEmpty) {
      for (final c in clearing) {
        c.t += dt;
        if (!c.burst && c.t >= c.delay + ClearingCell.flash) {
          c.burst = true;
          _burst(c);
        }
      }
      clearing.removeWhere((c) => c.done);
      dirty = true;
    }

    if (beams.isNotEmpty) {
      for (final b in beams) {
        b.t += dt;
      }
      beams.removeWhere((b) => b.done);
      dirty = true;
    }

    if (particles.isNotEmpty) {
      final g = l.cell * 9;
      for (final p in particles) {
        p.age += dt;
        p.vel = Offset(p.vel.dx * (1 - dt * 0.8), p.vel.dy + g * dt);
        p.pos += p.vel * dt;
        p.rot += p.spin * dt;
      }
      particles.removeWhere((p) => p.age >= p.life);
      dirty = true;
    }

    if (texts.isNotEmpty) {
      for (final t in texts) {
        t.t += dt;
      }
      texts.removeWhere((t) => t.done);
      dirty = true;
    }

    if (bestBump > 0) {
      bestBump = math.max(0, bestBump - dt / 0.35);
      dirty = true;
    }
    if (scoreBump > 0) {
      scoreBump = math.max(0, scoreBump - dt / 0.3);
      dirty = true;
    }

    if (comboFlash > 0) {
      comboFlash = math.max(0, comboFlash - dt / 0.5);
      dirty = true;
    }

    if (shake > 0) {
      shake = math.max(0, shake - dt / 0.35);
      dirty = true;
    }

    if (hint != null && hintT < hintPulseSeconds) {
      hintT += dt;
      dirty = true;
    }

    if (newBest && newBestT < 1) {
      newBestT = math.min(1, newBestT + dt / 0.45);
      dirty = true;
    }

    final target = game.score.toDouble();
    if (displayScore < target) {
      final diff = target - displayScore;
      displayScore = math.min(target, displayScore + math.max(diff * dt * 7, dt * 25));
      dirty = true;
    } else if (displayScore > target) {
      displayScore = target;
      dirty = true;
    }

    switch (overPhase) {
      case OverPhase.none:
        break;
      case OverPhase.waiting:
        overT += dt;
        if (overT >= 0.55 && clearing.isEmpty) {
          if (canOfferRevive) {
            overPhase = OverPhase.reviveOffer;
            overT = 0;
            onShowRevive?.call();
          } else {
            _startGraying();
          }
        }
        dirty = true;
      case OverPhase.reviveOffer:
        break;
      case OverPhase.graying:
        overT += dt;
        if (overT >= 1.25) {
          overPhase = OverPhase.popup;
          overT = 0;
          onShowGameOver?.call();
        }
        dirty = true;
      case OverPhase.popup:
        break;
    }

    if (dirty) notifyListeners();
    return dirty;
  }

  /// 0..1 gray amount for board row [r] during the game-over sweep.
  double grayAmountForRow(int r) {
    if (overPhase == OverPhase.popup) return 1;
    if (overPhase != OverPhase.graying) return 0;
    final start = r * 0.08;
    return ((overT - start) / 0.18).clamp(0.0, 1.0);
  }

  /// Is cell (r, c) part of the hover preview lines?
  bool isHoverLineCell(int r, int c) {
    final d = drag;
    if (d == null || d.hoverRow == null) return false;
    return d.hoverLines.containsCell(r, c);
  }

  Set<int> hoverPieceCells() {
    final d = drag;
    if (d == null || d.hoverRow == null) return const {};
    return {for (final Cell c in d.piece.shape.cells) (d.hoverRow! + c.r) * Board.size + d.hoverCol! + c.c};
  }
}

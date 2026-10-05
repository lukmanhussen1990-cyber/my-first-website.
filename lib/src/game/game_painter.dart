import 'dart:math' as math;

import 'package:flutter/animation.dart';
import 'package:flutter/rendering.dart';

import '../logic/board.dart';
import '../logic/game.dart';
import '../ui/block_painter.dart';
import '../ui/fancy_text.dart';
import '../ui/icons.dart';
import '../ui/palette.dart';
import 'game_controller.dart';
import 'layout.dart';

/// Paints the whole game screen (except popups) in one pass.
class GamePainter extends CustomPainter {
  GamePainter(this.ctrl, this.dpr) : super(repaint: ctrl);

  final GameController ctrl;
  final double dpr;

  // Text caches.
  static final Expando<FancyText> _textCache = Expando();
  static TextPainter? _scoreTp;
  static String _scoreStr = '';
  static double _scoreSize = 0;
  static TextPainter? _bestTp;
  static String _bestStr = '';
  static double _bestSize = 0;

  double get _sprite => (ctrl.layout?.cell ?? 40) * dpr;

  @override
  void paint(Canvas canvas, Size size) {
    final l = ctrl.layout;
    if (l == null) return;
    _paintTopBar(canvas, l);
    _paintScore(canvas, l);
    _paintBoard(canvas, l);
    _paintTray(canvas, l);
    _paintReturning(canvas, l);
    _paintDragged(canvas, l);
    _paintParticles(canvas, l);
    _paintTexts(canvas, l);
  }

  // ---------------------------------------------------------------------------
  // Header
  // ---------------------------------------------------------------------------

  void _paintTopBar(Canvas canvas, GameLayout l) {
    final crownW = l.u * 9.6;
    final crownH = l.u * 6.6;
    final crownRect = Rect.fromLTWH(l.bestAnchor.dx, l.bestAnchor.dy - crownH / 2 - l.u * 0.3, crownW, crownH);
    paintCrown(canvas, crownRect);

    final bestStr = '${ctrl.bestScore}';
    if (_bestTp == null || bestStr != _bestStr || _bestSize != l.bestFont) {
      _bestStr = bestStr;
      _bestSize = l.bestFont;
      _bestTp = TextPainter(
        text: TextSpan(
          text: bestStr,
          style: numberStyle(l.bestFont, color: Palette.goldText, weight: FontWeight.w700),
        ),
        textDirection: TextDirection.ltr,
      )..layout();
    }
    final tp = _bestTp!;
    final bump = ctrl.bestBump > 0 ? math.sin(ctrl.bestBump * math.pi) * 0.18 : 0.0;
    if (bump > 0) {
      canvas.save();
      final pivot = Offset(crownRect.right + l.u * 1.2, l.bestAnchor.dy);
      canvas.translate(pivot.dx, pivot.dy);
      canvas.scale(1 + bump);
      canvas.translate(-pivot.dx, -pivot.dy);
    }
    tp.paint(canvas, Offset(crownRect.right + l.u * 1.2, l.bestAnchor.dy - tp.height / 2 + l.u * 0.2));
    if (bump > 0) canvas.restore();

    paintGear(canvas, l.gearRect);
  }

  void _paintScore(Canvas canvas, GameLayout l) {
    final c = l.scoreCenter;
    if (ctrl.newBest) {
      final t = ctrl.newBestT;
      final s = Curves.elasticOut.transform(t.clamp(0.0, 1.0));
      if (s > 0) {
        paintDiamond(canvas, c + Offset(0, -l.u * 1.0), l.u * 20 * s, l.u * 19 * s);
      }
    }
    final scoreStr = '${ctrl.displayScore.round()}';
    if (_scoreTp == null || scoreStr != _scoreStr || _scoreSize != l.scoreFont) {
      _scoreStr = scoreStr;
      _scoreSize = l.scoreFont;
      _scoreTp = TextPainter(
        text: TextSpan(
          text: scoreStr,
          style: numberStyle(l.scoreFont, weight: FontWeight.w700).copyWith(
            shadows: [Shadow(color: const Color(0x55101A40), offset: Offset(0, l.u * 0.5), blurRadius: l.u * 0.6)],
          ),
        ),
        textDirection: TextDirection.ltr,
      )..layout();
    }
    final tp = _scoreTp!;
    final bump = ctrl.scoreBump > 0 ? math.sin(ctrl.scoreBump * math.pi) * 0.07 * ctrl.scoreBump : 0.0;
    if (bump > 0) {
      canvas.save();
      canvas.translate(c.dx, c.dy);
      canvas.scale(1 + bump);
      canvas.translate(-c.dx, -c.dy);
    }
    tp.paint(canvas, Offset(c.dx - tp.width / 2, c.dy - tp.height / 2 + l.u * 0.6));
    if (bump > 0) canvas.restore();
  }

  // ---------------------------------------------------------------------------
  // Board
  // ---------------------------------------------------------------------------

  void _paintBoard(Canvas canvas, GameLayout l) {
    final br = l.boardRect;
    final radius = Radius.circular(l.u * 1.6);
    final rr = RRect.fromRectAndRadius(br, radius);

    // Drop shadow + frame.
    canvas.drawRRect(
      rr.shift(Offset(0, l.u * 0.9)),
      Paint()
        ..color = const Color(0x66141E48)
        ..maskFilter = MaskFilter.blur(BlurStyle.normal, l.u * 1.0),
    );
    canvas.drawRRect(rr, Paint()..color = Palette.boardFrame);
    canvas.drawRRect(
      RRect.fromRectAndRadius(br.deflate(l.u * 0.15), radius),
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = l.u * 0.3
        ..shader = LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: const [Color(0xFF2A3A6E), Color(0xFF34488A), Palette.boardFrameLight],
          stops: const [0, 0.85, 1],
        ).createShader(br),
    );
    // Glow around the board when a combo lands.
    if (ctrl.comboFlash > 0) {
      final glowColor = Palette.blocks[ctrl.lastComboColor].glow;
      canvas.drawRRect(
        rr.inflate(l.u * 0.4),
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = l.u * 1.4
          ..color = glowColor.withValues(alpha: 0.85 * ctrl.comboFlash)
          ..maskFilter = MaskFilter.blur(BlurStyle.normal, l.u * 1.6),
      );
    }
    final grid = l.gridRect;
    canvas.drawRRect(RRect.fromRectAndRadius(grid, Radius.circular(l.u * 0.8)), Paint()..color = Palette.boardInner);

    // Empty cells (subtle grid).
    final cellPaint = Paint()..color = Palette.boardCell;
    final inset = math.max(0.5, l.cell * 0.018);
    for (var r = 0; r < Board.size; r++) {
      for (var c = 0; c < Board.size; c++) {
        canvas.drawRect(l.cellRect(r, c).deflate(inset), cellPaint);
      }
    }

    final board = ctrl.game.board;
    final drag = ctrl.drag;
    final ghost = ctrl.hoverPieceCells();
    final lines = drag?.hoverLines ?? LineSet.empty;
    final lineColor = drag?.piece.color ?? 0;
    final linesActive = drag != null && drag.hoverRow != null && lines.isNotEmpty;

    // Glow behind lines that would clear.
    if (linesActive) {
      final glow = Palette.blocks[lineColor].glow;
      final glowPaint = Paint()
        ..color = glow.withValues(alpha: 0.85)
        ..maskFilter = MaskFilter.blur(BlurStyle.normal, l.cell * 0.28);
      for (final r in lines.rows) {
        canvas.drawRect(
          Rect.fromLTWH(grid.left, grid.top + r * l.cell, grid.width, l.cell).inflate(l.cell * 0.08),
          glowPaint,
        );
      }
      for (final c in lines.cols) {
        canvas.drawRect(
          Rect.fromLTWH(grid.left + c * l.cell, grid.top, l.cell, grid.height).inflate(l.cell * 0.08),
          glowPaint,
        );
      }
    }

    for (var r = 0; r < Board.size; r++) {
      final gray = ctrl.grayAmountForRow(r);
      for (var c = 0; c < Board.size; c++) {
        final idx = r * Board.size + c;
        var color = board.get(r, c);
        final inLine = linesActive && lines.containsCell(r, c);
        if (color == Board.empty) {
          if (ghost.contains(idx)) {
            if (inLine) {
              drawBlock(canvas, l.cellRect(r, c), lineColor, _sprite);
            } else {
              drawBlock(canvas, l.cellRect(r, c), lineColor, _sprite, opacity: 0.42);
            }
          }
          continue;
        }
        if (inLine) color = lineColor;
        var rect = l.cellRect(r, c);
        final pop = ctrl.placedPop[idx];
        if (pop != null) {
          final s = 1.0 + 0.10 * math.sin(pop * math.pi);
          rect = Rect.fromCenter(center: rect.center, width: rect.width * s, height: rect.height * s);
        }
        if (gray >= 1) {
          drawBlock(canvas, rect, Palette.gray, _sprite);
        } else {
          drawBlock(canvas, rect, color, _sprite);
          if (gray > 0) drawBlock(canvas, rect, Palette.gray, _sprite, opacity: gray);
        }
      }
    }

    // Pulsing light over the lines that would clear.
    if (linesActive) {
      final pulse = 0.10 + 0.08 * math.sin(DateTime.now().millisecondsSinceEpoch / 140.0);
      final light = Paint()..color = Color.fromRGBO(255, 255, 255, pulse);
      for (final r in lines.rows) {
        canvas.drawRect(Rect.fromLTWH(grid.left, grid.top + r * l.cell, grid.width, l.cell), light);
      }
      for (final c in lines.cols) {
        canvas.drawRect(Rect.fromLTWH(grid.left + c * l.cell, grid.top, l.cell, grid.height), light);
      }
    }

    // Cells being blasted.
    for (final cc in ctrl.clearing) {
      final lt = cc.t - cc.delay;
      final rect = l.cellRect(cc.r, cc.c);
      if (lt < 0) {
        drawBlock(canvas, rect, cc.color, _sprite);
        continue;
      }
      if (lt < 0.1) {
        final k = lt / 0.1;
        final s = 1 + 0.08 * k;
        final rr2 = Rect.fromCenter(center: rect.center, width: rect.width * s, height: rect.height * s);
        drawBlock(canvas, rr2, cc.color, _sprite);
        canvas.drawRect(rr2, Paint()..color = Color.fromRGBO(255, 255, 255, 0.75 * k));
      } else {
        final k = ((lt - 0.1) / (ClearingCell.duration - 0.1)).clamp(0.0, 1.0);
        final s = 1.08 * (1 - Curves.easeIn.transform(k)) + 0.05;
        final rr2 = Rect.fromCenter(center: rect.center, width: rect.width * s, height: rect.height * s);
        drawBlock(canvas, rr2, cc.color, _sprite, opacity: 1 - k * 0.6);
        canvas.drawRect(rr2, Paint()..color = Color.fromRGBO(255, 255, 255, 0.75 * (1 - k)));
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Tray & dragging
  // ---------------------------------------------------------------------------

  void _paintPiece(Canvas canvas, Piece piece, Offset center, double cell, {double opacity = 1, int? colorOverride}) {
    final shape = piece.shape;
    final w = shape.cols * cell;
    final h = shape.rows * cell;
    final left = center.dx - w / 2;
    final top = center.dy - h / 2;
    for (final c in shape.cells) {
      drawBlock(
        canvas,
        Rect.fromLTWH(left + c.c * cell, top + c.r * cell, cell, cell),
        colorOverride ?? piece.color,
        _sprite,
        opacity: opacity,
      );
    }
  }

  void _paintTray(Canvas canvas, GameLayout l) {
    final game = ctrl.game;
    final overGray = ctrl.overPhase == OverPhase.graying || ctrl.overPhase == OverPhase.popup;
    for (var i = 0; i < 3; i++) {
      final piece = game.tray[i];
      if (piece == null) continue;
      if (ctrl.drag?.slot == i || ctrl.returning?.slot == i) continue;
      final spawn = ctrl.traySpawn[i];
      if (spawn <= 0) continue;
      final s = Curves.easeOutBack.transform(spawn.clamp(0.0, 1.0));
      final fits = game.board.canFitAnywhere(piece.shape);
      _paintPiece(
        canvas,
        piece,
        l.slotCenters[i],
        l.trayCell * s,
        opacity: fits ? 1.0 : 0.38,
        colorOverride: overGray ? Palette.gray : null,
      );
    }
  }

  void _paintReturning(Canvas canvas, GameLayout l) {
    final r = ctrl.returning;
    if (r == null) return;
    final t = Curves.easeOutCubic.transform((r.t / ReturnAnim.duration).clamp(0.0, 1.0));
    final center = Offset.lerp(r.fromCenter, l.slotCenters[r.slot], t)!;
    final cell = r.fromCell + (l.trayCell - r.fromCell) * t;
    _paintPiece(canvas, r.piece, center, cell);
  }

  void _paintDragged(Canvas canvas, GameLayout l) {
    final d = ctrl.drag;
    if (d == null) return;
    final geo = ctrl.dragGeometry(d);
    // Soft shadow under the lifted piece.
    final shadow = Paint()
      ..color = const Color(0x40000000)
      ..maskFilter = MaskFilter.blur(BlurStyle.normal, geo.cell * 0.15);
    final shape = d.piece.shape;
    final left = geo.center.dx - shape.cols * geo.cell / 2;
    final top = geo.center.dy - shape.rows * geo.cell / 2;
    for (final c in shape.cells) {
      canvas.drawRect(
        Rect.fromLTWH(
          left + c.c * geo.cell,
          top + c.r * geo.cell,
          geo.cell,
          geo.cell,
        ).shift(Offset(0, geo.cell * 0.12)),
        shadow,
      );
    }
    _paintPiece(canvas, d.piece, geo.center, geo.cell);
  }

  // ---------------------------------------------------------------------------
  // Effects
  // ---------------------------------------------------------------------------

  void _paintParticles(Canvas canvas, GameLayout l) {
    if (ctrl.particles.isEmpty) return;
    final paint = Paint();
    for (final p in ctrl.particles) {
      final k = (p.age / p.life).clamp(0.0, 1.0);
      final alpha = (1 - k * k).clamp(0.0, 1.0);
      if (p.sparkle) {
        final s = p.size * (1 - k * 0.5);
        paint.color = Color.fromRGBO(255, 255, 255, alpha);
        final path = Path()
          ..moveTo(p.pos.dx, p.pos.dy - s)
          ..quadraticBezierTo(p.pos.dx, p.pos.dy, p.pos.dx + s, p.pos.dy)
          ..quadraticBezierTo(p.pos.dx, p.pos.dy, p.pos.dx, p.pos.dy + s)
          ..quadraticBezierTo(p.pos.dx, p.pos.dy, p.pos.dx - s, p.pos.dy)
          ..quadraticBezierTo(p.pos.dx, p.pos.dy, p.pos.dx, p.pos.dy - s)
          ..close();
        canvas.drawPath(path, paint);
        continue;
      }
      paint.color = p.color.withValues(alpha: alpha);
      canvas.save();
      canvas.translate(p.pos.dx, p.pos.dy);
      canvas.rotate(p.rot);
      final s = p.size * (1 - k * 0.4);
      canvas.drawRect(Rect.fromCenter(center: Offset.zero, width: s, height: s), paint);
      canvas.restore();
    }
  }

  FancyText _fancyFor(FloatingText t, GameLayout l) {
    final cached = _textCache[t];
    if (cached != null) return cached;
    late FancyText ft;
    switch (t.kind) {
      case FloatKind.plus:
        final glow = Palette.blocks[t.color].face;
        ft = FancyText(
          text: t.text,
          base: numberStyle(l.cell * 0.78, weight: FontWeight.w800),
          fill: const [Color(0xFFFFFFFF), Color(0xFFFFF4D6)],
          stroke: Color.lerp(glow, const Color(0xFF000000), 0.25)!,
          strokeWidth: l.cell * 0.12,
          shadow: const Color(0x66000000),
          shadowDy: l.cell * 0.05,
        );
      case FloatKind.combo:
        ft = FancyText(
          text: t.text,
          base: bubbleStyle(l.cell * 1.05),
          fill: const [Color(0xFFFFFFFF), Color(0xFFE6F7FF), Color(0xFF7CC8FF)],
          stops: const [0, 0.45, 1],
          stroke: const Color(0xFF1D58C9),
          strokeWidth: l.cell * 0.16,
          shadow: const Color(0xFF0E2A6B),
          shadowDy: l.cell * 0.09,
          skew: -0.18,
        );
      case FloatKind.praise:
        final style = _praiseColors(t.color);
        ft = FancyText(
          text: t.text,
          base: bubbleStyle(l.cell * 1.0),
          fill: style.$1,
          stroke: style.$2,
          strokeWidth: l.cell * 0.15,
          shadow: const Color(0xAA0A1640),
          shadowDy: l.cell * 0.08,
          skew: -0.15,
        );
      case FloatKind.scorePlus:
        ft = FancyText(
          text: t.text,
          base: numberStyle(l.u * 5.2, weight: FontWeight.w800),
          fill: const [Color(0xFFFFFFFF), Color(0xFFFFE9A8)],
          stroke: const Color(0xFF26407F),
          strokeWidth: l.u * 0.8,
        );
    }
    _textCache[t] = ft;
    return ft;
  }

  (List<Color>, Color) _praiseColors(int lines) {
    switch (lines) {
      case 1:
      case 2:
        return (const [Color(0xFFE4FF9A), Color(0xFF7BE33B), Color(0xFF34B51F)], const Color(0xFF1B5E12));
      case 3:
        return (const [Color(0xFFFFF7B0), Color(0xFFFFC93B), Color(0xFFFF8A00)], const Color(0xFF8A3B00));
      case 4:
        return (const [Color(0xFFFFE0FF), Color(0xFFF07BFF), Color(0xFFB13BFF)], const Color(0xFF4E137E));
      case 5:
        return (const [Color(0xFFD9FBFF), Color(0xFF63DAFF), Color(0xFF1E8CFF)], const Color(0xFF0B3C86));
      default:
        return (const [Color(0xFFFFF6C4), Color(0xFFFFB347), Color(0xFFFF4D4D)], const Color(0xFF7A0F0F));
    }
  }

  void _paintTexts(Canvas canvas, GameLayout l) {
    for (final t in ctrl.texts) {
      final lt = t.t - t.delay;
      if (lt < 0) continue;
      final k = (lt / t.duration).clamp(0.0, 1.0);
      final ft = _fancyFor(t, l);
      switch (t.kind) {
        case FloatKind.plus:
          final scale = lt < 0.15 ? Curves.easeOutBack.transform(lt / 0.15) : 1.0;
          final rise = l.cell * 0.9 * Curves.easeOut.transform(k);
          final opacity = k < 0.7 ? 1.0 : 1 - (k - 0.7) / 0.3;
          ft.paint(canvas, t.origin + Offset(0, -rise), scale: scale, opacity: opacity);
        case FloatKind.combo:
        case FloatKind.praise:
          double scale;
          if (lt < 0.28) {
            scale = 0.3 + 0.7 * Curves.elasticOut.transform(lt / 0.28);
          } else {
            scale = 1.0;
          }
          final fadeStart = 0.72;
          final opacity = k < fadeStart ? 1.0 : 1 - (k - fadeStart) / (1 - fadeStart);
          final rise = k < fadeStart ? 0.0 : l.cell * 0.6 * (k - fadeStart) / (1 - fadeStart);
          ft.paint(canvas, t.origin + Offset(0, -rise), scale: scale, opacity: opacity);
        case FloatKind.scorePlus:
          // Anchor to the right edge of the (animated) score number.
          final scoreW = _scoreTp?.width ?? 0;
          final anchor = l.scoreCenter + Offset(scoreW / 2 + l.u * 1.2 + ft.width / 2, -l.scoreFont * 0.32);
          final rise = l.u * 5 * Curves.easeOut.transform(k);
          final opacity = k < 0.6 ? 1.0 : 1 - (k - 0.6) / 0.4;
          ft.paint(canvas, anchor + Offset(0, -rise), opacity: opacity);
      }
    }
  }

  @override
  bool shouldRepaint(covariant GamePainter oldDelegate) => oldDelegate.ctrl != ctrl || oldDelegate.dpr != dpr;
}

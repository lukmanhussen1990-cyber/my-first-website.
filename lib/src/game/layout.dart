import 'dart:math' as math;

import 'package:flutter/painting.dart';

import '../logic/board.dart';

/// Screen geometry for the game screen, derived from the available size.
///
/// Proportions were measured on the original game (720 px wide capture) and
/// are expressed in units of 1% of the width ("u") so every phone width
/// scales the same way. Short screens shrink the unit to keep everything
/// visible.
class GameLayout {
  final Size size;
  final double u;
  final Rect boardRect;
  final Rect gridRect;
  final double cell;
  final double trayCell;
  final List<Offset> slotCenters;
  final Rect trayBand;
  final Offset bestAnchor;
  final double bestFont;
  final Rect gearRect;
  final Offset scoreCenter;
  final double scoreFont;

  GameLayout._({
    required this.size,
    required this.u,
    required this.boardRect,
    required this.gridRect,
    required this.cell,
    required this.trayCell,
    required this.slotCenters,
    required this.trayBand,
    required this.bestAnchor,
    required this.bestFont,
    required this.gearRect,
    required this.scoreCenter,
    required this.scoreFont,
  });

  factory GameLayout.compute(Size size) {
    final w = size.width;
    final h = size.height;
    // The design needs about 182u of height; shrink on short screens.
    final u = math.min(w / 100.0, h / 182.0);
    final cx = w / 2;

    final topY = 11.5 * u;
    final boardSide = 90.0 * u;
    final boardTop = math.max(44.0 * u, (h - 182.0 * u) * 0.25 + 44.0 * u);
    final boardRect = Rect.fromLTWH(cx - boardSide / 2, boardTop, boardSide, boardSide);
    final frame = 1.0 * u;
    final gridRect = boardRect.deflate(frame);
    final cell = gridRect.width / Board.size;

    final traySlotWidth = boardSide / 3;
    final trayCell = math.min(cell * 0.6, (traySlotWidth - 2.0 * u) / 5.0);
    final trayCenterY = boardRect.bottom + 25.0 * u;
    final slots = [for (var i = 0; i < 3; i++) Offset(boardRect.left + traySlotWidth * (i + 0.5), trayCenterY)];
    final trayBand = Rect.fromLTRB(0, boardRect.bottom + 4.0 * u, w, h);

    final scoreCenterY = (topY + 7 * u + boardTop) / 2;

    return GameLayout._(
      size: size,
      u: u,
      boardRect: boardRect,
      gridRect: gridRect,
      cell: cell,
      trayCell: trayCell,
      slotCenters: slots,
      trayBand: trayBand,
      bestAnchor: Offset(cx - 45.0 * u, topY),
      bestFont: 7.4 * u,
      gearRect: Rect.fromCenter(center: Offset(cx + 40.5 * u, topY), width: 9.0 * u, height: 9.0 * u),
      scoreCenter: Offset(cx, scoreCenterY),
      scoreFont: 15.5 * u,
    );
  }

  /// Slot index under a tray touch, or null.
  int? slotAt(Offset p) {
    if (!trayBand.contains(p)) return null;
    final slotW = boardRect.width / 3;
    if (slotW <= 0) return null;
    final i = ((p.dx - boardRect.left) / slotW).floor();
    return i.clamp(0, 2);
  }

  Rect cellRect(int r, int c) => Rect.fromLTWH(gridRect.left + c * cell, gridRect.top + r * cell, cell, cell);
}

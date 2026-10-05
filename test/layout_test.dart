import 'package:blockblast/src/game/layout.dart';
import 'package:flutter/painting.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  // Logical sizes (SafeArea content) of common phones, short/old phones and
  // tablets in portrait.
  const sizes = <Size>[
    Size(320, 480),
    Size(320, 568),
    Size(360, 592),
    Size(360, 640),
    Size(360, 740),
    Size(375, 667),
    Size(390, 800),
    Size(393, 851),
    Size(412, 869),
    Size(412, 915),
    Size(430, 932),
    Size(480, 1000),
    Size(600, 960),
    Size(768, 1004),
    Size(800, 1280),
  ];

  for (final size in sizes) {
    test('layout fits on ${size.width.toInt()}x${size.height.toInt()}', () {
      final l = GameLayout.compute(size);
      final screen = Offset.zero & size;

      // Board is square, centered and on screen.
      expect(l.boardRect.width, closeTo(l.boardRect.height, 0.001));
      expect(screen.contains(l.boardRect.topLeft), isTrue);
      expect(l.boardRect.right, lessThanOrEqualTo(size.width + 0.001));
      expect(l.boardRect.center.dx, closeTo(size.width / 2, 0.001));
      expect(l.cell * 8, closeTo(l.gridRect.width, 0.001));

      // Header above the board, gear on screen.
      expect(l.gearRect.top, greaterThanOrEqualTo(0));
      expect(l.gearRect.right, lessThanOrEqualTo(size.width));
      expect(l.gearRect.bottom, lessThan(l.boardRect.top));
      expect(l.scoreCenter.dy, lessThan(l.boardRect.top));
      expect(l.scoreCenter.dy - l.scoreFont / 2, greaterThan(l.gearRect.top));

      // Tray: the largest pieces (5 long / 3x3) fit inside their slot and the
      // screen, without touching the board or each other.
      final longest = 5 * l.trayCell;
      for (var i = 0; i < 3; i++) {
        final c = l.slotCenters[i];
        expect(c.dy - longest / 2, greaterThan(l.boardRect.bottom), reason: 'slot $i overlaps board');
        expect(c.dy + longest / 2, lessThanOrEqualTo(size.height), reason: 'slot $i off screen');
        expect(c.dx - longest / 2, greaterThanOrEqualTo(0));
        expect(c.dx + longest / 2, lessThanOrEqualTo(size.width));
      }
      final gap = (l.slotCenters[1].dx - l.slotCenters[0].dx) - longest;
      expect(gap, greaterThan(0), reason: 'two 1x5 pieces side by side would overlap');

      // Tray pieces are about half to 60% of a board cell.
      expect(l.trayCell / l.cell, inInclusiveRange(0.45, 0.6));

      // Every tray touch maps to a slot.
      for (var i = 0; i < 3; i++) {
        expect(l.slotAt(l.slotCenters[i]), i);
      }
      expect(l.slotAt(Offset(size.width / 2, l.boardRect.center.dy)), isNull);
    });
  }
}

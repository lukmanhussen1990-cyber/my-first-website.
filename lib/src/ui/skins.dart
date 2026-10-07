import 'dart:ui' as ui;

import 'package:flutter/foundation.dart';
import 'package:flutter/painting.dart';

import 'block_painter.dart';
import 'palette.dart';

/// Block designs. Classic is free; the others are Premium skins.
enum BlockSkin { classic, candy, neon, gem }

extension BlockSkinInfo on BlockSkin {
  String get id => name;

  String get label => switch (this) {
    BlockSkin.classic => 'Classic',
    BlockSkin.candy => 'Candy',
    BlockSkin.neon => 'Neon',
    BlockSkin.gem => 'Gem',
  };

  bool get isPremium => this != BlockSkin.classic;

  static BlockSkin fromId(String? id) {
    for (final s in BlockSkin.values) {
      if (s.id == id) return s;
    }
    return BlockSkin.classic;
  }
}

/// The skin used to draw blocks right now (the player's choice while it is
/// unlocked, Classic otherwise).
class ActiveSkin {
  ActiveSkin._();

  static final ValueNotifier<BlockSkin> notifier = ValueNotifier(BlockSkin.classic);

  static BlockSkin get value => notifier.value;
  static set value(BlockSkin skin) => notifier.value = skin;
}

/// Paints one block of [skin] filling [rect].
void paintSkinBlock(Canvas canvas, Rect rect, BlockColors k, BlockSkin skin) {
  switch (skin) {
    case BlockSkin.classic:
      paintBlockVector(canvas, rect, k);
    case BlockSkin.candy:
      _paintCandy(canvas, rect, k);
    case BlockSkin.neon:
      _paintNeon(canvas, rect, k);
    case BlockSkin.gem:
      _paintGem(canvas, rect, k);
  }
}

/// Soft, rounded jelly candy with a big glossy highlight.
void _paintCandy(Canvas canvas, Rect rect, BlockColors k) {
  final s = rect.width;
  final outer = RRect.fromRectAndRadius(rect.deflate(s * 0.02), Radius.circular(s * 0.26));
  canvas.drawRRect(outer, Paint()..color = k.outline);
  final body = outer.deflate(s * 0.045);
  canvas.drawRRect(
    body,
    Paint()
      ..shader = ui.Gradient.linear(
        body.outerRect.topCenter,
        body.outerRect.bottomCenter,
        [Color.lerp(k.top, k.face, 0.25)!, k.face, Color.lerp(k.face, k.bottom, 0.65)!],
        const [0, 0.5, 1],
      ),
  );
  // Inner rim light at the bottom (jelly translucency).
  final rim = body.deflate(s * 0.06);
  canvas.drawRRect(
    rim,
    Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = s * 0.035
      ..shader = ui.Gradient.linear(
        rim.outerRect.topCenter,
        rim.outerRect.bottomCenter,
        [const Color(0x00FFFFFF), const Color(0x00FFFFFF), k.glow.withValues(alpha: 0.75)],
        const [0, 0.55, 1],
      ),
  );
  // Big gloss.
  final gloss = Rect.fromLTWH(rect.left + s * 0.17, rect.top + s * 0.11, s * 0.66, s * 0.32);
  canvas.drawRRect(
    RRect.fromRectAndRadius(gloss, Radius.circular(s * 0.16)),
    Paint()
      ..shader = ui.Gradient.linear(
        gloss.topCenter,
        gloss.bottomCenter,
        const [Color(0xCCFFFFFF), Color(0x1AFFFFFF)],
      ),
  );
  // Sparkle.
  canvas.drawCircle(
    Offset(rect.left + s * 0.76, rect.top + s * 0.74),
    s * 0.055,
    Paint()..color = const Color(0x99FFFFFF),
  );
}

/// Dark glass tile with a glowing neon outline.
void _paintNeon(Canvas canvas, Rect rect, BlockColors k) {
  final s = rect.width;
  final tile = RRect.fromRectAndRadius(rect.deflate(s * 0.03), Radius.circular(s * 0.16));
  canvas.drawRRect(tile, Paint()..color = const Color(0xFF0A0F2E));
  canvas.drawRRect(
    tile,
    Paint()
      ..shader = ui.Gradient.radial(
        tile.outerRect.center,
        s * 0.6,
        [k.face.withValues(alpha: 0.45), k.face.withValues(alpha: 0.12)],
      ),
  );
  final ring = tile.deflate(s * 0.09);
  canvas.drawRRect(
    ring,
    Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = s * 0.16
      ..color = k.glow.withValues(alpha: 0.55)
      ..maskFilter = MaskFilter.blur(BlurStyle.normal, s * 0.07),
  );
  canvas.drawRRect(
    ring,
    Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = s * 0.075
      ..color = k.glow,
  );
  canvas.drawRRect(
    ring,
    Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = s * 0.028
      ..color = const Color(0xE6FFFFFF),
  );
  // Small inner square.
  final core = Rect.fromCenter(center: rect.center, width: s * 0.26, height: s * 0.26);
  canvas.drawRRect(
    RRect.fromRectAndRadius(core, Radius.circular(s * 0.05)),
    Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = s * 0.035
      ..color = k.glow.withValues(alpha: 0.8),
  );
}

/// Faceted jewel cut: a bright table surrounded by four shaded facets.
void _paintGem(Canvas canvas, Rect rect, BlockColors k) {
  final s = rect.width;
  final o = (s * 0.03).clamp(0.6, 3.0);
  canvas.drawRect(rect, Paint()..color = k.outline);
  final r = rect.deflate(o);
  final b = s * 0.24;
  final l = r.left, t = r.top, rr = r.right, bb = r.bottom;
  Path quad(Offset a, Offset b2, Offset c, Offset d) => Path()
    ..moveTo(a.dx, a.dy)
    ..lineTo(b2.dx, b2.dy)
    ..lineTo(c.dx, c.dy)
    ..lineTo(d.dx, d.dy)
    ..close();
  final fill = Paint()..isAntiAlias = true;
  canvas.drawPath(
    quad(Offset(l, t), Offset(rr, t), Offset(rr - b, t + b), Offset(l + b, t + b)),
    fill..color = Color.lerp(k.top, const Color(0xFFFFFFFF), 0.35)!,
  );
  canvas.drawPath(
    quad(Offset(l, t), Offset(l + b, t + b), Offset(l + b, bb - b), Offset(l, bb)),
    fill..color = Color.lerp(k.left, k.top, 0.35)!,
  );
  canvas.drawPath(
    quad(Offset(rr, t), Offset(rr - b, t + b), Offset(rr - b, bb - b), Offset(rr, bb)),
    fill..color = k.right,
  );
  canvas.drawPath(
    quad(Offset(l, bb), Offset(rr, bb), Offset(rr - b, bb - b), Offset(l + b, bb - b)),
    fill..color = Color.lerp(k.bottom, k.outline, 0.25)!,
  );
  final table = Rect.fromLTRB(l + b, t + b, rr - b, bb - b);
  canvas.drawRect(
    table,
    Paint()
      ..shader = ui.Gradient.linear(
        table.topLeft,
        table.bottomRight,
        [Color.lerp(k.top, const Color(0xFFFFFFFF), 0.2)!, k.face, Color.lerp(k.face, k.bottom, 0.4)!],
        const [0, 0.55, 1],
      ),
  );
  // Facet edges.
  final edge = Paint()
    ..color = const Color(0x55FFFFFF)
    ..strokeWidth = (s * 0.018).clamp(0.5, 2.0);
  canvas.drawLine(Offset(l, t), Offset(l + b, t + b), edge);
  canvas.drawLine(Offset(rr, t), Offset(rr - b, t + b), edge);
  canvas.drawLine(Offset(l, bb), Offset(l + b, bb - b), edge..color = const Color(0x33000000));
  canvas.drawLine(Offset(rr, bb), Offset(rr - b, bb - b), edge);
  // Star glint on the table.
  final c = Offset(table.left + table.width * 0.3, table.top + table.height * 0.3);
  final g = s * 0.1;
  canvas.drawPath(
    Path()
      ..moveTo(c.dx, c.dy - g)
      ..quadraticBezierTo(c.dx, c.dy, c.dx + g, c.dy)
      ..quadraticBezierTo(c.dx, c.dy, c.dx, c.dy + g)
      ..quadraticBezierTo(c.dx, c.dy, c.dx - g, c.dy)
      ..quadraticBezierTo(c.dx, c.dy, c.dx, c.dy - g)
      ..close(),
    Paint()..color = const Color(0xDDFFFFFF),
  );
}

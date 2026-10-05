import 'dart:math' as math;
import 'dart:ui' as ui;

import 'package:flutter/painting.dart';

import 'block_painter.dart';
import 'palette.dart';

/// Gold crown (best score marker and logo decoration).
void paintCrown(Canvas canvas, Rect r) {
  final w = r.width, h = r.height;
  Offset p(double x, double y) => Offset(r.left + x * w, r.top + y * h);
  final body = Path()
    ..moveTo(p(0.06, 0.30).dx, p(0.06, 0.30).dy)
    ..lineTo(p(0.30, 0.55).dx, p(0.30, 0.55).dy)
    ..lineTo(p(0.50, 0.14).dx, p(0.50, 0.14).dy)
    ..lineTo(p(0.70, 0.55).dx, p(0.70, 0.55).dy)
    ..lineTo(p(0.94, 0.30).dx, p(0.94, 0.30).dy)
    ..lineTo(p(0.84, 0.80).dx, p(0.84, 0.80).dy)
    ..lineTo(p(0.16, 0.80).dx, p(0.16, 0.80).dy)
    ..close();
  final band = RRect.fromRectAndRadius(Rect.fromPoints(p(0.15, 0.80), p(0.85, 0.97)), Radius.circular(h * 0.06));
  final shade = Paint()..color = const Color(0xFFD98A00);
  canvas.drawPath(body.shift(Offset(0, h * 0.04)), shade);
  canvas.drawPath(
    body,
    Paint()..shader = ui.Gradient.linear(r.topCenter, r.bottomCenter, const [Color(0xFFFFE15A), Color(0xFFFFB300)]),
  );
  canvas.drawRRect(band, Paint()..color = const Color(0xFFFFA200));
  // Balls on the tips.
  final ball = Paint()..color = const Color(0xFFFFD43B);
  for (final t in [p(0.06, 0.27), p(0.50, 0.11), p(0.94, 0.27)]) {
    canvas.drawCircle(t, w * 0.075, ball);
  }
  // Highlight.
  canvas.drawPath(
    Path()
      ..moveTo(p(0.22, 0.48).dx, p(0.22, 0.48).dy)
      ..lineTo(p(0.30, 0.58).dx, p(0.30, 0.58).dy)
      ..lineTo(p(0.27, 0.70).dx, p(0.27, 0.70).dy)
      ..close(),
    Paint()..color = const Color(0x88FFFFFF),
  );
}

/// Settings gear with the small red notification badge.
void paintGear(Canvas canvas, Rect r, {bool badge = true}) {
  final c = r.center;
  final outer = r.width * 0.46;
  final inner = r.width * 0.33;
  final hole = r.width * 0.15;
  final teeth = 8;
  final path = Path();
  for (var i = 0; i < teeth * 2; i++) {
    final a0 = (i / (teeth * 2)) * math.pi * 2 - math.pi / 2;
    final a1 = ((i + 1) / (teeth * 2)) * math.pi * 2 - math.pi / 2;
    final rad = i.isEven ? outer : inner;
    final s0 = Offset(c.dx + math.cos(a0 + 0.06) * rad, c.dy + math.sin(a0 + 0.06) * rad);
    final s1 = Offset(c.dx + math.cos(a1 - 0.06) * rad, c.dy + math.sin(a1 - 0.06) * rad);
    if (i == 0) {
      path.moveTo(s0.dx, s0.dy);
    } else {
      path.lineTo(s0.dx, s0.dy);
    }
    path.lineTo(s1.dx, s1.dy);
  }
  path.close();
  path.addOval(Rect.fromCircle(center: c, radius: hole));
  path.fillType = PathFillType.evenOdd;
  canvas.drawPath(path.shift(Offset(0, r.height * 0.04)), Paint()..color = const Color(0xFF2A3D78));
  canvas.drawPath(
    path,
    Paint()..shader = ui.Gradient.linear(r.topCenter, r.bottomCenter, const [Color(0xFFD8F1FF), Color(0xFFA9D4F0)]),
  );
  if (!badge) return;
  final b = Rect.fromLTWH(r.right - r.width * 0.30, r.top - r.height * 0.14, r.width * 0.50, r.height * 0.38);
  canvas.drawRRect(RRect.fromRectAndRadius(b, Radius.circular(b.height * 0.32)), Paint()..color = Palette.badge);
  // Vibrating phone glyph.
  final phone = Rect.fromCenter(center: b.center, width: b.width * 0.26, height: b.height * 0.62);
  final white = Paint()
    ..color = const Color(0xFFFFFFFF)
    ..style = PaintingStyle.stroke
    ..strokeWidth = math.max(1.0, b.height * 0.09)
    ..strokeCap = StrokeCap.round;
  canvas.drawRRect(RRect.fromRectAndRadius(phone, Radius.circular(phone.width * 0.25)), white);
  for (final s in [-1.0, 1.0]) {
    final x1 = b.center.dx + s * b.width * 0.24;
    final x2 = b.center.dx + s * b.width * 0.34;
    canvas.drawLine(Offset(x1, b.center.dy - b.height * 0.16), Offset(x1, b.center.dy + b.height * 0.16), white);
    canvas.drawLine(Offset(x2, b.center.dy - b.height * 0.08), Offset(x2, b.center.dy + b.height * 0.08), white);
  }
}

/// The app icon: rounded indigo square with red, yellow, green and blue blocks.
void paintAppIcon(Canvas canvas, Rect r, {bool rounded = true, double spritePx = 128}) {
  final radius = Radius.circular(r.width * 0.22);
  canvas.save();
  if (rounded) {
    canvas.clipRRect(RRect.fromRectAndRadius(r, radius));
  }
  canvas.drawRect(
    r,
    Paint()..shader = ui.Gradient.linear(r.topCenter, r.bottomCenter, const [Color(0xFF2B2C93), Color(0xFF1B1A63)]),
  );
  final cell = r.width / 4;
  // Faint grid.
  final grid = Paint()
    ..color = const Color(0x33000000)
    ..strokeWidth = math.max(1.0, r.width * 0.008);
  for (var i = 1; i < 4; i++) {
    canvas.drawLine(Offset(r.left + i * cell, r.top), Offset(r.left + i * cell, r.bottom), grid);
    canvas.drawLine(Offset(r.left, r.top + i * cell), Offset(r.right, r.top + i * cell), grid);
  }
  Rect at(double row, double col) => Rect.fromLTWH(r.left + col * cell, r.top + row * cell, cell, cell);
  const red = 0, yellow = 2, green = 3, blue = 5;
  for (final rc in const [
    [0, 0],
    [0, 1],
    [1, 0],
  ]) {
    drawBlock(canvas, at(rc[0].toDouble(), rc[1].toDouble()), red, spritePx);
  }
  for (final rc in const [
    [2, 0],
    [2, 1],
    [3, 0],
    [3, 1],
  ]) {
    drawBlock(canvas, at(rc[0].toDouble(), rc[1].toDouble()), green, spritePx);
  }
  for (final rc in const [
    [2, 3],
    [3, 2],
    [3, 3],
  ]) {
    drawBlock(canvas, at(rc[0].toDouble(), rc[1].toDouble()), blue, spritePx);
  }
  // Floating yellow piece with a soft shadow, as if being dragged.
  const fr = 0.6, fc = 1.55;
  final shadow = Paint()
    ..color = const Color(0x66000000)
    ..maskFilter = MaskFilter.blur(BlurStyle.normal, cell * 0.12);
  for (final rc in const [
    [0.0, 0.0],
    [0.0, 1.0],
    [1.0, 1.0],
  ]) {
    canvas.drawRect(at(fr + rc[0], fc + rc[1]).shift(Offset(cell * 0.08, cell * 0.12)), shadow);
  }
  for (final rc in const [
    [0.0, 0.0],
    [0.0, 1.0],
    [1.0, 1.0],
  ]) {
    drawBlock(canvas, at(fr + rc[0], fc + rc[1]), yellow, spritePx);
  }
  canvas.restore();
}

/// Blue gem shown behind the score when the record is beaten.
void paintDiamond(Canvas canvas, Offset center, double w, double h) {
  final top = Offset(center.dx, center.dy - h / 2);
  final bottom = Offset(center.dx, center.dy + h / 2);
  final left = Offset(center.dx - w / 2, center.dy);
  final right = Offset(center.dx + w / 2, center.dy);
  final path = Path()
    ..moveTo(top.dx, top.dy)
    ..lineTo(right.dx, right.dy)
    ..lineTo(bottom.dx, bottom.dy)
    ..lineTo(left.dx, left.dy)
    ..close();
  canvas.drawPath(
    path,
    Paint()..shader = ui.Gradient.linear(top, bottom, const [Color(0xFF6CC4FF), Color(0xFF3F97EA), Color(0xFF2465D6)]),
  );
  final facet = Path()
    ..moveTo(top.dx, top.dy)
    ..lineTo(center.dx + w * 0.18, center.dy - h * 0.06)
    ..lineTo(center.dx, center.dy + h * 0.1)
    ..lineTo(center.dx - w * 0.18, center.dy - h * 0.06)
    ..close();
  canvas.drawPath(facet, Paint()..color = const Color(0x40FFFFFF));
  canvas.drawPath(
    path,
    Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = w * 0.025
      ..color = const Color(0x66FFFFFF),
  );
}

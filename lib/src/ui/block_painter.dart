import 'dart:ui' as ui;

import 'package:flutter/painting.dart';

import 'palette.dart';

/// Draws one glossy, beveled 3D block filling [rect].
///
/// Geometry matches the original: thin dark outline, light top bevel,
/// slightly light left bevel, darker right bevel, darkest bottom bevel and
/// a softly graded face with a glossy highlight.
void paintBlockVector(Canvas canvas, Rect rect, BlockColors k) {
  final s = rect.width;
  final o = (s * 0.025).clamp(0.6, 3.0);
  final outer = rect;
  final r = rect.deflate(o);
  final b = s * 0.13;

  final fill = Paint()..isAntiAlias = true;

  // Outline.
  canvas.drawRect(outer, fill..color = k.outline);

  final l = r.left, t = r.top, rr = r.right, bb = r.bottom;

  Path quad(Offset a, Offset b2, Offset c, Offset d) => Path()
    ..moveTo(a.dx, a.dy)
    ..lineTo(b2.dx, b2.dy)
    ..lineTo(c.dx, c.dy)
    ..lineTo(d.dx, d.dy)
    ..close();

  // Bevels.
  canvas.drawPath(
    quad(Offset(l, t), Offset(rr, t), Offset(rr - b, t + b), Offset(l + b, t + b)),
    fill..color = k.top,
  );
  canvas.drawPath(
    quad(Offset(l, bb), Offset(rr, bb), Offset(rr - b, bb - b), Offset(l + b, bb - b)),
    fill..color = k.bottom,
  );
  canvas.drawPath(
    quad(Offset(l, t), Offset(l + b, t + b), Offset(l + b, bb - b), Offset(l, bb)),
    fill..color = k.left,
  );
  canvas.drawPath(
    quad(Offset(rr, t), Offset(rr - b, t + b), Offset(rr - b, bb - b), Offset(rr, bb)),
    fill..color = k.right,
  );

  // Face with a gentle vertical gradient.
  final face = Rect.fromLTRB(l + b, t + b, rr - b, bb - b);
  final faceTop = Color.lerp(k.face, k.top, 0.28)!;
  final faceBottom = Color.lerp(k.face, k.bottom, 0.10)!;
  canvas.drawRect(
    face,
    Paint()
      ..shader = ui.Gradient.linear(face.topCenter, face.bottomCenter, [faceTop, k.face, faceBottom], [0, 0.45, 1]),
  );

  // Glossy highlights: bright line along the top edge and a small shine.
  final hl = Paint()
    ..color = const Color(0x80FFFFFF)
    ..strokeWidth = (s * 0.03).clamp(0.6, 3.0)
    ..strokeCap = StrokeCap.round;
  canvas.drawLine(Offset(l + b * 0.6, t + s * 0.03), Offset(rr - b * 0.6, t + s * 0.03), hl);
  final shine = Paint()..color = const Color(0x55FFFFFF);
  canvas.drawRRect(
    RRect.fromRectAndRadius(
      Rect.fromLTWH(face.left + face.width * 0.08, face.top + face.height * 0.08, face.width * 0.22, face.height * 0.12),
      Radius.circular(s * 0.05),
    ),
    shine,
  );
}

/// Caches pre-rendered block images per color and pixel size so the board
/// can be drawn with cheap image blits every frame.
class BlockSprites {
  BlockSprites._();
  static final BlockSprites instance = BlockSprites._();

  final Map<int, ui.Image> _cache = {};

  ui.Image get(int color, double sizePx) {
    final px = sizePx.round().clamp(4, 512);
    final key = color * 1000 + px;
    final cached = _cache[key];
    if (cached != null) return cached;
    final recorder = ui.PictureRecorder();
    final canvas = Canvas(recorder);
    paintBlockVector(canvas, Rect.fromLTWH(0, 0, px.toDouble(), px.toDouble()), Palette.blocks[color]);
    final picture = recorder.endRecording();
    final image = picture.toImageSync(px, px);
    picture.dispose();
    _cache[key] = image;
    return image;
  }

  void clear() {
    for (final img in _cache.values) {
      img.dispose();
    }
    _cache.clear();
  }
}

final Paint _spritePaint = Paint()..filterQuality = FilterQuality.medium;

/// Draws a block of [color] into [rect] using a cached sprite that is
/// [spritePx] pixels wide (quantized so animations reuse the same images).
void drawBlock(Canvas canvas, Rect rect, int color, double spritePx, {double opacity = 1.0}) {
  if (opacity <= 0.0 || rect.width <= 0.5) return;
  final q = ((spritePx / 8).ceil() * 8).toDouble();
  final img = BlockSprites.instance.get(color, q);
  final src = Rect.fromLTWH(0, 0, img.width.toDouble(), img.height.toDouble());
  if (opacity >= 1.0) {
    canvas.drawImageRect(img, src, rect, _spritePaint);
  } else {
    final p = Paint()
      ..filterQuality = FilterQuality.medium
      ..color = Color.fromRGBO(255, 255, 255, opacity.clamp(0.0, 1.0));
    canvas.drawImageRect(img, src, rect, p);
  }
}

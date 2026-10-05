import 'dart:ui' as ui;

import 'package:flutter/painting.dart';

const String kNumberFont = 'Poppins';
const String kBubbleFont = 'Fredoka';

TextStyle bubbleStyle(
  double size, {
  Color color = const Color(0xFFFFFFFF),
  FontWeight weight = FontWeight.w700,
  double? wght,
}) {
  return TextStyle(
    fontFamily: kBubbleFont,
    fontSize: size,
    fontWeight: weight,
    fontVariations: [FontVariation('wght', wght ?? weight.value.toDouble())],
    color: color,
    height: 1.0,
  );
}

TextStyle numberStyle(double size, {Color color = const Color(0xFFFFFFFF), FontWeight weight = FontWeight.w800}) {
  return TextStyle(fontFamily: kNumberFont, fontSize: size, fontWeight: weight, color: color, height: 1.0);
}

/// Text with a vertical gradient fill, a thick outline and a drop shadow,
/// pre-laid-out once and painted many times (used for combo/praise labels).
class FancyText {
  final TextPainter _fill;
  final TextPainter _stroke;
  final TextPainter? _shadow;
  final TextPainter? _gloss;
  final double shadowDy;
  final double skew;

  FancyText._(this._fill, this._stroke, this._shadow, this._gloss, this.shadowDy, this.skew);

  factory FancyText({
    required String text,
    required TextStyle base,
    required List<Color> fill,
    required Color stroke,
    double strokeWidth = 4,
    Color? shadow,
    double shadowDy = 3,
    double skew = 0,
    List<double>? stops,
    bool gloss = false,
  }) {
    final probe = TextPainter(
      text: TextSpan(text: text, style: base),
      textDirection: TextDirection.ltr,
    )..layout();
    final h = probe.height;
    // dart:ui requires explicit stops for anything but two colors.
    final effectiveStops =
        stops ?? (fill.length == 2 ? null : List<double>.generate(fill.length, (i) => i / (fill.length - 1)));
    final fillPaint = Paint()
      ..shader = ui.Gradient.linear(Offset(0, h * 0.12), Offset(0, h * 0.92), fill, effectiveStops);
    final fillTp = TextPainter(
      text: TextSpan(
        text: text,
        style: base.copyWith(foreground: fillPaint, color: null),
      ),
      textDirection: TextDirection.ltr,
    )..layout();
    final strokeTp = TextPainter(
      text: TextSpan(
        text: text,
        style: base.copyWith(
          color: null,
          foreground: Paint()
            ..style = PaintingStyle.stroke
            ..strokeWidth = strokeWidth
            ..strokeJoin = StrokeJoin.round
            ..color = stroke,
        ),
      ),
      textDirection: TextDirection.ltr,
    )..layout();
    TextPainter? shadowTp;
    if (shadow != null) {
      shadowTp = TextPainter(
        text: TextSpan(
          text: text,
          style: base.copyWith(
            color: null,
            foreground: Paint()
              ..style = PaintingStyle.stroke
              ..strokeWidth = strokeWidth
              ..strokeJoin = StrokeJoin.round
              ..color = shadow,
          ),
        ),
        textDirection: TextDirection.ltr,
      )..layout();
    }
    TextPainter? glossTp;
    if (gloss) {
      // White shine fading out by mid-height (glossy candy letters).
      glossTp = TextPainter(
        text: TextSpan(
          text: text,
          style: base.copyWith(
            color: null,
            foreground: Paint()
              ..shader = ui.Gradient.linear(
                Offset(0, h * 0.15),
                Offset(0, h * 0.55),
                const [Color(0x99FFFFFF), Color(0x00FFFFFF)],
              ),
          ),
        ),
        textDirection: TextDirection.ltr,
      )..layout();
    }
    return FancyText._(fillTp, strokeTp, shadowTp, glossTp, shadowDy, skew);
  }

  double get width => _fill.width;
  double get height => _fill.height;

  /// Paints centered at [center] with uniform [scale] and [opacity].
  void paint(Canvas canvas, Offset center, {double scale = 1, double opacity = 1}) {
    if (opacity <= 0 || scale <= 0) return;
    canvas.save();
    canvas.translate(center.dx, center.dy);
    canvas.scale(scale);
    if (skew != 0) canvas.skew(skew, 0);
    canvas.translate(-width / 2, -height / 2);
    if (opacity < 1) {
      canvas.saveLayer(
        Rect.fromLTWH(-20, -20, width + 40, height + 40),
        Paint()..color = Color.fromRGBO(0, 0, 0, opacity),
      );
    }
    _shadow?.paint(canvas, Offset(0, shadowDy));
    _stroke.paint(canvas, Offset.zero);
    _fill.paint(canvas, Offset.zero);
    _gloss?.paint(canvas, Offset.zero);
    if (opacity < 1) canvas.restore();
    canvas.restore();
  }
}

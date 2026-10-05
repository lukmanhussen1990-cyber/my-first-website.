import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../ui/fancy_text.dart';
import '../ui/icons.dart';

/// "BLOCK BLAST" logo: bubbly multi-colored 3D letters, a gold crown on the
/// "O", "BLAST" in light blue and the "ADVENTURE MASTER" subtitle.
class BlockBlastLogo extends StatelessWidget {
  const BlockBlastLogo({super.key, required this.width});

  final double width;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: width,
      height: width * 0.62,
      child: CustomPaint(painter: _LogoPainter()),
    );
  }
}

class _LogoPainter extends CustomPainter {
  static const _letters = ['B', 'L', 'O', 'C', 'K'];
  static const _fills = [
    [Color(0xFFFFE07A), Color(0xFFFFA51F), Color(0xFFFF7A00)],
    [Color(0xFFFFF3A0), Color(0xFFFFD12E), Color(0xFFFFA800)],
    [Color(0xFFFF9C9C), Color(0xFFFF3B3B), Color(0xFFD9141E)],
    [Color(0xFFFFF3A0), Color(0xFFFFC62E), Color(0xFFFF9500)],
    [Color(0xFFE8B8FF), Color(0xFFB26BFF), Color(0xFF7E35E0)],
  ];
  static const _edges = [Color(0xFFB04A00), Color(0xFFB86E00), Color(0xFF8C0A12), Color(0xFFB05A00), Color(0xFF4A1A99)];
  static const _tilts = [-0.10, 0.05, 0.0, -0.05, 0.09];

  @override
  void paint(Canvas canvas, Size size) {
    final w = size.width;
    final big = w * 0.235;

    // BLOCK letters.
    final fts = <FancyText>[];
    for (var i = 0; i < _letters.length; i++) {
      fts.add(
        FancyText(
          text: _letters[i],
          base: bubbleStyle(big, wght: 600),
          fill: _fills[i],
          stops: const [0, 0.45, 1],
          stroke: _edges[i],
          strokeWidth: big * 0.075,
          shadow: Color.lerp(_edges[i], const Color(0xFF000000), 0.35),
          shadowDy: big * 0.09,
          gloss: true,
        ),
      );
    }
    const overlap = 0.05;
    final total = fts.fold<double>(0, (s, f) => s + f.width) - big * overlap * (fts.length - 1);
    var x = (w - total) / 2;
    final yBlock = size.height * 0.36;
    for (var i = 0; i < fts.length; i++) {
      final f = fts[i];
      final cx = x + f.width / 2;
      final bob = (i.isEven ? -1 : 1) * big * 0.025;
      canvas.save();
      canvas.translate(cx, yBlock + bob);
      canvas.rotate(_tilts[i]);
      f.paint(canvas, Offset.zero);
      canvas.restore();
      if (_letters[i] == 'O') {
        final crownW = big * 0.62;
        final crownRect = Rect.fromCenter(
          center: Offset(cx + big * 0.04, yBlock - big * 0.62),
          width: crownW,
          height: crownW * 0.72,
        );
        canvas.save();
        canvas.translate(crownRect.center.dx, crownRect.center.dy);
        canvas.rotate(0.08);
        canvas.translate(-crownRect.center.dx, -crownRect.center.dy);
        paintCrown(canvas, crownRect);
        canvas.restore();
      }
      x += f.width - big * overlap;
    }

    // BLAST.
    final blast = FancyText(
      text: 'BLAST',
      base: bubbleStyle(big * 0.82, wght: 640),
      fill: const [Color(0xFFDFFBFF), Color(0xFF6FE0FF), Color(0xFF1FA6F2)],
      stops: const [0, 0.45, 1],
      stroke: const Color(0xFF0B3C8A),
      strokeWidth: big * 0.07,
      shadow: const Color(0xFF07275E),
      shadowDy: big * 0.07,
      skew: -0.16,
      gloss: true,
    );
    blast.paint(canvas, Offset(w * 0.53, size.height * 0.70));

    // Subtitle.
    final sub = TextPainter(
      text: TextSpan(
        text: 'ADVENTURE MASTER',
        style: bubbleStyle(
          big * 0.17,
          color: const Color(0xFF9BD8FF),
          weight: FontWeight.w600,
        ).copyWith(letterSpacing: big * 0.02),
      ),
      textDirection: TextDirection.ltr,
    )..layout();
    canvas.save();
    canvas.translate(w * 0.53, size.height * 0.92);
    canvas.skew(-0.16, 0);
    sub.paint(canvas, Offset(-sub.width / 2, -sub.height / 2));
    canvas.restore();
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

/// Studio logo shown on the second splash screen.
class StudioLogo extends StatelessWidget {
  const StudioLogo({super.key, required this.width});

  final double width;

  @override
  Widget build(BuildContext context) {
    final big = width * 0.2;
    return SizedBox(
      width: width,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          FittedBox(
            fit: BoxFit.scaleDown,
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text('MY', style: numberStyle(big, weight: FontWeight.w800).copyWith(letterSpacing: -1)),
                SizedBox(
                  width: big * 0.72,
                  height: big * 0.95,
                  child: CustomPaint(painter: _GemPainter()),
                ),
                Text('APPS', style: numberStyle(big, weight: FontWeight.w800).copyWith(letterSpacing: -1)),
              ],
            ),
          ),
          Transform.translate(
            offset: Offset(width * 0.12, -big * 0.12),
            child: Text(
              'STUDIO',
              style: numberStyle(big * 0.42, weight: FontWeight.w700).copyWith(letterSpacing: big * 0.06),
            ),
          ),
        ],
      ),
    );
  }
}

class _GemPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final c = size.center(Offset.zero);
    final w = size.width * 0.86, h = size.height * 0.92;
    final path = Path()
      ..moveTo(c.dx, c.dy - h / 2)
      ..quadraticBezierTo(c.dx + w * 0.55, c.dy - h * 0.1, c.dx, c.dy + h / 2)
      ..quadraticBezierTo(c.dx - w * 0.55, c.dy - h * 0.1, c.dx, c.dy - h / 2)
      ..close();
    canvas.drawPath(path, Paint()..color = const Color(0xFFFF2D55));
    final inner = Path()
      ..moveTo(c.dx, c.dy - h * 0.12)
      ..quadraticBezierTo(c.dx + w * 0.2, c.dy + h * 0.08, c.dx, c.dy + h * 0.3)
      ..quadraticBezierTo(c.dx - w * 0.2, c.dy + h * 0.08, c.dx, c.dy - h * 0.12)
      ..close();
    canvas.drawPath(inner, Paint()..color = const Color(0xFFFFFFFF).withValues(alpha: 0.9));
    canvas.rotate(math.pi / 4 * 0);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

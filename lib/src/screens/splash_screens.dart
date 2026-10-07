import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../services/sound.dart';
import '../ui/block_painter.dart';
import '../ui/icons.dart';
import '../ui/palette.dart';
import '../widgets/logo.dart';
import 'home_screen.dart';
import 'transitions.dart';

/// Splash 1: plain white background with the app icon (~2 seconds).
class IconSplashScreen extends StatefulWidget {
  const IconSplashScreen({super.key});

  @override
  State<IconSplashScreen> createState() => _IconSplashScreenState();
}

class _IconSplashScreenState extends State<IconSplashScreen> {
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _timer = Timer(const Duration(milliseconds: 2000), () {
      if (!mounted) return;
      Navigator.of(context).pushReplacement(fadeRoute(const LoadingSplashScreen(), ms: 300));
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final w = MediaQuery.sizeOf(context).width;
    final dpr = MediaQuery.devicePixelRatioOf(context);
    final side = w * 0.3;
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: Palette.overlayOnWhite,
      child: Scaffold(
        backgroundColor: Colors.white,
        body: Center(
          child: SizedBox(
            width: side,
            height: side,
            child: CustomPaint(painter: _AppIconPainter(dpr)),
          ),
        ),
      ),
    );
  }
}

class _AppIconPainter extends CustomPainter {
  _AppIconPainter(this.dpr);
  final double dpr;

  @override
  void paint(Canvas canvas, Size size) {
    // Soft shadow like a launcher icon.
    final r = Offset.zero & size;
    canvas.drawRRect(
      RRect.fromRectAndRadius(r.shift(Offset(0, size.height * 0.03)), Radius.circular(size.width * 0.22)),
      Paint()
        ..color = const Color(0x33000000)
        ..maskFilter = MaskFilter.blur(BlurStyle.normal, size.width * 0.03),
    );
    paintAppIcon(canvas, r, spritePx: size.width / 4 * dpr);
  }

  @override
  bool shouldRepaint(covariant _AppIconPainter oldDelegate) => false;
}

/// Splash 2: blue gradient, studio logo, then the BLOCK BLAST logo while
/// small yellow blocks animate as a loading indicator.
class LoadingSplashScreen extends StatefulWidget {
  const LoadingSplashScreen({super.key});

  @override
  State<LoadingSplashScreen> createState() => _LoadingSplashScreenState();
}

class _LoadingSplashScreenState extends State<LoadingSplashScreen> with TickerProviderStateMixin {
  late final AnimationController _studio = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1500),
  )..forward();
  late final AnimationController _logo = AnimationController(vsync: this, duration: const Duration(milliseconds: 700));
  late final AnimationController _loader = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1600),
  )..repeat();
  bool _showLogo = false;
  Timer? _t1;
  Timer? _t2;

  @override
  void initState() {
    super.initState();
    // Warm up audio while the splash is visible.
    Sound.instance.init();
    _t1 = Timer(const Duration(milliseconds: 1500), () {
      if (!mounted) return;
      setState(() => _showLogo = true);
      _logo.forward();
    });
    _t2 = Timer(const Duration(milliseconds: 4100), () {
      if (!mounted) return;
      Navigator.of(context).pushReplacement(fadeRoute(const HomeScreen(), ms: 450));
    });
  }

  @override
  void dispose() {
    _t1?.cancel();
    _t2?.cancel();
    _studio.dispose();
    _logo.dispose();
    _loader.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final w = MediaQuery.sizeOf(context).width;
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: Palette.overlayOnBlue,
      child: Scaffold(
        backgroundColor: Palette.splashBottom,
        body: Container(
          width: double.infinity,
          height: double.infinity,
          decoration: const BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: [Palette.splashTop, Palette.splashBottom],
            ),
          ),
          child: Stack(
            children: [
              if (!_showLogo)
                Center(
                  child: AnimatedBuilder(
                    animation: _studio,
                    builder: (context, child) {
                      final t = _studio.value;
                      final o = t < 0.2 ? t / 0.2 : (t > 0.85 ? (1 - t) / 0.15 : 1.0);
                      return Opacity(opacity: o.clamp(0.0, 1.0), child: child);
                    },
                    child: StudioLogo(width: w * 0.55),
                  ),
                ),
              if (_showLogo) ...[
                Align(
                  alignment: const Alignment(0, -0.45),
                  child: ScaleTransition(
                    scale: CurvedAnimation(parent: _logo, curve: Curves.elasticOut),
                    child: BlockBlastLogo(width: w * 0.8),
                  ),
                ),
                Align(
                  alignment: const Alignment(0, 0.25),
                  child: FadeTransition(
                    opacity: _logo,
                    child: SizedBox(
                      width: w * 0.16,
                      height: w * 0.16,
                      child: AnimatedBuilder(
                        animation: _loader,
                        builder: (context, _) =>
                            CustomPaint(painter: _LoaderPainter(_loader.value, MediaQuery.devicePixelRatioOf(context))),
                      ),
                    ),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

/// Four yellow blocks morphing through tetromino shapes while spinning.
class _LoaderPainter extends CustomPainter {
  _LoaderPainter(this.t, this.dpr);
  final double t;
  final double dpr;

  static const _shapes = [
    [Offset(-1, -0.5), Offset(0, -0.5), Offset(1, -0.5), Offset(0, 0.5)], // T
    [Offset(-0.5, -0.5), Offset(0.5, -0.5), Offset(-0.5, 0.5), Offset(0.5, 0.5)], // O
    [Offset(-1, 0.5), Offset(0, 0.5), Offset(0, -0.5), Offset(1, -0.5)], // S
    [Offset(-1, -0.5), Offset(-1, 0.5), Offset(0, 0.5), Offset(1, 0.5)], // L
  ];

  @override
  void paint(Canvas canvas, Size size) {
    final n = _shapes.length;
    final pos = t * n;
    final i = pos.floor() % n;
    final j = (i + 1) % n;
    final f = Curves.easeInOutBack.transform((pos - pos.floor()).clamp(0.0, 1.0));
    final cell = size.width / 3.4;
    canvas.save();
    canvas.translate(size.width / 2, size.height / 2);
    canvas.rotate(-0.5 + math.sin(t * math.pi * 2) * 0.25);
    for (var k = 0; k < 4; k++) {
      final p = Offset.lerp(_shapes[i][k], _shapes[j][k], f)! * cell;
      drawBlock(canvas, Rect.fromCenter(center: p, width: cell * 0.96, height: cell * 0.96), 2, cell * dpr);
    }
    canvas.restore();
  }

  @override
  bool shouldRepaint(covariant _LoaderPainter oldDelegate) => oldDelegate.t != t;
}

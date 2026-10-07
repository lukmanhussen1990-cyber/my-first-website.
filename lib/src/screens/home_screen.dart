import 'dart:math' as math;
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../game/game_screen.dart';
import '../premium/premium_service.dart';
import '../services/ads_service.dart';
import '../services/haptics.dart';
import '../services/settings_store.dart';
import '../services/sound.dart';
import '../ui/block_painter.dart';
import '../ui/fancy_text.dart';
import '../ui/icons.dart';
import '../ui/palette.dart';
import '../ui/skins.dart';
import '../widgets/logo.dart';
import '../widgets/popups.dart';
import '../widgets/premium_popups.dart';
import '../widgets/ui_kit.dart';
import 'premium_screen.dart';
import 'transitions.dart';

/// Home / title screen: logo, best score, Continue / How to Play / Skins,
/// About (top left), Premium (top right) and the creator credit.
class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> with TickerProviderStateMixin {
  /// Entrance: logo pops in, then badge, buttons and footer slide up.
  late final AnimationController _intro = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1300),
  )..forward();

  /// Gentle float of the logo and background blocks. A few cycles only, then
  /// the screen rests (saves battery and lets UI automation settle).
  late final AnimationController _float = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 2200),
  )..repeat(reverse: true, count: 5);

  bool _howTo = false;
  bool _about = false;
  bool _skins = false;

  @override
  void initState() {
    super.initState();
    AdsService.instance.start();
  }

  @override
  void dispose() {
    _intro.dispose();
    _float.dispose();
    super.dispose();
  }

  void _play() {
    Navigator.of(context).pushReplacement(zoomFadeRoute(const GameScreen()));
  }

  Future<void> _openPremium() async {
    await Navigator.of(context).push(slideUpRoute(const PremiumScreen(source: 'home')));
    if (mounted) setState(() {});
  }

  /// [t] of a section that starts at [start] (fraction of the intro).
  Animation<double> _section(double start, {double length = 0.45, Curve curve = Curves.easeOutCubic}) =>
      CurvedAnimation(parent: _intro, curve: Interval(start, math.min(1, start + length), curve: curve));

  Widget _rise(Animation<double> a, Widget child, {double dy = 24}) => AnimatedBuilder(
    animation: a,
    builder: (context, child) => Opacity(
      opacity: a.value.clamp(0.0, 1.0),
      child: Transform.translate(offset: Offset(0, dy * (1 - a.value)), child: child),
    ),
    child: child,
  );

  @override
  Widget build(BuildContext context) {
    final hasSaved = SettingsStore.instance.loadSavedGame() != null;
    final dpr = MediaQuery.devicePixelRatioOf(context);
    return PopScope(
      canPop: !_howTo && !_about && !_skins,
      onPopInvokedWithResult: (didPop, _) {
        if (didPop) return;
        setState(() {
          if (_skins) {
            _skins = false;
          } else if (_about) {
            _about = false;
          } else {
            _howTo = false;
          }
        });
      },
      child: AnnotatedRegion<SystemUiOverlayStyle>(
        value: Palette.overlayOnBlue,
        child: Scaffold(
          backgroundColor: Palette.splashBottom,
          body: Stack(
            children: [
              Positioned.fill(
                child: RepaintBoundary(
                  key: const ValueKey('home-backdrop'),
                  child: CustomPaint(painter: _HomeBackdropPainter(_float, dpr)),
                ),
              ),
              SafeArea(
                child: LayoutBuilder(
                  builder: (context, box) {
                    final w = box.maxWidth;
                    final h = box.maxHeight;
                    // Scale factor for short screens (designed for ~720dp).
                    final k = (h / 720).clamp(0.78, 1.0);
                    final logoW = math.min(math.min(w * 0.84, h * 0.46 / 0.62), 440.0);
                    final buttonW = math.min(w * 0.7, 340.0);
                    return Column(
                      children: [
                        _rise(
                          _section(0.35),
                          Padding(
                            padding: const EdgeInsets.fromLTRB(12, 8, 12, 0),
                            child: Row(
                              children: [
                                _RoundIconButton(
                                  icon: Icons.info_outline_rounded,
                                  label: 'About',
                                  onTap: () => setState(() => _about = true),
                                ),
                                const Spacer(),
                                ListenableBuilder(
                                  listenable: PremiumService.instance,
                                  builder: (context, _) => PremiumBadgeButton(
                                    active: PremiumService.instance.isPremium,
                                    onTap: _openPremium,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          dy: -16,
                        ),
                        const Spacer(flex: 3),
                        AnimatedBuilder(
                          animation: Listenable.merge([_intro, _float]),
                          builder: (context, child) {
                            final pop = Curves.easeOutBack.transform(
                              const Interval(0, 0.45).transform(_intro.value),
                            );
                            final bob = -7 * Curves.easeInOut.transform(_float.value);
                            return Opacity(
                              opacity: const Interval(0, 0.25).transform(_intro.value),
                              child: Transform.translate(
                                offset: Offset(0, bob),
                                child: Transform.scale(scale: 0.82 + 0.18 * pop, child: child),
                              ),
                            );
                          },
                          child: BlockBlastLogo(width: logoW),
                        ),
                        const Spacer(flex: 2),
                        _rise(_section(0.3), _BestBadge(best: SettingsStore.instance.bestScore, scale: k)),
                        SizedBox(height: 24 * k),
                        _rise(
                          _section(0.4),
                          CandyButton(
                            label: hasSaved ? 'Continue' : 'Classic',
                            icon: Icons.play_arrow_rounded,
                            width: buttonW,
                            height: 66 * k,
                            fontSize: 29 * k,
                            onTap: _play,
                          ),
                        ),
                        SizedBox(height: 14 * k),
                        _rise(
                          _section(0.48),
                          CandyButton(
                            label: 'How to Play',
                            icon: Icons.help_outline_rounded,
                            colors: CandyButton.blue,
                            edge: CandyButton.blueEdge,
                            width: buttonW,
                            height: 54 * k,
                            fontSize: 22 * k,
                            onTap: () => setState(() => _howTo = true),
                          ),
                        ),
                        SizedBox(height: 14 * k),
                        _rise(
                          _section(0.56),
                          CandyButton(
                            label: 'Block Skins',
                            icon: Icons.palette_rounded,
                            colors: CandyButton.purple,
                            edge: CandyButton.purpleEdge,
                            width: buttonW,
                            height: 54 * k,
                            fontSize: 22 * k,
                            onTap: () => setState(() => _skins = true),
                          ),
                        ),
                        const Spacer(flex: 3),
                        _rise(_section(0.62), const _CreatorCredit(), dy: 12),
                        SizedBox(height: 12 * k),
                      ],
                    );
                  },
                ),
              ),
              if (_howTo) HowToPlayPopup(onClose: () => setState(() => _howTo = false)),
              if (_skins)
                SkinPickerPopup(
                  onClose: () => setState(() => _skins = false),
                  onPremium: _openPremium,
                ),
              if (_about) AboutPopup(onClose: () => setState(() => _about = false)),
            ],
          ),
        ),
      ),
    );
  }
}

/// Gold crown "PREMIUM" pill for the top-right corner (48dp+ touch target).
class PremiumBadgeButton extends StatefulWidget {
  const PremiumBadgeButton({super.key, required this.active, required this.onTap});

  final bool active;
  final VoidCallback onTap;

  @override
  State<PremiumBadgeButton> createState() => _PremiumBadgeButtonState();
}

class _PremiumBadgeButtonState extends State<PremiumBadgeButton> with SingleTickerProviderStateMixin {
  bool _down = false;

  /// A light sweep across the pill, a few times after the screen opens.
  late final AnimationController _shine = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 2600),
  )..repeat(count: 3);

  @override
  void dispose() {
    _shine.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: widget.active ? 'Premium, active' : 'Premium',
      excludeSemantics: true,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTapDown: (_) {
          setState(() => _down = true);
          Haptics.tick();
        },
        onTapCancel: () => setState(() => _down = false),
        onTapUp: (_) {
          setState(() => _down = false);
          Sound.instance.play(Sfx.click);
          widget.onTap();
        },
        child: Padding(
          // Visual pill is 40dp tall; padding makes the touch target 56dp.
          padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 4),
          child: AnimatedScale(
            scale: _down ? 0.93 : 1.0,
            duration: const Duration(milliseconds: 80),
            child: Container(
              height: 40,
              padding: const EdgeInsets.only(left: 10, right: 14),
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [Color(0xFFFFEE9A), Color(0xFFFFC21F), Color(0xFFF59E0B)],
                  stops: [0, 0.55, 1],
                ),
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: const Color(0xFFFFF6CF), width: 1.5),
                boxShadow: const [
                  BoxShadow(color: Color(0xFFA85F00), offset: Offset(0, 3)),
                  BoxShadow(color: Color(0x55000000), offset: Offset(0, 5), blurRadius: 6),
                ],
              ),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(20),
                child: Stack(
                  alignment: Alignment.center,
                  children: [
                    Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const SizedBox(width: 27, height: 20, child: CustomPaint(painter: _CrownPainter())),
                        const SizedBox(width: 6),
                        Text(
                          'PREMIUM',
                          style: bubbleStyle(16, color: const Color(0xFF7A3E00), weight: FontWeight.w700)
                              .copyWith(letterSpacing: 1.6),
                        ),
                        if (widget.active) ...[
                          const SizedBox(width: 6),
                          const Icon(Icons.check_circle_rounded, size: 18, color: Color(0xFF1F8A2A)),
                        ],
                      ],
                    ),
                    Positioned.fill(
                      child: IgnorePointer(
                        child: AnimatedBuilder(
                          animation: _shine,
                          builder: (context, _) => CustomPaint(painter: _ShinePainter(_shine.value)),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _ShinePainter extends CustomPainter {
  _ShinePainter(this.t);

  final double t;

  @override
  void paint(Canvas canvas, Size size) {
    // Sweep during the first 40% of each cycle, then rest.
    final k = t / 0.4;
    if (k <= 0 || k >= 1) return;
    final x = -size.width * 0.3 + (size.width * 1.6) * k;
    final path = Path()
      ..moveTo(x, 0)
      ..lineTo(x + size.height * 0.5, 0)
      ..lineTo(x + size.height * 0.5 - size.height * 0.6, size.height)
      ..lineTo(x - size.height * 0.6, size.height)
      ..close();
    canvas.drawPath(path, Paint()..color = const Color(0x88FFFFFF));
  }

  @override
  bool shouldRepaint(covariant _ShinePainter oldDelegate) => oldDelegate.t != t;
}

class _RoundIconButton extends StatefulWidget {
  const _RoundIconButton({required this.icon, required this.label, required this.onTap});

  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  State<_RoundIconButton> createState() => _RoundIconButtonState();
}

class _RoundIconButtonState extends State<_RoundIconButton> {
  bool _down = false;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: widget.label,
      excludeSemantics: true,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTapDown: (_) => setState(() => _down = true),
        onTapCancel: () => setState(() => _down = false),
        onTapUp: (_) {
          setState(() => _down = false);
          Sound.instance.play(Sfx.click);
          widget.onTap();
        },
        child: Padding(
          padding: const EdgeInsets.all(6),
          child: AnimatedScale(
            scale: _down ? 0.9 : 1.0,
            duration: const Duration(milliseconds: 80),
            child: Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: Colors.white.withValues(alpha: 0.16),
                border: Border.all(color: Colors.white.withValues(alpha: 0.5), width: 1.5),
                boxShadow: const [BoxShadow(color: Color(0x33000000), offset: Offset(0, 3), blurRadius: 4)],
              ),
              child: Icon(widget.icon, color: Colors.white, size: 26),
            ),
          ),
        ),
      ),
    );
  }
}

class _BestBadge extends StatelessWidget {
  const _BestBadge({required this.best, required this.scale});

  final int best;
  final double scale;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: 'Best score $best',
      excludeSemantics: true,
      child: Container(
        padding: EdgeInsets.fromLTRB(16 * scale, 8 * scale, 22 * scale, 8 * scale),
        decoration: BoxDecoration(
          color: const Color(0x40081A55),
          borderRadius: BorderRadius.circular(30),
          border: Border.all(color: const Color(0x66FFD54A), width: 1.5),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            SizedBox(width: 40 * scale, height: 29 * scale, child: const CustomPaint(painter: _CrownPainter())),
            SizedBox(width: 10 * scale),
            Text(
              'BEST',
              style: bubbleStyle(15 * scale, color: const Color(0xFFFFE58A), weight: FontWeight.w600)
                  .copyWith(letterSpacing: 2),
            ),
            SizedBox(width: 10 * scale),
            Text(
              '$best',
              style: numberStyle(32 * scale, color: Palette.goldText, weight: FontWeight.w700).copyWith(
                shadows: const [Shadow(color: Color(0x66081A55), offset: Offset(0, 2), blurRadius: 3)],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// "CREATED BY IMRAN" footer.
class _CreatorCredit extends StatelessWidget {
  const _CreatorCredit();

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(width: 26, height: 1.5, color: const Color(0x80FFE58A)),
        const SizedBox(width: 10),
        Text(
          'CREATED BY IMRAN',
          style: bubbleStyle(15, color: const Color(0xF2FFFFFF), weight: FontWeight.w600).copyWith(
            letterSpacing: 2.6,
            shadows: const [Shadow(color: Color(0x66081A55), offset: Offset(0, 1.5), blurRadius: 2)],
          ),
        ),
        const SizedBox(width: 10),
        Container(width: 26, height: 1.5, color: const Color(0x80FFE58A)),
      ],
    );
  }
}

class _CrownPainter extends CustomPainter {
  const _CrownPainter();

  @override
  void paint(Canvas canvas, Size size) => paintCrown(canvas, Offset.zero & size);

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

/// Blue gradient with a soft light behind the logo and a few translucent
/// blocks floating near the sides.
class _HomeBackdropPainter extends CustomPainter {
  _HomeBackdropPainter(this.float, this.dpr) : super(repaint: float);

  final Animation<double> float;
  final double dpr;

  static const _blocks = <(double, double, double, int, double)>[
    // x, y (fractions), size (fraction of width), color, rotation
    (0.10, 0.17, 0.085, 0, -0.30),
    (0.88, 0.13, 0.07, 3, 0.25),
    (0.07, 0.62, 0.075, 5, 0.20),
    (0.92, 0.55, 0.09, 1, -0.18),
    (0.16, 0.86, 0.06, 6, 0.35),
    (0.84, 0.82, 0.075, 2, -0.30),
  ];

  @override
  void paint(Canvas canvas, Size size) {
    final r = Offset.zero & size;
    canvas.drawRect(
      r,
      Paint()
        ..shader = ui.Gradient.linear(r.topCenter, r.bottomCenter, const [Palette.splashTop, Palette.splashBottom]),
    );
    final glowCenter = Offset(size.width / 2, size.height * 0.3);
    canvas.drawCircle(
      glowCenter,
      size.width * 0.7,
      Paint()
        ..shader = ui.Gradient.radial(glowCenter, size.width * 0.7, const [Color(0x40A9D4FF), Color(0x00A9D4FF)]),
    );
    final t = Curves.easeInOut.transform(float.value);
    for (var i = 0; i < _blocks.length; i++) {
      final (fx, fy, fs, color, rot) = _blocks[i];
      final s = size.width * fs;
      final phase = i.isEven ? t : 1 - t;
      final c = Offset(size.width * fx, size.height * fy + (phase - 0.5) * 10);
      canvas.save();
      canvas.translate(c.dx, c.dy);
      canvas.rotate(rot + (phase - 0.5) * 0.12);
      drawBlock(
        canvas,
        Rect.fromCenter(center: Offset.zero, width: s, height: s),
        color,
        s * dpr,
        opacity: 0.32,
        skin: BlockSkin.classic,
      );
      canvas.restore();
    }
  }

  @override
  bool shouldRepaint(covariant _HomeBackdropPainter oldDelegate) => oldDelegate.dpr != dpr;
}

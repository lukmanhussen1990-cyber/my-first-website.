import 'package:flutter/material.dart';

import '../services/haptics.dart';
import '../services/sound.dart';
import '../ui/fancy_text.dart';

/// Glossy 3D "candy" button used across menus and popups.
class CandyButton extends StatefulWidget {
  const CandyButton({
    super.key,
    required this.label,
    required this.onTap,
    this.icon,
    this.colors = const [Color(0xFF7BE35A), Color(0xFF35B32B)],
    this.edge = const Color(0xFF1F7A1A),
    this.width,
    this.height = 56,
    this.fontSize = 22,
    this.enabled = true,
    this.leading,
    this.semanticsLabel,
  });

  final String label;
  final VoidCallback onTap;
  final IconData? icon;

  /// Custom leading graphic (used instead of [icon]).
  final Widget? leading;
  final bool enabled;
  final String? semanticsLabel;
  final List<Color> colors;
  final Color edge;
  final double? width;
  final double height;
  final double fontSize;

  static const green = [Color(0xFF7BE35A), Color(0xFF35B32B)];
  static const greenEdge = Color(0xFF1F7A1A);
  static const blue = [Color(0xFF6FB8FF), Color(0xFF2F74E6)];
  static const blueEdge = Color(0xFF1A47A3);
  static const orange = [Color(0xFFFFC65C), Color(0xFFFF8A1F)];
  static const orangeEdge = Color(0xFFB4530A);
  static const gold = [Color(0xFFFFEA8A), Color(0xFFFFC21F), Color(0xFFF59E0B)];
  static const goldEdge = Color(0xFFA85F00);
  static const purple = [Color(0xFFC79BFF), Color(0xFF8A4FE0)];
  static const purpleEdge = Color(0xFF51239A);
  static const disabled = [Color(0xFF9AA4BE), Color(0xFF6E7894)];
  static const disabledEdge = Color(0xFF4A536E);

  @override
  State<CandyButton> createState() => _CandyButtonState();
}

class _CandyButtonState extends State<CandyButton> {
  bool _down = false;

  @override
  Widget build(BuildContext context) {
    final enabled = widget.enabled;
    final colors = enabled ? widget.colors : CandyButton.disabled;
    final edge = enabled ? widget.edge : CandyButton.disabledEdge;
    final h = widget.height;
    final edgeH = h * 0.12;
    final radius = BorderRadius.circular(h * 0.32);
    final gradientStops = colors.length > 2 ? [for (var i = 0; i < colors.length; i++) i / (colors.length - 1)] : null;
    final pressed = _down && enabled;
    return Semantics(
      button: true,
      enabled: enabled,
      label: widget.semanticsLabel ?? widget.label,
      excludeSemantics: true,
      onTap: enabled ? widget.onTap : null,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTapDown: (_) {
          if (!enabled) return;
          setState(() => _down = true);
          Haptics.tick();
        },
        onTapCancel: () => setState(() => _down = false),
        onTapUp: (_) {
          setState(() => _down = false);
          if (!enabled) return;
          Sound.instance.play(Sfx.click);
          widget.onTap();
        },
        child: AnimatedScale(
          scale: pressed ? 0.96 : 1.0,
          duration: const Duration(milliseconds: 70),
          child: SizedBox(
            width: widget.width,
            height: h + edgeH,
            child: Stack(
              children: [
                // Edge (the button's side) with a soft shadow below it.
                Positioned(
                  left: 0,
                  right: 0,
                  bottom: 0,
                  height: h,
                  child: DecoratedBox(
                    decoration: BoxDecoration(
                      color: edge,
                      borderRadius: radius,
                      boxShadow: [
                        BoxShadow(
                          color: const Color(0x55081230),
                          offset: Offset(0, pressed ? edgeH * 0.3 : edgeH * 0.8),
                          blurRadius: pressed ? edgeH : edgeH * 1.8,
                        ),
                      ],
                    ),
                  ),
                ),
                AnimatedPositioned(
                  duration: const Duration(milliseconds: 70),
                  left: 0,
                  right: 0,
                  top: pressed ? edgeH * 0.75 : 0,
                  height: h,
                  child: DecoratedBox(
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.topCenter,
                        end: Alignment.bottomCenter,
                        colors: colors,
                        stops: gradientStops,
                      ),
                      borderRadius: radius,
                      border: Border.all(color: Colors.white.withValues(alpha: 0.4), width: 1.5),
                    ),
                    child: Stack(
                      children: [
                        // Glossy band.
                        Positioned(
                          left: h * 0.22,
                          right: h * 0.22,
                          top: h * 0.07,
                          height: h * 0.3,
                          child: DecoratedBox(
                            decoration: BoxDecoration(
                              gradient: LinearGradient(
                                begin: Alignment.topCenter,
                                end: Alignment.bottomCenter,
                                colors: [Colors.white.withValues(alpha: 0.42), Colors.white.withValues(alpha: 0.12)],
                              ),
                              borderRadius: BorderRadius.circular(h),
                            ),
                          ),
                        ),
                        Center(
                          child: Padding(
                            padding: EdgeInsets.symmetric(horizontal: h * 0.22),
                            child: FittedBox(
                              fit: BoxFit.scaleDown,
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  if (widget.leading != null) ...[
                                    widget.leading!,
                                    SizedBox(width: widget.fontSize * 0.35),
                                  ] else if (widget.icon != null) ...[
                                    Icon(
                                      widget.icon,
                                      color: Colors.white,
                                      size: widget.fontSize * 1.15,
                                      shadows: [Shadow(color: edge, offset: const Offset(0, 2))],
                                    ),
                                    SizedBox(width: widget.fontSize * 0.35),
                                  ],
                                  Text(
                                    widget.label,
                                    style: bubbleStyle(widget.fontSize).copyWith(
                                      letterSpacing: widget.fontSize * 0.01,
                                      shadows: [Shadow(color: edge, offset: const Offset(0, 2), blurRadius: 0)],
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Pill toggle switch in the game style.
class CandyToggle extends StatelessWidget {
  const CandyToggle({super.key, required this.value, required this.onChanged});

  final bool value;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () {
        Sound.instance.play(Sfx.click);
        onChanged(!value);
      },
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 160),
        width: 64,
        height: 34,
        padding: const EdgeInsets.all(3),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(20),
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: value ? const [Color(0xFF5ED94A), Color(0xFF2FA824)] : const [Color(0xFF7E89A8), Color(0xFF5D6785)],
          ),
          boxShadow: const [BoxShadow(color: Color(0x55000000), offset: Offset(0, 2), blurRadius: 2)],
        ),
        child: AnimatedAlign(
          duration: const Duration(milliseconds: 160),
          curve: Curves.easeOutBack,
          alignment: value ? Alignment.centerRight : Alignment.centerLeft,
          child: Container(
            width: 28,
            height: 28,
            decoration: const BoxDecoration(
              shape: BoxShape.circle,
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [Colors.white, Color(0xFFDDE6F5)],
              ),
              boxShadow: [BoxShadow(color: Color(0x44000000), offset: Offset(0, 1), blurRadius: 2)],
            ),
          ),
        ),
      ),
    );
  }
}

/// Paints a [FancyText] (gradient + outline) as a widget.
class FancyLabel extends StatelessWidget {
  const FancyLabel(
    this.text, {
    super.key,
    required this.size,
    this.fill = const [Colors.white, Color(0xFFE2F4FF), Color(0xFF9AD6FF)],
    this.stroke = const Color(0xFF1D4FB8),
    this.strokeWidth,
    this.skew = 0,
    this.shadow = const Color(0xFF0E2A6B),
  });

  final String text;
  final double size;
  final List<Color> fill;
  final Color stroke;
  final double? strokeWidth;
  final double skew;
  final Color? shadow;

  @override
  Widget build(BuildContext context) {
    final ft = FancyText(
      text: text,
      base: bubbleStyle(size),
      fill: fill,
      stroke: stroke,
      strokeWidth: strokeWidth ?? size * 0.16,
      shadow: shadow,
      shadowDy: size * 0.08,
      skew: skew,
    );
    return SizedBox(
      width: ft.width + size * 0.6,
      height: ft.height + size * 0.3,
      child: CustomPaint(painter: _FancyPainter(ft)),
    );
  }
}

class _FancyPainter extends CustomPainter {
  _FancyPainter(this.ft);
  final FancyText ft;

  @override
  void paint(Canvas canvas, Size size) => ft.paint(canvas, size.center(Offset.zero));

  @override
  bool shouldRepaint(covariant _FancyPainter oldDelegate) => true;
}

/// Popup card with dimmed backdrop and a pop-in animation.
class GamePopup extends StatefulWidget {
  const GamePopup({super.key, required this.title, required this.child, this.onClose, this.width = 330});

  final String title;
  final Widget child;
  final VoidCallback? onClose;
  final double width;

  @override
  State<GamePopup> createState() => _GamePopupState();
}

class _GamePopupState extends State<GamePopup> with SingleTickerProviderStateMixin {
  late final AnimationController _ac = AnimationController(vsync: this, duration: const Duration(milliseconds: 380))
    ..forward();

  @override
  void dispose() {
    _ac.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final scale = CurvedAnimation(parent: _ac, curve: Curves.easeOutBack);
    final fade = CurvedAnimation(parent: _ac, curve: const Interval(0, 0.5));
    return Stack(
      children: [
        Positioned.fill(
          child: FadeTransition(
            opacity: fade,
            child: GestureDetector(
              behavior: HitTestBehavior.opaque,
              onTap: () {},
              child: const ColoredBox(color: Color(0xB3081230)),
            ),
          ),
        ),
        Center(
          child: Padding(
            padding: const EdgeInsets.all(12),
            // Shrinks the card on very small screens instead of overflowing.
            child: FittedBox(
              fit: BoxFit.scaleDown,
              child: ScaleTransition(
                scale: scale,
                child: FadeTransition(
                  opacity: fade,
                  child: Stack(
                    clipBehavior: Clip.none,
                    children: [
                      Container(
                        width: widget.width,
                        margin: const EdgeInsets.only(top: 26),
                        padding: const EdgeInsets.fromLTRB(20, 44, 20, 22),
                        decoration: BoxDecoration(
                          gradient: const LinearGradient(
                            begin: Alignment.topCenter,
                            end: Alignment.bottomCenter,
                            colors: [Color(0xFF5577D8), Color(0xFF3A57B5)],
                          ),
                          borderRadius: BorderRadius.circular(26),
                          border: Border.all(color: const Color(0xFF8FB0FF), width: 3),
                          boxShadow: const [
                            BoxShadow(color: Color(0xFF1F2F70), offset: Offset(0, 6)),
                            BoxShadow(color: Color(0x66000000), offset: Offset(0, 12), blurRadius: 24),
                          ],
                        ),
                        child: widget.child,
                      ),
                      Positioned(
                        top: 0,
                        left: 0,
                        right: 0,
                        child: Center(
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 26, vertical: 4),
                            decoration: BoxDecoration(
                              gradient: const LinearGradient(
                                begin: Alignment.topCenter,
                                end: Alignment.bottomCenter,
                                colors: [Color(0xFFFFC85A), Color(0xFFFF8E26)],
                              ),
                              borderRadius: BorderRadius.circular(18),
                              border: Border.all(color: const Color(0xFFFFE4A3), width: 2),
                              boxShadow: const [BoxShadow(color: Color(0xFFB4530A), offset: Offset(0, 4))],
                            ),
                            child: FancyLabel(
                              widget.title,
                              size: 30,
                              fill: const [Colors.white, Color(0xFFFFF4D9)],
                              stroke: const Color(0xFFB4530A),
                              shadow: null,
                            ),
                          ),
                        ),
                      ),
                      if (widget.onClose != null)
                        Positioned(
                          top: 34,
                          right: 8,
                          child: GestureDetector(
                            onTap: () {
                              Sound.instance.play(Sfx.click);
                              widget.onClose!();
                            },
                            child: Container(
                              width: 38,
                              height: 38,
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                gradient: const LinearGradient(
                                  begin: Alignment.topCenter,
                                  end: Alignment.bottomCenter,
                                  colors: [Color(0xFFFF7B7B), Color(0xFFE13434)],
                                ),
                                border: Border.all(color: Colors.white, width: 2.5),
                                boxShadow: const [
                                  BoxShadow(color: Color(0x66000000), offset: Offset(0, 2), blurRadius: 3),
                                ],
                              ),
                              child: const Icon(Icons.close_rounded, color: Colors.white, size: 24),
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
      ],
    );
  }
}

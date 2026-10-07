import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../premium/plans.dart';
import '../premium/premium_service.dart';
import '../services/ads_service.dart';
import '../services/settings_store.dart';
import '../ui/block_painter.dart';
import '../ui/fancy_text.dart';
import '../ui/icons.dart';
import '../ui/skins.dart';
import '../version.dart';
import 'ui_kit.dart';

/// "Continue?" offer shown when no piece fits. Premium players revive
/// instantly; free players watch a rewarded ad. Declines itself when the
/// countdown runs out.
class ReviveOfferPopup extends StatefulWidget {
  const ReviveOfferPopup({
    super.key,
    required this.score,
    required this.premium,
    required this.revivesLeft,
    required this.adReady,
    required this.paused,
    required this.onRevive,
    required this.onWatchAd,
    required this.onPremium,
    required this.onDecline,
  });

  static const Duration countdown = Duration(seconds: 10);

  final int score;
  final bool premium;
  final int revivesLeft;
  final bool adReady;

  /// Stops the countdown (while an ad or the Premium screen is open).
  final bool paused;
  final VoidCallback onRevive;
  final VoidCallback onWatchAd;
  final VoidCallback onPremium;
  final VoidCallback onDecline;

  @override
  State<ReviveOfferPopup> createState() => _ReviveOfferPopupState();
}

class _ReviveOfferPopupState extends State<ReviveOfferPopup> with SingleTickerProviderStateMixin {
  late final AnimationController _timer = AnimationController(vsync: this, duration: ReviveOfferPopup.countdown)
    ..addStatusListener((status) {
      if (status == AnimationStatus.completed && !_done) {
        _done = true;
        widget.onDecline();
      }
    });
  bool _done = false;

  @override
  void initState() {
    super.initState();
    if (!widget.paused) _timer.forward();
  }

  @override
  void didUpdateWidget(covariant ReviveOfferPopup oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.paused && _timer.isAnimating) {
      _timer.stop();
    } else if (!widget.paused && !_timer.isAnimating && !_done) {
      _timer.forward();
    }
  }

  @override
  void dispose() {
    _timer.dispose();
    super.dispose();
  }

  void _decline() {
    if (_done) return;
    _done = true;
    widget.onDecline();
  }

  @override
  Widget build(BuildContext context) {
    return GamePopup(
      title: 'Continue?',
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          SizedBox(
            width: 108,
            height: 108,
            child: AnimatedBuilder(
              animation: _timer,
              builder: (context, _) {
                final left = (ReviveOfferPopup.countdown.inSeconds * (1 - _timer.value)).ceil();
                return CustomPaint(
                  painter: _CountdownPainter(1 - _timer.value),
                  child: Center(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const SizedBox(width: 34, height: 30, child: CustomPaint(painter: _HeartPainter())),
                        Text('$left', style: numberStyle(26, weight: FontWeight.w800)),
                      ],
                    ),
                  ),
                );
              },
            ),
          ),
          const SizedBox(height: 10),
          Text(
            'Out of room! Revive to clear 4 lines\nand keep your score of ${widget.score}.',
            textAlign: TextAlign.center,
            style: bubbleStyle(17, weight: FontWeight.w500).copyWith(height: 1.25),
          ),
          const SizedBox(height: 18),
          if (widget.premium) ...[
            CandyButton(
              label: 'Revive',
              icon: Icons.favorite_rounded,
              width: double.infinity,
              height: 58,
              fontSize: 24,
              onTap: () {
                if (_done) return;
                _done = true;
                widget.onRevive();
              },
            ),
            const SizedBox(height: 8),
            Text(
              '${widget.revivesLeft} Premium revive${widget.revivesLeft == 1 ? '' : 's'} left this game',
              style: bubbleStyle(14, color: const Color(0xFFFFE58A), weight: FontWeight.w600),
            ),
          ] else ...[
            CandyButton(
              label: widget.adReady ? 'Watch Ad to Revive' : 'Loading ad…',
              icon: Icons.play_circle_fill_rounded,
              width: double.infinity,
              height: 58,
              fontSize: 21,
              enabled: widget.adReady,
              onTap: widget.onWatchAd,
            ),
            const SizedBox(height: 10),
            _PremiumLink(
              text: 'Premium: ${Allowance.premiumRevives} instant revives, no ads',
              onTap: widget.onPremium,
            ),
          ],
          const SizedBox(height: 6),
          TextButton(
            onPressed: _decline,
            style: TextButton.styleFrom(minimumSize: const Size(120, 44)),
            child: Text(
              'No thanks',
              style: bubbleStyle(17, color: const Color(0xFFD5E3FF), weight: FontWeight.w600),
            ),
          ),
        ],
      ),
    );
  }
}

class _CountdownPainter extends CustomPainter {
  _CountdownPainter(this.left);

  final double left;

  @override
  void paint(Canvas canvas, Size size) {
    final c = size.center(Offset.zero);
    final r = size.width / 2 - 6;
    canvas.drawCircle(c, r + 4, Paint()..color = const Color(0x33101C55));
    canvas.drawCircle(
      c,
      r,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 8
        ..color = const Color(0x40FFFFFF),
    );
    canvas.drawArc(
      Rect.fromCircle(center: c, radius: r),
      -math.pi / 2,
      math.pi * 2 * left,
      false,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 8
        ..strokeCap = StrokeCap.round
        ..color = Color.lerp(const Color(0xFFFF5A5A), const Color(0xFFFFC21F), left)!,
    );
  }

  @override
  bool shouldRepaint(covariant _CountdownPainter oldDelegate) => oldDelegate.left != left;
}

class _HeartPainter extends CustomPainter {
  const _HeartPainter();

  @override
  void paint(Canvas canvas, Size size) {
    final w = size.width, h = size.height;
    final heart = Path()
      ..moveTo(w * 0.5, h * 0.92)
      ..cubicTo(w * 0.1, h * 0.64, w * -0.02, h * 0.36, w * 0.2, h * 0.15)
      ..cubicTo(w * 0.34, h * 0.03, w * 0.47, h * 0.12, w * 0.5, h * 0.26)
      ..cubicTo(w * 0.53, h * 0.12, w * 0.66, h * 0.03, w * 0.8, h * 0.15)
      ..cubicTo(w * 1.02, h * 0.36, w * 0.9, h * 0.64, w * 0.5, h * 0.92)
      ..close();
    canvas.drawPath(heart.shift(Offset(0, h * 0.05)), Paint()..color = const Color(0xFF8C0A26));
    canvas.drawPath(
      heart,
      Paint()
        ..shader = LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: const [Color(0xFFFF8BA0), Color(0xFFE5173F)],
        ).createShader(Offset.zero & size),
    );
    canvas.drawCircle(Offset(w * 0.32, h * 0.32), w * 0.08, Paint()..color = const Color(0xAAFFFFFF));
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

/// Small gold "Premium" link used in upsell spots.
class _PremiumLink extends StatelessWidget {
  const _PremiumLink({required this.text, required this.onTap});

  final String text;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: text,
      excludeSemantics: true,
      onTap: onTap,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: onTap,
        child: Container(
          constraints: const BoxConstraints(minHeight: 44),
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
          decoration: BoxDecoration(
            color: const Color(0x33FFC21F),
            borderRadius: BorderRadius.circular(22),
            border: Border.all(color: const Color(0xAAFFC21F), width: 1.5),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              const SizedBox(width: 22, height: 17, child: CustomPaint(painter: _CrownPainter())),
              const SizedBox(width: 8),
              Flexible(
                child: Text(
                  text,
                  textAlign: TextAlign.center,
                  style: bubbleStyle(14, color: const Color(0xFFFFE58A), weight: FontWeight.w600),
                ),
              ),
            ],
          ),
        ),
      ),
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

class _BulbPainter extends CustomPainter {
  const _BulbPainter();

  @override
  void paint(Canvas canvas, Size size) => paintLightBulb(canvas, Offset.zero & size);

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

/// Shown when the player is out of hints.
class HintsUpsellPopup extends StatelessWidget {
  const HintsUpsellPopup({super.key, required this.premium, required this.onPremium, required this.onClose});

  final bool premium;
  final VoidCallback onPremium;
  final VoidCallback onClose;

  @override
  Widget build(BuildContext context) {
    return GamePopup(
      title: premium ? 'No Hints Left' : 'Need a Hint?',
      onClose: onClose,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const SizedBox(width: 72, height: 72, child: CustomPaint(painter: _BulbPainter())),
          const SizedBox(height: 10),
          Text(
            premium
                ? "You've used all ${Allowance.premiumHints} hints in this game.\nEvery new game brings ${Allowance.premiumHints} more."
                : "You've used your free hint for this game.\nPremium gives you ${Allowance.premiumHints} hints in every game.",
            textAlign: TextAlign.center,
            style: bubbleStyle(17, weight: FontWeight.w500).copyWith(height: 1.25),
          ),
          const SizedBox(height: 18),
          if (!premium) ...[
            CandyButton(
              label: 'Get Premium',
              leading: const CrownGlyph.onGold(),
              colors: CandyButton.gold,
              edge: CandyButton.goldEdge,
              width: double.infinity,
              height: 56,
              fontSize: 22,
              onTap: onPremium,
            ),
            const SizedBox(height: 12),
          ],
          CandyButton(
            label: premium ? 'OK' : 'Maybe Later',
            colors: CandyButton.blue,
            edge: CandyButton.blueEdge,
            width: double.infinity,
            height: 50,
            fontSize: 20,
            onTap: onClose,
          ),
        ],
      ),
    );
  }
}

/// Block skin picker. Premium skins open the Premium screen while locked.
class SkinPickerPopup extends StatelessWidget {
  const SkinPickerPopup({super.key, required this.onClose, required this.onPremium});

  final VoidCallback onClose;
  final VoidCallback onPremium;

  @override
  Widget build(BuildContext context) {
    final store = SettingsStore.instance;
    final premium = PremiumService.instance;
    return ListenableBuilder(
      listenable: Listenable.merge([store, premium]),
      builder: (context, _) {
        final chosen = BlockSkinInfo.fromId(store.skinId);
        final active = premium.canUseSkin(chosen.id) ? chosen : BlockSkin.classic;
        Widget tile(BlockSkin skin) => _SkinTile(
          skin: skin,
          selected: skin == active,
          locked: !premium.canUseSkin(skin.id),
          onTap: () {
            if (!premium.canUseSkin(skin.id)) {
              onPremium();
            } else {
              store.skinId = skin.id;
            }
          },
        );
        return GamePopup(
          title: 'Block Skins',
          onClose: onClose,
          width: 340,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Row(
                children: [
                  Expanded(child: tile(BlockSkin.classic)),
                  const SizedBox(width: 10),
                  Expanded(child: tile(BlockSkin.candy)),
                ],
              ),
              const SizedBox(height: 10),
              Row(
                children: [
                  Expanded(child: tile(BlockSkin.neon)),
                  const SizedBox(width: 10),
                  Expanded(child: tile(BlockSkin.gem)),
                ],
              ),
              const SizedBox(height: 14),
              if (premium.isPremium)
                Text(
                  'Tap a skin to use it.',
                  style: bubbleStyle(15, color: const Color(0xFFD5E3FF), weight: FontWeight.w500),
                )
              else
                CandyButton(
                  label: 'Unlock All Skins',
                  leading: const CrownGlyph.onGold(),
                  colors: CandyButton.gold,
                  edge: CandyButton.goldEdge,
                  width: double.infinity,
                  height: 54,
                  fontSize: 21,
                  onTap: onPremium,
                ),
            ],
          ),
        );
      },
    );
  }
}

class _SkinTile extends StatelessWidget {
  const _SkinTile({required this.skin, required this.selected, required this.locked, required this.onTap});

  final BlockSkin skin;
  final bool selected;
  final bool locked;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      selected: selected,
      label: '${skin.label} skin${locked ? ', Premium' : selected ? ', in use' : ''}',
      excludeSemantics: true,
      onTap: onTap,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 160),
          padding: const EdgeInsets.fromLTRB(8, 10, 8, 8),
          decoration: BoxDecoration(
            color: selected ? const Color(0x553FD15A) : const Color(0x33101C55),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(
              color: selected ? const Color(0xFF7BE35A) : const Color(0x558FB0FF),
              width: selected ? 2.5 : 1.5,
            ),
          ),
          child: Column(
            children: [
              SizedBox(
                width: 76,
                height: 58,
                child: CustomPaint(painter: _SkinPreviewPainter(skin, MediaQuery.devicePixelRatioOf(context))),
              ),
              const SizedBox(height: 6),
              Text(skin.label, style: bubbleStyle(17, weight: FontWeight.w700)),
              const SizedBox(height: 3),
              SizedBox(
                height: 20,
                child: locked
                    ? Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const SizedBox(width: 18, height: 14, child: CustomPaint(painter: _CrownPainter())),
                          const SizedBox(width: 4),
                          Text(
                            'Premium',
                            style: bubbleStyle(13.5, color: const Color(0xFFFFE58A), weight: FontWeight.w600),
                          ),
                        ],
                      )
                    : selected
                    ? Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(Icons.check_circle_rounded, size: 16, color: Color(0xFF9CF27E)),
                          const SizedBox(width: 4),
                          Text(
                            'In use',
                            style: bubbleStyle(13.5, color: const Color(0xFF9CF27E), weight: FontWeight.w600),
                          ),
                        ],
                      )
                    : Text(
                        'Tap to use',
                        style: bubbleStyle(13.5, color: const Color(0xFFD5E3FF), weight: FontWeight.w500),
                      ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// A small piece cluster drawn in [skin].
class _SkinPreviewPainter extends CustomPainter {
  _SkinPreviewPainter(this.skin, this.dpr);

  final BlockSkin skin;
  final double dpr;

  @override
  void paint(Canvas canvas, Size size) {
    final cell = size.height / 2.2;
    final px = cell * dpr;
    final left = (size.width - cell * 3) / 2;
    final top = (size.height - cell * 2) / 2;
    const cells = [
      (0, 0, 0),
      (0, 1, 2),
      (1, 1, 3),
      (1, 2, 4),
      (0, 2, 6),
    ];
    for (final (r, c, color) in cells) {
      drawBlock(canvas, Rect.fromLTWH(left + c * cell, top + r * cell, cell, cell), color, px, skin: skin);
    }
  }

  @override
  bool shouldRepaint(covariant _SkinPreviewPainter oldDelegate) => oldDelegate.skin != skin;
}

class _AppIconPainter extends CustomPainter {
  const _AppIconPainter(this.dpr);

  final double dpr;

  @override
  void paint(Canvas canvas, Size size) =>
      paintAppIcon(canvas, Offset.zero & size, spritePx: size.width / 4 * dpr);

  @override
  bool shouldRepaint(covariant _AppIconPainter oldDelegate) => oldDelegate.dpr != dpr;
}

/// About & credits.
class AboutPopup extends StatelessWidget {
  const AboutPopup({super.key, required this.onClose});

  final VoidCallback onClose;

  @override
  Widget build(BuildContext context) {
    final premium = PremiumService.instance;
    final ads = AdsService.instance;
    final plan = premium.activePlan;
    final credits = [
      'Fonts: Fredoka & Poppins (SIL Open Font License)',
      'Graphics, sounds and music made for this game',
      'Built with Flutter',
    ];
    return GamePopup(
      title: 'About',
      onClose: onClose,
      width: 340,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            children: [
              SizedBox(
                width: 64,
                height: 64,
                child: CustomPaint(painter: _AppIconPainter(MediaQuery.devicePixelRatioOf(context))),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Block Blast', style: bubbleStyle(25, weight: FontWeight.w700)),
                    const SizedBox(height: 4),
                    Text(
                      'Version $kAppVersion',
                      style: bubbleStyle(15, color: const Color(0xFFD5E3FF), weight: FontWeight.w500),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            decoration: BoxDecoration(
              gradient: const LinearGradient(colors: [Color(0x55FFC21F), Color(0x22FFC21F)]),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: const Color(0xCCFFC21F), width: 2),
            ),
            child: Row(
              children: [
                const SizedBox(width: 30, height: 23, child: CustomPaint(painter: _CrownPainter())),
                const SizedBox(width: 10),
                Expanded(
                  child: FittedBox(
                    fit: BoxFit.scaleDown,
                    alignment: Alignment.centerLeft,
                    child: Text(
                      'Game Creator: IMRAN',
                      style: bubbleStyle(21, color: const Color(0xFFFFF1C2), weight: FontWeight.w700),
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),
          Align(
            alignment: Alignment.centerLeft,
            child: Text('Credits', style: bubbleStyle(17, weight: FontWeight.w600)),
          ),
          const SizedBox(height: 4),
          for (final c in credits)
            Padding(
              padding: const EdgeInsets.only(top: 4),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('•  ', style: bubbleStyle(14.5, color: const Color(0xFFD5E3FF), weight: FontWeight.w500)),
                  Expanded(
                    child: Text(
                      c,
                      style: bubbleStyle(14.5, color: const Color(0xFFD5E3FF), weight: FontWeight.w500)
                          .copyWith(height: 1.2),
                    ),
                  ),
                ],
              ),
            ),
          const SizedBox(height: 12),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
            decoration: BoxDecoration(color: const Color(0x33101C55), borderRadius: BorderRadius.circular(12)),
            child: Text(
              premium.isPremium
                  ? 'Premium: active${plan != null ? ' (${plan.label} plan)' : ''}'
                  : 'Premium: not active',
              style: bubbleStyle(14.5, weight: FontWeight.w600),
            ),
          ),
          if (ads.privacyOptionsRequired && premium.showsAds) ...[
            const SizedBox(height: 12),
            CandyButton(
              label: 'Ad Privacy Settings',
              icon: Icons.privacy_tip_rounded,
              colors: CandyButton.blue,
              edge: CandyButton.blueEdge,
              width: double.infinity,
              height: 48,
              fontSize: 18,
              onTap: () => ads.showPrivacyOptions(),
            ),
          ],
          const SizedBox(height: 14),
          CandyButton(label: 'Close', width: double.infinity, height: 50, fontSize: 20, onTap: onClose),
        ],
      ),
    );
  }
}

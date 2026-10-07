import 'dart:async';
import 'dart:math' as math;
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../premium/plans.dart';
import '../premium/premium_service.dart';
import '../services/haptics.dart';
import '../services/sound.dart';
import '../ui/block_painter.dart';
import '../ui/fancy_text.dart';
import '../ui/icons.dart';
import '../ui/skins.dart';
import '../widgets/ui_kit.dart';

/// Colors of the Premium screen (deep blue with gold accents).
class _P {
  static const bgTop = Color(0xFF173A9A);
  static const bgBottom = Color(0xFF07154A);
  static const card = Color(0xFF1B3A93);
  static const cardBorder = Color(0xFF3563D6);
  static const selected = Color(0xFF2550C4);
  static const gold = Color(0xFFFFC21F);
  static const goldLight = Color(0xFFFFE58A);
  static const goldDark = Color(0xFF8A4B00);
  static const soft = Color(0xFFBFD2FF);
  static const faint = Color(0xFF93AEE8);
}

/// The Premium subscription screen ("paywall").
class PremiumScreen extends StatefulWidget {
  const PremiumScreen({super.key, this.source = 'home'});

  /// Where it was opened from (home, revive, hint, skins); logged only.
  final String source;

  @override
  State<PremiumScreen> createState() => _PremiumScreenState();
}

class _PremiumScreenState extends State<PremiumScreen> with SingleTickerProviderStateMixin {
  final PremiumService _premium = PremiumService.instance;
  late PremiumPlan _selected = _premium.activePlan ?? PremiumPlan.yearly;
  late final AnimationController _intro = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 900),
  )..forward();

  PremiumNotice? _toast;
  Timer? _toastTimer;
  bool _wasPremium = false;

  @override
  void initState() {
    super.initState();
    debugPrint('BB_PREMIUM open source=${widget.source}');
    _wasPremium = _premium.isPremium;
    _premium.addListener(_changed);
    _premium.notice.addListener(_onNotice);
    if (_premium.storeAvailable && !_premium.hasStorePrices) {
      unawaited(_premium.refreshProducts());
    }
  }

  @override
  void dispose() {
    _premium.removeListener(_changed);
    _premium.notice.removeListener(_onNotice);
    _toastTimer?.cancel();
    _intro.dispose();
    super.dispose();
  }

  void _changed() {
    if (!mounted) return;
    if (!_wasPremium && _premium.isPremium) {
      _intro.forward(from: 0.35);
      Haptics.medium();
      Sound.instance.play(Sfx.newBest, volume: 0.8);
    }
    _wasPremium = _premium.isPremium;
    setState(() {});
  }

  void _onNotice() {
    final n = _premium.notice.value;
    if (n == null || !mounted) return;
    _toastTimer?.cancel();
    setState(() => _toast = n);
    _toastTimer = Timer(Duration(milliseconds: 3200 + n.text.length * 30), () {
      if (mounted) setState(() => _toast = null);
    });
  }

  void _select(PremiumPlan plan) {
    if (_selected == plan) return;
    Haptics.tick();
    Sound.instance.play(Sfx.click, volume: 0.7);
    setState(() => _selected = plan);
  }

  void _close() => Navigator.of(context).maybePop();

  // ---------------------------------------------------------------------------

  @override
  Widget build(BuildContext context) {
    final size = MediaQuery.sizeOf(context);
    // Most phones are 740-800dp tall once the system bars are taken off.
    final compact = size.height < 800;
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: const SystemUiOverlayStyle(
        statusBarColor: Color(0x00000000),
        statusBarIconBrightness: Brightness.light,
        statusBarBrightness: Brightness.dark,
        systemNavigationBarColor: _P.bgBottom,
        systemNavigationBarIconBrightness: Brightness.light,
      ),
      child: Scaffold(
        backgroundColor: _P.bgBottom,
        body: Stack(
          children: [
            Positioned.fill(
              child: CustomPaint(painter: _BackdropPainter(MediaQuery.devicePixelRatioOf(context))),
            ),
            SafeArea(
              child: Center(
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 520),
                  child: Column(
                    children: [
                      Expanded(
                        child: SingleChildScrollView(
                          padding: const EdgeInsets.fromLTRB(16, 4, 16, 12),
                          child: Column(
                            children: [
                              _stagger(0, _header(compact)),
                              SizedBox(height: compact ? 12 : 16),
                              _stagger(1, _benefits(compact)),
                              SizedBox(height: compact ? 12 : 16),
                              _stagger(2, _plans()),
                              const SizedBox(height: 18),
                              _stagger(3, _terms()),
                            ],
                          ),
                        ),
                      ),
                      _purchaseBar(),
                    ],
                  ),
                ),
              ),
            ),
            Positioned(
              top: MediaQuery.paddingOf(context).top + 2,
              right: 6,
              child: _closeButton(),
            ),
            if (_toast != null) _toastView(_toast!),
          ],
        ),
      ),
    );
  }

  /// Fade + rise of section [i] during the intro.
  Widget _stagger(int i, Widget child) {
    final start = (i * 0.12).clamp(0.0, 0.6);
    final anim = CurvedAnimation(parent: _intro, curve: Interval(start, start + 0.45, curve: Curves.easeOutCubic));
    return AnimatedBuilder(
      animation: anim,
      builder: (context, child) => Opacity(
        opacity: anim.value,
        child: Transform.translate(offset: Offset(0, 18 * (1 - anim.value)), child: child),
      ),
      child: child,
    );
  }

  Widget _closeButton() {
    return Semantics(
      button: true,
      label: 'Close',
      excludeSemantics: true,
      onTap: _close,
      child: InkResponse(
        onTap: () {
          Sound.instance.play(Sfx.click);
          _close();
        },
        radius: 26,
        child: Container(
          width: 52,
          height: 52,
          alignment: Alignment.center,
          child: Container(
            width: 38,
            height: 38,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: const Color(0x66081A55),
              border: Border.all(color: Colors.white.withValues(alpha: 0.55), width: 1.5),
            ),
            child: const Icon(Icons.close_rounded, color: Colors.white, size: 24),
          ),
        ),
      ),
    );
  }

  Widget _header(bool compact) {
    final active = _premium.isPremium;
    final plan = _premium.activePlan;
    final crownW = compact ? 50.0 : 62.0;
    return Column(
      children: [
        AnimatedBuilder(
          animation: _intro,
          builder: (context, child) {
            final t = Curves.elasticOut.transform(_intro.value.clamp(0.0, 1.0));
            return Transform.scale(scale: 0.6 + 0.4 * t, child: child);
          },
          child: SizedBox(
            width: crownW * 1.9,
            height: crownW * 0.95,
            child: CustomPaint(painter: _GlowCrownPainter()),
          ),
        ),
        const SizedBox(height: 4),
        const _PremiumPill(),
        SizedBox(height: compact ? 8 : 12),
        Text(
          active ? "You're Premium!" : 'Unlock a Better\nBlock Blast Experience',
          textAlign: TextAlign.center,
          style: bubbleStyle(compact ? 22 : 25, weight: FontWeight.w700).copyWith(
            height: 1.15,
            shadows: const [Shadow(color: Color(0x80061033), offset: Offset(0, 2), blurRadius: 4)],
          ),
        ),
        if (active) ...[
          const SizedBox(height: 6),
          Text(
            plan != null
                ? '${plan.label} plan · ${_premium.entitlement!.autoRenewing ? 'renews automatically' : 'canceled, active until the period ends'}'
                : 'All Premium benefits are unlocked.',
            textAlign: TextAlign.center,
            style: bubbleStyle(14.5, color: _P.soft, weight: FontWeight.w500).copyWith(height: 1.25),
          ),
        ],
      ],
    );
  }

  Widget _benefits(bool compact) {
    const items = [
      (_BenefitIcon.noAds, 'No Ads', 'Uninterrupted gameplay', 'Ad-free'),
      (_BenefitIcon.revives, 'More Revives', 'Additional chances to continue', '${Allowance.premiumRevives} per game'),
      (_BenefitIcon.hints, 'Hint Boosts', 'Help with difficult moves', '${Allowance.premiumHints} per game'),
      (_BenefitIcon.skins, 'Exclusive Skins', 'Premium block designs', '3 designs'),
    ];
    Widget card(int i) {
      final it = items[i];
      return _BenefitCard(icon: it.$1, title: it.$2, body: it.$3, chip: it.$4, compact: compact);
    }

    return Column(
      children: [
        IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [Expanded(child: card(0)), const SizedBox(width: 10), Expanded(child: card(1))],
          ),
        ),
        const SizedBox(height: 4),
        IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [Expanded(child: card(2)), const SizedBox(width: 10), Expanded(child: card(3))],
          ),
        ),
      ],
    );
  }

  Widget _plans() {
    final yearly = _premium.offerFor(PremiumPlan.yearly);
    final monthly = _premium.offerFor(PremiumPlan.monthly);
    final weekly = _premium.offerFor(PremiumPlan.weekly);
    final month = BillingPeriod.parse('P1M');

    String? yearlyNote() {
      final save = PlanMath.savingsPercent(yearly, monthly);
      final perMonth = PlanMath.formatMicros(PlanMath.equivalentMicros(yearly, month), yearly.currencyCode);
      return save != null ? 'Save $save% vs monthly · $perMonth/month' : '$perMonth/month';
    }

    String? monthlyNote() {
      final save = PlanMath.savingsPercent(monthly, weekly);
      return save != null ? 'Save $save% vs weekly' : null;
    }

    String? weeklyNote() {
      final save = PlanMath.savingsPercent(weekly, monthly);
      return save != null ? 'Save $save% vs monthly' : 'Most flexible';
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            Text('Choose your plan', style: bubbleStyle(18, weight: FontWeight.w600)),
            const Spacer(),
            if (_premium.loadingProducts || !_premium.storeChecked)
              const SizedBox(
                width: 16,
                height: 16,
                child: CircularProgressIndicator(strokeWidth: 2, color: _P.goldLight),
              ),
          ],
        ),
        const SizedBox(height: 10),
        _PlanCard(
          offer: yearly,
          note: yearlyNote(),
          selected: _selected == PremiumPlan.yearly,
          current: _premium.activePlan == PremiumPlan.yearly,
          badge: 'BEST VALUE',
          onTap: () => _select(PremiumPlan.yearly),
        ),
        const SizedBox(height: 10),
        _PlanCard(
          offer: monthly,
          note: monthlyNote(),
          selected: _selected == PremiumPlan.monthly,
          current: _premium.activePlan == PremiumPlan.monthly,
          onTap: () => _select(PremiumPlan.monthly),
        ),
        const SizedBox(height: 10),
        _PlanCard(
          offer: weekly,
          note: weeklyNote(),
          selected: _selected == PremiumPlan.weekly,
          current: _premium.activePlan == PremiumPlan.weekly,
          onTap: () => _select(PremiumPlan.weekly),
        ),
        if (!_premium.hasStorePrices && !_premium.preview) ...[
          const SizedBox(height: 10),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Padding(
                padding: EdgeInsets.only(top: 1),
                child: Icon(Icons.info_outline_rounded, size: 16, color: _P.faint),
              ),
              const SizedBox(width: 6),
              Expanded(
                child: Text(
                  !_premium.storeChecked || _premium.loadingProducts
                      ? 'Connecting to Google Play…'
                      : _premium.storeAvailable
                      ? "Plans aren't available from Google Play yet, so prices are shown in USD."
                      : 'Google Play is not available on this device, so prices are shown in USD and purchases are turned off.',
                  style: bubbleStyle(12.5, color: _P.faint, weight: FontWeight.w500).copyWith(height: 1.25),
                ),
              ),
            ],
          ),
        ],
        if (_premium.paymentPending) ...[
          const SizedBox(height: 10),
          _InfoStrip(
            icon: Icons.hourglass_top_rounded,
            text: 'Payment pending. Premium unlocks as soon as Google Play confirms your payment.',
          ),
        ],
      ],
    );
  }

  Widget _terms() {
    final offer = _premium.offerFor(_selected);
    final lines = [
      'Payment is charged to your Google Play account when you confirm the purchase.',
      'Your subscription renews automatically at ${offer.perPeriodText} until you cancel.',
      'Cancel anytime in Google Play › Payments & subscriptions › Subscriptions. Premium stays active until the end of the period you have paid for.',
      'Changing plans takes effect right away; Google Play credits the unused time of your current plan.',
      'Premium removes all ads and gives ${Allowance.premiumRevives} revives and ${Allowance.premiumHints} hints in every game plus every block skin.',
    ];
    return Container(
      padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
      decoration: BoxDecoration(
        color: const Color(0x33081A55),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0x333D6BE0)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Subscription details', style: bubbleStyle(14, color: _P.soft, weight: FontWeight.w600)),
          const SizedBox(height: 6),
          for (final l in lines)
            Padding(
              padding: const EdgeInsets.only(top: 4),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('•  ', style: bubbleStyle(12.5, color: _P.faint, weight: FontWeight.w500)),
                  Expanded(
                    child: Text(
                      l,
                      style: bubbleStyle(12.5, color: _P.faint, weight: FontWeight.w500).copyWith(height: 1.3),
                    ),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }

  Widget _purchaseBar() {
    final offer = _premium.offerFor(_selected);
    final active = _premium.isPremium;
    // Preview builds are Premium without a store plan: treat as current.
    final current = active && (_premium.activePlan == _selected || _premium.activePlan == null);
    final busy = _premium.purchasing;
    String label;
    if (busy) {
      label = 'Opening Google Play…';
    } else if (current) {
      label = 'Premium Active';
    } else if (active) {
      label = 'Switch to ${_selected.label}';
    } else {
      label = 'Start Premium';
    }
    final canTap = !busy && !current;
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 6),
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [Color(0xF00A1C5E), Color(0xFF07154A)],
        ),
        border: Border(top: BorderSide(color: Color(0x553D6BE0))),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            children: [
              Expanded(
                flex: 4,
                child: Semantics(
                  label: '${offer.priceText}, billed ${offer.period.adverb}',
                  excludeSemantics: true,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      FittedBox(
                        fit: BoxFit.scaleDown,
                        alignment: Alignment.centerLeft,
                        child: Text(
                          offer.priceText,
                          key: const ValueKey('charge-price'),
                          style: numberStyle(24, weight: FontWeight.w800),
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        'billed ${offer.period.adverb}',
                        key: const ValueKey('charge-period'),
                        style: bubbleStyle(13.5, color: _P.goldLight, weight: FontWeight.w600),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                flex: 6,
                child: CandyButton(
                  label: label,
                  colors: current ? CandyButton.green : CandyButton.gold,
                  edge: current ? CandyButton.greenEdge : CandyButton.goldEdge,
                  leading: busy
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(strokeWidth: 2.5, color: Colors.white),
                        )
                      : current
                      ? const Icon(Icons.check_circle_rounded, color: Colors.white, size: 24)
                      : const CrownGlyph.onGold(width: 30),
                  enabled: canTap || current,
                  height: 54,
                  fontSize: 20,
                  onTap: () {
                    if (!canTap) return;
                    _premium.buy(_selected);
                  },
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          FittedBox(
            fit: BoxFit.scaleDown,
            child: Text(
              'Auto-renews at ${offer.perPeriodText}. Cancel anytime in Google Play.',
              maxLines: 1,
              style: bubbleStyle(12, color: _P.faint, weight: FontWeight.w500),
            ),
          ),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Flexible(
                child: _LinkButton(
                  label: _premium.restoring ? 'Restoring…' : 'Restore Purchases',
                  onTap: _premium.restoring ? null : () => _premium.restore(),
                ),
              ),
              Container(width: 1, height: 14, color: const Color(0x553D6BE0)),
              Flexible(
                child: _LinkButton(label: 'Manage Subscription', onTap: () => _premium.openManage()),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _toastView(PremiumNotice n) {
    final color = switch (n.kind) {
      NoticeKind.success => const Color(0xFF2E9E3A),
      NoticeKind.info => const Color(0xFF2F6BE0),
      NoticeKind.error => const Color(0xFFD23B3B),
    };
    final icon = switch (n.kind) {
      NoticeKind.success => Icons.check_circle_rounded,
      NoticeKind.info => Icons.info_rounded,
      NoticeKind.error => Icons.error_rounded,
    };
    return Positioned(
      left: 16,
      right: 16,
      top: MediaQuery.paddingOf(context).top + 60,
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 488),
          child: TweenAnimationBuilder<double>(
            key: ValueKey(n.id),
            tween: Tween(begin: 0, end: 1),
            duration: const Duration(milliseconds: 260),
            curve: Curves.easeOutBack,
            builder: (context, t, child) => Transform.translate(
              offset: Offset(0, -12 * (1 - t)),
              child: Opacity(opacity: t.clamp(0.0, 1.0), child: child),
            ),
            child: GestureDetector(
              onTap: () => setState(() => _toast = null),
              child: Semantics(
                liveRegion: true,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                  decoration: BoxDecoration(
                    color: color,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: Colors.white.withValues(alpha: 0.35), width: 1.5),
                    boxShadow: const [BoxShadow(color: Color(0x66000000), offset: Offset(0, 4), blurRadius: 12)],
                  ),
                  child: Row(
                    children: [
                      Icon(icon, color: Colors.white, size: 22),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          n.text,
                          style: bubbleStyle(14.5, weight: FontWeight.w500).copyWith(height: 1.25),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

// -----------------------------------------------------------------------------
// Pieces
// -----------------------------------------------------------------------------

class _PremiumPill extends StatelessWidget {
  const _PremiumPill();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 6),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [_P.goldLight, _P.gold, Color(0xFFF59E0B)],
          stops: [0, 0.55, 1],
        ),
        borderRadius: BorderRadius.circular(30),
        border: Border.all(color: const Color(0xFFFFF4C2), width: 1.5),
        boxShadow: const [
          BoxShadow(color: Color(0xFFA85F00), offset: Offset(0, 3)),
          BoxShadow(color: Color(0x66FFC21F), blurRadius: 18),
        ],
      ),
      child: Text(
        'PREMIUM',
        style: bubbleStyle(17, color: _P.goldDark, weight: FontWeight.w700).copyWith(letterSpacing: 3.5),
      ),
    );
  }
}

enum _BenefitIcon { noAds, revives, hints, skins }

class _BenefitCard extends StatelessWidget {
  const _BenefitCard({
    required this.icon,
    required this.title,
    required this.body,
    required this.chip,
    required this.compact,
  });

  final _BenefitIcon icon;
  final String title;
  final String body;
  final String chip;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final iconSize = compact ? 34.0 : 38.0;
    return Padding(
      // Room for the corner chip.
      padding: const EdgeInsets.only(top: 8),
      child: Stack(
        fit: StackFit.passthrough,
        clipBehavior: Clip.none,
        children: [
          Container(
            padding: EdgeInsets.fromLTRB(10, compact ? 11 : 13, 10, compact ? 9 : 11),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [Color(0xFF2A52BF), _P.card],
              ),
              borderRadius: BorderRadius.circular(18),
              border: Border.all(color: _P.cardBorder.withValues(alpha: 0.75), width: 1.5),
              boxShadow: const [BoxShadow(color: Color(0x44000A30), offset: Offset(0, 4), blurRadius: 8)],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      width: iconSize,
                      height: iconSize,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        gradient: const RadialGradient(colors: [Color(0xFF3F6CE0), Color(0xFF16307D)]),
                        border: Border.all(color: _P.gold.withValues(alpha: 0.85), width: 1.5),
                      ),
                      padding: EdgeInsets.all(iconSize * 0.17),
                      child: CustomPaint(painter: _BenefitIconPainter(icon, MediaQuery.devicePixelRatioOf(context))),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        title,
                        maxLines: 2,
                        style: bubbleStyle(compact ? 14.5 : 15.5, weight: FontWeight.w700).copyWith(height: 1.08),
                      ),
                    ),
                  ],
                ),
                SizedBox(height: compact ? 5 : 7),
                Text(body, style: bubbleStyle(12.5, color: _P.soft, weight: FontWeight.w500).copyWith(height: 1.2)),
              ],
            ),
          ),
          Positioned(
            top: -8,
            right: 10,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
              decoration: BoxDecoration(
                gradient: const LinearGradient(colors: [_P.goldLight, _P.gold]),
                borderRadius: BorderRadius.circular(9),
                boxShadow: const [BoxShadow(color: Color(0xFFA85F00), offset: Offset(0, 1.5))],
              ),
              child: Text(chip, style: bubbleStyle(10.5, color: _P.goldDark, weight: FontWeight.w700)),
            ),
          ),
        ],
      ),
    );
  }
}

class _PlanCard extends StatelessWidget {
  const _PlanCard({
    required this.offer,
    required this.selected,
    required this.current,
    required this.onTap,
    this.note,
    this.badge,
  });

  final PlanOffer offer;
  final bool selected;
  final bool current;
  final VoidCallback onTap;
  final String? note;
  final String? badge;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      selected: selected,
      inMutuallyExclusiveGroup: true,
      label:
          '${offer.plan.label} plan, ${offer.perPeriodText}${note != null ? ', $note' : ''}${badge != null ? ', $badge' : ''}${current ? ', current plan' : ''}',
      excludeSemantics: true,
      onTap: onTap,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: onTap,
        child: AnimatedScale(
          scale: selected ? 1.0 : 0.975,
          duration: const Duration(milliseconds: 160),
          curve: Curves.easeOut,
          child: Stack(
            clipBehavior: Clip.none,
            children: [
              AnimatedContainer(
                duration: const Duration(milliseconds: 180),
                curve: Curves.easeOut,
                padding: EdgeInsets.fromLTRB(14, badge != null ? 16 : 13, 14, 13),
                decoration: BoxDecoration(
                  color: selected ? _P.selected : _P.card,
                  borderRadius: BorderRadius.circular(18),
                  border: Border.all(
                    color: selected ? _P.gold : _P.cardBorder.withValues(alpha: 0.6),
                    width: selected ? 2.5 : 1.5,
                  ),
                  boxShadow: [
                    if (selected) BoxShadow(color: _P.gold.withValues(alpha: 0.35), blurRadius: 16),
                    const BoxShadow(color: Color(0x44000A30), offset: Offset(0, 3), blurRadius: 6),
                  ],
                ),
                child: Row(
                  children: [
                    _Radio(selected: selected),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Row(
                            children: [
                              Text(offer.plan.label, style: bubbleStyle(18.5, weight: FontWeight.w700)),
                              if (current) ...[
                                const SizedBox(width: 8),
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                                  decoration: BoxDecoration(
                                    color: const Color(0xFF35B32B),
                                    borderRadius: BorderRadius.circular(8),
                                  ),
                                  child: Text('CURRENT', style: bubbleStyle(10.5, weight: FontWeight.w700)),
                                ),
                              ],
                            ],
                          ),
                          if (note != null) ...[
                            const SizedBox(height: 3),
                            // One line on every width (scaled down if needed).
                            FittedBox(
                              fit: BoxFit.scaleDown,
                              alignment: Alignment.centerLeft,
                              child: Text(
                                note!,
                                maxLines: 1,
                                style: bubbleStyle(
                                  12.5,
                                  color: selected ? _P.goldLight : _P.soft,
                                  weight: FontWeight.w600,
                                ),
                              ),
                            ),
                          ],
                        ],
                      ),
                    ),
                    const SizedBox(width: 8),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(offer.priceText, style: numberStyle(19, weight: FontWeight.w800)),
                        Text(
                          'per ${offer.period.noun}',
                          style: bubbleStyle(12, color: _P.soft, weight: FontWeight.w500),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              if (badge != null)
                Positioned(
                  top: -10,
                  right: 16,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(colors: [_P.goldLight, _P.gold]),
                      borderRadius: BorderRadius.circular(10),
                      boxShadow: const [BoxShadow(color: Color(0xFFA85F00), offset: Offset(0, 2))],
                    ),
                    child: Text(
                      badge!,
                      style: bubbleStyle(11.5, color: _P.goldDark, weight: FontWeight.w700).copyWith(letterSpacing: 1),
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _Radio extends StatelessWidget {
  const _Radio({required this.selected});

  final bool selected;

  @override
  Widget build(BuildContext context) {
    return AnimatedContainer(
      duration: const Duration(milliseconds: 160),
      width: 26,
      height: 26,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: selected ? _P.gold : Colors.transparent,
        border: Border.all(color: selected ? _P.goldLight : _P.faint, width: 2.2),
      ),
      child: selected ? const Icon(Icons.check_rounded, size: 18, color: _P.goldDark) : null,
    );
  }
}

class _InfoStrip extends StatelessWidget {
  const _InfoStrip({required this.icon, required this.text});

  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: const Color(0x332F6BE0),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0x663D6BE0)),
      ),
      child: Row(
        children: [
          Icon(icon, size: 18, color: _P.goldLight),
          const SizedBox(width: 8),
          Expanded(
            child: Text(text, style: bubbleStyle(12.5, color: _P.soft, weight: FontWeight.w500)),
          ),
        ],
      ),
    );
  }
}

class _LinkButton extends StatelessWidget {
  const _LinkButton({required this.label, required this.onTap});

  final String label;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      enabled: onTap != null,
      label: label,
      excludeSemantics: true,
      onTap: onTap,
      child: InkWell(
        borderRadius: BorderRadius.circular(10),
        onTap: onTap == null
            ? null
            : () {
                Sound.instance.play(Sfx.click);
                onTap!();
              },
        child: ConstrainedBox(
          constraints: const BoxConstraints(minHeight: 44),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 10),
            child: Center(
              widthFactor: 1,
              child: FittedBox(
                fit: BoxFit.scaleDown,
                child: Text(
                  label,
                  style: bubbleStyle(13.5, color: _P.soft, weight: FontWeight.w600).copyWith(
                    decoration: TextDecoration.underline,
                    decorationColor: _P.soft.withValues(alpha: 0.6),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

// -----------------------------------------------------------------------------
// Painters
// -----------------------------------------------------------------------------

/// Big crown with a golden halo and sparkles.
class _GlowCrownPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final c = size.center(Offset.zero);
    final crownW = size.height * 1.05;
    canvas.drawCircle(
      c,
      size.height * 0.62,
      Paint()
        ..shader = ui.Gradient.radial(c, size.height * 0.62, const [Color(0x88FFD54A), Color(0x00FFD54A)]),
    );
    final rect = Rect.fromCenter(center: c + Offset(0, size.height * 0.02), width: crownW, height: crownW * 0.74);
    paintCrown(canvas, rect);
    // Gems on the band.
    final band = rect.top + rect.height * 0.885;
    for (final (dx, color) in [(-0.22, const Color(0xFFFF3B5C)), (0.0, const Color(0xFF3FA9FF)), (0.22, const Color(0xFF39D353))]) {
      canvas.drawCircle(Offset(c.dx + rect.width * dx, band), rect.width * 0.045, Paint()..color = color);
    }
    _sparkle(canvas, Offset(size.width * 0.16, size.height * 0.3), size.height * 0.1);
    _sparkle(canvas, Offset(size.width * 0.86, size.height * 0.2), size.height * 0.13);
    _sparkle(canvas, Offset(size.width * 0.78, size.height * 0.82), size.height * 0.07);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

void _sparkle(Canvas canvas, Offset c, double s, {Color color = const Color(0xFFFFF3C4)}) {
  canvas.drawPath(
    Path()
      ..moveTo(c.dx, c.dy - s)
      ..quadraticBezierTo(c.dx, c.dy, c.dx + s, c.dy)
      ..quadraticBezierTo(c.dx, c.dy, c.dx, c.dy + s)
      ..quadraticBezierTo(c.dx, c.dy, c.dx - s, c.dy)
      ..quadraticBezierTo(c.dx, c.dy, c.dx, c.dy - s)
      ..close(),
    Paint()..color = color,
  );
}

class _BenefitIconPainter extends CustomPainter {
  _BenefitIconPainter(this.icon, this.dpr);

  final _BenefitIcon icon;
  final double dpr;

  @override
  void paint(Canvas canvas, Size size) {
    final r = Offset.zero & size;
    switch (icon) {
      case _BenefitIcon.noAds:
        final box = RRect.fromRectAndRadius(r.deflate(size.width * 0.1), Radius.circular(size.width * 0.16));
        canvas.drawRRect(box, Paint()..color = Colors.white);
        final tp = TextPainter(
          text: TextSpan(
            text: 'AD',
            style: numberStyle(size.width * 0.38, color: const Color(0xFF1B3A93), weight: FontWeight.w800),
          ),
          textDirection: TextDirection.ltr,
        )..layout();
        tp.paint(canvas, r.center - Offset(tp.width / 2, tp.height / 2));
        final slash = Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = size.width * 0.1
          ..color = const Color(0xFFFF3B4E);
        canvas.drawCircle(r.center, size.width * 0.47, slash);
        canvas.drawLine(
          r.center + Offset(-size.width * 0.33, -size.width * 0.33),
          r.center + Offset(size.width * 0.33, size.width * 0.33),
          slash..strokeCap = StrokeCap.round,
        );
      case _BenefitIcon.revives:
        final w = size.width, h = size.height;
        final heart = Path()
          ..moveTo(w * 0.5, h * 0.88)
          ..cubicTo(w * 0.1, h * 0.62, w * -0.02, h * 0.36, w * 0.2, h * 0.17)
          ..cubicTo(w * 0.34, h * 0.06, w * 0.47, h * 0.14, w * 0.5, h * 0.27)
          ..cubicTo(w * 0.53, h * 0.14, w * 0.66, h * 0.06, w * 0.8, h * 0.17)
          ..cubicTo(w * 1.02, h * 0.36, w * 0.9, h * 0.62, w * 0.5, h * 0.88)
          ..close();
        canvas.drawPath(heart.shift(Offset(0, h * 0.04)), Paint()..color = const Color(0xFF8C0A26));
        canvas.drawPath(
          heart,
          Paint()
            ..shader = ui.Gradient.linear(r.topCenter, r.bottomCenter, const [Color(0xFFFF8BA0), Color(0xFFE5173F)]),
        );
        final plus = Paint()
          ..color = Colors.white
          ..strokeWidth = w * 0.11
          ..strokeCap = StrokeCap.round;
        canvas.drawLine(Offset(w * 0.5, h * 0.36), Offset(w * 0.5, h * 0.64), plus);
        canvas.drawLine(Offset(w * 0.36, h * 0.5), Offset(w * 0.64, h * 0.5), plus);
      case _BenefitIcon.hints:
        paintLightBulb(canvas, r.inflate(size.width * 0.06));
      case _BenefitIcon.skins:
        final cell = size.width / 2;
        final px = cell * dpr;
        const looks = [
          (BlockSkin.candy, 0),
          (BlockSkin.neon, 4),
          (BlockSkin.gem, 6),
          (BlockSkin.candy, 3),
        ];
        for (var i = 0; i < 4; i++) {
          final rect = Rect.fromLTWH((i % 2) * cell, (i ~/ 2) * cell, cell, cell);
          drawBlock(canvas, rect, looks[i].$2, px, skin: looks[i].$1);
        }
    }
  }

  @override
  bool shouldRepaint(covariant _BenefitIconPainter oldDelegate) => oldDelegate.icon != icon;
}

/// Deep blue gradient with a few floating blocks and sparkles.
class _BackdropPainter extends CustomPainter {
  _BackdropPainter(this.dpr);

  final double dpr;

  @override
  void paint(Canvas canvas, Size size) {
    final r = Offset.zero & size;
    canvas.drawRect(
      r,
      Paint()
        ..shader = ui.Gradient.linear(r.topCenter, r.bottomCenter, const [_P.bgTop, Color(0xFF0D2470), _P.bgBottom], const [
          0,
          0.45,
          1,
        ]),
    );
    canvas.drawCircle(
      Offset(size.width / 2, size.height * 0.12),
      size.width * 0.75,
      Paint()
        ..shader = ui.Gradient.radial(
          Offset(size.width / 2, size.height * 0.12),
          size.width * 0.75,
          const [Color(0x553C7BFF), Color(0x003C7BFF)],
        ),
    );
    final cell = size.width * 0.085;
    final px = cell * dpr;
    final rng = math.Random(11);
    // Clusters of blocks peeking in from the edges.
    final clusters = <(Offset, double, int, List<List<int>>)>[
      (Offset(-cell * 0.4, size.height * 0.08), -0.25, 1, const [
        [0, 0],
        [0, 1],
        [1, 0],
      ]),
      (Offset(size.width - cell * 1.6, size.height * 0.03), 0.2, 4, const [
        [0, 0],
        [1, 0],
        [1, 1],
      ]),
      (Offset(-cell * 0.6, size.height * 0.46), 0.15, 6, const [
        [0, 0],
        [1, 0],
      ]),
      (Offset(size.width - cell * 1.1, size.height * 0.38), -0.2, 3, const [
        [0, 0],
        [0, 1],
        [1, 1],
      ]),
    ];
    for (final (origin, rot, color, cells) in clusters) {
      canvas.save();
      canvas.translate(origin.dx + cell, origin.dy + cell);
      canvas.rotate(rot);
      for (final rc in cells) {
        drawBlock(
          canvas,
          Rect.fromLTWH((rc[1] - 1) * cell, (rc[0] - 1) * cell, cell, cell),
          color,
          px,
          opacity: 0.55,
          skin: BlockSkin.classic,
        );
      }
      canvas.restore();
    }
    for (var i = 0; i < 18; i++) {
      final p = Offset(rng.nextDouble() * size.width, rng.nextDouble() * size.height * 0.75);
      final s = 1.5 + rng.nextDouble() * 3.5;
      _sparkle(canvas, p, s, color: Color.fromRGBO(255, 240, 200, 0.25 + rng.nextDouble() * 0.45));
    }
  }

  @override
  bool shouldRepaint(covariant _BackdropPainter oldDelegate) => oldDelegate.dpr != dpr;
}

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter/scheduler.dart';

import '../logic/game.dart';
import '../premium/premium_service.dart';
import '../screens/home_screen.dart';
import '../screens/premium_screen.dart';
import '../screens/transitions.dart';
import '../services/ads_service.dart';
import '../services/settings_store.dart';
import '../services/sound.dart';
import '../ui/palette.dart';
import '../widgets/popups.dart';
import '../widgets/premium_popups.dart';
import 'game_controller.dart';
import 'game_painter.dart';
import 'layout.dart';

class GameScreen extends StatefulWidget {
  const GameScreen({super.key, this.startNew = false, this.initialGame});

  final bool startNew;

  /// Optional explicit starting state (used by tests).
  final GameState? initialGame;

  @override
  State<GameScreen> createState() => _GameScreenState();
}

class _GameScreenState extends State<GameScreen> with SingleTickerProviderStateMixin, WidgetsBindingObserver {
  late final GameController ctrl;
  late final Ticker _ticker;
  Duration _last = Duration.zero;

  bool _showSettings = false;
  bool _showHowTo = false;
  bool _showSkins = false;
  bool _showAbout = false;
  bool _showHintUpsell = false;
  bool _showRevive = false;
  bool _showGameOver = false;
  bool _gameOverWasBest = false;
  int _gameOverScore = 0;

  /// A rewarded ad or the Premium screen is covering the game.
  bool _adShowing = false;
  bool _premiumOpen = false;

  int? _pointer;
  bool _gearDown = false;
  bool _hintDown = false;

  @override
  void initState() {
    super.initState();
    Sound.instance.init();
    ctrl = GameController(restored: widget.initialGame);
    if (widget.startNew) ctrl.newGame();
    ctrl.onShowGameOver = _onGameOver;
    ctrl.onShowRevive = _onReviveOffer;
    _ticker = createTicker(_onTick)..start();
    // The ticker only runs while something moves; any change wakes it up.
    ctrl.addListener(_wake);
    PremiumService.instance.addListener(_servicesChanged);
    AdsService.instance.addListener(_servicesChanged);
    WidgetsBinding.instance.addObserver(this);
    AdsService.instance.start();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    PremiumService.instance.removeListener(_servicesChanged);
    AdsService.instance.removeListener(_servicesChanged);
    ctrl.saveNow();
    ctrl.removeListener(_wake);
    _ticker.dispose();
    ctrl.dispose();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.paused || state == AppLifecycleState.inactive || state == AppLifecycleState.hidden) {
      ctrl.saveNow();
      Sound.instance.setForeground(false);
    } else if (state == AppLifecycleState.resumed) {
      Sound.instance.setForeground(true);
    }
  }

  /// Premium status or ad availability changed: hint counts, banner space
  /// and the revive offer depend on them.
  void _servicesChanged() {
    if (!mounted) return;
    setState(() {});
    ctrl.refresh();
  }

  int _idleTicks = 0;

  void _wake() {
    _idleTicks = 0;
    if (!_ticker.isActive) {
      _last = Duration.zero;
      _ticker.start();
    }
  }

  void _onTick(Duration elapsed) {
    final dt = ((elapsed - _last).inMicroseconds / 1e6).clamp(0.0, 0.05);
    _last = elapsed;
    if (!ctrl.isAnimating) {
      // Idle: stop requesting frames so the GPU can rest (saves battery).
      if (++_idleTicks > 3) _ticker.stop();
    } else {
      _idleTicks = 0;
    }
    ctrl.tick(dt);
  }

  void _onGameOver() {
    AdsService.instance.noteGameFinished();
    setState(() {
      _gameOverScore = ctrl.game.score;
      _gameOverWasBest = ctrl.game.score > ctrl.bestAtStart && ctrl.game.score > 0;
      _showGameOver = true;
    });
  }

  void _onReviveOffer() {
    setState(() => _showRevive = true);
  }

  // ---------------------------------------------------------------------------
  // Pointer handling (single active finger).
  // ---------------------------------------------------------------------------

  bool get _popupOpen =>
      _showSettings ||
      _showHowTo ||
      _showSkins ||
      _showAbout ||
      _showHintUpsell ||
      _showRevive ||
      _showGameOver;

  void _down(PointerDownEvent e) {
    if (_pointer != null || _popupOpen) return;
    _pointer = e.pointer;
    final l = ctrl.layout;
    if (l != null && ctrl.overPhase == OverPhase.none) {
      if (l.gearRect.inflate(l.u * 3).contains(e.localPosition)) {
        _gearDown = true;
        return;
      }
      if (l.hintRect.inflate(l.u * 2.5).contains(e.localPosition)) {
        _hintDown = true;
        return;
      }
    }
    ctrl.pointerDown(e.localPosition);
  }

  void _move(PointerMoveEvent e) {
    if (e.pointer != _pointer) return;
    ctrl.pointerMove(e.localPosition);
  }

  void _up(PointerUpEvent e) {
    if (e.pointer != _pointer) return;
    _pointer = null;
    final l = ctrl.layout;
    if (_gearDown) {
      _gearDown = false;
      if (l != null && l.gearRect.inflate(l.u * 4).contains(e.localPosition)) _openSettings();
      return;
    }
    if (_hintDown) {
      _hintDown = false;
      if (l != null && l.hintRect.inflate(l.u * 3.5).contains(e.localPosition)) _onHint();
      return;
    }
    ctrl.pointerUp();
  }

  void _cancel(PointerCancelEvent e) {
    if (e.pointer != _pointer) return;
    _pointer = null;
    _gearDown = false;
    _hintDown = false;
    ctrl.pointerCancel();
  }

  void _openSettings() {
    Sound.instance.play(Sfx.click);
    ctrl.pointerCancel();
    setState(() => _showSettings = true);
  }

  void _onHint() {
    if (_popupOpen || ctrl.inputLocked) return;
    switch (ctrl.requestHint()) {
      case HintOutcome.shown:
        break;
      case HintOutcome.noneLeft:
        Sound.instance.play(Sfx.click);
        setState(() => _showHintUpsell = true);
      case HintOutcome.noMove:
        Sound.instance.play(Sfx.invalid, volume: 0.45);
    }
  }

  // ---------------------------------------------------------------------------
  // Premium, revive and ads
  // ---------------------------------------------------------------------------

  Future<void> _openPremium(String source) async {
    ctrl.pointerCancel();
    setState(() => _premiumOpen = true);
    await Navigator.of(context).push(slideUpRoute(PremiumScreen(source: source)));
    if (mounted) setState(() => _premiumOpen = false);
  }

  void _revive() {
    setState(() => _showRevive = false);
    ctrl.revive();
  }

  Future<void> _watchAdToRevive() async {
    if (_adShowing) return;
    setState(() => _adShowing = true);
    final earned = await AdsService.instance.showRewarded();
    if (!mounted) return;
    setState(() => _adShowing = false);
    if (earned) _revive();
  }

  void _declineRevive() {
    setState(() => _showRevive = false);
    ctrl.declineRevive();
  }

  Future<void> _playAgain() async {
    // Free tier: an occasional interstitial between games (paced).
    await AdsService.instance.maybeShowInterstitial();
    if (!mounted) return;
    ctrl.newGame();
    setState(() => _showGameOver = false);
  }

  void _goHome() {
    ctrl.saveNow();
    Navigator.of(context).pushReplacement(zoomFadeRoute(const HomeScreen(), from: 0.96));
  }

  // ---------------------------------------------------------------------------

  @override
  Widget build(BuildContext context) {
    final dpr = MediaQuery.devicePixelRatioOf(context);
    final premium = PremiumService.instance;
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (didPop) return;
        if (_showHintUpsell) {
          setState(() => _showHintUpsell = false);
        } else if (_showAbout) {
          setState(() => _showAbout = false);
        } else if (_showSkins) {
          setState(() => _showSkins = false);
        } else if (_showHowTo) {
          setState(() => _showHowTo = false);
        } else if (_showSettings) {
          setState(() => _showSettings = false);
        } else if (_showRevive) {
          _declineRevive();
        } else {
          _goHome();
        }
      },
      child: AnnotatedRegion<SystemUiOverlayStyle>(
        value: Palette.overlayGame,
        child: Scaffold(
          backgroundColor: Palette.background,
          body: DecoratedBox(
            decoration: const BoxDecoration(
              gradient: RadialGradient(
                center: Alignment(0, -0.2),
                radius: 1.1,
                colors: [Color(0xFF3E5799), Palette.background, Color(0xFF354B8C)],
                stops: [0, 0.6, 1],
              ),
            ),
            child: SafeArea(
              child: Stack(
                children: [
                  Column(
                    children: [
                      Expanded(child: _gameArea(dpr)),
                      // Free tier: banner under the tray (space kept even
                      // before an ad loads so the board never jumps).
                      if (AdsService.instance.reservesBanner) const BannerAdSlot(),
                    ],
                  ),
                  if (_showSettings)
                    SettingsPopup(
                      onClose: () => setState(() => _showSettings = false),
                      onRestart: () {
                        ctrl.newGame();
                        setState(() => _showSettings = false);
                      },
                      onHowToPlay: () => setState(() => _showHowTo = true),
                      onSkins: () => setState(() => _showSkins = true),
                      onAbout: () => setState(() => _showAbout = true),
                    ),
                  if (_showHowTo) HowToPlayPopup(onClose: () => setState(() => _showHowTo = false)),
                  if (_showSkins)
                    SkinPickerPopup(
                      onClose: () => setState(() => _showSkins = false),
                      onPremium: () => _openPremium('skins'),
                    ),
                  if (_showAbout) AboutPopup(onClose: () => setState(() => _showAbout = false)),
                  if (_showHintUpsell)
                    HintsUpsellPopup(
                      premium: premium.isPremium,
                      onPremium: () {
                        setState(() => _showHintUpsell = false);
                        _openPremium('hint');
                      },
                      onClose: () => setState(() => _showHintUpsell = false),
                    ),
                  if (_showRevive)
                    ReviveOfferPopup(
                      score: ctrl.game.score,
                      premium: !premium.revivesNeedAd,
                      revivesLeft: ctrl.revivesLeft,
                      adReady: AdsService.instance.rewardedReady,
                      paused: _adShowing || _premiumOpen,
                      onRevive: _revive,
                      onWatchAd: _watchAdToRevive,
                      onPremium: () => _openPremium('revive'),
                      onDecline: _declineRevive,
                    ),
                  if (_showGameOver)
                    GameOverPopup(
                      score: _gameOverScore,
                      best: SettingsStore.instance.bestScore,
                      isNewBest: _gameOverWasBest,
                      onPlayAgain: _playAgain,
                      onHome: _goHome,
                    ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _gameArea(double dpr) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final size = constraints.biggest;
        if (ctrl.layout?.size != size) {
          ctrl.layout = GameLayout.compute(size);
        }
        final l = ctrl.layout!;
        return Stack(
          children: [
            Positioned.fill(
              child: Listener(
                behavior: HitTestBehavior.opaque,
                onPointerDown: _down,
                onPointerMove: _move,
                onPointerUp: _up,
                onPointerCancel: _cancel,
                child: RepaintBoundary(
                  child: CustomPaint(painter: GamePainter(ctrl, dpr), size: size),
                ),
              ),
            ),
            // Accessibility: the canvas has no semantics of its own.
            Positioned.fromRect(
              rect: l.gearRect.inflate(l.u * 2),
              child: Semantics(button: true, label: 'Settings', onTap: _openSettings, child: const SizedBox.expand()),
            ),
            Positioned.fromRect(
              rect: l.hintRect.inflate(l.u * 2),
              child: ListenableBuilder(
                listenable: ctrl,
                builder: (context, _) => Semantics(
                  button: true,
                  label: 'Hint, ${ctrl.hintsLeft} left',
                  onTap: _onHint,
                  child: const SizedBox.expand(),
                ),
              ),
            ),
            Positioned(
              left: 0,
              right: 0,
              top: l.scoreCenter.dy - l.scoreFont / 2,
              height: l.scoreFont,
              child: ListenableBuilder(
                listenable: ctrl,
                builder: (context, _) => Semantics(
                  label: 'Score ${ctrl.game.score}, best ${ctrl.bestScore}',
                  child: const SizedBox.expand(),
                ),
              ),
            ),
          ],
        );
      },
    );
  }
}

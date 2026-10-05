import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter/scheduler.dart';

import '../logic/game.dart';
import '../screens/home_screen.dart';
import '../screens/transitions.dart';
import '../services/settings_store.dart';
import '../services/sound.dart';
import '../ui/palette.dart';
import '../widgets/popups.dart';
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
  bool _showGameOver = false;
  bool _gameOverWasBest = false;
  int _gameOverScore = 0;

  int? _pointer;
  bool _gearDown = false;

  @override
  void initState() {
    super.initState();
    Sound.instance.init();
    ctrl = GameController(restored: widget.initialGame);
    if (widget.startNew) ctrl.newGame();
    ctrl.onShowGameOver = _onGameOver;
    _ticker = createTicker(_onTick)..start();
    // The ticker only runs while something moves; any change wakes it up.
    ctrl.addListener(_wake);
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
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
    setState(() {
      _gameOverScore = ctrl.game.score;
      _gameOverWasBest = ctrl.game.score > ctrl.bestAtStart && ctrl.game.score > 0;
      _showGameOver = true;
    });
  }

  // ---------------------------------------------------------------------------
  // Pointer handling (single active finger).
  // ---------------------------------------------------------------------------

  bool get _popupOpen => _showSettings || _showHowTo || _showGameOver;

  void _down(PointerDownEvent e) {
    if (_pointer != null || _popupOpen) return;
    _pointer = e.pointer;
    final l = ctrl.layout;
    if (l != null && ctrl.overPhase == OverPhase.none && l.gearRect.inflate(l.u * 3).contains(e.localPosition)) {
      _gearDown = true;
      return;
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
    if (_gearDown) {
      _gearDown = false;
      final l = ctrl.layout;
      if (l != null && l.gearRect.inflate(l.u * 4).contains(e.localPosition)) _openSettings();
      return;
    }
    ctrl.pointerUp();
  }

  void _cancel(PointerCancelEvent e) {
    if (e.pointer != _pointer) return;
    _pointer = null;
    _gearDown = false;
    ctrl.pointerCancel();
  }

  void _openSettings() {
    Sound.instance.play(Sfx.click);
    ctrl.pointerCancel();
    setState(() => _showSettings = true);
  }

  void _goHome() {
    ctrl.saveNow();
    Navigator.of(context).pushReplacement(fadeRoute(const HomeScreen()));
  }

  @override
  Widget build(BuildContext context) {
    final dpr = MediaQuery.devicePixelRatioOf(context);
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (didPop) return;
        if (_showHowTo) {
          setState(() => _showHowTo = false);
        } else if (_showSettings) {
          setState(() => _showSettings = false);
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
              child: LayoutBuilder(
                builder: (context, constraints) {
                  final size = constraints.biggest;
                  if (ctrl.layout?.size != size) {
                    ctrl.layout = GameLayout.compute(size);
                  }
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
                      if (_showSettings)
                        SettingsPopup(
                          onClose: () => setState(() => _showSettings = false),
                          onRestart: () {
                            ctrl.newGame();
                            setState(() => _showSettings = false);
                          },
                          onHowToPlay: () => setState(() => _showHowTo = true),
                        ),
                      if (_showHowTo) HowToPlayPopup(onClose: () => setState(() => _showHowTo = false)),
                      if (_showGameOver)
                        GameOverPopup(
                          score: _gameOverScore,
                          best: SettingsStore.instance.bestScore,
                          isNewBest: _gameOverWasBest,
                          onPlayAgain: () {
                            ctrl.newGame();
                            setState(() => _showGameOver = false);
                          },
                          onHome: _goHome,
                        ),
                    ],
                  );
                },
              ),
            ),
          ),
        ),
      ),
    );
  }
}

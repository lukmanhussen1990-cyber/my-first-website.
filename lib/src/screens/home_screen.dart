import 'package:flutter/material.dart';

import '../game/game_screen.dart';
import '../services/settings_store.dart';
import '../ui/fancy_text.dart';
import '../ui/icons.dart';
import '../ui/palette.dart';
import '../widgets/logo.dart';
import '../widgets/popups.dart';
import '../widgets/ui_kit.dart';
import 'transitions.dart';

/// Home / title screen reached from the game-over popup.
class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> with SingleTickerProviderStateMixin {
  late final AnimationController _bob =
      AnimationController(vsync: this, duration: const Duration(milliseconds: 1800))..repeat(reverse: true);
  bool _howTo = false;

  @override
  void dispose() {
    _bob.dispose();
    super.dispose();
  }

  void _play() {
    Navigator.of(context).pushReplacement(fadeRoute(const GameScreen()));
  }

  @override
  Widget build(BuildContext context) {
    final w = MediaQuery.sizeOf(context).width;
    final hasSaved = SettingsStore.instance.loadSavedGame() != null;
    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [Palette.splashTop, Palette.splashBottom],
          ),
        ),
        child: SafeArea(
          child: Stack(
            children: [
              Column(
                children: [
                  const Spacer(flex: 3),
                  AnimatedBuilder(
                    animation: _bob,
                    builder: (context, child) => Transform.translate(
                      offset: Offset(0, -6 * Curves.easeInOut.transform(_bob.value)),
                      child: child,
                    ),
                    child: BlockBlastLogo(width: w * 0.82),
                  ),
                  const Spacer(flex: 2),
                  Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      SizedBox(width: 40, height: 28, child: CustomPaint(painter: _Crown())),
                      const SizedBox(width: 8),
                      Text('${SettingsStore.instance.bestScore}',
                          style: numberStyle(30, color: Palette.goldText, weight: FontWeight.w700)),
                    ],
                  ),
                  const SizedBox(height: 26),
                  CandyButton(
                    label: hasSaved ? 'Continue' : 'Classic',
                    icon: Icons.play_arrow_rounded,
                    width: w * 0.62,
                    height: 64,
                    fontSize: 28,
                    onTap: _play,
                  ),
                  const SizedBox(height: 16),
                  CandyButton(
                    label: 'How to Play',
                    icon: Icons.help_outline_rounded,
                    colors: CandyButton.blue,
                    edge: CandyButton.blueEdge,
                    width: w * 0.62,
                    height: 52,
                    fontSize: 21,
                    onTap: () => setState(() => _howTo = true),
                  ),
                  const Spacer(flex: 3),
                ],
              ),
              if (_howTo) HowToPlayPopup(onClose: () => setState(() => _howTo = false)),
            ],
          ),
        ),
      ),
    );
  }
}

class _Crown extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) => paintCrown(canvas, Offset.zero & size);

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

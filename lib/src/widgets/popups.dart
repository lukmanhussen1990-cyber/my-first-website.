import 'package:flutter/material.dart';

import '../services/settings_store.dart';
import '../ui/block_painter.dart';
import '../ui/fancy_text.dart';
import '../ui/icons.dart';
import 'ui_kit.dart';

class SettingsPopup extends StatelessWidget {
  const SettingsPopup({super.key, required this.onClose, required this.onRestart, required this.onHowToPlay});

  final VoidCallback onClose;
  final VoidCallback onRestart;
  final VoidCallback onHowToPlay;

  @override
  Widget build(BuildContext context) {
    final store = SettingsStore.instance;
    return GamePopup(
      title: 'Settings',
      onClose: onClose,
      child: ListenableBuilder(
        listenable: store,
        builder: (context, _) => Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            _row(Icons.volume_up_rounded, 'Sound', store.soundOn, (v) => store.soundOn = v),
            _row(Icons.music_note_rounded, 'Music', store.musicOn, (v) => store.musicOn = v),
            _row(Icons.vibration_rounded, 'Vibration', store.vibrationOn, (v) => store.vibrationOn = v),
            const SizedBox(height: 14),
            CandyButton(
              label: 'Restart',
              icon: Icons.refresh_rounded,
              colors: CandyButton.orange,
              edge: CandyButton.orangeEdge,
              width: double.infinity,
              height: 52,
              onTap: onRestart,
            ),
            const SizedBox(height: 12),
            CandyButton(
              label: 'How to Play',
              icon: Icons.help_outline_rounded,
              colors: CandyButton.blue,
              edge: CandyButton.blueEdge,
              width: double.infinity,
              height: 52,
              onTap: onHowToPlay,
            ),
          ],
        ),
      ),
    );
  }

  Widget _row(IconData icon, String label, bool value, ValueChanged<bool> onChanged) {
    return Container(
      margin: const EdgeInsets.symmetric(vertical: 5),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
      decoration: BoxDecoration(color: const Color(0x33101C55), borderRadius: BorderRadius.circular(16)),
      child: Row(
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(shape: BoxShape.circle, color: Colors.white.withValues(alpha: 0.18)),
            child: Icon(icon, color: Colors.white, size: 22),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(label, style: bubbleStyle(21, weight: FontWeight.w600)),
          ),
          CandyToggle(value: value, onChanged: onChanged),
        ],
      ),
    );
  }
}

class GameOverPopup extends StatelessWidget {
  const GameOverPopup({
    super.key,
    required this.score,
    required this.best,
    required this.isNewBest,
    required this.onPlayAgain,
    required this.onHome,
  });

  final int score;
  final int best;
  final bool isNewBest;
  final VoidCallback onPlayAgain;
  final VoidCallback onHome;

  @override
  Widget build(BuildContext context) {
    return GamePopup(
      title: 'Game Over',
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (isNewBest)
            Padding(
              padding: const EdgeInsets.only(bottom: 4),
              child: FancyLabel(
                'New Best!',
                size: 28,
                skew: -0.15,
                fill: const [Color(0xFFFFF7B0), Color(0xFFFFC93B), Color(0xFFFF8A00)],
                stroke: const Color(0xFF8A3B00),
              ),
            ),
          Text(
            'Score',
            style: bubbleStyle(20, color: const Color(0xFFD5E3FF), weight: FontWeight.w600),
          ),
          const SizedBox(height: 2),
          TweenAnimationBuilder<double>(
            tween: Tween(begin: 0, end: score.toDouble()),
            duration: const Duration(milliseconds: 900),
            curve: Curves.easeOutCubic,
            builder: (context, v, _) => Text(
              '${v.round()}',
              style: numberStyle(56).copyWith(
                shadows: const [Shadow(color: Color(0x66101A40), offset: Offset(0, 3), blurRadius: 3)],
              ),
            ),
          ),
          const SizedBox(height: 8),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 8),
            decoration: BoxDecoration(color: const Color(0x44101C55), borderRadius: BorderRadius.circular(20)),
            child: FittedBox(
              fit: BoxFit.scaleDown,
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  SizedBox(width: 34, height: 24, child: CustomPaint(painter: _CrownPainter())),
                  const SizedBox(width: 8),
                  Text(
                    'Best  $best',
                    style: numberStyle(22, color: const Color(0xFFFDB72F), weight: FontWeight.w700),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 22),
          CandyButton(
            label: 'Play Again',
            icon: Icons.replay_rounded,
            width: double.infinity,
            height: 58,
            fontSize: 24,
            onTap: onPlayAgain,
          ),
          const SizedBox(height: 12),
          CandyButton(
            label: 'Home',
            icon: Icons.home_rounded,
            colors: CandyButton.blue,
            edge: CandyButton.blueEdge,
            width: double.infinity,
            height: 52,
            onTap: onHome,
          ),
        ],
      ),
    );
  }
}

class _CrownPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) => paintCrown(canvas, Offset.zero & size);

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

class HowToPlayPopup extends StatelessWidget {
  const HowToPlayPopup({super.key, required this.onClose});

  final VoidCallback onClose;

  @override
  Widget build(BuildContext context) {
    final tips = <(Widget, String)>[
      (const _MiniBoard(kind: 0), 'Drag the blocks from the tray onto the 8x8 board.'),
      (const _MiniBoard(kind: 1), 'Fill a whole row or column to clear it and score points.'),
      (const _MiniBoard(kind: 2), 'Clear lines on consecutive moves for a Combo bonus!'),
      (const _MiniBoard(kind: 3), 'The game ends when none of the blocks fit on the board.'),
    ];
    return GamePopup(
      title: 'How to Play',
      onClose: onClose,
      width: 340,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          for (final t in tips)
            Container(
              margin: const EdgeInsets.symmetric(vertical: 5),
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(color: const Color(0x33101C55), borderRadius: BorderRadius.circular(16)),
              child: Row(
                children: [
                  SizedBox(width: 56, height: 56, child: t.$1),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(t.$2, style: bubbleStyle(16.5, weight: FontWeight.w500).copyWith(height: 1.2)),
                  ),
                ],
              ),
            ),
          const SizedBox(height: 10),
          CandyButton(label: 'Got it!', width: double.infinity, height: 52, onTap: onClose),
        ],
      ),
    );
  }
}

/// Tiny illustrative 4x4 boards for the tutorial.
class _MiniBoard extends StatelessWidget {
  const _MiniBoard({required this.kind});

  final int kind;

  @override
  Widget build(BuildContext context) =>
      CustomPaint(painter: _MiniBoardPainter(kind, MediaQuery.devicePixelRatioOf(context)));
}

class _MiniBoardPainter extends CustomPainter {
  _MiniBoardPainter(this.kind, this.dpr);

  final int kind;
  final double dpr;

  @override
  void paint(Canvas canvas, Size size) {
    final rr = RRect.fromRectAndRadius(Offset.zero & size, const Radius.circular(8));
    canvas.drawRRect(rr, Paint()..color = const Color(0xFF1C2349));
    final cell = size.width / 4;
    final px = cell * dpr;
    Rect at(int r, int c) => Rect.fromLTWH(c * cell, r * cell, cell, cell).deflate(0.5);
    switch (kind) {
      case 0:
        for (final rc in const [
          [3, 0],
          [3, 1],
          [3, 2],
          [2, 2],
        ]) {
          drawBlock(canvas, at(rc[0], rc[1]), 5, px);
        }
        for (final rc in const [
          [0, 1],
          [1, 1],
          [1, 2],
        ]) {
          drawBlock(canvas, at(rc[0], rc[1]), 2, px, opacity: 0.5);
        }
      case 1:
        for (var c = 0; c < 4; c++) {
          drawBlock(canvas, at(1, c), 1, px);
        }
        canvas.drawRect(Rect.fromLTWH(0, cell, size.width, cell), Paint()..color = const Color(0x66FFFFFF));
        drawBlock(canvas, at(3, 0), 3, px);
        drawBlock(canvas, at(3, 1), 3, px);
      case 2:
        for (var r = 0; r < 4; r++) {
          drawBlock(canvas, at(r, 2), 6, px);
        }
        for (var c = 0; c < 4; c++) {
          drawBlock(canvas, at(0, c), 6, px);
        }
      default:
        for (var r = 0; r < 4; r++) {
          for (var c = 0; c < 4; c++) {
            if ((r + c) % 3 != 0) drawBlock(canvas, at(r, c), 7, px);
          }
        }
    }
  }

  @override
  bool shouldRepaint(covariant _MiniBoardPainter oldDelegate) => oldDelegate.kind != kind;
}

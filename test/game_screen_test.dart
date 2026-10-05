import 'dart:math';

import 'package:blockblast/src/game/game_screen.dart';
import 'package:blockblast/src/game/layout.dart';
import 'package:blockblast/src/logic/board.dart';
import 'package:blockblast/src/logic/game.dart';
import 'package:blockblast/src/logic/shapes.dart';
import 'package:blockblast/src/services/settings_store.dart';
import 'package:blockblast/src/services/sound.dart';
import 'package:blockblast/src/widgets/ui_kit.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'test_fonts.dart';

Piece p(String id, int color) => Piece(kShapeById[id]!, color);

/// Pointer position that drops a [rows]x[cols] piece with its top-left on
/// board cell ([row], [col]) (mirrors GameController.dragGeometry).
Offset dropPoint(GameLayout l, int rows, int cols, int row, int col) {
  final cx = l.gridRect.left + (col + cols / 2) * l.cell;
  final cy = l.gridRect.top + (row + rows / 2) * l.cell;
  return Offset(cx, cy + rows * l.cell / 2 + 1.15 * l.cell);
}

Future<void> pumpFrames(WidgetTester tester, int n) async {
  for (var i = 0; i < n; i++) {
    await tester.pump(const Duration(milliseconds: 16));
  }
}

void main() {
  setUpAll(loadAppFonts);

  setUp(() {
    Sound.disabled = true;
    SettingsStore.memory();
  });

  Future<GameLayout> setUpScreen(WidgetTester tester, GameState game) async {
    tester.view.physicalSize = const Size(1080, 2340);
    tester.view.devicePixelRatio = 2.625;
    addTearDown(tester.view.reset);
    await tester.pumpWidget(MaterialApp(home: GameScreen(initialGame: game)));
    await pumpFrames(tester, 30);
    final size = tester.view.physicalSize / tester.view.devicePixelRatio;
    return GameLayout.compute(size);
  }

  testWidgets('dragging a piece onto the board places it and scores', (tester) async {
    final game = GameState.custom(board: Board(), tray: [p('sq2', 0), p('h3', 1), p('dot', 2)], random: Random(1));
    final l = await setUpScreen(tester, game);

    final gesture = await tester.startGesture(l.slotCenters[0]);
    await pumpFrames(tester, 3);
    await gesture.moveTo(dropPoint(l, 2, 2, 3, 4));
    await pumpFrames(tester, 12);
    await gesture.up();
    await pumpFrames(tester, 20);

    expect(game.tray[0], isNull);
    expect(game.score, 4);
    expect(game.board.get(3, 4), 0);
    expect(game.board.get(4, 5), 0);
    expect(game.board.get(2, 4), Board.empty);
  });

  testWidgets('dropping on occupied cells returns the piece to the tray', (tester) async {
    final board = Board()..set(0, 0, 3);
    final game = GameState.custom(board: board, tray: [p('sq2', 0), p('h3', 1), p('dot', 2)], random: Random(2));
    final l = await setUpScreen(tester, game);

    final gesture = await tester.startGesture(l.slotCenters[0]);
    await pumpFrames(tester, 3);
    await gesture.moveTo(dropPoint(l, 2, 2, 0, 0));
    await pumpFrames(tester, 12);
    await gesture.up();
    await pumpFrames(tester, 30);

    expect(game.tray[0], isNotNull);
    expect(game.score, 0);
    expect(game.board.filledCount, 1);
  });

  testWidgets('idle game screen stops requesting frames (battery)', (tester) async {
    final game = GameState.custom(board: Board(), tray: [p('dot', 0), p('h2', 1), p('sq2', 2)], random: Random(8));
    final l = await setUpScreen(tester, game);
    await pumpFrames(tester, 30);
    expect(tester.binding.hasScheduledFrame, isFalse);

    // Touching a piece wakes the animation loop again.
    final gesture = await tester.startGesture(l.slotCenters[0]);
    await tester.pump(const Duration(milliseconds: 16));
    expect(tester.binding.hasScheduledFrame, isTrue);
    await gesture.up();
    await pumpFrames(tester, 60);
    expect(tester.binding.hasScheduledFrame, isFalse);
  });

  testWidgets('a plain tap on a tall tray piece does not place it', (tester) async {
    final game = GameState.custom(board: Board(), tray: [p('v5', 0), p('sq3', 1), p('v4', 2)], random: Random(6));
    final l = await setUpScreen(tester, game);
    for (var slot = 0; slot < 3; slot++) {
      await tester.tapAt(l.slotCenters[slot]);
      await pumpFrames(tester, 20);
    }
    expect(game.board.filledCount, 0);
    expect(game.tray.every((piece) => piece != null), isTrue);
    expect(game.score, 0);
  });

  testWidgets('completing two rows clears them with bonus', (tester) async {
    final board = Board();
    for (var r = 6; r < 8; r++) {
      for (var c = 0; c < 7; c++) {
        board.set(r, c, 1);
      }
    }
    final game = GameState.custom(board: board, tray: [p('v2', 4), p('dot', 2), p('h2', 3)], random: Random(3));
    final l = await setUpScreen(tester, game);

    final gesture = await tester.startGesture(l.slotCenters[0]);
    await pumpFrames(tester, 3);
    await gesture.moveTo(dropPoint(l, 2, 1, 6, 7));
    await pumpFrames(tester, 12);
    await gesture.up();
    // Let the blast animation and floating texts run.
    await pumpFrames(tester, 90);

    expect(game.board.isCompletelyEmpty, isTrue);
    expect(game.score, 2 + 30);
    expect(game.combo, 1);
  });

  testWidgets('game over popup appears when nothing fits', (tester) async {
    final board = Board();
    for (var r = 0; r < 8; r++) {
      for (var c = 0; c < 8; c++) {
        if ((r + c).isEven) board.set(r, c, (r + c) % 7);
      }
    }
    final game = GameState.custom(board: board, tray: [p('dot', 2), p('sq3', 5), p('h5', 0)], random: Random(4));
    final l = await setUpScreen(tester, game);

    final gesture = await tester.startGesture(l.slotCenters[0]);
    await pumpFrames(tester, 3);
    await gesture.moveTo(dropPoint(l, 1, 1, 0, 1));
    await pumpFrames(tester, 12);
    await gesture.up();
    await pumpFrames(tester, 40);
    // The settings gear is ignored once the game-over sequence started.
    await tester.tapAt(l.gearRect.center);
    await pumpFrames(tester, 160);

    expect(find.text('Vibration'), findsNothing);
    expect(game.gameOver, isTrue);
    expect(find.text('Play Again'), findsOneWidget);
    expect(find.text('Home'), findsOneWidget);

    await tester.tap(find.text('Play Again'));
    await pumpFrames(tester, 30);
    expect(find.text('Play Again'), findsNothing);
  });

  testWidgets('settings popup toggles persist in the store', (tester) async {
    final game = GameState.custom(board: Board(), tray: [p('dot', 2), p('dot', 3), p('dot', 4)], random: Random(5));
    final l = await setUpScreen(tester, game);

    await tester.tapAt(l.gearRect.center);
    await pumpFrames(tester, 30);
    for (final label in ['Sound', 'Music', 'Vibration', 'Restart', 'How to Play']) {
      expect(find.text(label), findsOneWidget, reason: label);
    }
    expect(SettingsStore.instance.soundOn, isTrue);
    await tester.tap(find.byType(CandyToggle).at(0));
    await tester.tap(find.byType(CandyToggle).at(1));
    await tester.tap(find.byType(CandyToggle).at(2));
    await pumpFrames(tester, 20);
    expect(SettingsStore.instance.soundOn, isFalse);
    expect(SettingsStore.instance.musicOn, isFalse);
    expect(SettingsStore.instance.vibrationOn, isFalse);

    // Restart wipes the board and score.
    game.place(0, 0, 0);
    await tester.tap(find.text('Restart'));
    await pumpFrames(tester, 30);
    expect(find.text('Restart'), findsNothing);
  });
}

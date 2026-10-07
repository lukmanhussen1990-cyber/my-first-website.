import 'dart:math';

import 'package:blockblast/src/game/game_screen.dart';
import 'package:blockblast/src/game/layout.dart';
import 'package:blockblast/src/logic/board.dart';
import 'package:blockblast/src/logic/game.dart';
import 'package:blockblast/src/logic/shapes.dart';
import 'package:blockblast/src/screens/home_screen.dart';
import 'package:blockblast/src/screens/splash_screens.dart';
import 'package:blockblast/src/services/settings_store.dart';
import 'package:blockblast/src/services/sound.dart';
import 'package:blockblast/src/widgets/popups.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'test_fonts.dart';

Future<void> pumpFrames(WidgetTester tester, int n, {int ms = 16}) async {
  for (var i = 0; i < n; i++) {
    await tester.pump(Duration(milliseconds: ms));
  }
}

void phone(WidgetTester tester) {
  tester.view.physicalSize = const Size(1080, 2340);
  tester.view.devicePixelRatio = 2.625;
  addTearDown(tester.view.reset);
}

void main() {
  setUpAll(loadAppFonts);

  setUp(() {
    Sound.disabled = true;
    SettingsStore.memory();
  });

  testWidgets('splash sequence runs into the home screen', (tester) async {
    phone(tester);
    await tester.pumpWidget(const MaterialApp(home: IconSplashScreen()));
    await pumpFrames(tester, 10);
    expect(find.byType(IconSplashScreen), findsOneWidget);
    // 2 s icon splash, then the loading splash.
    await pumpFrames(tester, 140);
    expect(find.byType(LoadingSplashScreen), findsOneWidget);
    // Studio logo, BLOCK BLAST logo + loader, then the home screen.
    await pumpFrames(tester, 300);
    expect(find.byType(HomeScreen), findsOneWidget);
    expect(find.text('CREATED BY IMRAN'), findsOneWidget);
    // Let the home animations finish so the test ends cleanly.
    await pumpFrames(tester, 800);
    expect(tester.takeException(), isNull);
  });

  testWidgets('home screen and how-to-play render', (tester) async {
    phone(tester);
    await tester.pumpWidget(const MaterialApp(home: HomeScreen()));
    await pumpFrames(tester, 20);
    expect(find.text('Classic'), findsOneWidget);
    await tester.tap(find.text('How to Play'));
    await pumpFrames(tester, 30);
    expect(find.text('Got it!'), findsOneWidget);
    await tester.tap(find.text('Got it!'));
    await pumpFrames(tester, 10);
    expect(find.text('Got it!'), findsNothing);
    expect(tester.takeException(), isNull);
  });

  testWidgets('home and loading splash backgrounds fill the whole screen', (tester) async {
    phone(tester);
    final screen = tester.view.physicalSize / tester.view.devicePixelRatio;
    Size gradientSize() {
      final box = find.byWidgetPredicate(
        (w) => w is Container && w.decoration is BoxDecoration && (w.decoration as BoxDecoration).gradient != null,
      );
      return tester.getSize(box.first);
    }

    await tester.pumpWidget(const MaterialApp(home: HomeScreen()));
    await pumpFrames(tester, 10);
    expect(tester.getSize(find.byKey(const ValueKey('home-backdrop'))), screen);
    await pumpFrames(tester, 800);

    await tester.pumpWidget(const MaterialApp(home: LoadingSplashScreen()));
    await pumpFrames(tester, 10);
    expect(gradientSize(), screen);
    // Let the splash timers finish so the test ends cleanly.
    await pumpFrames(tester, 300);
  });

  testWidgets('popups fit on a very small 320x480 screen', (tester) async {
    tester.view.physicalSize = const Size(640, 960);
    tester.view.devicePixelRatio = 2.0;
    addTearDown(tester.view.reset);
    await tester.pumpWidget(MaterialApp(home: Scaffold(body: HowToPlayPopup(onClose: () {}))));
    await pumpFrames(tester, 40);
    expect(tester.takeException(), isNull);
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: GameOverPopup(score: 98765, best: 98765, isNewBest: true, onPlayAgain: () {}, onHome: () {}),
        ),
      ),
    );
    await pumpFrames(tester, 70);
    expect(tester.takeException(), isNull);
    await tester.pumpWidget(
      MaterialApp(home: Scaffold(body: SettingsPopup(onClose: () {}, onRestart: () {}, onHowToPlay: () {}, onSkins: () {}, onAbout: () {}))),
    );
    await pumpFrames(tester, 40);
    expect(tester.takeException(), isNull);
  });

  testWidgets('game over popup with new best renders', (tester) async {
    phone(tester);
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: GameOverPopup(score: 1234, best: 1234, isNewBest: true, onPlayAgain: () {}, onHome: () {}),
        ),
      ),
    );
    await pumpFrames(tester, 70);
    expect(find.text('1234'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('beating the best score shows the record gem and updates best', (tester) async {
    phone(tester);
    SettingsStore.instance.submitScore(10);
    final board = Board();
    for (var c = 0; c < 7; c++) {
      board.set(0, c, 2);
    }
    final game = GameState.custom(
      board: board,
      tray: [Piece(kShapeById['dot']!, 1), Piece(kShapeById['dot']!, 2), Piece(kShapeById['dot']!, 3)],
      score: 9,
      random: Random(9),
    );
    await tester.pumpWidget(MaterialApp(home: GameScreen(initialGame: game)));
    await pumpFrames(tester, 20);
    final l = GameLayout.compute(tester.view.physicalSize / tester.view.devicePixelRatio);

    final target = l.cellRect(0, 7).center + Offset(0, l.cell * 0.5 + 1.15 * l.cell);
    final g = await tester.startGesture(l.slotCenters[0]);
    await pumpFrames(tester, 3);
    await g.moveTo(target);
    await pumpFrames(tester, 10);
    await g.up();
    await pumpFrames(tester, 80);

    expect(game.score, 9 + 1 + 10);
    expect(SettingsStore.instance.bestScore, 20);
    expect(tester.takeException(), isNull);
  });
}

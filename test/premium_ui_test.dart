import 'dart:math';
import 'dart:ui' as ui;

import 'package:blockblast/src/game/game_screen.dart';
import 'package:blockblast/src/game/layout.dart';
import 'package:blockblast/src/logic/board.dart';
import 'package:blockblast/src/logic/game.dart';
import 'package:blockblast/src/logic/shapes.dart';
import 'package:blockblast/src/premium/benefits.dart';
import 'package:blockblast/src/premium/premium_service.dart';
import 'package:blockblast/src/premium/store.dart';
import 'package:blockblast/src/screens/home_screen.dart';
import 'package:blockblast/src/screens/premium_screen.dart';
import 'package:blockblast/src/services/ads_service.dart';
import 'package:blockblast/src/services/settings_store.dart';
import 'package:blockblast/src/services/sound.dart';
import 'package:blockblast/src/ui/palette.dart';
import 'package:blockblast/src/ui/skins.dart';
import 'package:blockblast/src/widgets/premium_popups.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'fakes.dart';
import 'test_fonts.dart';

Piece p(String id, int color) => Piece(kShapeById[id]!, color);

Future<void> pumpFrames(WidgetTester tester, int n) async {
  for (var i = 0; i < n; i++) {
    await tester.pump(const Duration(milliseconds: 16));
  }
}

/// Phone and tablet sizes (logical pixels) the menus must fit.
const sizes = [
  Size(320, 568), // small / old phones
  Size(360, 640),
  Size(393, 852),
  Size(412, 915),
  Size(600, 960), // 7" tablet
  Size(800, 1280), // 10" tablet
];

void useSize(WidgetTester tester, Size logical, {double dpr = 2.625}) {
  tester.view.physicalSize = logical * dpr;
  tester.view.devicePixelRatio = dpr;
  addTearDown(tester.view.reset);
}

String textOf(WidgetTester tester, Key key) => tester.widget<Text>(find.byKey(key)).data!;

void usePremiumPreview() {
  PremiumService.instance = PremiumService(store: UnavailableStore(), verifier: FakeVerifier(), preview: true);
}

void main() {
  setUpAll(loadAppFonts);

  setUp(() {
    Sound.disabled = true;
    SettingsStore.memory();
    PremiumService.reset();
    ActiveSkin.value = BlockSkin.classic;
  });

  group('Premium screen', () {
    testWidgets('benefits, plans, savings and the charge beside the button', (tester) async {
      useSize(tester, const Size(412, 915));
      await tester.pumpWidget(const MaterialApp(home: PremiumScreen()));
      await pumpFrames(tester, 70);

      for (final t in [
        'No Ads',
        'Uninterrupted gameplay',
        'More Revives',
        'Additional chances to continue',
        'Hint Boosts',
        'Help with difficult moves',
        'Exclusive Skins',
        'Premium block designs',
      ]) {
        expect(find.text(t), findsOneWidget, reason: t);
      }
      expect(find.text('BEST VALUE'), findsOneWidget);
      expect(find.text(r'Save 66% vs monthly · $1.67/month'), findsOneWidget);
      expect(find.text('Save 42% vs weekly'), findsOneWidget);

      // Yearly is preselected; its full charge and period sit beside the button.
      expect(textOf(tester, const ValueKey('charge-price')), r'$19.99');
      expect(textOf(tester, const ValueKey('charge-period')), 'billed yearly');
      expect(find.text('Start Premium'), findsOneWidget);
      final charge = tester.getRect(find.byKey(const ValueKey('charge-price')));
      final button = tester.getRect(find.text('Start Premium'));
      expect((charge.center.dy - button.center.dy).abs(), lessThan(30));
      expect(charge.right, lessThan(button.left));

      await tester.ensureVisible(find.text('Monthly'));
      await pumpFrames(tester, 15);
      await tester.tap(find.text('Monthly'));
      await pumpFrames(tester, 15);
      expect(textOf(tester, const ValueKey('charge-price')), r'$4.99');
      expect(textOf(tester, const ValueKey('charge-period')), 'billed monthly');
      expect(find.textContaining(r'Auto-renews at $4.99/month'), findsOneWidget);

      await tester.ensureVisible(find.text('Weekly'));
      await pumpFrames(tester, 15);
      await tester.tap(find.text('Weekly'));
      await pumpFrames(tester, 15);
      expect(textOf(tester, const ValueKey('charge-price')), r'$1.99');
      expect(textOf(tester, const ValueKey('charge-period')), 'billed weekly');

      expect(find.text('Restore Purchases'), findsOneWidget);
      expect(find.text('Manage Subscription'), findsOneWidget);
      expect(find.byIcon(Icons.close_rounded), findsOneWidget);
      expect(tester.takeException(), isNull);
    });

    testWidgets('fits phones and tablets with the purchase bar on screen', (tester) async {
      for (final size in sizes) {
        useSize(tester, size);
        await tester.pumpWidget(const MaterialApp(home: PremiumScreen()));
        await pumpFrames(tester, 70);
        expect(tester.takeException(), isNull, reason: '$size');
        final button = tester.getRect(find.text('Start Premium'));
        expect(button.bottom, lessThanOrEqualTo(size.height), reason: '$size');
        expect(tester.getRect(find.text('Manage Subscription')).bottom, lessThanOrEqualTo(size.height));
        // Content scrolls to the subscription details.
        await tester.drag(find.byType(SingleChildScrollView), const Offset(0, -1500));
        await pumpFrames(tester, 30);
        expect(find.text('Subscription details'), findsOneWidget);
        expect(tester.takeException(), isNull, reason: '$size');
        await tester.pumpWidget(const SizedBox());
      }
    });

    testWidgets('shows Google Play prices in the local currency', (tester) async {
      useSize(tester, const Size(393, 852));
      final store = FakeStore();
      final service = PremiumService(store: store, verifier: FakeVerifier());
      PremiumService.instance = service;
      await service.init();
      await tester.pumpWidget(const MaterialApp(home: PremiumScreen()));
      await pumpFrames(tester, 70);
      expect(find.text('19,99 €'), findsWidgets);
      expect(find.text('4,99 €'), findsOneWidget);
      expect(find.textContaining('Save 66% vs monthly'), findsOneWidget);
      expect(find.textContaining('Prices shown in USD'), findsNothing);
      expect(textOf(tester, const ValueKey('charge-price')), '19,99 €');
    });

    testWidgets('a verified purchase switches the screen to the active state', (tester) async {
      useSize(tester, const Size(393, 852));
      final store = FakeStore();
      final service = PremiumService(store: store, verifier: FakeVerifier());
      PremiumService.instance = service;
      await service.init();
      await tester.pumpWidget(const MaterialApp(home: PremiumScreen()));
      await pumpFrames(tester, 70);

      await tester.tap(find.text('Start Premium'));
      await pumpFrames(tester, 5);
      expect(store.bought.single.$1, 'premium_yearly');
      expect(find.text('Opening Google Play…'), findsOneWidget);

      store.updates.add([purchase('premium_yearly')]);
      await pumpFrames(tester, 60);
      expect(service.isPremium, isTrue);
      expect(find.text("You're Premium!"), findsOneWidget);
      expect(find.text('Premium Active'), findsOneWidget);
      expect(find.text('CURRENT'), findsOneWidget);
      expect(find.textContaining('Welcome to Premium'), findsOneWidget);

      // Another plan becomes a plan switch.
      await tester.ensureVisible(find.text('Monthly'));
      await pumpFrames(tester, 15);
      await tester.tap(find.text('Monthly'));
      await pumpFrames(tester, 10);
      expect(find.text('Switch to Monthly'), findsOneWidget);
    });

    testWidgets('close button returns to the previous screen', (tester) async {
      useSize(tester, const Size(393, 852));
      await tester.pumpWidget(
        MaterialApp(
          home: Builder(
            builder: (context) => TextButton(
              onPressed: () => Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => const PremiumScreen())),
              child: const Text('open'),
            ),
          ),
        ),
      );
      await tester.tap(find.text('open'));
      await pumpFrames(tester, 60);
      expect(find.byType(PremiumScreen), findsOneWidget);
      await tester.tap(find.byIcon(Icons.close_rounded));
      await pumpFrames(tester, 40);
      expect(find.byType(PremiumScreen), findsNothing);
    });
  });

  group('Home screen', () {
    testWidgets('premium button top right, creator credit at the bottom', (tester) async {
      const size = Size(412, 915);
      useSize(tester, size);
      await tester.pumpWidget(const MaterialApp(home: HomeScreen()));
      await pumpFrames(tester, 90);

      final premium = tester.getRect(find.text('PREMIUM'));
      expect(premium.right, greaterThan(size.width - 60));
      expect(premium.top, lessThan(80));

      final credit = tester.getRect(find.text('CREATED BY IMRAN'));
      expect(credit.bottom, greaterThan(size.height - 60));
      expect(credit.bottom, lessThanOrEqualTo(size.height));

      expect(find.text('Classic'), findsOneWidget);
      expect(find.text('How to Play'), findsOneWidget);
      expect(find.text('BEST'), findsOneWidget);

      await tester.tap(find.byIcon(Icons.info_outline_rounded));
      await pumpFrames(tester, 30);
      expect(find.text('Game Creator: IMRAN'), findsOneWidget);
      await tester.tap(find.text('Close'));
      await pumpFrames(tester, 20);

      await tester.tap(find.text('PREMIUM'));
      await pumpFrames(tester, 60);
      expect(find.byType(PremiumScreen), findsOneWidget);
      await pumpFrames(tester, 700);
      expect(tester.takeException(), isNull);
    });

    testWidgets('custom buttons can be activated by screen readers', (tester) async {
      final handle = tester.ensureSemantics();
      useSize(tester, const Size(412, 915));
      await tester.pumpWidget(const MaterialApp(home: HomeScreen()));
      await pumpFrames(tester, 90);
      for (final label in ['Premium', 'About', 'Classic', 'How to Play', 'Block Skins']) {
        expect(
          find.bySemanticsLabel(label),
          findsOneWidget,
          reason: label,
        );
        expect(
          tester.getSemantics(find.bySemanticsLabel(label)),
          isSemantics(isButton: true, hasTapAction: true),
          reason: label,
        );
      }
      await tester.pumpWidget(const MaterialApp(home: PremiumScreen()));
      await pumpFrames(tester, 70);
      for (final label in ['Close', 'Restore Purchases', 'Manage Subscription', 'Start Premium']) {
        expect(
          tester.getSemantics(find.bySemanticsLabel(label)),
          isSemantics(isButton: true, hasTapAction: true),
          reason: label,
        );
      }
      expect(
        tester.getSemantics(find.bySemanticsLabel(RegExp('^Monthly plan'))),
        isSemantics(isButton: true, hasTapAction: true, isSelected: false),
      );
      expect(
        tester.getSemantics(find.bySemanticsLabel(RegExp('^Yearly plan'))),
        isSemantics(isButton: true, hasTapAction: true, isSelected: true),
      );
      await pumpFrames(tester, 700);
      handle.dispose();
    });

    testWidgets('shows Continue and the saved best score', (tester) async {
      useSize(tester, const Size(393, 852));
      SettingsStore.instance.submitScore(168);
      SettingsStore.instance.saveGame(GameState().toJson());
      await tester.pumpWidget(const MaterialApp(home: HomeScreen()));
      await pumpFrames(tester, 90);
      expect(find.text('Continue'), findsOneWidget);
      expect(find.text('168'), findsOneWidget);
      await pumpFrames(tester, 700);
    });

    testWidgets('fits phones and tablets without overlaps', (tester) async {
      for (final size in sizes) {
        useSize(tester, size);
        await tester.pumpWidget(const MaterialApp(home: HomeScreen()));
        await pumpFrames(tester, 90);
        expect(tester.takeException(), isNull, reason: '$size');
        final rects = [
          for (final t in ['PREMIUM', 'BEST', 'Classic', 'How to Play', 'Block Skins', 'CREATED BY IMRAN'])
            tester.getRect(find.text(t)),
        ];
        for (final r in rects) {
          expect(r.left, greaterThanOrEqualTo(0), reason: '$size');
          expect(r.right, lessThanOrEqualTo(size.width), reason: '$size');
          expect(r.bottom, lessThanOrEqualTo(size.height), reason: '$size');
        }
        // Top to bottom without overlapping.
        for (var i = 2; i < rects.length; i++) {
          expect(rects[i].top, greaterThan(rects[i - 1].bottom), reason: '$size item $i');
        }
        await tester.pumpWidget(const SizedBox());
      }
    });
  });

  group('Game benefits', () {
    Future<GameLayout> setUpGame(WidgetTester tester, GameState game) async {
      useSize(tester, const Size(1080, 2340) / 2.625);
      await tester.pumpWidget(MaterialApp(home: GameScreen(initialGame: game)));
      await pumpFrames(tester, 30);
      return GameLayout.compute(tester.view.physicalSize / tester.view.devicePixelRatio);
    }

    Offset dropPoint(GameLayout l, int rows, int cols, int row, int col) {
      final cx = l.gridRect.left + (col + cols / 2) * l.cell;
      final cy = l.gridRect.top + (row + rows / 2) * l.cell;
      return Offset(cx, cy + rows * l.cell / 2 + 1.15 * l.cell);
    }

    Future<void> dragTo(WidgetTester tester, GameLayout l, int slot, Offset to) async {
      final gesture = await tester.startGesture(l.slotCenters[slot]);
      await pumpFrames(tester, 3);
      await gesture.moveTo(to);
      await pumpFrames(tester, 12);
      await gesture.up();
      await pumpFrames(tester, 30);
    }

    /// One dot left to place, after which nothing fits.
    GameState almostStuck() {
      final board = Board();
      for (var r = 0; r < 8; r++) {
        for (var c = 0; c < 8; c++) {
          if ((r + c).isEven) board.set(r, c, (r + c) % 7);
        }
      }
      return GameState.custom(board: board, tray: [p('dot', 2), p('sq3', 5), p('h5', 0)], random: Random(4));
    }

    testWidgets('free players get one hint, then the Premium offer', (tester) async {
      final game = GameState.custom(board: Board(), tray: [p('sq2', 0), p('h3', 1), p('dot', 2)], random: Random(1));
      final l = await setUpGame(tester, game);

      await tester.tapAt(l.hintRect.center);
      await pumpFrames(tester, 20);
      expect(game.hintsUsed, 1);

      await dragTo(tester, l, 0, dropPoint(l, 2, 2, 3, 4));
      expect(game.tray[0], isNull);

      await tester.tapAt(l.hintRect.center);
      await pumpFrames(tester, 30);
      expect(find.byType(HintsUpsellPopup), findsOneWidget);
      expect(find.text('Get Premium'), findsOneWidget);
      expect(game.hintsUsed, 1);
      await tester.tap(find.text('Maybe Later'));
      await pumpFrames(tester, 20);
      expect(find.byType(HintsUpsellPopup), findsNothing);
    });

    testWidgets('Premium players get five hints per game', (tester) async {
      usePremiumPreview();
      final game = GameState.custom(board: Board(), tray: [p('sq2', 0), p('h3', 1), p('dot', 2)], random: Random(1));
      final l = await setUpGame(tester, game);
      for (var i = 0; i < 3; i++) {
        await tester.tapAt(l.hintRect.center);
        await pumpFrames(tester, 10);
        await dragTo(tester, l, i, dropPoint(l, 1, 1, 7, i * 3));
      }
      expect(game.hintsUsed, 3);
      expect(find.byType(HintsUpsellPopup), findsNothing);
    });

    testWidgets('Premium revive clears space and the game goes on', (tester) async {
      usePremiumPreview();
      final game = almostStuck();
      final l = await setUpGame(tester, game);
      final filled = game.board.filledCount;

      await dragTo(tester, l, 0, dropPoint(l, 1, 1, 0, 1));
      await pumpFrames(tester, 40);
      expect(find.byType(ReviveOfferPopup), findsOneWidget);
      expect(find.text('Revive'), findsOneWidget);
      expect(find.text('3 Premium revives left this game'), findsOneWidget);

      await tester.tap(find.text('Revive'));
      await pumpFrames(tester, 90);
      expect(find.byType(ReviveOfferPopup), findsNothing);
      expect(find.text('Play Again'), findsNothing);
      expect(game.gameOver, isFalse);
      expect(game.revivesUsed, 1);
      expect(game.board.filledCount, lessThan(filled));
    });

    testWidgets('declining or waiting out the revive ends the game', (tester) async {
      usePremiumPreview();
      final game = almostStuck();
      final l = await setUpGame(tester, game);
      await dragTo(tester, l, 0, dropPoint(l, 1, 1, 0, 1));
      await pumpFrames(tester, 40);
      expect(find.byType(ReviveOfferPopup), findsOneWidget);

      // The countdown declines by itself.
      await pumpFrames(tester, 11 * 60);
      await pumpFrames(tester, 100);
      expect(find.byType(ReviveOfferPopup), findsNothing);
      expect(find.text('Play Again'), findsOneWidget);
      expect(game.revivesUsed, 0);
    });

    testWidgets('No thanks goes straight to game over', (tester) async {
      usePremiumPreview();
      final game = almostStuck();
      final l = await setUpGame(tester, game);
      await dragTo(tester, l, 0, dropPoint(l, 1, 1, 0, 1));
      await pumpFrames(tester, 40);
      await tester.tap(find.text('No thanks'));
      await pumpFrames(tester, 100);
      expect(find.text('Play Again'), findsOneWidget);
    });
  });

  group('Free-tier banner space', () {
    testWidgets('the board and tray stay above the banner on small phones', (tester) async {
      AdsService.instance.enabled = true; // as on Android
      addTearDown(() => AdsService.instance.enabled = false);
      for (final size in const [Size(320, 568), Size(360, 640), Size(412, 915)]) {
        useSize(tester, size);
        final game = GameState.custom(board: Board(), tray: [p('v5', 0), p('sq3', 1), p('h5', 2)], random: Random(5));
        await tester.pumpWidget(MaterialApp(home: GameScreen(initialGame: game)));
        await pumpFrames(tester, 30);
        expect(tester.takeException(), isNull, reason: '$size');
        final banner = tester.getRect(find.byType(BannerAdSlot));
        expect(banner.bottom, closeTo(size.height, 0.5), reason: '$size');
        expect(banner.height, BannerAdSlot.height);
        // Tallest tray piece (5 cells) ends above the banner.
        final l = GameLayout.compute(Size(size.width, size.height - BannerAdSlot.height));
        final trayBottom = l.slotCenters[0].dy + 2.5 * l.trayCell;
        expect(trayBottom, lessThan(banner.top), reason: '$size');
        await tester.pumpWidget(const SizedBox());
      }
    });

    testWidgets('Premium players get the full height (no banner)', (tester) async {
      AdsService.instance.enabled = true;
      addTearDown(() => AdsService.instance.enabled = false);
      usePremiumPreview();
      useSize(tester, const Size(360, 640));
      await tester.pumpWidget(MaterialApp(home: GameScreen(initialGame: GameState(random: Random(1)))));
      await pumpFrames(tester, 30);
      expect(find.byType(BannerAdSlot), findsNothing);
    });
  });

  group('Skins', () {
    testWidgets('locked skins open Premium, unlocked ones apply', (tester) async {
      useSize(tester, const Size(393, 852));
      bindActiveSkin();
      var premiumOpened = 0;
      Widget picker() => MaterialApp(
        home: Scaffold(body: SkinPickerPopup(onClose: () {}, onPremium: () => premiumOpened++)),
      );
      await tester.pumpWidget(picker());
      await pumpFrames(tester, 30);
      await tester.tap(find.text('Neon'));
      await pumpFrames(tester, 10);
      expect(premiumOpened, 1);
      expect(ActiveSkin.value, BlockSkin.classic);

      usePremiumPreview();
      bindActiveSkin();
      await tester.pumpWidget(const SizedBox());
      await tester.pumpWidget(picker());
      await pumpFrames(tester, 30);
      await tester.tap(find.text('Neon'));
      await pumpFrames(tester, 10);
      expect(SettingsStore.instance.skinId, 'neon');
      expect(ActiveSkin.value, BlockSkin.neon);
      expect(find.text('In use'), findsOneWidget);
    });

    test('a premium skin is not shown once Premium ends', () {
      final store = FakeStore()..owned = [purchase('premium_monthly', acknowledged: true)];
      final service = PremiumService(store: store, verifier: FakeVerifier());
      PremiumService.instance = service;
      bindActiveSkin();
      SettingsStore.instance.skinId = 'gem';
      expect(ActiveSkin.value, BlockSkin.classic); // not premium yet
      return service.init().then((_) async {
        expect(ActiveSkin.value, BlockSkin.gem);
        store.owned = [];
        await service.restore();
        expect(ActiveSkin.value, BlockSkin.classic);
        expect(SettingsStore.instance.skinId, 'gem'); // remembered
      });
    });

    test('every skin paints every block color', () {
      for (final skin in BlockSkin.values) {
        for (var color = 0; color < Palette.blocks.length; color++) {
          final recorder = ui.PictureRecorder();
          final canvas = Canvas(recorder);
          paintSkinBlock(canvas, const Rect.fromLTWH(0, 0, 48, 48), Palette.blocks[color], skin);
          final picture = recorder.endRecording();
          expect(picture.approximateBytesUsed, greaterThan(0));
          picture.dispose();
        }
      }
    });
  });
}

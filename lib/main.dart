import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'src/game/debug_scenarios.dart';
import 'src/game/game_screen.dart';
import 'src/premium/benefits.dart';
import 'src/premium/play_store.dart';
import 'src/premium/premium_service.dart';
import 'src/premium/store.dart';
import 'src/premium/verifier.dart';
import 'src/screens/home_screen.dart';
import 'src/screens/premium_screen.dart';
import 'src/screens/splash_screens.dart';
import 'src/services/ads_service.dart';
import 'src/services/perf_log.dart';
import 'src/services/settings_store.dart';
import 'src/ui/palette.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  // Report errors with a marker so device tests can detect them in logcat.
  FlutterError.onError = (details) {
    FlutterError.presentError(details);
    debugPrint('BB_ERROR ${details.exceptionAsString()}');
  };
  PlatformDispatcher.instance.onError = (error, stack) {
    debugPrint('BB_ERROR $error');
    return true;
  };
  await SystemChrome.setPreferredOrientations([DeviceOrientation.portraitUp]);
  SystemChrome.setSystemUIOverlayStyle(
    const SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarIconBrightness: Brightness.light,
      systemNavigationBarColor: Palette.background,
      systemNavigationBarIconBrightness: Brightness.light,
    ),
  );
  await SettingsStore.load();
  _setUpMonetization();
  PerfLog.start();
  runApp(const BlockBlastApp());
  // Restores Premium from the cache, then checks Google Play in the background.
  unawaited(PremiumService.instance.init());
}

/// Google Play Billing and AdMob on Android; a store-less free tier elsewhere.
void _setUpMonetization() {
  final android = !kIsWeb && defaultTargetPlatform == TargetPlatform.android;
  PremiumService.instance = PremiumService(
    store: android ? PlayStore() : UnavailableStore(),
    verifier: PlatformPurchaseVerifier(),
    // Developer preview builds only (never for distribution).
    preview: const bool.fromEnvironment('PREMIUM_PREVIEW') || DebugScenarios.premiumPreview,
  );
  AdsService.instance.enabled = android;
  final qaSkin = DebugScenarios.skin;
  if (qaSkin != null) SettingsStore.instance.skinId = qaSkin;
  bindActiveSkin();
}

class BlockBlastApp extends StatelessWidget {
  const BlockBlastApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Block Blast',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: Palette.background),
        scaffoldBackgroundColor: Palette.background,
        fontFamily: 'Fredoka',
        splashFactory: NoSplash.splashFactory,
      ),
      // Game UI is drawn to fit the screen; keep large system font sizes
      // from overflowing the menus.
      builder: (context, child) => MediaQuery.withClampedTextScaling(maxScaleFactor: 1.15, child: child!),
      home: _startScreen(),
    );
  }

  Widget _startScreen() {
    if (DebugScenarios.skipSplash) return const GameScreen();
    switch (DebugScenarios.screen) {
      case 'home':
        return const HomeScreen();
      case 'premium':
        return const PremiumScreen(source: 'qa');
    }
    return const IconSplashScreen();
  }
}

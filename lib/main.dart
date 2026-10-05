import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'src/game/debug_scenarios.dart';
import 'src/game/game_screen.dart';
import 'src/screens/splash_screens.dart';
import 'src/services/settings_store.dart';
import 'src/ui/palette.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
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
  runApp(const BlockBlastApp());
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
        fontFamily: 'Fredoka',
        splashFactory: NoSplash.splashFactory,
      ),
      home: DebugScenarios.skipSplash ? const GameScreen() : const IconSplashScreen(),
    );
  }
}

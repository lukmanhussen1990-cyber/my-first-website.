import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

/// Loads the bundled game fonts so widget tests measure text like a device
/// (instead of the square "Ahem" test font).
Future<void> loadAppFonts() async {
  TestWidgetsFlutterBinding.ensureInitialized();
  final fredoka = FontLoader('Fredoka')..addFont(rootBundle.load('assets/fonts/Fredoka.ttf'));
  final poppins = FontLoader('Poppins')
    ..addFont(rootBundle.load('assets/fonts/Poppins-Bold.ttf'))
    ..addFont(rootBundle.load('assets/fonts/Poppins-ExtraBold.ttf'));
  await Future.wait([fredoka.load(), poppins.load()]);
}

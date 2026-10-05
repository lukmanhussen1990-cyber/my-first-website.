import 'dart:io';

import 'package:blockblast/src/version.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('settings version label matches pubspec.yaml', () {
    final pubspec = File('pubspec.yaml').readAsStringSync();
    final match = RegExp(r'^version:\s*([0-9.]+)\+', multiLine: true).firstMatch(pubspec);
    expect(match, isNotNull);
    expect(kAppVersion, match!.group(1));
  });
}

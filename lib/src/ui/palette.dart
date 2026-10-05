import 'package:flutter/painting.dart';

/// Shaded colors for one block color (sampled from the original game).
class BlockColors {
  final Color face;
  final Color top;
  final Color left;
  final Color right;
  final Color bottom;
  final Color outline;
  final Color glow;

  const BlockColors({
    required this.face,
    required this.top,
    required this.left,
    required this.right,
    required this.bottom,
    required this.outline,
    required this.glow,
  });
}

class Palette {
  Palette._();

  // Screen colors.
  static const background = Color(0xFF3A5193);
  static const backgroundDark = Color(0xFF2F4583);
  static const boardFrame = Color(0xFF2C3B74);
  static const boardFrameLight = Color(0xFF5675C9);
  static const boardInner = Color(0xFF1C2349);
  static const boardCell = Color(0xFF232A54);
  static const gold = Color(0xFFFFBB05);
  static const goldText = Color(0xFFFDB72F);
  static const gear = Color(0xFFBEE3F6);
  static const badge = Color(0xFFEF0002);
  static const diamond = Color(0xFF3F97EA);

  // Splash / home gradient.
  static const splashTop = Color(0xFF2F6BE0);
  static const splashBottom = Color(0xFF1F4FBF);

  static const List<String> colorNames = [
    'red',
    'orange',
    'yellow',
    'green',
    'light blue',
    'blue',
    'purple',
  ];

  /// Index 0..6 = piece colors, index 7 = gray (game over).
  static const List<BlockColors> blocks = [
    // Red
    BlockColors(
      face: Color(0xFFC82E34),
      top: Color(0xFFF08484),
      left: Color(0xFFD3413F),
      right: Color(0xFFAA2323),
      bottom: Color(0xFF871D26),
      outline: Color(0xFF600E08),
      glow: Color(0xFFFF6B6B),
    ),
    // Orange
    BlockColors(
      face: Color(0xFFE87520),
      top: Color(0xFFFCB77F),
      left: Color(0xFFF78530),
      right: Color(0xFFC15B14),
      bottom: Color(0xFF9A4406),
      outline: Color(0xFF6A2E02),
      glow: Color(0xFFFFA858),
    ),
    // Yellow
    BlockColors(
      face: Color(0xFFE9B335),
      top: Color(0xFFF7E374),
      left: Color(0xFFF3C63D),
      right: Color(0xFFC9941A),
      bottom: Color(0xFFB17316),
      outline: Color(0xFF583000),
      glow: Color(0xFFFFE27A),
    ),
    // Green
    BlockColors(
      face: Color(0xFF34B53B),
      top: Color(0xFF83EE9B),
      left: Color(0xFF34C845),
      right: Color(0xFF149130),
      bottom: Color(0xFF106F21),
      outline: Color(0xFF0B4E17),
      glow: Color(0xFF7CFF8A),
    ),
    // Light blue
    BlockColors(
      face: Color(0xFF2CB5E1),
      top: Color(0xFF92E6FF),
      left: Color(0xFF40C2EB),
      right: Color(0xFF1790CE),
      bottom: Color(0xFF046CA2),
      outline: Color(0xFF024A70),
      glow: Color(0xFF8BE9FF),
    ),
    // Blue
    BlockColors(
      face: Color(0xFF3B5BDF),
      top: Color(0xFF8CB2FE),
      left: Color(0xFF4265EF),
      right: Color(0xFF254AC1),
      bottom: Color(0xFF263690),
      outline: Color(0xFF14205E),
      glow: Color(0xFF8FB0FF),
    ),
    // Purple
    BlockColors(
      face: Color(0xFF884FD3),
      top: Color(0xFFD894EF),
      left: Color(0xFF9860D6),
      right: Color(0xFF71379C),
      bottom: Color(0xFF592483),
      outline: Color(0xFF3A1460),
      glow: Color(0xFFD9A2FF),
    ),
    // Gray (game over)
    BlockColors(
      face: Color(0xFF7D8597),
      top: Color(0xFFB9C0CE),
      left: Color(0xFF8A92A4),
      right: Color(0xFF646C7E),
      bottom: Color(0xFF4E5566),
      outline: Color(0xFF353A47),
      glow: Color(0xFFCCD2DD),
    ),
  ];

  static const int gray = 7;
}

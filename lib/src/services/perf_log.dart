import 'package:flutter/foundation.dart';
import 'package:flutter/scheduler.dart';

/// Logs a short frame-timing summary (UI build and raster time per frame)
/// every few seconds while frames are being produced. Device tests read the
/// `BB_PERF` lines from logcat.
class PerfLog {
  PerfLog._();

  static int _frames = 0;
  static int _buildUs = 0;
  static int _rasterUs = 0;
  static int _worstUs = 0;
  static int _slow = 0;
  static DateTime _last = DateTime.now();

  static void start() {
    SchedulerBinding.instance.addTimingsCallback(_onTimings);
  }

  static void _onTimings(List<FrameTiming> timings) {
    for (final t in timings) {
      final build = t.buildDuration.inMicroseconds;
      final raster = t.rasterDuration.inMicroseconds;
      _frames++;
      _buildUs += build;
      _rasterUs += raster;
      final total = t.totalSpan.inMicroseconds;
      if (total > _worstUs) _worstUs = total;
      if (build > 16667 || raster > 16667) _slow++;
    }
    final now = DateTime.now();
    if (now.difference(_last).inSeconds >= 5 && _frames >= 30) {
      debugPrint('BB_PERF frames=$_frames avgBuild=${(_buildUs / _frames / 1000).toStringAsFixed(2)}ms '
          'avgRaster=${(_rasterUs / _frames / 1000).toStringAsFixed(2)}ms '
          'worst=${(_worstUs / 1000).toStringAsFixed(1)}ms over16ms=$_slow');
      _frames = _buildUs = _rasterUs = _worstUs = _slow = 0;
      _last = now;
    }
  }
}

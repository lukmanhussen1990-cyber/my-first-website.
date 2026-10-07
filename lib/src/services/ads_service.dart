import 'dart:async';

import 'package:flutter/material.dart';
import 'package:google_mobile_ads/google_mobile_ads.dart';

import '../premium/premium_service.dart';

/// AdMob ad unit IDs. The defaults are Google's public test units (they show
/// "Test Ad"); store builds pass real IDs with --dart-define, see
/// docs/MONETIZATION.md.
class AdUnits {
  AdUnits._();

  static const String banner = String.fromEnvironment(
    'ADMOB_BANNER_ID',
    defaultValue: 'ca-app-pub-3940256099942544/6300978111',
  );
  static const String interstitial = String.fromEnvironment(
    'ADMOB_INTERSTITIAL_ID',
    defaultValue: 'ca-app-pub-3940256099942544/1033173712',
  );
  static const String rewarded = String.fromEnvironment(
    'ADMOB_REWARDED_ID',
    defaultValue: 'ca-app-pub-3940256099942544/5224354917',
  );
}

/// Ads for the free tier: a banner under the game, an occasional
/// interstitial between games and an optional rewarded ad to revive.
/// Premium players get none of them (and are never asked for ad consent).
class AdsService extends ChangeNotifier {
  AdsService._();

  static final AdsService instance = AdsService._();

  /// Turned on by main() on Android. Off in tests and on the web.
  bool enabled = false;

  /// Minimum time between two interstitials.
  static const Duration interstitialGap = Duration(minutes: 3);

  /// No interstitial during the first minutes of a session.
  static const Duration interstitialGrace = Duration(minutes: 2);

  bool _listening = false;
  bool _started = false;
  bool _sdkReady = false;
  bool _canRequestAds = false;
  bool privacyOptionsRequired = false;

  RewardedAd? _rewarded;
  bool _rewardedLoading = false;
  int _rewardedFailures = 0;
  InterstitialAd? _interstitial;
  bool _interstitialLoading = false;
  int _interstitialFailures = 0;
  DateTime? _lastInterstitial;
  final DateTime _sessionStart = DateTime.now();
  int _gamesFinished = 0;

  /// True while a full-screen ad covers the game.
  bool showingFullScreen = false;

  /// Ads may be requested: free tier, consent obtained (or not needed), SDK up.
  bool get adsAllowed => enabled && PremiumService.instance.showsAds && _sdkReady && _canRequestAds;

  /// Space the game screen keeps free for the banner (free tier on Android).
  bool get reservesBanner => enabled && PremiumService.instance.showsAds;

  bool get rewardedReady => adsAllowed && _rewarded != null;

  /// Gathers consent (Google UMP) and starts the SDK for free players.
  Future<void> start() async {
    if (!enabled) return;
    if (!_listening) {
      _listening = true;
      PremiumService.instance.addListener(_onPremiumChanged);
    }
    await PremiumService.instance.ready;
    if (_started || !PremiumService.instance.showsAds) return;
    _started = true;
    await _gatherConsent();
    if (_canRequestAds) {
      try {
        await MobileAds.instance.initialize();
        _sdkReady = true;
        _preload();
      } catch (e) {
        debugPrint('BB_ADS init failed: $e');
      }
    }
    debugPrint('BB_ADS ready=$_sdkReady consent=$_canRequestAds');
    notifyListeners();
  }

  Future<void> _gatherConsent() async {
    final done = Completer<void>();
    try {
      ConsentInformation.instance.requestConsentInfoUpdate(
        ConsentRequestParameters(),
        () {
          ConsentForm.loadAndShowConsentFormIfRequired((FormError? error) {
            if (error != null) debugPrint('BB_ADS consent form: ${error.message}');
            if (!done.isCompleted) done.complete();
          });
        },
        (FormError error) {
          debugPrint('BB_ADS consent info: ${error.message}');
          if (!done.isCompleted) done.complete();
        },
      );
      await done.future.timeout(const Duration(minutes: 2), onTimeout: () {});
      // Also true when consent was gathered in an earlier session.
      _canRequestAds = await ConsentInformation.instance.canRequestAds();
      privacyOptionsRequired =
          await ConsentInformation.instance.getPrivacyOptionsRequirementStatus() ==
          PrivacyOptionsRequirementStatus.required;
    } catch (e) {
      debugPrint('BB_ADS consent failed: $e');
    }
  }

  /// Lets the player review their ad privacy choices (required in some regions).
  Future<void> showPrivacyOptions() async {
    if (!enabled) return;
    final done = Completer<void>();
    try {
      await ConsentForm.showPrivacyOptionsForm((FormError? error) {
        if (!done.isCompleted) done.complete();
      });
      await done.future;
      _canRequestAds = await ConsentInformation.instance.canRequestAds();
      if (_canRequestAds && !_sdkReady && PremiumService.instance.showsAds) {
        await MobileAds.instance.initialize();
        _sdkReady = true;
        _preload();
      }
    } catch (e) {
      debugPrint('BB_ADS privacy options failed: $e');
    }
    notifyListeners();
  }

  void _onPremiumChanged() {
    if (!PremiumService.instance.showsAds) {
      _rewarded?.dispose();
      _rewarded = null;
      _interstitial?.dispose();
      _interstitial = null;
    } else if (!_started) {
      unawaited(start());
    } else {
      _preload();
    }
    notifyListeners();
  }

  void _preload() {
    if (!adsAllowed) return;
    _loadRewarded();
    _loadInterstitial();
  }

  void _retry(int failures, VoidCallback load) {
    if (failures > 6) return;
    Timer(Duration(seconds: 20 * failures), load);
  }

  void _loadRewarded() {
    if (!adsAllowed || _rewarded != null || _rewardedLoading) return;
    _rewardedLoading = true;
    RewardedAd.load(
      adUnitId: AdUnits.rewarded,
      request: const AdRequest(),
      rewardedAdLoadCallback: RewardedAdLoadCallback(
        onAdLoaded: (ad) {
          _rewardedLoading = false;
          _rewardedFailures = 0;
          if (!PremiumService.instance.showsAds) {
            ad.dispose();
            return;
          }
          _rewarded = ad;
          notifyListeners();
        },
        onAdFailedToLoad: (error) {
          _rewardedLoading = false;
          debugPrint('BB_ADS rewarded failed: ${error.message}');
          _retry(++_rewardedFailures, _loadRewarded);
        },
      ),
    );
  }

  void _loadInterstitial() {
    if (!adsAllowed || _interstitial != null || _interstitialLoading) return;
    _interstitialLoading = true;
    InterstitialAd.load(
      adUnitId: AdUnits.interstitial,
      request: const AdRequest(),
      adLoadCallback: InterstitialAdLoadCallback(
        onAdLoaded: (ad) {
          _interstitialLoading = false;
          _interstitialFailures = 0;
          if (!PremiumService.instance.showsAds) {
            ad.dispose();
            return;
          }
          _interstitial = ad;
        },
        onAdFailedToLoad: (error) {
          _interstitialLoading = false;
          debugPrint('BB_ADS interstitial failed: ${error.message}');
          _retry(++_interstitialFailures, _loadInterstitial);
        },
      ),
    );
  }

  /// Shows the rewarded ad. Completes with true once the reward was earned.
  Future<bool> showRewarded() async {
    final ad = _rewarded;
    if (!adsAllowed || ad == null) return false;
    _rewarded = null;
    final result = Completer<bool>();
    var earned = false;
    ad.fullScreenContentCallback = FullScreenContentCallback(
      onAdDismissedFullScreenContent: (ad) {
        ad.dispose();
        _fullScreenEnded();
        if (!result.isCompleted) result.complete(earned);
        _loadRewarded();
      },
      onAdFailedToShowFullScreenContent: (ad, error) {
        ad.dispose();
        _fullScreenEnded();
        if (!result.isCompleted) result.complete(false);
        _loadRewarded();
      },
    );
    showingFullScreen = true;
    notifyListeners();
    try {
      await ad.show(onUserEarnedReward: (ad, reward) => earned = true);
    } catch (e) {
      _fullScreenEnded();
      if (!result.isCompleted) result.complete(false);
    }
    return result.future;
  }

  /// Call when a game ends (counts games for interstitial pacing).
  void noteGameFinished() => _gamesFinished++;

  /// Before the next game: shows an interstitial if one is due. Never after
  /// the first game, in the first minutes, or more often than
  /// [interstitialGap]. Completes when the ad is closed (or right away).
  Future<void> maybeShowInterstitial() async {
    final ad = _interstitial;
    if (!adsAllowed || ad == null || _gamesFinished < 2) return;
    final now = DateTime.now();
    if (now.difference(_sessionStart) < interstitialGrace) return;
    if (_lastInterstitial != null && now.difference(_lastInterstitial!) < interstitialGap) return;
    _interstitial = null;
    _lastInterstitial = now;
    final done = Completer<void>();
    ad.fullScreenContentCallback = FullScreenContentCallback(
      onAdDismissedFullScreenContent: (ad) {
        ad.dispose();
        _fullScreenEnded();
        if (!done.isCompleted) done.complete();
        _loadInterstitial();
      },
      onAdFailedToShowFullScreenContent: (ad, error) {
        ad.dispose();
        _fullScreenEnded();
        if (!done.isCompleted) done.complete();
        _loadInterstitial();
      },
    );
    showingFullScreen = true;
    notifyListeners();
    try {
      await ad.show();
    } catch (e) {
      _fullScreenEnded();
      if (!done.isCompleted) done.complete();
    }
    return done.future;
  }

  void _fullScreenEnded() {
    showingFullScreen = false;
    notifyListeners();
  }
}

/// Banner under the game for free players. Keeps its space reserved (so the
/// board never jumps) and stays empty until an ad has loaded.
class BannerAdSlot extends StatefulWidget {
  const BannerAdSlot({super.key});

  static const double height = 58;

  @override
  State<BannerAdSlot> createState() => _BannerAdSlotState();
}

class _BannerAdSlotState extends State<BannerAdSlot> {
  BannerAd? _ad;
  bool _loaded = false;

  @override
  void initState() {
    super.initState();
    AdsService.instance.addListener(_sync);
    _sync();
  }

  @override
  void dispose() {
    AdsService.instance.removeListener(_sync);
    _ad?.dispose();
    super.dispose();
  }

  void _sync() {
    final allowed = AdsService.instance.adsAllowed;
    if (allowed && _ad == null) {
      final ad = BannerAd(
        size: AdSize.banner,
        adUnitId: AdUnits.banner,
        request: const AdRequest(),
        listener: BannerAdListener(
          onAdLoaded: (_) {
            if (mounted) setState(() => _loaded = true);
          },
          onAdFailedToLoad: (ad, error) {
            debugPrint('BB_ADS banner failed: ${error.message}');
            ad.dispose();
            if (mounted) {
              setState(() {
                _ad = null;
                _loaded = false;
              });
            }
          },
        ),
      );
      _ad = ad;
      ad.load();
    } else if (!allowed && _ad != null) {
      _ad!.dispose();
      setState(() {
        _ad = null;
        _loaded = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final ad = _ad;
    return SizedBox(
      height: BannerAdSlot.height,
      width: double.infinity,
      child: ad != null && _loaded
          ? Center(
              child: SizedBox(
                width: ad.size.width.toDouble(),
                height: ad.size.height.toDouble(),
                child: AdWidget(ad: ad),
              ),
            )
          : null,
    );
  }
}

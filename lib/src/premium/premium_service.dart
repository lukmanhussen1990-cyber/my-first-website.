import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';

import '../services/settings_store.dart';
import 'plans.dart';
import 'store.dart';
import 'verifier.dart';

/// What each tier gets per game.
class Allowance {
  Allowance._();

  static const int freeHints = 1;
  static const int premiumHints = 5;

  /// Free players can revive once per game by watching a rewarded ad.
  static const int freeRevives = 1;

  /// Premium players revive instantly, without ads.
  static const int premiumRevives = 3;
}

enum NoticeKind { success, info, error }

/// One-off message for the UI (shown as a toast on the Premium screen).
class PremiumNotice {
  final String text;
  final NoticeKind kind;
  final int id;

  const PremiumNotice(this.text, this.kind, this.id);
}

/// A verified subscription purchase, cached so Premium works offline.
class Entitlement {
  final String productId;
  final String purchaseToken;
  final String signedData;
  final String signature;
  final bool autoRenewing;
  final DateTime verifiedAt;

  const Entitlement({
    required this.productId,
    required this.purchaseToken,
    required this.signedData,
    required this.signature,
    required this.autoRenewing,
    required this.verifiedAt,
  });

  PremiumPlan? get plan => PremiumPlanInfo.fromProductId(productId);

  Map<String, dynamic> toJson() => {
    'product': productId,
    'token': purchaseToken,
    'data': signedData,
    'sig': signature,
    'renew': autoRenewing,
    'at': verifiedAt.millisecondsSinceEpoch,
  };

  static Entitlement? fromJson(Object? json) {
    if (json is! Map) return null;
    try {
      return Entitlement(
        productId: json['product'] as String,
        purchaseToken: json['token'] as String,
        signedData: json['data'] as String,
        signature: json['sig'] as String,
        autoRenewing: json['renew'] as bool? ?? true,
        verifiedAt: DateTime.fromMillisecondsSinceEpoch((json['at'] as num).toInt()),
      );
    } catch (_) {
      return null;
    }
  }

  StorePurchase toPurchase() => StorePurchase(
    productId: productId,
    status: StorePurchaseStatus.restored,
    purchaseToken: purchaseToken,
    signedData: signedData,
    signature: signature,
    acknowledged: true,
    autoRenewing: autoRenewing,
  );
}

enum RestoreOutcome { restored, nothingFound, unverified, failed }

/// Owns the subscription state: store prices, purchases, verification and
/// the Premium entitlement every benefit checks.
///
/// Benefits unlock only after a purchase passed verification
/// ([PurchaseVerifier]); purchases are acknowledged only after that, so a
/// purchase that can't be verified is refunded by Google Play.
class PremiumService extends ChangeNotifier {
  PremiumService({
    required this.store,
    required this.verifier,
    this.settings,
    this.preview = false,
    DateTime Function()? clock,
  }) : _clock = clock ?? DateTime.now;

  static PremiumService? _instance;

  /// The app-wide service. Defaults to a store-less free tier (tests, web).
  static PremiumService get instance =>
      _instance ??= PremiumService(store: UnavailableStore(), verifier: const _NoVerifier());
  static set instance(PremiumService value) => _instance = value;

  @visibleForTesting
  static void reset() => _instance = null;

  final SubscriptionStore store;
  final PurchaseVerifier verifier;
  /// Storage for the entitlement cache (the app-wide store when null).
  final SettingsStore? settings;
  final DateTime Function() _clock;

  /// Developer preview (`--dart-define=PREMIUM_PREVIEW=true` or the web QA
  /// scenario): every benefit unlocked without a purchase. Never set in
  /// release builds that are distributed.
  final bool preview;

  static const String _kCache = 'premium_entitlement_v1';

  /// A cached entitlement is honored without reaching Google Play for this
  /// long (offline play). Play is asked again on every start.
  static const Duration offlineGrace = Duration(days: 14);

  SettingsStore get _store => settings ?? SettingsStore.instance;

  Entitlement? _entitlement;
  StorePurchase? _activePurchase;
  StreamSubscription<List<StorePurchase>>? _sub;

  Future<void>? _initFuture;
  final Completer<void> _cacheChecked = Completer<void>();

  /// False until the first Google Play availability check has finished.
  bool storeChecked = false;
  bool storeAvailable = false;
  bool loadingProducts = false;
  bool purchasing = false;
  bool restoring = false;
  bool paymentPending = false;
  String? productsError;
  final Map<PremiumPlan, PlanOffer> _storeOffers = {};

  final ValueNotifier<PremiumNotice?> notice = ValueNotifier(null);
  int _noticeId = 0;

  // ---------------------------------------------------------------------------
  // Entitlement & benefits
  // ---------------------------------------------------------------------------

  bool get isPremium => preview || _entitlement != null;
  Entitlement? get entitlement => _entitlement;
  PremiumPlan? get activePlan => _entitlement?.plan;

  /// Completes once the cached entitlement has been checked at startup.
  Future<void> get ready => _cacheChecked.future;

  int get hintsPerGame => isPremium ? Allowance.premiumHints : Allowance.freeHints;
  int get revivesPerGame => isPremium ? Allowance.premiumRevives : Allowance.freeRevives;
  bool get showsAds => !isPremium;
  bool get revivesNeedAd => !isPremium;
  bool canUseSkin(String skinId) => skinId == 'classic' || isPremium;

  // ---------------------------------------------------------------------------
  // Prices
  // ---------------------------------------------------------------------------

  /// True when every plan's price came from Google Play.
  bool get hasStorePrices => PremiumPlan.values.every(_storeOffers.containsKey);

  /// Localized store price when known, otherwise the USD reference price.
  PlanOffer offerFor(PremiumPlan plan) => _storeOffers[plan] ?? PlanOffer.reference(plan);

  bool canPurchase(PremiumPlan plan) => storeAvailable && _storeOffers.containsKey(plan);

  // ---------------------------------------------------------------------------
  // Startup
  // ---------------------------------------------------------------------------

  /// Restores the cached entitlement, connects to the store, loads prices
  /// and re-checks owned subscriptions. Safe to call more than once.
  Future<void> init() => _initFuture ??= _init();

  Future<void> _init() async {
    await _loadCache();
    if (!_cacheChecked.isCompleted) _cacheChecked.complete();
    _sub = store.purchaseUpdates.listen(_onPurchaseUpdates, onError: (Object e) {
      debugPrint('BB_IAP stream error $e');
    });
    try {
      storeAvailable = await store.isAvailable();
    } catch (e) {
      storeAvailable = false;
    }
    if (storeAvailable) {
      loadingProducts = true; // keep "connecting" until prices are in
    }
    storeChecked = true;
    debugPrint('BB_IAP available=$storeAvailable premium=$isPremium');
    notifyListeners();
    if (!storeAvailable) return;
    loadingProducts = false;
    await refreshProducts();
    await _syncOwned(userInitiated: false);
  }

  Future<void> _loadCache() async {
    final raw = _store.readString(_kCache);
    if (raw == null) return;
    Entitlement? cached;
    try {
      cached = Entitlement.fromJson(jsonDecode(raw));
    } catch (_) {}
    if (cached == null || _clock().difference(cached.verifiedAt) > offlineGrace) {
      _store.removeKey(_kCache);
      return;
    }
    // The cache holds Google's signed purchase, so it can't be forged:
    // re-check the signature before trusting it.
    final outcome = await verifier.verify(cached.toPurchase());
    if (outcome == VerifyOutcome.valid) {
      _entitlement = cached;
      notifyListeners();
    } else {
      _store.removeKey(_kCache);
    }
  }

  @override
  void dispose() {
    _sub?.cancel();
    notice.dispose();
    super.dispose();
  }

  // ---------------------------------------------------------------------------
  // Products
  // ---------------------------------------------------------------------------

  Future<void> refreshProducts() async {
    if (!storeAvailable || loadingProducts) return;
    loadingProducts = true;
    notifyListeners();
    try {
      final result = await store.queryProducts({for (final p in PremiumPlan.values) p.productId});
      _storeOffers.clear();
      for (final product in result.products) {
        final plan = PremiumPlanInfo.fromProductId(product.productId);
        if (plan == null) continue;
        _storeOffers[plan] = PlanOffer(
          plan: plan,
          priceText: product.priceText,
          priceMicros: product.priceMicros,
          currencyCode: product.currencyCode,
          period: BillingPeriod.parse(product.billingPeriod),
          fromStore: true,
          storeHandle: product,
        );
      }
      productsError = result.error;
      if (result.notFound.isNotEmpty) {
        debugPrint('BB_IAP products not found: ${result.notFound.join(', ')}');
      }
    } catch (e) {
      productsError = '$e';
    } finally {
      loadingProducts = false;
      notifyListeners();
    }
  }

  // ---------------------------------------------------------------------------
  // Buying
  // ---------------------------------------------------------------------------

  /// Starts the Google Play purchase flow for [plan]. When the player already
  /// has a different plan, Play switches the subscription (prorated).
  Future<bool> buy(PremiumPlan plan) async {
    if (preview) {
      _notify('Preview build: purchases are disabled.', NoticeKind.info);
      return false;
    }
    if (purchasing) return false;
    // Tapped while the store is still connecting: wait for the prices.
    final starting = _initFuture;
    if (starting != null && (!storeChecked || loadingProducts)) await starting;
    if (_entitlement != null && activePlan == plan) {
      _notify('You already have the ${plan.label} plan.', NoticeKind.info);
      return false;
    }
    final offer = _storeOffers[plan];
    if (!storeAvailable || offer == null) {
      _notify(
        'Subscriptions are available in the Google Play version of Block Blast. '
        'Make sure Google Play is installed and you are signed in.',
        NoticeKind.error,
      );
      return false;
    }
    if (_entitlement != null && _activePurchase?.handle == null) {
      // Premium is only known from the offline cache: fetch the live
      // subscription first so Play switches plans instead of adding a
      // second subscription.
      await _syncOwned(userInitiated: false);
      if (_entitlement != null && _activePurchase?.handle == null) {
        _notify("Couldn't reach Google Play. Check your connection and try again.", NoticeKind.error);
        return false;
      }
    }
    // Re-checked here (no await before it is set) so a double tap that
    // waited for the store above cannot start a second purchase.
    if (purchasing) return false;
    purchasing = true;
    paymentPending = false;
    notifyListeners();
    try {
      final replacing = _entitlement != null ? _activePurchase : null;
      final started = await store.buy(offer.storeHandle! as StoreProduct, replacing: replacing);
      if (!started) {
        purchasing = false;
        _notify('Google Play could not start the purchase. Please try again.', NoticeKind.error);
      }
      return started;
    } catch (e) {
      purchasing = false;
      _notify(_friendlyError('$e'), NoticeKind.error);
      return false;
    } finally {
      notifyListeners();
    }
  }

  Future<void> _onPurchaseUpdates(List<StorePurchase> purchases) async {
    for (final p in purchases) {
      final known = PremiumPlanInfo.fromProductId(p.productId) != null;
      switch (p.status) {
        case StorePurchaseStatus.pending:
          if (!known) continue;
          purchasing = false;
          paymentPending = true;
          _notify(
            'Payment pending. Premium unlocks as soon as Google Play confirms your payment.',
            NoticeKind.info,
          );
        case StorePurchaseStatus.purchased:
        case StorePurchaseStatus.restored:
          if (!known) continue;
          await _verifyAndGrant(p, announce: true);
        case StorePurchaseStatus.canceled:
          purchasing = false;
        case StorePurchaseStatus.error:
          purchasing = false;
          final message = p.errorMessage ?? '';
          if (message.contains('itemAlreadyOwned')) {
            await restore();
          } else {
            _notify(_friendlyError(message), NoticeKind.error);
          }
      }
    }
    notifyListeners();
  }

  Future<bool> _verifyAndGrant(StorePurchase p, {required bool announce}) async {
    final outcome = await verifier.verify(p);
    purchasing = false;
    if (outcome != VerifyOutcome.valid) {
      debugPrint('BB_IAP verification failed ($outcome) for ${p.productId}');
      if (announce) {
        _notify(
          "We couldn't verify this purchase, so Premium wasn't unlocked. "
          'Google Play refunds purchases that are not confirmed within 3 days.',
          NoticeKind.error,
        );
      }
      return false;
    }
    final wasPremium = _entitlement != null;
    final previousPlan = activePlan;
    _grant(p);
    if (!p.acknowledged) {
      try {
        await store.complete(p);
      } catch (e) {
        // Acknowledged again on the next start (owned purchases are re-checked).
        debugPrint('BB_IAP acknowledge failed: $e');
      }
    }
    if (announce) {
      final plan = PremiumPlanInfo.fromProductId(p.productId);
      if (wasPremium && previousPlan != plan && plan != null) {
        _notify('Your plan is now ${plan.label}.', NoticeKind.success);
      } else {
        _notify('Welcome to Premium! All benefits are unlocked.', NoticeKind.success);
      }
    }
    return true;
  }

  void _grant(StorePurchase p) {
    paymentPending = false;
    _activePurchase = p;
    _entitlement = Entitlement(
      productId: p.productId,
      purchaseToken: p.purchaseToken,
      signedData: p.signedData,
      signature: p.signature,
      autoRenewing: p.autoRenewing,
      verifiedAt: _clock(),
    );
    _store.writeString(_kCache, jsonEncode(_entitlement!.toJson()));
    debugPrint('BB_IAP premium active plan=${p.productId}');
    notifyListeners();
  }

  void _revoke() {
    if (_entitlement == null && _activePurchase == null) return;
    _entitlement = null;
    _activePurchase = null;
    _store.removeKey(_kCache);
    debugPrint('BB_IAP premium inactive');
    notifyListeners();
  }

  // ---------------------------------------------------------------------------
  // Restore & sync
  // ---------------------------------------------------------------------------

  /// "Restore Purchases": asks Google Play for the subscriptions owned by the
  /// signed-in account and unlocks Premium if one verifies.
  Future<RestoreOutcome> restore() async {
    if (preview) {
      _notify('Preview build: Premium is already unlocked.', NoticeKind.info);
      return RestoreOutcome.restored;
    }
    if (restoring) return RestoreOutcome.failed;
    final starting = _initFuture;
    if (starting != null && !storeChecked) await starting;
    if (!storeAvailable) {
      try {
        storeAvailable = await store.isAvailable();
      } catch (_) {}
      if (storeAvailable) await refreshProducts();
    }
    if (!storeAvailable) {
      _notify("Google Play isn't available, so purchases can't be restored right now.", NoticeKind.error);
      return RestoreOutcome.failed;
    }
    restoring = true;
    notifyListeners();
    try {
      return await _syncOwned(userInitiated: true);
    } finally {
      restoring = false;
      notifyListeners();
    }
  }

  /// Re-reads owned subscriptions from Google Play. Play only returns active
  /// subscriptions, so an empty answer means Premium has ended.
  Future<RestoreOutcome> _syncOwned({required bool userInitiated}) async {
    List<StorePurchase> owned;
    try {
      owned = await store.queryOwned();
    } catch (e) {
      debugPrint('BB_IAP owned query failed: $e');
      if (userInitiated) {
        _notify("Couldn't reach Google Play. Check your connection and try again.", NoticeKind.error);
      }
      return RestoreOutcome.failed;
    }
    final ours = [
      for (final p in owned)
        if (PremiumPlanInfo.fromProductId(p.productId) != null) p,
    ];
    StorePurchase? best;
    var pending = false;
    var unverified = false;
    for (final p in ours) {
      if (p.status == StorePurchaseStatus.pending) {
        pending = true;
        continue;
      }
      if (p.status != StorePurchaseStatus.purchased && p.status != StorePurchaseStatus.restored) continue;
      final outcome = await verifier.verify(p);
      if (outcome != VerifyOutcome.valid) {
        unverified = true;
        continue;
      }
      if (!p.acknowledged) {
        try {
          await store.complete(p);
        } catch (e) {
          debugPrint('BB_IAP acknowledge failed: $e');
        }
      }
      // Prefer a renewing subscription over one that was canceled.
      if (best == null || (!best.autoRenewing && p.autoRenewing)) best = p;
    }
    paymentPending = pending && best == null;
    if (best != null) {
      final wasPremium = _entitlement != null;
      _grant(best);
      if (userInitiated) {
        _notify(
          wasPremium ? 'Your Premium subscription is active.' : 'Premium restored! All benefits are unlocked.',
          NoticeKind.success,
        );
      }
      return RestoreOutcome.restored;
    }
    _revoke();
    if (unverified) {
      if (userInitiated) {
        _notify("A subscription was found but couldn't be verified. Please try again later.", NoticeKind.error);
      }
      return RestoreOutcome.unverified;
    }
    if (userInitiated) {
      _notify(
        pending
            ? 'Your payment is still pending with Google Play.'
            : 'No active Premium subscription was found for this Google account.',
        NoticeKind.info,
      );
    }
    return RestoreOutcome.nothingFound;
  }

  // ---------------------------------------------------------------------------
  // Manage
  // ---------------------------------------------------------------------------

  /// Google Play's subscription center (the specific subscription when known).
  String get manageUrl {
    final e = _entitlement;
    if (e == null) return 'https://play.google.com/store/account/subscriptions';
    return 'https://play.google.com/store/account/subscriptions?sku=${e.productId}&package=$kPackageName';
  }

  Future<void> openManage() async {
    final ok = await PlatformLinks.openUrl(manageUrl);
    if (!ok) {
      _notify('Open Google Play > Profile > Payments & subscriptions > Subscriptions.', NoticeKind.info);
    }
  }

  // ---------------------------------------------------------------------------
  // Messages
  // ---------------------------------------------------------------------------

  void _notify(String text, NoticeKind kind) {
    notice.value = PremiumNotice(text, kind, ++_noticeId);
  }

  static String _friendlyError(String raw) {
    if (raw.contains('billingUnavailable') || raw.contains('serviceUnavailable')) {
      return 'Google Play billing is unavailable right now. Please try again later.';
    }
    if (raw.contains('networkError') || raw.contains('serviceDisconnected') || raw.contains('serviceTimeout')) {
      return "Couldn't reach Google Play. Check your connection and try again.";
    }
    if (raw.contains('itemUnavailable')) {
      return 'This plan is not available in your country yet.';
    }
    if (raw.contains('developerError')) {
      return 'This plan is not set up correctly in Google Play yet.';
    }
    return 'The purchase did not complete. Please try again.';
  }
}

class _NoVerifier implements PurchaseVerifier {
  const _NoVerifier();

  @override
  Future<VerifyOutcome> verify(StorePurchase purchase) async => VerifyOutcome.notConfigured;
}

/// Store-agnostic view of subscriptions, so the Premium logic can be tested
/// with a fake store and runs on platforms without Google Play.
library;

class StoreProduct {
  final String productId;

  /// Localized recurring price as formatted by the store.
  final String priceText;
  final int priceMicros;
  final String currencyCode;

  /// ISO 8601 billing period of the recurring price ("P1W", "P1M", "P1Y").
  final String billingPeriod;

  /// Platform object used to launch the purchase.
  final Object? handle;

  const StoreProduct({
    required this.productId,
    required this.priceText,
    required this.priceMicros,
    required this.currencyCode,
    required this.billingPeriod,
    this.handle,
  });
}

class StoreQueryResult {
  final List<StoreProduct> products;
  final List<String> notFound;
  final String? error;

  const StoreQueryResult({this.products = const [], this.notFound = const [], this.error});
}

enum StorePurchaseStatus { pending, purchased, restored, error, canceled }

class StorePurchase {
  final String productId;
  final StorePurchaseStatus status;
  final String purchaseToken;

  /// The purchase JSON exactly as signed by Google Play.
  final String signedData;
  final String signature;
  final bool acknowledged;
  final bool autoRenewing;
  final String? errorMessage;
  final Object? handle;

  const StorePurchase({
    required this.productId,
    required this.status,
    this.purchaseToken = '',
    this.signedData = '',
    this.signature = '',
    this.acknowledged = false,
    this.autoRenewing = true,
    this.errorMessage,
    this.handle,
  });
}

abstract class SubscriptionStore {
  Future<bool> isAvailable();

  Future<StoreQueryResult> queryProducts(Set<String> productIds);

  /// Purchases reported by the store (new purchases, pending, errors...).
  Stream<List<StorePurchase>> get purchaseUpdates;

  /// Starts the purchase flow. When [replacing] is given the current
  /// subscription is upgraded/downgraded instead of buying a second one.
  Future<bool> buy(StoreProduct product, {StorePurchase? replacing});

  /// Subscriptions the user currently owns (active, including canceled ones
  /// that have not expired yet). Throws when the store can't be reached.
  Future<List<StorePurchase>> queryOwned();

  /// Acknowledges a verified purchase (Play refunds it after 3 days otherwise).
  Future<void> complete(StorePurchase purchase);
}

/// Used where no billing system exists (web QA build, tests by default).
class UnavailableStore implements SubscriptionStore {
  @override
  Future<bool> isAvailable() async => false;

  @override
  Future<StoreQueryResult> queryProducts(Set<String> productIds) async =>
      StoreQueryResult(notFound: productIds.toList(), error: 'Store unavailable');

  @override
  Stream<List<StorePurchase>> get purchaseUpdates => const Stream.empty();

  @override
  Future<bool> buy(StoreProduct product, {StorePurchase? replacing}) async => false;

  @override
  Future<List<StorePurchase>> queryOwned() async => const [];

  @override
  Future<void> complete(StorePurchase purchase) async {}
}

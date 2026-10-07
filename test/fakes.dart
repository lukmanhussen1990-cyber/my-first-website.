import 'dart:async';
import 'dart:convert';

import 'package:blockblast/src/premium/store.dart';
import 'package:blockblast/src/premium/verifier.dart';

/// In-memory Google Play stand-in for tests.
class FakeStore implements SubscriptionStore {
  bool available = true;
  List<StoreProduct> products = [
    const StoreProduct(
      productId: 'premium_yearly',
      priceText: '19,99 €',
      priceMicros: 19990000,
      currencyCode: 'EUR',
      billingPeriod: 'P1Y',
    ),
    const StoreProduct(
      productId: 'premium_monthly',
      priceText: '4,99 €',
      priceMicros: 4990000,
      currencyCode: 'EUR',
      billingPeriod: 'P1M',
    ),
    const StoreProduct(
      productId: 'premium_weekly',
      priceText: '1,99 €',
      priceMicros: 1990000,
      currencyCode: 'EUR',
      billingPeriod: 'P1W',
    ),
  ];
  List<StorePurchase> owned = [];
  bool ownedFails = false;
  final updates = StreamController<List<StorePurchase>>.broadcast();
  final bought = <(String, StorePurchase?)>[];
  final completed = <String>[];

  @override
  Future<bool> isAvailable() async => available;

  @override
  Future<StoreQueryResult> queryProducts(Set<String> productIds) async => StoreQueryResult(
    products: [
      for (final p in products)
        if (productIds.contains(p.productId)) p,
    ],
  );

  @override
  Stream<List<StorePurchase>> get purchaseUpdates => updates.stream;

  @override
  Future<bool> buy(StoreProduct product, {StorePurchase? replacing}) async {
    bought.add((product.productId, replacing));
    return true;
  }

  @override
  Future<List<StorePurchase>> queryOwned() async {
    if (ownedFails) throw StateError('offline');
    return owned;
  }

  @override
  Future<void> complete(StorePurchase purchase) async => completed.add(purchase.purchaseToken);
}

/// Accepts purchases signed "good" whose JSON matches (like the real check).
class FakeVerifier implements PurchaseVerifier {
  bool configured = true;

  @override
  Future<VerifyOutcome> verify(StorePurchase purchase) async {
    if (!configured) return VerifyOutcome.notConfigured;
    return purchase.signature == 'good' && purchaseJsonMatches(purchase) ? VerifyOutcome.valid : VerifyOutcome.invalid;
  }
}

StorePurchase purchase(
  String productId, {
  StorePurchaseStatus status = StorePurchaseStatus.purchased,
  String token = 'tok-1',
  String signature = 'good',
  bool acknowledged = false,
  bool autoRenewing = true,
  String package = kPackageName,
}) {
  final json = jsonEncode({
    'orderId': 'GPA.1234',
    'packageName': package,
    'productId': productId,
    'purchaseTime': 1700000000000,
    'purchaseState': status == StorePurchaseStatus.pending ? 4 : 0,
    'purchaseToken': token,
    'autoRenewing': autoRenewing,
    'acknowledged': acknowledged,
  });
  return StorePurchase(
    productId: productId,
    status: status,
    purchaseToken: token,
    signedData: json,
    signature: signature,
    acknowledged: acknowledged,
    autoRenewing: autoRenewing,
    handle: Object(),
  );
}

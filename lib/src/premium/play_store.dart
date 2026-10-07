import 'package:in_app_purchase/in_app_purchase.dart';
import 'package:in_app_purchase_android/billing_client_wrappers.dart';
import 'package:in_app_purchase_android/in_app_purchase_android.dart';

import 'store.dart';

/// Google Play Billing through the official in_app_purchase plugin.
class PlayStore implements SubscriptionStore {
  final InAppPurchase _iap = InAppPurchase.instance;

  @override
  Future<bool> isAvailable() => _iap.isAvailable();

  @override
  Future<StoreQueryResult> queryProducts(Set<String> productIds) async {
    final response = await _iap.queryProductDetails(productIds);
    final products = <String, StoreProduct>{};
    for (final details in response.productDetails) {
      if (details is! GooglePlayProductDetails) continue;
      final wrapper = details.productDetails;
      if (wrapper.productType != ProductType.subs) continue;
      final index = details.subscriptionIndex;
      final offers = wrapper.subscriptionOfferDetails;
      if (index == null || offers == null || index >= offers.length) continue;
      final offer = offers[index];
      // Show the base plan's own recurring price (offerId == null); special
      // offers such as trials are not advertised in-app.
      if (offer.offerId != null && products.containsKey(details.id)) continue;
      final recurring = offer.pricingPhases.last;
      final candidate = StoreProduct(
        productId: details.id,
        priceText: recurring.formattedPrice,
        priceMicros: recurring.priceAmountMicros,
        currencyCode: recurring.priceCurrencyCode,
        billingPeriod: recurring.billingPeriod,
        handle: details,
      );
      if (offer.offerId == null || !products.containsKey(details.id)) {
        products[details.id] = candidate;
      }
    }
    return StoreQueryResult(
      products: products.values.toList(),
      notFound: response.notFoundIDs,
      error: response.error?.message,
    );
  }

  @override
  Stream<List<StorePurchase>> get purchaseUpdates =>
      _iap.purchaseStream.map((list) => [for (final p in list) _convert(p)]);

  @override
  Future<bool> buy(StoreProduct product, {StorePurchase? replacing}) {
    final details = product.handle! as GooglePlayProductDetails;
    final old = replacing?.handle;
    final param = GooglePlayPurchaseParam(
      productDetails: details,
      changeSubscriptionParam: old is GooglePlayPurchaseDetails
          ? ChangeSubscriptionParam(oldPurchaseDetails: old, replacementMode: ReplacementMode.withTimeProration)
          : null,
    );
    return _iap.buyNonConsumable(purchaseParam: param);
  }

  @override
  Future<List<StorePurchase>> queryOwned() async {
    final addition = _iap.getPlatformAddition<InAppPurchaseAndroidPlatformAddition>();
    final response = await addition.queryPastPurchases();
    if (response.error != null) {
      throw StateError(response.error!.message);
    }
    return [for (final p in response.pastPurchases) _convert(p)];
  }

  @override
  Future<void> complete(StorePurchase purchase) async {
    final handle = purchase.handle;
    if (handle is PurchaseDetails) {
      await _iap.completePurchase(handle);
    }
  }

  StorePurchase _convert(PurchaseDetails p) {
    final status = switch (p.status) {
      PurchaseStatus.pending => StorePurchaseStatus.pending,
      PurchaseStatus.purchased => StorePurchaseStatus.purchased,
      PurchaseStatus.restored => StorePurchaseStatus.restored,
      PurchaseStatus.canceled => StorePurchaseStatus.canceled,
      PurchaseStatus.error => StorePurchaseStatus.error,
    };
    if (p is GooglePlayPurchaseDetails) {
      final w = p.billingClientPurchase;
      return StorePurchase(
        productId: p.productID,
        status: status,
        purchaseToken: w.purchaseToken,
        signedData: w.originalJson,
        signature: w.signature,
        acknowledged: w.isAcknowledged,
        autoRenewing: w.isAutoRenewing,
        errorMessage: p.error?.message,
        handle: p,
      );
    }
    return StorePurchase(
      productId: p.productID,
      status: status,
      purchaseToken: p.verificationData.serverVerificationData,
      signedData: p.verificationData.localVerificationData,
      errorMessage: p.error?.message,
      handle: p,
    );
  }
}

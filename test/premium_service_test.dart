import 'dart:convert';

import 'package:blockblast/src/premium/plans.dart';
import 'package:blockblast/src/premium/premium_service.dart';
import 'package:blockblast/src/premium/store.dart';
import 'package:blockblast/src/premium/verifier.dart';
import 'package:blockblast/src/services/settings_store.dart';
import 'package:flutter_test/flutter_test.dart';

import 'fakes.dart';

Future<void> settle() => Future<void>.delayed(Duration.zero);

void main() {
  late FakeStore store;
  late FakeVerifier verifier;
  late SettingsStore settings;
  var now = DateTime(2026, 10, 7);

  PremiumService service() =>
      PremiumService(store: store, verifier: verifier, settings: settings, clock: () => now);

  setUp(() {
    store = FakeStore();
    verifier = FakeVerifier();
    settings = SettingsStore.memory();
    now = DateTime(2026, 10, 7);
  });

  test('free tier by default with reference prices when the store is missing', () async {
    store.available = false;
    final s = service();
    await s.init();
    expect(s.isPremium, isFalse);
    expect(s.storeAvailable, isFalse);
    expect(s.hasStorePrices, isFalse);
    expect(s.offerFor(PremiumPlan.yearly).priceText, r'$19.99');
    expect(s.offerFor(PremiumPlan.yearly).fromStore, isFalse);
    expect(s.canPurchase(PremiumPlan.yearly), isFalse);
    expect(s.hintsPerGame, Allowance.freeHints);
    expect(s.revivesPerGame, Allowance.freeRevives);
    expect(s.showsAds, isTrue);
    expect(s.canUseSkin('classic'), isTrue);
    expect(s.canUseSkin('neon'), isFalse);
    // Buying explains why it is unavailable instead of failing silently.
    expect(await s.buy(PremiumPlan.yearly), isFalse);
    expect(s.notice.value?.kind, NoticeKind.error);
    expect(store.bought, isEmpty);
  });

  test('shows the localized prices returned by Google Play', () async {
    final s = service();
    await s.init();
    expect(s.hasStorePrices, isTrue);
    final yearly = s.offerFor(PremiumPlan.yearly);
    expect(yearly.priceText, '19,99 €');
    expect(yearly.currencyCode, 'EUR');
    expect(yearly.fromStore, isTrue);
    expect(PlanMath.savingsPercent(yearly, s.offerFor(PremiumPlan.monthly)), 66);
  });

  test('a verified purchase unlocks Premium and is acknowledged', () async {
    final s = service();
    await s.init();
    expect(await s.buy(PremiumPlan.monthly), isTrue);
    expect(store.bought.single.$1, 'premium_monthly');
    expect(store.bought.single.$2, isNull);
    expect(s.purchasing, isTrue);

    store.updates.add([purchase('premium_monthly')]);
    await settle();
    expect(s.isPremium, isTrue);
    expect(s.activePlan, PremiumPlan.monthly);
    expect(s.purchasing, isFalse);
    expect(store.completed, ['tok-1']);
    expect(s.notice.value?.kind, NoticeKind.success);
    expect(s.hintsPerGame, Allowance.premiumHints);
    expect(s.revivesPerGame, Allowance.premiumRevives);
    expect(s.showsAds, isFalse);
    expect(s.canUseSkin('gem'), isTrue);
    expect(s.manageUrl, contains('sku=premium_monthly'));
    expect(s.manageUrl, contains('package=com.myapps.blockblast'));
  });

  test('purchases that fail verification never unlock and are not acknowledged', () async {
    final s = service();
    await s.init();
    await s.buy(PremiumPlan.yearly);
    store.updates.add([purchase('premium_yearly', signature: 'forged')]);
    await settle();
    expect(s.isPremium, isFalse);
    expect(store.completed, isEmpty);
    expect(s.notice.value?.kind, NoticeKind.error);

    // Signed data for another app is rejected as well.
    store.updates.add([purchase('premium_yearly', package: 'com.other.app')]);
    await settle();
    expect(s.isPremium, isFalse);

    // And nothing unlocks when the build has no license key to verify with.
    verifier.configured = false;
    store.updates.add([purchase('premium_yearly')]);
    await settle();
    expect(s.isPremium, isFalse);
    expect(store.completed, isEmpty);
  });

  test('pending payments wait for confirmation', () async {
    final s = service();
    await s.init();
    await s.buy(PremiumPlan.weekly);
    store.updates.add([purchase('premium_weekly', status: StorePurchaseStatus.pending)]);
    await settle();
    expect(s.isPremium, isFalse);
    expect(s.paymentPending, isTrue);
    expect(store.completed, isEmpty);

    store.updates.add([purchase('premium_weekly')]);
    await settle();
    expect(s.isPremium, isTrue);
    expect(s.paymentPending, isFalse);
  });

  test('canceling the Play dialog just ends the purchase', () async {
    final s = service();
    await s.init();
    await s.buy(PremiumPlan.yearly);
    store.updates.add([const StorePurchase(productId: '', status: StorePurchaseStatus.canceled)]);
    await settle();
    expect(s.purchasing, isFalse);
    expect(s.isPremium, isFalse);
  });

  test('restore unlocks an owned subscription and acknowledges it', () async {
    final s = service();
    await s.init();
    expect(s.isPremium, isFalse);
    store.owned = [purchase('premium_yearly', token: 'tok-9')];
    expect(await s.restore(), RestoreOutcome.restored);
    expect(s.isPremium, isTrue);
    expect(s.activePlan, PremiumPlan.yearly);
    expect(store.completed, ['tok-9']);
  });

  test('restore with nothing owned reports it', () async {
    final s = service();
    await s.init();
    expect(await s.restore(), RestoreOutcome.nothingFound);
    expect(s.isPremium, isFalse);
    expect(s.notice.value?.kind, NoticeKind.info);
  });

  test('an already owned subscription is picked up at startup', () async {
    store.owned = [purchase('premium_weekly', acknowledged: true)];
    final s = service();
    await s.init();
    expect(s.isPremium, isTrue);
    expect(store.completed, isEmpty); // already acknowledged
  });

  test('Premium ends when Google Play no longer reports the subscription', () async {
    store.owned = [purchase('premium_monthly', acknowledged: true)];
    final first = service();
    await first.init();
    expect(first.isPremium, isTrue);

    // Next launch: the subscription expired.
    store.owned = [];
    final second = service();
    await second.init();
    expect(second.isPremium, isFalse);
    expect(settings.readString('premium_entitlement_v1'), isNull);
  });

  test('the verified entitlement is kept offline for a limited time', () async {
    store.owned = [purchase('premium_monthly', acknowledged: true)];
    await service().init();

    store.ownedFails = true; // offline
    now = now.add(const Duration(days: 3));
    final offline = service();
    await offline.init();
    expect(offline.isPremium, isTrue);

    now = now.add(PremiumService.offlineGrace);
    final tooLong = service();
    await tooLong.init();
    expect(tooLong.isPremium, isFalse);
  });

  test('a tampered cache does not unlock Premium', () async {
    store.available = false;
    final forged = Entitlement(
      productId: 'premium_yearly',
      purchaseToken: 'x',
      signedData: '{"packageName":"com.myapps.blockblast","productId":"premium_yearly","purchaseToken":"x"}',
      signature: 'forged',
      autoRenewing: true,
      verifiedAt: now,
    );
    settings.writeString('premium_entitlement_v1', jsonEncode(forged.toJson()));
    final s = service();
    await s.init();
    expect(s.isPremium, isFalse);
  });

  test('switching plans replaces the current subscription', () async {
    store.owned = [purchase('premium_monthly', token: 'old', acknowledged: true)];
    final s = service();
    await s.init();
    expect(s.activePlan, PremiumPlan.monthly);

    // Same plan: nothing to buy.
    expect(await s.buy(PremiumPlan.monthly), isFalse);
    expect(store.bought, isEmpty);

    expect(await s.buy(PremiumPlan.yearly), isTrue);
    expect(store.bought.single.$1, 'premium_yearly');
    expect(store.bought.single.$2?.purchaseToken, 'old');

    store.updates.add([purchase('premium_yearly', token: 'new')]);
    await settle();
    expect(s.activePlan, PremiumPlan.yearly);
    expect(s.notice.value?.text, contains('Yearly'));
  });

  test('"already owned" errors restore the existing subscription', () async {
    final s = service();
    await s.init();
    store.owned = [purchase('premium_yearly', acknowledged: true)];
    await s.buy(PremiumPlan.yearly);
    store.updates.add([
      const StorePurchase(
        productId: '',
        status: StorePurchaseStatus.error,
        errorMessage: 'BillingResponse.itemAlreadyOwned',
      ),
    ]);
    await settle();
    await settle();
    expect(s.isPremium, isTrue);
  });

  test('purchase JSON checks', () {
    expect(purchaseJsonMatches(purchase('premium_yearly')), isTrue);
    expect(purchaseJsonMatches(purchase('premium_yearly', status: StorePurchaseStatus.pending)), isFalse);
    final mismatch = purchase('premium_yearly');
    expect(
      purchaseJsonMatches(
        StorePurchase(
          productId: 'premium_weekly',
          status: StorePurchaseStatus.purchased,
          purchaseToken: mismatch.purchaseToken,
          signedData: mismatch.signedData,
        ),
      ),
      isFalse,
    );
    expect(
      purchaseJsonMatches(
        const StorePurchase(productId: 'premium_yearly', status: StorePurchaseStatus.purchased, signedData: 'nope'),
      ),
      isFalse,
    );
  });
}

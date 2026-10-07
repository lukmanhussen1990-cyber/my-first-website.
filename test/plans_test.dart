import 'package:blockblast/src/premium/plans.dart';
import 'package:flutter_test/flutter_test.dart';

PlanOffer offer(PremiumPlan plan, int micros, {String currency = 'USD', String? iso}) => PlanOffer(
      plan: plan,
      priceText: 'x',
      priceMicros: micros,
      currencyCode: currency,
      period: BillingPeriod.parse(iso ?? plan.isoPeriod),
      fromStore: true,
    );

void main() {
  test('product ids and lookup', () {
    expect(PremiumPlan.yearly.productId, 'premium_yearly');
    expect(PremiumPlan.monthly.productId, 'premium_monthly');
    expect(PremiumPlan.weekly.productId, 'premium_weekly');
    expect(PremiumPlanInfo.fromProductId('premium_monthly'), PremiumPlan.monthly);
    expect(PremiumPlanInfo.fromProductId('other'), isNull);
  });

  test('billing periods parse and describe themselves', () {
    expect(BillingPeriod.parse('P1W').noun, 'week');
    expect(BillingPeriod.parse('P1M').adverb, 'monthly');
    expect(BillingPeriod.parse('P1Y').adverb, 'yearly');
    expect(BillingPeriod.parse('P3M').noun, '3 months');
    expect(BillingPeriod.parse('P3M').adverb, 'every 3 months');
    expect(BillingPeriod.parse('P1W').perYear, 52);
    expect(BillingPeriod.parse('P3M').perYear, 4);
  });

  test('reference prices match the requested plans', () {
    expect(PlanOffer.reference(PremiumPlan.yearly).perPeriodText, r'$19.99/year');
    expect(PlanOffer.reference(PremiumPlan.monthly).perPeriodText, r'$4.99/month');
    expect(PlanOffer.reference(PremiumPlan.weekly).perPeriodText, r'$1.99/week');
    expect(PlanOffer.reference(PremiumPlan.yearly).chargeText, r'$19.99 billed yearly');
  });

  test('savings are computed exactly and rounded down', () {
    final yearly = offer(PremiumPlan.yearly, 19990000);
    final monthly = offer(PremiumPlan.monthly, 4990000);
    final weekly = offer(PremiumPlan.weekly, 1990000);
    // 19.99 / (4.99 * 12 = 59.88) = 0.33383 -> 66.6% saved -> 66.
    expect(PlanMath.savingsPercent(yearly, monthly), 66);
    // 19.99 / (1.99 * 52 = 103.48) = 0.19318 -> 80.7% saved -> 80.
    expect(PlanMath.savingsPercent(yearly, weekly), 80);
    // 59.88 / 103.48 = 0.57866 -> 42.1% saved -> 42.
    expect(PlanMath.savingsPercent(monthly, weekly), 42);
    // No saving the other way round, and none against itself.
    expect(PlanMath.savingsPercent(weekly, monthly), isNull);
    expect(PlanMath.savingsPercent(monthly, monthly), isNull);
  });

  test('savings need the same currency', () {
    expect(PlanMath.savingsPercent(offer(PremiumPlan.yearly, 1650000000, currency: 'INR'), offer(PremiumPlan.monthly, 4990000)), isNull);
  });

  test('localized store prices change the savings', () {
    // e.g. INR 1,650 / year vs INR 450 / month -> 1650 / 5400 = 0.3056 -> 69%.
    final y = offer(PremiumPlan.yearly, 1650000000, currency: 'INR');
    final m = offer(PremiumPlan.monthly, 450000000, currency: 'INR');
    expect(PlanMath.savingsPercent(y, m), 69);
  });

  test('monthly equivalent of the yearly plan', () {
    final yearly = offer(PremiumPlan.yearly, 19990000);
    // 19.99 / 12 = 1.6658 -> 1.67
    expect(PlanMath.equivalentMicros(yearly, BillingPeriod.parse('P1M')), 1670000);
    // 19.99 / 52 = 0.3844 -> rounded up to 0.39 (never understate a cost)
    expect(PlanMath.equivalentMicros(yearly, BillingPeriod.parse('P1W')), 390000);
    final monthly = PlanOffer.reference(PremiumPlan.monthly);
    // 4.99 * 12 / 52 = 1.1515 -> 1.16
    expect(PlanMath.equivalentMicros(monthly, BillingPeriod.parse('P1W')), 1160000);
    // Exact values are not bumped up.
    final exact = PlanOffer(
      plan: PremiumPlan.yearly,
      priceText: '\$24.00',
      priceMicros: 24000000,
      currencyCode: 'USD',
      period: BillingPeriod.parse('P1Y'),
      fromStore: true,
    );
    expect(PlanMath.equivalentMicros(exact, BillingPeriod.parse('P1M')), 2000000);
    expect(PlanMath.formatMicros(1670000, 'USD', locale: 'en_US'), r'$1.67');
  });

  test('currencies without minor units round to whole units', () {
    final yen = PlanOffer(
      plan: PremiumPlan.yearly,
      priceText: '¥3,100',
      priceMicros: 3100000000,
      currencyCode: 'JPY',
      period: BillingPeriod.parse('P1Y'),
      fromStore: true,
    );
    expect(PlanMath.currencyDigits('JPY'), 0);
    // 3100 / 12 = 258.33 -> 259 yen
    expect(PlanMath.equivalentMicros(yen, BillingPeriod.parse('P1M')), 259000000);
  });
}

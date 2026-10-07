import 'dart:ui' show PlatformDispatcher;

import 'package:intl/intl.dart';

/// Subscription plans offered in the Premium screen.
enum PremiumPlan { yearly, monthly, weekly }

extension PremiumPlanInfo on PremiumPlan {
  /// Google Play subscription product ID (see docs/MONETIZATION.md).
  String get productId => switch (this) {
        PremiumPlan.yearly => 'premium_yearly',
        PremiumPlan.monthly => 'premium_monthly',
        PremiumPlan.weekly => 'premium_weekly',
      };

  String get label => switch (this) {
        PremiumPlan.yearly => 'Yearly',
        PremiumPlan.monthly => 'Monthly',
        PremiumPlan.weekly => 'Weekly',
      };

  /// Expected billing period (ISO 8601) of the plan's base plan.
  String get isoPeriod => switch (this) {
        PremiumPlan.yearly => 'P1Y',
        PremiumPlan.monthly => 'P1M',
        PremiumPlan.weekly => 'P1W',
      };

  /// Reference USD prices used when the store is unavailable.
  int get referencePriceMicros => switch (this) {
        PremiumPlan.yearly => 19990000,
        PremiumPlan.monthly => 4990000,
        PremiumPlan.weekly => 1990000,
      };

  static PremiumPlan? fromProductId(String id) {
    for (final p in PremiumPlan.values) {
      if (p.productId == id) return p;
    }
    return null;
  }
}

/// A billing period such as 1 week, 1 month or 3 months.
class BillingPeriod {
  final int count;
  final String unit; // 'day', 'week', 'month', 'year'

  const BillingPeriod(this.count, this.unit);

  /// Parses ISO 8601 periods used by Google Play ("P1W", "P1M", "P3M", "P1Y").
  static BillingPeriod parse(String iso) {
    final m = RegExp(r'^P(\d+)([DWMY])$').firstMatch(iso.trim().toUpperCase());
    if (m == null) return const BillingPeriod(1, 'month');
    final n = int.parse(m.group(1)!);
    final unit = switch (m.group(2)) {
      'D' => 'day',
      'W' => 'week',
      'Y' => 'year',
      _ => 'month',
    };
    return BillingPeriod(n, unit);
  }

  /// How many of these periods fit into a year (52 weeks, 12 months).
  double get perYear => switch (unit) {
        'day' => 365 / count,
        'week' => 52 / count,
        'year' => 1 / count,
        _ => 12 / count,
      };

  /// "year", "month", "3 months".
  String get noun => count == 1 ? unit : '$count ${unit}s';

  /// "yearly", "monthly", "every 3 months".
  String get adverb {
    if (count != 1) return 'every $count ${unit}s';
    return switch (unit) {
      'day' => 'daily',
      'week' => 'weekly',
      'year' => 'yearly',
      _ => 'monthly',
    };
  }
}

/// Price of one plan, either from the store (localized) or the reference.
class PlanOffer {
  final PremiumPlan plan;

  /// Price string exactly as the store formats it for the user ("$19.99", "₹1,650.00").
  final String priceText;
  final int priceMicros;
  final String currencyCode;
  final BillingPeriod period;
  final bool fromStore;

  /// Opaque store object needed to start the purchase.
  final Object? storeHandle;

  const PlanOffer({
    required this.plan,
    required this.priceText,
    required this.priceMicros,
    required this.currencyCode,
    required this.period,
    required this.fromStore,
    this.storeHandle,
  });

  factory PlanOffer.reference(PremiumPlan plan) => PlanOffer(
        plan: plan,
        priceText: PlanMath.formatMicros(plan.referencePriceMicros, 'USD', locale: 'en_US'),
        priceMicros: plan.referencePriceMicros,
        currencyCode: 'USD',
        period: BillingPeriod.parse(plan.isoPeriod),
        fromStore: false,
      );

  /// "$19.99/year".
  String get perPeriodText => '$priceText/${period.noun}';

  /// "$19.99 billed yearly".
  String get chargeText => '$priceText billed ${period.adverb}';

  double get pricePerYear => priceMicros / 1e6 * period.perYear;
}

class PlanMath {
  PlanMath._();

  /// Whole-number percentage saved by [offer] compared with paying [base]
  /// for the same amount of time. Rounded down so it is never overstated;
  /// null when the plans can't be compared or there is no saving.
  static int? savingsPercent(PlanOffer offer, PlanOffer base) {
    if (offer.currencyCode != base.currencyCode) return null;
    if (offer.priceMicros <= 0 || base.priceMicros <= 0) return null;
    final ratio = offer.pricePerYear / base.pricePerYear;
    // Small epsilon so 0.3338 * 100 = 66.62 never floors to 66.61...
    final pct = ((1 - ratio) * 100 + 1e-9).floor();
    return pct > 0 ? pct : null;
  }

  /// Price per [unitPeriod] of [offer], e.g. the monthly equivalent of a
  /// yearly plan. Rounded up to the currency's smallest unit so the cost is
  /// never understated ($19.99/year -> $1.67/month).
  static int equivalentMicros(PlanOffer offer, BillingPeriod unitPeriod) {
    final value = offer.pricePerYear / unitPeriod.perYear;
    final digits = currencyDigits(offer.currencyCode);
    var scale = 1;
    for (var i = 0; i < digits; i++) {
      scale *= 10;
    }
    final units = (value * scale - 1e-6).ceil();
    return units * (1000000 ~/ scale);
  }

  /// Number of decimals used by [currencyCode] (2 for USD, 0 for JPY).
  static int currencyDigits(String currencyCode) {
    try {
      return (NumberFormat.simpleCurrency(locale: 'en_US', name: currencyCode).decimalDigits ?? 2).clamp(0, 6);
    } catch (_) {
      return 2;
    }
  }

  static String formatMicros(int micros, String currencyCode, {String? locale}) {
    final amount = micros / 1e6;
    NumberFormat fmt;
    try {
      fmt = NumberFormat.simpleCurrency(locale: locale ?? deviceLocale(), name: currencyCode);
    } catch (_) {
      fmt = NumberFormat.simpleCurrency(locale: 'en_US', name: currencyCode);
    }
    return fmt.format(amount);
  }

  static String deviceLocale() {
    try {
      final l = PlatformDispatcher.instance.locale;
      final tag = l.countryCode == null || l.countryCode!.isEmpty ? l.languageCode : '${l.languageCode}_${l.countryCode}';
      return NumberFormat.localeExists(tag) ? tag : 'en_US';
    } catch (_) {
      return 'en_US';
    }
  }
}

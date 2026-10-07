import 'dart:convert';

import 'package:flutter/services.dart';

import 'store.dart';

const String kPackageName = 'com.myapps.blockblast';

enum VerifyOutcome { valid, invalid, notConfigured }

abstract class PurchaseVerifier {
  Future<VerifyOutcome> verify(StorePurchase purchase);
}

/// Checks the content of a signed Google Play purchase JSON.
bool purchaseJsonMatches(StorePurchase purchase) {
  try {
    final json = jsonDecode(purchase.signedData);
    if (json is! Map) return false;
    final products = <String>[
      if (json['productId'] is String) json['productId'] as String,
      if (json['productIds'] is List) ...(json['productIds'] as List).whereType<String>(),
    ];
    return json['packageName'] == kPackageName &&
        products.contains(purchase.productId) &&
        // 0 = purchased (1 = canceled, 4 = pending).
        (json['purchaseState'] ?? 0) == 0 &&
        json['purchaseToken'] == purchase.purchaseToken;
  } catch (_) {
    return false;
  }
}

/// Verifies the Google Play signature on the device (Kotlin PurchaseSecurity,
/// using the Play license key compiled into the app) and the purchase data.
class PlatformPurchaseVerifier implements PurchaseVerifier {
  static const _channel = MethodChannel('com.myapps.blockblast/platform');

  @override
  Future<VerifyOutcome> verify(StorePurchase purchase) async {
    try {
      final configured = await _channel.invokeMethod<bool>('isLicenseKeyConfigured') ?? false;
      if (!configured) return VerifyOutcome.notConfigured;
      final ok = await _channel.invokeMethod<bool>('verifyPurchase', {
            'signedData': purchase.signedData,
            'signature': purchase.signature,
          }) ??
          false;
      return ok && purchaseJsonMatches(purchase) ? VerifyOutcome.valid : VerifyOutcome.invalid;
    } on MissingPluginException {
      return VerifyOutcome.notConfigured;
    } catch (_) {
      return VerifyOutcome.invalid;
    }
  }
}

/// Small helpers on the same platform channel.
class PlatformLinks {
  static const _channel = MethodChannel('com.myapps.blockblast/platform');

  static Future<bool> openUrl(String url) async {
    try {
      return await _channel.invokeMethod<bool>('openUrl', {'url': url}) ?? false;
    } catch (_) {
      return false;
    }
  }

  /// Package that installed the app ("com.android.vending" for Google Play).
  static Future<String?> installer() async {
    try {
      return await _channel.invokeMethod<String>('installerPackage');
    } catch (_) {
      return null;
    }
  }
}

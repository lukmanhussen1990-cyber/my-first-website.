# Premium subscriptions and ads: setup and testing

Block Blast sells **Premium** through Google Play Billing (three
auto-renewing subscriptions) and shows **AdMob** ads to free players. This
guide lists everything you have to configure in Google Play Console and
AdMob before real purchases and real ads work, and how to test them.

Until you do this, the app behaves like this:

- The Premium screen shows the reference USD prices and explains that
  Google Play billing is not available; nothing can be bought.
- Free players see Google's **test ads** ("Test Ad" label, no revenue).

## What Premium includes

| | Free | Premium |
|---|---|---|
| Ads | Banner under the game; an interstitial between games (never after the first game of a session, at most one every 3 minutes); optional rewarded ad to revive | None (the ad SDK is not even started, no consent form) |
| Revives | 1 per game by watching a rewarded ad (offered only when an ad is ready) | 3 per game, instant |
| Hints | 1 per game | 5 per game |
| Block skins | Classic | Classic, Candy, Neon, Gem |

A revive empties the two fullest rows and the two fullest columns, keeps
the score and makes sure a tray piece fits. Hints highlight the best move
the built-in solver finds.

## How purchases work in the app

- **Products:** one subscription product per plan, each with one
  auto-renewing base plan:

  | Plan | Product ID | Base plan period | Reference price |
  |---|---|---|---|
  | Yearly ("Best Value") | `premium_yearly` | 1 year | $19.99 |
  | Monthly | `premium_monthly` | 1 month | $4.99 |
  | Weekly | `premium_weekly` | 1 week | $1.99 |

  The base plan IDs can be anything (for example `yearly`, `monthly`,
  `weekly`). The app shows each base plan's price exactly as Google Play
  formats it for the player's country and currency, and computes the
  savings from those prices ("Save 66% vs monthly" for the reference
  prices, rounded down so savings are never overstated; per-month
  equivalents are rounded up). Offers such as free trials or intro prices
  are not used by this version: the app always buys the base plan.
- **Verification:** Premium unlocks only after the purchase passes
  verification. The app checks Google Play's RSA signature of the purchase
  data on the device with your app's license key (`PurchaseSecurity.kt`),
  then checks the purchase JSON (package name, product, purchased state,
  token). Only then is the purchase acknowledged. A purchase that cannot be
  verified is never acknowledged, so Google Play refunds it automatically
  after 3 days.
- **Restore Purchases** asks Google Play for the active subscriptions of
  the signed-in Google account. The same check runs on every app start, so
  Premium ends by itself when a subscription expires, is refunded or
  revoked. A verified purchase is cached (with its signature) so Premium
  keeps working offline for up to 14 days.
- **Changing plans** replaces the current subscription immediately;
  Google Play credits the unused time (`WITH_TIME_PRORATION`).
- **Manage Subscription** opens the Google Play subscription center for the
  player's subscription.

## 1. Google Play Console

1. **Create the app** with the package name `com.myapps.blockblast`.

   > The name and look of "Block Blast" belong to another company's game.
   > Before publishing on Google Play, give the app your own name and
   > branding (title, icon, logo) to avoid impersonation or trademark
   > rejections. If you also change the package name (`applicationId` in
   > `android/app/build.gradle.kts`), change `kPackageName` in
   > `lib/src/premium/verifier.dart` to match; a new package name is a new
   > app, so existing installs will not update to it.

2. **Upload a build** to the *Internal testing* track. Play Console only
   lets you create subscriptions after a build that uses Google Play
   Billing is uploaded:

   ```bash
   flutter build appbundle --release
   # build/app/outputs/bundle/release/app-release.aab
   ```

   With Play App Signing, the key in `android/key.properties` becomes your
   upload key.

3. **Create the three subscriptions** (Monetize with Play > Products >
   Subscriptions > Create subscription): product IDs `premium_yearly`,
   `premium_monthly`, `premium_weekly`. In each, add an **auto-renewing
   base plan** with the billing period from the table above, set the
   prices (Play can convert the US price for other countries) and
   **activate** the base plan.

4. **Copy the license key** (Monetize with Play > Monetization setup >
   Licensing: the Base64-encoded RSA public key) into
   `android/key.properties` on one line:

   ```properties
   playLicenseKey=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA...
   ```

   Alternatively pass `-PplayLicenseKey=...` to Gradle or set the
   environment variable `BLOCKBLAST_PLAY_LICENSE_KEY`. The key is public
   (it only verifies signatures), so it is fine inside the APK. **Without
   it, purchases are never unlocked** (they cannot be verified) and are
   refunded after 3 days.

5. **Add testers:** Play Console > Settings > License testing: add the
   Google accounts that will test. Test purchases are free, and test
   subscriptions renew quickly: 1 week and 1 month renew every 5 minutes,
   1 year every 30 minutes, up to 6 renewals.

6. **Install from the testing link:** add the testers to the internal
   testing track and install the app through its opt-in link in the Play
   Store. Copies installed from elsewhere (for example the APK on GitHub)
   may not be recognised by Google Play as the same app, so they may not
   be able to buy.

7. **App content:** in *Data safety* declare purchase history (Google Play
   purchases) and what the AdMob SDK collects (device or other IDs,
   diagnostics); answer *Contains ads: Yes*; complete the *Advertising ID*
   declaration (the AdMob SDK uses it). If your target audience includes
   children, Google Play's Families policies apply to the ads as well.

## 2. AdMob

1. Create an AdMob app for Android (same package name) and three ad
   units: **Banner**, **Interstitial**, **Rewarded**.
2. Put the AdMob **app ID** into `android/key.properties`
   (`admobAppId=ca-app-pub-XXXXXXXXXXXXXXXX~YYYYYYYYYY`), or use
   `-PadmobAppId=...` / `BLOCKBLAST_ADMOB_APP_ID`. It goes into the
   manifest.
3. Pass the **ad unit IDs** when building:

   ```bash
   flutter build appbundle --release \
     --dart-define=ADMOB_BANNER_ID=ca-app-pub-XXXXXXXXXXXXXXXX/1111111111 \
     --dart-define=ADMOB_INTERSTITIAL_ID=ca-app-pub-XXXXXXXXXXXXXXXX/2222222222 \
     --dart-define=ADMOB_REWARDED_ID=ca-app-pub-XXXXXXXXXXXXXXXX/3333333333
   ```

   Without these, Google's test IDs are used. Never tap your own live ads;
   test with the test IDs or register your phone as a test device in
   AdMob.
4. **Privacy & messaging:** create a GDPR consent message (EEA, UK and
   Switzerland), and a US state regulations message if you need one. The
   app uses Google's User Messaging Platform: it shows the message when it
   is required, only requests ads when allowed, and shows an *Ad Privacy
   Settings* button in About when players must be able to change their
   choice. Premium players are never asked, because no ads are loaded for
   them.
5. Publish an `app-ads.txt` on your developer website (AdMob shows the
   line to add).

## 3. Test checklist

With a license-tester account and the build installed from the internal
testing link:

1. Open **Premium** (top-right on the home screen). Prices must be in your
   local currency, the yearly card must show the savings, and the charge
   next to *Start Premium* must match the selected plan.
2. Buy a plan with a test card. Premium unlocks at once: the banner
   disappears, the hint button shows 5, skins unlock, and when stuck the
   revive offer is instant.
3. Switch plans (for example Monthly to Yearly) from the Premium screen;
   Google Play shows the change and the app shows the new plan as
   *CURRENT*.
4. Use the "slow test card" to check the *Payment pending* message; the
   purchase unlocks after Google Play approves it.
5. Cancel in Google Play (*Manage Subscription*): Premium stays until the
   period ends, then ends on the next app start.
6. Uninstall and reinstall, then *Restore Purchases*.
7. Refund or revoke a test order in Play Console (Order management); the
   next app start ends Premium.
8. As a free player: banner under the game, no interstitial after the
   first game, and at most one every 3 minutes after that; when stuck, a
   rewarded ad offers a revive.

Useful logcat markers: `adb logcat -s flutter` shows `BB_IAP` (billing and
verification), `BB_ADS`, `BB_PREMIUM`, `BB_REVIVE_*` and `BB_HINT`.

## 4. Stronger protection (recommended)

On-device verification stops casual tampering, but a modified app on a
rooted phone can bypass any check that runs on the device. For stronger
protection, verify purchases on your own server with the Google Play
Developer API (`purchases.subscriptionsv2.get`) and keep subscription
state current with Real-time developer notifications. The app has a
single verification point (`PurchaseVerifier` in
`lib/src/premium/verifier.dart`) where a server check can be plugged in.

## 5. Developer preview build

To see every Premium benefit without buying (for screenshots or checking
skins), build with:

```bash
flutter build apk --release --dart-define=PREMIUM_PREVIEW=true
```

All benefits are unlocked and purchasing is disabled. Never publish this
build.

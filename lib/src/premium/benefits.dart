import '../services/settings_store.dart';
import '../ui/skins.dart';
import 'premium_service.dart';

/// Keeps [ActiveSkin] in sync with the player's chosen skin and Premium
/// status: premium skins only render while Premium is active (the choice is
/// remembered, so it comes back after re-subscribing).
void bindActiveSkin() {
  void sync() {
    final chosen = BlockSkinInfo.fromId(SettingsStore.instance.skinId);
    ActiveSkin.value = PremiumService.instance.canUseSkin(chosen.id) ? chosen : BlockSkin.classic;
  }

  SettingsStore.instance.addListener(sync);
  PremiumService.instance.addListener(sync);
  sync();
}

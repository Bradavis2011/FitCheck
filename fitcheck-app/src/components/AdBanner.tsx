import { useState } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { useSubscriptionStore } from '../stores/subscriptionStore';

// react-native-google-mobile-ads calls TurboModuleRegistry.getEnforcing() at module
// level — it will hard-crash if the native binary doesn't include the module.
// Use a guarded require so the app loads safely without a rebuilt dev binary.
// eslint-disable-next-line @typescript-eslint/no-var-requires
let _ads: any = null;
try { _ads = require('react-native-google-mobile-ads'); } catch { /* native module unavailable */ }
const BannerAd = _ads?.BannerAd;
const BannerAdSize = _ads?.BannerAdSize;
const _TestIds = _ads?.TestIds;

const BANNER_AD_UNIT_ID = __DEV__
  ? (_TestIds?.BANNER ?? '')
  : Platform.select({
      ios: 'ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX',
      android: 'ca-app-pub-1244039707249288/6576661680',
      default: _TestIds?.BANNER ?? '',
    })!;

export default function AdBanner() {
  const { limits } = useSubscriptionStore();
  const [adLoaded, setAdLoaded] = useState(false);

  // Only show ads to free-tier users when native module is available
  if (!limits?.hasAds || !BannerAd) return null;

  return (
    <View style={[styles.container, !adLoaded && styles.hidden]}>
      <BannerAd
        unitId={BANNER_AD_UNIT_ID}
        size={BannerAdSize.BANNER}
        requestOptions={{ requestNonPersonalizedAdsOnly: true }}
        onAdLoaded={() => setAdLoaded(true)}
        onAdFailedToLoad={() => setAdLoaded(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  hidden: {
    height: 0,
    overflow: 'hidden',
  },
});

import { useState } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { BannerAd, BannerAdSize, TestIds } from 'react-native-google-mobile-ads';
import { useSubscriptionStore } from '../stores/subscriptionStore';

// TODO: Replace placeholder unit IDs with real ones from AdMob dashboard before release.
// These test IDs are safe to use in development and will always return test ads.
const BANNER_AD_UNIT_ID = __DEV__
  ? TestIds.BANNER
  : Platform.select({
      ios: 'ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX',
      android: 'ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX',
      default: TestIds.BANNER,
    })!;

export default function AdBanner() {
  const { limits } = useSubscriptionStore();
  const [adLoaded, setAdLoaded] = useState(false);

  // Only show ads to free-tier users
  if (!limits?.hasAds) return null;

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

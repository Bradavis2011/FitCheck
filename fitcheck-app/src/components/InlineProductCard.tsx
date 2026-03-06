/**
 * InlineProductCard
 *
 * Compact affiliate product card shown inline below a feedback bullet
 * when the AI's suggestion matches a garment category.
 *
 * Layout:
 * ┌──────────────────────────────────────────┐
 * │  [56x56 img]  BRAND · $XX      Shop →   │
 * │               Product title (1 line)  ad │
 * └──────────────────────────────────────────┘
 */

import { View, Text, StyleSheet, TouchableOpacity, Image, Linking } from 'react-native';
import { Colors, Fonts, Spacing } from '../constants/theme';
import { api } from '../lib/api';

interface AffiliateProduct {
  id: string;
  title: string;
  brand: string;
  category: string;
  price: number;
  currency: string;
  imageUrl: string;
  affiliateUrl: string;
}

interface Props {
  product: AffiliateProduct;
  impressionId: string;
}

export default function InlineProductCard({ product, impressionId }: Props) {
  const priceSymbol = product.currency === 'USD' ? '$' : product.currency;

  function handleTap() {
    // Record click fire-and-forget
    api
      .post('/api/affiliate/click', { impressionId, productId: product.id })
      .catch(() => {});
    Linking.openURL(product.affiliateUrl).catch(() => {});
  }

  return (
    <TouchableOpacity style={styles.container} onPress={handleTap} activeOpacity={0.8}>
      <Image
        source={{ uri: product.imageUrl }}
        style={styles.image}
        resizeMode="cover"
      />
      <View style={styles.info}>
        <Text style={styles.brand} numberOfLines={1}>
          {product.brand.toUpperCase()}
        </Text>
        <Text style={styles.title} numberOfLines={1}>{product.title}</Text>
      </View>
      <View style={styles.right}>
        <Text style={styles.price}>{priceSymbol}{product.price.toFixed(0)}</Text>
        <Text style={styles.shopCta}>Shop →</Text>
        <Text style={styles.adLabel}>ad</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    marginTop: 6,
    marginBottom: 2,
    padding: Spacing.xs,
    gap: Spacing.sm,
  },
  image: {
    width: 56,
    height: 56,
    backgroundColor: Colors.backgroundSecondary,
    flexShrink: 0,
  },
  info: {
    flex: 1,
    gap: 2,
  },
  brand: {
    fontFamily: Fonts.sansMedium,
    fontSize: 10,
    color: Colors.primary,
    letterSpacing: 0.8,
  },
  title: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    color: Colors.text,
    lineHeight: 16,
  },
  right: {
    alignItems: 'flex-end',
    gap: 2,
    flexShrink: 0,
  },
  price: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 13,
    color: Colors.text,
  },
  shopCta: {
    fontFamily: Fonts.sansMedium,
    fontSize: 12,
    color: Colors.primary,
  },
  adLabel: {
    fontFamily: Fonts.sans,
    fontSize: 8,
    color: Colors.textMuted,
    letterSpacing: 0.3,
  },
});

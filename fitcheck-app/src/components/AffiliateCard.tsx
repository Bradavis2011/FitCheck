/**
 * AffiliateCard
 *
 * Shown post-feedback (score >= 6) with curated product picks from Skimlinks.
 * Fetches from GET /api/affiliate/recommendations
 * Tracks clicks via POST /api/affiliate/click
 *
 * Returns null (renders nothing) when:
 *   - Score < 6
 *   - No catalog products match the user's profile
 *   - API not yet configured (SKIMLINKS_PUBLISHER_ID not set)
 */

import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Linking,
  ScrollView,
} from 'react-native';
import { Colors, Fonts, Spacing, BorderRadius } from '../constants/theme';
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
  relevanceReason: string;
}

interface RecommendationResult {
  impressionId: string;
  placement: string;
  headline: string;
  subtext: string;
  products: AffiliateProduct[];
}

interface Props {
  outfitCheckId: string;
  score: number;
  placement?: 'post_feedback_high' | 'post_feedback_mid' | 'archive' | 'style_dna';
}

export default function AffiliateCard({ outfitCheckId, score, placement }: Props) {
  const [result, setResult] = useState<RecommendationResult | null>(null);
  const [loading, setLoading] = useState(true);

  const derivedPlacement = placement ?? (score >= 8 ? 'post_feedback_high' : 'post_feedback_mid');

  useEffect(() => {
    if (score < 6) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    api
      .get('/api/affiliate/recommendations', {
        params: { outfitId: outfitCheckId, placement: derivedPlacement, score },
      })
      .then(res => {
        if (!cancelled) setResult(res.data?.recommendations ?? null);
      })
      .catch(() => {
        // Affiliate is non-critical — fail silently
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [outfitCheckId, score, derivedPlacement]);

  if (loading || !result || result.products.length === 0) return null;

  function handleProductTap(product: AffiliateProduct) {
    // Record click server-side (fire-and-forget)
    api
      .post('/api/affiliate/click', { impressionId: result!.impressionId, productId: product.id })
      .catch(() => {});

    Linking.openURL(product.affiliateUrl).catch(() => {});
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headline}>{result.headline}</Text>
          <Text style={styles.subtext}>{result.subtext}</Text>
        </View>
        <Text style={styles.sponsoredLabel}>Sponsored</Text>
      </View>

      {/* Horizontal product scroll */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.productRow}
      >
        {result.products.map(product => (
          <TouchableOpacity
            key={product.id}
            style={styles.productCard}
            onPress={() => handleProductTap(product)}
            activeOpacity={0.8}
          >
            <Image
              source={{ uri: product.imageUrl }}
              style={styles.productImage}
              resizeMode="cover"
            />
            <View style={styles.productInfo}>
              <Text style={styles.productBrand} numberOfLines={1}>{product.brand}</Text>
              <Text style={styles.productTitle} numberOfLines={2}>{product.title}</Text>
              <Text style={styles.productPrice}>
                {product.currency === 'USD' ? '$' : product.currency}
                {product.price.toFixed(0)}
              </Text>
            </View>
            <View style={styles.shopButton}>
              <Text style={styles.shopButtonText}>Shop →</Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: Spacing.lg,
    marginBottom: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.md,
  },
  headline: {
    fontFamily: Fonts.serifItalic,
    fontSize: 18,
    color: Colors.text.primary,
  },
  subtext: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    color: Colors.text.secondary,
    marginTop: 2,
    letterSpacing: 0.3,
  },
  sponsoredLabel: {
    fontFamily: Fonts.sans,
    fontSize: 10,
    color: Colors.text.tertiary ?? Colors.text.secondary,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginTop: 4,
  },
  productRow: {
    gap: Spacing.sm,
    paddingRight: Spacing.lg,
  },
  productCard: {
    width: 148,
    backgroundColor: Colors.surface ?? '#FFFFFF',
    borderWidth: 1,
    borderColor: Colors.border ?? '#E8E0D8',
    // Editorial: sharp corners
    overflow: 'hidden',
  },
  productImage: {
    width: '100%',
    height: 148,
    backgroundColor: Colors.background.secondary ?? '#F5EDE7',
  },
  productInfo: {
    padding: Spacing.sm,
  },
  productBrand: {
    fontFamily: Fonts.sansMedium ?? Fonts.sans,
    fontSize: 10,
    color: Colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  productTitle: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    color: Colors.text.primary,
    lineHeight: 16,
    marginBottom: 4,
  },
  productPrice: {
    fontFamily: Fonts.sansSemiBold ?? Fonts.sans,
    fontSize: 13,
    color: Colors.text.primary,
  },
  shopButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 8,
    alignItems: 'center',
  },
  shopButtonText: {
    fontFamily: Fonts.sansMedium ?? Fonts.sans,
    fontSize: 12,
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
});

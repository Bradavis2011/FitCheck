import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Linking } from 'react-native';
import { Colors, Fonts, Spacing, FontSize, BorderRadius } from '../constants/theme';

interface PrescriptionProduct {
  title: string;
  brand: string;
  price: number;
  currency: string;
  imageUrl: string;
  affiliateUrl: string;
}

interface PrescriptionGap {
  gapCategory: string;
  reasoning: string;
  products: PrescriptionProduct[];
}

interface WardrobePrescriptionCardProps {
  gaps: PrescriptionGap[];
  totalItems: number;
  weekPeriod: string;
  onDismiss?: () => void;
}

export default function WardrobePrescriptionCard({ gaps, totalItems, onDismiss }: WardrobePrescriptionCardProps) {
  const handleProductPress = (url: string) => {
    Linking.openURL(url).catch(() => {});
  };

  return (
    <View style={styles.card}>
      {/* Section label */}
      <Text style={styles.sectionLabel}>Wardrobe prescription</Text>
      <View style={styles.rule} />

      <Text style={styles.title}>Your AI identified {totalItems} picks for your wardrobe</Text>
      <Text style={styles.disclosure}>We may earn a commission on purchases</Text>

      {gaps.map((gap, i) => (
        <View key={i} style={styles.gap}>
          <Text style={styles.gapCategory}>{gap.gapCategory}</Text>
          <Text style={styles.gapReasoning}>{gap.reasoning}</Text>

          {gap.products.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.productsRow}
            >
              {gap.products.map((product, j) => (
                <TouchableOpacity
                  key={j}
                  style={styles.productCard}
                  onPress={() => handleProductPress(product.affiliateUrl)}
                  activeOpacity={0.8}
                >
                  {product.imageUrl ? (
                    <Image
                      source={{ uri: product.imageUrl }}
                      style={styles.productImage}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={[styles.productImage, styles.productImagePlaceholder]} />
                  )}
                  <Text style={styles.productBrand} numberOfLines={1}>{product.brand}</Text>
                  <Text style={styles.productTitle} numberOfLines={2}>{product.title}</Text>
                  <Text style={styles.productPrice}>
                    {product.currency === 'USD' ? '$' : product.currency}{product.price.toFixed(0)}
                  </Text>
                  <View style={styles.shopBtn}>
                    <Text style={styles.shopBtnText}>Shop →</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>
      ))}

      {onDismiss && (
        <TouchableOpacity onPress={onDismiss} activeOpacity={0.7} style={styles.dismissRow}>
          <Text style={styles.dismissText}>Dismiss</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.borderSolid,
    gap: Spacing.sm,
  },
  sectionLabel: {
    fontFamily: Fonts.sansMedium,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 2.2,
    color: Colors.textMuted,
  },
  rule: {
    height: 1,
    backgroundColor: Colors.primary,
    width: 32,
  },
  title: {
    fontFamily: Fonts.serif,
    fontSize: FontSize.md,
    color: Colors.text,
    lineHeight: 24,
  },
  disclosure: {
    fontFamily: Fonts.sans,
    fontSize: 11,
    color: Colors.textMuted,
  },
  gap: {
    gap: Spacing.xs,
    paddingTop: Spacing.xs,
    borderTopWidth: 1,
    borderTopColor: Colors.borderSolid,
    marginTop: Spacing.xs,
  },
  gapCategory: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: FontSize.sm,
    color: Colors.text,
    textTransform: 'capitalize',
  },
  gapReasoning: {
    fontFamily: Fonts.sans,
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  productsRow: {
    gap: Spacing.sm,
    paddingTop: Spacing.xs,
  },
  productCard: {
    width: 130,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.borderSolid,
    borderRadius: BorderRadius.sm,
    overflow: 'hidden',
    padding: Spacing.xs,
    gap: 4,
  },
  productImage: {
    width: '100%',
    height: 100,
    backgroundColor: Colors.surfaceLight,
    borderRadius: 2,
  },
  productImagePlaceholder: {
    backgroundColor: Colors.surfaceLight,
  },
  productBrand: {
    fontFamily: Fonts.sansMedium,
    fontSize: 10,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  productTitle: {
    fontFamily: Fonts.sans,
    fontSize: 11,
    color: Colors.text,
    lineHeight: 15,
  },
  productPrice: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 12,
    color: Colors.text,
  },
  shopBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: 5,
    alignItems: 'center',
    borderRadius: BorderRadius.sharp,
    marginTop: 2,
  },
  shopBtnText: {
    fontFamily: Fonts.sansMedium,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    color: Colors.white,
  },
  dismissRow: {
    paddingTop: Spacing.xs,
    alignSelf: 'flex-start',
  },
  dismissText: {
    fontFamily: Fonts.sansMedium,
    fontSize: FontSize.xs,
    color: Colors.textMuted,
  },
});

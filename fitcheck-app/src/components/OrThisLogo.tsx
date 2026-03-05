import { View, Text, StyleSheet } from 'react-native';
import { Colors, Fonts } from '../constants/theme';

interface Props {
  size?: number;
}

// "Or" in DM Sans Medium (black) + "This?" in Playfair Display Italic (coral)
// Uses View row layout so paddingRight can give the italic "?" room to avoid clipping
export default function OrThisLogo({ size = 28 }: Props) {
  return (
    <View style={styles.container}>
      <Text style={[styles.or, { fontSize: size }]}>Or </Text>
      <Text style={[styles.this, { fontSize: size, paddingRight: Math.ceil(size * 0.14) }]}>This?</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  or: {
    fontFamily: Fonts.sansMedium,
    color: Colors.text,
  },
  this: {
    fontFamily: Fonts.serifItalic,
    color: Colors.primary,
  },
});

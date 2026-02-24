import { Text, StyleSheet } from 'react-native';
import { Colors, Fonts } from '../constants/theme';

interface Props {
  size?: number;
}

// "Or" in DM Sans Medium (black) + "This?" in Playfair Display Italic (coral)
export default function OrThisLogo({ size = 28 }: Props) {
  return (
    <Text style={{ fontSize: size }}>
      <Text style={[styles.or, { fontSize: size }]}>Or </Text>
      <Text style={[styles.this, { fontSize: size }]}>This?</Text>
    </Text>
  );
}

const styles = StyleSheet.create({
  or: {
    fontFamily: Fonts.sansMedium,
    color: Colors.text,
  },
  this: {
    fontFamily: Fonts.serifItalic,
    color: Colors.primary,
  },
});

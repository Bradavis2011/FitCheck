import { Text, StyleSheet } from 'react-native';
import { Colors } from '../constants/theme';

interface Props {
  size?: number;
}

export default function OrThisLogo({ size = 36 }: Props) {
  return (
    <Text style={[styles.base, { fontSize: size }]}>
      <Text style={styles.or}>Or </Text>
      <Text style={[styles.this, { fontSize: size }]}>This?</Text>
    </Text>
  );
}

const styles = StyleSheet.create({
  base: {
    fontWeight: '700',
  },
  or: {
    color: '#1A1A1A',
    fontWeight: '700',
  },
  this: {
    color: Colors.primary,
    fontStyle: 'italic',
    fontWeight: '700',
  },
});

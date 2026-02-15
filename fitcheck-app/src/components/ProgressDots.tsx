import { View, StyleSheet } from 'react-native';
import { Colors, BorderRadius } from '../constants/theme';

type Props = {
  total: number;
  current: number;
};

export function ProgressDots({ total, current }: Props) {
  return (
    <View style={styles.container}>
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          style={[styles.dot, i === current ? styles.active : styles.inactive]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    justifyContent: 'center',
  },
  dot: {
    borderRadius: BorderRadius.full,
  },
  active: {
    width: 24,
    height: 8,
    backgroundColor: Colors.primary,
  },
  inactive: {
    width: 8,
    height: 8,
    backgroundColor: Colors.border,
  },
});

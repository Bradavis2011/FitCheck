import { View, Text, StyleSheet } from 'react-native';
import { usePathname } from 'expo-router';
import { Fonts } from '../src/constants/theme';

export default function NotFoundScreen() {
  const path = usePathname();
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Unmatched Route</Text>
      <Text style={styles.path}>{path}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 18,
    marginBottom: 8,
  },
  path: {
    fontSize: 14,
    color: '#888',
  },
});

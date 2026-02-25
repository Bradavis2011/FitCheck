import { View, Text, Image, StyleSheet } from 'react-native';
import { Colors, Fonts } from '../constants/theme';

type Props = {
  imageUri?: string | null;
  initials: string;
  size: number;
};

export default function UserAvatar({ imageUri, initials, size }: Props) {
  const fontSize = Math.round(size * 0.38);
  return (
    <View style={[styles.container, { width: size, height: size, borderRadius: size / 2 }]}>
      {imageUri ? (
        <Image
          source={{ uri: imageUri }}
          style={{ width: size, height: size, borderRadius: size / 2 }}
          resizeMode="cover"
        />
      ) : (
        <Text style={[styles.initials, { fontSize }]}>{initials}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.primaryAlpha10,
    borderWidth: 1,
    borderColor: Colors.primaryAlpha30,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  initials: {
    fontFamily: Fonts.sansMedium,
    color: Colors.primary,
  },
});

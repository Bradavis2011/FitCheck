import { Text, StyleSheet, Pressable } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { Colors, FontSize, BorderRadius } from '../constants/theme';

type Props = {
  label: string;
  selected?: boolean;
  onPress: () => void;
  small?: boolean;
};

export default function PillButton({ label, selected = false, onPress, small = false }: Props) {
  const size = small ? 'sm' : 'md';
  const sizeStyle = size === 'sm' ? styles.sm : styles.md;
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.95);
  };

  const handlePressOut = () => {
    scale.value = withSpring(1);
  };

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
    >
      <Animated.View
        style={[styles.base, sizeStyle, selected ? styles.selected : styles.unselected, animatedStyle]}
      >
        <Text style={[styles.text, selected ? styles.selectedText : styles.unselectedText]}>
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: BorderRadius.full,
  },
  sm: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  md: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  selected: {
    backgroundColor: Colors.primary,
  },
  unselected: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  text: {
    fontWeight: '500',
  },
  selectedText: {
    color: Colors.white,
    fontSize: FontSize.sm,
  },
  unselectedText: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
  },
});

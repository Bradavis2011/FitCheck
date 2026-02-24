import { Text, StyleSheet, Pressable } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { Colors, FontSize, Fonts } from '../constants/theme';

type Props = {
  label: string;
  selected?: boolean;
  onPress: () => void;
  small?: boolean;
};

// Editorial chip — sharp corners (0px), uppercase DM Sans, 1px border
export default function PillButton({ label, selected = false, onPress, small = false }: Props) {
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
        style={[
          styles.base,
          small ? styles.sm : styles.md,
          selected ? styles.selected : styles.unselected,
          animatedStyle,
        ]}
      >
        <Text style={[
          styles.text,
          small ? styles.textSm : styles.textMd,
          selected ? styles.selectedText : styles.unselectedText,
        ]}>
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 0, // sharp corners — editorial spec
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
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  unselected: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.2)',
  },
  text: {
    fontFamily: Fonts.sansMedium,
    textTransform: 'uppercase',
    letterSpacing: 1.0,
  },
  textSm: {
    fontSize: 11,
  },
  textMd: {
    fontSize: 12,
  },
  selectedText: {
    color: Colors.white,
  },
  unselectedText: {
    color: Colors.textMuted,
  },
});

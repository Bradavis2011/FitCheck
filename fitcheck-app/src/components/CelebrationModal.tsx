import { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Animated,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Colors, Spacing, FontSize, BorderRadius } from '../constants/theme';

const { width } = Dimensions.get('window');

interface LevelUpData {
  type: 'levelup';
  oldLevel: number;
  newLevel: number;
  levelName: string;
  pointsAwarded: number;
}

interface BadgeUnlockData {
  type: 'badge';
  badgeId: string;
  badgeName: string;
  badgeDescription: string;
  badgeIcon: string;
}

type CelebrationData = LevelUpData | BadgeUnlockData;

interface CelebrationModalProps {
  visible: boolean;
  data: CelebrationData | null;
  onDismiss: () => void;
}

export default function CelebrationModal({
  visible,
  data,
  onDismiss,
}: CelebrationModalProps) {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const confettiAnims = useRef(
    Array.from({ length: 20 }, () => ({
      x: new Animated.Value(0),
      y: new Animated.Value(0),
      rotation: new Animated.Value(0),
    }))
  ).current;

  useEffect(() => {
    if (visible && data) {
      // Trigger haptic feedback
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // Animate modal entrance
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }).start();

      // Animate icon rotation
      Animated.sequence([
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(rotateAnim, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }),
      ]).start();

      // Animate confetti
      confettiAnims.forEach((anim, index) => {
        const randomX = (Math.random() - 0.5) * width * 1.5;
        const randomDelay = Math.random() * 300;

        Animated.sequence([
          Animated.delay(randomDelay),
          Animated.parallel([
            Animated.timing(anim.x, {
              toValue: randomX,
              duration: 2000,
              useNativeDriver: true,
            }),
            Animated.timing(anim.y, {
              toValue: 800,
              duration: 2000,
              useNativeDriver: true,
            }),
            Animated.timing(anim.rotation, {
              toValue: Math.random() * 720,
              duration: 2000,
              useNativeDriver: true,
            }),
          ]),
        ]).start();
      });
    } else {
      // Reset animations
      scaleAnim.setValue(0);
      rotateAnim.setValue(0);
      confettiAnims.forEach((anim) => {
        anim.x.setValue(0);
        anim.y.setValue(0);
        anim.rotation.setValue(0);
      });
    }
  }, [visible, data]);

  if (!data) return null;

  const rotation = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const renderContent = () => {
    if (data.type === 'levelup') {
      return (
        <>
          <Animated.View
            style={[
              styles.iconContainer,
              {
                transform: [{ scale: scaleAnim }, { rotate: rotation }],
              },
            ]}
          >
            <LinearGradient
              colors={[Colors.primary, Colors.secondary]}
              style={styles.iconGradient}
            >
              <Ionicons name="arrow-up-circle" size={64} color={Colors.white} />
            </LinearGradient>
          </Animated.View>

          <Text style={styles.title}>Level Up!</Text>
          <Text style={styles.subtitle}>
            You've reached <Text style={styles.highlight}>Level {data.newLevel}</Text>
          </Text>
          <Text style={styles.levelName}>{data.levelName}</Text>

          <View style={styles.statsContainer}>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{data.oldLevel}</Text>
              <Text style={styles.statLabel}>Previous</Text>
            </View>
            <Ionicons name="arrow-forward" size={24} color={Colors.primary} />
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{data.newLevel}</Text>
              <Text style={styles.statLabel}>Current</Text>
            </View>
          </View>

          <Text style={styles.encouragement}>
            Keep giving feedback to level up even more!
          </Text>
        </>
      );
    } else {
      return (
        <>
          <Animated.View
            style={[
              styles.iconContainer,
              {
                transform: [{ scale: scaleAnim }],
              },
            ]}
          >
            <View style={styles.badgeIconContainer}>
              <Text style={styles.badgeIconLarge}>{data.badgeIcon}</Text>
            </View>
          </Animated.View>

          <Text style={styles.title}>Badge Unlocked!</Text>
          <Text style={styles.badgeName}>{data.badgeName}</Text>
          <Text style={styles.badgeDescription}>{data.badgeDescription}</Text>

          <View style={styles.achievementBox}>
            <Ionicons name="checkmark-circle" size={20} color={Colors.success} />
            <Text style={styles.achievementText}>Achievement Unlocked</Text>
          </View>
        </>
      );
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
    >
      <View style={styles.overlay}>
        {/* Confetti */}
        {confettiAnims.map((anim, index) => (
          <Animated.View
            key={index}
            style={[
              styles.confetti,
              {
                backgroundColor: [
                  Colors.primary,
                  Colors.secondary,
                  Colors.warning,
                  Colors.success,
                ][index % 4],
                transform: [
                  { translateX: anim.x },
                  { translateY: anim.y },
                  {
                    rotate: anim.rotation.interpolate({
                      inputRange: [0, 720],
                      outputRange: ['0deg', '720deg'],
                    }),
                  },
                ],
              },
            ]}
          />
        ))}

        <Animated.View
          style={[
            styles.modalContainer,
            {
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          <View style={styles.modalContent}>
            {renderContent()}

            <TouchableOpacity
              style={styles.dismissButton}
              onPress={onDismiss}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={[Colors.primary, Colors.secondary]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.dismissGradient}
              >
                <Text style={styles.dismissText}>Awesome!</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  confetti: {
    position: 'absolute',
    width: 10,
    height: 10,
    top: -20,
    left: width / 2,
    borderRadius: 2,
  },
  modalContainer: {
    width: width * 0.85,
    maxWidth: 400,
  },
  modalContent: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  iconContainer: {
    marginBottom: Spacing.lg,
  },
  iconGradient: {
    width: 120,
    height: 120,
    borderRadius: BorderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  badgeIconContainer: {
    width: 120,
    height: 120,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primaryAlpha10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: Colors.primary,
  },
  badgeIconLarge: {
    fontSize: 64,
  },
  title: {
    fontSize: FontSize.xxl,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: FontSize.lg,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing.xs,
  },
  highlight: {
    fontWeight: '700',
    color: Colors.primary,
  },
  levelName: {
    fontSize: FontSize.xl,
    fontWeight: '700',
    color: Colors.primary,
    marginBottom: Spacing.lg,
    textAlign: 'center',
  },
  statsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  statBox: {
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: BorderRadius.md,
    minWidth: 80,
  },
  statValue: {
    fontSize: FontSize.xxl,
    fontWeight: '700',
    color: Colors.primary,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    fontWeight: '600',
  },
  encouragement: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing.lg,
    paddingHorizontal: Spacing.md,
  },
  badgeName: {
    fontSize: FontSize.xl,
    fontWeight: '700',
    color: Colors.primary,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  badgeDescription: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing.lg,
    paddingHorizontal: Spacing.md,
  },
  achievementBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    backgroundColor: Colors.successAlpha10,
    borderRadius: BorderRadius.full,
    marginBottom: Spacing.lg,
  },
  achievementText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.success,
  },
  dismissButton: {
    width: '100%',
    borderRadius: BorderRadius.full,
    overflow: 'hidden',
  },
  dismissGradient: {
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  dismissText: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.white,
  },
});

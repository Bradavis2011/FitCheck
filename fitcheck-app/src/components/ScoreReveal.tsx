/**
 * ScoreReveal — Cinematic 4-second score reveal sequence
 *
 * Phase timeline:
 *   0–2000ms  Scanning: light beam sweeps down the image, cycling analysis phrases
 *   2000–2500ms  Pause: overlay darkens, "Your score is..." fades in, light haptic
 *   2500–4000ms  Slot machine: digits cycle rapidly and decelerate to final score
 *   4000–4500ms  Reaction: pulse ring radiates for scores ≥8; heavy haptic on lock
 *   4500ms+   Fade out (400ms), then onComplete fires
 *
 * No new native dependencies — uses react-native-reanimated + expo-haptics only.
 */

import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Fonts, getScoreColor } from '../constants/theme';

const PHRASES = [
  'Reading color harmony...',
  'Evaluating proportions...',
  'Analyzing silhouette...',
  'Checking style cohesion...',
  'Calibrating your score...',
];

type Props = {
  score: number;
  containerHeight: number;
  onComplete: () => void;
};

export default function ScoreReveal({ score, containerHeight, onComplete }: Props) {
  const [phraseIdx, setPhraseIdx] = useState(0);
  const [displayScore, setDisplayScore] = useState('?.?');
  const [isLocked, setIsLocked] = useState(false);

  const phraseTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const slotTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Animated values
  const scanY = useSharedValue(0);
  const overlayOpacity = useSharedValue(0.35);
  const analyzingOpacity = useSharedValue(1);
  const yourScoreOpacity = useSharedValue(0);
  const scoreContainerOpacity = useSharedValue(0);
  const scoreScale = useSharedValue(0.5);
  const pulseRingScale = useSharedValue(1);
  const pulseRingOpacity = useSharedValue(0);
  const containerOpacity = useSharedValue(1);

  const addTimer = (fn: () => void, delay: number): ReturnType<typeof setTimeout> => {
    const id = setTimeout(fn, delay);
    timersRef.current.push(id);
    return id;
  };

  useEffect(() => {
    // ── Phase 0: Scanning (0–2000ms) ──────────────────────────────────────
    scanY.value = withTiming(containerHeight, {
      duration: 2000,
      easing: Easing.linear,
    });

    phraseTimerRef.current = setInterval(() => {
      setPhraseIdx(i => (i + 1) % PHRASES.length);
    }, 400);

    // ── Phase 1: Dramatic pause (2000ms) ──────────────────────────────────
    addTimer(() => {
      if (phraseTimerRef.current) {
        clearInterval(phraseTimerRef.current);
        phraseTimerRef.current = null;
      }

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      overlayOpacity.value = withTiming(0.72, { duration: 500 });
      analyzingOpacity.value = withTiming(0, { duration: 200 });
      yourScoreOpacity.value = withDelay(250, withTiming(1, { duration: 300 }));

      // ── Phase 2: Slot machine (2500ms) ────────────────────────────────
      addTimer(() => {
        scoreContainerOpacity.value = withTiming(1, { duration: 150 });

        const startTime = Date.now();
        const slotDuration = 1400;

        slotTimerRef.current = setInterval(() => {
          const elapsed = Date.now() - startTime;
          const t = Math.min(elapsed / slotDuration, 1);

          if (t >= 1) {
            if (slotTimerRef.current) {
              clearInterval(slotTimerRef.current);
              slotTimerRef.current = null;
            }

            // Lock on final score
            setDisplayScore(score.toFixed(1));
            setIsLocked(true);

            // Spring bounce: 0.5 → 1.2 → 1.0
            scoreScale.value = withSequence(
              withTiming(1.2, { duration: 180, easing: Easing.out(Easing.cubic) }),
              withSpring(1.0, { damping: 10, stiffness: 200 }),
            );

            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

            // ── Phase 3: Reaction beat ─────────────────────────────────
            addTimer(() => {
              if (score >= 8) {
                pulseRingOpacity.value = withSequence(
                  withTiming(0.85, { duration: 100 }),
                  withDelay(400, withTiming(0, { duration: 350 })),
                );
                pulseRingScale.value = withTiming(2.4, {
                  duration: 700,
                  easing: Easing.out(Easing.cubic),
                });
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

                if (score >= 9) {
                  // Second, stronger pulse
                  addTimer(() => {
                    pulseRingOpacity.value = withSequence(
                      withTiming(0.6, { duration: 80 }),
                      withDelay(300, withTiming(0, { duration: 300 })),
                    );
                    pulseRingScale.value = withSequence(
                      withTiming(1, { duration: 40 }),
                      withTiming(3.0, { duration: 600, easing: Easing.out(Easing.cubic) }),
                    );
                  }, 400);
                }
              }

              // Fade out overlay and complete
              addTimer(() => {
                containerOpacity.value = withTiming(0, { duration: 350 });
                addTimer(onComplete, 350);
              }, score >= 8 ? 700 : 450);

            }, 200);

            return;
          }

          // Slot machine: random digits, decelerating
          const speed = 1 - t * 0.78;
          if (Math.random() < speed) {
            const d1 = Math.floor(Math.random() * 10);
            const d2 = Math.floor(Math.random() * 10);
            setDisplayScore(`${d1}.${d2}`);
          }
        }, 60);

      }, 500);

    }, 2000);

    return () => {
      timersRef.current.forEach(clearTimeout);
      if (phraseTimerRef.current) clearInterval(phraseTimerRef.current);
      if (slotTimerRef.current) clearInterval(slotTimerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Animated styles ───────────────────────────────────────────────────────
  const containerStyle = useAnimatedStyle(() => ({
    opacity: containerOpacity.value,
  }));

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacity.value,
  }));

  const scanLineStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: scanY.value }],
  }));

  const analyzingStyle = useAnimatedStyle(() => ({
    opacity: analyzingOpacity.value,
  }));

  const yourScoreStyle = useAnimatedStyle(() => ({
    opacity: yourScoreOpacity.value,
  }));

  const scoreContainerStyle = useAnimatedStyle(() => ({
    opacity: scoreContainerOpacity.value,
    transform: [{ scale: scoreScale.value }],
  }));

  const pulseStyle = useAnimatedStyle(() => ({
    opacity: pulseRingOpacity.value,
    transform: [{ scale: pulseRingScale.value }],
  }));

  const scoreColor = isLocked ? getScoreColor(score) : '#FFFFFF';

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.root, containerStyle]}>
      {/* Darkening overlay */}
      <Animated.View style={[StyleSheet.absoluteFill, styles.overlay, overlayStyle]} />

      {/* Scan line (horizontal light beam sweeping down) */}
      <Animated.View style={[styles.scanLine, scanLineStyle]} />

      {/* Text labels — centered vertically in lower third */}
      <View style={styles.textArea}>
        <Animated.Text style={[styles.analyzingText, analyzingStyle]}>
          {PHRASES[phraseIdx]}
        </Animated.Text>
        <Animated.Text style={[styles.yourScoreText, yourScoreStyle]}>
          Your score is...
        </Animated.Text>
      </View>

      {/* Score number */}
      <Animated.View style={[styles.scoreContainer, scoreContainerStyle]}>
        {score >= 8 && (
          <Animated.View
            style={[styles.pulseRing, { borderColor: getScoreColor(score) }, pulseStyle]}
          />
        )}
        <Text style={[styles.scoreText, { color: scoreColor }]}>
          {displayScore}
        </Text>
        <Text style={styles.outOfText}>/10</Text>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  overlay: {
    backgroundColor: '#000000',
  },
  scanLine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    shadowColor: '#fff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 8,
    elevation: 5,
  },
  textArea: {
    position: 'absolute',
    bottom: '28%',
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  analyzingText: {
    fontFamily: Fonts.sans,
    fontSize: 14,
    color: 'rgba(255,255,255,0.75)',
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  yourScoreText: {
    position: 'absolute',
    fontFamily: Fonts.serif,
    fontSize: 18,
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  scoreContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  pulseRing: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
  },
  scoreText: {
    fontFamily: Fonts.serif,
    fontSize: 72,
    lineHeight: 80,
    textAlign: 'center',
  },
  outOfText: {
    fontFamily: Fonts.sans,
    fontSize: 20,
    color: 'rgba(255,255,255,0.6)',
    marginLeft: 4,
    alignSelf: 'flex-end',
    marginBottom: 10,
  },
});

import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Image,
  Text,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  GestureDetector,
  Gesture,
} from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  runOnUI,
  runOnJS,
} from 'react-native-reanimated';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { Colors, Spacing, FontSize, BorderRadius, Fonts } from '../constants/theme';

// ─── Types ────────────────────────────────────────────────────────────────────

type ImageCropPreviewProps = {
  uri: string;
  onAccept: (croppedUri: string) => void;
  onRetake: () => void;
};

// ─── Layout constants ─────────────────────────────────────────────────────────

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// The crop frame is 3:4 portrait, full screen width.
const CROP_FRAME_W = SCREEN_WIDTH;
const CROP_FRAME_H = SCREEN_WIDTH * (4 / 3);

// Vertical centre of the crop frame within the screen.
const FRAME_TOP = (SCREEN_HEIGHT - CROP_FRAME_H) / 2;
const FRAME_BOTTOM = FRAME_TOP + CROP_FRAME_H;

// ─── Component ────────────────────────────────────────────────────────────────

export default function ImageCropPreview({ uri, onAccept, onRetake }: ImageCropPreviewProps) {
  const insets = useSafeAreaInsets();

  // Natural image size (loaded async)
  const [naturalWidth, setNaturalWidth] = useState<number | null>(null);
  const [naturalHeight, setNaturalHeight] = useState<number | null>(null);
  const [sizeError, setSizeError] = useState(false);
  // EXIF-normalised URI — manipulateAsync bakes in orientation so that the
  // dimensions it reports and the coordinates it expects for cropping are
  // guaranteed to be in the same pixel space.
  const [normalizedUri, setNormalizedUri] = useState<string | null>(null);

  // Processing state while manipulateAsync runs
  const [isCropping, setIsCropping] = useState(false);

  // ── Gesture shared values ────────────────────────────────────────────────

  // Current accumulated transform
  const scale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);

  // Saved transform at the start of each gesture
  const savedScale = useSharedValue(1);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  // Natural dimensions shared to worklets so clamping is accurate for any
  // image aspect ratio (not hardcoded to 3:4).
  const natW = useSharedValue(1);
  const natH = useSharedValue(1);

  // ── Load natural image size ──────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;

    // Use a no-op manipulateAsync pass instead of Image.getSize.
    // Image.getSize can return logical (device-independent) pixels on some
    // Android versions, while manipulateAsync always works in physical pixel
    // coordinates. Using the same function for both dimension discovery and
    // cropping guarantees they operate in the same coordinate space.
    // The no-op pass also physically bakes in EXIF orientation, so the
    // normalised URI is consistent on all platforms.
    manipulateAsync(uri, []).then((info) => {
      if (cancelled) return;
      const { width: w, height: h, uri: nUri } = info;
      setNaturalWidth(w);
      setNaturalHeight(h);
      setNormalizedUri(nUri);
      natW.value = w;
      natH.value = h;

      const imageHeightAtScale1 = (h / w) * SCREEN_WIDTH;
      const startScale = Math.min(1, CROP_FRAME_H / imageHeightAtScale1);
      scale.value = startScale;
      savedScale.value = startScale;
    }).catch(() => {
      if (!cancelled) setSizeError(true);
    });

    return () => { cancelled = true; };
  }, [uri]);

  // ── Clamp helpers ────────────────────────────────────────────────────────

  // Loose clamp using actual image dimensions.
  // Image can float freely but can't fly completely off screen.
  // Allows gaps around the frame (black shows through) so the user can
  // zoom out to fit their full body.
  const clampTranslation = (
    tx: number,
    ty: number,
    s: number,
    imageNatW: number,
    imageNatH: number
  ): [number, number] => {
    'worklet';
    const renderedW = SCREEN_WIDTH * s;
    const renderedH = (imageNatH / imageNatW) * SCREEN_WIDTH * s;

    const maxTx = renderedW * 0.6 + SCREEN_WIDTH * 0.3;
    const maxTy = renderedH * 0.6 + SCREEN_HEIGHT * 0.3;

    return [
      Math.min(Math.max(tx, -maxTx), maxTx),
      Math.min(Math.max(ty, -maxTy), maxTy),
    ];
  };

  // ── Gestures ─────────────────────────────────────────────────────────────

  const pinchGesture = Gesture.Pinch()
    .onStart(() => {
      'worklet';
      // Capture the current transform at gesture start so e.scale (which is
      // relative to this gesture's own start) computes correctly. Without
      // onStart, savedScale is only set onEnd and stale values cause
      // direction inversion when gestures chain quickly.
      savedScale.value = scale.value;
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    })
    .onUpdate((e) => {
      'worklet';
      // Allow zoom from 0.1 (very zoomed out) to 4x.
      const newScale = Math.min(Math.max(savedScale.value * e.scale, 0.1), 4);
      scale.value = newScale;

      const [cx, cy] = clampTranslation(
        savedTranslateX.value,
        savedTranslateY.value,
        newScale,
        natW.value,
        natH.value
      );
      translateX.value = cx;
      translateY.value = cy;
    });

  const panGesture = Gesture.Pan()
    .onStart(() => {
      'worklet';
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    })
    .onUpdate((e) => {
      'worklet';
      const [cx, cy] = clampTranslation(
        savedTranslateX.value + e.translationX,
        savedTranslateY.value + e.translationY,
        scale.value,
        natW.value,
        natH.value
      );
      translateX.value = cx;
      translateY.value = cy;
    });

  const composedGesture = Gesture.Simultaneous(pinchGesture, panGesture);

  // ── Animated image style ──────────────────────────────────────────────────

  const animatedImageStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  // ── Crop & accept ─────────────────────────────────────────────────────────

  const doCrop = useCallback(async (currentScale: number, currentTx: number, currentTy: number) => {
    setIsCropping(true);

    try {

      // The image wrapper is positioned at its natural aspect ratio, centered
      // on screen. At scale=1 the wrapper is SCREEN_WIDTH × imageNaturalH,
      // with its center at (SCREEN_WIDTH/2, SCREEN_HEIGHT/2).
      //
      // displayScale: how many screen pixels map to one natural pixel in X.
      const displayScale = (SCREEN_WIDTH * currentScale) / naturalWidth;

      // Visual top-left corner of the (scaled) image in screen coordinates.
      const renderedW = naturalWidth * displayScale;
      const renderedH = naturalHeight * displayScale;
      const imgScreenX = (SCREEN_WIDTH - renderedW) / 2 + currentTx;
      const imgScreenY = (SCREEN_HEIGHT - renderedH) / 2 + currentTy;

      // Crop frame in screen coordinates.
      const frameScreenX = 0;
      const frameScreenY = FRAME_TOP;

      // Convert frame origin to natural image coordinates.
      const rawOriginX = (frameScreenX - imgScreenX) / displayScale;
      const rawOriginY = (frameScreenY - imgScreenY) / displayScale;
      const rawCropW = CROP_FRAME_W / displayScale;
      const rawCropH = CROP_FRAME_H / displayScale;

      // Clamp to image bounds.
      const originX = Math.max(0, Math.min(rawOriginX, naturalWidth));
      const originY = Math.max(0, Math.min(rawOriginY, naturalHeight));
      const cropW = Math.min(rawCropW, naturalWidth - originX);
      const cropH = Math.min(rawCropH, naturalHeight - originY);

      const safeW = Math.max(1, Math.round(cropW));
      const safeH = Math.max(1, Math.round(cropH));
      const safeOriginX = Math.round(originX);
      const safeOriginY = Math.round(originY);

      const result = await manipulateAsync(
        normalizedUri ?? uri,
        [{ crop: { originX: safeOriginX, originY: safeOriginY, width: safeW, height: safeH } }],
        { compress: 0.85, format: SaveFormat.JPEG }
      );

      onAccept(result.uri);
    } catch (err) {
      console.error('[ImageCropPreview] crop failed:', err);
      // Fall back to the normalised (or original) image rather than leaving the user stuck.
      onAccept(normalizedUri ?? uri);
    } finally {
      setIsCropping(false);
    }
  }, [naturalWidth, naturalHeight, normalizedUri, uri, onAccept]);

  // Read the current transform from the UI thread then hand off to JS for the
  // async crop computation. This avoids the JS-thread stale-read problem where
  // gesture-driven updates to shared values haven't synced back from the UI
  // thread yet when the user taps "Use This Photo".
  const handleAccept = useCallback(() => {
    if (!naturalWidth || !naturalHeight || isCropping) return;

    runOnUI(() => {
      'worklet';
      const s = scale.value;
      const tx = translateX.value;
      const ty = translateY.value;
      runOnJS(doCrop)(s, tx, ty);
    })();
  }, [naturalWidth, naturalHeight, isCropping, doCrop]);

  // ── Render states ─────────────────────────────────────────────────────────

  if (!naturalWidth || !naturalHeight) {
    return (
      <View style={styles.loadingContainer}>
        {sizeError ? (
          <>
            <Text style={styles.errorText}>Could not load image.</Text>
            <TouchableOpacity style={styles.retakeLink} onPress={onRetake}>
              <Text style={styles.retakeLinkText}>Retake</Text>
            </TouchableOpacity>
          </>
        ) : (
          <ActivityIndicator size="large" color={Colors.primary} />
        )}
      </View>
    );
  }

  // Render the image at its natural aspect ratio, centered vertically on screen.
  // This ensures the crop math is pixel-accurate: the image is exactly
  // SCREEN_WIDTH wide at scale=1, with its center pinned to the screen center.
  // Using resizeMode="cover" on a fixed SCREEN_HEIGHT wrapper pre-crops the image
  // and breaks the coordinate math — this approach avoids that entirely.
  const imageNaturalH = (naturalHeight / naturalWidth) * SCREEN_WIDTH;
  const wrapperTop = (SCREEN_HEIGHT - imageNaturalH) / 2;

  return (
    <View style={styles.root}>
      {/* ── Image at natural aspect ratio, centered on screen ── */}
      <GestureDetector gesture={composedGesture}>
        <Animated.View
          style={[
            styles.imageWrapperBase,
            { height: imageNaturalH, top: wrapperTop },
            animatedImageStyle,
          ]}
        >
          <Image source={{ uri: normalizedUri ?? uri }} style={styles.image} />
        </Animated.View>
      </GestureDetector>

      {/* ── Dim mask: top strip ── */}
      <View
        pointerEvents="none"
        style={[styles.dimStrip, { top: 0, height: FRAME_TOP }]}
      />

      {/* ── Dim mask: bottom strip ── */}
      <View
        pointerEvents="none"
        style={[styles.dimStrip, { top: FRAME_BOTTOM, bottom: 0 }]}
      />

      {/* ── Crop frame border ── */}
      <View
        pointerEvents="none"
        style={[
          styles.cropFrame,
          { top: FRAME_TOP, height: CROP_FRAME_H, width: CROP_FRAME_W },
        ]}
      />

      {/* ── Guide caption ── */}
      <View
        pointerEvents="none"
        style={[styles.guideCaptionWrapper, { top: FRAME_BOTTOM + Spacing.sm }]}
      >
        <Text style={styles.guideCaption}>Pinch to zoom · Drag to reframe</Text>
      </View>

      {/* ── Bottom action bar ── */}
      <View style={[styles.actionBar, { paddingBottom: insets.bottom + Spacing.md }]}>
        <TouchableOpacity
          style={styles.retakeLink}
          onPress={onRetake}
          hitSlop={{ top: 12, bottom: 12, left: 24, right: 24 }}
        >
          <Text style={styles.retakeLinkText}>Retake</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.acceptButton}
          onPress={handleAccept}
          activeOpacity={0.85}
          disabled={isCropping}
        >
          {isCropping ? (
            <ActivityIndicator size="small" color={Colors.white} />
          ) : (
            <Text style={styles.acceptButtonText}>Use This Photo</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.black,
  },

  // ── Loading / error ──────────────────────────────────────────────────────
  loadingContainer: {
    flex: 1,
    backgroundColor: Colors.black,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.md,
  },
  errorText: {
    fontFamily: Fonts.sans,
    fontSize: FontSize.md,
    color: 'rgba(255,255,255,0.7)',
  },

  // ── Image layer ──────────────────────────────────────────────────────────
  // height and top are set dynamically in render based on natural image size.
  imageWrapperBase: {
    position: 'absolute',
    left: 0,
    width: SCREEN_WIDTH,
  },
  image: {
    width: '100%',
    height: '100%',
  },

  // ── Dim masks ────────────────────────────────────────────────────────────
  dimStrip: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },

  // ── Crop frame border ────────────────────────────────────────────────────
  cropFrame: {
    position: 'absolute',
    left: 0,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.6)',
    borderRadius: BorderRadius.sharp,
  },

  // ── Guide caption ─────────────────────────────────────────────────────────
  guideCaptionWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  guideCaption: {
    fontFamily: Fonts.sans,
    fontSize: FontSize.xs,
    color: 'rgba(255,255,255,0.55)',
    letterSpacing: 0.4,
  },

  // ── Action bar ────────────────────────────────────────────────────────────
  actionBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    gap: Spacing.md,
    alignItems: 'center',
  },
  retakeLink: {
    paddingVertical: Spacing.sm,
  },
  retakeLinkText: {
    fontFamily: Fonts.sansMedium,
    fontSize: FontSize.sm,
    color: 'rgba(255,255,255,0.75)',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  acceptButton: {
    width: '100%',
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.sharp,
    paddingVertical: Spacing.md + 2,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  acceptButtonText: {
    fontFamily: Fonts.sansMedium,
    fontSize: FontSize.md,
    color: Colors.white,
    textTransform: 'uppercase',
    letterSpacing: 1.65,
  },
});

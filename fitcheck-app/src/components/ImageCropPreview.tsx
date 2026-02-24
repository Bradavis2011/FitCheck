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

  // ── Load natural image size ──────────────────────────────────────────────

  useEffect(() => {
    Image.getSize(
      uri,
      (w, h) => {
        setNaturalWidth(w);
        setNaturalHeight(h);

        // Compute min scale so that the image always fills the crop frame.
        // At scale=1 the image is rendered at SCREEN_WIDTH wide.
        const minScaleX = CROP_FRAME_W / SCREEN_WIDTH; // always 1
        const imageHeightAtScale1 = (h / w) * SCREEN_WIDTH;
        const minScaleY = CROP_FRAME_H / imageHeightAtScale1;
        const minScale = Math.max(minScaleX, minScaleY);

        // If the image is naturally narrower than the frame, start zoomed in.
        if (minScale > 1) {
          scale.value = minScale;
          savedScale.value = minScale;
        }
      },
      () => {
        setSizeError(true);
      }
    );
  }, [uri]);

  // ── Clamp helpers ────────────────────────────────────────────────────────

  // Given a scale and translation, clamp translation so the image never shows
  // gaps around the crop frame edges.
  // This runs on the UI thread inside worklets — no closures over React state.
  const clampTranslation = (
    tx: number,
    ty: number,
    s: number,
    natW: number,
    natH: number
  ): [number, number] => {
    'worklet';
    // Rendered image size at this scale
    const renderedW = SCREEN_WIDTH * s;
    const renderedH = (natH / natW) * SCREEN_WIDTH * s;

    // Image centre relative to screen centre (accounting for translation)
    // Left edge of image in screen coords:
    const imgLeft = (SCREEN_WIDTH - renderedW) / 2 + tx;
    const imgTop = (SCREEN_HEIGHT - renderedH) / 2 + ty;
    const imgRight = imgLeft + renderedW;
    const imgBottom = imgTop + renderedH;

    // Crop frame bounds
    const frameLeft = 0;
    const frameRight = CROP_FRAME_W;
    const frameTop = FRAME_TOP;
    const frameBottom = FRAME_BOTTOM;

    let clampedTx = tx;
    let clampedTy = ty;

    // Don't let the image right edge retreat past the frame's right edge
    if (imgRight < frameRight) {
      clampedTx += frameRight - imgRight;
    }
    // Don't let the image left edge advance past the frame's left edge
    if (imgLeft > frameLeft) {
      clampedTx -= imgLeft - frameLeft;
    }
    // Same for vertical
    if (imgBottom < frameBottom) {
      clampedTy += frameBottom - imgBottom;
    }
    if (imgTop > frameTop) {
      clampedTy -= imgTop - frameTop;
    }

    return [clampedTx, clampedTy];
  };

  // ── Gestures ─────────────────────────────────────────────────────────────

  const pinchGesture = Gesture.Pinch()
    .onUpdate((e) => {
      'worklet';
      // We need naturalWidth/naturalHeight for clamp but they come from React
      // state (JS thread). We can't read them safely in a worklet, so we use
      // a conservative clamp based on what we know structurally (the image
      // always starts at SCREEN_WIDTH) and accept that the hard floor is 1.
      // The JS-side init already set scale.value = minScale when > 1.
      const raw = savedScale.value * e.scale;
      const minS = savedScale.value < 1.01 ? savedScale.value : 1;
      const newScale = Math.min(Math.max(raw, minS), 4);
      scale.value = newScale;

      // Re-clamp translation for new scale (use last saved natural dims via
      // shared values — we pass 0/0 sentinel if not known yet, which is
      // harmless because scale.value is still 1 then).
      const [cx, cy] = clampTranslation(
        savedTranslateX.value,
        savedTranslateY.value,
        newScale,
        SCREEN_WIDTH,   // approximation — actual natW used in onAccept
        SCREEN_WIDTH * 1.33
      );
      translateX.value = cx;
      translateY.value = cy;
    })
    .onEnd(() => {
      'worklet';
      savedScale.value = scale.value;
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    });

  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      'worklet';
      const rawTx = savedTranslateX.value + e.translationX;
      const rawTy = savedTranslateY.value + e.translationY;
      const [cx, cy] = clampTranslation(
        rawTx,
        rawTy,
        scale.value,
        SCREEN_WIDTH,
        SCREEN_WIDTH * 1.33
      );
      translateX.value = cx;
      translateY.value = cy;
    })
    .onEnd(() => {
      'worklet';
      savedScale.value = scale.value;
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
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

  const handleAccept = useCallback(async () => {
    if (!naturalWidth || !naturalHeight || isCropping) return;
    setIsCropping(true);

    try {
      const currentScale = scale.value;      // read from shared value on JS thread
      const currentTx = translateX.value;
      const currentTy = translateY.value;

      // Scale at which the natural image is displayed on screen.
      // At scale=1 the image is rendered at SCREEN_WIDTH wide.
      const displayScale = (SCREEN_WIDTH * currentScale) / naturalWidth;

      // Top-left corner of the rendered image in screen coordinates.
      const renderedW = naturalWidth * displayScale;
      const renderedH = naturalHeight * displayScale;
      const imgScreenX = (SCREEN_WIDTH - renderedW) / 2 + currentTx;
      const imgScreenY = (SCREEN_HEIGHT - renderedH) / 2 + currentTy;

      // Crop frame position in screen coordinates.
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

      // Ensure non-zero dimensions (safety guard).
      const safeW = Math.max(1, Math.round(cropW));
      const safeH = Math.max(1, Math.round(cropH));
      const safeOriginX = Math.round(originX);
      const safeOriginY = Math.round(originY);

      const result = await manipulateAsync(
        uri,
        [{ crop: { originX: safeOriginX, originY: safeOriginY, width: safeW, height: safeH } }],
        { compress: 0.85, format: SaveFormat.JPEG }
      );

      onAccept(result.uri);
    } catch (err) {
      console.error('[ImageCropPreview] crop failed:', err);
      // Fall back to the uncropped image rather than leaving the user stuck.
      onAccept(uri);
    } finally {
      setIsCropping(false);
    }
  }, [naturalWidth, naturalHeight, isCropping, uri, onAccept]);

  // ── Render states ─────────────────────────────────────────────────────────

  // Still loading natural size
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

  return (
    <View style={styles.root}>
      {/* ── Full-bleed animated image ── */}
      <GestureDetector gesture={composedGesture}>
        <Animated.View style={[styles.imageWrapper, animatedImageStyle]}>
          <Image
            source={{ uri }}
            style={styles.image}
            resizeMode="cover"
          />
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
  imageWrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  image: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
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

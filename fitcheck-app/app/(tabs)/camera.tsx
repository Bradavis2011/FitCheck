import { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Platform,
  Linking,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { CameraView, CameraType, useCameraPermissions, FlashMode } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { useAppStore } from '../../src/stores/auth';
import { Colors, Spacing, FontSize, BorderRadius } from '../../src/constants/theme';
import { useUserStats } from '../../src/hooks/useApi';

type CameraMode = 'camera' | 'preview' | 'permission-denied';

export default function CameraScreen() {
  const router = useRouter();
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<CameraType>('back');
  const [flash, setFlash] = useState<FlashMode>('off');
  const [mode, setMode] = useState<CameraMode>('camera');
  const [capturedUri, setCapturedUri] = useState<string | null>(null);
  const setCapturedImage = useAppStore((state) => state.setCapturedImage);

  // Check daily limit
  const { data: stats } = useUserStats();
  const dailyChecksRemaining = stats?.dailyChecksRemaining ?? null;
  const isAtLimit = dailyChecksRemaining !== null && dailyChecksRemaining <= 0;

  useEffect(() => {
    // Check permission on mount
    if (permission && !permission.granted && permission.canAskAgain === false) {
      setMode('permission-denied');
    }
  }, [permission]);

  const handleCapture = async () => {
    if (!cameraRef.current) return;

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        base64: false,
      });

      if (photo?.uri) {
        setCapturedUri(photo.uri);
        setMode('preview');
      }
    } catch (error) {
      console.error('Camera capture error:', error);
      Alert.alert('Error', 'Failed to capture photo. Please try again.');
    }
  };

  const handleGalleryPick = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [3, 4],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]?.uri) {
        setCapturedUri(result.assets[0].uri);
        setMode('preview');
      }
    } catch (error) {
      console.error('Gallery pick error:', error);
      Alert.alert('Error', 'Failed to pick image from gallery.');
    }
  };

  const handleFlipCamera = () => {
    setFacing((current) => (current === 'back' ? 'front' : 'back'));
  };

  const toggleFlash = () => {
    setFlash((current) => (current === 'off' ? 'on' : 'off'));
  };

  const handleRetake = () => {
    setCapturedUri(null);
    setMode('camera');
  };

  const handleUsePhoto = () => {
    if (!capturedUri) return;

    // Check daily limit before proceeding
    if (isAtLimit) {
      Alert.alert(
        'Daily Limit Reached',
        'Free accounts get 3 outfit checks per day. Upgrade to Plus for unlimited checks!',
        [{ text: 'OK' }]
      );
      return;
    }

    setCapturedImage(capturedUri);
    // Navigate to context screen
    router.push('/context' as any);
  };

  const handleOpenSettings = () => {
    Linking.openSettings();
  };

  // Permission denied screen
  if (mode === 'permission-denied') {
    return (
      <View style={styles.container}>
        <SafeAreaView style={styles.centerContent}>
          <View style={styles.permissionBox}>
            <Ionicons name="camera-outline" size={64} color={Colors.textMuted} />
            <Text style={styles.permissionTitle}>Camera Access Required</Text>
            <Text style={styles.permissionText}>
              Or This? needs camera access to capture your outfit photos.
            </Text>
            <TouchableOpacity style={styles.settingsButton} onPress={handleOpenSettings} accessibilityLabel="Open device settings to grant camera permission" accessibilityRole="button">
              <Text style={styles.settingsButtonText}>Open Settings</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.galleryFallback} onPress={handleGalleryPick} accessibilityLabel="Choose a photo from gallery instead" accessibilityRole="button">
              <Text style={styles.galleryFallbackText}>Or choose from gallery</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  // Preview mode
  if (mode === 'preview' && capturedUri) {
    return (
      <View style={styles.container}>
        <SafeAreaView style={styles.safeArea} edges={['top']}>
          <View style={styles.previewContainer}>
            <Image
              source={{ uri: capturedUri }}
              style={styles.previewImage}
              resizeMode="cover"
              accessibilityLabel="Captured outfit photo preview"
            />
          </View>
          <View style={styles.previewActions}>
            <TouchableOpacity style={styles.actionButton} onPress={handleRetake} accessibilityLabel="Retake photo" accessibilityRole="button">
              <Text style={styles.actionButtonText}>Retake</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, styles.actionButtonPrimary]}
              onPress={handleUsePhoto}
              accessibilityLabel="Use this photo for outfit check"
              accessibilityRole="button"
            >
              <Text style={styles.actionButtonTextPrimary}>Use This Photo</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  // Camera mode
  if (!permission) {
    return (
      <View style={styles.container}>
        <View style={styles.centerContent}>
          <Text style={styles.loadingText}>Loading camera...</Text>
        </View>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <SafeAreaView style={styles.centerContent}>
          <View style={styles.permissionBox}>
            <Ionicons name="camera-outline" size={64} color={Colors.textMuted} />
            <Text style={styles.permissionTitle}>Camera Permission</Text>
            <Text style={styles.permissionText}>
              We need your permission to use the camera.
            </Text>
            <TouchableOpacity style={styles.settingsButton} onPress={requestPermission} accessibilityLabel="Grant camera permission" accessibilityRole="button">
              <Text style={styles.settingsButtonText}>Grant Permission</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.galleryFallback} onPress={handleGalleryPick} accessibilityLabel="Choose a photo from gallery instead" accessibilityRole="button">
              <Text style={styles.galleryFallbackText}>Or choose from gallery</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView ref={cameraRef} style={styles.camera} facing={facing} flash={flash}>
        <SafeAreaView style={styles.safeArea}>
          {/* Top bar */}
          <View style={styles.topBar}>
            <TouchableOpacity style={styles.topButton} onPress={() => router.back()} accessibilityLabel="Go back" accessibilityRole="button">
              <Ionicons name="arrow-back" size={20} color={Colors.white} />
            </TouchableOpacity>
            <Text style={styles.topTitle}>Take Photo</Text>
            <TouchableOpacity style={styles.topButton} onPress={toggleFlash} accessibilityLabel={flash === 'on' ? 'Turn flash off' : 'Turn flash on'} accessibilityRole="button">
              <Ionicons
                name={flash === 'on' ? 'flash' : 'flash-off'}
                size={20}
                color={Colors.white}
              />
            </TouchableOpacity>
          </View>

          {/* Viewfinder area with silhouette guide */}
          <View style={styles.viewfinder}>
            <View style={styles.silhouette}>
              <View style={styles.silhouetteHead} />
              <View style={styles.silhouetteBody} />
            </View>
            <Text style={styles.guideText}>Position yourself in the frame</Text>
          </View>

          {/* Bottom controls */}
          <View style={styles.controls}>
            <TouchableOpacity style={styles.sideButton} onPress={handleGalleryPick} accessibilityLabel="Choose from photo gallery" accessibilityRole="button">
              <Ionicons name="image" size={24} color={Colors.white} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.captureOuter}
              activeOpacity={0.8}
              onPress={handleCapture}
              accessibilityLabel="Take photo"
              accessibilityRole="button"
            >
              <View style={styles.captureInner} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.sideButton} onPress={handleFlipCamera} accessibilityLabel="Switch between front and back camera" accessibilityRole="button">
              <Ionicons name="camera-reverse" size={24} color={Colors.white} />
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </CameraView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.black,
  },
  camera: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  loadingText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: FontSize.md,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  topButton: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  topTitle: {
    color: Colors.white,
    fontSize: FontSize.md,
    fontWeight: '600',
  },
  viewfinder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  silhouette: {
    alignItems: 'center',
    opacity: 0.2,
    marginBottom: Spacing.lg,
  },
  silhouetteHead: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.full,
    borderWidth: 2,
    borderColor: Colors.white,
    marginBottom: 8,
  },
  silhouetteBody: {
    width: 80,
    height: 120,
    borderRadius: BorderRadius.lg,
    borderWidth: 2,
    borderColor: Colors.white,
  },
  guideText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: FontSize.sm,
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 48,
    paddingVertical: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  sideButton: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.md,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureOuter: {
    width: 80,
    height: 80,
    borderRadius: BorderRadius.full,
    borderWidth: 4,
    borderColor: Colors.white,
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureInner: {
    width: 64,
    height: 64,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.white,
  },
  // Permission screens
  permissionBox: {
    alignItems: 'center',
    gap: Spacing.md,
    maxWidth: 300,
  },
  permissionTitle: {
    fontSize: FontSize.xl,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  permissionText: {
    fontSize: FontSize.md,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    lineHeight: 22,
  },
  settingsButton: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.full,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    marginTop: Spacing.md,
  },
  settingsButtonText: {
    color: Colors.white,
    fontSize: FontSize.lg,
    fontWeight: '600',
  },
  galleryFallback: {
    paddingVertical: Spacing.sm,
  },
  galleryFallbackText: {
    color: Colors.primary,
    fontSize: FontSize.md,
    fontWeight: '600',
  },
  // Preview mode
  previewContainer: {
    flex: 1,
    backgroundColor: Colors.black,
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  previewActions: {
    flexDirection: 'row',
    gap: Spacing.md,
    padding: Spacing.lg,
    backgroundColor: 'transparent',
  },
  actionButton: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: '#FFFFFF',
    alignItems: 'center',
  },
  actionButtonPrimary: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: FontSize.lg,
    fontWeight: '600',
  },
  actionButtonTextPrimary: {
    color: Colors.white,
    fontSize: FontSize.lg,
    fontWeight: '600',
  },
});

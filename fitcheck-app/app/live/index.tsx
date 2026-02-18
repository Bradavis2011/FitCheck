import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, FontSize, BorderRadius } from '../../src/constants/theme';
import { liveService } from '../../src/services/live.service';
import { useSubscriptionStore } from '../../src/stores/subscriptionStore';
import { track } from '../../src/lib/analytics';

export default function GoLiveScreen() {
  useEffect(() => { track('feature_used', { feature: 'live' }); }, []);
  const router = useRouter();
  const { tier } = useSubscriptionStore();
  const [title, setTitle] = useState('');
  const [facing, setFacing] = useState<CameraType>('front');
  const [permission, requestPermission] = useCameraPermissions();
  const [isCreating, setIsCreating] = useState(false);

  // Free users cannot host — show upgrade gate
  if (tier === 'free') {
    return (
      <View style={styles.container}>
        <SafeAreaView style={styles.safeArea} edges={['top']}>
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
              <Ionicons name="close" size={28} color={Colors.text} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Go Live</Text>
            <View style={{ width: 40 }} />
          </View>
          <View style={styles.upgradeContainer}>
            <Ionicons name="videocam-outline" size={64} color={Colors.primary} />
            <Text style={styles.upgradeTitle}>Plus Feature</Text>
            <Text style={styles.upgradeText}>
              Live streaming is available to Plus and Pro subscribers. Upgrade to go live and get
              real-time AI outfit feedback from your community.
            </Text>
            <TouchableOpacity
              style={styles.upgradeButton}
              onPress={() => router.push('/upgrade' as any)}
            >
              <Text style={styles.upgradeButtonText}>Upgrade to Plus</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.browseButton}
              onPress={() => router.push('/live/browse' as any)}
            >
              <Text style={styles.browseButtonText}>Browse Live Streams</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  if (!permission) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.permissionContainer}>
            <Ionicons name="camera-outline" size={64} color={Colors.textMuted} />
            <Text style={styles.permissionTitle}>Camera Permission Required</Text>
            <Text style={styles.permissionText}>
              Or This? needs camera access to start live streaming
            </Text>
            <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
              <Text style={styles.permissionButtonText}>Grant Permission</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  const handleGoLive = async () => {
    if (!title.trim()) {
      Alert.alert('Title Required', 'Please enter a title for your live stream');
      return;
    }

    try {
      setIsCreating(true);

      // Create session
      const session = await liveService.createSession(title.trim());

      // Start session
      await liveService.startSession(session.id);

      // Navigate to live stream screen
      router.replace(`/live/${session.id}` as any);
    } catch (error: any) {
      Alert.alert('Error', error?.response?.data?.error || 'Failed to start live stream');
    } finally {
      setIsCreating(false);
    }
  };

  const toggleCameraFacing = () => {
    setFacing((current) => (current === 'back' ? 'front' : 'back'));
  };

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="close" size={28} color={Colors.white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Go Live</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Camera Preview */}
        <View style={styles.cameraContainer}>
          <CameraView style={styles.camera} facing={facing}>
            <View style={styles.cameraOverlay}>
              <TouchableOpacity style={styles.flipButton} onPress={toggleCameraFacing}>
                <Ionicons name="camera-reverse-outline" size={28} color={Colors.white} />
              </TouchableOpacity>
            </View>
          </CameraView>
        </View>

        {/* Input Section */}
        <View style={styles.inputSection}>
          <Text style={styles.label}>Stream Title</Text>
          <TextInput
            style={styles.input}
            placeholder="What's your outfit for today?"
            placeholderTextColor={Colors.textMuted}
            value={title}
            onChangeText={setTitle}
            maxLength={100}
            autoFocus
          />
          <Text style={styles.charCount}>{title.length}/100</Text>

          <View style={styles.infoBox}>
            <Ionicons name="information-circle-outline" size={20} color={Colors.primary} />
            <Text style={styles.infoText}>
              Your followers will be notified when you go live
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.goLiveButton, isCreating && styles.goLiveButtonDisabled]}
            onPress={handleGoLive}
            disabled={isCreating}
            activeOpacity={0.8}
          >
            {isCreating ? (
              <ActivityIndicator color={Colors.white} />
            ) : (
              <>
                <Ionicons name="videocam" size={24} color={Colors.white} />
                <Text style={styles.goLiveButtonText}>Go Live</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.surface,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.text,
  },
  upgradeContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  upgradeTitle: {
    fontSize: FontSize.xl,
    fontWeight: '700',
    color: Colors.text,
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  upgradeText: {
    fontSize: FontSize.md,
    color: Colors.textMuted,
    textAlign: 'center',
    marginBottom: Spacing.xl,
    lineHeight: 22,
  },
  upgradeButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
  },
  upgradeButtonText: {
    color: Colors.white,
    fontSize: FontSize.md,
    fontWeight: '700',
  },
  browseButton: {
    paddingHorizontal: 32,
    paddingVertical: 14,
  },
  browseButtonText: {
    color: Colors.primary,
    fontSize: FontSize.md,
    fontWeight: '600',
  },
  cameraContainer: {
    flex: 1,
    backgroundColor: Colors.black,
  },
  camera: {
    flex: 1,
  },
  cameraOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
    padding: Spacing.lg,
  },
  flipButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  inputSection: {
    padding: Spacing.lg,
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  label: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.textMuted,
    marginBottom: Spacing.xs,
  },
  input: {
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    fontSize: FontSize.md,
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  charCount: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    textAlign: 'right',
    marginBottom: Spacing.md,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primaryAlpha10,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.lg,
  },
  infoText: {
    flex: 1,
    fontSize: FontSize.sm,
    color: Colors.textMuted,
  },
  goLiveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.error,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.full,
  },
  goLiveButtonDisabled: {
    opacity: 0.6,
  },
  goLiveButtonText: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.white,
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  permissionTitle: {
    fontSize: FontSize.xl,
    fontWeight: '700',
    color: Colors.text,
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  permissionText: {
    fontSize: FontSize.md,
    color: Colors.textMuted,
    textAlign: 'center',
    marginBottom: Spacing.xl,
  },
  permissionButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.full,
  },
  permissionButtonText: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.white,
  },
});

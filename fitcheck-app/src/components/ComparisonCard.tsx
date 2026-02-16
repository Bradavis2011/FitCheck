import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Colors, Spacing, FontSize, BorderRadius } from '../constants/theme';

interface ComparisonCardProps {
  id: string;
  username: string;
  userAvatar?: string;
  imageA: string;
  imageB: string;
  question?: string;
  occasions: string[];
  votesA: number;
  votesB: number;
  totalVotes: number;
  userVote?: 'A' | 'B' | null;
  createdAt: string;
  onVote: (choice: 'A' | 'B') => void;
  onUserPress: () => void;
}

export default function ComparisonCard({
  id,
  username,
  userAvatar,
  imageA,
  imageB,
  question,
  occasions,
  votesA,
  votesB,
  totalVotes,
  userVote,
  createdAt,
  onVote,
  onUserPress,
}: ComparisonCardProps) {
  const [selectedVote, setSelectedVote] = useState<'A' | 'B' | null>(userVote || null);
  const [localVotesA, setLocalVotesA] = useState(votesA);
  const [localVotesB, setLocalVotesB] = useState(votesB);

  const handleVote = (choice: 'A' | 'B') => {
    if (selectedVote === choice) return; // Already voted for this

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // Update local state optimistically
    let newVotesA = localVotesA;
    let newVotesB = localVotesB;

    if (selectedVote) {
      // Changing vote
      if (selectedVote === 'A') {
        newVotesA -= 1;
        newVotesB += 1;
      } else {
        newVotesB -= 1;
        newVotesA += 1;
      }
    } else {
      // New vote
      if (choice === 'A') {
        newVotesA += 1;
      } else {
        newVotesB += 1;
      }
    }

    setLocalVotesA(newVotesA);
    setLocalVotesB(newVotesB);
    setSelectedVote(choice);

    onVote(choice);
  };

  const percentageA = totalVotes > 0 ? (localVotesA / (localVotesA + localVotesB)) * 100 : 50;
  const percentageB = totalVotes > 0 ? (localVotesB / (localVotesA + localVotesB)) * 100 : 50;
  const showResults = selectedVote !== null;

  return (
    <View style={styles.container}>
      {/* Header */}
      <TouchableOpacity style={styles.header} onPress={onUserPress} activeOpacity={0.7}>
        <View style={styles.userAvatar}>
          {userAvatar ? (
            <Image source={{ uri: userAvatar }} style={styles.avatarImage} />
          ) : (
            <Text style={styles.avatarText}>{username.slice(0, 2).toUpperCase()}</Text>
          )}
        </View>
        <View style={styles.userInfo}>
          <Text style={styles.username}>@{username}</Text>
          <Text style={styles.timestamp}>{createdAt}</Text>
        </View>
        <View style={styles.orBadgeSmall}>
          <Text style={styles.orTextSmall}>or?</Text>
        </View>
      </TouchableOpacity>

      {/* Question */}
      {question && (
        <View style={styles.questionContainer}>
          <Text style={styles.question}>{question}</Text>
        </View>
      )}

      {/* Images */}
      <View style={styles.imagesRow}>
        {/* Option A */}
        <TouchableOpacity
          style={[
            styles.imageContainer,
            selectedVote === 'A' && styles.imageContainerSelected,
          ]}
          onPress={() => handleVote('A')}
          activeOpacity={0.8}
        >
          <Image source={{ uri: imageA }} style={styles.outfitImage} />
          {selectedVote === 'A' && (
            <View style={styles.selectedBadge}>
              <Ionicons name="checkmark-circle" size={24} color={Colors.white} />
            </View>
          )}
          <View style={styles.optionLabel}>
            <Text style={styles.optionLabelText}>A</Text>
          </View>
          {showResults && (
            <View style={styles.resultsOverlay}>
              <Text style={styles.percentage}>{Math.round(percentageA)}%</Text>
              <Text style={styles.voteCount}>{localVotesA} votes</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Option B */}
        <TouchableOpacity
          style={[
            styles.imageContainer,
            selectedVote === 'B' && styles.imageContainerSelected,
          ]}
          onPress={() => handleVote('B')}
          activeOpacity={0.8}
        >
          <Image source={{ uri: imageB }} style={styles.outfitImage} />
          {selectedVote === 'B' && (
            <View style={styles.selectedBadge}>
              <Ionicons name="checkmark-circle" size={24} color={Colors.white} />
            </View>
          )}
          <View style={styles.optionLabel}>
            <Text style={styles.optionLabelText}>B</Text>
          </View>
          {showResults && (
            <View style={styles.resultsOverlay}>
              <Text style={styles.percentage}>{Math.round(percentageB)}%</Text>
              <Text style={styles.voteCount}>{localVotesB} votes</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Results Bar */}
      {showResults && (
        <View style={styles.resultsBar}>
          <View style={styles.resultsBarTrack}>
            <View style={[styles.resultsBarFillA, { width: `${percentageA}%` }]} />
          </View>
          <Text style={styles.totalVotesText}>{localVotesA + localVotesB} total votes</Text>
        </View>
      )}

      {/* Footer */}
      <View style={styles.footer}>
        <View style={styles.occasions}>
          {occasions.slice(0, 2).map((occasion) => (
            <View key={occasion} style={styles.occasionPill}>
              <Text style={styles.occasionText}>{occasion}</Text>
            </View>
          ))}
          {occasions.length > 2 && (
            <Text style={styles.moreOccasions}>+{occasions.length - 2}</Text>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
  },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primaryAlpha10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.sm,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: BorderRadius.full,
  },
  avatarText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.primary,
  },
  userInfo: {
    flex: 1,
  },
  username: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.text,
  },
  timestamp: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginTop: 2,
  },
  orBadgeSmall: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  orTextSmall: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: Colors.white,
    fontStyle: 'italic',
  },
  questionContainer: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  question: {
    fontSize: FontSize.md,
    color: Colors.text,
    lineHeight: 20,
  },
  imagesRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
  },
  imageContainer: {
    flex: 1,
    aspectRatio: 3 / 4,
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
    backgroundColor: Colors.surface,
    position: 'relative',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  imageContainerSelected: {
    borderColor: Colors.primary,
  },
  outfitImage: {
    width: '100%',
    height: '100%',
  },
  selectedBadge: {
    position: 'absolute',
    top: Spacing.sm,
    right: Spacing.sm,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.full,
  },
  optionLabel: {
    position: 'absolute',
    top: Spacing.sm,
    left: Spacing.sm,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
  },
  optionLabelText: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: Colors.white,
  },
  resultsOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.75)',
    padding: Spacing.sm,
    alignItems: 'center',
  },
  percentage: {
    fontSize: FontSize.xl,
    fontWeight: '700',
    color: Colors.white,
  },
  voteCount: {
    fontSize: FontSize.xs,
    color: Colors.white,
    marginTop: 2,
  },
  resultsBar: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
  },
  resultsBarTrack: {
    height: 6,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.full,
    overflow: 'hidden',
  },
  resultsBarFillA: {
    height: '100%',
    backgroundColor: Colors.primary,
  },
  totalVotesText: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: Spacing.xs,
  },
  footer: {
    padding: Spacing.md,
  },
  occasions: {
    flexDirection: 'row',
    gap: Spacing.xs,
    alignItems: 'center',
  },
  occasionPill: {
    backgroundColor: Colors.surfaceLight,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
  },
  occasionText: {
    fontSize: FontSize.xs,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  moreOccasions: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
  },
});

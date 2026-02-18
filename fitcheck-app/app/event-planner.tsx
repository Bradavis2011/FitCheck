import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Spacing, FontSize, BorderRadius } from '../src/constants/theme';
import { useSubscriptionStore } from '../src/stores/subscriptionStore';
import { useEvents, useCreateEvent, useDeleteEvent } from '../src/hooks/useApi';
import type { Event, EventDressCode, EventType } from '../src/services/api.service';
import { track } from '../src/lib/analytics';

const DRESS_CODES: { value: EventDressCode; label: string }[] = [
  { value: 'casual', label: 'Casual' },
  { value: 'smart_casual', label: 'Smart Casual' },
  { value: 'business_casual', label: 'Business Casual' },
  { value: 'formal', label: 'Formal' },
  { value: 'black_tie', label: 'Black Tie' },
];

const EVENT_TYPES: { value: EventType; label: string; icon: string }[] = [
  { value: 'wedding', label: 'Wedding', icon: 'heart' },
  { value: 'job_interview', label: 'Job Interview', icon: 'briefcase' },
  { value: 'date_night', label: 'Date Night', icon: 'wine' },
  { value: 'conference', label: 'Conference', icon: 'people' },
  { value: 'party', label: 'Party', icon: 'musical-notes' },
  { value: 'vacation', label: 'Vacation', icon: 'airplane' },
  { value: 'other', label: 'Other', icon: 'calendar' },
];

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

function daysUntil(dateStr: string) {
  const diff = new Date(dateStr).getTime() - Date.now();
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
  if (days < 0) return 'Past';
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  return `In ${days} days`;
}

function eventTypeIcon(type: EventType | null): string {
  return EVENT_TYPES.find((t) => t.value === type)?.icon ?? 'calendar';
}

export default function EventPlannerScreen() {
  useEffect(() => { track('feature_used', { feature: 'event_planner' }); }, []);
  const router = useRouter();
  const { tier } = useSubscriptionStore();

  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState('');
  const [dateStr, setDateStr] = useState('');
  const [dressCode, setDressCode] = useState<EventDressCode | undefined>(undefined);
  const [eventType, setEventType] = useState<EventType | undefined>(undefined);
  const [notes, setNotes] = useState('');
  const [activeTab, setActiveTab] = useState<'upcoming' | 'past'>('upcoming');

  const { data, isLoading } = useEvents(activeTab);
  const events: Event[] = data?.events ?? [];

  const createEvent = useCreateEvent();
  const deleteEvent = useDeleteEvent();

  // Pro gate
  if (tier !== 'pro') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Event Planner</Text>
          <View style={styles.backButton} />
        </View>
        <View style={styles.gateContainer}>
          <LinearGradient
            colors={[Colors.primary, '#FF7A6B']}
            style={styles.gateIcon}
          >
            <Ionicons name="calendar" size={36} color={Colors.white} />
          </LinearGradient>
          <Text style={styles.gateTitle}>Event Planning Mode</Text>
          <Text style={styles.gateSubtitle}>
            Plan outfits for upcoming events and get AI-powered comparisons to find your best look.
          </Text>
          <View style={styles.gateFeatures}>
            {[
              'Create events with dress codes',
              'Attach outfit options to each event',
              'AI compares outfits & picks the best',
              'One-tap styling tips for the occasion',
            ].map((f) => (
              <View key={f} style={styles.gateFeatureRow}>
                <Ionicons name="checkmark-circle" size={18} color={Colors.primary} />
                <Text style={styles.gateFeatureText}>{f}</Text>
              </View>
            ))}
          </View>
          <TouchableOpacity
            style={styles.upgradeButton}
            onPress={() => router.push('/upgrade' as any)}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={[Colors.primary, '#FF7A6B']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.upgradeButtonGradient}
            >
              <Text style={styles.upgradeButtonText}>Upgrade to Pro</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  function resetForm() {
    setTitle('');
    setDateStr('');
    setDressCode(undefined);
    setEventType(undefined);
    setNotes('');
  }

  function handleCreate() {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      Alert.alert('Title required', 'Please enter an event name.');
      return;
    }
    if (!dateStr.trim()) {
      Alert.alert('Date required', 'Please enter the event date (YYYY-MM-DD).');
      return;
    }
    // Validate date
    const parsed = new Date(dateStr.trim());
    if (isNaN(parsed.getTime())) {
      Alert.alert('Invalid date', 'Please enter the date as YYYY-MM-DD (e.g. 2026-03-15).');
      return;
    }

    createEvent.mutate(
      {
        title: trimmedTitle,
        date: parsed.toISOString(),
        dressCode,
        type: eventType,
        notes: notes.trim() || undefined,
      },
      {
        onSuccess: (data) => {
          setShowCreate(false);
          resetForm();
          router.push(`/event/${data.event.id}` as any);
        },
        onError: (err: any) => {
          Alert.alert('Error', err?.response?.data?.error ?? 'Could not create event. Try again.');
        },
      }
    );
  }

  function handleDelete(event: Event) {
    Alert.alert('Delete Event', `Delete "${event.title}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () =>
          deleteEvent.mutate(event.id, {
            onError: () => Alert.alert('Error', 'Could not delete event. Try again.'),
          }),
      },
    ]);
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Event Planner</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => setShowCreate(true)}>
          <Ionicons name="add-circle" size={28} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        {(['upcoming', 'past'] as const).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {isLoading ? (
          <ActivityIndicator style={styles.loader} color={Colors.primary} />
        ) : events.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="calendar-outline" size={56} color={Colors.textMuted} />
            <Text style={styles.emptyTitle}>
              {activeTab === 'upcoming' ? 'No upcoming events' : 'No past events'}
            </Text>
            {activeTab === 'upcoming' && (
              <TouchableOpacity style={styles.createFirstButton} onPress={() => setShowCreate(true)}>
                <Text style={styles.createFirstText}>Create your first event</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <View style={styles.eventList}>
            {events.map((event) => (
              <TouchableOpacity
                key={event.id}
                style={styles.eventCard}
                activeOpacity={0.8}
                onPress={() => router.push(`/event/${event.id}` as any)}
                onLongPress={() => handleDelete(event)}
              >
                <View style={styles.eventCardLeft}>
                  <View style={styles.eventIconContainer}>
                    <Ionicons
                      name={eventTypeIcon(event.type) as any}
                      size={22}
                      color={Colors.primary}
                    />
                  </View>
                </View>
                <View style={styles.eventCardBody}>
                  <Text style={styles.eventTitle} numberOfLines={1}>
                    {event.title}
                  </Text>
                  <Text style={styles.eventDate}>{formatDate(event.date)}</Text>
                  <View style={styles.eventMeta}>
                    {event.dressCode && (
                      <View style={styles.metaChip}>
                        <Text style={styles.metaChipText}>
                          {DRESS_CODES.find((d) => d.value === event.dressCode)?.label ?? event.dressCode}
                        </Text>
                      </View>
                    )}
                    <View style={styles.metaChip}>
                      <Ionicons name="shirt-outline" size={12} color={Colors.textMuted} />
                      <Text style={styles.metaChipText}>{event.outfitCount ?? 0} outfits</Text>
                    </View>
                  </View>
                </View>
                <View style={styles.eventCardRight}>
                  <Text style={[
                    styles.daysUntil,
                    event.status === 'past' && styles.daysUntilPast,
                  ]}>
                    {daysUntil(event.date)}
                  </Text>
                  <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Create Event Modal */}
      <Modal
        visible={showCreate}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => { setShowCreate(false); resetForm(); }}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => { setShowCreate(false); resetForm(); }}>
              <Ionicons name="close" size={24} color={Colors.text} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>New Event</Text>
            <TouchableOpacity onPress={handleCreate} disabled={createEvent.isPending}>
              {createEvent.isPending ? (
                <ActivityIndicator color={Colors.primary} />
              ) : (
                <Text style={styles.modalSave}>Create</Text>
              )}
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody} keyboardShouldPersistTaps="handled">
            <Text style={styles.fieldLabel}>Event Name *</Text>
            <TextInput
              style={styles.textInput}
              value={title}
              onChangeText={setTitle}
              placeholder="e.g. Sarah's Wedding"
              placeholderTextColor={Colors.textMuted}
              returnKeyType="next"
            />

            <Text style={styles.fieldLabel}>Date * (YYYY-MM-DD)</Text>
            <TextInput
              style={styles.textInput}
              value={dateStr}
              onChangeText={setDateStr}
              placeholder="e.g. 2026-03-15"
              placeholderTextColor={Colors.textMuted}
              keyboardType="numbers-and-punctuation"
              returnKeyType="done"
            />

            <Text style={styles.fieldLabel}>Event Type</Text>
            <View style={styles.chipGrid}>
              {EVENT_TYPES.map((t) => (
                <TouchableOpacity
                  key={t.value}
                  style={[styles.chip, eventType === t.value && styles.chipActive]}
                  onPress={() => setEventType(eventType === t.value ? undefined : t.value)}
                >
                  <Ionicons
                    name={t.icon as any}
                    size={14}
                    color={eventType === t.value ? Colors.white : Colors.text}
                  />
                  <Text style={[styles.chipText, eventType === t.value && styles.chipTextActive]}>
                    {t.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.fieldLabel}>Dress Code</Text>
            <View style={styles.chipGrid}>
              {DRESS_CODES.map((d) => (
                <TouchableOpacity
                  key={d.value}
                  style={[styles.chip, dressCode === d.value && styles.chipActive]}
                  onPress={() => setDressCode(dressCode === d.value ? undefined : d.value)}
                >
                  <Text style={[styles.chipText, dressCode === d.value && styles.chipTextActive]}>
                    {d.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.fieldLabel}>Notes (optional)</Text>
            <TextInput
              style={[styles.textInput, styles.textArea]}
              value={notes}
              onChangeText={setNotes}
              placeholder="Anything else to keep in mind..."
              placeholderTextColor={Colors.textMuted}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />

            <View style={{ height: 40 }} />
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: FontSize.xl, fontWeight: '700', color: Colors.text },
  tabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: Colors.border },
  tab: { flex: 1, paddingVertical: Spacing.md, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: Colors.primary },
  tabText: { fontSize: FontSize.md, fontWeight: '600', color: Colors.textMuted },
  tabTextActive: { color: Colors.primary },
  scrollView: { flex: 1 },
  loader: { marginTop: Spacing.xl * 2 },
  emptyState: {
    alignItems: 'center',
    paddingVertical: Spacing.xl * 3,
    paddingHorizontal: Spacing.xl,
    gap: Spacing.md,
  },
  emptyTitle: { fontSize: FontSize.lg, fontWeight: '600', color: Colors.textSecondary },
  createFirstButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.full,
  },
  createFirstText: { color: Colors.white, fontWeight: '700', fontSize: FontSize.md },
  eventList: { padding: Spacing.md, gap: Spacing.md },
  eventCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    gap: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  eventCardLeft: {},
  eventIconContainer: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primaryAlpha10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  eventCardBody: { flex: 1 },
  eventTitle: { fontSize: FontSize.md, fontWeight: '700', color: Colors.text, marginBottom: 2 },
  eventDate: { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: Spacing.xs },
  eventMeta: { flexDirection: 'row', gap: Spacing.xs, flexWrap: 'wrap' },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: Colors.surfaceLight,
    borderRadius: BorderRadius.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  metaChipText: { fontSize: 11, color: Colors.textMuted, fontWeight: '500' },
  eventCardRight: { alignItems: 'flex-end', gap: 4 },
  daysUntil: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.primary },
  daysUntilPast: { color: Colors.textMuted },
  // Pro Gate
  gateContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    gap: Spacing.lg,
  },
  gateIcon: {
    width: 80,
    height: 80,
    borderRadius: BorderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gateTitle: { fontSize: 24, fontWeight: '700', color: Colors.text, textAlign: 'center' },
  gateSubtitle: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  gateFeatures: { width: '100%', gap: Spacing.sm },
  gateFeatureRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  gateFeatureText: { fontSize: FontSize.md, color: Colors.textSecondary, flex: 1 },
  upgradeButton: { width: '100%', borderRadius: BorderRadius.full, overflow: 'hidden' },
  upgradeButtonGradient: {
    paddingVertical: Spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  upgradeButtonText: { color: Colors.white, fontWeight: '700', fontSize: FontSize.lg },
  // Modal
  modalContainer: { flex: 1, backgroundColor: Colors.background },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalTitle: { fontSize: FontSize.xl, fontWeight: '700', color: Colors.text },
  modalSave: { fontSize: FontSize.md, fontWeight: '700', color: Colors.primary },
  modalBody: { flex: 1, padding: Spacing.md },
  fieldLabel: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
    marginTop: Spacing.md,
  },
  textInput: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    fontSize: FontSize.md,
    color: Colors.text,
  },
  textArea: { minHeight: 80, paddingTop: Spacing.md },
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginTop: Spacing.xs },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.text },
  chipTextActive: { color: Colors.white },
});

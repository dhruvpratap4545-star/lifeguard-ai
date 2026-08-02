import React, { useCallback } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  withSpring,
} from 'react-native-reanimated';
import { useColors } from '@/hooks/useColors';
import { useSensor } from '@/context/SensorContext';
import {
  useGetStats,
  useListEmergencySessions,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';

const WEB_TOP_INSET = 67;

export default function DashboardScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === 'web';
  const { status, triggerEmergency, location } = useSensor();
  const queryClient = useQueryClient();

  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useGetStats();
  const { data: sessions, isLoading: sessionsLoading, refetch: refetchSessions } =
    useListEmergencySessions({ limit: 5 });

  const isEmergency = status === 'countdown' || status === 'active';

  const sosScale = useSharedValue(1);
  const pulseOpacity = useSharedValue(0.4);

  React.useEffect(() => {
    pulseOpacity.value = withRepeat(
      withSequence(
        withTiming(0.15, { duration: 1000 }),
        withTiming(0.4, { duration: 1000 }),
      ),
      -1,
      false,
    );
  }, []);

  const pulseStyle = useAnimatedStyle(() => ({
    opacity: pulseOpacity.value,
  }));

  const sosStyle = useAnimatedStyle(() => ({
    transform: [{ scale: sosScale.value }],
  }));

  const handleSOS = useCallback(async () => {
    if (isEmergency) return;
    sosScale.value = withSpring(0.93, {}, () => {
      sosScale.value = withSpring(1);
    });
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    triggerEmergency('sos');
  }, [isEmergency, triggerEmergency, sosScale]);

  const onRefresh = useCallback(() => {
    refetchStats();
    refetchSessions();
  }, [refetchStats, refetchSessions]);

  const statusColor = isEmergency
    ? colors.destructive
    : status === 'armed'
      ? colors.warning
      : colors.success;

  const statusLabel = isEmergency
    ? 'EMERGENCY'
    : status === 'armed'
      ? 'MONITORING'
      : 'STANDBY';

  const topPad = isWeb ? WEB_TOP_INSET : insets.top + 16;

  const styles = makeStyles(colors);

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingTop: topPad, paddingBottom: insets.bottom + (isWeb ? 34 : 100) }}
      refreshControl={
        <RefreshControl
          refreshing={statsLoading || sessionsLoading}
          onRefresh={onRefresh}
          tintColor={colors.primary}
        />
      }
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>LifeGuard AI</Text>
          <View style={styles.statusRow}>
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
            <Text style={[styles.statusLabel, { color: statusColor }]}>{statusLabel}</Text>
          </View>
        </View>
        <View style={[styles.shieldBadge, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Ionicons name="shield-checkmark" size={22} color={colors.primary} />
        </View>
      </View>

      {/* SOS Button */}
      <View style={styles.sosSectionContainer}>
        {/* Pulse rings */}
        <Animated.View
          style={[
            styles.pulseRing,
            pulseStyle,
            { borderColor: isEmergency ? colors.destructive : colors.primary },
          ]}
          pointerEvents="none"
        />
        <Animated.View style={sosStyle}>
          <Pressable
            onPress={handleSOS}
            disabled={isEmergency}
            style={({ pressed }) => [
              styles.sosButton,
              {
                backgroundColor: isEmergency ? colors.muted : colors.primary,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            <Ionicons
              name={isEmergency ? 'alert-circle' : 'alert-circle-outline'}
              size={48}
              color={isEmergency ? colors.mutedForeground : '#ffffff'}
            />
            <Text style={[styles.sosLabel, { color: isEmergency ? colors.mutedForeground : '#ffffff' }]}>
              {isEmergency ? 'ACTIVE' : 'SOS'}
            </Text>
          </Pressable>
        </Animated.View>
        <Text style={[styles.sosHint, { color: colors.mutedForeground }]}>
          {isEmergency ? 'Emergency in progress' : 'Press to trigger emergency alert'}
        </Text>
      </View>

      {/* GPS Status */}
      {location && (
        <View style={[styles.gpsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Feather name="map-pin" size={14} color={colors.success} />
          <Text style={[styles.gpsText, { color: colors.mutedForeground }]}>
            {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}
          </Text>
          <View style={[styles.gpsDot, { backgroundColor: colors.success }]} />
        </View>
      )}

      {/* Stats */}
      <View style={styles.statsRow}>
        <StatCard
          label="Total"
          value={stats?.totalEmergencies ?? 0}
          icon="flash"
          color={colors.primary}
          loading={statsLoading}
          colors={colors}
        />
        <StatCard
          label="Resolved"
          value={stats?.resolvedEmergencies ?? 0}
          icon="checkmark-circle"
          color={colors.success}
          loading={statsLoading}
          colors={colors}
        />
        <StatCard
          label="Contacts"
          value={stats?.totalContacts ?? 0}
          icon="people"
          color={colors.info}
          loading={statsLoading}
          colors={colors}
        />
      </View>

      {/* Recent Activity */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Recent Activity</Text>
        {sessionsLoading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 20 }} />
        ) : !sessions || sessions.length === 0 ? (
          <View style={[styles.emptyState, { borderColor: colors.border }]}>
            <Feather name="shield" size={32} color={colors.mutedForeground} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No emergencies recorded</Text>
          </View>
        ) : (
          sessions.map((session) => (
            <View
              key={session.id}
              style={[styles.sessionCard, { backgroundColor: colors.card, borderColor: colors.border }]}
            >
              <View style={styles.sessionHeader}>
                <View style={[styles.triggerBadge, { backgroundColor: colors.secondary }]}>
                  <Text style={[styles.triggerText, { color: colors.foreground }]}>
                    {session.triggerType.toUpperCase()}
                  </Text>
                </View>
                <View
                  style={[
                    styles.statusBadge,
                    {
                      backgroundColor:
                        session.status === 'resolved'
                          ? `${colors.success}22`
                          : session.status === 'cancelled'
                            ? `${colors.mutedForeground}22`
                            : `${colors.primary}22`,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.statusBadgeText,
                      {
                        color:
                          session.status === 'resolved'
                            ? colors.success
                            : session.status === 'cancelled'
                              ? colors.mutedForeground
                              : colors.primary,
                      },
                    ]}
                  >
                    {session.status}
                  </Text>
                </View>
              </View>
              <Text style={[styles.sessionTime, { color: colors.mutedForeground }]}>
                {new Date(session.createdAt).toLocaleString()}
              </Text>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

interface StatCardProps {
  label: string;
  value: number;
  icon: string;
  color: string;
  loading: boolean;
  colors: ReturnType<typeof useColors>;
}

function StatCard({ label, value, icon, color, loading, colors }: StatCardProps) {
  return (
    <View style={[statStyles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Ionicons name={icon as any} size={20} color={color} />
      {loading ? (
        <ActivityIndicator size="small" color={color} style={{ marginTop: 6 }} />
      ) : (
        <Text style={[statStyles.value, { color: colors.foreground }]}>{value}</Text>
      )}
      <Text style={[statStyles.label, { color: colors.mutedForeground }]}>{label}</Text>
    </View>
  );
}

const statStyles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    alignItems: 'center',
    gap: 4,
  },
  value: {
    fontSize: 24,
    fontWeight: '700',
    marginTop: 4,
  },
  label: {
    fontSize: 11,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});

function makeStyles(colors: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    container: { flex: 1 },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      marginBottom: 28,
    },
    headerTitle: {
      fontSize: 26,
      fontWeight: '800',
      letterSpacing: -0.5,
    },
    statusRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: 4,
    },
    statusDot: {
      width: 7,
      height: 7,
      borderRadius: 4,
    },
    statusLabel: {
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 1,
    },
    shieldBadge: {
      width: 44,
      height: 44,
      borderRadius: 22,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sosSectionContainer: {
      alignItems: 'center',
      marginBottom: 24,
    },
    pulseRing: {
      position: 'absolute',
      width: 180,
      height: 180,
      borderRadius: 90,
      borderWidth: 2,
      top: -10,
    },
    sosButton: {
      width: 160,
      height: 160,
      borderRadius: 80,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#ef4444',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.6,
      shadowRadius: 20,
      elevation: 12,
    },
    sosLabel: {
      fontSize: 16,
      fontWeight: '900',
      letterSpacing: 2,
      marginTop: 4,
    },
    sosHint: {
      fontSize: 12,
      marginTop: 16,
      textAlign: 'center',
    },
    gpsCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginHorizontal: 20,
      marginBottom: 20,
      padding: 10,
      borderRadius: 10,
      borderWidth: 1,
    },
    gpsText: {
      flex: 1,
      fontSize: 12,
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
    gpsDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
    },
    statsRow: {
      flexDirection: 'row',
      gap: 10,
      marginHorizontal: 20,
      marginBottom: 24,
    },
    section: {
      paddingHorizontal: 20,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '700',
      marginBottom: 12,
      letterSpacing: -0.2,
    },
    emptyState: {
      alignItems: 'center',
      justifyContent: 'center',
      padding: 32,
      borderRadius: 12,
      borderWidth: 1,
      borderStyle: 'dashed',
      gap: 8,
    },
    emptyText: {
      fontSize: 14,
    },
    sessionCard: {
      borderRadius: 12,
      borderWidth: 1,
      padding: 14,
      marginBottom: 10,
      gap: 8,
    },
    sessionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    triggerBadge: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6,
    },
    triggerText: {
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 0.5,
    },
    statusBadge: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6,
    },
    statusBadgeText: {
      fontSize: 10,
      fontWeight: '600',
      letterSpacing: 0.3,
    },
    sessionTime: {
      fontSize: 12,
    },
  });
}

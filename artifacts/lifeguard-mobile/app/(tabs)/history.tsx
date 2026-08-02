import React, { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useListEmergencySessions } from '@workspace/api-client-react';
import type { EmergencySession } from '@workspace/api-client-react';

const WEB_TOP_INSET = 67;

const TRIGGER_ICONS: Record<string, string> = {
  fall: 'arrow-down-circle',
  crash: 'car',
  sos: 'alert-circle',
  manual: 'hand-right',
};

const STATUS_COLORS = {
  resolved: 'success' as const,
  cancelled: 'mutedForeground' as const,
  active: 'destructive' as const,
  pending: 'warning' as const,
};

export default function HistoryScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === 'web';
  const topPad = isWeb ? WEB_TOP_INSET : insets.top + 16;

  const [expandedId, setExpandedId] = useState<number | null>(null);

  const { data: sessions, isLoading, refetch } = useListEmergencySessions({ limit: 50 });

  const styles = makeStyles(colors);

  const toggleExpand = (id: number) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };
  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad, borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>History</Text>
        {sessions && sessions.length > 0 && (
          <View style={[styles.countBadge, { backgroundColor: colors.secondary }]}>
            <Text style={[styles.countText, { color: colors.mutedForeground }]}>{sessions.length}</Text>
          </View>
        )}
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : (
        <FlatList
          data={sessions ?? []}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingTop: 14,
            paddingBottom: isWeb ? 34 : insets.bottom + 100,
            flexGrow: 1,
          }}
          refreshControl={
            <RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={colors.primary} />
          }
          showsVerticalScrollIndicator={false}
          scrollEnabled={!!(sessions && sessions.length > 0)}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Feather name="clock" size={36} color={colors.mutedForeground} />
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No history yet</Text>
              <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>
                Emergency sessions will appear here after they occur.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <SessionCard
              session={item}
              expanded={expandedId === item.id}
              onPress={() => toggleExpand(item.id)}
              colors={colors}
              formatDate={formatDate}
              formatTime={formatTime}
            />
          )}
        />
      )}
    </View>
  );
}

interface SessionCardProps {
  session: EmergencySession;
  expanded: boolean;
  onPress: () => void;
  colors: ReturnType<typeof useColors>;
  formatDate: (s: string) => string;
  formatTime: (s: string) => string;
}

function SessionCard({ session, expanded, onPress, colors, formatDate, formatTime }: SessionCardProps) {
  const statusKey = session.status as keyof typeof STATUS_COLORS;
  const statusColorKey = STATUS_COLORS[statusKey] ?? 'mutedForeground';
  const statusColor = (colors as any)[statusColorKey] ?? colors.mutedForeground;
  const iconName = TRIGGER_ICONS[session.triggerType] ?? 'alert-circle';

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        cardStyles.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      {/* Top row */}
      <View style={cardStyles.topRow}>
        {/* Trigger icon */}
        <View
          style={[
            cardStyles.iconBg,
            {
              backgroundColor:
                session.status === 'active' || session.status === 'pending'
                  ? `${colors.destructive}22`
                  : `${colors.secondary}`,
            },
          ]}
        >
          <Ionicons
            name={iconName as any}
            size={20}
            color={
              session.status === 'active' || session.status === 'pending'
                ? colors.destructive
                : colors.mutedForeground
            }
          />
        </View>

        {/* Trigger + time */}
        <View style={cardStyles.mainInfo}>
          <Text style={[cardStyles.triggerLabel, { color: colors.foreground }]}>
            {session.triggerType.charAt(0).toUpperCase() + session.triggerType.slice(1)} detected
          </Text>
          <Text style={[cardStyles.timeLabel, { color: colors.mutedForeground }]}>
            {formatDate(session.createdAt)} · {formatTime(session.createdAt)}
          </Text>
        </View>

        {/* Status badge + chevron */}
        <View style={cardStyles.rightSide}>
          <View style={[cardStyles.statusBadge, { backgroundColor: `${statusColor}22` }]}>
            <Text style={[cardStyles.statusText, { color: statusColor }]}>
              {session.status}
            </Text>
          </View>
          <Ionicons
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={16}
            color={colors.mutedForeground}
          />
        </View>
      </View>

      {/* Expanded details */}
      {expanded && (
        <View style={[cardStyles.details, { borderTopColor: colors.border }]}>
          <DetailRow
            label="Location"
            value={`${session.latitude.toFixed(5)}, ${session.longitude.toFixed(5)}`}
            icon="map-pin"
            colors={colors}
            mono
          />
          {session.accelerometerPeak != null && (
            <DetailRow
              label="Peak Force"
              value={`${session.accelerometerPeak.toFixed(2)}g`}
              icon="activity"
              colors={colors}
              mono
            />
          )}
          {session.countdownSeconds != null && (
            <DetailRow
              label="Countdown"
              value={`${session.countdownSeconds}s`}
              icon="clock"
              colors={colors}
            />
          )}
          {session.resolvedAt && (
            <DetailRow
              label="Resolved"
              value={`${formatDate(session.resolvedAt)} ${formatTime(session.resolvedAt)}`}
              icon="check-circle"
              colors={colors}
            />
          )}
          {session.notes && (
            <DetailRow
              label="Notes"
              value={session.notes}
              icon="file-text"
              colors={colors}
            />
          )}
          <DetailRow
            label="Session ID"
            value={`#${session.id}`}
            icon="hash"
            colors={colors}
            mono
          />
        </View>
      )}
    </Pressable>
  );
}

interface DetailRowProps {
  label: string;
  value: string;
  icon: string;
  colors: ReturnType<typeof useColors>;
  mono?: boolean;
}

function DetailRow({ label, value, icon, colors, mono }: DetailRowProps) {
  return (
    <View style={cardStyles.detailRow}>
      <Feather name={icon as any} size={13} color={colors.mutedForeground} style={{ marginTop: 1 }} />
      <Text style={[cardStyles.detailLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <Text
        style={[
          cardStyles.detailValue,
          { color: colors.foreground },
          mono ? { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' } : {},
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

const cardStyles = StyleSheet.create({
  card: {
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 10,
    overflow: 'hidden',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
  },
  iconBg: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mainInfo: {
    flex: 1,
    gap: 3,
  },
  triggerLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  timeLabel: {
    fontSize: 12,
  },
  rightSide: {
    alignItems: 'flex-end',
    gap: 6,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  details: {
    borderTopWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  detailLabel: {
    fontSize: 12,
    width: 72,
    flexShrink: 0,
  },
  detailValue: {
    flex: 1,
    fontSize: 12,
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
      paddingBottom: 14,
      borderBottomWidth: 1,
    },
    headerTitle: {
      fontSize: 26,
      fontWeight: '800',
      letterSpacing: -0.5,
    },
    countBadge: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
    },
    countText: {
      fontSize: 13,
      fontWeight: '600',
    },
    loadingContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyState: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingTop: 60,
      gap: 10,
      paddingHorizontal: 24,
    },
    emptyTitle: {
      fontSize: 18,
      fontWeight: '700',
    },
    emptySubtitle: {
      fontSize: 14,
      textAlign: 'center',
      lineHeight: 20,
    },
  });
}

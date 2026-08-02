import React, { useCallback, useEffect, useRef } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useColors } from '@/hooks/useColors';
import { useSensor } from '@/context/SensorContext';

const WEB_TOP_INSET = 67;
const HISTORY_LENGTH = 40;

export default function SensorScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === 'web';
  const topPad = isWeb ? WEB_TOP_INSET : insets.top + 16;

  const {
    sensorData,
    location,
    status,
    countdown,
    triggerType,
    armSensor,
    disarmSensor,
    cancelEmergency,
    resolveEmergency,
    locationPermission,
    requestLocationPermission,
  } = useSensor();

  const historyRef = useRef<number[]>(Array(HISTORY_LENGTH).fill(0));
  const [history, setHistory] = React.useState<number[]>(Array(HISTORY_LENGTH).fill(0));

  const countdownPulse = useSharedValue(1);

  useEffect(() => {
    historyRef.current = [...historyRef.current.slice(1), sensorData.magnitude];
    setHistory([...historyRef.current]);
  }, [sensorData.magnitude]);

  useEffect(() => {
    if (status === 'countdown') {
      countdownPulse.value = withRepeat(
        withSequence(
          withTiming(0.9, { duration: 500 }),
          withTiming(1, { duration: 500 }),
        ),
        -1,
        false,
      );
    } else {
      countdownPulse.value = 1;
    }
  }, [status]);

  const countdownStyle = useAnimatedStyle(() => ({
    transform: [{ scale: countdownPulse.value }],
  }));

  const handleArmToggle = useCallback(async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (status === 'armed') {
      disarmSensor();
    } else if (status === 'idle') {
      armSensor();
    }
  }, [status, armSensor, disarmSensor]);

  const handleCancel = useCallback(async () => {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    cancelEmergency();
  }, [cancelEmergency]);

  const handleResolve = useCallback(async () => {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    resolveEmergency();
  }, [resolveEmergency]);

  const mag = sensorData.magnitude;
  const magColor =
    mag >= 2.5 ? colors.destructive : mag >= 1.8 ? colors.warning : colors.success;

  const isCountdown = status === 'countdown';
  const isActive = status === 'active';
  const isArmed = status === 'armed';

  const styles = makeStyles(colors);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Emergency Overlay */}
      {(isCountdown || isActive) && (
        <View style={[StyleSheet.absoluteFill, styles.overlay, { backgroundColor: `${colors.destructive}11` }]}>
          <Animated.View style={[styles.countdownCircle, countdownStyle, { borderColor: colors.destructive }]}>
            <Text style={[styles.countdownNumber, { color: colors.destructive }]}>
              {isCountdown ? countdown : '!'}
            </Text>
            <Text style={[styles.countdownLabel, { color: colors.destructive }]}>
              {isCountdown ? 'CALLING IN' : 'EMERGENCY'}
            </Text>
          </Animated.View>

          <Text style={[styles.triggerInfo, { color: colors.foreground }]}>
            {triggerType?.toUpperCase()} DETECTED
          </Text>

          <View style={styles.emergencyActions}>
            {isCountdown && (
              <Pressable
                onPress={handleCancel}
                style={({ pressed }) => [
                  styles.cancelBtn,
                  { backgroundColor: colors.secondary, opacity: pressed ? 0.7 : 1 },
                ]}
              >
                <Ionicons name="close" size={20} color={colors.foreground} />
                <Text style={[styles.cancelBtnText, { color: colors.foreground }]}>Cancel</Text>
              </Pressable>
            )}
            {isActive && (
              <Pressable
                onPress={handleResolve}
                style={({ pressed }) => [
                  styles.resolveBtn,
                  { backgroundColor: colors.success, opacity: pressed ? 0.7 : 1 },
                ]}
              >
                <Ionicons name="checkmark" size={20} color="#fff" />
                <Text style={[styles.resolveBtnText, { color: '#fff' }]}>Resolved</Text>
              </Pressable>
            )}
          </View>
        </View>
      )}

      {/* Main Content */}
      <View style={[styles.content, { paddingTop: topPad }]}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>Sensor</Text>
          <View
            style={[
              styles.statusPill,
              {
                backgroundColor:
                  isArmed || isCountdown || isActive
                    ? `${colors.primary}22`
                    : `${colors.mutedForeground}22`,
              },
            ]}
          >
            <View
              style={[
                styles.statusDot,
                {
                  backgroundColor:
                    isArmed ? colors.success : isCountdown || isActive ? colors.destructive : colors.mutedForeground,
                },
              ]}
            />
            <Text
              style={[
                styles.statusText,
                {
                  color:
                    isArmed ? colors.success : isCountdown || isActive ? colors.destructive : colors.mutedForeground,
                },
              ]}
            >
              {isActive ? 'EMERGENCY' : isCountdown ? 'TRIGGERED' : isArmed ? 'ARMED' : 'DISARMED'}
            </Text>
          </View>
        </View>

        {/* Magnitude Gauge */}
        <View style={[styles.gaugeCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.gaugeLabel, { color: colors.mutedForeground }]}>ACCELERATION</Text>
          <Text style={[styles.gaugeValue, { color: magColor }]}>{mag.toFixed(2)}</Text>
          <Text style={[styles.gaugeUnit, { color: colors.mutedForeground }]}>g-force</Text>

          {/* Waveform */}
          <View style={styles.waveform}>
            {history.map((val, i) => {
              const barH = Math.min((val / 4) * 48, 48);
              const barColor =
                val >= 2.5 ? colors.destructive : val >= 1.8 ? colors.warning : colors.success;
              return (
                <View key={i} style={styles.barWrapper}>
                  <View
                    style={[
                      styles.bar,
                      { height: Math.max(barH, 2), backgroundColor: barColor },
                    ]}
                  />
                </View>
              );
            })}
          </View>

          {/* Threshold indicators */}
          <View style={styles.thresholds}>
            <View style={styles.thresholdRow}>
              <View style={[styles.thresholdDot, { backgroundColor: colors.success }]} />
              <Text style={[styles.thresholdText, { color: colors.mutedForeground }]}>Normal {'<'} 1.8g</Text>
            </View>
            <View style={styles.thresholdRow}>
              <View style={[styles.thresholdDot, { backgroundColor: colors.warning }]} />
              <Text style={[styles.thresholdText, { color: colors.mutedForeground }]}>Elevated 1.8–2.5g</Text>
            </View>
            <View style={styles.thresholdRow}>
              <View style={[styles.thresholdDot, { backgroundColor: colors.destructive }]} />
              <Text style={[styles.thresholdText, { color: colors.mutedForeground }]}>Fall {'>'} 2.5g</Text>
            </View>
          </View>
        </View>

        {/* XYZ readout */}
        <View style={styles.xyzRow}>
          {['X', 'Y', 'Z'].map((axis, i) => {
            const val = [sensorData.x, sensorData.y, sensorData.z][i];
            return (
              <View key={axis} style={[styles.axisCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.axisLabel, { color: colors.mutedForeground }]}>{axis}</Text>
                <Text style={[styles.axisValue, { color: colors.foreground }]}>{val.toFixed(3)}</Text>
              </View>
            );
          })}
        </View>

        {/* Location */}
        <View style={[styles.locationCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Feather name="map-pin" size={14} color={location ? colors.success : colors.mutedForeground} />
          {location ? (
            <Text style={[styles.locationText, { color: colors.mutedForeground }]}>
              {location.latitude.toFixed(5)}, {location.longitude.toFixed(5)}
            </Text>
          ) : (
            <Pressable onPress={requestLocationPermission}>
              <Text style={[styles.locationText, { color: colors.primary }]}>
                {locationPermission === 'denied' ? 'Location denied' : 'Enable location'}
              </Text>
            </Pressable>
          )}
        </View>

        {/* Platform warning */}
        {Platform.OS === 'web' && (
          <View style={[styles.webNotice, { backgroundColor: `${colors.warning}11`, borderColor: `${colors.warning}33` }]}>
            <Ionicons name="warning-outline" size={16} color={colors.warning} />
            <Text style={[styles.webNoticeText, { color: colors.warning }]}>
              Accelerometer requires Expo Go on a physical device
            </Text>
          </View>
        )}
      </View>

      {/* Arm/Disarm Button */}
      <View
        style={[
          styles.armContainer,
          { paddingBottom: isWeb ? 34 : insets.bottom + 16, borderTopColor: colors.border },
        ]}
      >
        <Pressable
          onPress={handleArmToggle}
          disabled={isCountdown || isActive}
          style={({ pressed }) => [
            styles.armButton,
            {
              backgroundColor:
                isArmed ? `${colors.destructive}22` : colors.primary,
              borderColor: isArmed ? colors.destructive : colors.primary,
              opacity: pressed || isCountdown || isActive ? 0.7 : 1,
            },
          ]}
        >
          <Ionicons
            name={isArmed ? 'shield-outline' : 'shield-checkmark'}
            size={22}
            color={isArmed ? colors.destructive : '#ffffff'}
          />
          <Text
            style={[
              styles.armButtonText,
              { color: isArmed ? colors.destructive : '#ffffff' },
            ]}
          >
            {isArmed ? 'Disarm Sensor' : 'Arm Sensor'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function makeStyles(colors: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    container: { flex: 1 },
    overlay: {
      ...StyleSheet.absoluteFillObject,
      zIndex: 10,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 16,
    },
    countdownCircle: {
      width: 160,
      height: 160,
      borderRadius: 80,
      borderWidth: 3,
      alignItems: 'center',
      justifyContent: 'center',
    },
    countdownNumber: {
      fontSize: 56,
      fontWeight: '900',
      lineHeight: 60,
    },
    countdownLabel: {
      fontSize: 12,
      fontWeight: '700',
      letterSpacing: 1,
    },
    triggerInfo: {
      fontSize: 18,
      fontWeight: '700',
      letterSpacing: 2,
    },
    emergencyActions: {
      flexDirection: 'row',
      gap: 12,
      marginTop: 8,
    },
    cancelBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 24,
      paddingVertical: 14,
      borderRadius: 12,
    },
    cancelBtnText: {
      fontSize: 16,
      fontWeight: '600',
    },
    resolveBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 24,
      paddingVertical: 14,
      borderRadius: 12,
    },
    resolveBtnText: {
      fontSize: 16,
      fontWeight: '600',
    },
    content: {
      flex: 1,
      paddingHorizontal: 20,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 20,
    },
    headerTitle: {
      fontSize: 26,
      fontWeight: '800',
      letterSpacing: -0.5,
    },
    statusPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 20,
    },
    statusDot: { width: 7, height: 7, borderRadius: 4 },
    statusText: { fontSize: 11, fontWeight: '700', letterSpacing: 1 },
    gaugeCard: {
      borderRadius: 16,
      borderWidth: 1,
      padding: 20,
      alignItems: 'center',
      marginBottom: 14,
    },
    gaugeLabel: {
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 1.5,
      marginBottom: 4,
    },
    gaugeValue: {
      fontSize: 56,
      fontWeight: '900',
      lineHeight: 60,
    },
    gaugeUnit: {
      fontSize: 12,
      marginBottom: 16,
    },
    waveform: {
      flexDirection: 'row',
      height: 52,
      alignItems: 'flex-end',
      gap: 2,
      width: '100%',
      marginBottom: 14,
    },
    barWrapper: {
      flex: 1,
      height: 52,
      justifyContent: 'flex-end',
    },
    bar: {
      borderRadius: 2,
    },
    thresholds: {
      flexDirection: 'row',
      gap: 12,
      flexWrap: 'wrap',
      justifyContent: 'center',
    },
    thresholdRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
    },
    thresholdDot: { width: 6, height: 6, borderRadius: 3 },
    thresholdText: { fontSize: 11 },
    xyzRow: {
      flexDirection: 'row',
      gap: 10,
      marginBottom: 14,
    },
    axisCard: {
      flex: 1,
      borderRadius: 12,
      borderWidth: 1,
      padding: 12,
      alignItems: 'center',
      gap: 4,
    },
    axisLabel: {
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 1,
    },
    axisValue: {
      fontSize: 16,
      fontWeight: '600',
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
    locationCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      padding: 12,
      borderRadius: 10,
      borderWidth: 1,
    },
    locationText: {
      flex: 1,
      fontSize: 12,
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
    webNotice: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      padding: 12,
      borderRadius: 10,
      borderWidth: 1,
      marginTop: 12,
    },
    webNoticeText: {
      flex: 1,
      fontSize: 12,
    },
    armContainer: {
      padding: 16,
      paddingTop: 12,
      borderTopWidth: 1,
    },
    armButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      paddingVertical: 16,
      borderRadius: 14,
      borderWidth: 1.5,
    },
    armButtonText: {
      fontSize: 16,
      fontWeight: '700',
    },
  });
}

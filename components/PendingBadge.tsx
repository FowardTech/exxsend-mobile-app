import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import AppText from './AppText';

interface PendingBadgeProps {
  /** Whether to show the badge */
  visible: boolean;
  /** Optional label (defaults to "Pending") */
  label?: string;
  /** Size variant */
  size?: 'small' | 'medium';
  /** Style variant */
  variant?: 'dot' | 'pill';
}

export function PendingBadge({ 
  visible, 
  label = 'Pending', 
  size = 'small',
  variant = 'pill'
}: PendingBadgeProps) {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  
  useEffect(() => {
    if (visible) {
      // Pulsing animation
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 0.6,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      
      return () => pulse.stop();
    }
  }, [visible, pulseAnim]);
  
  if (!visible) return null;
  
  if (variant === 'dot') {
    return (
      <Animated.View 
        style={[
          styles.dot,
          size === 'medium' && styles.dotMedium,
          { opacity: pulseAnim }
        ]}
      />
    );
  }
  
  return (
    <Animated.View 
      style={[
        styles.pill,
        size === 'medium' && styles.pillMedium,
        { opacity: pulseAnim }
      ]}
    >
      <View style={styles.dotInner} />
      <AppText style={[styles.label, size === 'medium' && styles.labelMedium]}>
        {label}
      </AppText>
    </Animated.View>
  );
}

/**
 * Inline pending indicator for balance text
 */
export function PendingBalanceIndicator({ 
  visible, 
  pendingAmount,
  type 
}: { 
  visible: boolean; 
  pendingAmount?: number;
  type: 'debit' | 'credit';
}) {
  if (!visible) return null;
  
  const sign = type === 'debit' ? '-' : '+';
  const color = type === 'debit' ? '#EF4444' : '#16A34A';
  
  return (
    <View style={styles.inlineContainer}>
      <AppText style={[styles.inlineText, { color }]}>
        {pendingAmount ? `(${sign}${pendingAmount.toFixed(2)} pending)` : '(settling...)'}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#F59E0B',
  },
  dotMedium: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    gap: 4,
  },
  pillMedium: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  dotInner: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#F59E0B',
  },
  label: {
    fontSize: 10,
    fontWeight: '600',
    color: '#B45309',
  },
  labelMedium: {
    fontSize: 11,
  },
  inlineContainer: {
    marginLeft: 4,
  },
  inlineText: {
    fontSize: 11,
    fontWeight: '500',
    fontStyle: 'italic',
  },
});

export default PendingBadge;
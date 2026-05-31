import { useEffect, useRef } from 'react';
import { Animated, Text, StyleSheet } from 'react-native';

type Props = { message: string; onHide: () => void };

export function Toast({ message, onHide }: Props) {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
      Animated.delay(1640),
      Animated.timing(opacity, { toValue: 0, duration: 180, useNativeDriver: true }),
    ]).start(() => onHide());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Animated.View style={[styles.toast, { opacity }]} pointerEvents="none">
      <Text style={styles.text}>{message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    bottom: 32,
    left: 16,
    right: 16,
    backgroundColor: '#1A1A1A',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
  },
  text: { color: '#FFFFFF', fontSize: 14, fontFamily: 'Inter_400Regular' },
});

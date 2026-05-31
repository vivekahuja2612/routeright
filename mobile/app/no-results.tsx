import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

export default function NoResultsScreen() {
  const { destination, expected_arrival, suggested_leave_by, reason } = useLocalSearchParams<{
    destination: string;
    expected_arrival: string;
    suggested_leave_by: string;
    reason: string;
  }>();
  const router = useRouter();

  return (
    <View style={styles.container}>
      <Text style={styles.headline}>
        You can't make it by {expected_arrival}
      </Text>
      <Text style={styles.body}>
        To reach {destination} by {expected_arrival}, leave by{' '}
        <Text style={styles.leaveBy}>{suggested_leave_by}</Text> instead.
      </Text>
      {!!reason && (
        <Text style={styles.reason}>{reason.replace(/_/g, ' ')}</Text>
      )}
      <TouchableOpacity style={styles.button} onPress={() => router.back()}>
        <Text style={styles.buttonText}>Adjust your time</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F7F5', padding: 16, paddingTop: 80 },
  headline: { fontFamily: 'Inter_700Bold', fontSize: 22, color: '#1A1A1A', marginBottom: 16 },
  body: { fontFamily: 'Inter_400Regular', fontSize: 16, color: '#1A1A1A', lineHeight: 24, marginBottom: 8 },
  leaveBy: { fontFamily: 'Inter_700Bold', color: '#1B4FFF' },
  reason: { fontFamily: 'Inter_400Regular', fontSize: 13, color: '#6B6B6B', marginBottom: 32 },
  button: {
    backgroundColor: '#1B4FFF',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 24,
  },
  buttonText: { fontFamily: 'Inter_600SemiBold', color: '#FFFFFF', fontSize: 15 },
});

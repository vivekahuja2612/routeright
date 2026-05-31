import { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { getResult, getParams } from '../../store';
import { Toast } from '../../components/Toast';
import { BACKEND_URL } from '../../constants';
import { loadDeviceId } from '../../deviceId';

const MODE_ICON: Record<string, string> = {
  walk: '🚶',
  local_train: '🚂',
  bus: '🚌',
  metro: '🚇',
  auto: '🛺',
  cab: '🚕',
  mini_cab: '🚕',
};

const BADGE = ['Best', '2nd', '3rd'];

function modeIcon(mode: string): string {
  return MODE_ICON[mode] ?? '•';
}

export default function ResultsScreen() {
  const router = useRouter();
  const result = getResult();
  const params = getParams();
  const [toast, setToast] = useState<string | null>(null);

  async function handleSave(routeIndex: number) {
    if (!params) return;
    try {
      const deviceId = await loadDeviceId();
      const res = await fetch(`${BACKEND_URL}/api/saved-routes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          device_id: deviceId,
          source: params.source,
          destination: params.destination,
          leaving_time: params.leaving_time,
          arrival_time: params.expected_arrival,
        }),
      });
      setToast(res.ok ? 'Route saved.' : 'Failed to save.');
    } catch {
      setToast('Failed to save.');
    }
  }

  if (!result || !params) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>No results. Please search again.</Text>
        <TouchableOpacity style={styles.button} onPress={() => router.replace('/')}>
          <Text style={styles.buttonText}>Start over</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.header}>
          {params.source} → {params.destination}
        </Text>
        <Text style={styles.subheader}>
          Leaving {params.leaving_time} · By {params.expected_arrival}
        </Text>

        {result.disclosures?.map((d, i) => (
          <Text key={i} style={styles.disclosure}>{d}</Text>
        ))}

        {result.routes.map((route, i) => (
          <TouchableOpacity
            key={i}
            style={styles.card}
            onPress={() => router.push({ pathname: '/results/[id]', params: { id: String(i) } })}
            activeOpacity={0.8}
          >
            <View style={styles.cardTop}>
              <Text style={[styles.badge, i === 0 && styles.badgeBest]}>{BADGE[i]}</Text>
              <TouchableOpacity
                onPress={(e) => { e.stopPropagation(); handleSave(i); }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.bookmark}>🔖</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.routeHeadline}>
              {route.total_time_minutes} min · ₹{route.total_cost_inr}
            </Text>

            <Text style={styles.routeSummary}>
              {route.legs.map((l) => `${modeIcon(l.mode)} ${l.duration_minutes}m`).join(' → ')}
            </Text>

            <View style={styles.congestionRow}>
              <Text style={styles.congestionItem}>
                <Text style={styles.green}>● </Text>
                <Text style={styles.congestionText}>{route.least_congested_window}</Text>
              </Text>
              <Text style={styles.congestionItem}>
                <Text style={styles.red}>● </Text>
                <Text style={styles.congestionText}>{route.most_congested_window}</Text>
              </Text>
            </View>
          </TouchableOpacity>
        ))}

        <TouchableOpacity style={styles.searchAgain} onPress={() => router.replace('/')}>
          <Text style={styles.searchAgainText}>Search again</Text>
        </TouchableOpacity>
      </ScrollView>

      {toast !== null && (
        <Toast message={toast} onHide={() => setToast(null)} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingTop: 60, backgroundColor: '#F7F7F5', minHeight: '100%' },
  center: {
    flex: 1,
    backgroundColor: '#F7F7F5',
    padding: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: { fontFamily: 'Inter_700Bold', fontSize: 18, color: '#1A1A1A', marginBottom: 4 },
  subheader: { fontFamily: 'Inter_400Regular', fontSize: 13, color: '#6B6B6B', marginBottom: 20 },
  disclosure: { fontFamily: 'Inter_400Regular', fontSize: 13, color: '#D97706', marginBottom: 8 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E4E4E4',
    padding: 16,
    marginBottom: 12,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  badge: { fontFamily: 'Inter_700Bold', fontSize: 12, color: '#6B6B6B' },
  badgeBest: { color: '#1B4FFF' },
  bookmark: { fontSize: 16 },
  routeHeadline: { fontFamily: 'Inter_700Bold', fontSize: 20, color: '#1A1A1A', marginBottom: 6 },
  routeSummary: { fontFamily: 'Inter_400Regular', fontSize: 14, color: '#6B6B6B', marginBottom: 10 },
  congestionRow: { gap: 4 },
  congestionItem: { fontFamily: 'Inter_400Regular', fontSize: 13, color: '#1A1A1A' },
  congestionText: { fontFamily: 'Inter_400Regular', fontSize: 13, color: '#1A1A1A' },
  green: { color: '#16A34A' },
  red: { color: '#DC2626' },
  searchAgain: { alignItems: 'center', marginTop: 12, marginBottom: 24 },
  searchAgainText: { fontFamily: 'Inter_400Regular', color: '#6B6B6B', fontSize: 14 },
  errorText: { fontFamily: 'Inter_400Regular', fontSize: 15, color: '#DC2626', textAlign: 'center', marginBottom: 24 },
  button: {
    backgroundColor: '#1B4FFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  buttonText: { fontFamily: 'Inter_600SemiBold', color: '#FFFFFF', fontSize: 15 },
});

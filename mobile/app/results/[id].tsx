import { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { getResult, getParams } from '../../store';
import { Toast } from '../../components/Toast';

const MODE_ICON: Record<string, string> = {
  walk: '🚶',
  local_train: '🚂',
  bus: '🚌',
  metro: '🚇',
  auto: '🛺',
  cab: '🚕',
  mini_cab: '🚕',
};

function modeIcon(mode: string): string {
  return MODE_ICON[mode] ?? '•';
}

const BADGE = ['Best', '2nd', '3rd'];

export default function RouteDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const result = getResult();
  const params = getParams();
  const [toastVisible, setToastVisible] = useState(false);

  const routeIndex = parseInt(id ?? '0', 10);
  const route = result?.routes[routeIndex];

  if (!route || !params) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Route not found.</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.container}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backRow}>
          <Text style={styles.backText}>← Results</Text>
        </TouchableOpacity>

        <Text style={styles.header}>
          {params.source} → {params.destination}
        </Text>
        <Text style={styles.subheader}>
          {BADGE[routeIndex]} route · Leaving {params.leaving_time}
        </Text>

        {route.legs.map((leg, i) => (
          <View key={i} style={[styles.leg, i < route.legs.length - 1 && styles.legBorder]}>
            <View style={styles.legHeader}>
              <Text style={styles.legIcon}>{modeIcon(leg.mode)}</Text>
              <Text style={styles.legMode}>{leg.mode.replace(/_/g, ' ')}</Text>
              <Text style={styles.legDuration}>{leg.duration_minutes} min</Text>
            </View>
            <Text style={styles.legInstruction}>{leg.instruction}</Text>
            {leg.cost_inr > 0 && (
              <Text style={styles.legCost}>₹{leg.cost_inr}</Text>
            )}
          </View>
        ))}

        <View style={styles.congestionBlock}>
          <Text style={styles.congestionItem}>
            <Text style={styles.green}>● </Text>
            <Text style={styles.congestionLabel}>Least congested: </Text>
            <Text style={styles.congestionValue}>{route.least_congested_window}</Text>
          </Text>
          <Text style={styles.congestionItem}>
            <Text style={styles.red}>● </Text>
            <Text style={styles.congestionLabel}>Most congested: </Text>
            <Text style={styles.congestionValue}>{route.most_congested_window}</Text>
          </Text>
        </View>

        {/* space so total bar doesn't overlap last content */}
        <View style={{ height: 96 }} />
      </ScrollView>

      <View style={styles.totalBar}>
        <View>
          <Text style={styles.totalTime}>{route.total_time_minutes} min</Text>
          <Text style={styles.totalCost}>₹{route.total_cost_inr} total</Text>
        </View>
        <TouchableOpacity
          style={styles.saveButton}
          onPress={() => setToastVisible(true)}
        >
          <Text style={styles.saveButtonText}>Save route</Text>
        </TouchableOpacity>
      </View>

      {toastVisible && (
        <Toast message="Route saved." onHide={() => setToastVisible(false)} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingTop: 56, backgroundColor: '#F7F7F5' },
  center: {
    flex: 1,
    backgroundColor: '#F7F7F5',
    padding: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backRow: { marginBottom: 20 },
  backText: { fontFamily: 'Inter_400Regular', color: '#1B4FFF', fontSize: 14 },
  header: { fontFamily: 'Inter_700Bold', fontSize: 18, color: '#1A1A1A', marginBottom: 4 },
  subheader: { fontFamily: 'Inter_400Regular', fontSize: 13, color: '#6B6B6B', marginBottom: 24 },
  leg: { paddingVertical: 16 },
  legBorder: { borderBottomWidth: 1, borderBottomColor: '#E4E4E4' },
  legHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  legIcon: { fontSize: 18, marginRight: 8 },
  legMode: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: '#6B6B6B',
    textTransform: 'capitalize',
    flex: 1,
  },
  legDuration: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: '#1A1A1A' },
  legInstruction: { fontFamily: 'Inter_400Regular', fontSize: 14, color: '#1A1A1A', lineHeight: 20 },
  legCost: { fontFamily: 'Inter_400Regular', fontSize: 13, color: '#6B6B6B', marginTop: 4 },
  congestionBlock: { marginTop: 24, gap: 6 },
  congestionItem: { fontFamily: 'Inter_400Regular', fontSize: 13, color: '#1A1A1A' },
  congestionLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  congestionValue: { fontFamily: 'Inter_400Regular', fontSize: 13 },
  green: { color: '#16A34A' },
  red: { color: '#DC2626' },
  totalBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E4E4E4',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 32,
  },
  totalTime: { fontFamily: 'Inter_700Bold', fontSize: 20, color: '#1A1A1A' },
  totalCost: { fontFamily: 'Inter_400Regular', fontSize: 14, color: '#6B6B6B', marginTop: 2 },
  saveButton: {
    backgroundColor: '#1B4FFF',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  saveButtonText: { fontFamily: 'Inter_600SemiBold', color: '#FFFFFF', fontSize: 14 },
  errorText: { fontFamily: 'Inter_400Regular', fontSize: 15, color: '#DC2626', textAlign: 'center', marginBottom: 16 },
});

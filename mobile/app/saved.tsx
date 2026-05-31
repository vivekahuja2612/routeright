import { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { BACKEND_URL } from '../constants';
import { loadDeviceId } from '../deviceId';

type SavedRoute = {
  id: string;
  source: string;
  destination: string;
  leaving_time: string;
  arrival_time: string;
  created_at: string;
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function SavedRoutesScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [deviceId, setDeviceId] = useState<string | null>(null);

  useEffect(() => {
    loadDeviceId().then(setDeviceId);
  }, []);

  const { data: routes, isLoading, isError, refetch } = useQuery<SavedRoute[]>({
    queryKey: ['saved-routes', deviceId],
    queryFn: async () => {
      const res = await fetch(`${BACKEND_URL}/api/saved-routes?device_id=${deviceId}`);
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
    enabled: !!deviceId,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(
        `${BACKEND_URL}/api/saved-routes/${id}?device_id=${deviceId}`,
        { method: 'DELETE' },
      );
      if (!res.ok && res.status !== 204) throw new Error('Delete failed');
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['saved-routes', deviceId] });
      const prev = queryClient.getQueryData<SavedRoute[]>(['saved-routes', deviceId]);
      queryClient.setQueryData<SavedRoute[]>(
        ['saved-routes', deviceId],
        (old) => (old ?? []).filter((r) => r.id !== id),
      );
      return { prev };
    },
    onError: (_err, _id, ctx) => {
      queryClient.setQueryData(['saved-routes', deviceId], ctx?.prev);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['saved-routes', deviceId] });
    },
  });

  function confirmDelete(id: string, label: string) {
    Alert.alert('Delete saved route', `Remove "${label}"?`, [
      { text: 'Delete', style: 'destructive', onPress: () => deleteMutation.mutate(id) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  function searchNow(route: SavedRoute) {
    router.push({
      pathname: '/searching',
      params: {
        source: route.source,
        destination: route.destination,
        leaving_time: route.leaving_time,
        expected_arrival: route.arrival_time,
      },
    });
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={() => router.back()} style={styles.backRow}>
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Saved Routes</Text>

      {(!deviceId || isLoading) && (
        <ActivityIndicator color="#1B4FFF" style={styles.spinner} />
      )}

      {isError && (
        <View style={styles.errorBlock}>
          <Text style={styles.errorText}>Couldn't load saved routes.</Text>
          <TouchableOpacity onPress={() => refetch()}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {routes && routes.length === 0 && (
        <Text style={styles.empty}>
          No saved routes yet.{'\n'}Search a route and tap the bookmark to save it.
        </Text>
      )}

      {routes && routes.length > 0 && (
        <ScrollView showsVerticalScrollIndicator={false}>
          {routes.map((route) => (
            <View key={route.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.routeLabel} numberOfLines={1}>
                  {route.source} → {route.destination}
                </Text>
                <TouchableOpacity
                  onPress={() => confirmDelete(route.id, `${route.source} → ${route.destination}`)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={styles.deleteIcon}>🗑</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.routeTimes}>
                {route.leaving_time} → {route.arrival_time}
              </Text>
              <Text style={styles.savedDate}>Saved {formatDate(route.created_at)}</Text>

              <TouchableOpacity style={styles.searchNowButton} onPress={() => searchNow(route)}>
                <Text style={styles.searchNowText}>Search now</Text>
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, paddingTop: 56, backgroundColor: '#F7F7F5' },
  backRow: { marginBottom: 24 },
  backText: { fontFamily: 'Inter_400Regular', color: '#1B4FFF', fontSize: 14 },
  title: { fontFamily: 'Inter_700Bold', fontSize: 20, color: '#1A1A1A', marginBottom: 24 },
  spinner: { marginTop: 40 },
  errorBlock: { marginTop: 40, alignItems: 'center' },
  errorText: { fontFamily: 'Inter_400Regular', fontSize: 15, color: '#DC2626', marginBottom: 12 },
  retryText: { fontFamily: 'Inter_600SemiBold', color: '#1B4FFF', fontSize: 14 },
  empty: {
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
    color: '#6B6B6B',
    lineHeight: 22,
    textAlign: 'center',
    marginTop: 80,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E4E4E4',
    padding: 16,
    marginBottom: 12,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 },
  routeLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: '#1A1A1A', flex: 1, marginRight: 8 },
  deleteIcon: { fontSize: 16 },
  routeTimes: { fontFamily: 'Inter_400Regular', fontSize: 13, color: '#6B6B6B', marginBottom: 4 },
  savedDate: { fontFamily: 'Inter_400Regular', fontSize: 12, color: '#6B6B6B', marginBottom: 14 },
  searchNowButton: {
    backgroundColor: '#1B4FFF',
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  searchNowText: { fontFamily: 'Inter_600SemiBold', color: '#FFFFFF', fontSize: 14 },
});

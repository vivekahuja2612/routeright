import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Animated,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { storeSearch } from '../store';
import type { SearchResult, SearchParams } from '../types';

const BACKEND_URL =
  Platform.OS === 'android' ? 'http://10.0.2.2:3001' : 'http://localhost:3001';

const STATUS_MESSAGES = [
  'Checking local trains...',
  'Checking BEST buses...',
  'Checking Metro lines...',
  'Checking cabs...',
  'Ranking your best options...',
];

export default function SearchingScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    source: string;
    destination: string;
    leaving_time: string;
    expected_arrival: string;
  }>();

  const [statusIndex, setStatusIndex] = useState(0);
  const [slowWarning, setSlowWarning] = useState(false);
  const [error, setError] = useState<{ message: string; isNetwork: boolean } | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const pulse = useRef(new Animated.Value(0.4)).current;
  const done = useRef(false);

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [pulse]);

  useEffect(() => {
    const iv = setInterval(() => {
      setStatusIndex((i) => Math.min(i + 1, STATUS_MESSAGES.length - 1));
    }, 1500);
    return () => clearInterval(iv);
  }, [retryCount]);

  useEffect(() => {
    const t10 = setTimeout(() => setSlowWarning(true), 10000);
    const t15 = setTimeout(() => {
      if (!done.current) {
        done.current = true;
        setError({ message: "We couldn't get live data right now. Try again in a moment.", isNetwork: false });
      }
    }, 15000);
    return () => {
      clearTimeout(t10);
      clearTimeout(t15);
    };
  }, [retryCount]);

  useEffect(() => {
    if (!params.source || !params.destination || !params.leaving_time || !params.expected_arrival) {
      setError({ message: 'Missing search parameters. Please go back and try again.', isNetwork: false });
      return;
    }

    done.current = false;
    setError(null);
    setSlowWarning(false);
    setStatusIndex(0);

    const searchParams: SearchParams = {
      source: params.source,
      destination: params.destination,
      leaving_time: params.leaving_time,
      expected_arrival: params.expected_arrival,
    };

    fetch(`${BACKEND_URL}/api/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(searchParams),
    })
      .then((r) => r.json())
      .then((result: SearchResult) => {
        if (done.current) return;
        done.current = true;

        if (result.suggested_leave_by) {
          router.replace({
            pathname: '/no-results',
            params: {
              destination: searchParams.destination,
              expected_arrival: searchParams.expected_arrival,
              suggested_leave_by: result.suggested_leave_by,
              reason: result.reason ?? '',
            },
          });
          return;
        }

        storeSearch(searchParams, result);
        router.replace('/results');
      })
      .catch(() => {
        if (!done.current) {
          done.current = true;
          setError({
            message: 'No connection. RouteRight needs internet to find live routes.',
            isNetwork: true,
          });
        }
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [retryCount]);

  function handleRetry() {
    setRetryCount((c) => c + 1);
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error.message}</Text>
        {error.isNetwork ? (
          <TouchableOpacity style={styles.button} onPress={handleRetry}>
            <Text style={styles.buttonText}>Retry</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.button} onPress={() => router.replace('/')}>
            <Text style={styles.buttonText}>Start over</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.summary}>
        {params.source} → {params.destination} · Leaving {params.leaving_time}
      </Text>

      <Animated.View style={[styles.pulsebar, { opacity: pulse }]} />

      <Text style={styles.status}>{STATUS_MESSAGES[statusIndex]}</Text>

      {slowWarning && (
        <Text style={styles.slowWarning}>Taking longer than usual... still searching.</Text>
      )}

      <TouchableOpacity style={styles.cancelLink} onPress={() => router.replace('/')}>
        <Text style={styles.cancelText}>Start over</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F7F5',
    padding: 16,
    paddingTop: 80,
    alignItems: 'center',
  },
  center: {
    flex: 1,
    backgroundColor: '#F7F7F5',
    padding: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  summary: { fontFamily: 'Inter_400Regular', fontSize: 14, color: '#6B6B6B', marginBottom: 48, textAlign: 'center' },
  pulsebar: {
    width: '80%',
    height: 4,
    backgroundColor: '#1B4FFF',
    borderRadius: 2,
    marginBottom: 32,
  },
  status: { fontFamily: 'Inter_400Regular', fontSize: 15, color: '#1A1A1A', textAlign: 'center' },
  slowWarning: { fontFamily: 'Inter_400Regular', fontSize: 13, color: '#6B6B6B', marginTop: 16, textAlign: 'center' },
  cancelLink: { position: 'absolute', bottom: 48 },
  cancelText: { fontFamily: 'Inter_400Regular', color: '#6B6B6B', fontSize: 14 },
  errorText: { fontFamily: 'Inter_400Regular', fontSize: 15, color: '#DC2626', textAlign: 'center', marginBottom: 24 },
  button: {
    backgroundColor: '#1B4FFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  buttonText: { fontFamily: 'Inter_600SemiBold', color: '#FFFFFF', fontSize: 15 },
});

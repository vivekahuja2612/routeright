import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { autocomplete, reverseGeocode, shortName, type Place } from '../geocode';

function parseTimeMins(t: string): number | null {
  const m = t.trim().match(/^(\d{1,2}):(\d{2})(am|pm)$/i);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  const ap = m[3].toLowerCase();
  if (ap === 'pm' && h !== 12) h += 12;
  if (ap === 'am' && h === 12) h = 0;
  return h * 60 + min;
}

function formatMins(total: number): string {
  const h24 = Math.floor(total / 60) % 24;
  const min = total % 60;
  const ap = h24 >= 12 ? 'pm' : 'am';
  const h12 = h24 % 12 || 12;
  return `${h12}:${String(min).padStart(2, '0')}${ap}`;
}

export default function SearchScreen() {
  const router = useRouter();
  const [source, setSource] = useState('');
  const [gpsLoading, setGpsLoading] = useState(true);
  const [locationError, setLocationError] = useState<string | null>(null);

  const [destText, setDestText] = useState('');
  const [destSuggestions, setDestSuggestions] = useState<Place[]>([]);
  const [destSelected, setDestSelected] = useState<Place | null>(null);
  const [destLoading, setDestLoading] = useState(false);
  const destDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [leavingTime, setLeavingTime] = useState('');
  const [expectedArrival, setExpectedArrival] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setLocationError('Enable location access or enter your starting point manually.');
          setGpsLoading(false);
          return;
        }
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        const label = await reverseGeocode(pos.coords.latitude, pos.coords.longitude);
        setSource(label);
      } catch {
        setLocationError('Enable location access or enter your starting point manually.');
      } finally {
        setGpsLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (destSelected) return;
    if (destDebounce.current) clearTimeout(destDebounce.current);
    if (destText.trim().length < 2) {
      setDestSuggestions([]);
      return;
    }
    destDebounce.current = setTimeout(async () => {
      setDestLoading(true);
      const results = await autocomplete(destText);
      setDestSuggestions(results);
      setDestLoading(false);
    }, 400);
  }, [destText, destSelected]);

  function selectDest(place: Place) {
    setDestText(shortName(place.display_name));
    setDestSelected(place);
    setDestSuggestions([]);
  }

  function handleDestChange(text: string) {
    setDestText(text);
    setDestSelected(null);
  }

  function handleSearch() {
    const src = source.trim();
    const dst = destText.trim();
    const lt = leavingTime.trim();
    const ea = expectedArrival.trim();

    if (!src) {
      Alert.alert('Missing source', 'Enter your starting point.');
      return;
    }
    if (!dst || !destSelected) {
      Alert.alert('Missing destination', 'Select a destination from the suggestions.');
      return;
    }
    if (src.toLowerCase() === dst.toLowerCase()) {
      Alert.alert("You're already there", 'Source and destination are the same.');
      return;
    }
    if (!parseTimeMins(lt)) {
      Alert.alert('Invalid time', 'Enter leaving time as e.g. 8:15am');
      return;
    }
    if (!parseTimeMins(ea)) {
      Alert.alert('Invalid time', 'Enter arrival time as e.g. 9:00am');
      return;
    }

    const now = new Date();
    const nowTotal = now.getHours() * 60 + now.getMinutes();
    const leavingMins = parseTimeMins(lt)!;
    if (leavingMins < nowTotal) {
      const nowStr = formatMins(nowTotal);
      Alert.alert(
        'Leaving time has passed',
        `Did you mean today at ${nowStr}, or tomorrow at ${lt}?`,
        [
          {
            text: `Today at ${nowStr}`,
            onPress: () => {
              setLeavingTime(nowStr);
              fireSearch(src, dst, nowStr, ea);
            },
          },
          { text: `Tomorrow at ${lt}`, onPress: () => fireSearch(src, dst, lt, ea) },
          { text: 'Cancel', style: 'cancel' },
        ],
      );
      return;
    }

    fireSearch(src, dst, lt, ea);
  }

  function fireSearch(src: string, dst: string, lt: string, ea: string) {
    router.push({
      pathname: '/searching',
      params: { source: src, destination: dst, leaving_time: lt, expected_arrival: ea },
    });
  }

  const canSearch =
    source.trim().length > 0 &&
    destSelected !== null &&
    leavingTime.trim().length > 0 &&
    expectedArrival.trim().length > 0;

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>RouteRight</Text>

      <Text style={styles.label}>FROM</Text>
      {gpsLoading ? (
        <View style={[styles.input, styles.inputRow]}>
          <ActivityIndicator size="small" color="#6B6B6B" />
          <Text style={styles.gpsHint}>  Detecting location...</Text>
        </View>
      ) : (
        <>
          <TextInput
            style={[styles.input, styles.inputText]}
            value={source}
            onChangeText={setSource}
            placeholder="Enter starting point"
            placeholderTextColor="#6B6B6B"
          />
          {locationError && <Text style={styles.hint}>{locationError}</Text>}
        </>
      )}

      <Text style={styles.label}>TO</Text>
      <TextInput
        style={[styles.input, styles.inputText]}
        value={destText}
        onChangeText={handleDestChange}
        placeholder="Enter destination in Mumbai"
        placeholderTextColor="#6B6B6B"
      />
      {destLoading && <ActivityIndicator size="small" color="#6B6B6B" style={styles.destSpinner} />}
      {destSuggestions.length > 0 && (
        <View style={styles.suggestions}>
          {destSuggestions.map((p, i) => (
            <TouchableOpacity
              key={i}
              style={[styles.suggestion, i < destSuggestions.length - 1 && styles.suggestionBorder]}
              onPress={() => selectDest(p)}
            >
              <Text style={styles.suggestionText}>{shortName(p.display_name)}</Text>
              <Text style={styles.suggestionSub} numberOfLines={1}>{p.display_name}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
      {destText.length >= 2 && !destLoading && destSuggestions.length === 0 && !destSelected && (
        <Text style={styles.hint}>No locations found in Mumbai</Text>
      )}

      <Text style={styles.label}>LEAVING AT</Text>
      <TextInput
        style={[styles.input, styles.inputText]}
        value={leavingTime}
        onChangeText={setLeavingTime}
        placeholder="e.g. 8:15am"
        placeholderTextColor="#6B6B6B"
        autoCapitalize="none"
      />

      <Text style={styles.label}>MUST ARRIVE BY</Text>
      <TextInput
        style={[styles.input, styles.inputText]}
        value={expectedArrival}
        onChangeText={setExpectedArrival}
        placeholder="e.g. 9:00am"
        placeholderTextColor="#6B6B6B"
        autoCapitalize="none"
      />

      <TouchableOpacity
        style={[styles.button, !canSearch && styles.buttonDisabled]}
        onPress={handleSearch}
        disabled={!canSearch}
      >
        <Text style={styles.buttonText}>Find Routes</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.savedLink} onPress={() => router.push('/saved')}>
        <Text style={styles.savedLinkText}>Your saved routes →</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingTop: 60, backgroundColor: '#F7F7F5', minHeight: '100%' },
  title: { fontSize: 20, fontFamily: 'Inter_700Bold', color: '#1A1A1A', marginBottom: 32 },
  label: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    color: '#6B6B6B',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E4E4E4',
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  inputText: { fontSize: 15, fontFamily: 'Inter_400Regular', color: '#1A1A1A' },
  inputRow: { flexDirection: 'row', alignItems: 'center' },
  gpsHint: { fontFamily: 'Inter_400Regular', color: '#6B6B6B', fontSize: 14 },
  hint: { fontFamily: 'Inter_400Regular', fontSize: 13, color: '#6B6B6B', marginTop: -12, marginBottom: 16 },
  destSpinner: { marginTop: -12, marginBottom: 8 },
  suggestions: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E4E4E4',
    borderRadius: 8,
    marginTop: -12,
    marginBottom: 16,
    overflow: 'hidden',
  },
  suggestion: { paddingHorizontal: 12, paddingVertical: 10 },
  suggestionBorder: { borderBottomWidth: 1, borderBottomColor: '#E4E4E4' },
  suggestionText: { fontFamily: 'Inter_400Regular', fontSize: 15, color: '#1A1A1A' },
  suggestionSub: { fontFamily: 'Inter_400Regular', fontSize: 12, color: '#6B6B6B', marginTop: 2 },
  button: {
    backgroundColor: '#1B4FFF',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 4,
  },
  buttonDisabled: { backgroundColor: '#6B6B6B' },
  buttonText: { fontFamily: 'Inter_600SemiBold', color: '#FFFFFF', fontSize: 15 },
  savedLink: { alignItems: 'center', marginTop: 20 },
  savedLinkText: { fontFamily: 'Inter_400Regular', color: '#6B6B6B', fontSize: 14 },
});

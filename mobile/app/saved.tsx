import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';

export default function SavedRoutesScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={() => router.back()} style={styles.backRow}>
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Saved Routes</Text>
      <Text style={styles.empty}>
        No saved routes yet.{'\n'}Search a route and tap the bookmark to save it.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, paddingTop: 56, backgroundColor: '#F7F7F5' },
  backRow: { marginBottom: 24 },
  backText: { fontFamily: 'Inter_400Regular', color: '#1B4FFF', fontSize: 14 },
  title: { fontFamily: 'Inter_700Bold', fontSize: 20, color: '#1A1A1A', marginBottom: 32 },
  empty: {
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
    color: '#6B6B6B',
    lineHeight: 22,
    textAlign: 'center',
    marginTop: 80,
  },
});

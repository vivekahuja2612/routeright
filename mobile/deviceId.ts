import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'routeright_device_id';
let _id: string | null = null;

function generate(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export async function loadDeviceId(): Promise<string> {
  if (_id) return _id;
  let id = await AsyncStorage.getItem(KEY);
  if (!id) {
    id = generate();
    await AsyncStorage.setItem(KEY, id);
  }
  _id = id;
  return id;
}

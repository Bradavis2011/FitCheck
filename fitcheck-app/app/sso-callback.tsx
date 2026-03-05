import { View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';

// Called at module level — fires synchronously when the module loads,
// not after React renders. This is required to close the Custom Tab
// before AuthGate can redirect away.
WebBrowser.maybeCompleteAuthSession();

export default function SsoCallbackScreen() {
  return <View />;
}

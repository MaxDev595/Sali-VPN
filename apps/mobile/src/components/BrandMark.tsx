import { StyleSheet, View } from 'react-native';
import { LogoMark } from './LogoMark';

/** App-wide brand badge: the original logo on white, like an app icon. */
export function BrandMark({ size = 38 }: { size?: number }) {
  return <View style={[styles.frame, { width: size, height: size, borderRadius: size * .28 }]}><LogoMark size={size * .74} tone="dark" /></View>;
}
const styles = StyleSheet.create({ frame: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' } });

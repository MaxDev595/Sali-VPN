import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { theme } from '../theme';
export function SaliButton({ title, onPress, loading = false, secondary = false }: { title: string; onPress(): void; loading?: boolean; secondary?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={title} disabled={loading} onPress={onPress} style={({ pressed }) => [styles.root, secondary && styles.secondary, pressed && styles.pressed]}>{loading ? <ActivityIndicator color={secondary ? theme.colors.textPrimary : theme.colors.background} /> : <Text style={[styles.text, secondary && styles.secondaryText]}>{title}</Text>}</Pressable>;
}
const styles = StyleSheet.create({ root: { minHeight: 56, borderRadius: 18, backgroundColor: theme.colors.primary, alignItems: 'center', justifyContent: 'center' }, secondary: { backgroundColor: theme.colors.surfaceElevated, borderWidth: 1, borderColor: theme.colors.border }, pressed: { transform: [{ scale: .98 }], opacity: .86 }, text: { color: theme.colors.background, fontSize: 16, fontWeight: '700' }, secondaryText: { color: theme.colors.textPrimary } });

import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { theme } from '../theme';

export function SaliButton({ title, onPress, loading = false, secondary = false, disabled = false, icon }: { title: string; onPress(): void; loading?: boolean; secondary?: boolean; disabled?: boolean; icon?: string }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={title} disabled={loading || disabled} onPress={onPress} style={({ pressed }) => [styles.root, secondary && styles.secondary, disabled && styles.disabled, pressed && styles.pressed]}>
    {loading ? <ActivityIndicator color={secondary ? theme.colors.textPrimary : theme.colors.onPrimary} /> : <Text style={[styles.text, secondary && styles.secondaryText]}>{icon ? `${icon}  ` : ''}{title}</Text>}
  </Pressable>;
}
const styles = StyleSheet.create({
  root: { minHeight: 56, borderRadius: theme.radius.lg, backgroundColor: theme.colors.primary, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18, shadowColor: theme.colors.accent, shadowOpacity: .28, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 6 },
  secondary: { backgroundColor: theme.colors.surfaceElevated, borderWidth: 1, borderColor: theme.colors.border, shadowOpacity: 0, elevation: 0 },
  disabled: { opacity: .45 },
  pressed: { transform: [{ scale: .975 }], opacity: .9 },
  text: { color: theme.colors.onPrimary, fontSize: 16, fontFamily: 'Outfit-SemiBold' },
  secondaryText: { color: theme.colors.textPrimary },
});

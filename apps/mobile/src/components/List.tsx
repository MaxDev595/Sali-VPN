import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Switch, View } from 'react-native';
import { Text } from './Text';
import { theme } from '../theme';

/** Section title: small caps with the peach cap mark in front. */
export function SectionLabel({ children }: { children: string }) {
  return <View style={styles.sectionRow}><View style={styles.cap} /><Text style={styles.section}>{children}</Text></View>;
}

export function Group({ children }: { children: ReactNode }) {
  return <View style={styles.group}>{children}</View>;
}

type RowProps = {
  title: string;
  hint?: string;
  value?: string;
  /** "external" shows ↗: the row opens salivpn.com. */
  kind?: 'nav' | 'external' | 'none';
  toggle?: boolean;
  onToggle?(value: boolean): void;
  onPress?(): void;
  /** For toggle rows: a small "?" that opens the article about this setting. */
  onInfo?(): void;
  last?: boolean;
};

export function Row({ title, hint, value, kind = 'nav', toggle, onToggle, onPress, onInfo, last }: RowProps) {
  const body = <>
    <View style={styles.copy}>
      <View style={styles.titleLine}>
        <Text style={styles.title}>{title}</Text>
        {onInfo && <Pressable accessibilityRole="link" accessibilityLabel={`${title}: подробнее`} hitSlop={10} onPress={onInfo} style={({ pressed }) => [styles.info, pressed && { opacity: .6 }]}><Text style={styles.infoText}>?</Text></Pressable>}
      </View>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
    {onToggle ? <Switch value={Boolean(toggle)} onValueChange={onToggle} trackColor={{ false: theme.colors.muted, true: theme.colors.accent }} thumbColor={toggle ? theme.colors.onPrimary : '#C7CFDF'} />
      : <View style={styles.end}>{value ? <Text style={styles.value} numberOfLines={1}>{value}</Text> : null}{kind !== 'none' && <Text style={kind === 'external' ? styles.external : styles.chevron}>{kind === 'external' ? '↗' : '›'}</Text>}</View>}
  </>;
  const style = [styles.row, last && styles.rowLast];
  if (!onPress || onToggle) return <View style={style}>{body}</View>;
  return <Pressable accessibilityRole={kind === 'external' ? 'link' : 'button'} onPress={onPress} style={({ pressed }) => [style, pressed && styles.pressed]}>{body}</Pressable>;
}

const styles = StyleSheet.create({
  sectionRow: { flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 28, marginBottom: 10, marginLeft: 4 },
  cap: { width: 10, height: 4, borderRadius: 2, backgroundColor: theme.colors.accent, transform: [{ rotate: theme.cap.angle }] },
  section: { color: theme.colors.textSecondary, fontSize: 12, fontFamily: 'SaliSans-Bold', letterSpacing: 1.4 },
  group: { borderRadius: theme.radius.lg, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border, overflow: 'hidden' },
  row: { minHeight: 60, paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border },
  rowLast: { borderBottomWidth: 0 },
  pressed: { backgroundColor: theme.colors.surfaceElevated },
  copy: { flex: 1 },
  titleLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { color: theme.colors.textPrimary, fontSize: 16, fontFamily: 'SaliSans-Medium' },
  hint: { color: theme.colors.textSecondary, fontSize: 13, lineHeight: 18, marginTop: 3 },
  info: { width: 20, height: 20, borderRadius: 10, borderWidth: 1, borderColor: theme.colors.muted, alignItems: 'center', justifyContent: 'center' },
  infoText: { color: theme.colors.textSecondary, fontSize: 11, fontFamily: 'SaliSans-Bold', lineHeight: 13 },
  end: { flexDirection: 'row', alignItems: 'center', gap: 8, maxWidth: '55%' },
  value: { color: theme.colors.textSecondary, fontSize: 14 },
  chevron: { color: theme.colors.textSecondary, fontSize: 24, lineHeight: 26 },
  external: { color: theme.colors.accent, fontSize: 16, fontFamily: 'SaliSans-Bold' },
});

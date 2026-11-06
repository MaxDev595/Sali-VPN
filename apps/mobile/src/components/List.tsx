import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from './Text';
import { Icon, type IconName } from './Icon';
import { Toggle } from './Toggle';
import { theme } from '../theme';

/** Section title: small caps with a peach glyph in front. */
export function SectionLabel({ children, icon }: { children: string; icon?: IconName }) {
  return <View style={styles.sectionRow}>{icon && <Icon name={icon} size={15} color={theme.colors.accent} />}<Text style={styles.section}>{children}</Text></View>;
}

export function Group({ children }: { children: ReactNode }) {
  return <View style={styles.group}>{children}</View>;
}

type RowProps = {
  title: string;
  hint?: string;
  value?: string;
  /** "external" shows an arrow-out icon: the row opens salivpn.com. */
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
        {onInfo && <Pressable accessibilityRole="link" accessibilityLabel={`${title}: подробнее`} hitSlop={10} onPress={onInfo} style={({ pressed }) => pressed && { opacity: .6 }}><Icon name="info" size={17} color={theme.colors.textSecondary} /></Pressable>}
      </View>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
    {onToggle ? <Toggle value={Boolean(toggle)} onChange={onToggle} label={title} />
      : <View style={styles.end}>{value ? <Text style={styles.value} numberOfLines={1}>{value}</Text> : null}{kind !== 'none' && <Icon name={kind === 'external' ? 'external' : 'chevron'} size={kind === 'external' ? 16 : 18} color={kind === 'external' ? theme.colors.accent : theme.colors.textSecondary} />}</View>}
  </>;
  const style = [styles.row, last && styles.rowLast];
  if (!onPress || onToggle) return <View style={style}>{body}</View>;
  return <Pressable accessibilityRole={kind === 'external' ? 'link' : 'button'} onPress={onPress} style={({ pressed }) => [style, pressed && styles.pressed]}>{body}</Pressable>;
}

const styles = StyleSheet.create({
  sectionRow: { flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 28, marginBottom: 10, marginLeft: 4 },
  section: { color: theme.colors.textSecondary, fontSize: 12, fontFamily: 'SaliSans-Bold', letterSpacing: 1.4 },
  group: { borderRadius: theme.radius.lg, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border, overflow: 'hidden' },
  row: { minHeight: 60, paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border },
  rowLast: { borderBottomWidth: 0 },
  pressed: { backgroundColor: theme.colors.surfaceElevated },
  copy: { flex: 1 },
  titleLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { color: theme.colors.textPrimary, fontSize: 16, fontFamily: 'SaliSans-Medium' },
  hint: { color: theme.colors.textSecondary, fontSize: 13, lineHeight: 18, marginTop: 3 },
  end: { flexDirection: 'row', alignItems: 'center', gap: 8, maxWidth: '55%' },
  value: { color: theme.colors.textSecondary, fontSize: 14 },
});

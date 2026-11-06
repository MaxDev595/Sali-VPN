import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { Easing, FadeIn, FadeOut, LinearTransition, interpolateColor, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Text } from './Text';
import { Icon } from './Icon';
import { theme } from '../theme';

const EASE = Easing.bezier(.22, 1, .36, 1);
/** Every card in the list shares this transition, so neighbours glide down instead of overlapping. */
export const accordionLayout = LinearTransition.duration(380).easing(EASE);

/**
 * FAQ item. The answer is part of the normal layout (no measuring), the card and
 * every card below it animate to their new positions together. The "+" turns
 * 45° into a cross on a peach disc.
 */
export function AccordionItem({ question, answer, open, onToggle }: { question: string; answer: string; open: boolean; onToggle(): void }) {
  const p = useSharedValue(open ? 1 : 0);
  useEffect(() => { p.value = withTiming(open ? 1 : 0, { duration: 380, easing: EASE }); }, [open, p]);
  const plus = useAnimatedStyle(() => ({
    transform: [{ rotate: `${p.value * 45}deg` }],
    backgroundColor: interpolateColor(p.value, [0, 1], [theme.colors.surfaceElevated, theme.colors.accent]),
  }));
  const card = useAnimatedStyle(() => ({ borderColor: interpolateColor(p.value, [0, 1], [theme.colors.border, 'rgba(255,197,135,0.32)']) }));

  return <Animated.View layout={accordionLayout} style={[styles.card, card]}>
    <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={onToggle} style={styles.head}>
      <Text style={styles.question}>{question}</Text>
      <Animated.View style={[styles.plus, plus]}>
        <Icon name="plus" size={14} color={open ? theme.colors.onPrimary : theme.colors.textPrimary} />
      </Animated.View>
    </Pressable>
    {open && <Animated.View entering={FadeIn.duration(260).delay(90)} exiting={FadeOut.duration(140)} style={styles.body}>
      <View style={styles.rule} />
      <Text style={styles.answer}>{answer}</Text>
    </Animated.View>}
  </Animated.View>;
}

const styles = StyleSheet.create({
  card: { borderRadius: theme.radius.lg, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border, marginBottom: 10, overflow: 'hidden' },
  head: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 16 },
  question: { flex: 1, color: theme.colors.textPrimary, fontSize: 16, lineHeight: 22, fontFamily: 'SaliSans-SemiBold' },
  plus: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  body: { paddingHorizontal: 16, paddingBottom: 18 },
  rule: { height: StyleSheet.hairlineWidth, backgroundColor: theme.colors.border, marginBottom: 12 },
  answer: { color: theme.colors.textSecondary, fontSize: 15, lineHeight: 22 },
});

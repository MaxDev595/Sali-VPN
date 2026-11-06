import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useDerivedValue, withTiming } from 'react-native-reanimated';
import { Text } from './Text';
import { theme } from '../theme';

const EASE = Easing.bezier(.22, 1, .36, 1);

/**
 * FAQ item: the answer slides open to its measured height, the "+" turns into "×"
 * (45°) and fills with peach, the card lifts a little.
 */
export function AccordionItem({ question, answer, open, onToggle }: { question: string; answer: string; open: boolean; onToggle(): void }) {
  const [height, setHeight] = useState(0);
  const progress = useDerivedValue(() => withTiming(open ? 1 : 0, { duration: 420, easing: EASE }), [open]);
  const body = useAnimatedStyle(() => ({ height: height * progress.value, opacity: progress.value }));
  const text = useAnimatedStyle(() => ({ transform: [{ translateY: (1 - progress.value) * -8 }] }));
  const plus = useAnimatedStyle(() => ({
    transform: [{ rotate: `${progress.value * 135}deg` }],
    backgroundColor: progress.value > .5 ? theme.colors.accent : theme.colors.surfaceElevated,
  }));
  const bar = useAnimatedStyle(() => ({ backgroundColor: progress.value > .5 ? theme.colors.onPrimary : theme.colors.textPrimary }));
  const card = useAnimatedStyle(() => ({ borderColor: progress.value > .5 ? 'rgba(255,197,135,.28)' : theme.colors.border }));

  return <Animated.View style={[styles.card, card]}>
    <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={onToggle} style={styles.head}>
      <Text style={styles.question}>{question}</Text>
      <Animated.View style={[styles.plus, plus]}>
        <Animated.View style={[styles.barH, bar]} />
        <Animated.View style={[styles.barV, bar]} />
      </Animated.View>
    </Pressable>
    <Animated.View style={[styles.clip, body]}>
      {/* Measured off-flow so the open height is known before the first tap. */}
      <View style={styles.measure} onLayout={(event) => setHeight(event.nativeEvent.layout.height)}>
        <Animated.View style={text}><Text style={styles.answer}>{answer}</Text></Animated.View>
      </View>
    </Animated.View>
  </Animated.View>;
}

const styles = StyleSheet.create({
  card: { borderRadius: theme.radius.lg, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border, marginBottom: 10, overflow: 'hidden' },
  head: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 16 },
  question: { flex: 1, color: theme.colors.textPrimary, fontSize: 16, lineHeight: 22, fontFamily: 'SaliSans-SemiBold' },
  plus: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  barH: { position: 'absolute', width: 12, height: 2, borderRadius: 1 },
  barV: { position: 'absolute', width: 2, height: 12, borderRadius: 1 },
  clip: { overflow: 'hidden' },
  measure: { position: 'absolute', left: 0, right: 0, top: 0, paddingHorizontal: 16, paddingBottom: 18 },
  answer: { color: theme.colors.textSecondary, fontSize: 15, lineHeight: 22 },
});

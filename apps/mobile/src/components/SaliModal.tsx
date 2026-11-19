import { useEffect, useRef } from 'react';
import { Animated, Modal, Pressable, StyleSheet, View } from 'react-native';
import { Text } from './Text';
import { Icon, type IconName } from './Icon';
import { theme } from '../theme';

export function SaliModal({ visible, title, children, onClose, icon = 'info' }: { visible: boolean; title: string; children: React.ReactNode; onClose(): void; icon?: IconName }) {
  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => { if (visible) { progress.setValue(0); Animated.spring(progress, { toValue: 1, damping: 18, stiffness: 180, mass: .8, useNativeDriver: true }).start(); } }, [progress, visible]);
  return <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}><Pressable style={styles.backdrop} onPress={onClose}><Animated.View style={[styles.motion, { opacity: progress, transform: [{ scale: progress.interpolate({ inputRange: [0, 1], outputRange: [.9, 1] }) }, { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }] }]}><Pressable style={styles.card} onPress={() => {}}><View style={styles.badge}><Icon name={icon} size={24} color={theme.colors.accent} /></View><Text style={styles.title}>{title}</Text>{children}</Pressable></Animated.View></Pressable></Modal>;
}
const styles = StyleSheet.create({ backdrop: { flex: 1, padding: 22, backgroundColor: theme.colors.backdrop, justifyContent: 'center', alignItems: 'center' }, motion: { width: '100%', maxWidth: 440 }, card: { width: '100%', backgroundColor: theme.colors.surface, borderRadius: theme.radius.xl, borderWidth: 1, borderColor: theme.colors.border, padding: 22, shadowColor: '#000', shadowOpacity: .35, shadowRadius: 24, shadowOffset: { width: 0, height: 12 }, elevation: 16 }, badge: { width: 52, height: 52, borderRadius: 26, alignSelf: 'center', backgroundColor: theme.colors.glow, alignItems: 'center', justifyContent: 'center', marginBottom: 14 }, badgeDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: theme.colors.accent }, title: { color: theme.colors.textPrimary, fontSize: 22, lineHeight: 30, fontFamily: 'SaliSans-Bold', textAlign: 'center', marginBottom: 18 } });

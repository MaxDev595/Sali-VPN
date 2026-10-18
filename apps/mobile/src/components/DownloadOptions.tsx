import { Image, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { theme } from '../theme';

function StoreRow({ title, text, url, logo, compact = false }: { title: string; text: string; url: string; logo: number; compact?: boolean }) {
  return <Pressable onPress={() => void Linking.openURL(url)} style={({ pressed }) => [styles.row, pressed && styles.pressed]}><View style={styles.icon}><Image source={logo} style={compact ? styles.playLogo : styles.happLogo} resizeMode="contain" /></View><View style={styles.copy}><Text style={styles.title}>{title}</Text><Text style={styles.text}>{text}</Text></View><Text style={styles.chevron}>›</Text></Pressable>;
}

export function DownloadOptions() {
  return <View><Text style={styles.section}>СПОСОБЫ ПОДКЛЮЧЕНИЯ</Text><View style={styles.card}><StoreRow compact logo={require('../../assets/google-play.png')} title="Sali VPN в Google Play" text="Страница приложения и обновления" url="https://play.google.com/store/apps/details?id=app.sali.vpn" /><StoreRow logo={require('../../assets/happ.png')} title="Подключить через HAPP" text="Альтернативный клиент Sali" url="https://play.google.com/store/apps/details?id=com.happproxy" /></View></View>;
}

const styles = StyleSheet.create({ section: { color: theme.colors.textSecondary, fontSize: 12, fontWeight: '800', letterSpacing: 1.3, marginTop: 20, marginBottom: 9, marginLeft: 4 }, card: { borderRadius: 12, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border, overflow: 'hidden' }, row: { minHeight: 76, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border }, pressed: { backgroundColor: theme.colors.surfaceElevated }, icon: { width: 48, height: 48, borderRadius: 10, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }, playLogo: { width: 34, height: 34, transform: [{ translateX: 2 }] }, happLogo: { width: 48, height: 48 }, copy: { flex: 1 }, title: { color: theme.colors.textPrimary, fontSize: 16, fontWeight: '700' }, text: { color: theme.colors.textSecondary, fontSize: 13, marginTop: 3 }, chevron: { color: theme.colors.textSecondary, fontSize: 25 } });

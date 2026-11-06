import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Text } from '../src/components/Text';
import { AccordionItem, accordionLayout } from '../src/components/Accordion';
import { Icon } from '../src/components/Icon';
import { SectionLabel } from '../src/components/List';
import { SaliButton } from '../src/components/SaliButton';
import { useAccountStore } from '../src/store/accountStore';
import { openHelp, openSupport } from '../src/services/links';
import { useI18n } from '../src/i18n';
import { theme } from '../src/theme';

const FAQ = {
  ru: [
    ['VPN не подключается', 'Проверьте, что тариф активен (Профиль), выключите другие VPN и «Частный DNS» в настройках Android, смените локацию и попробуйте снова.'],
    ['Подключился, но сайты не открываются', 'Отключитесь, выберите другую локацию и подключитесь снова. Если включён Kill Switch, проверьте, что в системе разрешена «Постоянная VPN» для Sali.'],
    ['Куда вводить код?', 'Кнопка «Код» на главном экране или «Ввести код» в профиле. Регистр и дефисы не важны — код можно просто вставить.'],
    ['Как получить 24 часа бесплатно?', 'Откройте наш Telegram-бот и нажмите «24 часа бесплатно». Бот пришлёт код — введите его здесь или активируйте кнопкой в боте.'],
    ['Можно на нескольких устройствах?', 'Да. Один код активирует одно устройство: купите код для каждого и активируйте его кнопкой в боте — он спросит, на какое устройство.'],
    ['Сменил телефон — что с подпиской?', 'Напишите в поддержку старый и новый Sali ID — поможем перенести оставшиеся дни.'],
  ],
  en: [
    ['VPN won’t connect', 'Check your plan is active (Profile), turn off other VPNs and Android’s “Private DNS”, change the location and try again.'],
    ['Connected, but sites won’t open', 'Disconnect, pick another location and connect again. With Kill Switch on, make sure “Always-on VPN” is allowed for Sali.'],
    ['Where do I enter the code?', 'The “Code” button on the home screen or “Enter code” in Profile. Case and dashes don’t matter — just paste it.'],
    ['How do I get 24 hours free?', 'Open our Telegram bot and tap “24 hours free”. It sends a code — enter it here or activate it from the bot.'],
    ['Can I use several devices?', 'Yes. One code activates one device: get a code for each and activate it from the bot — it asks which device.'],
    ['New phone — what about my plan?', 'Send support your old and new Sali ID — we’ll help move the remaining days.'],
  ],
} as const;

export default function SupportScreen() {
  const { language, t } = useI18n();
  const publicId = useAccountStore(state => state.home?.user.publicId);
  const [open, setOpen] = useState<number | null>(null);

  return <SafeAreaView style={styles.safe}>
    <ScrollView contentContainerStyle={styles.screen} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Pressable accessibilityLabel="Назад" onPress={() => router.back()} style={styles.back}><Icon name="chevron" size={20} style={{ transform: [{ scaleX: -1 }] }} /></Pressable>
        <Text style={styles.title}>{t.help}</Text>
      </View>
      <Text style={styles.intro}>{t.supportIntro}</Text>

      <Animated.View entering={FadeInDown.duration(380)} style={styles.contact}>
        <View style={styles.contactIcon}><Icon name="telegram" size={22} color={theme.colors.accent} /></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.contactTitle}>@SaliVPNHelpBot</Text>
          <Text style={styles.contactText}>Укажите ваш Sali ID: <Text style={styles.id}>{publicId ?? '—'}</Text></Text>
        </View>
      </Animated.View>
      <View style={{ marginTop: 12 }}><SaliButton title={t.writeSupport} onPress={openSupport} /></View>

      <SectionLabel icon="help">{t.faq}</SectionLabel>
      {FAQ[language].map(([question, answer], index) => <AccordionItem key={question} question={question} answer={answer} open={open === index} onToggle={() => setOpen(open === index ? null : index)} />)}

      <Animated.View layout={accordionLayout}>
        <Pressable onPress={() => openHelp()} style={styles.more}><Text style={styles.moreText}>{t.allArticles}</Text><Icon name="external" size={15} color={theme.colors.accent} /></Pressable>
      </Animated.View>
    </ScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  screen: { padding: 20, paddingBottom: 48 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  back: { width: 44, height: 44, borderRadius: 22, backgroundColor: theme.colors.surface, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, color: theme.colors.textPrimary, fontSize: 26, lineHeight: 32, fontFamily: 'SaliSans-Bold' },
  intro: { color: theme.colors.textSecondary, fontSize: 15, lineHeight: 22, marginTop: 16, marginBottom: 18 },
  contactIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(255,197,135,.12)', alignItems: 'center', justifyContent: 'center' },
  contact: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: theme.radius.lg, backgroundColor: '#0C1A33', borderWidth: 1, borderColor: '#1E3460' },
  contactTitle: { color: theme.colors.textPrimary, fontSize: 17, fontFamily: 'SaliSans-SemiBold' },
  contactText: { color: theme.colors.textSecondary, fontSize: 14, marginTop: 4 },
  id: { color: theme.colors.accent, fontFamily: 'SaliSans-Bold' },
  more: { alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 16 },
  moreText: { color: theme.colors.accent, fontSize: 15, fontFamily: 'SaliSans-SemiBold' },
});

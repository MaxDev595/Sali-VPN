import { Image, type ImageStyle, type StyleProp } from 'react-native';

/** White PNG glyphs (assets/icons), tinted at render time. */
const ICONS = {
  key: require('../../assets/icons/key.png'),
  globe: require('../../assets/icons/globe.png'),
  devices: require('../../assets/icons/devices.png'),
  user: require('../../assets/icons/user.png'),
  check: require('../../assets/icons/check.png'),
  info: require('../../assets/icons/info.png'),
  external: require('../../assets/icons/external.png'),
  chevron: require('../../assets/icons/chevron.png'),
  shield: require('../../assets/icons/shield.png'),
  gear: require('../../assets/icons/gear.png'),
  chat: require('../../assets/icons/chat.png'),
  help: require('../../assets/icons/help.png'),
  telegram: require('../../assets/icons/telegram.png'),
  close: require('../../assets/icons/close.png'),
  plus: require('../../assets/icons/plus.png'),
  power: require('../../assets/icons/power.png'),
  gift: require('../../assets/icons/gift.png'),
  tag: require('../../assets/icons/tag.png'),
  users: require('../../assets/icons/users.png'),
  search: require('../../assets/icons/search.png'),
  cash: require('../../assets/icons/cash.png'),
  ban: require('../../assets/icons/ban.png'),
  link: require('../../assets/icons/link.png'),
  copy: require('../../assets/icons/copy.png'),
  lifebuoy: require('../../assets/icons/lifebuoy.png'),
  apps: require('../../assets/icons/apps.png'),
  dot: require('../../assets/icons/dot.png'),
  megaphone: require('../../assets/icons/megaphone.png'),
} as const;

export type IconName = keyof typeof ICONS;

export function Icon({ name, size = 20, color = '#F2F5FB', style }: { name: IconName; size?: number; color?: string; style?: StyleProp<ImageStyle> }) {
  return <Image source={ICONS[name]} style={[{ width: size, height: size, tintColor: color }, style]} resizeMode="contain" />;
}

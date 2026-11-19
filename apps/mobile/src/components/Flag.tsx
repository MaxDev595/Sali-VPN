import { Image, type ImageStyle, type StyleProp } from 'react-native';

/** Round PNG flags (assets/flags) — no emoji, so they look the same on every phone. */
const FLAGS = {
  NL: require('../../assets/flags/nl.png'), DE: require('../../assets/flags/de.png'), AT: require('../../assets/flags/at.png'),
  FR: require('../../assets/flags/fr.png'), PL: require('../../assets/flags/pl.png'), FI: require('../../assets/flags/fi.png'),
  SE: require('../../assets/flags/se.png'), NO: require('../../assets/flags/no.png'), CH: require('../../assets/flags/ch.png'),
  JP: require('../../assets/flags/jp.png'), TR: require('../../assets/flags/tr.png'), US: require('../../assets/flags/us.png'),
  GB: require('../../assets/flags/gb.png'), CA: require('../../assets/flags/ca.png'), KZ: require('../../assets/flags/kz.png'),
  SG: require('../../assets/flags/sg.png'),
} as Record<string, number>;
const GLOBE = require('../../assets/flags/globe.png');

export function Flag({ code, size = 26, style }: { code?: string | null; size?: number; style?: StyleProp<ImageStyle> }) {
  return <Image source={(code && FLAGS[code.toUpperCase()]) || GLOBE} style={[{ width: size, height: size, borderRadius: size / 2 }, style]} resizeMode="cover" />;
}

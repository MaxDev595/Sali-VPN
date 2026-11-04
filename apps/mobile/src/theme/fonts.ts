import { StyleSheet, type TextStyle } from 'react-native';

/**
 * Sali Sans — the logo's lettering for Latin (Outfit) merged with Jost for Cyrillic,
 * so Russian and English text match the logo. Android ignores fontWeight for custom
 * fonts, so every weight is its own family.
 */
export const fonts = {
  regular: 'SaliSans-Regular',
  medium: 'SaliSans-Medium',
  semibold: 'SaliSans-SemiBold',
  bold: 'SaliSans-Bold',
} as const;

export const fontAssets = {
  [fonts.regular]: require('../../assets/fonts/SaliSans-Regular.ttf'),
  [fonts.medium]: require('../../assets/fonts/SaliSans-Medium.ttf'),
  [fonts.semibold]: require('../../assets/fonts/SaliSans-SemiBold.ttf'),
  [fonts.bold]: require('../../assets/fonts/SaliSans-Bold.ttf'),
};

export function familyFor(weight: TextStyle['fontWeight']) {
  switch (String(weight ?? '400')) {
    case '500': return fonts.medium;
    case '600': return fonts.semibold;
    case '700': case '800': case '900': case 'bold': return fonts.bold;
    default: return fonts.regular;
  }
}

/** Resolves fontWeight into the matching Sali Sans family (unless another family was set on purpose). */
export function withSaliFont(style: unknown) {
  const flat = (StyleSheet.flatten(style as TextStyle) ?? {}) as TextStyle;
  if (flat.fontFamily && !flat.fontFamily.startsWith('SaliSans')) return flat;
  const { fontWeight, ...rest } = flat;
  return { ...rest, fontFamily: flat.fontFamily ?? familyFor(fontWeight) };
}

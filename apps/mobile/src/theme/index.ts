/**
 * Sali brand palette (logo / salivpn.com): near-black navy, logo navy, peach pen cap.
 * UI type: Outfit — the closest open font to the logo lettering.
 */
export const brand = { navy: '#072142', ink: '#040913', peach: '#FFC587', peachDeep: '#F4A85E', paper: '#F4F7FC' } as const;

export const theme = {
  colors: {
    background: '#040913', surface: '#0A1222', surfaceElevated: '#101A2E', primary: brand.peach, onPrimary: '#06101F',
    brand: brand.navy, accent: brand.peach, textPrimary: '#F2F5FB', textSecondary: '#8792AB',
    border: '#18233A', success: '#5BE0A8', warning: '#FFD38F', error: '#FF7A7A', muted: '#26324B',
    glow: 'rgba(255,197,135,0.14)', successGlow: 'rgba(91,224,168,0.14)', backdrop: 'rgba(2,5,12,.82)', tabBar: '#050B16',
  },
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 },
  radius: { sm: 10, md: 14, lg: 20, xl: 28, pill: 999 },
  typography: { display: 34, title: 24, body: 16, caption: 13 },
  animation: { fast: 160, normal: 280, connect: 850 },
} as const;

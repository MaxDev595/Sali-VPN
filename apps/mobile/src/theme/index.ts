export const theme = {
  colors: {
    background: '#000000', surface: '#0A0A0A', surfaceElevated: '#111111', primary: '#FFFFFF',
    brand: '#1C1C1C', accent: '#00E38A', textPrimary: '#FFFFFF', textSecondary: '#9A9A9A',
    border: '#1C1C1C', success: '#00E38A', warning: '#C7C7C7', error: '#FF5C5C', muted: '#3D3D3D',
  },
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 },
  radius: { sm: 8, md: 12, lg: 16, pill: 999 },
  typography: { display: 34, title: 24, body: 16, caption: 13 },
  animation: { fast: 160, normal: 280, connect: 850 },
} as const;

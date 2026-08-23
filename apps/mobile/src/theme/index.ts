export const theme = {
  colors: {
    background: '#05070A', surface: '#0E1218', surfaceElevated: '#151B24', primary: '#F7F9FC',
    brand: '#08264A', accent: '#F4A85B', textPrimary: '#F7F9FC', textSecondary: '#8D96A5',
    border: '#202834', success: '#47D99A', warning: '#F4A85B', error: '#FF6B72', muted: '#596273',
  },
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 },
  radius: { sm: 10, md: 16, lg: 22, pill: 999 },
  typography: { display: 34, title: 24, body: 16, caption: 13 },
  animation: { fast: 160, normal: 280, connect: 850 },
} as const;

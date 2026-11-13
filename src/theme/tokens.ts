// Values from Shared/app-design/se7en-bot/tokens.md.
import type { TextStyle } from 'react-native';

const light = {
  bg: '#FFFFFF',
  bgSidebar: '#F6F6F6',
  bgMuted: '#F0F0F0',
  bgCard: '#FFFFFF',
  bgComposer: '#FFFFFF',
  bgRowSelected: '#FFFFFF',
  textPrimary: '#1D1D1F',
  textSecondary: '#6A6A6F',
  iconMuted: '#86868B',
  userPill: '#000000',
  textOnUserPill: '#FFFFFF',
  primary: '#000000',
  textOnPrimary: '#FFFFFF',
  presence: '#1D1D1F',
  border: '#E5E5E5',
  borderAlt: '#E3E3E3',
  borderStrong: '#1D1D1F',
  statusBusy: '#34C759',
  statusWaiting: '#FF9500',
  textWaiting: '#A15C00',
  link: '#0066CC',
  errorFill: '#FF3B30',
  onErrorFill: '#FFFFFF',
  textError: '#D70015',
  focus: '#8E8E93',
  scrim: 'rgba(0,0,0,0.32)',
  // tokens.md › Botfärger: only for the bot's body, never for text, buttons or surfaces.
  bot: { red: '#D9433F', amber: '#B26B00', green: '#2E8540', teal: '#13858A', blue: '#2F6FD6', violet: '#7B55E0', pink: '#C2418A' },
  botEye: '#FFFFFF',
  botEmptyBody: '#E5E5E5',
  botEmptyEye: '#86868B',
};

export type Colors = typeof light;

const dark: Colors = {
  bg: '#1C1C1E',
  bgSidebar: '#232325',
  bgMuted: '#2C2C2E',
  bgCard: '#2F2F2F',
  bgComposer: '#2F2F2F',
  bgRowSelected: '#2F2F2F',
  textPrimary: '#F5F5F7',
  textSecondary: '#98989D',
  iconMuted: '#98989D',
  userPill: '#5F5F5F',
  textOnUserPill: '#F5F5F7',
  primary: '#F5F5F7',
  textOnPrimary: '#1C1C1E',
  presence: '#F5F5F7',
  border: '#38383A',
  borderAlt: '#38383A',
  borderStrong: '#F5F5F7',
  statusBusy: '#30D158',
  statusWaiting: '#FF9F0A',
  textWaiting: '#FF9F0A',
  link: '#409CFF',
  errorFill: '#FF6961',
  onErrorFill: '#1C1C1E',
  textError: '#FF6961',
  focus: '#8E8E93',
  scrim: 'rgba(0,0,0,0.50)',
  bot: { red: '#FF6B66', amber: '#E8A93A', green: '#4CC764', teal: '#3CC3C6', blue: '#5E9BFF', violet: '#A68BFF', pink: '#F27AB8' },
  botEye: '#1C1C1E',
  botEmptyBody: '#38383A',
  botEmptyEye: '#98989D',
};

export const palettes = { light, dark };

export const type = {
  titleVoice: { fontSize: 22, lineHeight: 28, fontWeight: '600' },
  titleNav: { fontSize: 17, lineHeight: 22, fontWeight: '600' },
  body: { fontSize: 15, lineHeight: 21, fontWeight: '400' },
  bodyStrong: { fontSize: 15, lineHeight: 21, fontWeight: '600' },
  button: { fontSize: 15, lineHeight: 20, fontWeight: '600' },
  small: { fontSize: 13, lineHeight: 18, fontWeight: '400' },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '400' },
  titleLarge: { fontSize: 28, lineHeight: 34, fontWeight: '700' },
  overline: { fontSize: 11, lineHeight: 14, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.6 },
  mono: { fontSize: 13, lineHeight: 18, fontWeight: '400', fontFamily: 'Menlo' },
} satisfies Record<string, TextStyle>;

export const space = { 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32, 10: 40 } as const;

export const radius = { sm: 10, md: 14, lg: 16, bubble: 18, input: 24, sheet: 20, full: 999 } as const;

export const motion = { press: 150, base: 250, drawer: 280 } as const;

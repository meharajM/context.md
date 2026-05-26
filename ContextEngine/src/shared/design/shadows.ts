import { Platform, type ViewStyle } from 'react-native';

const iosCardShadow: ViewStyle = {
  shadowColor: 'rgba(28, 27, 27, 0.12)',
  shadowOpacity: 1,
  shadowRadius: 18,
  shadowOffset: { width: 0, height: 8 },
};

export const shadows = {
  card: Platform.select<ViewStyle>({
    ios: iosCardShadow,
    android: {
      elevation: 1,
    },
    default: {},
  }),
  floating: Platform.select<ViewStyle>({
    ios: {
      shadowColor: 'rgba(28, 27, 27, 0.14)',
      shadowOpacity: 1,
      shadowRadius: 26,
      shadowOffset: { width: 0, height: 12 },
    },
    android: {
      elevation: 4,
    },
    default: {},
  }),
} as const;

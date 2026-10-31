import { Platform, type ViewStyle } from 'react-native';

import { colors } from './colors';

const iosCardShadow: ViewStyle = {
  shadowColor: colors.shadow,
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
      shadowColor: colors.shadow,
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

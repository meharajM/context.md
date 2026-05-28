import type { IconName } from '../shared/components/Icon';

export type AppRoute = 'reflections' | 'queue' | 'settings' | 'threadDetails' | 'noteEditor';
export type PrimaryRoute = Exclude<AppRoute, 'threadDetails' | 'noteEditor'>;

export interface NavigationItem {
  route: PrimaryRoute;
  label: string;
  icon: IconName;
}

export const primaryNavigationItems: NavigationItem[] = [
  { route: 'reflections', label: 'Reflections', icon: 'reflections' },
  { route: 'queue', label: 'Queue', icon: 'queue' },
  { route: 'settings', label: 'Settings', icon: 'settings' },
];

export const isPrimaryRoute = (route: AppRoute): route is PrimaryRoute =>
  route !== 'threadDetails' && route !== 'noteEditor';

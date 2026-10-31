import type { IconName } from '../shared/components/Icon';

export type AppRoute = 'reflections' | 'queue' | 'import' | 'settings' | 'threadDetails' | 'noteEditor';
export type PrimaryRoute = Exclude<AppRoute, 'threadDetails' | 'noteEditor'>;

export interface NavigationItem {
  route: PrimaryRoute;
  label: string;
  icon: IconName;
}

export const primaryNavigationItems: NavigationItem[] = [
  { route: 'reflections', label: 'Home', icon: 'reflections' },
  { route: 'queue', label: 'Waiting', icon: 'queue' },
  { route: 'import', label: 'Paste', icon: 'document' },
  { route: 'settings', label: 'Settings', icon: 'settings' },
];

export const isPrimaryRoute = (route: AppRoute): route is PrimaryRoute =>
  route !== 'threadDetails' && route !== 'noteEditor';

export const getSharedContentRouteAction = (
  route: AppRoute,
  pendingId: string | null,
  routedId: string | null,
): 'clear' | 'defer' | 'route' | 'none' => {
  if (!pendingId) return 'clear';
  if (route === 'noteEditor') return routedId === pendingId ? 'none' : 'defer';
  return routedId === pendingId ? 'none' : 'route';
};

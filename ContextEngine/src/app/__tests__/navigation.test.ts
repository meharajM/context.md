import { getSharedContentRouteAction, primaryNavigationItems } from '../navigation';

it('labels manual text entry as Paste without changing its route id', () => {
  expect(primaryNavigationItems.find(item => item.route === 'import')).toMatchObject({
    route: 'import',
    label: 'Paste',
  });
});

it('defers an incoming share while an editor is open, then routes it after the editor closes', () => {
  expect(getSharedContentRouteAction('noteEditor', 'shared-1', null)).toBe('defer');
  expect(getSharedContentRouteAction('threadDetails', 'shared-1', null)).toBe('route');
  expect(getSharedContentRouteAction('queue', 'shared-1', 'shared-1')).toBe('none');
  expect(getSharedContentRouteAction('queue', null, 'shared-1')).toBe('clear');
});

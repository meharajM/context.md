import { primaryNavigationItems } from '../navigation';

it('labels the paste and file import route Import without changing its route id', () => {
  expect(primaryNavigationItems.find(item => item.route === 'import')).toMatchObject({
    route: 'import',
    label: 'Import',
  });
});

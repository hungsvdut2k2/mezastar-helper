import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { setOwned } from '../../storage/db';
import { freshDb } from '../../test/freshDb';
import { WithStore } from '../testHarness';
import { PlanScreen } from './PlanScreen';

beforeEach(freshDb);

it('plans for a Superstar picked with one tap, using unknown cronies', async () => {
  for (const id of ['1-3-002', '1-3-008']) await setOwned(id, true);
  const user = userEvent.setup();
  render(<WithStore>{(store) => <PlanScreen store={store} />}</WithStore>);
  await user.click(await screen.findByRole('button', { name: 'Lugia' }));
  expect(screen.getByText(/^Team 1:/)).toBeInTheDocument();
  expect(screen.getAllByText(/Unknown crony/).length).toBeGreaterThan(0);
});

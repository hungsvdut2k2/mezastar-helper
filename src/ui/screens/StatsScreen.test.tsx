import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { addLogEntry, loadAll } from '../../storage/db';
import { makeLogEntry } from '../../test/factories';
import { freshDb } from '../../test/freshDb';
import { WithStore } from '../testHarness';
import { StatsScreen } from './StatsScreen';

beforeEach(freshDb);

const renderScreen = () => render(<WithStore>{(store) => <StatsScreen store={store} />}</WithStore>);

it('shows numbers from the play log', async () => {
  await addLogEntry(makeLogEntry({ id: 'a', caught: '1-3-001', bossDefeated: true }));
  await addLogEntry(makeLogEntry({ id: 'b' }));
  renderScreen();
  expect(await screen.findByTestId('plays')).toHaveTextContent('2');
  expect(screen.getByTestId('superstars-caught')).toHaveTextContent('1');
  expect(screen.getByTestId('target-catch')).toHaveTextContent('50% (1/2)');
});

it('deletes a log entry', async () => {
  await addLogEntry(makeLogEntry({ id: 'a' }));
  const user = userEvent.setup();
  renderScreen();
  await user.click(await screen.findByRole('button', { name: /^Delete play/ }));
  expect(await screen.findByTestId('plays')).toHaveTextContent('0');
  expect((await loadAll()).log).toHaveLength(0);
});

it('rejects a bad backup file and changes nothing', async () => {
  await addLogEntry(makeLogEntry({ id: 'a' }));
  const user = userEvent.setup();
  renderScreen();
  const file = new File(['not json'], 'backup.json', { type: 'application/json' });
  await user.upload(await screen.findByLabelText('Restore from backup'), file);
  expect(await screen.findByText(/Restore failed/)).toBeInTheDocument();
  expect((await loadAll()).log).toHaveLength(1);
});

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { freshDb } from '../test/freshDb';
import { App } from './App';

beforeEach(freshDb);

it('opens on Play and switches screens from the tab bar', async () => {
  const user = userEvent.setup();
  render(<App />);
  expect(await screen.findByRole('heading', { name: 'Play' })).toBeInTheDocument();
  const tabs = within(screen.getByRole('navigation', { name: 'Main' }));
  for (const name of ['Plan', 'Collection', 'Guide', 'Stats']) {
    await user.click(tabs.getByRole('button', { name }));
    expect(await screen.findByRole('heading', { level: 1, name })).toBeInTheDocument();
  }
});

it('keeps what was typed on Play when the player checks another tab', async () => {
  const user = userEvent.setup();
  render(<App />);
  await screen.findByRole('heading', { name: 'Play' });
  await user.type(screen.getAllByPlaceholderText('Name or number')[0], 'Lugia');
  const tabs = within(screen.getByRole('navigation', { name: 'Main' }));
  await user.click(tabs.getByRole('button', { name: 'Guide' }));
  expect(await screen.findByRole('heading', { level: 1, name: 'Guide' })).toBeInTheDocument();
  expect(screen.queryByRole('heading', { level: 1, name: 'Play' })).not.toBeInTheDocument();
  await user.click(tabs.getByRole('button', { name: 'Play' }));
  expect(await screen.findByRole('heading', { level: 1, name: 'Play' })).toBeInTheDocument();
  expect(screen.getAllByPlaceholderText('Name or number')[0]).toHaveValue('Lugia');
});

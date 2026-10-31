import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { saveCorrection, setOwned } from '../storage/db';
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

it('shows the top bar with the machine set and marks the current tab', async () => {
  const user = userEvent.setup();
  render(<App />);
  await screen.findByRole('heading', { name: 'Play' });
  const banner = screen.getByRole('banner');
  expect(banner).toHaveTextContent('MEZASTAR HELPER');
  expect(banner).toHaveTextContent('Machine set: Stardust V3');
  const tabs = within(screen.getByRole('navigation', { name: 'Main' }));
  expect(tabs.getByRole('button', { name: 'Play' })).toHaveAttribute('aria-current', 'page');
  await user.click(tabs.getByRole('button', { name: 'Stats' }));
  expect(tabs.getByRole('button', { name: 'Stats' })).toHaveAttribute('aria-current', 'page');
  expect(tabs.getByRole('button', { name: 'Play' })).not.toHaveAttribute('aria-current');
});

it('scrolls to the top when the tab changes', async () => {
  const user = userEvent.setup();
  const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  render(<App />);
  await screen.findByRole('heading', { name: 'Play' });
  scrollTo.mockClear();
  await user.click(within(screen.getByRole('navigation', { name: 'Main' })).getByRole('button', { name: 'Guide' }));
  expect(scrollTo).toHaveBeenCalledWith(0, 0);
  scrollTo.mockRestore();
});

it('asks the browser for persistent storage once at startup', async () => {
  const persist = vi.fn().mockResolvedValue(true);
  Object.defineProperty(navigator, 'storage', { value: { persist }, configurable: true });
  try {
    render(<App />);
    await screen.findByRole('heading', { name: 'Play' });
    expect(persist).toHaveBeenCalledTimes(1);
  } finally {
    Reflect.deleteProperty(navigator, 'storage');
  }
});

it('keeps what was typed on Play when the player checks another tab', async () => {
  const user = userEvent.setup();
  render(<App />);
  await screen.findByRole('heading', { name: 'Play' });
  const visiblePane = () => within(screen.getByRole('heading', { level: 1, name: 'Play' }).closest('section')!);
  await user.type(visiblePane().getAllByPlaceholderText('Name or number')[0], 'Lugia');
  const tabs = within(screen.getByRole('navigation', { name: 'Main' }));
  await user.click(tabs.getByRole('button', { name: 'Guide' }));
  expect(await screen.findByRole('heading', { level: 1, name: 'Guide' })).toBeInTheDocument();
  expect(screen.queryByRole('heading', { level: 1, name: 'Play' })).not.toBeInTheDocument();
  await user.click(tabs.getByRole('button', { name: 'Play' }));
  expect(await screen.findByRole('heading', { level: 1, name: 'Play' })).toBeInTheDocument();
  expect(visiblePane().getAllByPlaceholderText('Name or number')[0]).toHaveValue('Lugia');
});

const pane = (name: string) => within(screen.getByRole('heading', { level: 1, name }).closest('section')!);

async function pick(user: ReturnType<typeof userEvent.setup>, screenName: string, label: string, query: string, id: string) {
  await user.type(pane(screenName).getByLabelText(label), query);
  await user.click(pane(screenName).getByRole('button', { name: new RegExp(`^${query} ${id}`) }));
}

async function correct(user: ReturnType<typeof userEvent.setup>, name: string, field: string, value: string) {
  const tabs = within(screen.getByRole('navigation', { name: 'Main' }));
  await user.click(tabs.getByRole('button', { name: 'Collection' }));
  // Stardust V3 is listed first, so the first match is the V3 tag.
  await user.click(pane('Collection').getAllByText(name)[0]);
  const input = screen.getByLabelText(field);
  if (input.tagName === 'SELECT') await user.selectOptions(input, value);
  else {
    await user.clear(input);
    await user.type(input, value);
  }
  await user.click(screen.getByRole('button', { name: /^Save/ }));
  expect(await screen.findByRole('heading', { level: 1, name: 'Collection' })).toBeInTheDocument();
  return tabs;
}

it('uses a correction made in Collection for the opponents already picked on Play', async () => {
  const stats = { hp: 500, attack: 100, speed: 100 };
  for (const id of ['1-3-002', '1-3-008', '1-3-012']) {
    await setOwned(id, true);
    await saveCorrection(id, { stats });
  }
  await saveCorrection('1-3-017', { stats: { hp: 400 } });
  await saveCorrection('1-3-041', { stats: { hp: 300 } });
  const user = userEvent.setup();
  render(<App />);
  await screen.findByRole('heading', { level: 1, name: 'Play' });
  await pick(user, 'Play', 'Boss', 'Lugia', '1-3-001');
  await pick(user, 'Play', 'Crony 1', 'Pidgeot', '1-3-017');
  await pick(user, 'Play', 'Crony 2', 'Koffing', '1-3-041');
  expect(pane('Play').getAllByText('rule of thumb').length).toBeGreaterThan(0);

  const tabs = await correct(user, 'Lugia', 'HP', '900');
  await user.click(tabs.getByRole('button', { name: 'Play' }));
  expect(await screen.findByRole('heading', { level: 1, name: 'Play' })).toBeInTheDocument();
  expect(pane('Play').getByText(/^Team 1:/)).toBeInTheDocument();
  expect(pane('Play').queryByText('rule of thumb')).not.toBeInTheDocument();
});

it('shows a correction made in Collection on the Plan target chip', async () => {
  const user = userEvent.setup();
  render(<App />);
  await screen.findByRole('heading', { level: 1, name: 'Play' });
  const tabs = within(screen.getByRole('navigation', { name: 'Main' }));
  await user.click(tabs.getByRole('button', { name: 'Plan' }));
  await user.click(pane('Plan').getByRole('button', { name: 'Lugia 1-3-001' }));
  expect(pane('Plan').getByRole('button', { name: 'Clear Target' })).toHaveTextContent('1-3-001 6★');

  await correct(user, 'Lugia', 'Grade', '5★');
  await user.click(tabs.getByRole('button', { name: 'Plan' }));
  expect(pane('Plan').getByRole('button', { name: 'Clear Target' })).toHaveTextContent('1-3-001 5★');
});

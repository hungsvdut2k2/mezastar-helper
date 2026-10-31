import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TAGS } from '../../data/tags';
import type { PlayLogEntry } from '../../data/types';
import type { Battle } from '../../engine/battleModel';
import { bestPlan } from '../../engine/planSearch';
import { recommend, type Recommendation } from '../../engine/recommend';
import { makeTag } from '../../test/factories';
import { LogForm } from './LogForm';

const byId = (id: string) => TAGS.find((t) => t.id === id)!;
const battle: Battle = { opponents: [byId('1-3-001'), byId('1-3-017'), byId('1-3-041')], targetIndex: 0 };
const [rec] = recommend(['1-3-002', '1-3-008', '1-3-012'].map(byId), battle);

it('builds a log entry from a few taps', async () => {
  const user = userEvent.setup();
  const onSave = vi.fn<(e: PlayLogEntry) => void>();
  render(<LogForm mode="battle" battle={battle} rec={rec} lastLocation="Mall A" onSave={onSave} onCancel={() => {}} />);
  await user.click(screen.getByRole('button', { name: '1' }));
  await user.click(screen.getByRole('button', { name: 'Yes' }));
  await user.click(screen.getByRole('button', { name: 'Lugia' }));
  await user.click(screen.getByRole('button', { name: 'Ultra' }));
  await user.click(screen.getByRole('checkbox', { name: 'Add turn detail' }));
  await user.click(screen.getAllByRole('checkbox', { name: 'Defeated it' })[0]);
  await user.click(screen.getByRole('button', { name: 'Save play' }));

  const entry = onSave.mock.calls[0][0];
  expect(entry).toMatchObject({
    mode: 'battle',
    location: 'Mall A',
    boss: '1-3-001',
    cronies: ['1-3-017', '1-3-041'],
    target: '1-3-001',
    superstarAppeared: true,
    teamUsed: rec.team.map((t) => t.id),
    cronyDefeatedCount: 1,
    bossDefeated: true,
    ballType: 'ultra',
    caught: '1-3-001',
  });
  expect(entry.turns).toHaveLength(3);
  expect(entry.turns[0].defeated).toBe(entry.turns[0].aimedAt);
  expect(entry.turns[1].defeated).toBeUndefined();
});

it('saves once even if Save play is tapped twice quickly', async () => {
  const user = userEvent.setup();
  const onSave = vi.fn<(e: PlayLogEntry) => Promise<void>>(() => new Promise((r) => setTimeout(r, 50)));
  render(<LogForm mode="battle" battle={battle} rec={rec} lastLocation="" onSave={onSave} onCancel={() => {}} />);
  await user.dblClick(screen.getByRole('button', { name: 'Save play' }));
  expect(onSave).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('button', { name: 'Save play' })).toBeDisabled();
});

it('ignores a second tap that arrives before React has re-rendered (the ref guard alone)', () => {
  const onSave = vi.fn<(e: PlayLogEntry) => Promise<void>>(() => new Promise(() => {}));
  render(<LogForm mode="battle" battle={battle} rec={rec} lastLocation="" onSave={onSave} onCancel={() => {}} />);
  const button = screen.getByRole('button', { name: 'Save play' });
  // Both clicks happen inside one act(), so the button is still enabled for the second one.
  act(() => {
    button.click();
    button.click();
  });
  expect(onSave).toHaveBeenCalledTimes(1);
});

it('keeps the same entry id when retrying after a failed save', async () => {
  const user = userEvent.setup();
  const onSave = vi.fn<(e: PlayLogEntry) => Promise<void>>().mockRejectedValueOnce(new Error('x')).mockResolvedValue();
  render(<LogForm mode="battle" battle={battle} rec={rec} lastLocation="" onSave={onSave} onCancel={() => {}} />);
  await user.click(screen.getByRole('button', { name: 'Save play' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(/not saved/);
  await user.click(screen.getByRole('button', { name: 'Save play' }));
  expect(onSave.mock.calls[1][0].id).toBe(onSave.mock.calls[0][0].id);
});

describe('turn detail', () => {
  const setup = () => {
    const onSave = vi.fn<(e: PlayLogEntry) => void>();
    render(<LogForm mode="battle" battle={battle} rec={rec} lastLocation="" onSave={onSave} onCancel={() => {}} />);
    return onSave;
  };

  it('lets the player change the attacker and the aim of a turn', async () => {
    const user = userEvent.setup();
    const onSave = setup();
    await user.click(screen.getByRole('checkbox', { name: 'Add turn detail' }));
    const otherTag = rec.team[rec.team.length - 1];
    await user.selectOptions(screen.getByLabelText('Turn 1 attacker'), otherTag.id);
    await user.selectOptions(screen.getByLabelText('Turn 1 aimed at'), '0');
    await user.click(screen.getAllByRole('checkbox', { name: 'Defeated it' })[0]);
    await user.click(screen.getByRole('button', { name: 'Save play' }));
    const turn = onSave.mock.calls[0][0].turns[0];
    expect(turn.attacker).toBe(otherTag.id);
    expect(turn.aimedAt).toBe('1-3-001');
    expect(turn.defeated).toBe('1-3-001');
  });

  it('keeps the predicted defeat for the planned attacker and aim, and drops it when either is changed', async () => {
    const user = userEvent.setup();
    // Normal moves only do half damage to the Rock Boss and both cronies fall in one hit, so turn 1 predicts a defeat.
    const opp = (id: string, o = {}) => makeTag(id, { ...o, stats: { attack: 1, speed: 1, ...(o as { stats?: object }).stats } });
    const team = [makeTag('A', { stats: { attack: 40 } }), makeTag('B', { stats: { attack: 40 } })];
    const b: Battle = {
      opponents: [opp('boss', { types: ['rock'] }), opp('c1', { stats: { hp: 40 } }), opp('c2', { stats: { hp: 40 } })],
      targetIndex: 0,
    };
    const plan = bestPlan(team, b)!;
    const r = { team, plan } as unknown as Recommendation;
    const planned = plan.steps[0];
    expect(planned.expectDefeat).toBe(true); // without a prediction this test would prove nothing

    const saveWith = async (change?: () => Promise<unknown>) => {
      const onSave = vi.fn<(e: PlayLogEntry) => void>();
      const { unmount } = render(<LogForm mode="battle" battle={b} rec={r} lastLocation="" onSave={onSave} onCancel={() => {}} />);
      await user.click(screen.getByRole('checkbox', { name: 'Add turn detail' }));
      await change?.();
      await user.click(screen.getByRole('button', { name: 'Save play' }));
      unmount();
      return onSave.mock.calls[0][0].turns[0];
    };

    expect((await saveWith()).predictedDefeat).toBe(true);
    const otherAttacker = team.find((t) => t.id !== planned.tagId)!;
    expect((await saveWith(() => user.selectOptions(screen.getByLabelText('Turn 1 attacker'), otherAttacker.id))).predictedDefeat).toBeUndefined();
    const otherAim = [0, 1, 2].find((n) => n !== planned.aimAtIndex)!;
    expect((await saveWith(() => user.selectOptions(screen.getByLabelText('Turn 1 aimed at'), String(otherAim)))).predictedDefeat).toBeUndefined();
  });

  it('warns, without blocking, when a crony defeat is ticked but the count is 0', async () => {
    const user = userEvent.setup();
    const onSave = setup();
    await user.click(screen.getByRole('checkbox', { name: 'Add turn detail' }));
    await user.selectOptions(screen.getByLabelText('Turn 1 aimed at'), '1');
    expect(screen.queryByText(/but "Cronies defeated" is 0/)).not.toBeInTheDocument();
    await user.click(screen.getAllByRole('checkbox', { name: 'Defeated it' })[0]);
    expect(screen.getByRole('status')).toHaveTextContent(/"Cronies defeated" is 0/);
    await user.click(screen.getByRole('button', { name: 'Save play' }));
    expect(onSave).toHaveBeenCalledTimes(1);
  });
});

it('groups its button rows and focuses the heading', () => {
  render(<LogForm mode="battle" battle={battle} rec={rec} lastLocation="" onSave={() => {}} onCancel={() => {}} />);
  expect(screen.getByRole('group', { name: 'Cronies defeated' })).toBeInTheDocument();
  expect(screen.getByRole('group', { name: 'Boss defeated?' })).toBeInTheDocument();
  expect(screen.getByRole('group', { name: 'Caught' })).toBeInTheDocument();
  expect(screen.getByRole('group', { name: 'Ball (optional)' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Log this play' })).toHaveFocus();
});

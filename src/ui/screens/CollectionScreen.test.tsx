import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as dbModule from '../../storage/db';
import { TAGS } from '../../data/tags';
import { addLogEntry, loadAll, putCustomTag, putPhoto, saveCorrection, setOwned } from '../../storage/db';
import { makeLogEntry, makeTag } from '../../test/factories';
import { freshDb } from '../../test/freshDb';
import { WithStore } from '../testHarness';
import { CollectionScreen } from './CollectionScreen';

beforeEach(freshDb);

const renderScreen = () => render(<WithStore>{(store) => <CollectionScreen store={store} />}</WithStore>);

it('tells apart custom tags that share name, printed code and set', async () => {
  const user = userEvent.setup();
  await putCustomTag(makeTag('my-a', { name: 'Twin', printedCode: 'X-1' }));
  await putCustomTag(makeTag('my-b', { name: 'Twin', printedCode: 'X-1' }));
  renderScreen();
  await user.selectOptions(await screen.findByLabelText('Set'), 'My tags');
  await user.click(await screen.findByRole('button', { name: 'Owned: Twin (2) X-1, My tags' }));
  expect(screen.getByRole('button', { name: 'Owned: Twin X-1, My tags' })).toHaveAttribute('aria-pressed', 'false');
  expect((await loadAll()).owned).toEqual(['my-b']);
  expect(screen.getByText('Twin (2)')).toBeInTheDocument();
  expect(screen.getByText('Twin')).toBeInTheDocument();
});

it('toggles owned and keeps it after reopening', async () => {
  const user = userEvent.setup();
  const { unmount } = renderScreen();
  await screen.findByText('Owned 0 / 73');
  const toggle = screen.getByRole('button', { name: 'Owned: Lugia 1-3-001, Stardust V3' });
  expect(toggle).toHaveAttribute('aria-pressed', 'false');
  await user.click(toggle);
  expect(await screen.findByText('Owned 1 / 73')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Owned: Lugia 1-3-001, Stardust V3' })).toHaveAttribute('aria-pressed', 'true');
  unmount();
  renderScreen();
  expect(await screen.findByText('Owned 1 / 73')).toBeInTheDocument();
});

describe('set filter', () => {
  it('defaults to Stardust V3 and counts owned per set', async () => {
    await setOwned('1-3-001', true);
    await setOwned('1-3-002', true);
    await setOwned('2-3-001', true);
    renderScreen();
    expect(await screen.findByRole('combobox', { name: 'Set' })).toHaveValue('stardust-v3');
    expect(screen.getByText('Owned 2 / 73')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Owned: .*Galaxy V3$/ })).not.toBeInTheDocument();
  });

  it('lists All sets, the seven official sets and My tags', async () => {
    renderScreen();
    const options = within(await screen.findByRole('combobox', { name: 'Set' })).getAllByRole('option').map((o) => o.textContent);
    expect(options).toEqual([
      'All sets', 'Stardust V1', 'Stardust V2', 'Stardust V3', 'Stardust V4', 'Galaxy V1', 'Galaxy V2', 'Galaxy V3', 'My tags',
    ]);
  });

  it('shows the owned total across every set for All sets', async () => {
    const user = userEvent.setup();
    await setOwned('1-3-001', true);
    await setOwned('2-3-001', true);
    await setOwned('1-1-001', true);
    renderScreen();
    await user.selectOptions(await screen.findByRole('combobox', { name: 'Set' }), 'all');
    expect(screen.getByText(`Owned 3 / ${TAGS.length}`)).toBeInTheDocument();
    await user.selectOptions(screen.getByRole('combobox', { name: 'Set' }), 'galaxy-v3');
    expect(screen.getByText('Owned 1 / 73')).toBeInTheDocument();
  });

  it('works together with search and the owned filter', async () => {
    const user = userEvent.setup();
    await setOwned('1-3-001', true);
    renderScreen();
    await user.selectOptions(await screen.findByRole('combobox', { name: 'Set' }), 'stardust-v1');
    expect(screen.getByText('Owned 0 / 70')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Owned' }));
    expect(screen.getByText('No tags match.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'All' }));
    await user.type(screen.getByRole('searchbox', { name: 'Search tags' }), '1-1-009');
    expect(screen.getAllByRole('button', { name: /^Charizard 1-1-009/ })).toHaveLength(1);
    expect(screen.queryByRole('button', { name: /^Lugia/ })).not.toBeInTheDocument();
  });

  it('shows a Regular Tag once under all sets, and in each set of its series', async () => {
    const user = userEvent.setup();
    renderScreen();
    const set = await screen.findByRole('combobox', { name: 'Set' });
    await user.selectOptions(set, 'all');
    await user.type(screen.getByRole('searchbox', { name: 'Search tags' }), 'R-2-1');
    expect(screen.getAllByRole('button', { name: /^Owned: .* R-2-1, Galaxy \(Regular\)$/ })).toHaveLength(1);
    for (const id of ['galaxy-v1', 'galaxy-v2', 'galaxy-v3']) {
      await user.selectOptions(set, id);
      expect(screen.getAllByRole('button', { name: /^Owned: .* R-2-1, / })).toHaveLength(1);
    }
    await user.selectOptions(set, 'stardust-v3');
    expect(screen.queryByRole('button', { name: /^Owned: .* R-2-1, / })).not.toBeInTheDocument();
  });

  it('counts an owned Regular Tag in every set of its series', async () => {
    const user = userEvent.setup();
    renderScreen();
    const set = await screen.findByRole('combobox', { name: 'Set' });
    await user.selectOptions(set, 'galaxy-v1');
    await user.type(screen.getByRole('searchbox', { name: 'Search tags' }), 'R-2-1');
    await user.click(screen.getByRole('button', { name: /^Owned: .* R-2-1, / }));
    await user.clear(screen.getByRole('searchbox', { name: 'Search tags' }));
    expect(await screen.findByText('Owned 1 / 73')).toBeInTheDocument();
    await user.selectOptions(set, 'galaxy-v3');
    expect(screen.getByText('Owned 1 / 73')).toBeInTheDocument();
    await user.selectOptions(set, 'stardust-v1');
    expect(screen.getByText('Owned 0 / 70')).toBeInTheDocument();
  });

  it('shows the printed code and series label on each row and in the editor', async () => {
    const user = userEvent.setup();
    renderScreen();
    await user.selectOptions(await screen.findByRole('combobox', { name: 'Set' }), 'galaxy-v2');
    await user.type(screen.getByRole('searchbox', { name: 'Search tags' }), 'R-2-1');
    const row = screen.getByRole('button', { name: /^.* R-2-1 · Galaxy \(Regular\)/ });
    await user.click(row);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('R-2-1');
    expect(screen.getByText(/^Galaxy \(Regular\) ·/)).toBeInTheDocument();
  });
});

it('searches by name or number', async () => {
  const user = userEvent.setup();
  renderScreen();
  await user.type(await screen.findByRole('searchbox', { name: 'Search tags' }), '1-3-045');
  expect(screen.getByRole('button', { name: /^Metagross 1-3-045/ })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /^Lugia/ })).not.toBeInTheDocument();
});

it('saves a correction from the back of the tag', async () => {
  const user = userEvent.setup();
  renderScreen();
  await user.click(await screen.findByRole('button', { name: /^Lugia 1-3-001/ }));
  await user.type(screen.getByLabelText('Attack'), '150');
  await user.click(screen.getByRole('button', { name: 'Save' }));
  await user.click(await screen.findByRole('button', { name: /^Lugia 1-3-001/ }));
  expect(screen.getByLabelText('Attack')).toHaveValue(150);
  expect(screen.getByText(/player correction/)).toBeInTheDocument();
});

it('stores only the fields that differ from the shipped tag', async () => {
  const user = userEvent.setup();
  renderScreen();
  await user.click(await screen.findByRole('button', { name: /^Lugia 1-3-001/ }));
  await user.type(screen.getByLabelText('Attack'), '150');
  await user.click(screen.getByRole('button', { name: 'Save' }));
  await screen.findByRole('heading', { name: 'Collection' });
  expect((await loadAll()).corrections).toEqual({ '1-3-001': { stats: { attack: 150 } } });
});

it('stores no correction when nothing was changed', async () => {
  const user = userEvent.setup();
  renderScreen();
  await user.click(await screen.findByRole('button', { name: /^Lugia 1-3-001/ }));
  await user.click(screen.getByRole('button', { name: 'Save' }));
  await screen.findByRole('heading', { name: 'Collection' });
  expect((await loadAll()).corrections).toEqual({});
});

it('clears an old correction when its box is emptied', async () => {
  const user = userEvent.setup();
  await saveCorrection('1-3-001', { stats: { attack: 150 } });
  renderScreen();
  await user.click(await screen.findByRole('button', { name: /^Lugia 1-3-001/ }));
  await user.clear(screen.getByLabelText('Attack'));
  await user.click(screen.getByRole('button', { name: 'Save' }));
  await screen.findByRole('heading', { name: 'Collection' });
  expect((await loadAll()).corrections).toEqual({});
});

it('keeps a second edit on top of an earlier one', async () => {
  const user = userEvent.setup();
  await saveCorrection('1-3-001', { stats: { attack: 150 } });
  renderScreen();
  await user.click(await screen.findByRole('button', { name: /^Lugia 1-3-001/ }));
  await user.type(screen.getByLabelText('HP'), '900');
  await user.click(screen.getByRole('button', { name: 'Save' }));
  await screen.findByRole('heading', { name: 'Collection' });
  expect((await loadAll()).corrections).toEqual({ '1-3-001': { stats: { attack: 150, hp: 900 } } });
});

it('rejects decimals and negatives with an alert', async () => {
  const user = userEvent.setup();
  renderScreen();
  await user.click(await screen.findByRole('button', { name: /^Lugia 1-3-001/ }));
  await user.type(screen.getByLabelText('Attack'), '1.5');
  await user.click(screen.getByRole('button', { name: 'Save' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Attack must be a whole number, 0 or more.');
});

it('moves focus to the editor heading, then back to the tag row', async () => {
  const user = userEvent.setup();
  renderScreen();
  await user.click(await screen.findByRole('button', { name: /^Lugia 1-3-001/ }));
  expect(screen.getByRole('heading', { name: /Lugia/ })).toHaveFocus();
  await user.click(screen.getByRole('button', { name: /Back/ }));
  expect(screen.getByRole('button', { name: /^Lugia 1-3-001/ })).toHaveFocus();
});

it('groups the filter buttons', async () => {
  renderScreen();
  expect(await screen.findByRole('group', { name: 'Show tags' })).toBeInTheDocument();
});

it('keeps the tag editor open when saving fails', async () => {
  const user = userEvent.setup();
  const spy = vi.spyOn(dbModule, 'saveCorrection').mockRejectedValueOnce(new Error('disk full'));
  renderScreen();
  await user.click(await screen.findByRole('button', { name: /^Lugia 1-3-001/ }));
  await user.type(screen.getByLabelText('Attack'), '150');
  await user.click(screen.getByRole('button', { name: 'Save' }));
  await vi.waitFor(() => expect(spy).toHaveBeenCalled());
  await vi.waitFor(() => expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled());
  expect(screen.getByRole('heading', { level: 1, name: /Lugia/ })).toBeInTheDocument();
  expect(screen.getByLabelText('Attack')).toHaveValue(150);
  vi.restoreAllMocks();
});

it('shows a thumbnail in the list for tags with a photo, and offers Add photo in the editor', async () => {
  const user = userEvent.setup();
  await putPhoto('1-3-001', new Blob(['x'], { type: 'image/jpeg' }));
  renderScreen();
  await waitFor(() => expect(document.querySelectorAll('img.tag-thumb')).toHaveLength(1));
  // Decorative: the row's own text already names the tag.
  expect(document.querySelector('img.tag-thumb')).toHaveAttribute('alt', '');
  expect(document.querySelector('img.tag-thumb')).toHaveAttribute('loading', 'lazy');
  expect(document.querySelector('img.tag-thumb')).toHaveAttribute('decoding', 'async');
  expect(screen.queryByRole('img')).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: /^Lugia 1-3-001/ }));
  expect(screen.getByLabelText('Change photo')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Remove photo' })).toBeInTheDocument();
});

it('removes a photo from the editor', async () => {
  const user = userEvent.setup();
  await putPhoto('1-3-001', new Blob(['x'], { type: 'image/jpeg' }));
  renderScreen();
  await user.click(await screen.findByRole('button', { name: /^Lugia 1-3-001/ }));
  await user.click(screen.getByRole('button', { name: 'Remove photo' }));
  expect(await screen.findByLabelText('Add photo')).toBeInTheDocument();
  expect(screen.queryByRole('img')).not.toBeInTheDocument();
});


describe('adding your own tag', () => {
  const open = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(await screen.findByRole('button', { name: 'Add a tag' }));
  };
  const fill = async (user: ReturnType<typeof userEvent.setup>, code = 'X-1', name = 'Homebrew') => {
    await user.type(screen.getByLabelText('Printed code'), code);
    await user.type(screen.getByLabelText('Name'), name);
    await user.selectOptions(screen.getByLabelText('Type'), 'fire');
  };

  it('saves a tag under My tags, stores it, and moves focus to it', async () => {
    const user = userEvent.setup();
    renderScreen();
    await open(user);
    expect(screen.getByRole('heading', { name: 'Add a tag' })).toHaveFocus();
    await fill(user);
    await user.selectOptions(screen.getByLabelText('Second type'), 'water');
    await user.selectOptions(screen.getByLabelText('Grade'), '5');
    await user.type(screen.getByLabelText('Move'), 'Steam Burst');
    await user.selectOptions(screen.getByLabelText('Move type'), 'water');
    await user.selectOptions(screen.getByLabelText('Special move'), 'mega');
    await user.click(screen.getByLabelText('Mythical'));
    await user.click(screen.getByRole('button', { name: 'Save tag' }));
    const row = await screen.findByRole('button', { name: /^Homebrew X-1 · My tags · 5★ · Fire\/Water/ });
    expect(row).toHaveFocus();
    expect(screen.getByRole('combobox', { name: 'Set' })).toHaveValue('my-tags');
    expect(screen.getByText('Owned 0 / 1')).toBeInTheDocument();
    const [tag] = (await loadAll()).customTags;
    expect(tag.id).toMatch(/^my-/);
    expect(tag).toMatchObject({
      printedCode: 'X-1', name: 'Homebrew', grade: 5, types: ['fire', 'water'], mythical: true, legendary: false,
      move: { name: 'Steam Burst', type: 'water' }, gimmick: { kind: 'mega' },
    });
    expect(TAGS.some((t) => t.id === tag.id)).toBe(false);
  });

  it('lets the tag be marked owned', async () => {
    const user = userEvent.setup();
    renderScreen();
    await open(user);
    await fill(user);
    await user.click(screen.getByRole('button', { name: 'Save tag' }));
    await user.click(await screen.findByRole('button', { name: 'Owned: Homebrew X-1, My tags' }));
    expect(await screen.findByText('Owned 1 / 1')).toBeInTheDocument();
    expect((await loadAll()).owned).toHaveLength(1);
  });

  it('announces missing fields and focuses the first one', async () => {
    const user = userEvent.setup();
    renderScreen();
    await open(user);
    await user.click(screen.getByRole('button', { name: 'Save tag' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Enter the printed code');
    expect(screen.getByLabelText('Printed code')).toHaveFocus();
    await user.type(screen.getByLabelText('Printed code'), 'X-1');
    await user.click(screen.getByRole('button', { name: 'Save tag' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Enter the name');
    await user.type(screen.getByLabelText('Name'), 'Homebrew');
    await user.click(screen.getByRole('button', { name: 'Save tag' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Choose at least one type');
    expect(screen.getByLabelText('Type')).toHaveFocus();
    expect((await loadAll()).customTags).toEqual([]);
  });

  it('warns when the code matches an official tag, but still saves', async () => {
    const user = userEvent.setup();
    renderScreen();
    await open(user);
    await user.type(screen.getByLabelText('Printed code'), '1-3-001');
    expect(await screen.findByText(/This code is already in Stardust V3: Lugia — mark that one owned instead\?/)).toBeInTheDocument();
    await user.type(screen.getByLabelText('Name'), 'Fake Lugia');
    await user.selectOptions(screen.getByLabelText('Type'), 'psychic');
    await user.click(screen.getByRole('button', { name: 'Save tag' }));
    await screen.findByRole('button', { name: /^Fake Lugia 1-3-001/ });
    expect((await loadAll()).customTags).toHaveLength(1);
  });

  it('keeps the form open and shows no ghost tag when saving fails', async () => {
    const user = userEvent.setup();
    vi.spyOn(dbModule, 'putCustomTag').mockRejectedValueOnce(new Error('full'));
    renderScreen();
    await open(user);
    await fill(user);
    await user.click(screen.getByRole('button', { name: 'Save tag' }));
    await vi.waitFor(() => expect(screen.getByRole('button', { name: 'Save tag' })).toBeEnabled());
    expect(screen.getByRole('heading', { name: 'Add a tag' })).toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toHaveValue('Homebrew');
    vi.restoreAllMocks();
  });

  it('edits a saved tag with the same form', async () => {
    const user = userEvent.setup();
    renderScreen();
    await open(user);
    await fill(user);
    await user.click(screen.getByRole('button', { name: 'Save tag' }));
    await user.click(await screen.findByRole('button', { name: /^Homebrew X-1/ }));
    expect(screen.getByRole('heading', { name: 'Edit Homebrew' })).toHaveFocus();
    expect(screen.getByLabelText('Add photo')).toBeInTheDocument();
    await user.clear(screen.getByLabelText('Name'));
    await user.type(screen.getByLabelText('Name'), 'Renamed');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByRole('button', { name: /^Renamed X-1/ })).toHaveFocus();
    const data = await loadAll();
    expect(data.customTags).toHaveLength(1);
    expect(data.customTags[0].name).toBe('Renamed');
  });

  async function addAndOpenEdit(user: ReturnType<typeof userEvent.setup>) {
    await open(user);
    await fill(user);
    await user.click(screen.getByRole('button', { name: 'Save tag' }));
    await user.click(await screen.findByRole('button', { name: /^Homebrew X-1/ }));
  }

  it('deletes a tag after confirming, with its owned flag and photo', async () => {
    const user = userEvent.setup();
    renderScreen();
    await addAndOpenEdit(user);
    const id = (await loadAll()).customTags[0].id;
    await setOwned(id, true);
    await putPhoto(id, new Blob(['x'], { type: 'image/png' }));
    await user.click(screen.getByRole('button', { name: 'Delete tag' }));
    expect(await screen.findByText(/Delete Homebrew\?/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Yes, delete' }));
    await screen.findByRole('heading', { name: 'Collection' });
    expect(screen.getByRole('heading', { name: 'Collection' })).toHaveFocus();
    expect(await loadAll()).toMatchObject({ customTags: [], owned: [] });
    expect(await dbModule.getAllPhotos()).toEqual({});
  });

  it('focuses "Yes, delete" when the confirmation opens and "Delete tag" when it closes', async () => {
    const user = userEvent.setup();
    renderScreen();
    await addAndOpenEdit(user);
    await user.click(screen.getByRole('button', { name: 'Delete tag' }));
    expect(screen.getByRole('button', { name: 'Yes, delete' })).toHaveFocus();
    await user.click(screen.getByRole('button', { name: 'Keep it' }));
    expect(screen.getByRole('button', { name: 'Delete tag' })).toHaveFocus();
  });

  it('puts focus back on "Delete tag" when the delete is refused', async () => {
    const user = userEvent.setup();
    await putCustomTag(makeTag('my-fixed', { name: 'Homebrew', printedCode: 'X-1' }));
    await addLogEntry(makeLogEntry({ id: 'p1', teamUsed: ['my-fixed'] }));
    renderScreen();
    await user.selectOptions(await screen.findByRole('combobox', { name: 'Set' }), 'my-tags');
    await user.click(screen.getByRole('button', { name: /^Homebrew X-1/ }));
    await user.click(screen.getByRole('button', { name: 'Delete tag' }));
    await user.click(screen.getByRole('button', { name: 'Yes, delete' }));
    expect(await screen.findByRole('alert')).toHaveTextContent("can't delete");
    expect(screen.getByRole('button', { name: 'Delete tag' })).toHaveFocus();
  });

  it('marks the field in error and ties it to the message, clearing both once it is edited', async () => {
    const user = userEvent.setup();
    renderScreen();
    await open(user);
    await user.click(screen.getByRole('button', { name: 'Save tag' }));
    const code = screen.getByLabelText('Printed code');
    expect(code).toHaveAttribute('aria-invalid', 'true');
    const message = screen.getByText('Enter the printed code from the back of the tag.');
    expect(code).toHaveAttribute('aria-describedby', message.id);
    expect(screen.getByLabelText('Name')).not.toHaveAttribute('aria-invalid');
    await user.type(code, 'X');
    expect(code).not.toHaveAttribute('aria-invalid');
    expect(code).not.toHaveAttribute('aria-describedby');
    expect(screen.queryByText('Enter the printed code from the back of the tag.')).not.toBeInTheDocument();
  });

  it('shows the Move type select only once a move name is entered', async () => {
    const user = userEvent.setup();
    renderScreen();
    await open(user);
    expect(screen.queryByLabelText('Move type')).not.toBeInTheDocument();
    await user.type(screen.getByLabelText('Move'), 'Zap');
    expect(screen.getByLabelText('Move type')).toBeInTheDocument();
    await user.clear(screen.getByLabelText('Move'));
    expect(screen.queryByLabelText('Move type')).not.toBeInTheDocument();
  });

  it('blocks delete while a saved play uses the tag', async () => {
    const user = userEvent.setup();
    await putCustomTag(makeTag('my-fixed', { name: 'Homebrew', printedCode: 'X-1' }));
    await addLogEntry(makeLogEntry({ id: 'p1', teamUsed: ['my-fixed'] }));
    renderScreen();
    await user.selectOptions(await screen.findByRole('combobox', { name: 'Set' }), 'my-tags');
    await user.click(screen.getByRole('button', { name: /^Homebrew X-1/ }));
    await user.click(screen.getByRole('button', { name: 'Delete tag' }));
    await user.click(screen.getByRole('button', { name: 'Yes, delete' }));
    expect(await screen.findByRole('alert')).toHaveTextContent("Used in 1 saved play — can't delete");
    expect(screen.getByRole('heading', { name: 'Edit Homebrew' })).toBeInTheDocument();
    expect((await loadAll()).customTags).toHaveLength(1);
  });
});

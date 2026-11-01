import * as React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TAGS } from '../../data/tags';
import { TagEditor } from './TagEditor';

const lugia = TAGS[0];
const jpeg = new Blob(['jpg'], { type: 'image/jpeg' });
const picture = () => new File(['x'], 'tag.heic', { type: 'image/heic' });

function setup(extra: Partial<React.ComponentProps<typeof TagEditor>> = {}) {
  const onSetPhoto = vi.fn(async (_b: Blob) => true);
  const onRemovePhoto = vi.fn(async () => true);
  render(
    <TagEditor
      tag={lugia}
      shipped={lugia}
      hasCorrection={false}
      onSave={() => {}}
      onReset={() => {}}
      onClose={() => {}}
      onSetPhoto={onSetPhoto}
      onRemovePhoto={onRemovePhoto}
      rasterizer={async () => jpeg}
      {...extra}
    />,
  );
  return { onSetPhoto, onRemovePhoto, user: userEvent.setup() };
}

it('offers grades 1 to 6 and saves a grade of 1 as a correction', async () => {
  const onSave = vi.fn();
  const { user } = setup({ onSave });
  const options = within(screen.getByLabelText('Grade')).getAllByRole('option').map((o) => o.textContent);
  expect(options).toEqual(['unknown', '1★', '2★', '3★', '4★', '5★', '6★']);
  await user.selectOptions(screen.getByLabelText('Grade'), '1');
  await user.click(screen.getByRole('button', { name: 'Save' }));
  expect(onSave).toHaveBeenCalledWith({ grade: 1 });
});

it('offers Add photo, processes the file and hands over the blob', async () => {
  const { user, onSetPhoto } = setup();
  expect(screen.queryByRole('button', { name: 'Remove photo' })).not.toBeInTheDocument();
  const input = screen.getByLabelText('Add photo');
  expect(input).toHaveAttribute('accept', 'image/*');
  await user.upload(input, picture());
  expect(onSetPhoto).toHaveBeenCalledWith(jpeg);
});

it('shows the preview with Change and Remove when a photo exists', async () => {
  const { user, onRemovePhoto } = setup({ photoUrl: 'blob:x' });
  expect(screen.getByRole('img', { name: 'Photo of Lugia' })).toHaveAttribute('src', 'blob:x');
  expect(screen.getByLabelText('Change photo')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Remove photo' }));
  expect(onRemovePhoto).toHaveBeenCalled();
});

it('rejects a non-image with a message and stores nothing', async () => {
  const { onSetPhoto } = setup();
  // applyAccept off: the picker filter is advisory, so the code must check too.
  const u = userEvent.setup({ applyAccept: false });
  await u.upload(screen.getByLabelText('Add photo'), new File(['x'], 'a.txt', { type: 'text/plain' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('not an image');
  expect(onSetPhoto).not.toHaveBeenCalled();
});

it('shows an error when the image cannot be decoded', async () => {
  const { user, onSetPhoto } = setup({ rasterizer: async () => Promise.reject(new Error('bad')) });
  await user.upload(screen.getByLabelText('Add photo'), picture());
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not read that image');
  expect(onSetPhoto).not.toHaveBeenCalled();
});

it('adds no second message when storing fails (the app-wide banner covers it)', async () => {
  const onSetPhoto = vi.fn(async (_b: Blob) => false);
  const { user } = setup({ onSetPhoto });
  await user.upload(screen.getByLabelText('Add photo'), picture());
  await waitFor(() => expect(onSetPhoto).toHaveBeenCalled());
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

it('adds no second message when removing fails', async () => {
  const onRemovePhoto = vi.fn(async () => false);
  const { user } = setup({ photoUrl: 'blob:x', onRemovePhoto });
  await user.click(screen.getByRole('button', { name: 'Remove photo' }));
  await waitFor(() => expect(onRemovePhoto).toHaveBeenCalled());
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

it('says it is processing while the photo is being handled', async () => {
  let finish!: (b: Blob) => void;
  const { user } = setup({ rasterizer: () => new Promise<Blob>((r) => (finish = r)) });
  await user.upload(screen.getByLabelText('Add photo'), picture());
  expect(screen.getByRole('status')).toHaveTextContent('Processing photo…');
  expect(screen.getByLabelText('Add photo')).toBeDisabled();
  finish(jpeg);
  await waitFor(() => expect(screen.getByRole('status')).toBeEmptyDOMElement());
});

it('moves focus to Add photo after the photo is removed', async () => {
  function Host() {
    const [url, setUrl] = React.useState<string | undefined>('blob:x');
    return (
      <TagEditor
        tag={lugia}
        shipped={lugia}
        hasCorrection={false}
        onSave={() => {}}
        onReset={() => {}}
        onClose={() => {}}
        photoUrl={url}
        onSetPhoto={async () => true}
        onRemovePhoto={async () => {
          setUrl(undefined);
          return true;
        }}
      />
    );
  }
  render(<Host />);
  await userEvent.setup().click(screen.getByRole('button', { name: 'Remove photo' }));
  await waitFor(() => expect(screen.getByLabelText('Add photo')).toHaveFocus());
});

import { render, screen } from '@testing-library/react';
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
  const { user, onSetPhoto } = setup();
  // applyAccept off: the picker filter is advisory, so the code must check too.
  const u = userEvent.setup({ applyAccept: false });
  await u.upload(screen.getByLabelText('Add photo'), new File(['x'], 'a.txt', { type: 'text/plain' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('not an image');
  expect(onSetPhoto).not.toHaveBeenCalled();
  void user;
});

it('shows an error when the image cannot be decoded', async () => {
  const { user, onSetPhoto } = setup({ rasterizer: async () => Promise.reject(new Error('bad')) });
  await user.upload(screen.getByLabelText('Add photo'), picture());
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not read that image');
  expect(onSetPhoto).not.toHaveBeenCalled();
});

it('shows an error when storing fails', async () => {
  const { user } = setup({ onSetPhoto: async () => false });
  await user.upload(screen.getByLabelText('Add photo'), picture());
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not save the photo.');
});

import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { PhotoError, processPhoto, type Rasterizer } from '../photo';

type Props = {
  tagName: string;
  /** Object URL of the player's photo of this tag, if any. */
  photoUrl?: string;
  /** Receives the already-downscaled photo; resolves to true when stored. */
  onSetPhoto: (blob: Blob) => Promise<boolean>;
  onRemovePhoto?: () => Promise<boolean>;
  /** Replaces the canvas-based image decoder (tests). */
  rasterizer?: Rasterizer;
};

export function PhotoSection({ tagName, photoUrl, onSetPhoto, onRemovePhoto, rasterizer }: Props) {
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const photoInput = useRef<HTMLInputElement>(null);
  const refocusPhotoInput = useRef(false);

  // The Remove button disappears with the photo; keep keyboard and screen reader users where they were.
  // The input is disabled while busy, so this has to wait until busy ends.
  useEffect(() => {
    if (!photoBusy && refocusPhotoInput.current) {
      refocusPhotoInput.current = false;
      photoInput.current?.focus();
    }
  }, [photoBusy]);

  async function pickPhoto(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setPhotoError(null);
    setPhotoBusy(true);
    try {
      const blob = await processPhoto(file, rasterizer);
      // A storage failure is already reported by the app-wide message; only unreadable images are explained here.
      await onSetPhoto(blob);
    } catch (err) {
      if (err instanceof PhotoError) setPhotoError(err.message);
    } finally {
      setPhotoBusy(false);
    }
  }

  async function removePhoto() {
    if (!onRemovePhoto) return;
    setPhotoError(null);
    setPhotoBusy(true);
    try {
      if (await onRemovePhoto()) refocusPhotoInput.current = true;
    } finally {
      setPhotoBusy(false);
    }
  }

  return (
    <div className="photo-editor">
      {photoUrl && <img className="tag-photo" src={photoUrl} alt={`Photo of ${tagName}`} width={96} />}
      <div className="actions">
        <label className="file-button">
          {photoUrl ? 'Change photo' : 'Add photo'}
          <input ref={photoInput} type="file" accept="image/*" disabled={photoBusy} onChange={pickPhoto} />
        </label>
        {photoUrl && onRemovePhoto && (
          <button type="button" disabled={photoBusy} onClick={removePhoto}>
            Remove photo
          </button>
        )}
      </div>
      <p className="hint" role="status">
        {photoBusy ? 'Processing photo…' : ''}
      </p>
      {photoError && (
        <p className="error" role="alert">
          {photoError}
        </p>
      )}
    </div>
  );
}

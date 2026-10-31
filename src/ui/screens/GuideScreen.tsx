import { useState } from 'react';
import { MECHANICS, OPEN_QUESTIONS } from '../../data/mechanics';
import type { OpenQuestion, Trust } from '../../data/types';
import { TRUST_LABEL } from '../format';
import type { AppStore } from '../useAppData';

const ORDER: Trust[] = ['confirmed', 'player', 'community', 'open'];

function Source({ source }: { source: string }) {
  return source.startsWith('http') ? (
    <a href={source} target="_blank" rel="noreferrer">
      {new URL(source).pathname.split('/').pop() || source}
    </a>
  ) : (
    <span>{source}</span>
  );
}

function AnswerField({ q, initial, onSave }: { q: OpenQuestion; initial: string; onSave: (text: string) => Promise<void> }) {
  const [text, setText] = useState(initial);
  const [saved, setSaved] = useState(false);
  return (
    <div className="question">
      <label>
        {q.question}
        <textarea
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setSaved(false);
          }}
        />
      </label>
      <small>{q.why}</small>
      <div className="actions">
        <button
          type="button"
          onClick={async () => {
            await onSave(text);
            setSaved(true);
          }}
        >
          Save answer
        </button>
        {saved && <span className="saved">Saved</span>}
      </div>
    </div>
  );
}

export function GuideScreen({ store }: { store: AppStore }) {
  return (
    <section>
      <h1>Guide</h1>
      {ORDER.map((trust) => (
        <div key={trust}>
          <h2>{TRUST_LABEL[trust]}</h2>
          {MECHANICS.filter((m) => m.trust === trust).map((m) => (
            <details key={m.id}>
              <summary>
                <strong>{m.title}</strong> <span className={`trust trust-${m.trust}`}>{TRUST_LABEL[m.trust]}</span>
              </summary>
              <p>{m.explanation}</p>
              {m.sources.length > 0 && (
                <p className="sources">
                  Sources:{' '}
                  {m.sources.map((s, i) => (
                    <span key={s}>
                      {i > 0 && ' · '}
                      <Source source={s} />
                    </span>
                  ))}
                </p>
              )}
            </details>
          ))}
        </div>
      ))}
      <h2>Help fill the gaps</h2>
      <p className="hint">Answer what you see at the machine. Answers stay on this phone and go into backups.</p>
      {OPEN_QUESTIONS.map((q) => (
        <AnswerField key={q.id} q={q} initial={store.data.notes[q.id] ?? ''} onSave={(text) => store.saveNote(q.id, text)} />
      ))}
    </section>
  );
}

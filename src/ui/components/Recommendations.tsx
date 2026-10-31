import { useMemo } from 'react';
import type { Tag } from '../../data/types';
import type { Battle } from '../../engine/battleModel';
import { recommend, type Recommendation } from '../../engine/recommend';
import { UNKNOWN_STATS_NOTE } from '../../engine/teamScoring';
import { TRUST_LABEL } from '../format';

type Props = { owned: Tag[]; battle: Battle; onUseTeam?: (rec: Recommendation) => void };

const REMINDERS = [
  'Have a Support Pokémon Ticket? Scan it before placing any tags.',
  'Slide a tag forward to preview the matchup: "It\'s effective!" is what you want.',
  'If "Everyone Attack!" appears, slide all your tags forward.',
];

export function Recommendations({ owned, battle, onUseTeam }: Props) {
  const recs = useMemo(() => recommend(owned, battle), [owned, battle]);
  if (owned.length < 2) {
    return <p className="notice">Mark at least 2 tags as owned in Collection to get a team and battle plan.</p>;
  }
  return (
    <div>
      <ul className="reminders">
        {REMINDERS.map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ul>
      {recs.map((rec, i) => (
        <TeamCard key={rec.team.map((t) => t.id).join('+')} rank={i + 1} rec={rec} onUse={onUseTeam && (() => onUseTeam(rec))} />
      ))}
    </div>
  );
}

function TeamCard({ rank, rec, onUse }: { rank: number; rec: Recommendation; onUse?: () => void }) {
  return (
    <article className="card">
      <h3>{`Team ${rank}: ${rec.team.map((t) => t.name).join(' + ')}`}</h3>
      {/* With a plan, the plan block explains unknown stats once; don't repeat it in the reason line. */}
      <p className="reason">{rec.plan ? rec.reason.replace(UNKNOWN_STATS_NOTE, '') : rec.reason}</p>
      {rec.plan ? (
        <>
          <h4>
            Battle plan {rec.plan.kind === 'ruleOfThumb' && <span className="badge">rule of thumb</span>}
          </h4>
          <ol className="turns">
            {rec.plan.steps.map((s) => (
              <li key={s.turn}>
                <strong>{`Turn ${s.turn}:`}</strong> {`${s.tagName} → ${s.aimAtLabel}${s.isTarget ? ' (target)' : ''}`}
                <br />
                <small>
                  {s.why} <span className={`trust trust-${s.trust}`}>{TRUST_LABEL[s.trust]}</span>
                </small>
              </li>
            ))}
          </ol>
          <p className="comparison">{rec.plan.comparison}</p>
          {rec.plan.kind === 'searched' && rec.plan.usesUnknownStats && (
            <p className="hint">Some stats are unknown, so these numbers are rough estimates.</p>
          )}
        </>
      ) : (
        <p>{rec.team.length >= 2 ? 'No plan found for this team.' : 'Own at least 2 tags to get a battle plan.'}</p>
      )}
      {onUse && (
        <button type="button" className="primary" onClick={onUse}>
          I used this team — log the play
        </button>
      )}
    </article>
  );
}

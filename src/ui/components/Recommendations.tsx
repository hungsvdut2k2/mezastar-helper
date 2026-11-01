import { useMemo } from 'react';
import type { Tag } from '../../data/types';
import { setLabel } from '../../data/setInfo';
import { UNKNOWN_PREFIX, type Battle } from '../../engine/battleModel';
import { recommend, recommendOverCronies, type CronyOdds, type Recommendation } from '../../engine/recommend';
import { UNKNOWN_STATS_NOTE } from '../../engine/teamScoring';
import { TRUST_LABEL } from '../format';
import { OwnershipNote } from './BestTeam';
import { TagCard } from './TagCard';

type Props = {
  owned: Tag[];
  battle: Battle;
  onUseTeam?: (rec: Recommendation) => void;
  /** The player's tag photos (tag id → object URL). */
  photos?: ReadonlyMap<string, string>;
  /**
   * Tags that could fill a blank crony slot (Plan screen). When given, blank cronies are averaged
   * over this pool instead of the neutral stand-in.
   */
  cronyPool?: Tag[];
  /** When teams are picked from every tag: ids the player owns, to say which members are missing. */
  ownedIds?: ReadonlySet<string>;
  /** Overrides the "mark 2 tags as owned" message shown when fewer than 2 candidates exist. */
  tooFewMessage?: string;
};

const REMINDERS = [
  'Have a Support Pokémon Ticket? Scan it before placing any tags.',
  'Slide a tag forward to preview the matchup: "It\'s effective!" is what you want.',
  'If "Everyone Attack!" appears, slide all your tags forward.',
];

const known = (t: Tag) => (t.id.startsWith(UNKNOWN_PREFIX) ? null : t);

export function Recommendations({ owned, battle, onUseTeam, photos, cronyPool, ownedIds, tooFewMessage }: Props) {
  const recs = useMemo(() => {
    const [target, c1, c2] = battle.opponents;
    return cronyPool && battle.targetIndex === 0
      ? recommendOverCronies(owned, target, [known(c1), known(c2)], cronyPool)
      : recommend(owned, battle);
  }, [owned, battle, cronyPool]);
  if (owned.length < 2) {
    return <p className="notice">{tooFewMessage ?? 'Mark at least 2 tags as owned in Collection to get a team and battle plan.'}</p>;
  }
  return (
    <div>
      <ul className="reminders">
        {REMINDERS.map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ul>
      {recs.map((rec, i) => (
        <TeamCard
          key={rec.team.map((t) => t.id).join('+')}
          rank={i + 1}
          rec={rec}
          target={battle.opponents[battle.targetIndex]}
          photos={photos}
          ownedIds={ownedIds}
          onUse={onUseTeam && (() => onUseTeam(rec))}
        />
      ))}
    </div>
  );
}

const pct = (o: CronyOdds) => Math.round((100 * o.wins) / o.pairs);

/** e.g. "Defeats Lugia in 92% of 200 sampled crony pairs (of 2,556 possible from Stardust V3)." */
export function oddsText(o: CronyOdds, target: Tag): string {
  const of = o.pairs === o.totalPairs ? `${o.pairs} possible crony ${o.pairs === 1 ? 'pair' : 'pairs'}` : `${o.pairs} sampled crony pairs (of ${o.totalPairs.toLocaleString('en')} possible)`;
  return `Defeats ${target.name} in ${pct(o)}% of ${of} from ${setLabel(target)}.`;
}

type CardProps = {
  rank: number;
  rec: Recommendation;
  target: Tag;
  photos?: ReadonlyMap<string, string>;
  ownedIds?: ReadonlySet<string>;
  onUse?: () => void;
};

function TeamCard({ rank, rec, target, photos, ownedIds, onUse }: CardProps) {
  return (
    <article className="card">
      <h3>{`Team ${rank}: ${rec.team.map((t) => t.name).join(' + ')}`}</h3>
      <div className="team-grid">
        {rec.team.map((t) => (
          <TagCard key={t.id} tag={t} size="medium" photoUrl={photos?.get(t.id)} />
        ))}
      </div>
      {ownedIds && <OwnershipNote team={rec.team} owned={ownedIds} />}
      {/* With a plan, the plan block explains unknown stats once; don't repeat it in the reason line. */}
      <p className="reason">{rec.plan ? rec.reason.replace(UNKNOWN_STATS_NOTE, '') : rec.reason}</p>
      {rec.plan ? (
        <>
          <h4>
            Battle plan {rec.plan.kind === 'ruleOfThumb' && <span className="badge">rule of thumb</span>}
          </h4>
          <ol className="timeline">
            {rec.plan.steps.map((s) => (
              <li key={s.turn}>
                <span className="turn-no">{`Turn ${s.turn}`}</span>{' '}
                <span className="turn-play">
                  <span aria-hidden="true">▶ </span>
                  {s.tagName} <span className="turn-arrow">→</span> {s.aimAtLabel}
                  {s.isTarget && <span className="turn-target"> (target)</span>}
                </span>
                <small className="turn-why">
                  {s.why} <span className={`trust trust-${s.trust}`}>{TRUST_LABEL[s.trust]}</span>
                </small>
              </li>
            ))}
          </ol>
          <p className="comparison">{rec.plan.comparison}</p>
          {rec.odds && (
            <p className="odds">
              {oddsText(rec.odds, target)} <small className="hint">Every Pokémon in the set counted as equally likely.</small>
            </p>
          )}
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

import { useMemo, useState } from 'react';
import { isInSet, type SetId } from '../../data/setInfo';
import type { Tag } from '../../data/types';
import { bestAllRoundTeams } from '../../engine/bestTeam';
import { TagCard } from './TagCard';

/** The sets the all-round team is picked from (and tested against). */
export const BEST_TEAM_SETS: SetId[] = ['stardust-v1', 'stardust-v2', 'stardust-v3'];

export type Scope = 'all' | 'owned';
const SCOPES: { id: Scope; label: string }[] = [
  { id: 'all', label: 'Every tag' },
  { id: 'owned', label: 'Only my tags' },
];

/** Every tag / Only my tags. */
export function ScopeSwitch({ scope, onChange }: { scope: Scope; onChange: (s: Scope) => void }) {
  return (
    <div className="segmented" role="group" aria-label="Pick from">
      {SCOPES.map((s) => (
        <button key={s.id} type="button" aria-pressed={scope === s.id} onClick={() => onChange(s.id)}>
          {s.label}
        </button>
      ))}
    </div>
  );
}

/** "You own 1 of 3. Missing: …" under a team picked from every tag. */
export function OwnershipNote({ team, owned }: { team: Tag[]; owned: ReadonlySet<string> }) {
  const missing = team.filter((x) => !owned.has(x.id));
  return (
    <p className={missing.length === 0 ? 'hint' : 'notice'}>
      {missing.length === 0
        ? 'You own all of these.'
        : `You own ${team.length - missing.length} of ${team.length}. Missing: ${missing.map((x) => x.name).join(', ')}.`}
    </p>
  );
}

type Props = {
  tags: Tag[];
  ownedIds: readonly string[];
  photos?: ReadonlyMap<string, string>;
};

export function BestTeam({ tags, ownedIds, photos }: Props) {
  const [scope, setScope] = useState<Scope>('all');
  const owned = useMemo(() => new Set(ownedIds), [ownedIds]);
  const pool = useMemo(() => tags.filter((t) => BEST_TEAM_SETS.some((s) => isInSet(t, s))), [tags]);
  const candidates = useMemo(() => (scope === 'all' ? pool : pool.filter((t) => owned.has(t.id))), [scope, pool, owned]);
  const teams = useMemo(() => bestAllRoundTeams(candidates, pool), [candidates, pool]);

  return (
    <section aria-labelledby="best-team-heading">
      <h2 id="best-team-heading">Best all-round team</h2>
      <p className="hint">
        The 3 tags from Stardust V1–V3 that do best against every tag in those sets. Superstars count 3×, Stars 2×.
      </p>
      <ScopeSwitch scope={scope} onChange={setScope} />
      {scope === 'owned' && candidates.length < 2 && (
        <p className="notice">Mark at least 2 Stardust V1–V3 tags as owned in Collection to get your best team.</p>
      )}
      {teams.map((t, i) => {
        return (
          <article className="card" key={t.team.map((x) => x.id).join('+')}>
            <h3>{`Best team ${i + 1}: ${t.team.map((x) => x.name).join(' + ')}`}</h3>
            <div className="team-grid">
              {t.team.map((x) => (
                <TagCard key={x.id} tag={x} size="medium" photoUrl={photos?.get(x.id)} />
              ))}
            </div>
            <p className="reason">
              {`Hits ${t.strongAgainst} of ${t.opponents} tags super effectively (${t.superstarsStrong} of ${t.superstars} Superstars).`}
              {t.weakAgainst > 0 && ` Struggles against ${t.weakAgainst}.`}
            </p>
            {scope === 'all' && <OwnershipNote team={t.team} owned={owned} />}
          </article>
        );
      })}
      {teams[0]?.usesUnknownStats && (
        <p className="hint">Many stats are still unknown and count as average, so this mostly ranks type matchups and special moves. Add stats in Collection to sharpen it.</p>
      )}
    </section>
  );
}

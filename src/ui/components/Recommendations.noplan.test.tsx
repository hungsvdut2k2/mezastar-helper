import { render, screen } from '@testing-library/react';
import { makeTag } from '../../test/factories';
import { Recommendations } from './Recommendations';

vi.mock('../../engine/recommend', () => ({
  recommend: (owned: unknown[]) => [{ team: owned, score: 0, reason: 'r.', usesUnknownStats: false, plan: null }],
}));

it('says no plan was found when a team of 2 or more has no plan', () => {
  const tags = [makeTag('a'), makeTag('b')];
  const o = makeTag('o');
  render(<Recommendations owned={tags} battle={{ opponents: [o, o, o], targetIndex: 0 }} />);
  expect(screen.getByText('No plan found for this team.')).toBeInTheDocument();
});

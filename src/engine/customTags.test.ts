import { makeLogEntry } from '../test/factories';
import { playsUsingTag } from './customTags';

describe('playsUsingTag', () => {
  const base = { boss: 'a', cronies: ['b', 'c'], target: 'a', teamUsed: ['d'], caught: null };
  it('counts a play once wherever the tag appears', () => {
    const log = [
      makeLogEntry({ ...base, id: '1', teamUsed: ['x'] }),
      makeLogEntry({ ...base, id: '2', cronies: ['x', 'c'] }),
      makeLogEntry({ ...base, id: '3', caught: 'x', target: 'x' }),
      makeLogEntry({ ...base, id: '4', turns: [{ attacker: 'd', aimedAt: 'x' }] }),
      makeLogEntry({ ...base, id: '5', turns: [{ attacker: 'd', defeated: 'x' }] }),
      makeLogEntry({ ...base, id: '6' }),
    ];
    expect(playsUsingTag(log, 'x')).toBe(5);
    expect(playsUsingTag(log, 'nothing')).toBe(0);
  });
});

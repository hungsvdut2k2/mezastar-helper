import { TAGS } from '../data/tags';
import { localDate, opponentLabels } from './format';

const byId = (id: string) => TAGS.find((t) => t.id === id)!;

describe('localDate', () => {
  it('uses the local calendar day, not UTC', () => {
    expect(localDate(new Date(2026, 9, 31, 23, 30))).toBe('2026-10-31');
    expect(localDate(new Date(2026, 0, 2, 0, 5))).toBe('2026-01-02');
  });
  it('falls back to the raw text for an unreadable date', () => {
    expect(localDate('garbage-date')).toBe('garbage-da');
  });
});

describe('opponentLabels', () => {
  it('uses plain names when they are all different', () => {
    expect(opponentLabels([byId('1-3-001'), byId('1-3-017'), byId('1-3-041')])).toEqual(['Lugia', 'Pidgeot', 'Koffing']);
  });
  it('labels by slot when a name repeats', () => {
    const p = byId('1-3-017');
    expect(opponentLabels([byId('1-3-001'), p, p])).toEqual(['Boss: Lugia', 'Crony 1: Pidgeot', 'Crony 2: Pidgeot']);
  });
});

it('labels an empty opponent slot as needing an opponent', () => {
  expect(opponentLabels([byId('1-3-001'), null, null])).toEqual(['Lugia', 'Crony 1 (needs opponent)', 'Crony 2 (needs opponent)']);
});

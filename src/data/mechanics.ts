import type { Mechanic, OpenQuestion } from './types';

const HOWTO = 'https://world.pokemonmezastar.com/sg/howto/';
const BATTLE = `${HOWTO}battle.php`;
const CHOOSE = `${HOWTO}choose.php`;
const SUPPORT = 'https://world.pokemonmezastar.com/in/howto/support.php';
const TICKETS = `${HOWTO}about_tickets.php`;
const DYNAMAX = `${HOWTO}dynamax.php`;
const CHAIN = `${HOWTO}chain_attack.php`;
const AFTER = `${HOWTO}after.php`;
const ABOUT_TAG = `${HOWTO}about_tag.php`;
const SET_PAGE = 'https://world.pokemonmezastar.com/sg/tag/33112/';
const SET_LIST = 'https://kitakuji.id/blog/daftar-mezatag-pokemon-mezastar-stardust-version-3/';
const BLOGS = 'Japanese player blogs';

export const MECHANICS: Mechanic[] = [
  { id: 'areas', title: 'Choosing an Area', trust: 'confirmed', sources: [BATTLE],
    explanation: 'You start by choosing an Area. Each Area has different Boss Pokémon.' },
  { id: 'three-opponents', title: 'Boss and cronies', trust: 'confirmed', sources: [BATTLE],
    explanation: 'You face 3 wild Pokémon: the Boss in the middle and a "crony" on each side. The Boss is not always a Star Pokémon.' },
  { id: 'choose-attacker', title: 'Choosing your attacker', trust: 'confirmed', sources: [BATTLE],
    explanation: 'Each turn you slide one Meza Tag forward. That Pokémon attacks this turn.' },
  { id: 'choose-opponent', title: 'Choosing who to hit', trust: 'player', sources: ['Confirmed by the player at the machine, 2026-10-31'],
    explanation: 'You choose which of the 3 opponents your Pokémon attacks each turn.' },
  { id: 'type-matchup', title: 'Type matchups', trust: 'confirmed', sources: [CHOOSE],
    explanation: 'Damage depends heavily on your move type against the opponent\'s type. When you slide a tag forward the machine previews "It\'s effective!", "Hit" or "It\'s not so effective...".' },
  { id: 'speed-order', title: 'Who attacks first', trust: 'confirmed', sources: [CHOOSE],
    explanation: 'The Pokémon with the higher Speed attacks first. A blue divider means you go first, red means the opponent does. A "First Attack Chance" button-mash can flip it.' },
  { id: 'tiredness', title: 'Tiredness', trust: 'player', sources: [CHOOSE, 'Confirmed by the player at the machine, 2026-10-31'],
    explanation: 'A Pokémon that attacked last turn is tired. It can still attack, but it acts later (after the opponent) and loses the Attack Roulette boost. Usually a different tag is better; a much stronger tag can still be worth reusing.' },
  { id: 'attack-roulette', title: 'Attack Roulette and Hit the Buttons', trust: 'confirmed', sources: [BATTLE],
    explanation: 'Your attack power comes from the Attack Roulette or from hitting the buttons. A rainbow result is the maximum.' },
  { id: 'support-pokemon', title: 'Support Pokémon', trust: 'confirmed', sources: [SUPPORT],
    explanation: 'When you defeat an opponent that is not the Boss, it becomes your Support Pokémon from the next turn. After each Attack Roulette, a Support Roulette gives +10 attack or a Support Attack.' },
  { id: 'support-ticket', title: 'Support Pokémon Ticket', trust: 'confirmed', sources: [TICKETS],
    explanation: 'A Support Pokémon Ticket (max 1 per battle) gives you a supporter from the start. Scan it before placing any tags.' },
  { id: 'first-attack-moves', title: 'Special moves on the first attack', trust: 'confirmed', sources: [DYNAMAX, CHAIN, SET_LIST],
    explanation: 'Special moves trigger on a Pokémon\'s first attack: Mega Evolution (1 chance per play), Dynamax (1 per battle), Z-Move (1 per play), Double Move, Chain Attack (up to 3 Pokémon in a row) and TAG Move (two Pokémon on one tag).' },
  { id: 'everyone-attack', title: 'Everyone Attack!', trust: 'confirmed', sources: [BATTLE],
    explanation: '"Everyone Attack!" sometimes happens on the last turn. Slide all your tags forward; your Support Pokémon join in too.' },
  { id: 'catch-time', title: 'Catch Time', trust: 'confirmed', sources: [AFTER, BATTLE],
    explanation: 'Catch Time comes after 3 turns or as soon as you beat the Boss. You get one of the 3 opponents. Damage you dealt fills the Catch Gauge, then a Ball Roulette picks a Poké, Great, Ultra or Master Ball. A Bonus Catch Time (tall grass) can follow.' },
  { id: 'tag-info', title: 'What a tag tells you', trust: 'confirmed', sources: [ABOUT_TAG],
    explanation: 'Each tag shows its grade (2★ to 6★; 5★ is Star and 6★ is Superstar), type, Pokénergy, HP, Attack, Defense, Speed, move and move type.' },
  { id: 'superstars-v3', title: 'Stardust V3 Superstars', trust: 'confirmed', sources: [SET_PAGE],
    explanation: 'Lugia, Ho-Oh, Solgaleo, Lunala, Greninja, Zeraora, Eternatus, Keldeo, Grimmsnarl and Zygarde (1-3-001 to 1-3-010). Stars are 1-3-011 to 1-3-025.' },
  { id: 'machine-stock', title: 'Opponents come from the machine', trust: 'community', sources: [BLOGS],
    explanation: 'The opponents you see are tags physically stocked in that machine, so your Superstar chances depend on the machine.' },
  { id: 'special-tag-battle', title: 'Special Tag Battles', trust: 'community', sources: [BLOGS],
    explanation: 'Superstars seem to appear more often in Special Tag Battles (two machines side by side).' },
  { id: 'crony-first', title: 'Beat the cronies first', trust: 'community', sources: [BLOGS],
    explanation: 'Players report better catches when they defeat the weaker cronies quickly and then attack the Superstar Boss. The app checks this for each battle instead of always following it.' },
  { id: 'catch-now', title: '"Catch now!" mode', trust: 'community', sources: ['Japanese player blog (0 Superstars in 25 plays)'],
    explanation: '"Catch now!" mode rarely gives Superstars.' },
  { id: 'bonus-turn', title: 'Bonus turn after catching', trust: 'community', sources: ['Bulbapedia (Japan machines)'],
    explanation: 'On Japanese machines, catching a Pokémon adds a bonus 4th or 5th turn. Not yet seen on Asia machines.' },
  { id: 'lanes', title: 'Tags per battle', trust: 'open', sources: [],
    explanation: 'How many tags you can place per battle is not confirmed. The app assumes 3.' },
  { id: 'damage-formula', title: 'Exact numbers', trust: 'open', sources: [],
    explanation: 'The exact damage formula, Catch Gauge size and Ball Roulette odds are not published. The app uses estimates.' },
];

export const OPEN_QUESTIONS: OpenQuestion[] = [
  { id: 'lanes', question: 'How many tags can you place in one battle?', why: 'The app assumes 3 when it builds teams.' },
  { id: 'bonus-turn', question: 'On this machine, does catching a Pokémon give you an extra turn?', why: 'If yes, plans could use a 4th turn.' },
  { id: 'immunity', question: 'Does a "No effect" matchup (e.g. a Normal move on a Ghost) do zero damage, or just a little?', why: 'The app currently treats it as zero.' },
  { id: 'support-roulette', question: 'How often does the Support Roulette give a Support Attack instead of +10?', why: 'This sets how much a supporter is worth.' },
  { id: 'catch-gauge', question: 'Does more damage clearly give a better ball?', why: 'The app assumes more damage on your target means a better catch.' },
  { id: 'special-battle', question: 'In Special Tag Battles, how often does a Superstar appear?', why: 'Helps decide which mode to play.' },
];

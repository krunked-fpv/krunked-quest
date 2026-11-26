import { PHYSICS, type HeroFormDef, type HeroFormId } from '../contracts/index';

export const HERO_FORM_DEFS: readonly HeroFormDef[] = [
  {
    id: 'krunk_basic',
    name: 'Base Krunk',
    abilityName: 'Air Stomp & Vault',
    description: 'Agile horned champion wielding Air Stomp, Ground Dash, and upgradable Triple Vault.',
    palette: ['#d42aff', '#9d1cd4', '#5b2a97', '#da0b35', '#fbb7ff', '#030835'],
    wallSlideVelY: PHYSICS.WALL_SLIDE_BASIC,
    defaultUnlocked: true,
  },
  {
    id: 'krunk_fire',
    name: 'Fire Krunk',
    abilityName: 'Flame Rocket Dash',
    description: 'Rockets horizontally at zero gravity, incinerating foes and resetting midair jumps.',
    palette: ['#ff1f1f', '#cf0707', '#ff8a00', '#dc5800', '#ffc082', '#5b0d0d'],
    wallSlideVelY: PHYSICS.WALL_SLIDE_FORM,
    defaultUnlocked: false,
  },
  {
    id: 'krunk_leaf',
    name: 'Leaf Krunk',
    abilityName: 'Canopy Leaf Glide',
    description: 'Unfurls a verdant cape to glide on half gravity and rise effortlessly on wind updrafts.',
    palette: ['#4eff00', '#58d123', '#47872b', '#38582a', '#fbffaa', '#451d49'],
    wallSlideVelY: PHYSICS.WALL_SLIDE_FORM,
    defaultUnlocked: false,
  },
  {
    id: 'krunk_rock',
    name: 'Rock Krunk',
    abilityName: 'Stone Uppercut',
    description: 'Launches straight skyward with basalt fists that shatter overhead stone blocks and foes.',
    palette: ['#ffad16', '#d78b00', '#945f00', '#674200', '#ffe7a1', '#a20ec7'],
    wallSlideVelY: PHYSICS.WALL_SLIDE_FORM,
    defaultUnlocked: false,
  },
  {
    id: 'krunk_electric',
    name: 'Volt Krunk',
    abilityName: 'Volt Dive & Blink',
    description: 'Dives diagonally to lock onto Volt Nodes or enemies and blink-sling through targets.',
    palette: ['#e4ff00', '#dedf00', '#b7b700', '#676800', '#98efff', '#1a4e58'],
    wallSlideVelY: PHYSICS.WALL_SLIDE_FORM,
    defaultUnlocked: false,
  },
  {
    id: 'krunk_shadow',
    name: 'Shadow Krunk',
    abilityName: 'Eclipse Blink',
    description: 'Dark mastery form unlocked after defeating the Nightmare Sovereign: omnidirectional blink and stomp shockwave.',
    palette: ['#1d1220', '#730087', '#ff006a', '#ab0085', '#18c700', '#8678d2'],
    wallSlideVelY: PHYSICS.WALL_SLIDE_FORM,
    defaultUnlocked: false,
  },
] as const;

export const HERO_FORMS_BY_ID: ReadonlyMap<HeroFormId, HeroFormDef> = new Map(
  HERO_FORM_DEFS.map((form) => [form.id, form]),
);

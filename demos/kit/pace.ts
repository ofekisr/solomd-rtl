/** One tempo table for every story; scale TEMPO to speed the whole video up or down. */
const TEMPO = Number(process.env.DEMO_TEMPO ?? '1');

const ms = (base: number): number => Math.round(base * TEMPO);

export const PACE = {
  cardHold: ms(2600),
  cardFade: ms(400),
  captionLead: ms(700),
  stepHold: ms(1400),
  captionFade: ms(300),
  cursorGlide: ms(550),
  cursorSteps: 18,
  beforeClick: ms(180),
  afterClick: ms(450),
  typeDelay: ms(55),
  keyHold: ms(500),
  settle: ms(800),
} as const;

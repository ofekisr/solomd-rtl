/** One tempo table for every story; scale TEMPO to speed the whole video up or down. */
const TEMPO = Number(process.env.DEMO_TEMPO ?? '1');

const ms = (base: number): number => Math.round(base * TEMPO);

export const PACE = {
  cardHold: ms(3200),
  cardFade: ms(400),
  captionLead: ms(1000),
  stepHold: ms(1900),
  captionFade: ms(300),
  cursorGlide: ms(600),
  cursorSteps: 18,
  beforeClick: ms(250),
  afterClick: ms(500),
  typeDelay: ms(60),
  keyHold: ms(600),
  actionHold: ms(1500),
  firstTime: ms(1100),
  settle: ms(900),
} as const;

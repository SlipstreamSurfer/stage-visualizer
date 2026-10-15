// How a crowd dances to a kind of music, and which music gets which way: plain numbers for the crowd's material
// (people.js), set by the world (world.js) from the mood that plays.
//   bounce  how much the knees give on the beat        rock    how far the weight goes from one foot to the other
//   half    the share dancing in half time             jump    how much the room jumps when it goes off
//   chest   of the hands that are not up, the share held in front of the chest, moving on the beat
//   oneArm  of the people with their hands up, the share raising one arm only
export const DANCES = {
  stomp:  { bounce: 1.3,  rock: 0.8, half: 0.12, jump: 1,    chest: 0.05, oneArm: 0.2 },    // peak and hard techno, trance, bass: knees, fists, jumping
  drive:  { bounce: 1,    rock: 0.9, half: 0.3,  jump: 0.25, chest: 0.15, oneArm: 0.55 },   // deep and hypnotic techno: a steady bounce, eyes down, now and then a hand
  groove: { bounce: 1,    rock: 1.3, half: 0.3,  jump: 0.45, chest: 0.3,  oneArm: 0.35 },   // house and open format: bouncy, the arms going along
  sway:   { bounce: 0.3,  rock: 2.3, half: 0.85, jump: 0,    chest: 0.7,  oneArm: 0.8 },    // organic, afro, melodic, deep house: from foot to foot, hands at the chest on the beat, an arm up to the vibe
  still:  { bounce: 0.12, rock: 0.6, half: 0.9,  jump: 0,    chest: 0.25, oneArm: 0.85 },   // concert and ambient: standing, listening
};
const STYLE = {
  stomp: ['techno', 'raw', 'hard', 'harddance', 'trance', 'psytrance', 'dnb', 'dubstep', 'bassclub', 'basshouse', 'trap', 'mainstage', 'brazilianfunk'],
  drive: ['deep', 'hypnotic', 'minimal', 'electro', 'trancedeep', 'deepdubstep'],
  sway: ['organic', 'afro', 'amapiano', 'melodic', 'progressive', 'deephouse', 'electronica', 'downtempo', 'african', 'rnb'],
};
// the way a mood is danced to: by name, or by being music that flows (no kick), else as house
export const danceOf = (key, mood = {}) => mood.flow ? 'still' : Object.keys(STYLE).find(style => STYLE[style].includes(key)) || 'groove';

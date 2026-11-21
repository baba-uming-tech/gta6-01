// Original dialogue and radio lines for VELAMAR's eight jobs. Nothing here references any
// commercial game or character; the voices belong to our own crew.

export const STORY = {
  intro: {
    speaker: 'Nina Salas',
    line: 'Rafa, the docks pay in cash and silence. Keep both hands steady and I will keep you fed.',
  },
  radio: [
    { speaker: 'Radio Marea 88.7', line: 'Golden hour over Velamar, seas calm, traffic heavy on the Costanera.' },
    { speaker: 'Radio Marea 88.7', line: 'That was Sol Bravo, cold and honest, like a morning off the pier.' },
    { speaker: 'Radio Marea 88.7', line: 'PVD scanners are busy tonight. Keep your plates clean, amigos.' },
  ],
  dialogue: {
    1: [
      { speaker: 'Nina Salas', line: 'First run is simple: take my package to the marina before the light goes.' },
      { speaker: 'Rafa Quintero', line: 'Simple jobs are the ones that turn complicated.' },
    ],
    2: [
      { speaker: 'Tuco Bravo', line: 'She needs wheels with no questions. There is a sedan by the old quarter.' },
      { speaker: 'Rafa Quintero', line: 'Keys, or should I improvise?' },
    ],
    3: [
      { speaker: 'Nina Salas', line: 'Park that car where nobody asks questions. Then walk away like you were never here.' },
    ],
    4: [
      { speaker: 'La Vieja', line: 'The debt is not money any more. It is a promise, and he is going to break it.' },
    ],
    5: [
      { speaker: 'Nina Salas', line: 'You made noise. Lose the PVD before they put your face on the evening news.' },
    ],
    6: [
      { speaker: 'Tuco Bravo', line: 'Six checkpoints, one lap, no excuses. My coupe is waiting on the boulevard.' },
    ],
    7: [
      { speaker: 'Nina Salas', line: 'Get the courier to the clinic in one piece. Mena has people on the road.' },
    ],
    8: [
      { speaker: 'Coronel Mena', line: 'Velamar belongs to men who never ask permission. You are not one of them.' },
      { speaker: 'Rafa Quintero', line: 'Then this city is about to learn my name.' },
    ],
  },
  complete: [
    'Package delivered. Nina says you are almost useful.',
    'Tuco owes you a favour. He always pays in petrol.',
    'The car vanished. So did the witnesses.',
    'The debt is settled. La Vieja sends her regards.',
    'You lost the PVD. For tonight, anyway.',
    'Tuco calls it a test drive. You call it a payday.',
    'The courier made it. Mena did not forget.',
    'Mena is finished. Velamar is still ours to win.',
  ],
};

export const MISSION_DIALOGUE = STORY.dialogue;

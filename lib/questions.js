// Hand-written starter questions, so Bluff works even if the Open Trivia DB import fails.
const rows = [
 ['What is a group of flamingos called?', 'A flamboyance'],
 ['What is a group of crows called?', 'A murder'],
 ['What is a group of owls called?', 'A parliament'],
 ['What is the dot over a lowercase i called?', 'A tittle'],
 ['What is the plastic tip on the end of a shoelace called?', 'An aglet'],
 ['What is a baby puffin called?', 'A puffling'],
 ['What is the fear of long words jokingly called?', 'Hippopotomonstrosesquippedaliophobia'],
 ['What color is a polar bear\'s skin?', 'Black'],
 ['What shape is a wombat\'s poop?', 'Cube'],
 ['How many hearts does an octopus have?', 'Three'],
 ['What is the national animal of Scotland?', 'The unicorn'],
 ['What is the smell of rain on dry ground called?', 'Petrichor'],
 ['What was bubble wrap originally meant to be?', 'Wallpaper'],
 ['What is the only mammal capable of true flight?', 'The bat'],
 ['What is a group of porcupines called?', 'A prickle'],
 ['What is the space between your eyebrows called?', 'The glabella'],
 ['What do you call a baby kangaroo?', 'A joey'],
 ['Which planet spins on its side?', 'Uranus'],
 ['What is the metal band that holds a pencil eraser called?', 'A ferrule'],
];
export default rows.map(([question, answer]) => ({ question, answer, source: 'Hand-written' }));

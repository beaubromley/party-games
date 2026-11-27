// Original prompts written for this app, family friendly for ages 10+.
const lines = text => text.trim().split('\n');

// "What everyone else is asked|the only hint the faker gets"
export const ODD = lines(`
Name something you would pack for the beach|Something you pack
Name a food at Thanksgiving dinner|A food
Name something found in a classroom|A thing in a building
Name an animal you might see on a farm|An animal
Name something you do before bed|Something you do
Name a pizza topping|Part of a meal
Name something that is cold|A describing word fits it
Name a sport played with a ball|An activity
Name something in a bathroom|A thing in the house
Name a job that wears a uniform|A job
Name something you take camping|Something you bring along
Name a flavor of ice cream|A flavor
Name something with wheels|A thing that moves
Name a chore you do at home|Something you do
Name a zoo animal|A living thing
Name something you see in the sky|Something you look at
Name a breakfast food|A food
Name a musical instrument|Something you can hold
Name something you wear in winter|Something you wear
Name a holiday|A day
Name something in a grandparent's house|A household thing
Name a fruit|Something you can eat
Name something that makes a loud noise|Something you can hear
Name a board game|Something people do for fun
Name something in a backpack|A small thing
Name a superpower|Something you wish for
Name a place you would go on vacation|A place
Name something you find at a park|Something outdoors
Name a drink|Something in the kitchen
Name something that is round|A shape fits it
Name a bug|A small creature
Name something at a birthday party|Something at a gathering
Name a tool in a garage|A useful thing
Name something that lives in the ocean|A living thing
Name a school subject|Something you learn
Name something you do at a sleepover|Something you do
Name a vegetable|A food
Name something found in a car|A thing you keep somewhere
Name a movie snack|Something you eat
Name a thing you plug in|A household thing
Name something at a football game|Something at an event
Name a dessert|Something you share
Name something soft|Something you can touch
Name a pet|A living thing
Name something in a purse|A small thing
Name a way to travel|A way to do something
Name something that smells good|Something you notice
Name a thing in a refrigerator|Something at home
Name something you see at a farm stand|Something for sale
Name a famous cartoon animal|A character
Name something you would find in a barn|Something in a building
Name a winter activity|Something you do
Name something with buttons|A thing
Name a sandwich ingredient|Part of a meal
Name something that grows|Something outdoors
Name a thing you celebrate with|Something at a gathering
Name something you borrow|A thing
Name a rainy day activity|Something you do
Name something in a toolbox|A small thing
Name a kind of weather|Something that happens
`);

export const SPLIT = lines(`
You can fly, but only ___. Would you?
You get free pizza for life, but ___. Would you take it?
You can talk to animals, but ___. Would you?
You never have to do dishes again, but ___. Deal?
You get a pet dragon, but ___. Would you keep it?
You can read minds, but ___. Would you want it?
You win a million dollars, but ___. Would you accept?
Every day is Saturday, but ___. Would you choose it?
You can be invisible, but ___. Would you?
You get your own theme song, but ___. Would you want it?
You can teleport, but ___. Would you use it?
Dessert comes first at every meal, but ___. Deal?
You get a robot helper, but ___. Would you keep it?
You can breathe underwater, but ___. Would you?
You are famous, but ___. Would you want to be?
You can eat anything and love it, but ___. Would you?
You get to skip every Monday, but ___. Deal?
You can speak every language, but ___. Would you?
You get a free house on the beach, but ___. Would you move in?
You can pause time, but ___. Would you?
You never get tired, but ___. Would you want that?
You get front row seats to everything, but ___. Deal?
You can shrink to the size of a mouse, but ___. Would you?
You become the world's best singer, but ___. Would you?
You get unlimited video games, but ___. Would you take them?
You can control the weather, but ___. Would you?
You get a private jet, but ___. Would you use it?
You are always the funniest person in the room, but ___. Deal?
You can taste colors, but ___. Would you?
You never lose anything again, but ___. Would you agree?
You get to name a new planet, but ___. Would you?
Your room cleans itself, but ___. Deal?
You can jump as high as a house, but ___. Would you?
You get a lifetime of free tacos, but ___. Would you take it?
You can see one day into the future, but ___. Would you?
You become a professional athlete, but ___. Would you?
You get a talking dog, but ___. Would you keep him?
It snows every holiday, but ___. Would you want that?
You can turn anything into chocolate, but ___. Would you?
You get an extra hour every day, but ___. Would you take it?
`);

export const WHOSAID = lines(`
The best thing on the Thanksgiving table is
If I won a million dollars, the first thing I would buy is
My secret talent is
The food I could eat every day is
If I could be any animal, I would be
The chore I dodge the most is
My dream vacation is
The superpower I want is
Something that always makes me laugh is
If I had a boat, I would name it
The last thing I searched for was probably about
My go-to karaoke song would be
The weirdest food combination I enjoy is
When I was little, I wanted to be
My perfect Saturday starts with
I could give a ten minute speech about
The best smell in the world is
If I opened a store, it would sell
I get way too competitive about
The thing I would bring to a desert island is
My least favorite food is
If I were a teacher for a day, I would teach
The best holiday movie is
Something I am surprisingly bad at is
My nickname should be
If I could meet anyone from history, it would be
The first thing I do in the morning is
I would survive a zombie movie by
The best gift I could get right now is
My favorite thing about this family is
If I made the rules, everyone would have to
The snack I hide from others is
I am most likely to fall asleep during
The sport I think I could win is
Something I will never understand is
If my life were a movie, it would be called
The best thing to do on a rainy day is
I am secretly afraid of
The pet I would get if I could is
My favorite memory from this year involves
`);

// "question|right answer|wrong|wrong|wrong"
export const SURVIVAL = lines(`
Which planet is closest to the sun?|Mercury|Venus|Mars|Earth
How many sides does a hexagon have?|Six|Five|Seven|Eight
What is the largest ocean?|Pacific|Atlantic|Indian|Arctic
What do bees make?|Honey|Silk|Milk|Syrup
Which animal is the tallest?|Giraffe|Elephant|Moose|Camel
How many days are in a leap year?|366|365|364|367
What gas do plants take in from the air?|Carbon dioxide|Oxygen|Helium|Hydrogen
What is the capital of Oklahoma?|Oklahoma City|Tulsa|Norman|Stillwater
Who was the first president of the United States?|George Washington|Thomas Jefferson|John Adams|Abraham Lincoln
Which bird is famous for not being able to fly?|Penguin|Eagle|Sparrow|Hummingbird
How many legs does a spider have?|Eight|Six|Ten|Twelve
What is frozen water called?|Ice|Steam|Mist|Dew
Which is the longest river in the United States?|Missouri|Colorado|Ohio|Hudson
What is the hardest natural material?|Diamond|Gold|Iron|Marble
How many players does a baseball team field?|Nine|Seven|Eleven|Ten
What color do you get by mixing blue and yellow?|Green|Purple|Orange|Brown
Which continent is the Sahara Desert on?|Africa|Asia|Australia|South America
How many minutes are in two hours?|120|100|90|200
What is a baby kangaroo called?|Joey|Cub|Kit|Calf
Which instrument has 88 keys?|Piano|Organ pipe|Accordion|Flute
Who built an ark in the Bible?|Noah|Moses|David|Jonah
What is the largest mammal?|Blue whale|Elephant|Hippo|Giraffe
Which state is known as the Lone Star State?|Texas|Arizona|Kansas|Nevada
How many sides does a stop sign have?|Eight|Six|Five|Seven
What part of the plant takes in water from soil?|Roots|Leaves|Petals|Seeds
In which sport do you score a touchdown?|Football|Soccer|Golf|Tennis
What is the freezing point of water in Fahrenheit?|32|0|100|212
Which planet is famous for its rings?|Saturn|Mars|Venus|Mercury
How many strings does a standard guitar have?|Six|Four|Five|Eight
What do you call a group of lions?|Pride|Pack|Herd|Flock
Which ocean is on the east coast of the United States?|Atlantic|Pacific|Indian|Arctic
What is the capital of France?|Paris|London|Rome|Madrid
How many zeros are in one million?|Six|Five|Seven|Nine
What organ pumps blood?|Heart|Lungs|Liver|Stomach
Which holiday is on the fourth Thursday of November?|Thanksgiving|Labor Day|Easter|Veterans Day
What does a caterpillar turn into?|Butterfly or moth|Beetle|Dragonfly|Bee
Which is the smallest prime number?|Two|One|Three|Zero
What is the main ingredient in guacamole?|Avocado|Tomato|Pepper|Pea
Which direction does the sun rise?|East|West|North|South
How many quarters make five dollars?|Twenty|Ten|Fifteen|Twenty-five
What is the tallest mountain above sea level?|Everest|Denali|Kilimanjaro|Fuji
Which animal is known for black and white stripes?|Zebra|Leopard|Panda|Giraffe
What did the Pilgrims' ship go by?|Mayflower|Santa Maria|Endeavour|Beagle
How many teaspoons are in a tablespoon?|Three|Two|Four|Six
Which metal is attracted to a magnet?|Iron|Copper|Aluminum|Gold
What is the largest state by area?|Alaska|Texas|California|Montana
Which season comes after winter?|Spring|Summer|Fall|Monsoon
How many rings are on the Olympic flag?|Five|Four|Six|Seven
What do you call molten rock above ground?|Lava|Magma|Slate|Ash
Which shape has three sides?|Triangle|Square|Circle|Pentagon
`);

// Opening lines for Rhyme Battle: "first line|third line". The player rhymes each.
export const RAP = lines(`
I walked in the kitchen and I smelled that pie|The turkey looked at me with a tear in its eye
My rhymes are so hot that they melt the snow|I move kind of fast while you move real slow
You call that a dance, well it looks like a sneeze|I stay really cool like a summer breeze
I woke up this morning and I fell out of bed|There's a bowl of mashed potatoes sitting on my head
My sneakers are clean and they light up the street|I got so many moves that you can't take a seat
I heard you been bragging that you're good at the game|But when I step up you forget your own name
Grandma's in the house and she's ready to go|She's been cooking up beats on the kitchen stove
You snore like a bear that is stuck in a cave|I surf on the gravy like I'm riding a wave
I got the last roll and I'm keeping it, friend|This battle is the one that you don't want to attend
My dog is a legend and he knows how to rap|You been beaten so bad that you need a nap
I read lots of books and I'm sharp as a tack|You tried to step up but you better step back
The football is flying and the crowd starts to shout|You fumbled your verse and your batteries ran out
I roll through the yard on my brand new bike|Your jokes are so old that they need a hike
I'm the king of the couch with the remote in my hand|You're the quietest member of a one man band
I put syrup on my socks just to make my feet sweet|My flow is so smooth you can skate on the beat
They call me the captain of the cranberry sauce|You can try to compete but you're taking a loss
I came here to rhyme and I came here to win|Your verse is as flat as a soda in a tin
My brain is so big that it needs its own chair|You got gum on your shoe and a leaf in your hair
I fly like a kite on a windy day|You mumble so much nobody knows what you say
I baked a hundred cookies and I didn't share one|By the time you finish rhyming the party is done
My cat is the DJ and she's scratching the track|You went out for a pass and you never came back
I shine like a lamp in the middle of the night|You're scared of a chicken and you run out of fright
When I grab the mic all the windows shake|Your rhymes are as dry as an overbaked cake
I do my own laundry and I fold it up neat|You got two left shoes on your two left feet
Roses are red and the gravy is brown|I got the best rhymes in the whole wide town
I challenged a turkey to a staring contest|He blinked pretty slow but he tried his best
My uncle fell asleep with a plate on his lap|He woke up just in time to hear me rap
I got a golden spoon and a paper crown|You tripped on your lace and you tumbled down
The parade is rolling and the drums are loud|I wave from my float to the cheering crowd
I scored so many points that the scoreboard broke|You tried to tell a joke but nobody spoke
My blanket is a cape and I'm ready to fly|You couldn't win a battle with a butterfly
I took the biggest slice and I'm not even sorry|You ride to the show on a toy sized lorry
I'm smooth like butter on a warm dinner roll|You wiggle like a noodle falling out of the bowl
The leftovers are mine and I wrote my name|I light up the room like a candle flame
I practiced my verses in the shower all week|You open your mouth and you only squeak
My robot does my homework while I count my cash|Your skateboard has no wheels and you're headed for a crash
I got swagger in my slippers when I walk down the hall|You got scared of your own shadow on the wall
They put my face on a stamp and a cereal box|You been wearing the same pair of mismatched socks
I rise like the dough in a bakery pan|I rap so fast that you need a fan
The dog stole the drumstick and ran out the door|I drop one line and they're asking for more
`);

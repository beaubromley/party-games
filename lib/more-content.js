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

// "question|right answer|wrong|wrong|wrong", by difficulty. A game starts gentle and gets harder.
export const SURVIVAL = {
  easy: lines(`
Which planet is closest to the sun?|Mercury|Venus|Mars|Earth
What do bees make?|Honey|Silk|Milk|Syrup
Which animal is the tallest?|Giraffe|Elephant|Moose|Camel
How many days are in a leap year?|366|365|364|367
What gas do plants take in from the air?|Carbon dioxide|Oxygen|Helium|Hydrogen
Which bird is famous for not being able to fly?|Penguin|Eagle|Sparrow|Hummingbird
How many legs does a spider have?|Eight|Six|Ten|Twelve
What is the hardest natural material?|Diamond|Gold|Iron|Marble
How many players does a baseball team field?|Nine|Seven|Eleven|Ten
Which instrument has 88 keys?|Piano|Organ pipe|Accordion|Flute
What is the largest mammal?|Blue whale|Elephant|Hippo|Giraffe
Which state is known as the Lone Star State?|Texas|Arizona|Kansas|Nevada
In which sport do you score a touchdown?|Football|Soccer|Golf|Tennis
What do you call a group of lions?|Pride|Pack|Herd|Flock
Which is the smallest prime number?|Two|One|Three|Zero
What is the main ingredient in guacamole?|Avocado|Tomato|Pepper|Pea
Which direction does the sun rise?|East|West|North|South
How many teaspoons are in a tablespoon?|Three|Two|Four|Six
Which metal is attracted to a magnet?|Iron|Copper|Aluminum|Gold
How many rings are on the Olympic flag?|Five|Four|Six|Seven
`),
  medium: lines(`
What is the capital of Australia?|Canberra|Sydney|Melbourne|Perth
How many bones are in an adult human body?|206|186|226|256
Which planet has the Great Red Spot?|Jupiter|Mars|Saturn|Neptune
What is the chemical symbol for gold?|Au|Ag|Gd|Go
Which country gave the United States the Statue of Liberty?|France|England|Spain|Italy
How many hearts does an octopus have?|Three|One|Two|Eight
What is the capital of Canada?|Ottawa|Toronto|Vancouver|Montreal
In what year did people first walk on the Moon?|1969|1959|1965|1972
What is the largest organ of the human body?|Skin|Liver|Brain|Lungs
Which gas makes up most of Earth's air?|Nitrogen|Oxygen|Carbon dioxide|Hydrogen
How many squares are on a chessboard?|64|48|72|81
What is a group of crows called?|A murder|A parliament|A gaggle|A school
Whose face is on the five dollar bill?|Lincoln|Jefferson|Jackson|Grant
Which state has the most counties?|Texas|Georgia|California|Kansas
Who wrote Charlotte's Web?|E. B. White|Roald Dahl|Beverly Cleary|Dr. Seuss
Which river runs through London?|Thames|Seine|Danube|Tiber
In the Bible, how many days and nights did it rain during the flood?|40|7|12|100
Which of these sea creatures has no brain?|Jellyfish|Octopus|Shark|Seahorse
What does a botanist study?|Plants|Insects|Rocks|Weather
Which tool records earthquakes?|Seismograph|Barometer|Altimeter|Telescope
Which city is home to the University of Oklahoma?|Norman|Stillwater|Tulsa|Edmond
What is Oklahoma's state bird?|Scissor-tailed flycatcher|Cardinal|Western meadowlark|Mockingbird
Which element are diamonds made of?|Carbon|Silicon|Calcium|Iron
What is the smallest state by area?|Rhode Island|Delaware|Connecticut|Vermont
What is the Roman numeral for fifty?|L|C|D|V
Who painted the Mona Lisa?|Leonardo da Vinci|Michelangelo|Raphael|Van Gogh
What is a baby swan called?|Cygnet|Gosling|Duckling|Eaglet
What is the capital of Brazil?|Brasília|Rio de Janeiro|São Paulo|Salvador
What do the angles of a triangle add up to, in degrees?|180|90|270|360
Which planet spins tipped on its side?|Uranus|Neptune|Saturn|Mars
Which language has the most native speakers?|Mandarin Chinese|English|Spanish|Hindi
`),
  hard: lines(`
What is the capital of Missouri?|Jefferson City|St. Louis|Kansas City|Springfield
In what year did Oklahoma become a state?|1907|1889|1912|1896
Which president served the shortest time?|William Henry Harrison|James Garfield|Zachary Taylor|Warren Harding
What is the chemical symbol for potassium?|K|P|Po|Pt
Which planet has the shortest day?|Jupiter|Mercury|Earth|Mars
How many white keys does a standard piano have?|52|48|56|61
Counting polar ones, what is the largest desert in the world?|Antarctic|Sahara|Arctic|Gobi
In the Bible, who lived 969 years?|Methuselah|Noah|Adam|Enoch
Which is the deepest Great Lake?|Superior|Michigan|Ontario|Huron
What is the capital of New Zealand?|Wellington|Auckland|Christchurch|Hamilton
Which country has the most lakes?|Canada|Russia|Finland|United States
In what year did the Titanic sink?|1912|1905|1918|1923
What is a group of owls called?|A parliament|A murder|A pride|A colony
Which organ makes insulin?|Pancreas|Liver|Kidney|Spleen
What is the tallest kind of tree?|Coast redwood|Giant sequoia|Douglas fir|White oak
How many sides does a dodecagon have?|12|10|14|20
What is 17 times 6?|102|96|112|108
Which state has the longest coastline?|Alaska|Florida|California|Hawaii
What is the money of Switzerland called?|Franc|Euro|Krone|Mark
Who created a writing system for the Cherokee language?|Sequoyah|Will Rogers|Jim Thorpe|John Ross
How many compartments does a cow's stomach have?|Four|Two|Three|Seven
What are egg-laying mammals called?|Monotremes|Marsupials|Rodents|Primates
Which was the first state to ratify the Constitution?|Delaware|Virginia|Massachusetts|Pennsylvania
Which mountains are usually seen as dividing Europe from Asia?|Urals|Alps|Pyrenees|Carpathians
Which is the hottest planet?|Venus|Mercury|Mars|Jupiter
How many pounds are in a US ton?|2,000|1,000|2,240|5,000
What is the study of fungi called?|Mycology|Botany|Ecology|Zoology
Which animal has fingerprints much like a human's?|Koala|Sloth|Raccoon|Otter
In what year did World War II end?|1945|1943|1947|1950
In the Bible, who was the first king of Israel?|Saul|David|Solomon|Samuel
What is the capital of Austria?|Vienna|Salzburg|Zurich|Munich
Which blood type can give red cells to anyone?|O negative|AB positive|O positive|A negative
`),
};

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

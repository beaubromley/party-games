// Hand-written Bluff modes (family friendly, ages 10+).
const qa = rows => rows.map(([question, answer]) => ({ question, answer }));
// Hard ones only: the well-known questions were too easy for this crowd.
export const BIBLE = {
  hard: qa([["Which left-handed judge delivered Israel from King Eglon?", "Ehud"], ["What was the name of Moses' father-in-law, the priest of Midian?", "Jethro"], ["Who was chosen by lot to take Judas' place among the apostles?", "Matthias"], ["What young man fell from a third-story window while Paul was preaching?", "Eutychus"], ["What servant girl was so excited to hear Peter at the gate that she left him outside?", "Rhoda"], ["On what island was Paul shipwrecked?", "Malta"], ["Whose ear did Peter cut off in the garden?", "Malchus"], ["Which prophet married a woman named Gomer?", "Hosea"], ["What king of Salem blessed Abram?", "Melchizedek"], ["What Babylonian name was Daniel given?", "Belteshazzar"], ["Which Babylonian ruler saw the writing on the wall?", "Belshazzar"], ["In what valley did the Israelites camp when David faced Goliath?", "The Valley of Elah"], ["What was the name of Jonathan's son who could not walk?", "Mephibosheth"], ["Who was made to carry Jesus' cross?", "Simon of Cyrene"], ["In what city were the disciples first called Christians?", "Antioch"], ["What was the name of Abigail's foolish first husband?", "Nabal"], ["Who became king of Judah at seven years old?", "Joash"], ["Which prophet told David a story about a poor man's lamb?", "Nathan"], ["What was the name of Timothy's grandmother?", "Lois"], ["Which Syrian commander was healed after washing seven times in the Jordan?", "Naaman"], ["What craftsman was chosen to lead the building of the tabernacle?", "Bezalel"], ["On what island was John when he received the vision in Revelation?", "Patmos"], ["What was the name of Moses' wife?", "Zipporah"], ["What was the name of Samson's father?", "Manoah"], ["Which Old Testament book comes right before Habakkuk?", "Nahum"], ["Who was Elisha's greedy servant?", "Gehazi"], ["Which king saw a shadow move backward ten steps as a sign?", "Hezekiah"], ["What did Jacob name the place where he dreamed of a stairway to heaven?", "Bethel"], ["Who was the Roman centurion in Caesarea that Peter visited?", "Cornelius"], ["Which woman judged Israel while sitting under a palm tree?", "Deborah"], ["What runaway servant did Paul write to Philemon about?", "Onesimus"], ["Who was the silversmith who stirred up a riot in Ephesus?", "Demetrius"], ["What was Queen Esther's Hebrew name?", "Hadassah"], ["Who was the first king of the northern kingdom after Israel split?", "Jeroboam"], ["What was the name of the scribe who wrote down Jeremiah's words?", "Baruch"], ["Which king of Bashan was famous for his enormous iron bed?", "Og"], ["How old was Methuselah when he died?", "969 years"], ["Who was the chief servant Abraham expected to be his heir?", "Eliezer"], ["Who defeated the commander Sisera with a tent peg?", "Jael"], ["Which prophet was a shepherd from Tekoa?", "Amos"], ["What seller of purple cloth became a believer in Philippi?", "Lydia"], ["Who was Priscilla's tentmaking husband?", "Aquila"], ["Which king was struck with leprosy for burning incense in the temple?", "Uzziah"], ["Who commanded King David's army?", "Joab"], ["What elderly prophetess recognized the baby Jesus in the temple?", "Anna"], ["What was the name of Ruth and Boaz's son?", "Obed"], ["Which Persian king let the exiles return to rebuild the temple?", "Cyrus"], ["Who was cupbearer to King Artaxerxes before rebuilding Jerusalem's walls?", "Nehemiah"], ["On what mountain did Elijah challenge the prophets of Baal?", "Mount Carmel"], ["What was the name of Hannah's husband?", "Elkanah"], ["What was the name of the high priest who questioned Jesus before the crucifixion?", "Caiaphas"]]),
};
export const WORDS = qa([["flummox", "To confuse completely"], ["gobbledygook", "Language that is wordy and hard to understand"], ["lollygag", "To waste time or dawdle"], ["kerfuffle", "A fuss or commotion"], ["brouhaha", "A noisy, overexcited reaction"], ["nincompoop", "A silly or foolish person"], ["collywobbles", "A nervous, queasy stomach"], ["snollygoster", "A clever person without principles"], ["bumbershoot", "An umbrella"], ["taradiddle", "A small lie"], ["widdershins", "Counterclockwise"], ["absquatulate", "To leave in a hurry"], ["borborygmus", "A rumbling stomach noise"], ["sialoquent", "Spraying spit while talking"], ["pandiculation", "Stretching and yawning, as on waking"], ["defenestrate", "To throw out of a window"], ["ulotrichous", "Having curly or woolly hair"], ["zarf", "A holder for a hot cup"], ["hirsute", "Hairy"], ["lachrymose", "Tearful"], ["jentacular", "Relating to breakfast"], ["susurrus", "A soft whispering or rustling sound"], ["petrichor", "The smell of rain on dry ground"], ["skedaddle", "To run off quickly"], ["bamboozle", "To trick or deceive"], ["gallimaufry", "A jumbled mixture"], ["hodgepodge", "A confused mix of things"], ["mollycoddle", "To pamper too much"], ["rigmarole", "A long, complicated procedure"], ["whippersnapper", "A young, cheeky person"], ["flibbertigibbet", "A flighty, chattering person"], ["cattywampus", "Crooked or askew"], ["discombobulate", "To confuse or upset"], ["lickety-split", "Very quickly"], ["curmudgeon", "A grumpy person"], ["ragamuffin", "A child in ragged clothes"], ["hullabaloo", "A loud commotion"], ["serendipity", "A lucky accidental discovery"], ["gubbins", "Odds and ends or gadgets"], ["wamble", "To rumble or feel queasy in the stomach"]].map(([word, meaning]) => [`What does "${word}" mean?`, meaning]));
export const ABOUT_US = ["What would {name} take to a desert island?", "What is {name}'s dream vacation?", "What food would {name} never get tired of?", "What would {name} do first after winning a million dollars?", "What is {name} secretly really good at?", "What would {name}'s superpower be?", "What would {name} name a pet llama?", "What song would {name} sing at karaoke?", "What is {name} most likely to be late because of?", "What would the title of {name}'s autobiography be?", "What chore does {name} avoid the most?", "What did {name} want to be as a little kid?", "What would {name} order at a drive-thru?", "What makes {name} laugh every time?", "What would {name} never leave the house without?", "What would {name} do with a completely free Saturday?", "What is {name}'s go-to dessert?", "What animal would {name} want as a sidekick?", "What would {name} be famous for?", "What is {name}'s least favorite food?", "What would {name} buy first at a giant garage sale?", "What would {name}'s dream job be?", "What does {name} say way too often?", "What would {name} bring to a potluck?", "What would {name} do if they were invisible for a day?", "What sport would {name} win a medal in?", "What would {name} name their own restaurant?", "What is {name}'s favorite thing about Thanksgiving?", "Where would {name} hide during hide-and-seek?", "What cartoon character is {name} most like?", "What would {name} teach a class about?", "What is {name}'s secret snack?", "What would {name} do if they ran the country for a day?", "What gets {name} out of bed in the morning?", "What would {name} put on a billboard?", "What is {name}'s best dance move called?", "What would {name} collect if money were no object?", "What is the first thing {name} would pack for a trip to the moon?", "What would {name} do if a turkey showed up at the front door?", "What would {name} do first on a snow day?", "What would {name} hide from everyone else at the table?"];

// Extra topics, grouped by difficulty like the Bible set.
export const TOPICS = {
 "thanksgiving": {
  "easy": [
   {
    "question": "What was the name of the ship that carried the Pilgrims in 1620?",
    "answer": "The Mayflower"
   },
   {
    "question": "What is an adult male turkey called?",
    "answer": "A tom"
   },
   {
    "question": "In what month does Canada celebrate Thanksgiving?",
    "answer": "October"
   },
   {
    "question": "What is a young turkey called?",
    "answer": "A poult"
   },
   {
    "question": "What colony did the Pilgrims found in Massachusetts?",
    "answer": "Plymouth"
   },
   {
    "question": "What horn-shaped basket overflowing with food is a harvest symbol?",
    "answer": "A cornucopia"
   },
   {
    "question": "What forked bone do people pull apart to make a wish?",
    "answer": "The wishbone"
   },
   {
    "question": "What tart red berry is made into a classic Thanksgiving sauce?",
    "answer": "Cranberry"
   },
   {
    "question": "On which day of the week does American Thanksgiving fall?",
    "answer": "Thursday"
   },
   {
    "question": "What is the shopping day after Thanksgiving called?",
    "answer": "Black Friday"
   },
   {
    "question": "What orange vegetable fills the most famous Thanksgiving pie?",
    "answer": "Pumpkin"
   },
   {
    "question": "What department store puts on a famous Thanksgiving parade in New York?",
    "answer": "Macy's"
   },
   {
    "question": "What is a female turkey called?",
    "answer": "A hen"
   },
   {
    "question": "What is the sound a male turkey is famous for making?",
    "answer": "A gobble"
   }
  ],
  "medium": [
   {
    "question": "Which president declared a national day of Thanksgiving in 1863?",
    "answer": "Abraham Lincoln"
   },
   {
    "question": "What is the red flap of skin under a turkey's chin called?",
    "answer": "A wattle"
   },
   {
    "question": "Which Wampanoag leader made a treaty with the Pilgrims?",
    "answer": "Massasoit"
   },
   {
    "question": "Which NFL team besides the Cowboys traditionally hosts a Thanksgiving game?",
    "answer": "Detroit Lions"
   },
   {
    "question": "What is a young male turkey called?",
    "answer": "A jake"
   },
   {
    "question": "In what year did the Pilgrims and Wampanoag share their famous harvest feast?",
    "answer": "1621"
   },
   {
    "question": "What Patuxet man helped the Pilgrims learn to plant corn?",
    "answer": "Squanto"
   },
   {
    "question": "What is a group of turkeys often called?",
    "answer": "A rafter"
   },
   {
    "question": "What year did Congress fix Thanksgiving as the fourth Thursday of November by law?",
    "answer": "1941"
   },
   {
    "question": "What agreement did the Pilgrims sign aboard their ship?",
    "answer": "The Mayflower Compact"
   },
   {
    "question": "What state raises the most turkeys?",
    "answer": "Minnesota"
   },
   {
    "question": "What do you call spooning pan juices over a roasting turkey?",
    "answer": "Basting"
   },
   {
    "question": "Which Founding Father praised the turkey as a more respectable bird than the bald eagle?",
    "answer": "Benjamin Franklin"
   },
   {
    "question": "What kitchen tool with a squeeze bulb is used to moisten a turkey?",
    "answer": "A baster"
   },
   {
    "question": "What do you call food saved to eat after the big meal?",
    "answer": "Leftovers"
   },
   {
    "question": "Which early giant balloon cat appeared in the Macy's parade in 1927?",
    "answer": "Felix the Cat"
   }
  ],
  "hard": [
   {
    "question": "What is the fleshy bit that hangs over a turkey's beak called?",
    "answer": "A snood"
   },
   {
    "question": "Which writer of 'Mary Had a Little Lamb' campaigned for a Thanksgiving holiday?",
    "answer": "Sarah Josepha Hale"
   },
   {
    "question": "Who was governor of Plymouth Colony at the 1621 harvest feast?",
    "answer": "William Bradford"
   },
   {
    "question": "In what year was the first Macy's parade held?",
    "answer": "1924"
   },
   {
    "question": "What is the name of the second ship that was meant to sail with the Mayflower?",
    "answer": "The Speedwell"
   },
   {
    "question": "About how many passengers sailed on the Mayflower?",
    "answer": "102"
   },
   {
    "question": "Which president was the first to proclaim a national Thanksgiving under the Constitution?",
    "answer": "George Washington"
   },
   {
    "question": "What is the pouch where a turkey stores food before digestion called?",
    "answer": "The crop"
   },
   {
    "question": "Who was the first governor of Plymouth Colony?",
    "answer": "John Carver"
   },
   {
    "question": "What is the scientific name of the wild turkey?",
    "answer": "Meleagris gallopavo"
   }
  ]
 },
 "music": {
  "easy": [
   {
    "question": "How many keys does a standard piano have?",
    "answer": "88"
   },
   {
    "question": "Who played drums for the Beatles when they became famous?",
    "answer": "Ringo Starr"
   },
   {
    "question": "What brass instrument uses a slide to change notes?",
    "answer": "Trombone"
   },
   {
    "question": "What is the name of Elvis Presley's Memphis home?",
    "answer": "Graceland"
   },
   {
    "question": "How many strings does a standard violin have?",
    "answer": "Four"
   },
   {
    "question": "What do you call a group of singers who perform together?",
    "answer": "A choir"
   },
   {
    "question": "What person waves a baton to lead an orchestra?",
    "answer": "The conductor"
   },
   {
    "question": "What is the largest instrument in the string section of an orchestra?",
    "answer": "Double bass"
   },
   {
    "question": "What band was Paul McCartney famously part of?",
    "answer": "The Beatles"
   },
   {
    "question": "Which singer is known as the King of Pop?",
    "answer": "Michael Jackson"
   },
   {
    "question": "What small four-stringed instrument is closely associated with Hawaii?",
    "answer": "Ukulele"
   },
   {
    "question": "What Nashville show has featured country music on the radio since the 1920s?",
    "answer": "Grand Ole Opry"
   },
   {
    "question": "What instrument do you play by pressing keys and pumping bellows?",
    "answer": "Accordion"
   },
   {
    "question": "What instrument has wooden bars that you strike with mallets?",
    "answer": "Xylophone"
   },
   {
    "question": "What do you call a gentle song that helps a baby fall asleep?",
    "answer": "Lullaby"
   }
  ],
  "medium": [
   {
    "question": "What Italian word means gradually getting louder?",
    "answer": "Crescendo"
   },
   {
    "question": "What ticking device helps musicians keep a steady tempo?",
    "answer": "A metronome"
   },
   {
    "question": "Which country singer started a program that mails free books to children?",
    "answer": "Dolly Parton"
   },
   {
    "question": "How many lines are on a musical staff?",
    "answer": "Five"
   },
   {
    "question": "What Italian word tells a musician to play softly?",
    "answer": "Piano"
   },
   {
    "question": "What symbol raises a note by a half step?",
    "answer": "A sharp"
   },
   {
    "question": "What composer wrote The Four Seasons?",
    "answer": "Antonio Vivaldi"
   },
   {
    "question": "Which singer was known as the Man in Black?",
    "answer": "Johnny Cash"
   },
   {
    "question": "What woodwind instrument usually gives the tuning note to an orchestra?",
    "answer": "Oboe"
   },
   {
    "question": "How many notes are in an octave of the chromatic scale before repeating?",
    "answer": "Twelve"
   },
   {
    "question": "What Austrian composer began writing music at about five years old?",
    "answer": "Mozart"
   },
   {
    "question": "What is singing without instruments called?",
    "answer": "A cappella"
   },
   {
    "question": "What city is known as the home of Motown Records?",
    "answer": "Detroit"
   },
   {
    "question": "What family of instruments does the French horn belong to?",
    "answer": "Brass"
   }
  ],
  "hard": [
   {
    "question": "What do the British call a quarter note?",
    "answer": "A crotchet"
   },
   {
    "question": "What is the term for plucking the strings of a violin?",
    "answer": "Pizzicato"
   },
   {
    "question": "How many strings does a standard concert pedal harp have?",
    "answer": "47"
   },
   {
    "question": "In what Oklahoma city was Garth Brooks born?",
    "answer": "Tulsa"
   },
   {
    "question": "What is the Italian term for very fast tempo, faster than allegro?",
    "answer": "Presto"
   },
   {
    "question": "What composer wrote the Brandenburg Concertos?",
    "answer": "Johann Sebastian Bach"
   },
   {
    "question": "What is the lowest female singing voice called?",
    "answer": "Contralto"
   },
   {
    "question": "What electronic instrument is played without being touched?",
    "answer": "Theremin"
   },
   {
    "question": "What Oklahoma folk singer wrote This Land Is Your Land?",
    "answer": "Woody Guthrie"
   },
   {
    "question": "In what year did MTV begin broadcasting?",
    "answer": "1981"
   },
   {
    "question": "How many symphonies did Beethoven complete?",
    "answer": "Nine"
   },
   {
    "question": "What is the name for the five-line system plus clef where notes are written?",
    "answer": "The staff"
   }
  ]
 },
 "sports": {
  "easy": [
   {
    "question": "How many points is a touchdown worth before the extra point?",
    "answer": "Six"
   },
   {
    "question": "What sport uses a shuttlecock?",
    "answer": "Badminton"
   },
   {
    "question": "What is a perfect score in ten-pin bowling?",
    "answer": "300"
   },
   {
    "question": "How high in feet is an NBA basketball rim?",
    "answer": "Ten"
   },
   {
    "question": "How many players from one team are on the field in soccer?",
    "answer": "Eleven"
   },
   {
    "question": "In what sport do you score a home run?",
    "answer": "Baseball"
   },
   {
    "question": "What color flag does an American football official throw for a penalty?",
    "answer": "Yellow"
   },
   {
    "question": "How many holes are in a standard full round of golf?",
    "answer": "18"
   },
   {
    "question": "What sport is played at Wimbledon?",
    "answer": "Tennis"
   },
   {
    "question": "What do you call a score of zero in tennis?",
    "answer": "Love"
   },
   {
    "question": "What object is hit back and forth in ice hockey?",
    "answer": "A puck"
   },
   {
    "question": "How many bases are on a baseball diamond, counting home plate?",
    "answer": "Four"
   },
   {
    "question": "How many points is a basketball shot from beyond the arc worth?",
    "answer": "Three"
   },
   {
    "question": "What color is the center of an archery target?",
    "answer": "Gold"
   },
   {
    "question": "What machine smooths the ice at a hockey rink?",
    "answer": "Zamboni"
   },
   {
    "question": "How many minutes long is a standard soccer match, not counting added time?",
    "answer": "90"
   },
   {
    "question": "What paddle sport uses a plastic ball with holes in it?",
    "answer": "Pickleball"
   },
   {
    "question": "In what sport would you use the butterfly stroke?",
    "answer": "Swimming"
   },
   {
    "question": "What sport uses a pommel horse?",
    "answer": "Gymnastics"
   }
  ],
  "medium": [
   {
    "question": "Who invented basketball?",
    "answer": "James Naismith"
   },
   {
    "question": "What is one stroke under par called in golf?",
    "answer": "A birdie"
   },
   {
    "question": "What is the name of the NHL championship trophy?",
    "answer": "The Stanley Cup"
   },
   {
    "question": "What do bowlers call three strikes in a row?",
    "answer": "A turkey"
   },
   {
    "question": "What is the area at each end of a football field called?",
    "answer": "The end zone"
   },
   {
    "question": "What trophy is awarded to the Super Bowl champion?",
    "answer": "The Lombardi Trophy"
   },
   {
    "question": "How many rings are on the Olympic flag?",
    "answer": "Five"
   },
   {
    "question": "What is two strokes under par on a golf hole called?",
    "answer": "An eagle"
   },
   {
    "question": "How long in yards is an American football field between goal lines?",
    "answer": "100"
   },
   {
    "question": "What race is known as the Run for the Roses?",
    "answer": "The Kentucky Derby"
   },
   {
    "question": "What do you call it when one bowler's roll knocks down all pins in two tries?",
    "answer": "A spare"
   },
   {
    "question": "What Oklahoma-born athlete won the pentathlon and decathlon in 1912?",
    "answer": "Jim Thorpe"
   },
   {
    "question": "What is the highest possible break in snooker without a free ball?",
    "answer": "147"
   }
  ],
  "hard": [
   {
    "question": "What sport was first called mintonette?",
    "answer": "Volleyball"
   },
   {
    "question": "What did the first basketball games use as hoops?",
    "answer": "Peach baskets"
   },
   {
    "question": "What is three strokes under par on one golf hole called?",
    "answer": "An albatross"
   },
   {
    "question": "In what year were the first modern Olympic Games held?",
    "answer": "1896"
   },
   {
    "question": "In what country did the sport of curling originate?",
    "answer": "Scotland"
   },
   {
    "question": "How many feet is it from the pitching rubber to home plate in Major League Baseball?",
    "answer": "60 feet 6 inches"
   },
   {
    "question": "What is the distance of the NBA free throw line from the backboard in feet?",
    "answer": "15"
   },
   {
    "question": "Who was the first woman to receive a perfect 10 in Olympic gymnastics?",
    "answer": "Nadia Comaneci"
   },
   {
    "question": "What are the three weapons used in Olympic fencing?",
    "answer": "Foil, epee and sabre"
   },
   {
    "question": "What year was the first Super Bowl played?",
    "answer": "1967"
   }
  ]
 },
 "oklahoma": {
  "easy": [
   {
    "question": "In what year did Oklahoma become a state?",
    "answer": "1907"
   },
   {
    "question": "What is Oklahoma's state bird?",
    "answer": "Scissor-tailed flycatcher"
   },
   {
    "question": "What 1930s disaster sent huge clouds of dirt across the Oklahoma Panhandle?",
    "answer": "The Dust Bowl"
   },
   {
    "question": "What cowboy humorist from Oklahoma said he never met a man he didn't like?",
    "answer": "Will Rogers"
   },
   {
    "question": "What is the capital of Oklahoma?",
    "answer": "Oklahoma City"
   },
   {
    "question": "What is Oklahoma's state nickname?",
    "answer": "The Sooner State"
   },
   {
    "question": "What route, called the Mother Road, crosses Oklahoma?",
    "answer": "Route 66"
   },
   {
    "question": "What people jumped the gun and claimed land early?",
    "answer": "Sooners"
   },
   {
    "question": "What animal is Oklahoma's official state mammal?",
    "answer": "American bison"
   },
   {
    "question": "What is Oklahoma's second largest city?",
    "answer": "Tulsa"
   },
   {
    "question": "What river forms Oklahoma's southern border with Texas?",
    "answer": "Red River"
   },
   {
    "question": "What is the long narrow strip in northwest Oklahoma called?",
    "answer": "The Panhandle"
   },
   {
    "question": "What tree is Oklahoma's state tree?",
    "answer": "Redbud"
   },
   {
    "question": "What musical made a song about Oklahoma famous on Broadway in 1943?",
    "answer": "Oklahoma!"
   },
   {
    "question": "What city is home to the University of Oklahoma?",
    "answer": "Norman"
   },
   {
    "question": "What city is home to Oklahoma State University?",
    "answer": "Stillwater"
   }
  ],
  "medium": [
   {
    "question": "What city was Oklahoma's first state capital?",
    "answer": "Guthrie"
   },
   {
    "question": "In what year was the first big Oklahoma Land Run?",
    "answer": "1889"
   },
   {
    "question": "What number state was Oklahoma to join the Union?",
    "answer": "46th"
   },
   {
    "question": "What city is the capital of the Cherokee Nation?",
    "answer": "Tahlequah"
   },
   {
    "question": "Who created the Cherokee syllabary?",
    "answer": "Sequoyah"
   },
   {
    "question": "What was the forced removal of Native nations to Indian Territory called?",
    "answer": "The Trail of Tears"
   },
   {
    "question": "What Oklahoma aviator made the first solo flight around the world?",
    "answer": "Wiley Post"
   },
   {
    "question": "What Yankees slugger was nicknamed the Commerce Comet?",
    "answer": "Mickey Mantle"
   },
   {
    "question": "What is the highest point in Oklahoma?",
    "answer": "Black Mesa"
   },
   {
    "question": "What mountain range in southwest Oklahoma includes Mount Scott?",
    "answer": "The Wichita Mountains"
   },
   {
    "question": "What giant statue of an oil worker stands in Tulsa?",
    "answer": "The Golden Driller"
   },
   {
    "question": "In what year did the state capital move to Oklahoma City?",
    "answer": "1910"
   },
   {
    "question": "What U.S. president signed the proclamation making Oklahoma a state?",
    "answer": "Theodore Roosevelt"
   }
  ],
  "hard": [
   {
    "question": "Which Oklahoma City grocer invented the shopping cart?",
    "answer": "Sylvan Goldman"
   },
   {
    "question": "What street device was first installed in Oklahoma City in 1935?",
    "answer": "The parking meter"
   },
   {
    "question": "Who was Oklahoma's first state governor?",
    "answer": "Charles Haskell"
   },
   {
    "question": "What was the name of Oklahoma's first commercial oil well, drilled at Bartlesville?",
    "answer": "Nellie Johnstone No. 1"
   },
   {
    "question": "What cattle trail through Oklahoma was named for a trader named Jesse?",
    "answer": "Chisholm Trail"
   },
   {
    "question": "What military post on the Grand River was founded in 1824?",
    "answer": "Fort Gibson"
   },
   {
    "question": "What Oklahoman was the first woman principal chief of the Cherokee Nation?",
    "answer": "Wilma Mankiller"
   },
   {
    "question": "What town is home to the Will Rogers Memorial Museum?",
    "answer": "Claremore"
   },
   {
    "question": "What major oil field discovered near Tulsa in 1905 made the city boom?",
    "answer": "Glenn Pool"
   },
   {
    "question": "What astronaut from Weatherford, Oklahoma commanded Apollo 10?",
    "answer": "Thomas Stafford"
   },
   {
    "question": "What was the capital of the Choctaw Nation from the 1880s to statehood?",
    "answer": "Tuskahoma"
   },
   {
    "question": "What Oklahoma ballerina became famous as a prima ballerina of the New York City Ballet?",
    "answer": "Maria Tallchief"
   }
  ]
 },
 "disney": {
  "easy": [
   {
    "question": "What is Miley Stewart's secret pop star identity?",
    "answer": "Hannah Montana"
   },
   {
    "question": "What is the name of Phineas and Ferb's pet platypus?",
    "answer": "Perry"
   },
   {
    "question": "What is the name of the high school in High School Musical?",
    "answer": "East High"
   },
   {
    "question": "What kind of animal is Rufus in Kim Possible?",
    "answer": "Naked mole-rat"
   },
   {
    "question": "What are the first names of the twins in The Suite Life?",
    "answer": "Zack and Cody"
   },
   {
    "question": "What is the last name of Phineas?",
    "answer": "Flynn"
   },
   {
    "question": "What is the name of Phineas and Ferb's older sister?",
    "answer": "Candace"
   },
   {
    "question": "Which sibling in Wizards of Waverly Place is played by Selena Gomez?",
    "answer": "Alex"
   },
   {
    "question": "What can Raven do in That's So Raven?",
    "answer": "See the future"
   },
   {
    "question": "What is the name of the baby sister in Good Luck Charlie?",
    "answer": "Charlie"
   },
   {
    "question": "What musical summer camp gives a Jonas Brothers movie its name?",
    "answer": "Camp Rock"
   },
   {
    "question": "What is the villain Maleficent's daughter called in Descendants?",
    "answer": "Mal"
   }
  ],
  "medium": [
   {
    "question": "What is the name of the hotel where Zack and Cody live?",
    "answer": "The Tipton"
   },
   {
    "question": "What is the last name of the family in Wizards of Waverly Place?",
    "answer": "Russo"
   },
   {
    "question": "What is the name of Kim Possible's best friend and sidekick?",
    "answer": "Ron Stoppable"
   },
   {
    "question": "Who is the evil scientist that Perry the Platypus battles?",
    "answer": "Dr. Doofenshmirtz"
   },
   {
    "question": "Who is the candy counter worker at the Tipton Hotel?",
    "answer": "Maddie Fitzpatrick"
   },
   {
    "question": "What is the name of the hotel manager in The Suite Life?",
    "answer": "Mr. Moseby"
   },
   {
    "question": "What is Kim Possible's computer genius helper called?",
    "answer": "Wade"
   },
   {
    "question": "What is the name of the Russo family's youngest child?",
    "answer": "Max"
   },
   {
    "question": "What town do Phineas and Ferb's adventures take place near?",
    "answer": "Danville"
   },
   {
    "question": "What is the name of the dance show on Shake It Up?",
    "answer": "Shake It Up Chicago"
   },
   {
    "question": "What is the name of the cruise ship in The Suite Life on Deck?",
    "answer": "SS Tipton"
   },
   {
    "question": "Who is Troy Bolton's love interest in High School Musical?",
    "answer": "Gabriella Montez"
   },
   {
    "question": "Who played the title role in Lizzie McGuire?",
    "answer": "Hilary Duff"
   },
   {
    "question": "What is the name of Troy Bolton's school basketball team?",
    "answer": "The Wildcats"
   },
   {
    "question": "What fast-food chain do Kim Possible and Ron love?",
    "answer": "Bueno Nacho"
   },
   {
    "question": "What is the stage name of Lilly when she goes out with Hannah Montana?",
    "answer": "Lola Luftnagle"
   },
   {
    "question": "What is the name of Cody and Zack's mom?",
    "answer": "Carey"
   }
  ],
  "hard": [
   {
    "question": "What is the name of the Russo family's sandwich shop?",
    "answer": "Waverly Sub Station"
   },
   {
    "question": "What is the name of the lizard in Jessie?",
    "answer": "Mrs. Kipling"
   },
   {
    "question": "What is the name of the talking dog in Dog with a Blog?",
    "answer": "Stan"
   },
   {
    "question": "What is the name of Marnie's witch grandmother in Halloweentown?",
    "answer": "Aggie"
   },
   {
    "question": "What is Hannah Montana's brother's name?",
    "answer": "Jackson"
   },
   {
    "question": "What is the name of Raven's little brother?",
    "answer": "Cory"
   },
   {
    "question": "What is Candace Flynn's boyfriend's first name?",
    "answer": "Jeremy"
   },
   {
    "question": "What is the surname of the family in Good Luck Charlie?",
    "answer": "Duncan"
   },
   {
    "question": "What organization does Perry the Platypus work for?",
    "answer": "O.W.C.A."
   },
   {
    "question": "What is the name of Dr. Doofenshmirtz's daughter?",
    "answer": "Vanessa"
   },
   {
    "question": "What is the name of Even Stevens' overachieving older sister?",
    "answer": "Ren"
   }
  ]
 }
};

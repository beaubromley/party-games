// Hand-written Bluff modes (family friendly, ages 10+).
const qa = rows => rows.map(([question, answer]) => ({ question, answer }));
// Grouped by difficulty so every game gets a mix.
export const BIBLE = {
  easy: qa([["What did the dove bring back to Noah?", "An olive leaf"], ["Who climbed a sycamore tree to see Jesus?", "Zacchaeus"], ["Who interpreted Pharaoh's dreams about cows and grain?", "Joseph"], ["What was the name of the garden where Jesus prayed before his arrest?", "Gethsemane"], ["What food did God provide each morning in the wilderness?", "Manna"], ["What job did Matthew have before following Jesus?", "Tax collector"], ["Which queen risked her life to save her people from Haman?", "Esther"], ["What was Paul also called before his missionary journeys?", "Saul"], ["How many smooth stones did David pick up before facing Goliath?", "Five"], ["What animal spoke to Balaam?", "His donkey"], ["Who took over leading the Israelites after Moses?", "Joshua"], ["How many plagues struck Egypt?", "Ten"]]),
  medium: qa([["What did Esau trade his birthright for?", "A bowl of stew"], ["What was the name of Ruth's mother-in-law?", "Naomi"], ["What was the name of King David's father?", "Jesse"], ["What was Sarah's name before God changed it?", "Sarai"], ["What new name was Jacob given?", "Israel"], ["On what mountains did Noah's ark come to rest?", "Ararat"], ["Who was King Solomon's mother?", "Bathsheba"], ["Which prophet anointed both Saul and David as king?", "Samuel"], ["Which prophet went up to heaven in a whirlwind?", "Elijah"], ["What prisoner was released instead of Jesus?", "Barabbas"], ["How many pieces of silver was Judas paid?", "Thirty"], ["What was the name of Isaac's wife?", "Rebekah"], ["Who was Moses' sister?", "Miriam"], ["How many men were left in Gideon's army for the battle?", "Three hundred"]]),
  hard: qa([["Which left-handed judge delivered Israel from King Eglon?", "Ehud"], ["What was the name of Moses' father-in-law, the priest of Midian?", "Jethro"], ["Who was chosen by lot to take Judas' place among the apostles?", "Matthias"], ["What young man fell from a third-story window while Paul was preaching?", "Eutychus"], ["What servant girl was so excited to hear Peter at the gate that she left him outside?", "Rhoda"], ["On what island was Paul shipwrecked?", "Malta"], ["Whose ear did Peter cut off in the garden?", "Malchus"], ["Which prophet married a woman named Gomer?", "Hosea"], ["What king of Salem blessed Abram?", "Melchizedek"], ["What Babylonian name was Daniel given?", "Belteshazzar"], ["Which Babylonian ruler saw the writing on the wall?", "Belshazzar"], ["In what valley did the Israelites camp when David faced Goliath?", "The Valley of Elah"], ["What was the name of Jonathan's son who could not walk?", "Mephibosheth"], ["Who was made to carry Jesus' cross?", "Simon of Cyrene"], ["In what city were the disciples first called Christians?", "Antioch"], ["What was the name of Abigail's foolish first husband?", "Nabal"], ["Who became king of Judah at seven years old?", "Joash"], ["Which prophet told David a story about a poor man's lamb?", "Nathan"], ["What was the name of Timothy's grandmother?", "Lois"], ["Which Syrian commander was healed after washing seven times in the Jordan?", "Naaman"], ["What craftsman was chosen to lead the building of the tabernacle?", "Bezalel"], ["On what island was John when he received the vision in Revelation?", "Patmos"], ["What was the name of Moses' wife?", "Zipporah"], ["What was the name of Samson's father?", "Manoah"], ["Which Old Testament book comes right before Habakkuk?", "Nahum"], ["Who was Elisha's greedy servant?", "Gehazi"], ["Which king saw a shadow move backward ten steps as a sign?", "Hezekiah"], ["What did Jacob name the place where he dreamed of a stairway to heaven?", "Bethel"], ["Who was the Roman centurion in Caesarea that Peter visited?", "Cornelius"], ["Which woman judged Israel while sitting under a palm tree?", "Deborah"], ["What runaway servant did Paul write to Philemon about?", "Onesimus"], ["Who was the silversmith who stirred up a riot in Ephesus?", "Demetrius"], ["What was Queen Esther's Hebrew name?", "Hadassah"], ["Who was the first king of the northern kingdom after Israel split?", "Jeroboam"], ["What was the name of the scribe who wrote down Jeremiah's words?", "Baruch"]]),
};
export const WORDS = qa([["flummox", "To confuse completely"], ["gobbledygook", "Language that is wordy and hard to understand"], ["lollygag", "To waste time or dawdle"], ["kerfuffle", "A fuss or commotion"], ["brouhaha", "A noisy, overexcited reaction"], ["nincompoop", "A silly or foolish person"], ["collywobbles", "A nervous, queasy stomach"], ["snollygoster", "A clever person without principles"], ["bumbershoot", "An umbrella"], ["taradiddle", "A small lie"], ["widdershins", "Counterclockwise"], ["absquatulate", "To leave in a hurry"], ["borborygmus", "A rumbling stomach noise"], ["sialoquent", "Spraying spit while talking"], ["pandiculation", "Stretching and yawning, as on waking"], ["defenestrate", "To throw out of a window"], ["ulotrichous", "Having curly or woolly hair"], ["zarf", "A holder for a hot cup"], ["hirsute", "Hairy"], ["lachrymose", "Tearful"], ["jentacular", "Relating to breakfast"], ["susurrus", "A soft whispering or rustling sound"], ["petrichor", "The smell of rain on dry ground"]].map(([word, meaning]) => [`What does "${word}" mean?`, meaning]));
export const ABOUT_US = ["What would {name} take to a desert island?", "What is {name}'s dream vacation?", "What food would {name} never get tired of?", "What would {name} do first after winning a million dollars?", "What is {name} secretly really good at?", "What would {name}'s superpower be?", "What would {name} name a pet llama?", "What song would {name} sing at karaoke?", "What is {name} most likely to be late because of?", "What would the title of {name}'s autobiography be?", "What chore does {name} avoid the most?", "What did {name} want to be as a little kid?", "What would {name} order at a drive-thru?", "What makes {name} laugh every time?"];

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
   }
  ]
 }
};

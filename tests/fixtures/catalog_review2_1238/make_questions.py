import json, os, sys, collections

OUT = "/home/claude/lantern_office_suite/tests/fixtures/catalog_review2_1238/questions.json"
SHELVES = ["0.1","0.2","0.3","1.1","1.2","2.1","2.2","2.3","3.1","3.2","3.3",
           "4.1","4.2","5.1","5.2","5.3","5.4","5.5","5.6","6.1","6.2","6.3",
           "6.4","7.1","7.2","7.3","8.1","8.2","8.3","8.4","9.1","9.2","9.3","none"]

Q = []
def q(text, shelves, why):
    Q.append({"q": text, "shelf": shelves, "why": why})

# ---- 0.1 Lantern itself ----
q("in lantern how do i save what i typed so its still there tomorrow", ["0.1"], "saving work in Lantern")
q("My grandson put this on a USB stick for me and went back to the city. I am 71. Where do I even begin?", ["0.1"], "getting started; Lantern named only as 'this'")
q("does it work with no internet? we are far out, no signal at all", ["0.1"], "what Lantern needs to run")
q("which tile is the one for spreadsheets", ["0.1","3.2"], "which tile; sheet maker")
q("what can you do", ["0.1"], "Lantern's abilities")
q("I copied the new version onto the stick but the screen still shows the old one", ["0.1"], "updating Lantern")
q("Is the encyclopedia part different from Chat? Which one should I ask about history?", ["0.1"], "how the tiles differ")
q("can the sheet tile do VLOOKUP like in excel", ["0.1","3.2"], "capability of a tile")

# ---- 0.2 encyclopedia ----
q("who was Marie Curie", ["0.2"], "person")
q("When did the Western Roman Empire fall, and why?", ["0.2"], "history")
q("tell me about the old libraries of Timbuktu", ["0.2"], "history of a place")
q("What languages do people speak in Mozambique?", ["0.2"], "fact about a country")
q("Who invent the printing press? Teacher said a German man but I forget the name.", ["0.2"], "inventor, non-native wording")
q("My grandfather fought in the war from 1914 to 1918. What started it?", ["0.2"], "history; years are not a sum")
q("how tall is Kilimanjaro", ["0.2"], "fact about a mountain")
q("who wrote Don Quixote", ["0.2"], "author")
q("What was the Silk Road", ["0.2"], "history")
q("Nelson Mandela - how many years was he in prison?", ["0.2"], "person; number is a fact, not a sum")
q("what happend at chernobyl", ["0.2"], "history, typo")
q("how did the Inca keep their records with no writing", ["0.2"], "history")
q("first man to walk on the moon, who", ["0.2"], "person, history")
q("who discovered penicillin and how", ["0.2"], "history of science")
q("capital of Burkina Faso?", ["0.2"], "fact about a country")

# ---- 0.3 programs ----
q("write me a python script that counts how many times each word shows up in a text file", ["0.3"], "program")
q("My Arduino LED blinks way too fast. In loop() I have digitalWrite HIGH, delay(100), LOW, delay(100). How do I slow it down?", ["0.3"], "code fix")
q("how do i get the computer to do the same thing 100 times without typing it 100 times", ["0.3"], "loops; number not a sum")
q("Explain to my 9 year old what a program is. He thinks the computer is alive.", ["0.3"], "what a program is")
q("javascript function that says if a year is a leap year", ["0.3"], "code, not calendar")
q("TypeError: undefined is not a function -- what does that even mean", ["0.3"], "bug")
q("I have 300 photos and want the computer to rename them all with the date they were taken", ["0.3"], "program asked without saying code")
q("Arduino: when the button on pin 2 is pressed, switch the relay on pin 7 for 5 seconds. Code please.", ["0.3","7.2"], "code for a control circuit")

# ---- 1.1 puzzles ----
q("Three cups upside down, the pea is under the left one. I swap left and middle, then middle and right. Where is the pea?", ["1.1"], "cups moved")
q("die has 3 on top and 2 facing me. i tip it away from me once. whats on top now", ["1.1"], "die rolled")
q("A robot starts facing north. Forward 3, turn right, forward 2, turn right, forward 1. Where does it end up compared to where it started?", ["1.1"], "robot walking")
q("Ana, Ben and Cy live in a red, a blue and a green house. Ana is not in the red one. Ben lives in the green one. Who lives in the blue one?", ["1.1"], "who lives where")
q("On an island knights always tell the truth and knaves always lie. A says 'B is a knave.' B says 'A and I are both knights.' What is each one?", ["1.1"], "knights and liars")
q("Four runners. Tom finished ahead of Sam but behind Lee, and Kim came last. Who came second?", ["1.1"], "race order")
q("I had 7 coins in my left pocket and 2 in my right. I moved 3 from left to right, then moved half of the right pocket back to the left. How many in each pocket?", ["1.1"], "coins moved")
q("toy car is facing east. it turn left, turn left again, then turn right. which way it face now", ["1.1"], "turns tracked, non-native")

# ---- 1.2 clear thinking ----
q("My neighbour says his cousin got sick the day after the injection, so the injection caused it. How should I think about that?", ["1.2"], "cause vs coincidence")
q("lost 5 times in a row at cards so the next one I must win, yes?", ["1.2"], "streaks, gambler's fallacy")
q("Two job offers: one pays more, the other is close to home and my mother. How do I decide?", ["1.2"], "deciding well")
q("advert says 9 out of 10 dentists recommend it. should i believe that", ["1.2"], "numbers that mislead")
q("A man on the radio said thefts in our town went up 200 percent. It was 1 theft last year and 3 this year. Is that a fair way to say it?", ["1.2"], "misleading percent")
q("I dreamed about my aunt and she rang me the next morning. Can that just be chance?", ["1.2"], "coincidence")
q("Everyone in my family says chewing garlic stops malaria. Is that true, and how would we even know?", ["1.2","6.1"], "evidence about a health claim")
q("scientific method in simple words", ["1.2","5.6"], "scientific loop / guess-test-revise")

# ---- 2.1 money ----
q("12 bags of rice at 4.50 each", ["2.1"], "cost of several items")
q("I run a little kiosk. A man bought things for 37.40 and paid with a 50 note, and I think I gave him the wrong change. What should it have been?", ["2.1","4.1"], "making change")
q("Which is cheaper: a 5 kg sack for 9, or 1 kg bags at 2 each?", ["2.1"], "price comparison")
q("Flour is 30 a sack and one sack makes 60 loaves. What should I charge per loaf so I make a little?", ["2.1"], "pricing")
q("my pay comes at different times every month, sometimes nothing. how to budget", ["2.1"], "budget")
q("I borrowed 200 and he wants 5 percent every month. What do I owe after 3 months?", ["2.1","4.1"], "interest")
q("How much I must pay for 7 meter of cloth if one meter is 120", ["2.1"], "cost, non-native")
q("my wife says we spend 2 a day on airtime. over a whole year thats how much", ["2.1"], "money sum, no keyword")

# ---- 2.2 plans ----
q("plan my week - weeding mon and tue, market wed, rest sunday", ["2.2"], "weekly plan")
q("Six families share the one well. Give me a rota so each family has its own day.", ["2.2"], "rota")
q("Goats must be dewormed every 3 months starting in January. Give me the dates for the year.", ["2.2","6.4"], "schedule for animal care")
q("The roof must be fixed before the rains come in 6 weeks. Break it into steps with dates.", ["2.2"], "project plan")
q("timetable for my class, 5 subjects, mornings only, monday to friday", ["2.2"], "timetable")
q("Our wedding is in 3 months and nothing is done. What needs doing when?", ["2.2"], "plan with dates")
q("4 nurses, the ward needs someone day and night all week. who works when?", ["2.2"], "shift roster")
q("keep track of who borrowed which tool from the workshop and when it comes back", ["2.2","3.2"], "record / log sheet")

# ---- 2.3 community ----
q("how do we run a village meeting so the loud ones dont do all the talking", ["2.3"], "fair meeting")
q("Two neighbours are fighting about where the fence line is. Both say their father told them.", ["2.3"], "dispute")
q("A boy is accused of stealing chickens. What is fair to do before anyone punishes him?", ["2.3"], "fair justice")
q("We bought a tractor together, five of us. Need rules for who uses it when and who pays for the diesel.", ["2.3"], "writing simple rules")
q("The spring gives less in the dry season. How do the farms share it fairly?", ["2.3"], "sharing common resources")
q("Half the village wants a school and half wants a clinic. How do we decide without a fight?", ["2.3"], "deciding together")
q("the man who keeps the cooperative money wont show anyone the book and people are angry", ["2.3"], "honest records and trust")
q("Two families both say the brown cow is theirs and each tells a different story. How do we judge whose story holds?", ["2.3","1.2"], "dispute; weighing evidence")

# ---- 3.1 reading and writing ----
q("My daughter is 6 and cannot read yet. Where do I start?", ["3.1"], "teaching reading")
q("there their theyre, which one when", ["3.1"], "words easy to mix up")
q("help me write to the district office, the bridge to our school washed away", ["3.1","3.2"], "letter to officials")
q("Never had a CV. Welder 20 years. Need one for a job at the mine.", ["3.1","3.2"], "CV")
q("My pupils write sentences that go on for half a page with no full stop.", ["3.1"], "run-on sentences")
q("how do u spell necesary i always get it rong", ["3.1"], "spelling strategies, typos")
q("I am 45 and never went to school. Is it too late to learn reading?", ["3.1"], "learning to read; age not a sum")
q("I want learn the English letters for teach my son, how to begin", ["3.1"], "phonics, non-native")

# ---- 3.2 documents, slides, cards, tables ----
q("flashcards for the 7 times table", ["3.2","4.1"], "cards maker")
q("Slides for my talk to the mothers' group tomorrow about washing hands.", ["3.2","6.1"], "slides maker")
q("a table: name, date, amount paid, for our savings group", ["3.2"], "sheet maker")
q("One page notice for the board: clinic closed Friday for staff training.", ["3.2"], "document maker")
q("Turn my notes into a tidy document with headings: fuel low, generator serviced Tuesday, 2 pumps need new seals, order filters.", ["3.2"], "document from notes")
q("cards to learn the capital cities of Africa", ["3.2"], "flashcards, not encyclopedia")
q("Put the store room inventory into a sheet - item, how many, which shelf.", ["3.2"], "sheet maker")
q("minutes of today: 12 present, agreed to fix the pump, next meeting on the 3rd. write it up properly", ["3.2","3.1"], "minutes as a document")

# ---- 3.3 letters, words, codes ----
q("SOS in morse", ["3.3"], "Morse")
q("how many letters in Mississippi", ["3.3"], "letter count")
q("Spell my name the radio way: KOFI", ["3.3"], "NATO alphabet")
q("Uryyb jbeyq - what does this say?", ["3.3"], "ROT13")
q("-.- --- -.. . what is this", ["3.3"], "Morse back to text")
q("My son left a secret note where every letter is moved 3 along: 'khoor'. What does it say?", ["3.3"], "Caesar shift")
q("what is 'Lantern' in base64", ["3.3"], "base64; names Lantern")
q("count the vowels in Lantern Office Suite", ["3.3"], "letter count; names Lantern")

# ---- 4.1 arithmetic etc ----
q("half of three quarters", ["4.1"], "fractions")
q("15% off 80", ["4.1"], "discount percent")
q("Our field is 120 m by 85 m. How many hectares is that?", ["4.1"], "area in hectares")
q("Recipe for 4 people needs 300 g flour. I'm cooking for 10.", ["4.1","6.2"], "scaling a recipe")
q("2000 litre tank, the pump gives 25 litres a minute. how long till full", ["4.1"], "fill time")
q("3x + 7 = 22", ["4.1"], "equation")
q("The foot of the ladder is 1.5 m from the wall and the top reaches 4 m up. How long is the ladder?", ["4.1"], "Pythagoras, no keyword")
q("We are 7 at the table and there are 3 loaves. How much does each person get?", ["4.1"], "sharing / fractions, no keyword")
q("My kid asked why you cannot divide by zero and I had no answer.", ["4.1"], "maths idea, no sum")

# ---- 4.2 units ----
q("how many cups in a litre", ["4.2"], "volume conversion")
q("5 foot 8 in cm", ["4.2"], "length conversion")
q("how many acres in one hectare", ["4.2"], "area conversion")
q("30 psi in bar", ["4.2"], "pressure conversion")
q("American recipe says the oven at 350. Mine is in Celsius.", ["4.2"], "temperature conversion")
q("a stone is how many kilos? the old scale at the shop is in stones", ["4.2"], "weight conversion")
q("convrt 50 mph to km/h", ["4.2"], "speed conversion, typo")
q("Lantern, 12 inches to cm", ["4.2"], "conversion; names Lantern")

# ---- 5.1 forces, energy, motion ----
q("how much force to get a 1200 kg car speeding up at 0.5 m/s2", ["5.1"], "F = m a")
q("Why does a loaded lorry need so much more road to stop than a bicycle?", ["5.1"], "momentum")
q("I am 70 kilo. What is that in newtons?", ["5.1"], "weight in newtons")
q("A 60 kg woman stands on one heel of 1 cm2. What pressure on the floor?", ["5.1"], "pressure")
q("why doesnt the water fall out when I swing the bucket over my head", ["5.1"], "circular motion")
q("time slows down when you go very fast? explain like I'm 12", ["5.1","5.2"], "time dilation")
q("Why do I get thrown forward when the bus brakes hard?", ["5.1"], "inertia, indirect")
q("A stone weighs 2.6 kg and fills 1 litre of space. How dense is it?", ["5.1"], "density")

# ---- 5.2 sky and orbits ----
q("why is it cold in winter when the sun is still up there", ["5.2"], "seasons")
q("ISS is about 400 km up, how long for one lap", ["5.2"], "orbit period")
q("how do I find north at night, no compass", ["5.2"], "direction by stars")
q("I'm 80 kg. What would I weigh on Mars?", ["5.2"], "weight on another planet")
q("Why does February sometimes have 29 days?", ["5.2"], "leap years; number not a sum")
q("bright star in the west just after sunset, is that venus?", ["5.2"], "planets in the sky")
q("If Earth was squashed into a black hole, how small would it be?", ["5.2"], "Schwarzschild radius")
q("My son's school project: why do we always see the same face of the moon?", ["5.2"], "moon")

# ---- 5.3 chemistry ----
q("how much does one mole of table salt weigh", ["5.3"], "molar mass of NaCl")
q("what is pH", ["5.3"], "acids and bases")
q("vinegar plus baking soda fizzes like mad, why", ["5.3"], "acid-base reaction")
q("100 g of water is how many moles", ["5.3"], "moles from grams")
q("is bleach an acid or an alkali", ["5.3"], "acids and bases")
q("atomic mass of iron", ["5.3"], "atomic mass")
q("what do the letters and the little numbers in H2SO4 mean", ["5.3"], "reading a formula")
q("why does ice float on water", ["5.3","5.1"], "states of matter / density")

# ---- 5.4 earth and weather ----
q("Clouds are piling up tall and dark this afternoon. Should I bring the cows in?", ["5.4"], "cloud signs")
q("why does it rain on one side of the mountain and not the other", ["5.4"], "why it rains")
q("The ground shook last night. What do we do if it happens again?", ["5.4"], "earthquake safety")
q("barometer dropped fast this morning", ["5.4"], "pressure and fronts")
q("red sky at night shepherd's delight -- true or old talk?", ["5.4"], "weather signs")
q("The rains are 3 weeks late. What does that usually mean and how do we get ready for drought?", ["5.4"], "monsoon and drought")
q("saw lightning and the thunder came 6 seconds after. how far away is the storm", ["5.4"], "storm safety, sum")
q("Heat wave. Grandma is 90 and we have no fan.", ["5.4","6.1"], "heat safety")

# ---- 5.5 living things ----
q("what is DNA, simple", ["5.5"], "DNA")
q("how do plants eat if they have no mouth", ["5.5"], "photosynthesis")
q("Me and my wife both have brown eyes. How does our son have blue?", ["5.5"], "inheritance")
q("germs - are they alive?", ["5.5"], "microbes")
q("what does the liver do", ["5.5"], "body systems")
q("is a whale a fish", ["5.5"], "classifying")
q("why the leaf is green", ["5.5"], "photosynthesis, non-native")
q("how does one cell become two", ["5.5"], "cells")

# ---- 5.6 patterns ----
q("Why does mould on bread grow slow at first, then cover the whole loaf in a day?", ["5.6"], "growth that feeds on itself")
q("how does a thermostat keep the room the same, is that feedback", ["5.6"], "feedback")
q("they say everything is waves - light, sound, the sea. how is that", ["5.6"], "everything waves")
q("rabbits and foxes go up and down in turns year after year, why", ["5.6","5.5"], "cycles / food chains")
q("If energy never disappears, where does it go when I brake the car?", ["5.6","5.1"], "energy changes clothes")
q("why are written records better than an old man's memory", ["5.6"], "records beat memory")
q("microphone too near the speaker makes a horrible screech. why", ["5.6"], "feedback, indirect")
q("so many things go round in cycles - day, year, tides, seasons. why is that", ["5.6"], "the great cycles")

# ---- 6.1 health and first aid ----
q("my boy cut his hand deep on a sheet of roofing tin and it won't stop bleeding", ["6.1"], "bleeding")
q("how much sugar and salt in 1 litre for the diarrhoea drink", ["6.1"], "ORS recipe")
q("Grandad's face is drooping on one side and his words come out wrong.", ["6.1"], "stroke signs")
q("Chat tile: hot oil from the pan splashed on my arm, what now", ["6.1"], "burn; names a tile")
q("2 year old with a cough, breathing 50 times a minute. Is that too fast?", ["6.1"], "counting breaths; number not a sum")
q("how much paracetamol can i give a 15 kg child", ["6.1"], "a dose: shelf says never a dose")
q("My daughter touched a bare wire and fell down. She is breathing but won't wake up.", ["6.1"], "electric shock, unconscious")
q("Since my husband died I can't sleep and everything feels heavy.", ["6.1"], "grief, indirect")
q("my wife pregnant 7 month, her feet very swell and the headache is strong", ["6.1"], "pregnancy danger signs, non-native")
q("Baby feels hot, the thermometer says 101 F. Is that a fever? What is it in C?", ["6.1","4.2"], "fever plus conversion")
q("I'm a nurse at a small clinic, the power has been out for days. A mother brought a very thin child. How do I check quickly if it is dangerous?", ["6.1"], "arm measurement, story first")

# ---- 6.2 food ----
q("the goat milk goes sour after one day", ["6.2","6.4"], "milk keeping / goats")
q("how to dry mangoes so they last till next season", ["6.2"], "preserving")
q("How long do I cook chicken so it's safe?", ["6.2"], "cooking safely")
q("what can my 9 month old eat", ["6.2"], "feeding babies")
q("cabbage going to waste, how do I keep it for months? someone said salt and a jar", ["6.2"], "fermenting, indirect")
q("Rice cooked yesterday and left on the stove all night. Can we eat it?", ["6.2"], "food safety")
q("We only have beans and maize. Is that enough protein for growing kids?", ["6.2"], "eating well on little")
q("how to keep meat without a fridge", ["6.2","6.1"], "keeping food without a fridge")

# ---- 6.3 safe water ----
q("how many drops of bleach for 20 litres", ["6.3"], "bleach recipe")
q("well water smells like rotten eggs", ["6.3"], "water safety, indirect")
q("Please how I can make water safe for drink, we have no fire for boil", ["6.3"], "treating water, non-native")
q("How far should the pit toilet be from the well?", ["6.3"], "latrine siting")
q("rain off the tin roof, safe to drink?", ["6.3"], "rainwater")
q("family of 5, how much water a day do we need", ["6.3"], "enough water")
q("the stream looks clear, can I drink it straight", ["6.3"], "water safety")
q("kids keep getting tummy aches after drinking from the new borehole", ["6.3","6.1"], "unsafe water, indirect")

# ---- 6.4 farming and animals ----
q("Bed is 4 m by 1.2 m, cabbages 40 cm apart. How many fit?", ["6.4"], "plants in a bed")
q("20 goats for 30 days, 1.5 kg hay each per day", ["6.4"], "feed needed")
q("kale is covered with tiny green bugs and I have no spray", ["6.4"], "natural pest control")
q("My cow she not eat since two days and the belly is big like a drum", ["6.4"], "animal illness, non-native")
q("12 hens, each lays 5 a week", ["6.4"], "eggs per week")
q("The old farmer says our soil is sour and needs lime. What does lime do?", ["6.4","5.3"], "soil acidity")
q("We moved to my late father's farm. The soil is hard as brick and nothing grows well. What can I do?", ["6.4"], "healthy soil, story first")
q("my chikens are sneezing and have bubbly eyes", ["6.4"], "poultry illness, typo")

# ---- 7.1 electrical sums ----
q("12 V battery, 100 Ah - how long will it run a 60 W bulb", ["7.1"], "battery runtime")
q("what resistor for an LED on 5 V at 20 mA", ["7.1"], "Ohm's law")
q("my phone charger gets hot, is that normal", ["7.1"], "electricity named indirectly")
q("two 10 ohm resistors side by side, what do I get", ["7.1"], "parallel resistance")
q("2000 W kettle on 230 V, how many amps", ["7.1"], "current from power")
q("The sticker on the fridge says 220V 1.2A. How much power is that?", ["7.1"], "watts")
q("how many panel I need for run one fridge and 4 bulb", ["7.1"], "off-grid solar, non-native")
q("12 V or 24 V for a small cabin solar setup, which is better", ["7.1"], "batteries and solar; numbers not a sum")

# ---- 7.2 circuits to draw ----
q("how to wire a 3 way swich so the stair light works from top and bottom", ["7.2"], "two-way switching, typo")
q("start/stop station for a motor with a contactor", ["7.2"], "control circuit")
q("LED, resistor and battery - what does it look like on paper", ["7.2"], "schematic without 'draw'")
q("float switch should turn the pump on when the tank is low", ["7.2","8.2"], "control circuit for a pump")
q("555 blinker schematic", ["7.2"], "electronics")
q("ladder logic for a motor that runs forward and reverse but can't do both at once", ["7.2"], "interlocked control")
q("the porch light should come on by itself when someone walks up at night", ["7.2"], "sensor circuit, indirect")
q("In the ELECTRONICS tile: transistor switching a 12 V fan from a 5 V signal", ["7.2"], "electronics; names a tile")

# ---- 7.3 radio and antennas ----
q("how long should a dipole be for 7.1 MHz", ["7.3"], "antenna length")
q("my SWR is 3 to 1, is that bad", ["7.3"], "SWR")
q("wavelength of 145 MHz", ["7.3"], "wavelength")
q("crystal radio with no battery, how", ["7.3"], "simple radio")
q("why do far away AM stations come in only at night", ["7.3"], "propagation")
q("100 nH and 47 pF resonate at what frequency", ["7.3"], "LC resonance")
q("antenna reads 75 + j20 on 50 ohm coax. how bad is it", ["7.3"], "mismatch")
q("how far will walkie talkies reach in hilly country", ["7.3"], "radio range")

# ---- 8.1 hydraulic and pneumatic ----
q("double acting cylinder with a 4/3 valve, show the circuit", ["8.1"], "hydraulic circuit")
q("air cylinder that goes out when I press the button and comes back when I let go", ["8.1"], "pneumatic, no keyword")
q("log splitter ram goes out very slow but the pump sounds fine", ["8.1","8.4"], "hydraulic fault")
q("two cylinders on a press must move together", ["8.1"], "synchronised cylinders")
q("what's the relief valve for on a hydraulic power pack", ["8.1"], "hydraulic component")
q("pneumatic - clamp first, then the drill comes down", ["8.1"], "pneumatic sequence")
q("tractor loader arms sink overnight with the bucket full", ["8.1"], "hydraulic drift, indirect")
q("how does a bottle jack lift a car with just my arm", ["8.1","5.1"], "hydraulic advantage")

# ---- 8.2 pumps and piping ----
q("where to set the float levels in a sump with two pumps", ["8.2"], "wet-well levels")
q("pump runs but no water comes out", ["8.2"], "pump fault")
q("layout for a lift station - two pumps and a high level alarm", ["8.2"], "station")
q("the pipe bangs when I shut the tap quickly", ["8.2"], "water hammer, indirect")
q("need to get water 30 m up the hill from the river", ["8.2"], "pumping lift")
q("every time someone flushes upstairs the shower downstairs goes weak", ["8.2"], "piping, indirect")
q("The motor of the pump is become very hot and stop, then after some time it start again", ["8.2","8.4"], "pump overheating, non-native")
q("does the pumps tile do duty and standby that swap each cycle", ["8.2","0.1"], "pump station; names a tile")

# ---- 8.3 machines, gears, materials ----
q("bike has 42 teeth at the front, 14 at the back - how many turns of the wheel per pedal turn", ["8.3","8.4"], "gear ratio")
q("lever to lift a 200 kg stone, how long does it need to be", ["8.3"], "mechanical advantage")
q("pushing 300 N on a spanner 0.5 m long, what torque", ["8.3","5.1"], "torque")
q("pulleys to lift an engine out of a truck", ["8.3"], "pulleys")
q("what size timber for a shelf 3 m long full of books", ["8.3"], "material strength")
q("the 3-4-5 trick for squaring a foundation, how does it go", ["8.3","4.1"], "building without instruments")
q("what's 'safety factor' mean", ["8.3"], "safety factor")
q("motor pulley 10 cm, machine pulley 30 cm, motor turns 1450 rpm", ["8.3"], "pulley ratio, no question word")

# ---- 8.4 repair ----
q("bycicle chain keeps jumping off", ["8.4"], "bicycle chain, typo")
q("mend a puncture with no patches", ["8.4"], "flat tyre")
q("motorbike won't start on cold mornings", ["8.4"], "engine")
q("blue smoke out the lawnmower", ["8.4"], "engine care")
q("my moto make big noise tak tak tak when I go fast", ["8.4"], "engine noise, non-native")
q("put diesel in the petrol car by mistake", ["8.4"], "fuel safety")
q("strimmer says 50:1, how much oil in 5 litres of petrol", ["8.4","4.1"], "fuel mix ratio")
q("how a four stroke engine works", ["8.4"], "4-stroke")

# ---- 9.1 music ----
q("a song the kids can sing at assembly", ["9.1"], "song")
q("bamboo flute how", ["9.1"], "make an instrument")
q("happy tune in 3/4", ["9.1"], "music maker")
q("why the guitar string goes higher when I press it shorter", ["9.1"], "what sound is")
q("play twinkle twinkle little star", ["9.1"], "known tune")
q("something calm for my baby to fall asleep to", ["9.1"], "lullaby, no music word")
q("Lantern music tile: blues in A", ["9.1"], "music; names a tile")
q("i want song for my son birthday, he is 5", ["9.1"], "song, non-native")

# ---- 9.2 drawings ----
q("a house with a tree next to it", ["9.2"], "drawing without 'draw'")
q("sun going down behind mountains", ["9.2"], "drawing, half sentence")
q("colour wheel for my art class", ["9.2"], "wheel")
q("pie chart of our spending: food 50, rent 30, school 20", ["9.2"], "chart; numbers not a sum")
q("a boat on the sea for my granddaughter's wall", ["9.2"], "picture")
q("a wheel you turn to see which crop to plant each month", ["9.2"], "wheel chart")
q("the parts of a flower, labelled", ["9.2","5.5"], "labelled picture")
q("something for the classroom wall showing the planets in order", ["9.2","5.2"], "picture of planets")

# ---- 9.3 places ----
q("which direction is Mecca from Lagos", ["9.3"], "bearing")
q("what is latitude", ["9.3"], "latitude lesson")
q("how do contour lines work", ["9.3"], "reading a map")
q("where is Timbuktu", ["9.3","0.2"], "place")
q("Paris Texas to Dallas", ["9.3"], "distance, shared name")
q("What is distance between Dakar and Bamako please", ["9.3"], "distance, non-native")
q("Lantern, how far is it from Nairobi to Kampala in miles", ["9.3"], "distance; names Lantern")
q("population of Lagos", ["9.3","0.2"], "PLACE gives population")

# ---- none ----
q("what will maize sell for next week", ["none"], "future price")
q("who won the match last night", ["none"], "news")
q("what is my cousin Peter's phone number", ["none"], "personal fact")
q("weather forecast for Kampala on Friday", ["none"], "forecast needs live data")
q("does my wife still love me", ["none"], "what someone else feels")
q("latest news from the capital", ["none"], "news")
q("dollar to shilling rate today", ["none"], "live exchange rate")
q("what time does the bus leave the market", ["none"], "local timetable")
q("what is my blood group", ["none"], "personal fact")
q("did my son pass his exam", ["none"], "personal fact")
q("when will the power come back on our street", ["none"], "local event")
q("what's the wifi password here", ["none"], "local fact")
q("lottery numbers for Saturday", ["none"], "future")
q("where did I leave my keys", ["none"], "personal")
q("what is my teacher's favourite colour", ["none"], "someone else's mind")
q("how much is a new iphone right now", ["none"], "live price")
q("is the road to town open today after the flood", ["none"], "local news")
q("what does the chief think about the new well", ["none"], "someone else's opinion")
q("how old is my grandmother", ["none"], "personal fact")
q("Lantern, what's my brother's name?", ["none"], "personal fact; names Lantern")
q("is the clinic open sunday", ["none"], "local hours")
q("who will win the election", ["none"], "prediction")
q("has the fertilizer shipment arrived at the coop yet", ["none"], "local event")
q("what is my neighbour planning to plant this year", ["none"], "someone else's plans")
q("how many people are in the queue at the bank right now", ["none"], "live fact")

# ---- checks ----
errors = []
seen = set()
for i, r in enumerate(Q):
    for k in ("q", "why"):
        try:
            r[k].encode("ascii")
        except UnicodeEncodeError:
            errors.append("non-ascii in %d: %r" % (i, r[k]))
    if not (1 <= len(r["shelf"]) <= 3):
        errors.append("bad shelf count %d" % i)
    for s in r["shelf"]:
        if s not in SHELVES:
            errors.append("unknown shelf %s in %d" % (s, i))
    if "none" in r["shelf"] and len(r["shelf"]) > 1:
        errors.append("none mixed %d" % i)
    if len(set(r["shelf"])) != len(r["shelf"]):
        errors.append("dup shelf %d" % i)
    key = r["q"].strip().lower()
    if key in seen:
        errors.append("duplicate question %d" % i)
    seen.add(key)
if errors:
    print("\n".join(errors)); sys.exit(1)

os.makedirs(os.path.dirname(OUT), exist_ok=True)
with open(OUT, "w", encoding="ascii") as f:
    json.dump(Q, f, indent=1, ensure_ascii=True)
    f.write("\n")

data = json.load(open(OUT, encoding="ascii"))
print("total", len(data))
cnt = collections.Counter()
prim = collections.Counter()
multi = 0
for r in data:
    prim[r["shelf"][0]] += 1
    if len(r["shelf"]) > 1:
        multi += 1
    for s in r["shelf"]:
        cnt[s] += 1
print("multi-label", multi)
for s in SHELVES:
    print(s, "primary", prim[s], "any", cnt[s])

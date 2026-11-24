# Writes the catalog router review questions (review 1, 1.24.38).
# Each entry: (question, [shelves], why). Near-misses carry "near-miss:" in why.
import json, os, sys, collections

D = []  # direct questions, grouped by shelf
def add(shelf_list, items):
    for q, sh, why in items:
        D.append({"q": q, "shelf": sh, "why": why})

# ---------- 0.1 Lantern itself ----------
add("0.1", [
 ("what can lantern do", ["0.1"], "about Lantern itself"),
 ("how do i open the spreadsheet tile", ["0.1"], "using a Lantern tile"),
 ("Does this work with no internet? We have no signal out here.", ["0.1"], "Lantern offline use"),
 ("how do I make the writing bigger in lantern, my eyes are not good", ["0.1"], "Lantern settings"),
 ("what tiles are on this usb stick", ["0.1"], "Lantern's tiles"),
 ("can lantern read the answer out loud to me", ["0.1"], "Lantern feature question"),
 ("how do i search the encyclopedia on here", ["0.1"], "how to use Lantern's library"),
 ("is anything i type sent anywhere when I use lantern?", ["0.1"], "Lantern privacy"),
 ("how do I copy lantern onto another usb stick for my cousin", ["0.1"], "copying Lantern"),
])

# ---------- 0.2 encyclopedia ----------
add("0.2", [
 ("what is the capital of Peru", ["0.2"], "encyclopedia fact: capital"),
 ("who wrote Things Fall Apart", ["0.2"], "encyclopedia: author"),
 ("when did the second world war end", ["0.2"], "history date"),
 ("who invented the telephone", ["0.2"], "inventor"),
 ("who was nelson mandela", ["0.2"], "person"),
 ("what year did the berlin wall come down", ["0.2"], "history date"),
 ("what language do they speak in brazil", ["0.2"], "country fact"),
 ("who painted the Mona Lisa", ["0.2"], "art history"),
])

# ---------- 0.3 programs ----------
add("0.3", [
 ("write an arduino sketch that blinks an LED on pin 13 every half second", ["0.3"], "make code"),
 ("write a python program that asks for 5 numbers and prints the average", ["0.3"], "make code"),
 ("what is a loop in programming", ["0.3"], "lesson: loops"),
 ("my program prints the wrong total, how do i find the bug", ["0.3"], "lesson: bugs"),
 ("write a program that prints the 7 times table up to 12", ["0.3"], "make code"),
 ("how do I break a big job into steps a computer can follow", ["0.3"], "lesson: breaking into steps"),
 ("arduino code: when the button on pin 2 is pressed turn on the relay on pin 7", ["0.3"], "make code (Arduino)"),
 ("how does this lantern file actually work inside", ["0.3", "0.1"], "lesson: how this very file works"),
 ("will machines and computers take all our jobs", ["0.3"], "lesson: you and the machines"),
])

# ---------- 1.1 puzzles ----------
add("1.1", [
 ("There are three cups in a row. The coin is under the left cup. I swap the left and middle cups, then the middle and right cups. Where is the coin now?", ["1.1"], "cups and coin moved"),
 ("a robot starts at (0,0) facing north. it goes forward 3, turns right, goes forward 2, turns right, goes forward 5. where is it and which way is it facing", ["1.1"], "robot walking"),
 ("Amy, Ben and Chen live in a red, a blue and a green house. Ben lives in the blue house. Amy does not live in the red house. Who lives in the green house?", ["1.1"], "who lives where"),
 ("On an island knights always tell the truth and knaves always lie. A says: B is a knave. B says: A and I are the same kind. What are A and B?", ["1.1"], "knights and liars"),
 ("five runners. Joe beat Sam, Sam beat Lia, Kofi finished right after Joe, Lia beat Tom. what was the finishing order", ["1.1"], "race order"),
 ("A die has 1 on top and 2 facing me. I tip it forward, away from me, once. What number is on top now?", ["1.1"], "die rolled"),
 ("I put 3 red balls and 2 blue balls in a bag. I take out 1 red, add 2 blue, then take out 1 blue. How many of each colour are in the bag now?", ["1.1", "4.1"], "items tracked through steps"),
 ("Four friends sit in a row. Ana is at the left end. Bo sits next to Ana. Cy is not next to Bo. Where does Dee sit?", ["1.1"], "seating clues"),
 ("a frog is at the bottom of a 10 m well. each day it climbs 3 m and each night it slips back 2 m. on which day does it get out", ["1.1", "4.1"], "step puzzle"),
])

# ---------- 1.2 clear thinking ----------
add("1.2", [
 ("how can i tell if a rumour going round the village is true", ["1.2"], "weighing evidence"),
 ("I got heads 6 times in a row. Is tails more likely next time?", ["1.2", "4.1"], "luck and streaks / chance"),
 ("what is a straw man argument", ["1.2"], "arguments that cheat"),
 ("should I take the job in town or stay on the farm, how do I decide", ["1.2"], "deciding well"),
 ("my uncle says this herb cured his cough so it will work for everyone. is that good evidence?", ["1.2"], "weighing evidence"),
 ("what is confirmation bias", ["1.2"], "thinking traps"),
 ("what is the scientific method, step by step", ["1.2", "5.6"], "scientific loop / guess-test-revise"),
 ("the advert says 9 out of 10 people prefer it. should I believe that", ["1.2"], "numbers that mislead"),
 ("two people on our street got sick after the new phone tower went up. does that prove the tower did it?", ["1.2"], "coincidence vs cause"),
])

# ---------- 2.1 money ----------
add("2.1", [
 ("I need 12 bags of cement at 9.50 each, what is the total", ["2.1"], "cost of several items"),
 ("eggs sell for 15 shillings each. how much for 3 trays of 30?", ["2.1"], "price times quantity"),
 ("my monthly income is 450. rent is 150, food 180, school fees 60. how much is left?", ["2.1"], "budget"),
 ("I bought 6 goats at 80 each and sold them all at 115 each. what is my profit", ["2.1"], "profit sum"),
 ("a sack of maize costs 2400, how much for 7 sacks", ["2.1"], "cost of several items"),
 ("diesel is 1.60 a litre and I use 40 litres a week. what does that cost me in a 4 week month?", ["2.1"], "running cost"),
 ("I earn 15 a day and worked 22 days this month, what should I be paid", ["2.1"], "wages"),
 ("3 metres of cloth at 4.25 a metre and 2 spools of thread at 0.80 each, whats the total", ["2.1"], "shopping total"),
])

# ---------- 2.2 plans ----------
add("2.2", [
 ("make me a weekly chore schedule for the 5 people in our house", ["2.2"], "make a schedule"),
 ("plan a week of maths lessons for my class of 10 year olds", ["2.2"], "make a plan"),
 ("make a plan to build a chicken coop over three weekends", ["2.2", "6.4"], "make a plan; chicken housing"),
 ("make a maintenance schedule for my diesel generator", ["2.2", "8.4"], "schedule; engine care"),
 ("work rota for 4 nurses covering day and night shifts for 7 days", ["2.2"], "make a rota"),
 ("plan for digging a latrine with 6 volunteers, what each person does each day", ["2.2", "6.3"], "make a plan; latrine"),
 ("make a timeline to get our village festival ready in 6 weeks", ["2.2"], "make a timeline"),
 ("plan my study routine, exams are in 4 weeks", ["2.2"], "make a plan"),
 ("make a planting plan for maize, beans and squash this season", ["2.2", "6.4"], "plan; planting"),
])

# ---------- 2.3 community ----------
add("2.3", [
 ("how do we run a village meeting so everyone gets heard", ["2.3"], "running a fair meeting"),
 ("two neighbours are fighting over where the boundary fence goes, how can we settle it", ["2.3"], "settling disputes"),
 ("how should we share the water from the well fairly between 30 families", ["2.3"], "sharing common resources"),
 ("what rights does someone have if they are accused of stealing", ["2.3"], "rights / fair justice"),
 ("how do we write simple rules for our tool library", ["2.3"], "writing simple rules"),
 ("how can a group vote on a decision fairly", ["2.3"], "deciding together"),
 ("how can our cooperative keep records that everybody trusts", ["2.3"], "honest records and trust"),
 ("someone took money from the community fund. what is a fair way to deal with it", ["2.3"], "fair justice"),
 ("how do we decide who gets to graze cattle on the common land", ["2.3"], "sharing common resources"),
])

# ---------- 3.1 reading and writing ----------
add("3.1", [
 ("how do i teach my daughter to read, she is 6", ["3.1"], "teaching someone to read"),
 ("whats the difference between there, their and they're", ["3.1"], "words easy to mix up"),
 ("how do i write a formal letter to the district officer asking for a borehole", ["3.1"], "formal letters / officials"),
 ("how do I write a good paragraph", ["3.1"], "building a paragraph"),
 ("what does the e on the end of cake do", ["3.1"], "magic e"),
 ("where do commas go in a sentence", ["3.1"], "punctuation"),
 ("my son knows every letter sound but cant put them together into words, what do I do", ["3.1"], "blending sounds"),
 ("how do I make my writing easier for people to understand", ["3.1"], "plain language"),
 ("how do I write a CV, I have never made one", ["3.1", "3.2"], "CV lesson; could make the doc"),
])

# ---------- 3.2 documents, slides, cards, tables ----------
add("3.2", [
 ("make flashcards for the 6, 7, 8 and 9 times tables", ["3.2"], "make flashcards"),
 ("make slides about washing hands for a talk at the school", ["3.2"], "make slides"),
 ("make a table for my 10 goats with columns for name, age and weight", ["3.2"], "make a table"),
 ("make a spreadsheet to track my shop sales for each day of the week", ["3.2"], "make a sheet"),
 ("make flashcards of African countries and their capitals", ["3.2"], "make flashcards"),
 ("create a sign up sheet for vaccination day with name, age and village", ["3.2"], "make a sheet"),
 ("make a short presentation on solar power for the village council", ["3.2"], "make slides"),
 ("make a table of the planets and how far each one is from the sun", ["3.2", "5.2"], "make a table; planet data"),
])

# ---------- 3.3 letters, words, codes ----------
add("3.3", [
 ("spell lantern backwards", ["3.3"], "REVERSE"),
 ("how many letters are in Mississippi", ["3.3"], "LEN"),
 ("what is HELLO in morse code", ["3.3"], "MORSE"),
 ("decode this morse: .... . .-.. .--.", ["3.3"], "UNMORSE"),
 ("spell KOFI in the radio alphabet", ["3.3"], "NATO"),
 ("encode meet at noon with a caesar shift of 3", ["3.3"], "CAESAR"),
 ("what is the base64 of hello world", ["3.3"], "BASE64"),
 ("take all the vowels out of banana bread", ["3.3"], "REMOVE"),
 ("sha256 of the word lantern", ["3.3"], "SHA256"),
])

# ---------- 4.1 arithmetic etc ----------
add("4.1", [
 ("what is 3/4 plus 2/3", ["4.1"], "adding fractions"),
 ("what is 15% of 240", ["4.1"], "percent of a number"),
 ("solve 3x + 7 = 22", ["4.1"], "two-step equation"),
 ("my room is 4.5 m by 3.2 m, what is the floor area", ["4.1"], "area"),
 ("how much fuel for a 350 km trip if my truck does 12 km per litre", ["4.1"], "fuel recipe card"),
 ("a recipe for 4 people needs 300 g of flour. how much for 10 people?", ["4.1"], "recipe scaling card"),
 ("how long to fill a 2000 litre tank at 25 litres a minute", ["4.1"], "tank fill card"),
 ("my field is 120 m by 85 m, how many hectares is that", ["4.1", "4.2"], "field area card; m2 to ha"),
 ("the two short sides of a right triangle are 6 and 8. how long is the long side", ["4.1"], "Pythagoras"),
 ("what is the derivative of x cubed", ["4.1"], "power rule"),
])

# ---------- 4.2 units ----------
add("4.2", [
 ("convert 5 miles to km", ["4.2"], "CONVERT"),
 ("how many cups in a litre", ["4.2"], "CONVERT"),
 ("what is 100 F in celsius", ["4.2"], "temperature conversion"),
 ("hw many pounds is 50 kg", ["4.2"], "CONVERT"),
 ("3 feet 6 inches in cm", ["4.2"], "CONVERT"),
 ("how many US gallons is 200 litres", ["4.2"], "CONVERT"),
 ("convert 30 psi to bar", ["4.2"], "pressure units"),
 ("how many acres is 4 hectares", ["4.2"], "area units"),
 ("37 degrees celsius in fahrenheit", ["4.2"], "temperature conversion"),
])

# ---------- 5.1 forces ----------
add("5.1", [
 ("what force do i need to push a 1200 kg car at 0.5 m/s2", ["5.1"], "FORCE"),
 ("how much does a 70 kg man weigh in newtons", ["5.1"], "WEIGHT card"),
 ("kinetic energy of a 1000 kg car going 20 m/s", ["5.1"], "KE"),
 ("potential energy of a 50 kg sack lifted up 3 m", ["5.1"], "PE"),
 ("a block has a mass of 2 kg and a volume of 0.001 m3. what is its density", ["5.1"], "DENSITY"),
 ("whats the difference between weight and mass", ["5.1"], "lesson: weight vs mass"),
 ("a 600 N crate sits on 0.2 square metres. what pressure does it put on the floor", ["5.1"], "PRESSURE"),
 ("how much work is done dragging a sled 40 m with a force of 150 N", ["5.1"], "WORK"),
 ("a car goes round a bend of radius 50 m at 15 m/s, what is the centripetal acceleration", ["5.1"], "CENTRIP"),
])

# ---------- 5.2 sky ----------
add("5.2", [
 ("why do we have summer and winter", ["5.2", "5.4"], "why we have seasons"),
 ("how long does a satellite at 400 km up take to go once round the earth", ["5.2", "5.1"], "orbit period card"),
 ("what is the escape velocity from the moon", ["5.2", "5.1"], "escape velocity card, PLANET"),
 ("how much would a 60 kg person weigh on mars", ["5.2", "5.1"], "weight on another planet card"),
 ("how can I find north using the stars at night", ["5.2"], "direction by the stars"),
 ("what causes a solar eclipse", ["5.2"], "eclipses"),
 ("why does february sometimes have 29 days", ["5.2"], "calendar and leap years"),
 ("how much delta v to go from a 300 km orbit to a 1000 km orbit", ["5.2"], "Hohmann card"),
 ("why does the moon change shape through the month", ["5.2"], "phases of the moon"),
 ("what is the schwarzschild radius of the sun", ["5.2"], "SCHWARZ"),
])

# ---------- 5.3 chemistry ----------
add("5.3", [
 ("molar mass of NaCl", ["5.3"], "MOLARMASS"),
 ("how many moles in 50 g of water", ["5.3"], "MOLES"),
 ("what does pH mean", ["5.3"], "acids, bases and pH"),
 ("how many grams is 2 moles of CO2", ["5.3"], "GRAMS"),
 ("atomic mass of iron", ["5.3"], "ATOMICMASS"),
 ("what is the difference between atomic number and atomic mass", ["5.3"], "lesson"),
 ("is vinegar an acid or a base", ["5.3"], "acids and bases"),
 ("what does H2SO4 mean and how many atoms are in it", ["5.3"], "reading a formula"),
 ("why does water turn to steam? what are the states of matter", ["5.3"], "states of matter"),
])

# ---------- 5.4 earth and weather ----------
add("5.4", [
 ("what do tall dark clouds shaped like an anvil mean", ["5.4"], "cloud types"),
 ("how do I stay safe in a lightning storm when I am out in the field", ["5.4", "6.1"], "storm safety; lightning first aid"),
 ("why does it rain", ["5.4"], "why it rains"),
 ("what causes earthquakes", ["5.4"], "restless Earth"),
 ("how do I measure how much rain fell at home", ["5.4"], "measuring the weather"),
 ("red sky at night, shepherd's delight. is that true?", ["5.4"], "reading weather signs"),
 ("what is a monsoon", ["5.4"], "seasons, monsoon"),
 ("explain the water cycle simply", ["5.4"], "water cycle"),
])

# ---------- 5.5 living things ----------
add("5.5", [
 ("what is DNA", ["5.5"], "DNA and genes"),
 ("how does photosynthesis work", ["5.5"], "photosynthesis"),
 ("what does the liver do", ["5.5"], "human body systems"),
 ("what is a food chain", ["5.5"], "food chains"),
 ("how do scientists sort animals into groups", ["5.5"], "classifying"),
 ("why do children look like their parents", ["5.5"], "inheritance"),
 ("what is inside a cell", ["5.5"], "cells"),
 ("are all bacteria bad for you", ["5.5"], "microbes"),
 ("how does blood go round the body", ["5.5"], "body systems"),
])

# ---------- 5.6 patterns ----------
add("5.6", [
 ("what is a feedback loop", ["5.6"], "feedback"),
 ("why does money left in a savings account grow faster and faster", ["5.6", "4.1"], "growth that feeds on itself"),
 ("what do sound, light and ripples on a pond have in common", ["5.6"], "everything waves"),
 ("energy is never used up, it only changes form. what does that mean", ["5.6"], "energy changes clothes"),
 ("why do so many things in nature go round in cycles", ["5.6"], "the great cycles"),
 ("how does a thermostat keep a room at the same temperature", ["5.6"], "feedback"),
 ("why should I write things down instead of trusting my memory", ["5.6"], "records beat memory"),
 ("how can things we cannot see, like air pressure or germs, control what we see happen", ["5.6"], "invisible runs the visible"),
 ("why does a rabbit population explode and then crash", ["5.6", "5.5"], "growth, feedback; ecosystems"),
])

# ---------- 6.1 health ----------
add("6.1", [
 ("how do i make oral rehydration solution with 1 litre of water", ["6.1"], "ORS"),
 ("how much sugar goes in ORS for 2 litres of water", ["6.1"], "ORS sugar card"),
 ("what do I do if someone is choking", ["6.1"], "choking"),
 ("how to stop heavy bleeding from a deep cut on the leg", ["6.1"], "bleeding"),
 ("my baby has a fever and wont feed, when should I worry", ["6.1"], "danger signs in a sick child"),
 ("how do I do CPR on an adult who is not breathing", ["6.1"], "CPR"),
 ("a man got bitten by a snake on the farm, what do we do now", ["6.1"], "bites and stings"),
 ("my child spilled boiling water on her arm what should i do", ["6.1"], "burns"),
 ("how much paracetamol can I give my 5 year old", ["6.1"], "dose question: 6.1 must not give a dose"),
 ("what are the signs of a stroke", ["6.1"], "stroke signs"),
])

# ---------- 6.2 food ----------
add("6.2", [
 ("how do I keep tomatoes from going bad without a fridge", ["6.2", "6.1"], "preserving food (lesson on both)"),
 ("how do i make sauerkraut", ["6.2"], "fermenting"),
 ("what should my 1 year old be eating", ["6.2"], "feeding babies and children"),
 ("how do I cook chicken so it is safe to eat", ["6.2"], "cooking food safely"),
 ("which foods have a lot of iron", ["6.2"], "vitamins and minerals"),
 ("is raw milk safe to drink", ["6.2"], "milk and eggs"),
 ("how to dry fish so it keeps for months", ["6.2"], "preserving"),
 ("how can I tell if an egg is still good to eat", ["6.2"], "milk and eggs"),
 ("what makes a balanced plate", ["6.2"], "balanced plate"),
])

# ---------- 6.3 safe water ----------
add("6.3", [
 ("how many drops of bleach for 20 litres of water", ["6.3"], "bleach card"),
 ("how do i make river water safe to drink", ["6.3"], "making water safe"),
 ("how far should a latrine be from our well", ["6.3"], "latrine siting"),
 ("how can i build a place to wash hands when there is no running water", ["6.3"], "handwashing"),
 ("how much water does a family of 6 need each day", ["6.3"], "enough water"),
 ("is boiling enough to make water safe", ["6.3"], "making water safe"),
 ("how should I store drinking water so it stays clean", ["6.3"], "keeping water safe"),
 ("how do I clean water using sunlight and plastic bottles", ["6.3"], "solar disinfection"),
 ("how much household bleach do I put in a 200 litre drum of well water", ["6.3"], "bleach card"),
])

# ---------- 6.4 farming ----------
add("6.4", [
 ("how do I make compost", ["6.4"], "compost"),
 ("how many tomato plants fit in a bed 4 m by 1.2 m at 45 cm spacing", ["6.4"], "PLANTS"),
 ("12 hens each laying 5 eggs a week, how many eggs a week", ["6.4"], "EGGS"),
 ("how much feed for 8 goats for 30 days at 1500 g a day each", ["6.4"], "FEEDKG"),
 ("what should I plant after beans", ["6.4"], "crop rotation"),
 ("my chickens stopped laying, why", ["6.4"], "chickens and eggs"),
 ("natural way to keep aphids off my cabbages", ["6.4"], "natural pest control"),
 ("how do i save seed from my maize for next year", ["6.4"], "saving seed"),
 ("my goat is coughing and not eating", ["6.4"], "animal illness"),
])

# ---------- 7.1 electrical sums ----------
add("7.1", [
 ("A 12 V pump draws 3 A, how many watts", ["7.1"], "WATTS"),
 ("what current flows through a 220 ohm resistor on 9 V", ["7.1"], "AMPS"),
 ("a 100 Ah 12 V battery running a 60 W light, how many hours", ["7.1"], "battery runtime"),
 ("100 ohm and 220 ohm in parallel", ["7.1"], "RPARALLEL"),
 ("total resistance of 1k, 2.2k and 4.7k in series", ["7.1"], "RSERIES"),
 ("what resistor do I need for 20 mA at 5 V", ["7.1"], "OHMS"),
 ("how many watt hours in a 200 Ah 24 V battery bank", ["7.1"], "WHRS"),
 ("a 2 kW heater runs 5 hours a day and power costs 0.15 per kWh. what does it cost for 30 days", ["7.1", "2.1"], "energy and money"),
 ("how many solar panels and batteries do I need to run lights and a radio at night", ["7.1"], "batteries and solar lesson"),
])

# ---------- 7.2 circuits to draw ----------
add("7.2", [
 ("draw a circuit with a battery, a switch and two bulbs in parallel", ["7.2"], "SCHEMATIC"),
 ("draw a schematic of an LED with a resistor on 9 V", ["7.2"], "SCHEMATIC"),
 ("draw a start stop motor control circuit with a contactor and an overload", ["7.2"], "CONTROL"),
 ("draw a ladder diagram where a float switch turns a pump on and off", ["7.2"], "CONTROL"),
 ("draw a 555 timer flashing an LED", ["7.2"], "ELECTRONICS"),
 ("draw a transistor driving a relay from an arduino pin", ["7.2"], "ELECTRONICS"),
 ("draw the wiring for a solar panel, charge controller, battery and a light", ["7.2"], "SCHEMATIC"),
 ("draw a voltage divider with 10k and 4.7k from 12 V", ["7.2"], "SCHEMATIC"),
 ("draw a forward reverse starter for a 3 phase motor", ["7.2"], "CONTROL"),
])

# ---------- 7.3 radio ----------
add("7.3", [
 ("wavelength of 146 MHz", ["7.3"], "WAVELEN"),
 ("how long should a half wave dipole for 7.1 MHz be", ["7.3"], "dipole length"),
 ("what is the SWR of a 75 ohm load on a 50 ohm line", ["7.3"], "SWR"),
 ("resonant frequency of 100 nH and 47 pF", ["7.3"], "FRES"),
 ("return loss of a 25 + j10 ohm antenna on 50 ohm coax", ["7.3"], "RLOSS"),
 ("how do i build an antenna for my 2 m handheld radio", ["7.3"], "antennas"),
 ("what is SWR and why does it matter", ["7.3"], "SWR explained"),
 ("what series reactance do I need to L match a 20 - j15 ohm load to 50 ohm", ["7.3"], "MATCHSER"),
 ("two strings at 440 Hz and 444 Hz, how many beats per second do I hear", ["7.3", "9.1"], "BEATF; tuning"),
])

# ---------- 8.1 hydraulic and pneumatic ----------
add("8.1", [
 ("draw a hydraulic circuit with a pump, relief valve and a double acting cylinder", ["8.1"], "HYDRAULIC"),
 ("draw a pneumatic circuit for a single acting cylinder worked by a push button valve", ["8.1"], "PNEUMATIC"),
 ("make a hydraulic diagram for a log splitter", ["8.1"], "HYDRAULIC"),
 ("draw a 4/3 valve running a hydraulic motor both ways", ["8.1"], "HYDRAULIC"),
 ("pneumatic circuit with two cylinders in sequence A+ B+ A- B-", ["8.1"], "PNEUMATIC"),
 ("draw a hydraulic press circuit with a pressure gauge and relief valve", ["8.1"], "HYDRAULIC"),
 ("draw an air cylinder that comes back by itself with a spring", ["8.1"], "PNEUMATIC"),
 ("hydraulic circuit with a flow control to slow the cylinder going out", ["8.1"], "HYDRAULIC"),
 ("draw a pneumatic circuit with a filter regulator lubricator and a 5/2 valve", ["8.1"], "PNEUMATIC"),
])

# ---------- 8.2 pumps, piping, stations ----------
add("8.2", [
 ("draw a piping layout from a water tank to three taps", ["8.2"], "piping"),
 ("draw a lift station with two pumps and float levels", ["8.2"], "station"),
 ("show the wet well levels: pump off 0.5 m, lead pump on 1.2 m, lag pump on 1.5 m, high alarm 1.8 m", ["8.2"], "levels"),
 ("draw a pump station with a check valve and a gate valve on each pump discharge", ["8.2"], "station"),
 ("draw the pipework from my borehole pump up to a header tank", ["8.2"], "piping"),
 ("draw a duplex sewage pump station", ["8.2"], "station"),
 ("piping drawing for the rain tank overflow going to a soakaway", ["8.2"], "piping"),
 ("draw a sump with a high level alarm float", ["8.2"], "levels"),
 ("draw a booster pump with a pressure tank on the house water line", ["8.2"], "piping"),
])

# ---------- 8.3 machines ----------
add("8.3", [
 ("gear ratio of a 12 tooth gear driving a 48 tooth gear", ["8.3"], "GEAR"),
 ("torque when I push 200 N on the end of a 0.4 m spanner", ["8.3", "5.1"], "TORQUE; torque lesson"),
 ("how does a lever help me lift a heavy rock", ["8.3"], "simple machines"),
 ("what is the mechanical advantage of a pulley with 4 ropes holding the load", ["8.3"], "pulleys"),
 ("what safety factor should I use for a rope that lifts people", ["8.3"], "safety factor"),
 ("how do i make a right angle on the ground without a square", ["8.3", "4.1"], "building without instruments; 3-4-5"),
 ("how to stay safe using an angle grinder", ["8.3"], "working safely"),
 ("which is stronger for a roof beam, oak or pine", ["8.3"], "material strength"),
 ("front sprocket has 44 teeth and rear has 11, how many times does the wheel turn for one turn of the pedals", ["8.3", "8.4"], "gear ratio; bicycle"),
])

# ---------- 8.4 repair ----------
add("8.4", [
 ("how do i fix a flat bike tyre", ["8.4"], "flat tyre"),
 ("my bicycle chain keeps slipping off", ["8.4"], "chain, gears and brakes"),
 ("how does a 4 stroke engine work", ["8.4"], "4-stroke engine"),
 ("how often should i change the oil in my motorbike", ["8.4"], "engine care"),
 ("motorbike wont start, what should i check first", ["8.4"], "repair mindset; engine"),
 ("how do I adjust the brakes on a bicycle", ["8.4"], "brakes"),
 ("what tools should I keep in a basic toolkit", ["8.4"], "basic toolkit"),
 ("my generator engine is blowing blue smoke, why", ["8.4"], "engine care"),
])

# ---------- 9.1 music ----------
add("9.1", [
 ("make a lullaby in C major", ["9.1"], "make music"),
 ("what notes are in the G major scale", ["9.1"], "scales"),
 ("why does a note an octave higher sound like the same note", ["9.1"], "octave"),
 ("how do i make a drum from a tin can", ["9.1"], "make instruments"),
 ("play twinkle twinkle little star", ["9.1"], "make music (old tune)"),
 ("how do I count 3/4 time", ["9.1"], "rhythm"),
 ("compose a happy tune for a wedding dance", ["9.1"], "make music"),
 ("write a work song for the harvest", ["9.1"], "make music"),
])

# ---------- 9.2 drawings ----------
add("9.2", [
 ("draw a house with a tree and the sun", ["9.2"], "drawing"),
 ("draw a mountain with a lake in front of it", ["9.2"], "drawing"),
 ("draw a goat", ["9.2"], "drawing (not farming)"),
 ("make a wheel chart of the 12 months and the seasons", ["9.2"], "wheel"),
 ("draw a map of my farm with the house, the barn and the well", ["9.2"], "drawing (a map to draw)"),
 ("draw a pie chart: food 40%, rent 30%, school 20%, other 10%", ["9.2"], "chart"),
 ("draw a bar chart of rainfall: jan 20 mm, feb 35 mm, mar 80 mm, apr 120 mm", ["9.2"], "chart"),
 ("draw a boat on the sea at sunset", ["9.2"], "drawing"),
 ("make a colour wheel", ["9.2"], "wheel"),
])

# ---------- 9.3 places ----------
add("9.3", [
 ("how far is Nairobi from Mombasa", ["9.3"], "DISTKM"),
 ("which direction is Kampala from Nairobi", ["9.3"], "DIRECTION"),
 ("where is Timbuktu", ["9.3", "0.2"], "PLACE; encyclopedia"),
 ("what is the latitude of Lagos", ["9.3"], "LAT"),
 ("distance between London and Paris in miles", ["9.3"], "DISTKM then miles"),
 ("how do I read the contour lines on a map", ["9.3"], "reading a map"),
 ("what is longitude", ["9.3"], "latitude and longitude"),
 ("which way do i go from Accra to Kumasi", ["9.3"], "BEARING"),
 ("how many people live in Dodoma", ["9.3", "0.2"], "PLACE population; encyclopedia"),
 ("how do I use a map and a compass to work out where I am", ["9.3"], "reading a map"),
])

# ---------- near-misses ----------
N = [
 ("write a song about my goat", ["9.1"], "near-miss: goat -> 6.4, but a song is 9.1"),
 ("how long can rice seed be stored", ["6.4"], "near-miss: rice -> 6.2, seed saving is 6.4"),
 ("how much table salt goes into a litre of ORS", ["6.1"], "near-miss: table -> 3.2, ORS salt card"),
 ("the nurse was drawing blood from my arm and now I feel faint, what do I do", ["6.1"], "near-miss: drawing -> 9.2, fainting"),
 ("my teacher is giving us a battery of tests next week, how should I study", ["1.2"], "near-miss: battery -> 7.1, how to learn"),
 ("my brother took my land and the case is going to the circuit court. how can we settle it fairly", ["2.3"], "near-miss: circuit -> 7.2, dispute"),
 ("the petrol pump price is 1.85 a litre, what do 40 litres cost", ["2.1"], "near-miss: pump -> 8.2, a cost sum"),
 ("what power did kings have in medieval England", ["0.2"], "near-miss: power -> 7.1/5.1, history"),
 ("draw up a simple agreement for selling my cow to my neighbour", ["3.2", "3.1"], "near-miss: draw -> 9.2, cow -> 6.4; a document"),
 ("how much capital do I need to open a shop: stock 500, rent 3 months at 120, shelves 200", ["2.1"], "near-miss: capital -> 0.2, a cost sum"),
 ("my kitchen scale says 2.2 pounds, how many kg is that", ["4.2"], "near-miss: scale -> 9.1, a conversion"),
 ("how many 50 notes make 350", ["4.1", "2.1"], "near-miss: notes -> 9.1, money division"),
 ("my bagpipe drone sounds flat, how do I tune it", ["9.1"], "near-miss: pipe -> 8.2, music"),
 ("the current in the river is very strong today, is it safe to swim across", ["6.1", "5.4"], "near-miss: current -> 7.1, drowning/rivers"),
 ("what resistance did people put up against colonial rule in Kenya", ["0.2"], "near-miss: resistance -> 7.1, history"),
 ("a solar cell gives 0.5 V, how many in series to make 12 V", ["7.1"], "near-miss: cell -> 5.5, electrical sum"),
 ("how do i write a story with a good plot", ["3.1"], "near-miss: plot -> 6.4/9.2, telling a story"),
 ("the bank of the river is washing away next to my field, how do I stop it", ["5.4", "6.4"], "near-miss: bank -> 2.1, erosion"),
 ("how do I take minutes at our committee meeting", ["3.1", "2.3"], "near-miss: minutes -> time 4.1; reports and minutes"),
 ("a witch doctor says a spell made my cow sick. how can I tell if that is true", ["1.2", "6.4"], "near-miss: spell -> 3.3; evidence, animal illness"),
 ("help us write a code of conduct for our water committee", ["2.3", "3.2"], "near-miss: code -> 0.3/3.3; writing rules"),
 ("my heart is racing and I feel a pressure in my chest", ["6.1"], "near-miss: pressure -> 5.1; heart attack signs"),
 ("how do I make a wheel of cheese from goat milk", ["6.2", "6.4"], "near-miss: wheel -> 9.2; milk, fermenting"),
 ("who was Georg Ohm", ["0.2"], "near-miss: Ohm -> 7.1, a person"),
 ("who invented the radio", ["0.2"], "near-miss: radio -> 7.3, an inventor"),
 ("my account balance is 520 and I pay 3 bills of 85 each, what is left", ["2.1"], "near-miss: balance -> 5.6, money sum"),
 ("the root of my back tooth hurts and my cheek is swollen", ["6.1"], "near-miss: root -> 4.1, teeth"),
 ("there is a mole on my back that has changed colour, is that bad", ["6.1"], "near-miss: mole -> 5.3, skin/health"),
 ("a mole is digging up my vegetable garden, how do I get rid of it", ["6.4"], "near-miss: mole -> 5.3, garden pest"),
 ("how do I make up baby formula safely with our well water", ["6.2", "6.3"], "near-miss: formula -> 5.3/4.1; feeding babies, safe water"),
 ("how do I compose a letter of complaint to the water board", ["3.1"], "near-miss: compose -> 9.1, letter writing"),
 ("make a program for our wedding day: church at 10, lunch at 1, dancing at 4", ["3.2", "2.2"], "near-miss: program -> 0.3; a printed schedule"),
 ("when does the next train leave the station", ["none"], "near-miss: station -> 8.2; live timetable"),
 ("what are the chances of drawing an ace from a deck of 52 cards", ["4.1", "1.2"], "near-miss: drawing/cards -> 9.2/3.2; probability"),
 ("flash flood coming down the valley, what should we do", ["5.4", "6.1"], "near-miss: flash -> 3.2 flashcards; storm safety"),
 ("can I use cooking oil in my motorbike engine", ["8.4"], "near-miss: cooking -> 6.2; engine oil"),
 ("my baby's weight chart says 7 kg at 10 months, is she too thin", ["6.1"], "near-miss: chart -> 9.2; child thinness"),
 ("what causes landslides on our hill after heavy rain", ["5.4"], "near-miss: slide -> 3.2 slides; erosion"),
 ("how do I draw water up from a deep well without a pump", ["8.3", "6.3"], "near-miss: draw -> 9.2, pump -> 8.2; windlass/pulley"),
 ("how do I stop my kitchen table wobbling", ["8.4", "8.3"], "near-miss: table -> 3.2; simple repair"),
]

# ---------- nothing in Lantern can answer ----------
X = [
 ("will it rain tomorrow in Kisumu", "forecast"),
 ("whats in the news today", "today's news"),
 ("what is the phone number of Gulu hospital", "a phone number"),
 ("how much will maize sell for next month", "future price"),
 ("who won the football match last night", "recent result"),
 ("what is the dollar exchange rate today", "live rate"),
 ("what time does the bus to Mbale leave", "live timetable"),
 ("is the road to Lodwar open today", "live road status"),
 ("what is John Okello's email address", "a person's contact"),
 ("when will the power come back on in our area", "live outage"),
 ("what is the price of petrol today", "today's price"),
 ("what is the weather like right now in Nairobi", "current weather"),
 ("is there a pharmacy open near me right now", "live local opening"),
 ("what is the code for the gate padlock at the school", "near-miss: code -> 0.3/3.3; private"),
 ("what will Safaricom shares be worth next week", "future price"),
 ("who will win the election next year", "future event"),
 ("where is my parcel from the post office", "live tracking"),
 ("send a message to my sister in Kampala", "needs a network"),
 ("is the clinic in Moroto open on Sunday", "local live info"),
 ("has my exam result come out yet", "personal live info"),
 ("book me a seat on the bus to Kigali", "a booking"),
 ("what did the chief say at the meeting yesterday", "unrecorded event"),
 ("how much rain fell in our village last week", "local record Lantern lacks"),
 ("what is my bank balance", "private account"),
 ("which numbers will win the lottery on saturday", "unknowable"),
]

out = list(D)
for q, sh, why in N:
    out.append({"q": q, "shelf": sh, "why": why})
for q, why in X:
    out.append({"q": q, "shelf": ["none"], "why": "none: " + why})

# checks
valid = set(json.load(open(sys.argv[1]))["shelves"][i]["shelf"] for i in range(33))
valid.add("none")
seen = set()
for o in out:
    assert set(o.keys()) == {"q", "shelf", "why"}
    assert 1 <= len(o["shelf"]) <= 3, o
    assert len(set(o["shelf"])) == len(o["shelf"]), o
    for s in o["shelf"]:
        assert s in valid, o
    if "none" in o["shelf"]:
        assert o["shelf"] == ["none"], o
    k = o["q"].lower()
    assert k not in seen, o
    seen.add(k)
    for f in ("q", "why"):
        assert all(ord(c) < 128 for c in o[f]), o

dest = sys.argv[2]
os.makedirs(os.path.dirname(dest), exist_ok=True)
with open(dest, "w") as fh:
    json.dump(out, fh, indent=1, ensure_ascii=True)
    fh.write("\n")
print("direct", len(D), "near", len(N), "none", len(X), "total", len(out))

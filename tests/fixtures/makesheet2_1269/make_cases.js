// make_cases.js -- writes cases.json, the second reviewer's MAKE SHEET cases for 1.24.29 (bracket names, [B2] read as
// the cell, summary rows, text formulas, | rows, 26 columns). Each case is a reply as a small model writes it, and what
// the model meant: the values its formulas should show (want), and whether it should go back to the model (back: true,
// with what the message must say), stay (back: false), or may do either (back: "either": a right reply that can also
// fairly be asked about). Judged by what the model meant, not by Lantern's code.
// node make_cases.js > cases.json
"use strict";
var cases = [];
function S(id, title, lines, o) {
  var c = { id: id, q: o.q || "Make a table: " + title + ".", reply: "MAKE SHEET: " + title + "\n" + lines.join("\n") + "\nEND", back: o.back === undefined ? false : o.back };
  ["want", "msg", "said", "bench", "why", "formula", "text"].forEach(function (k) { if (o[k] !== undefined) c[k] = o[k]; });
  cases.push(c);
}
var SHOP = "Make a table of my shopping: 2 loaves of bread at 1.50 each, 1 milk at 0.99, and 12 eggs at 0.25 each, with the cost of each line and a total.";
var JOB = "Make me an Excel spreadsheet (.xlsx) of a small job's costs: 3 hours of labour at 25 an hour, parts 40 and travel 12, with the total.";
var TEMP = "Make a table converting 0, 10, 20, 30 and 40 degrees Celsius to Fahrenheit.";
var shopW = { D2: 3, D3: 0.99, D4: 3, D5: 6.99 };

// ---- [B2] as the cell (the 4B's =[B2]*[C2]) and the shopping list
S("B001", "Shopping List", ["Item | Qty | Unit Price | Total", "Bread | 2 | 1.50 | =[B2]*[C2]", "Milk | 1 | 0.99 | =[B3]*[C3]", "Eggs | 12 | 0.25 | =[B4]*[C4]", "Total | | | =SUM([Total])"],
  { q: SHOP, bench: "make-shopping", want: shopW, said: "read \\[B2\\] as the cell B2", why: "the 4B's own reply (bench_run_1268_4b.json)" });
S("B002", "Shopping", ["Item | Qty | Price | Cost", "Bread | 2 | 1.50 | =[b2]*[c2]", "Milk | 1 | 0.99 | =[b3]*[c3]", "Eggs | 12 | 0.25 | =[b4]*[c4]", "Total | | | =SUM([Cost])"], { q: SHOP, bench: "make-shopping", want: shopW });
S("B003", "Shopping", ["Item | Qty | Price | Cost", "Bread | 2 | 1.50 | =[B2]*[C2]", "Milk | 1 | 0.99 | =[B3]*[C3]", "Eggs | 12 | 0.25 | =[B4]*[C4]", "Total | | | =SUM([D2:D4])"], { q: SHOP, bench: "make-shopping", want: shopW });
S("B004", "Shopping", ["Item | Qty | Price | Cost", "Bread | 2 | 1.50 | =[B2]*[C2]", "Milk | 1 | 0.99 | =[B3]*[C3]", "Eggs | 12 | 0.25 | =[B4]*[C4]", "Total | | | =SUM([$D$2:$D$4])"],
  { q: SHOP, want: shopW, formula: { D5: "=SUM($D$2:$D$4)" } });
S("B005", "Shopping", ["Item | Qty | Price | Cost", "Bread | 2 | 1.50 | =[Qty]*[C2]", "Milk | 1 | 0.99 | =[Qty]*[C3]", "Eggs | 12 | 0.25 | =[Qty]*[C4]", "Total | | | =SUM([Cost])"], { q: SHOP, want: shopW });
S("B006", "Shopping", ["Item | Qty | Price | Cost", "Bread | 2 | 1.50 | =[B2]*[C2]", "Milk | 1 | 0.99 | =[B2]*[C2]", "Eggs | 12 | 0.25 | =[B2]*[C2]", "Total | | | =SUM([Cost])"],
  { q: SHOP, back: true, msg: "for row 3 write =B3\\*C3", why: "row 2's formula copied down" });
S("B007", "Shopping", ["Item | Qty | Price | Cost", "Bread | 2 | 1.50 | =[B2]*[C2]", "Milk | 1 | 0.99 | =[B3]*[C3]", "Eggs | 12 | 0.25 | =[B3]*[C3]", "Total | | | =SUM([Cost])"],
  { q: SHOP, back: true, msg: "D4", why: "row 3's copied to row 4" });
S("B008", "Shopping", ["Item | Qty | Price | Cost", "Bread | 2 | 1.50 | =[B2]*[C2]", "Milk | 1 | 0.99 | =[B2]*[C2]", "Eggs | 12 | 0.25 | =[B4]*[C4]", "Total | | | =SUM([Cost])"],
  { q: SHOP, back: true, msg: "for row 3 write =B3\\*C3" });
S("B009", "Shopping", ["Item | Qty | Price | Cost", "Bread | 2 | 1.50 | =B2*C2", "Milk | 1 | 0.99 | =B3*C3", "Eggs | 12 | 0.25 | =B4*C4", "Total | | | =SUM(D2:D4)"], { q: SHOP, bench: "make-shopping", want: shopW });
S("B010", "Shopping", ["Item | Qty | Price | Cost", "Bread | 2 | 1.50 | =B2*C2", "Milk | 1 | 0.99 | =B2*C2", "Eggs | 12 | 0.25 | =B2*C2", "Total | | | =SUM(D2:D4)"],
  { q: SHOP, back: true, want: shopW, why: "plain cell names copied down unchanged: the model meant each row's own (D3 would show 3, the total 9)" });
S("B011", "Shopping", ["Item | Qty | Unit Price | Cost", "Bread | 2 | 1.50 | =[Qty]*[Unit Price]", "Milk | 1 | 0.99 | =[Qty]*[Unit Price]", "Eggs | 12 | 0.25 | =[Qty]*[Unit Price]", "Total | | | =SUM([Cost])"], { q: SHOP, bench: "make-shopping", want: shopW });
S("B012", "Shopping", ["Item | Qty | Unit Price | Cost", "Bread | 2 | 1.50 | =[qty]*[unit price]", "Milk | 1 | 0.99 | =[qty]*[unit price]", "Eggs | 12 | 0.25 | =[qty]*[unit price]", "Total | | | =sum([cost])"], { q: SHOP, want: shopW });
S("B013", "Shopping", ["Item | Qty | Unit Price | Cost", "Bread | 2 | 1.50 | =[ Qty ]*[ Unit Price ]", "Milk | 1 | 0.99 | =[ Qty ]*[ Unit Price ]", "Eggs | 12 | 0.25 | =[ Qty ]*[ Unit Price ]", "Total | | | =SUM( [Cost] )"], { q: SHOP, want: shopW });
S("B014", "Shopping", ["Item | Qty | Price | Cost", "Bread | 2 | 1.50 | = [Qty] * [Price]", "Milk | 1 | 0.99 | = [Qty] * [Price]", "Eggs | 12 | 0.25 | = [Qty] * [Price]", "Total | | | = SUM([Cost])"], { q: SHOP, want: shopW });
S("B015", "Shopping", ["| Item | Qty | Price | Cost |", "|---|---|---|---|", "| Bread | 2 | 1.50 | =[Qty]*[Price] |", "| Milk | 1 | 0.99 | =[Qty]*[Price] |", "| Eggs | 12 | 0.25 | =[Qty]*[Price] |", "| Total | | | =SUM([Cost]) |"], { q: SHOP, bench: "make-shopping", want: shopW });
S("B016", "Shopping", ["| **Item** | **Qty** | **Price** | **Cost** |", "| :--- | :---: | ---: | ---: |", "| Bread | 2 | 1.50 | =[Qty]*[Price] |", "| Milk | 1 | 0.99 | =[Qty]*[Price] |", "| Eggs | 12 | 0.25 | =[Qty]*[Price] |", "| **Total** | | | =SUM([Cost]) |"], { q: SHOP, want: shopW });
S("B017", "Shopping", ["| Item | Qty | Price | Cost |", "|---|---|---|---|", "| Bread | 2 | 1.50 | =[Qty]*[Price] |", "| Milk | 1 | 0.99 | =[Qty]*[Price] |", "| Eggs | 12 | 0.25 | =[Qty]*[Price] |", "| **Total** | | | **=SUM([Cost])** |"],
  { q: SHOP, want: shopW, why: "a bold total formula: either worked out or sent back, never left as =SUM([Cost]) unread" });
S("B018", "Shopping", ["Item | Qty | Cost", "Bread | 2 | 3", "Milk | 1 | 0.99", "Eggs | 12 | 3", "| Total | =SUM([Cost])"], { q: SHOP, want: { C5: 6.99, B5: "Total" }, why: "a row begun with | under a header that is not: its first cell is empty" });
S("B019", "Shopping", ["Item | Qty | Price | Cost", "| Bread | 2 | 1.50 | =[Qty]*[Price] |", "| Milk | 1 | 0.99 | =[Qty]*[Price] |", "| Eggs | 12 | 0.25 | =[Qty]*[Price] |", "| Total | | | =SUM([Cost]) |"],
  { q: SHOP, want: shopW, why: "every row but the header begun with | (and one cell longer than the header if read so): the model meant them under the header" });
S("B020", "Shopping", ["Item\tQty\tPrice\tCost", "Bread\t2\t1.50\t=[Qty]*[Price]", "Milk\t1\t0.99\t=[Qty]*[Price]", "Eggs\t12\t0.25\t=[Qty]*[Price]", "Total\t\t\t=SUM([Cost])"], { q: SHOP, want: shopW });
S("B021", "Shopping", ["Item | Qty | Price | Cost |", "Bread | 2 | 1.50 | =[Qty]*[Price] |", "Milk | 1 | 0.99 | =[Qty]*[Price] |", "Eggs | 12 | 0.25 | =[Qty]*[Price] |", "Total | | | =SUM([Cost]) |"], { q: SHOP, want: shopW });
S("B022", "Shopping List", ["Item | Qty | Unit Price | Total", "Bread | 2 | 1.50 | =[2]*[1.50]", "Milk | 1 | 0.99 | =[1]*[0.99]", "Eggs | 12 | 0.25 | =[12]*[0.25]", "Total | | | =SUM([Total])"],
  { q: SHOP, back: true, msg: "names \\[2\\], which is not a column", why: "the 4B's first reply" });
S("B023", "Shopping", ["Item | Qty | Unit Price | Cost", "Bread | 2 | 1.50 | =[Qty]*[Price]", "Milk | 1 | 0.99 | =[Qty]*[Price]", "Eggs | 12 | 0.25 | =[Qty]*[Price]", "Total | | | =SUM([Cost])"],
  { q: SHOP, back: "either", want: shopW, why: "[Price] for the column Unit Price" });
S("B024", "Shopping", ["Item | Qty | Price | Cost", "Bread | 2 | 1.50 | =[Quantity]*[Price]", "Milk | 1 | 0.99 | =[Quantity]*[Price]", "Eggs | 12 | 0.25 | =[Quantity]*[Price]", "Total | | | =SUM([Cost])"],
  { q: SHOP, back: "either", want: shopW, why: "[Quantity] for the column Qty" });
S("B025", "Shopping", ["Item | Qty | Price | Cost", "Bread | 2 | 1.50 | =[Qty]*[Cost]", "Milk | 1 | 0.99 | =[Qty]*[Cost]", "Eggs | 12 | 0.25 | =[Qty]*[Cost]", "Total | | | =SUM([Cost])"], { q: SHOP, back: true, why: "the cost from itself" });
S("B026", "Shopping", ["Item | Qty | Price | Cost", "Bread | 2 | 1.50 | =SUM([Cost])", "Milk | 1 | 0.99 | =[Qty]*[Price]"], { q: SHOP, back: true, msg: "no rows above" });
S("B027", "Shopping", ["Item | Qty | Price | Cost", "Bread | 2 | 1.50 | =[B2]*[E2]", "Milk | 1 | 0.99 | =[B3]*[E3]", "Eggs | 12 | 0.25 | =[B4]*[E4]"], { q: SHOP, back: true, msg: "names \\[E2\\]" });
S("B028", "Shopping", ["Item | Qty | Price | Cost", "Bread | 2 | 1.50 | =[B2]*[C2]", "Milk | 1 | 0.99 | =[B3]*[C3]", "Eggs | 12 | 0.25 | =[B4]*[C4]", "Total | | | =SUM([D2:D9])"], { q: SHOP, back: true, msg: "D2:D9|\\[D2:D9\\]", why: "D9 is past the table" });
S("B029", "Shopping", ["Item | Qty | Price | Cost", "Bread | 2 | 1.50 | =[@Qty]*[@Price]", "Milk | 1 | 0.99 | =[@Qty]*[@Price]", "Eggs | 12 | 0.25 | =[@Qty]*[@Price]", "Total | | | =SUM([Cost])"],
  { q: SHOP, back: "either", want: shopW, why: "Excel's own table names, [@Qty] for this row's Qty" });
S("B030", "Shopping", ["Item | Qty | Price", "Bread | 2 | 1.50", "Milk | 1 | 0.99", "Eggs | 12 | 0.25", "Total | | =SUMPRODUCT([Qty],[Price])"],
  { q: SHOP, want: { C5: 6.99 }, why: "SUMPRODUCT of two columns: the model meant B2:B4 and C2:C4" });
S("B031", "Shopping", ["Item | Qty | Price | Cost", "Bread | 2 | 1.50 | =[B2]*[C2]", "Milk | 1 | 0.99 | =[B3]*[C3]", "Eggs | 12 | 0.25 | =[B4]*[C4]", "Total | =SUM([B2:B4]) | | =SUM([D2:D4])"], { q: SHOP, want: { B5: 15, D5: 6.99 } });
S("B032", "Shopping", ["Item | Qty | Price | Cost", "Bread | 2 | £1.50 | =[Qty]*[Price]", "Milk | 1 | £0.99 | =[Qty]*[Price]", "Eggs | 12 | £0.25 | =[Qty]*[Price]", "Total | | | =SUM([Cost])"], { q: SHOP, want: shopW });
S("B033", "Shopping", ["Item | Qty | Price | Cost", "Bread | 2 | 1.50 | =[Qty]*[Price]", "Milk | 1 | 0.99 | =[Qty]*[Price]", "Eggs | 12 | 0.25 | =[Qty]*[Price]", "Total | | | =ROUND(SUM([Cost]),2)"], { q: SHOP, want: shopW });
S("B034", "Shopping", ["Item | Qty | Price | Cost", "Bread | 2 | 1.50 | =[Qty]*[Price]", "Milk | 1 | 0.99 | =[Qty]*[Price]", "Eggs | 12 | 0.25 | =[Qty]*[Price]", "Total | =SUM([Qty]) | | =SUM([Cost])"], { q: SHOP, want: { B5: 15, D5: 6.99 } });

// ---- the temperatures
var tW = { B2: 32, B3: 50, B4: 68, B5: 86, B6: 104 };
function temps(head, f) { return [head].concat([0, 10, 20, 30, 40].map(function (c, k) { return c + " | " + (typeof f === "function" ? f(k + 2) : f); })); }
S("T001", "Celsius to Fahrenheit", temps("Celsius | Fahrenheit", "=[Celsius]*9/5+32"), { q: TEMP, bench: "make-temperatures", want: tW });
S("T002", "Celsius to Fahrenheit", temps("Celsius | Fahrenheit", function (r) { return "=A" + r + "*9/5+32"; }), { q: TEMP, bench: "make-temperatures", want: tW });
S("T003", "Celsius to Fahrenheit", temps("Celsius | Fahrenheit", function (r) { return "=[A" + r + "]*9/5+32"; }), { q: TEMP, bench: "make-temperatures", want: tW, said: "read \\[A2\\] as the cell A2" });
S("T004", "Celsius to Fahrenheit", temps("Celsius | Fahrenheit", "=([Celsius]*1.8)+32"), { q: TEMP, want: tW });
S("T005", "Celsius to Fahrenheit", temps("Celsius | Fahrenheit", "=CONVERT([Celsius],\x22C\x22,\x22F\x22)"), { q: TEMP, bench: "make-temperatures", want: tW });
S("T006", "Celsius to Fahrenheit", temps("Celsius (°C) | Fahrenheit (°F)", "=[°C]*9/5+32"), { q: TEMP, want: tW });
S("T007", "Celsius to Fahrenheit", temps("Celsius (C) | Fahrenheit (F)", "=[C]*9/5+32"), { q: TEMP, want: tW });
S("T008", "Celsius to Fahrenheit", temps("Celsius (C) | Fahrenheit (F)", "=C*9/5+32"), { q: TEMP, want: tW });
S("T009", "Celsius to Fahrenheit", temps("Celsius (C) | Fahrenheit (F)", "=[Celsius (C)]*9/5+32"), { q: TEMP, want: tW });
S("T010", "Celsius to Fahrenheit", temps("°C | °F", "=[°C]*1.8+32"), { q: TEMP, want: tW });
S("T011", "Celsius to Fahrenheit", temps("Celsius | Fahrenheit", "=[A2]*9/5+32"), { q: TEMP, back: true, msg: "for row 3 write =A3\\*9/5\\+32" });
S("T012", "Celsius to Fahrenheit", ["| Celsius | Fahrenheit |", "| --- | --- |"].concat([0, 10, 20, 30, 40].map(function (c) { return "| " + c + " | =[Celsius]*9/5+32 |"; })), { q: TEMP, bench: "make-temperatures", want: tW });
S("T013", "C to F", temps("C | F", "=[C]*9/5+32"), { q: TEMP, want: tW });
S("T014", "Temperatures", ["Celsius | Fahrenheit | Kelvin"].concat([0, 10, 20, 30, 40].map(function (c) { return c + " | =[Celsius]*9/5+32 | =[Celsius]+273.15"; })), { q: TEMP, want: { B2: 32, B6: 104, C2: 273.15, C6: 313.15 } });
S("T015", "Celsius to Fahrenheit", temps("Celsius | Fahrenheit", "=ROUND([Celsius]*9/5+32,1)"), { q: TEMP, want: tW });
S("T016", "Celsius to Fahrenheit", temps("Celsius | Fahrenheit", function (r) { return r === 2 ? "=[A2]*9/5+32" : "=[A" + r + "] * 9 / 5 + 32"; }), { q: TEMP, want: tW });
S("T017", "Celsius to Fahrenheit", temps("Temp C | Temp F", "=[Temp C]*9/5+32"), { q: TEMP, want: tW });

// ---- the job's costs (Excel)
var jW = { D2: 75, D5: 127 };
S("J001", "Job costs", ["Item | Hours | Rate | Cost", "Labour | 3 | 25 | =B2*C2", "Parts | | | 40", "Travel | | | 12", "Total | | | =SUM(D2:D4)"], { q: JOB, bench: "make-sheet-excel", want: jW });
S("J002", "Job costs", ["Item | Hours | Rate | Cost", "Labour | 3 | 25 | =[B2]*[C2]", "Parts | | | 40", "Travel | | | 12", "Total | | | =SUM([D2:D4])"], { q: JOB, bench: "make-sheet-excel", want: jW });
S("J003", "Job costs", ["Item | Quantity | Rate | Amount", "Labour | 3 | 25 | =[Quantity]*[Rate]", "Parts | 1 | 40 | =[Quantity]*[Rate]", "Travel | 1 | 12 | =[Quantity]*[Rate]", "Total | | | =SUM([Amount])"],
  { q: JOB, bench: "make-sheet-excel", want: { D2: 75, D3: 40, D4: 12, D5: 127 } });
S("J004", "Job costs", ["Item | Cost", "Labour (3 h at 25) | =3*25", "Parts | 40", "Travel | 12", "Total | =SUM([Cost])"], { q: JOB, bench: "make-sheet-excel", want: { B2: 75, B5: 127 } });
S("J005", "Job costs", ["Item | Hours | Rate | Cost", "Labour | 3 | 25 | =[Hours]*[Rate]", "Parts | | | 40", "Travel | | | 12", "Total | | | =SUM([Cost])"], { q: JOB, bench: "make-sheet-excel", want: jW });
S("J006", "Job costs", ["Item | Hours | Rate | Cost", "Labour | 3 | 25 | =[B2]*[C2]", "Parts | | | 40", "Travel | | | 12", "Total | | | =[D2]+[D3]+[D4]"], { q: JOB, bench: "make-sheet-excel", want: jW });
S("J007", "Job invoice", ["Item | Hours | Rate | Cost", "Labour | 3 | 25 | =[Hours]*[Rate]", "Parts | | | 40", "Travel | | | 12", "Subtotal | | | =SUM([Cost])", "VAT 20% | | | =[D5]*0.2", "Total | | | =[D5]+[D6]"],
  { q: JOB, want: { D5: 127, D6: 25.4, D7: 152.4 } });
S("J008", "Job invoice", ["Item | Hours | Rate | Cost", "Labour | 3 | 25 | =[Hours]*[Rate]", "Parts | | | 40", "Travel | | | 12", "Subtotal | | | =SUM([Cost])", "VAT 20% | | | =[D5]*0.2", "Total | | | =SUM([Cost])"],
  { q: JOB, back: "either", want: { D5: 127, D6: 25.4, D7: 152.4 }, why: "the last total under a subtotal and VAT: the model meant 152.40 (worked out so, or asked about; 279.40 is wrong)" });
S("J009", "Job costs", ["| Item | Hours | Rate | Cost |", "|------|-------|------|------|", "| Labour | 3 | 25 | =[Hours]*[Rate] |", "| Parts | | | 40 |", "| Travel | | | 12 |", "| **Total** | | | =SUM([Cost]) |"], { q: JOB, bench: "make-sheet-excel", want: jW });
S("J010", "Job costs", ["Item | Hours | Rate | Cost", "Labour | 3 | 25 | =[$B$2]*[$C$2]", "Parts | | | 40", "Travel | | | 12", "Total | | | =SUM([Cost])"], { q: JOB, want: jW, formula: { D2: "=$B$2*$C$2" } });

// ---- scores and the summary rows under them
var sc = ["Name | Score", "Ann | 72", "Ben | 85", "Cara | 64", "Dev | 91", "Eve | 58"];
S("G001", "Scores", sc.concat(["Average | =AVERAGE([Score])", "Lowest | =MIN([Score])", "Highest | =MAX([Score])", "How many | =COUNT([Score])"]), { want: { B7: 74, B8: 58, B9: 91, B10: 5 } });
S("G002", "Scores", sc.concat(["Total | =SUM([Score])", "Average | =AVERAGE([Score])"]), { want: { B7: 370, B8: 74 } });
S("G003", "Scores", sc.concat(["Average | =AVG([Score])"]), { want: { B7: 74 } });
S("G004", "Scores", sc.concat(["Median | =MEDIAN([Score])"]), { want: { B7: 72 }, why: "MEDIAN of the column, as SUM and AVERAGE are" });
S("G005", "Scores", sc.concat(["Range | =MAX([Score])-MIN([Score])"]), { want: { B7: 33 } });
S("G006", "Scores", ["Name | Score | Result", "Ann | 72 | =IF([Score]>=60,\x22Pass\x22,\x22Fail\x22)", "Ben | 85 | =IF([Score]>=60,\x22Pass\x22,\x22Fail\x22)", "Eve | 58 | =IF([Score]>=60,\x22Pass\x22,\x22Fail\x22)"],
  { want: { C2: "Pass", C4: "Fail" } });
S("G007", "Grades", ["Name | Score | Grade", "Ann | 72 | =IF([Score]>=90,\x22A\x22,IF([Score]>=80,\x22B\x22,IF([Score]>=70,\x22C\x22,\x22D\x22)))", "Dev | 91 | =IF([Score]>=90,\x22A\x22,IF([Score]>=80,\x22B\x22,IF([Score]>=70,\x22C\x22,\x22D\x22)))", "Eve | 58 | =IF([Score]>=90,\x22A\x22,IF([Score]>=80,\x22B\x22,IF([Score]>=70,\x22C\x22,\x22D\x22)))"],
  { want: { C2: "C", C3: "A", C4: "D" } });
S("G008", "Scores", sc.concat(["Passed | =COUNTIF([Score],\x22>=60\x22)"]), { want: { B7: 4 }, why: "COUNTIF over the column" });
S("G009", "Tests", ["Name | Test1 | Test2 | Average", "Ann | 70 | 80 | =AVERAGE([Test1],[Test2])", "Ben | 90 | 60 | =AVERAGE([Test1],[Test2])"], { want: { D2: 75, D3: 75 } });
S("G010", "Tests", ["Name | Test1 | Test2", "Ann | 70 | 80", "Ben | 90 | 60", "Cara | 50 | 70", "Average | =AVERAGE([Test1]) | =AVERAGE([Test2])"], { want: { B5: 70, C5: 70 } });
S("G011", "Scores", ["Name | Score | Percent", "Ann | 72 | =[Score]/100", "Ben | 85 | =[Score]/100"], { want: { C2: 0.72, C3: 0.85 } });
S("G012", "Scores", sc.concat(["Average | =ROUND(AVERAGE([Score]),1)"]), { want: { B7: 74 } });
S("G013", "Scores", sc.concat(["Average | =SUM([Score])/COUNT([Score])"]), { want: { B7: 74 } });
S("G014", "Scores", sc.concat(["Total | =SUM([Score])", "Average | =AVERAGE([Score])", "Lowest | =MIN([Score])", "Highest | =MAX([Score])"]), { want: { B7: 370, B8: 74, B9: 58, B10: 91 } });
S("G015", "Scores", ["Name | Maths | English | Total", "Ann | 72 | 80 | =[Maths]+[English]", "Ben | 85 | 64 | =[Maths]+[English]", "Cara | 64 | 90 | =[Maths]+[English]",
  "Average | =AVERAGE([Maths]) | =AVERAGE([English]) | =AVERAGE([Total])", "Highest | =MAX([Maths]) | =MAX([English]) | =MAX([Total])"], { want: { B5: 73.6666666666667, C5: 78, D5: 151.666666666667, D6: 154 } });
S("G016", "Scores", sc.concat(["How many | =COUNTA([Name])"]), { want: { B7: 5 }, why: "COUNTA of the names" });

// ---- text from formulas (a quoted word or &)
var shop2 = ["Item | Qty | Price", "Bread | 2 | 1.50", "Milk | 1 | 0.99", "Eggs | 12 | 0.25"];
function col(head, f) { return [shop2[0] + " | " + head].concat(shop2.slice(1).map(function (l) { return l + " | " + f; })); }
S("X001", "Labels", col("Label", "=[Item]&\x22 x \x22&[Qty]"), { want: { D2: "Bread x 2", D4: "Eggs x 12" } });
S("X002", "Sizes", col("Size", "=IF([Qty]>5,\x22bulk\x22,\x22single\x22)"), { want: { D2: "single", D4: "bulk" } });
S("X003", "Milk doubled", col("Need", "=IF([Item]=\x22Milk\x22,[Qty]*2,[Qty])"), { want: { D2: 2, D3: 2, D4: 12 } });
S("X004", "Names", ["First | Last | Full", "Ann | Lee | =[First]&\x22 \x22&[Last]", "Ben | Okafor | =[First]&\x22 \x22&[Last]"], { want: { C2: "Ann Lee", C3: "Ben Okafor" } });
S("X005", "Names", ["First | Last | Full", "Ann | Lee | =CONCATENATE([First],\x22 \x22,[Last])", "Ben | Okafor | =CONCATENATE([First],\x22 \x22,[Last])"], { want: { C2: "Ann Lee", C3: "Ben Okafor" } });
S("X006", "Codes", ["Name | Code", "apple | =UPPER([Name])", "pear | =UPPER([Name])"], { want: { B2: "APPLE", B3: "PEAR" }, why: "a text function with no quoted word" });
S("X007", "Word lengths", ["Word | Letters", "apple | =LEN([Word])", "banana | =LEN([Word])", "kiwi | =LEN([Word])"], { want: { B2: 5, B3: 6, B4: 4 }, why: "a number from a text cell" });
S("X008", "Initials", ["Name | Initial", "Ann | =LEFT([Name],1)", "Ben | =LEFT([Name],1)"], { want: { B2: "A", B3: "B" } });
S("X009", "Bills", ["Bill | Amount | Paid | Owed", "Rent | 800 | yes | =IF([Paid]=\x22yes\x22,0,[Amount])", "Power | 95 | no | =IF([Paid]=\x22yes\x22,0,[Amount])", "Total | | | =SUM([Owed])"], { want: { D2: 0, D3: 95, D4: 95 } });
S("X010", "Stock", ["Part | Stock | Reorder | Action", "Bolts | 40 | 50 | =IF([Stock]<[Reorder],\x22Order\x22,\x22OK\x22)", "Nuts | 120 | 50 | =IF([Stock]<[Reorder],\x22Order\x22,\x22OK\x22)"], { want: { D2: "Order", D3: "OK" } });
S("X011", "Prices", col("Shown", "=TEXT([Price],\x220.00\x22)"), { want: { D2: "1.50", D3: "0.99" } });
S("X012", "Emails", ["Name | Email", "ann | =[Name]&\x22@example.com\x22", "ben | =[Name]&\x22@example.com\x22"], { want: { B2: "ann@example.com" } });
S("X013", "Stock", col("Status", "=IF([Qty]>10,\x22in stock\x22,\x22low\x22)"), { want: { D2: "low", D4: "in stock" } });
S("X014", "Names", ["Name | Proper", "ann lee | =PROPER([Name])", "ben okafor | =PROPER([Name])"], { want: { B2: "Ann Lee", B3: "Ben Okafor" } });
S("X015", "Line", col("Line", "=[Item]&\x22: \x22&TEXT([Qty]*[Price],\x220.00\x22)"), { want: { D2: "Bread: 3.00", D3: "Milk: 0.99" } });

// ---- budgets
var bud = ["Category | Budget | Spent", "Rent | 800 | 800", "Food | 300 | 260", "Fuel | 150 | 170", "Fun | 100 | 40"];
function bcol(head, f) { return [bud[0] + " | " + head].concat(bud.slice(1).map(function (l) { return l + " | " + f; })); }
S("U001", "Budget", bcol("Left", "=[Budget]-[Spent]").concat(["Total | =SUM([Budget]) | =SUM([Spent]) | =SUM([Left])"]), { want: { D2: 0, D3: 40, D4: -20, D5: 60, B6: 1350, C6: 1270, D6: 80 } });
S("U002", "Budget", bcol("Used", "=[Spent]/[Budget]"), { want: { D2: 1, D3: 260 / 300, D4: 170 / 150, D5: 0.4 } });
S("U003", "Budget", bcol("Used %", "=ROUND([Spent]/[Budget]*100,1)"), { want: { D2: 100, D3: 86.7, D4: 113.3, D5: 40 } });
S("U004", "Budget", bcol("Over?", "=IF([Spent]>[Budget],\x22Over\x22,\x22OK\x22)"), { want: { D2: "OK", D4: "Over" } });
S("U005", "Budget", [bud[0] + " | Left"].concat(bud.slice(1).map(function (l, k) { return l + " | =[B" + (k + 2) + "]-[C" + (k + 2) + "]"; })), { want: { D2: 0, D3: 40, D4: -20, D5: 60 } });
S("U006", "Yearly costs", ["Bill | Monthly | Yearly", "Phone | 20 | =[Monthly]*12", "Water | 35.5 | =[Monthly]*12", "Total | =SUM([Monthly]) | =SUM([Yearly])"], { want: { C2: 240, C3: 426, B4: 55.5, C4: 666 } });
S("U007", "Budget", ["| Category | Budget | Spent | Left |", "|:--|--:|--:|--:|"].concat(bud.slice(1).map(function (l) { return "| " + l + " | =[Budget]-[Spent] |"; })).concat(["| Total | =SUM([Budget]) | =SUM([Spent]) | =SUM([Left]) |"]),
  { want: { D2: 0, D5: 60, B6: 1350, D6: 80 } });

// ---- running totals and rows that read the row above
S("R001", "Cash book", ["Date | In | Out | Balance", "1 Nov | 100 | 0 | =[In]-[Out]", "2 Nov | 0 | 30 | =[D2]+[In]-[Out]", "3 Nov | 50 | 0 | =[D3]+[In]-[Out]"], { want: { D2: 100, D3: 70, D4: 120 } });
S("R002", "Cash book", ["Date | In | Out | Balance", "1 Nov | 100 | 0 | =B2-C2", "2 Nov | 0 | 30 | =D2+B3-C3", "3 Nov | 50 | 0 | =D3+B4-C4"], { want: { D2: 100, D3: 70, D4: 120 } });
S("R003", "Savings", ["Year | Savings", "2024 | 1000", "2025 | =[B2]*1.05", "2026 | =[B3]*1.05", "2027 | =[B4]*1.05"], { want: { B3: 1050, B4: 1102.5, B5: 1157.625 } });
S("R004", "Mileage", ["Day | Start | End | Miles", "Mon | 12000 | 12045 | =[End]-[Start]", "Tue | 12045 | 12110 | =[End]-[Start]", "Total | | | =SUM([Miles])"], { want: { D2: 45, D3: 65, D4: 110 } });
S("R005", "Running total", ["Week | Sales | To date", "1 | 120 | =SUM([B$2:B2])", "2 | 80 | =SUM([B$2:B3])", "3 | 100 | =SUM([B$2:B4])"], { want: { C2: 120, C3: 200, C4: 300 }, formula: { C3: "=SUM(B$2:B3)" } });
S("R006", "Running total", ["Week | Sales | To date", "1 | 120 | =SUM(B$2:B2)", "2 | 80 | =SUM(B$2:B3)", "3 | 100 | =SUM(B$2:B4)"], { want: { C2: 120, C3: 200, C4: 300 } });
S("R007", "Cash book", ["Date | In | Out | Balance", "1 Nov | 100 | 0 | =[In]-[Out]", "2 Nov | 0 | 30 | =[D2]+[In]-[Out]", "3 Nov | 50 | 0 | =[D2]+[In]-[Out]"],
  { back: "either", want: { D2: 100, D3: 70, D4: 120 }, why: "row 4 reads the balance two rows up (copied from row 3)" });

// ---- units and fuel
S("F001", "Litres to gallons", ["Litres | Gallons", "10 | =CONVERT([Litres],\x22l\x22,\x22gal\x22)", "50 | =CONVERT([Litres],\x22l\x22,\x22gal\x22)"], { want: { B2: 2.64172052358148, B3: 13.2086026179074 } });
S("F002", "Pounds to kilograms", ["Pounds | Kilograms", "1 | =CONVERT([Pounds],\x22lb\x22,\x22kg\x22)", "10 | =CONVERT([Pounds],\x22lb\x22,\x22kg\x22)"], { want: { B2: 0.45359237, B3: 4.5359237 } });
S("F003", "Miles to km", ["Miles | Km", "5 | =[Miles]*1.609344", "26.2 | =[Miles]*1.609344"], { want: { B2: 8.04672, B3: 42.1648128 } });
S("F004", "Fuel", ["Trip | Miles | MPG | Gallons", "Work | 30 | 40 | =[Miles]/[MPG]", "Coast | 180 | 45 | =[Miles]/[MPG]", "Total | =SUM([Miles]) | | =SUM([Gallons])"], { want: { D2: 0.75, D3: 4, B4: 210, D4: 4.75 } });
S("F005", "Fuel cost", ["Fill | Litres | Price per litre | Cost", "1 | 40 | 1.45 | =[Litres]*[Price per litre]", "2 | 35 | 1.52 | =[Litres]*[Price per litre]", "Total | =SUM([Litres]) | | =SUM([Cost])"], { want: { D2: 58, D3: 53.2, B4: 75, D4: 111.2 } });
S("F006", "Speeds", ["Trip | Distance (km) | Time (h) | Speed (km/h)", "A | 120 | 1.5 | =[km]/[h]", "B | 300 | 4 | =[km]/[h]"], { want: { D2: 80, D3: 75 } });
S("F007", "Weights", ["Item | Weight (kg) | Weight (lb)", "Bag | 20 | =[kg]*2.20462", "Box | 5 | =[kg]*2.20462"], { want: { C2: 44.0924, C3: 11.0231 } });
S("F008", "Shipping", ["Parcel | Weight (kg) | Rate per kg | Cost", "A | 2.5 | 4 | =[Weight (kg)]*[Rate per kg]", "B | 10 | 3.5 | =[Weight (kg)]*[Rate per kg]", "Total | | | =SUM([Cost])"], { want: { D2: 10, D3: 35, D4: 45 } });
S("F009", "Tyre pressures", ["Tyre | psi | kPa", "Front | 32 | =CONVERT([psi],\x22psi\x22,\x22kPa\x22)", "Rear | 36 | =CONVERT([psi],\x22psi\x22,\x22kPa\x22)"], { want: { C2: 220.632233381387, C3: 248.211262554061 } });
S("F010", "Fuel economy", ["Car | Miles | Gallons | MPG", "Van | 300 | 10 | =[Miles]/[Gallons]", "Car | 420 | 10.5 | =[Miles]/[Gallons]", "Average | | | =AVERAGE([MPG])"], { want: { D2: 30, D3: 40, D4: 35 } });

// ---- headers that look like cells, and names a header begins with
S("H001", "Vitamin B", ["Food | B1 | B2 | B12 | Total", "Egg | 0.04 | 0.2 | 0.6 | =[B1]+[B2]+[B12]", "Milk | 0.05 | 0.18 | 0.45 | =[B1]+[B2]+[B12]"], { want: { E2: 0.84, E3: 0.68 }, why: "the vitamins B1, B2, B12 are columns" });
S("H002", "Sales by quarter", ["Product | Q1 | Q2 | Q3 | Q4 | Year", "Tea | 10 | 12 | 9 | 15 | =[Q1]+[Q2]+[Q3]+[Q4]", "Coffee | 20 | 18 | 22 | 25 | =[Q1]+[Q2]+[Q3]+[Q4]", "Total | =SUM([Q1]) | =SUM([Q2]) | =SUM([Q3]) | =SUM([Q4]) | =SUM([Year])"],
  { want: { F2: 46, F3: 85, B4: 30, E4: 40, F4: 131 } });
S("H003", "Change", ["Region | Q4 sales | Q3 sales | Change", "North | 120 | 100 | =[Q4]-[Q3]", "South | 80 | 95 | =[Q4]-[Q3]"], { want: { D2: 20, D3: -15 }, why: "[Q4] is the column Q4 sales" });
S("H004", "Robots", ["Robot | C3PO | Total", "Arms | 2 | =[C3]*2", "Legs | 2 | =[C3]*2"], { want: { C2: 4, C3: 4 }, why: "[C3] is the column C3PO (the rule's own example)" });
S("H005", "Concrete", ["Mix | C20 | C30", "Cement kg | 300 | 350", "Sand kg | 700 | 650", "Total | =SUM([C20]) | =SUM([C30])"], { want: { B4: 1000, C4: 1000 } });
S("H006", "Bins", ["Part | A1 | B2 | Total", "Bolts | 10 | 5 | =[A1]+[B2]", "Nuts | 7 | 3 | =[A1]+[B2]"], { want: { D2: 15, D3: 10 }, why: "bins named A1 and B2 are columns" });
S("H007", "Bins", ["Part | A1 | B2 | Total", "Bolts | 10 | 5 | =[A1]+[B2]+[C3]", "Nuts | 7 | 3 | =[A1]+[B2]+[C3]"], { back: true, msg: "\\[C3\\]", why: "beside bins A1 and B2, [C3] is a bin the table lacks" });
S("H008", "Weeks", ["Name | Wk1 | Wk2 | Wk3 | Wk4 | Total", "Ann | 5 | 6 | 4 | 7 | =[Wk1]+[Wk2]+[Wk3]+[Wk4]", "Ben | 3 | 3 | 5 | 2 | =[Wk1]+[Wk2]+[Wk3]+[Wk4]"], { want: { F2: 22, F3: 13 } });
S("H009", "Emissions", ["Part | CO2 (kg) | Count | Total CO2", "Panel | 12 | 3 | =[CO2]*[Count]", "Frame | 5 | 4 | =[CO2]*[Count]"], { want: { D2: 36, D3: 20 } });
S("H010", "Paper", ["Order | A4 | A5 | Sheets", "Office | 500 | 200 | =[A4]+[A5]", "School | 1000 | 0 | =[A4]+[A5]"], { want: { D2: 700, D3: 1000 } });
S("H011", "Quarters", ["Product | Q1 | Q2 | Q3 | Q4 | Year", "Tea | 10 | 12 | 9 | 15 | =SUM([B2:E2])", "Coffee | 20 | 18 | 22 | 25 | =SUM([B3:E3])"], { want: { F2: 46, F3: 85 }, why: "a range under headers Q1 to Q4 is cells" });
S("H012", "Shelves", ["Item | B2 shelf | Count", "Tape | 4 | =[B2]*2", "Glue | 6 | =[B2]*2"], { want: { C2: 8, C3: 12 }, why: "[B2] is the column B2 shelf (the rule's own example)" });
S("H013", "Mixes", ["Mix | C20 | C25 | Total", "Site A | 4 | 2 | =[B2]+[C2]", "Site B | 1 | 3 | =[B3]+[C3]"], { want: { D2: 6, D3: 4 }, why: "[C2] is not the column C20: it is the cell C2" });

// ---- 26 columns
var weeks = []; for (var w = 1; w <= 24; w++) weeks.push("W" + w);
var ones = weeks.map(function (x, k) { return String(k + 1); });
S("W001", "Half a year", ["Name | " + weeks.join(" | ") + " | Total", "Ann | " + ones.join(" | ") + " | =SUM(B2:Y2)"], { want: { Z2: 300 } });
S("W002", "Too wide", ["Name | " + weeks.join(" | ") + " | W25 | Total", "Ann | " + ones.join(" | ") + " | 25 | =SUM(B2:Z2)"], { back: true, msg: "26 columns" });
var qs = []; for (var k2 = 1; k2 <= 12; k2++) qs.push("Q" + k2);
S("W003", "Quiz", ["Name | " + qs.join(" | ") + " | Score | Percent", "Ann | 1 | 1 | 0 | 1 | 1 | 1 | 0 | 1 | 1 | 1 | 1 | 0 | =SUM(B2:M2) | =[Score]/12*100"], { want: { N2: 9, O2: 75 } });
S("W004", "Half a year", ["Name | " + weeks.join(" | ") + " | Double", "Ann | " + ones.join(" | ") + " | =[Y2]*2"], { want: { Z2: 48 } });
S("W005", "Half a year", ["Name | " + weeks.join(" | ") + " | Total", "Ann | " + ones.join(" | ") + " | =[W1]+[W2]+[W24]"], { want: { Z2: 27 }, why: "[W1] is the column W1 though a cell W1 is past the table" });

// ---- $ kept
var tax = ["Item | Price | Tax | Total"];
S("D001", "Tax", tax.concat(["Book | 10 | =[B2]*[$B$5] | =[Price]+[Tax]", "Pen | 2 | =[B3]*[$B$5] | =[Price]+[Tax]", "Bag | 25 | =[B4]*[$B$5] | =[Price]+[Tax]", "Tax rate | 0.2"]),
  { want: { C2: 2, C3: 0.4, C4: 5, D2: 12, D3: 2.4, D4: 30 }, formula: { C3: "=B3*$B$5" } });
S("D002", "Tax", tax.concat(["Book | 10 | =[Price]*[B$5] | =[Price]+[Tax]", "Pen | 2 | =[Price]*[B$5] | =[Price]+[Tax]", "Bag | 25 | =[Price]*[B$5] | =[Price]+[Tax]", "Tax rate | 0.2"]),
  { want: { C2: 2, C3: 0.4, C4: 5, D4: 30 } });
S("D003", "Tax", tax.concat(["Book | 10 | =[B2]*[$B$5] | =[Price]+[Tax]", "Pen | 2 | =[B2]*[$B$5] | =[Price]+[Tax]", "Bag | 25 | =[B2]*[$B$5] | =[Price]+[Tax]", "Tax rate | 0.2"]),
  { back: true, msg: "for row 3 write =B3\\*\\$B\\$5", want: { C3: 0.4, C4: 5, D3: 2.4, D4: 30 }, why: "row 2's formula copied down beside a fixed $B$5" });
S("D004", "Tax", tax.concat(["Book | 10 | =B2*$B$5 | =B2+C2", "Pen | 2 | =B3*$B$5 | =B3+C3", "Bag | 25 | =B4*$B$5 | =B4+C4", "Tax rate | 0.2"]), { want: { C2: 2, C3: 0.4, C4: 5, D4: 30 } });

// ---- outside the table
S("O001", "Shopping", ["Item | Qty | Price | Cost", "Bread | 2 | 1.50 | =[B2]*[F2]", "Milk | 1 | 0.99 | =[B3]*[F3]"], { back: true, msg: "\\[F2\\]" });
S("O002", "Shopping", ["Item | Qty | Price | Cost", "Bread | 2 | 1.50 | =[B2]*[AA2]", "Milk | 1 | 0.99 | =[B3]*[AA3]"], { back: true, msg: "\\[AA2\\]" });
S("O003", "Shopping", ["Item | Qty | Price | Cost", "Bread | 2 | 1.50 | =[B2]*[C2]", "Milk | 1 | 0.99 | =[B3]*[C3]", "Total | | | =[D2]+[D3]+[D9]"], { back: true, msg: "\\[D9\\]" });

// ---- more right replies of the kinds small models write
S("M001", "Recipe for 6", ["Ingredient | For 4 | For 6", "Flour g | 200 | =[For 4]*6/4", "Sugar g | 100 | =[For 4]*6/4", "Eggs | 2 | =[For 4]*6/4"], { want: { C2: 300, C3: 150, C4: 3 } });
S("M002", "Recipe for 6", ["Ingredient | For 4 | For 6", "Flour g | 200 | =[B2]*1.5", "Sugar g | 100 | =[B3]*1.5", "Eggs | 2 | =[B4]*1.5"], { want: { C2: 300, C3: 150, C4: 3 } });
S("M003", "Electricity", ["Appliance | Watts | Hours a day | kWh a day | Cost a day", "Fridge | 150 | 24 | =[Watts]*[Hours a day]/1000 | =[kWh a day]*0.30", "TV | 100 | 4 | =[Watts]*[Hours a day]/1000 | =[kWh a day]*0.30", "Total | | | =SUM([kWh a day]) | =SUM([Cost a day])"],
  { want: { D2: 3.6, D3: 0.4, E2: 1.08, E3: 0.12, D4: 4, E4: 1.2 } });
S("M004", "Electricity", ["Appliance | Watts | Hours | kWh", "Heater | 2000 | 3 | =CONVERT([Watts]*[Hours],\x22Wh\x22,\x22kWh\x22)", "Kettle | 3000 | 0.5 | =CONVERT([Watts]*[Hours],\x22Wh\x22,\x22kWh\x22)"], { want: { D2: 6, D3: 1.5 } });
S("M005", "Area", ["Room | Length | Width | Area", "Kitchen | 4 | 3 | =[Length]*[Width]", "Hall | 6 | 1.2 | =[Length]*[Width]", "Total | | | =SUM([Area])"], { want: { D2: 12, D3: 7.2, D4: 19.2 } });
S("M006", "Paint for two rooms", ["Room | Wall area m2 | Litres per m2 | Litres", "Hall | 24 | 0.1 | =[Wall area m2]*[Litres per m2]", "Kitchen | 30 | 0.1 | =[Wall area m2]*[Litres per m2]", "Total | | | =SUM([Litres])"],
  { want: { D2: 2.4, D3: 3, D4: 5.4 }, why: "the prompt's own example" });
S("M007", "Loan", ["Month | Opening | Interest | Payment | Closing", "1 | 1000 | =[Opening]*0.01 | 100 | =[Opening]+[Interest]-[Payment]", "2 | =[E2] | =[Opening]*0.01 | 100 | =[Opening]+[Interest]-[Payment]", "3 | =[E3] | =[Opening]*0.01 | 100 | =[Opening]+[Interest]-[Payment]"],
  { want: { E2: 910, B3: 910, C3: 9.1, E3: 819.1, E4: 727.291 } });
S("M008", "Hours worked", ["Day | Start | End | Hours", "Mon | 9 | 17 | =[End]-[Start]", "Tue | 8.5 | 16 | =[End]-[Start]", "Wed | 9 | 13 | =[End]-[Start]", "Total | | | =SUM([Hours])", "Pay at 12 | | | =[D5]*12"], { want: { D2: 8, D3: 7.5, D4: 4, D5: 19.5, D6: 234 } });
S("M009", "Discount", ["Item | Price | Discount % | Sale price", "Coat | 80 | 25 | =[Price]*(1-[Discount %]/100)", "Hat | 20 | 10 | =[Price]*(1-[Discount %]/100)"], { want: { D2: 60, D3: 18 } });
S("M010", "Split the bill", ["Person | Share", "Ann | =[B5]/3", "Ben | =[B5]/3", "Cara | =[B5]/3", "Bill | 90"], { want: { B2: 30, B3: 30, B4: 30 }, why: "each share reads the bill in B5 (not a copy of row 2's own cells)" });
S("M011", "Garden", ["Bed | Length m | Width m | Area m2 | Compost bags", "Front | 3 | 1 | =[Length m]*[Width m] | =ROUNDUP([Area m2]/2,0)", "Back | 5 | 1.5 | =[Length m]*[Width m] | =ROUNDUP([Area m2]/2,0)"], { want: { D2: 3, E2: 2, D3: 7.5, E3: 4 } });
S("M012", "Times table", ["n | x7", "1 | =[n]*7", "2 | =[n]*7", "3 | =[n]*7"], { want: { B2: 7, B3: 14, B4: 21 } });
S("M013", "Times table", ["n | x7", "1 | =[A2]*7", "2 | =[A3]*7", "3 | =[A4]*7"], { want: { B2: 7, B3: 14, B4: 21 } });
S("M014", "Pay", ["Name | Hours | Rate | Pay", "Ann | 38 | 12.5 | =[B2]*[C2]", "Ben | 20 | 11 | =[B3]*[C3]", "Total | =SUM([B2:B3]) | | =SUM([D2:D3])"], { want: { D2: 475, D3: 220, B4: 58, D4: 695 } });
S("M015", "Unit prices", ["Item | Price | Grams | Price per kg", "Rice | 2.40 | 1000 | =[Price]/[Grams]*1000", "Oats | 1.20 | 500 | =[Price]/[Grams]*1000"], { want: { D2: 2.4, D3: 2.4 } });

var inv = ["Item | Qty | Price | Cost", "Bread | 2 | 1.50 | =[Qty]*[Price]", "Milk | 1 | 0.99 | =[Qty]*[Price]", "Eggs | 12 | 0.25 | =[Qty]*[Price]"];
S("M016", "Invoice", inv.concat(["Subtotal | | | =SUM([Cost])", "VAT 20% | | | =[D5]*0.2", "Total | | | =[D5]+[D6]"]), { want: { D5: 6.99, D6: 1.398, D7: 8.388 }, why: "VAT on the subtotal, under three line formulas" });
S("M017", "Invoice", inv.concat(["Subtotal | | | =SUM([Cost])", "VAT 20% | | | =D5*0.2", "Total | | | =D5+D6"]), { want: { D5: 6.99, D6: 1.398, D7: 8.388 } });
S("M018", "Bill", inv.concat(["Subtotal | | | =SUM([Cost])", "Tip 10% | | | =[D5]*0.1"]), { want: { D5: 6.99, D6: 0.699 } });
S("M019", "Shares", ["Item | Qty | Price | Cost | Share", "Bread | 2 | 1.50 | =[Qty]*[Price] | =[Cost]/[$D$5]", "Milk | 1 | 0.99 | =[Qty]*[Price] | =[Cost]/[$D$5]", "Eggs | 12 | 0.25 | =[Qty]*[Price] | =[Cost]/[$D$5]", "Total | | | =SUM([Cost])"],
  { want: { E2: 3 / 6.99, E3: 0.99 / 6.99, E4: 3 / 6.99 } });
S("M020", "Shares", ["Item | Cost | Share", "Bread | 3 | =[Cost]/SUM([Cost])", "Milk | 0.99 | =[Cost]/SUM([Cost])", "Eggs | 3 | =[Cost]/SUM([Cost])"], { back: "either", want: { C2: 3 / 6.99, C3: 0.99 / 6.99 }, why: "SUM([Cost]) in a data row: the model meant the whole column" });
S("M021", "Ages", ["Name | Born | Age in 2026", "Ann | 1990 | =2026-[Born]", "Ben | 2001 | =2026-[Born]"], { want: { C2: 36, C3: 25 } });
S("M022", "BMI", ["Name | Weight kg | Height m | BMI", "Ann | 60 | 1.65 | =ROUND([Weight kg]/[Height m]^2,1)", "Ben | 82 | 1.8 | =ROUND([Weight kg]/[Height m]^2,1)"], { want: { D2: 22, D3: 25.3 } });
S("M023", "Order", ["Item | Price | Qty | Line total", "Nails | 0.05 | 200 | =[Price]*[Qty]", "Screws | 0.08 | 150 | =[Price]*[Qty]", "Total | | =SUM([Qty]) | =SUM([Line total])"], { want: { D2: 10, D3: 12, C4: 350, D4: 22 } });
S("B035", "Shopping", ["Item | Qty | Price | Cost", "Bread | 2 | 1.50 | =B2*C2", "Milk | 1 | 0.99 | =B2*C2", "Total | | | =SUM(D2:D3)"], { q: SHOP, back: true, want: { D3: 0.99, D4: 3.99 }, why: "row 2's plain formula copied to row 3" });
S("D005", "Exchange", ["Item | GBP | EUR", "Tea | 4 | =[B2]*[$B$5]", "Cake | 3 | =[B2]*[$B$5]", "Coffee | 2.5 | =[B2]*[$B$5]", "Rate | 1.17"],
  { back: true, msg: "for row 3 write =B3\\*\\$B\\$5", want: { C3: 3.51, C4: 2.925 }, why: "row 2's formula copied down: B2 still, beside a fixed $B$5 rate" });
S("D006", "Exchange", ["Item | GBP | EUR", "Tea | 4 | =[B2]*[$B$5]", "Cake | 3 | =[B3]*[$B$5]", "Coffee | 2.5 | =[B4]*[$B$5]", "Rate | 1.17"], { want: { C2: 4.68, C3: 3.51, C4: 2.925 } });
S("R008", "Cash book", ["Date | In | Out | Balance", "1 Nov | 100 | 0 | =B2-C2", "2 Nov | 0 | 30 | =D2+B3-C3", "3 Nov | 50 | 0 | =D2+B4-C4"], { back: "either", want: { D4: 120 }, why: "as R007, plain names" });

process.stdout.write(JSON.stringify(cases, null, 1) + "\n");

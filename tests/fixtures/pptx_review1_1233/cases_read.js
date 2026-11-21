// cases_read.js -- review 1 of 1.24.33: PowerPoint files people have, read by Lantern.pptx.read. Each case says what a
// person looking at the slide in PowerPoint would expect as its title, its text (order, bullets, levels), its picture,
// its notes, and what should be said as not kept. The decks are made by make_decks.py (decks/).
"use strict";
var cases = [];
function sl(r, n) { return r.slides[n - 1] || { h: "<no slide " + n + ">", body: "" }; }
function q(s) { return JSON.stringify(s); }
function short(s) { s = String(s); return s.length > 220 ? s.slice(0, 220) + "..." : s; }
// C(id, harm, deck, input, right, check(r, x) -> "" | what happened)
function C(id, harm, deck, input, right, check) {
  cases.push({ id: id, harm: harm, input: deck + ": " + input, right: right, run: function (x) {
    var r = x.read(deck);
    if (r.error && !/^w_|_bad_|truncated|no_content|locked/.test(deck)) return Promise.resolve("refused the whole deck: " + r.error);
    try { return Promise.resolve(check(r, x) || ""); } catch (e) { return Promise.resolve("the check could not run: " + e.message); }
  } });
}
function title(n, want) { return function (r) { var h = sl(r, n).h; return h === want ? "" : "slide " + n + "'s title is " + q(h) + ", not " + q(want); }; }
function body(n, want) { return function (r) { var b = sl(r, n).body; return b === want ? "" : "slide " + n + "'s text is " + short(b); }; }
function both(n, h, b) { return function (r) { return title(n, h)(r) || body(n, b)(r); }; }
// seq(n, [[kind, depth, text], ...]): the lines a person sees, each with its bullet kind ("p" none, "ul", "ol") and level
function seq(n, want) {
  return function (r, x) {
    var got = x.lines(sl(r, n).body).map(function (l) { return [l.k, l.d, l.t]; });
    return JSON.stringify(got) === JSON.stringify(want) ? "" : "slide " + n + " reads " + short(JSON.stringify(got));
  };
}
// order(n, texts): each text is on the slide (its body), in this order
function order(n, texts) {
  return function (r, x) {
    var t = x.plain(sl(r, n).body), at = -1, out = [];
    for (var i = 0; i < texts.length; i++) {
      var k = t.indexOf(texts[i]);
      if (k < 0) return "slide " + n + " lacks " + q(texts[i]) + ": " + short(t);
      out.push(k);
    }
    for (i = 1; i < out.length; i++) if (out[i] < out[i - 1]) return "slide " + n + " reads in another order: " + short(t);
    return "";
  };
}
function notes(n, want) { return function (r) { var s = sl(r, n).notes; return s === want ? "" : "slide " + n + "'s notes are " + q(s); }; }
function said(re, what) { return function (r, x) { return re.test(x.said(r)) ? "" : "did not say " + what + "; said: " + short(x.said(r)); }; }
function notSaid(re, what) { return function (r, x) { return re.test(x.said(r)) ? "said " + what + ": " + short(x.said(r).match(re)[0]) : ""; }; }
function pic(n, mime) {
  return function (r) {
    var s = sl(r, n);
    if (!mime) return s.img ? "slide " + n + " has a picture" : "";
    return s.img && s.img.indexOf("data:" + mime + ";") === 0 ? "" : "slide " + n + "'s picture is " + (s.img ? s.img.slice(0, 30) : "missing");
  };
}
function pngSize(img) { var b = Buffer.from(img.split(",")[1], "base64"); return [b.readUInt32BE(16), b.readUInt32BE(20)]; }
function all() { var fs = Array.prototype.slice.call(arguments); return function (r, x) { for (var i = 0; i < fs.length; i++) { var m = fs[i](r, x); if (m) return m; } return ""; }; }
function count(n) { return function (r) { return r.slides.length === n ? "" : r.slides.length + " slides, not " + n; }; }
function refused(re, what) { return function (r) { return r.error ? (re.test(r.error) ? "" : "refused with " + q(r.error) + "; it should say " + what) : "opened it (" + r.slides.length + " slides) instead of refusing it"; }; }

// --- d01: an ordinary course deck (python-pptx, 16:9), one slide of each usual layout ----------------------------------
var D1 = "d01_course.pptx";
C("d01-count", "high", D1, "eleven slides of PowerPoint's usual layouts", "All eleven slides come in, in order.", count(11));
C("d01-title-slide", "high", D1, "Title Slide: a title and a subtitle", "The title is the slide's title; the subtitle is a plain line under it, with no bullet (the layout's subtitle has none).",
  both(1, "Forklift Safety Refresher", "<p>Warehouse crew, March 2026</p>"));
C("d01-deck-title", "low", D1, "the file's title property is \u201cForklift refresher\u201d", "The deck takes the file's own title.", function (r) { return r.title === "Forklift refresher" ? "" : "the deck is called " + q(r.title); });
C("d01-bullets", "high", D1, "Title and Content: four points", "Four bulleted points, in order.",
  both(2, "Daily checks", "<ul><li>Tyres and forks</li><li>Hydraulic hoses for leaks</li><li>Horn, lights and alarm</li><li>Seat belt latches</li></ul>"));
C("d01-notes", "high", D1, "speaker notes of two paragraphs", "The notes come with the slide, a line each.", notes(2, "Walk round the truck with them.\nPoint at each item."));
C("d01-levels", "high", D1, "points at three levels", "Sub-points sit under their points, at their levels, each with a bullet.",
  seq(3, [["ul", 1, "Keep the load low"], ["ul", 2, "About 15 cm above the floor"], ["ul", 2, "Mast tilted back"], ["ul", 1, "Look where you are going"], ["ul", 2, "Reverse if the load blocks your view"], ["ul", 3, "Sound the horn at blind corners"]]));
C("d01-section", "high", D1, "Section Header: title and a line of text", "The title, and the line as plain text (the layout's text box has no bullets).", both(4, "Part 2: Charging", "<p>Batteries, gas and fire</p>"));
C("d01-two-content", "high", D1, "Two Content: two bulleted columns", "The left column's points, then the right column's, all bulleted.",
  all(order(5, ["Do wear the seat belt", "Do lower the forks", "Don\u2019t carry passengers", "Don\u2019t speed"]), function (r, x) { return x.lines(sl(r, 5).body).every(function (l) { return l.k === "ul"; }) ? "" : "a column lost its bullets"; }));
C("d01-comparison", "high", D1, "Comparison: a heading over each of two columns of points", "Each heading is read with its own points: Electric, its two points, then Gas (LPG), its two points. The headings have no bullets.",
  all(order(6, ["Electric", "Quiet", "Charge overnight", "Gas (LPG)", "Change the cylinder outdoors", "No charging time"]),
      function (r, x) { var ls = x.lines(sl(r, 6).body); return ls.filter(function (l) { return /^(Electric|Gas)/.test(l.t); }).every(function (l) { return l.k === "p"; }) ? "" : "a heading has a bullet"; }));
C("d01-textbox", "high", D1, "Title Only, with a text box of two lines", "The title, then the two lines with no bullets (a text box has none).", both(7, "Who to call", "<p>Supervisor: ext. 214</p><p>First aid: ext. 999</p>"));
C("d01-no-title-box", "medium", D1, "a Blank slide with one short line at the top", "The line is the slide's title, and Lantern says it took it from the first line (slide 8).",
  all(both(8, "Any questions?", ""), said(/first line as its title \(slide 8\)/, "that slide 8's title came from its first line")));
C("d01-picture-caption", "high", D1, "Picture with Caption: a photo in the picture box, a title and a caption", "The title, the caption as plain text, the photo as the slide's picture.",
  all(both(9, "Worn fork heel", "<p>Replace the fork at 10% wear</p>"), pic(9, "image/png")));
C("d01-looks", "medium", D1, "points with a bold and an italic run", "Bold and italic kept on just those words.",
  body(10, "<ul><li><b>10 km/h</b> in the yard</li><li><i>Walking pace</i> in the aisles</li></ul>"));
C("d01-notes-2", "high", D1, "notes on slide 10", "The notes come with slide 10.", notes(10, "Ask who has been warned.\nShow the signs."));
C("d01-content-caption", "medium", D1, "Content with Caption: four points in the big box, a caption beside", "The title, the four points bulleted, and the caption: nothing missing.",
  all(title(11, "Fire extinguisher"), function (r, x) { var t = x.plain(sl(r, 11).body); return ["Pull the pin", "Aim at the base", "Squeeze", "Sweep side to side", "Remember PASS"].every(function (s) { return t.indexOf(s) >= 0; }) ? "" : "text missing: " + t; }));
C("d01-said-layout", "low", D1, "the deck as a whole", "Lantern says the layout (positions, fonts, colours) is not kept, and nothing else but the title it took.",
  all(said(/the layout/, "the layout"), function (r) { return r.notes.length === 2 ? "" : "said " + r.notes.length + " things: " + short(r.notes.join(" | ")); }));

// --- d02: numbered lists -------------------------------------------------------------------------------------------
var D2 = "d02_numbers.pptx";
C("d02-numbered", "high", D2, "a numbered list (1. 2. 3. 4.)", "A numbered list of four, in order.", body(1, "<ol><li>Tell the operator</li><li>Switch off</li><li>Lock and tag</li><li>Prove dead</li></ol>"));
C("d02-start-5", "high", D2, "numbers starting at 5", "The list starts at 5.", body(2, "<ol start=\x225\x22><li>Refit the guard</li><li>Remove your lock</li></ol>"));
C("d02-letters", "medium", D2, "a lettered list, a) and b) (alphaLcParenR)", "The choices read a) and b), as PowerPoint shows them; a list numbered 1. and 2. names them differently from the talk (\u201canswer b\u201d).",
  function (r) { var b = sl(r, 3).body; return /type=\x22a\x22|a\)/.test(b) ? "" : "a lettered list became " + b + " (shown 1. 2.)"; });
C("d02-roman", "medium", D2, "a list numbered I. II. III. (romanUcPeriod)", "Parts I, II and III, as PowerPoint shows them.",
  function (r) { var b = sl(r, 4).body; return /type=\x22I\x22|\bI\./.test(b) ? "" : "a roman-numbered list became " + b + " (shown 1. 2. 3.)"; });
C("d02-sub-bullets", "high", D2, "1. Isolate, two bulleted details, 2. Prove dead", "The details hang under step 1 with bullets, and Prove dead is step 2.",
  body(5, "<ol><li>Isolate<ul><li>At the main breaker</li><li>And at the local switch</li></ul></li><li>Prove dead</li></ol>"));
C("d02-textbox-numbers", "medium", D2, "numbers 1) 2) in a plain text box", "A numbered list of two.", seq(6, [["ol", 1, "Fill the tank"], ["ol", 1, "Check the level"]]));
C("d02-numbered-by-box", "medium", D2, "a content box whose own list style numbers its first level", "Numbered, though the paragraphs say nothing of numbers.", seq(7, [["ol", 1, "Read the plate"], ["ol", 1, "Set the dial"]]));

// --- d03: bullets inherited (or not) from the layout and the master -------------------------------------------------
var D3 = "d03_inherit.pptx", D3b = "d03b_master.pptx";
C("d03-layout-none", "high", D3, "a layout whose content box has no bullet at level 1 (master has bullets)", "Level-1 lines have no bullets; the level-2 line keeps the master's dash.",
  seq(1, [["p", 0, "A plain line"], ["p", 0, "Another plain line"], ["ul", 1, "A dash under it"]]));
C("d03-shape-none", "high", D3, "two columns; the left box's own list style turns bullets off", "Left lines plain, right lines bulleted.", seq(2, [["p", 0, "Left one"], ["p", 0, "Left two"], ["ul", 1, "Right one"], ["ul", 1, "Right two"]]));
C("d03-own-bullet", "medium", D3, "Section Header text (no bullets) with one paragraph asking for a bullet", "Only that paragraph has a bullet.", seq(3, [["ul", 1, "Has its own bullet"], ["p", 0, "Has none"]]));
C("d03-subtitle-lines", "high", D3, "a subtitle of two lines", "Two plain lines (a subtitle has no bullets).", body(4, "<p>First subtitle line</p><p>Second subtitle line</p>"));
C("d03-zero-indent", "low", D3, "a content-box paragraph with its indent set to 0 (no bullet setting)", "PowerPoint still draws the bullet (moving the indent does not remove it), so a bullet. Not sure of every version: low.",
  seq(5, [["ul", 1, "Still a bullet"]]));
C("d03-textbox-level2", "medium", D3, "a text box with a level-2 line", "No bullets in a text box at any level.", seq(6, [["p", 0, "Level one line"], ["p", 0, "Level two line"]]));
C("d03-bullet-off", "high", D3, "bullets turned off on one paragraph by hand", "That paragraph plain, the next bulleted.", seq(7, [["p", 0, "No bullet here"], ["ul", 1, "A bullet here"]]));
C("d03b-master-none", "high", D3b, "a master whose first level has no bullet", "Plain lines.", body(1, "<p>Plain one</p><p>Plain two</p>"));
C("d03b-layout-back", "high", D3b, "the same master; a layout's left box gives a dash back", "Left line bulleted, right line plain.", seq(2, [["ul", 1, "Dashed one"], ["p", 0, "Plain right"]]));

// --- d04: tables ------------------------------------------------------------------------------------------------------
var D4 = "d04_tables.pptx";
C("d04-header", "high", D4, "a torque table with a header row", "Every cell, the header row as headers.",
  body(1, "<table><tr><th>Bolt</th><th>Torque</th><th>Notes</th></tr><tr><td>M8</td><td>25 Nm</td><td>dry</td></tr><tr><td>M10</td><td>49 Nm</td><td>dry</td></tr><tr><td>M12</td><td>85 Nm</td><td>oiled: 75 Nm</td></tr></table>"));
C("d04-merged", "high", D4, "a rota with a cell joined down two rows and a cell joined across two columns", "The joined cells stay joined; no cell is repeated or lost.",
  body(2, "<table><tr><th>Day</th><th>Early</th><th>Late</th></tr><tr><td>Mon</td><td rowspan=\x222\x22>Anna</td><td>Ben</td></tr><tr><td>Tue</td><td>Cara</td></tr><tr><td>Wed</td><td colspan=\x222\x22>Dev</td></tr></table>"));
C("d04-in-placeholder", "high", D4, "a table put in the content box", "The table, with the title.", both(3, "A table in the content box", "<table><tr><th>Size</th><th>Fuse</th></tr><tr><td>1.5 mm\u00b2</td><td>16 A</td></tr></table>"));
C("d04-no-header", "medium", D4, "a table without a header row", "Plain cells only.", body(4, "<table><tr><td>Water</td><td>Blue</td></tr><tr><td>Gas</td><td>Yellow</td></tr></table>"));
C("d04-text-above", "medium", D4, "a line of text above a table", "The line, then the table.", order(5, ["Check these before you start:", "Item", "Guard"]));
C("d04-two-lines", "medium", D4, "a cell of two paragraphs", "Both lines in the cell.", function (r) { return /Isolate<br>then lock/.test(sl(r, 6).body) ? "" : sl(r, 6).body; });

// --- d05: charts --------------------------------------------------------------------------------------------------------
var D5 = "d05_charts.pptx";
C("d05-column", "medium", D5, "a column chart with a title", "Its title and a table of its numbers.",
  body(1, "<p><b>Units sold</b></p><table><tr><th></th><th>Sales</th></tr><tr><td>Q1</td><td>10</td></tr><tr><td>Q2</td><td>20</td></tr><tr><td>Q3</td><td>30</td></tr><tr><td>Q4</td><td>40</td></tr></table>"));
C("d05-pie-percent", "low", D5, "a pie of shares, its numbers formatted 0% (50%, 30%, 20%)", "The numbers as the chart shows them: 50%, 30%, 20%.",
  function (r) { return /50%/.test(sl(r, 2).body) ? "" : "shows " + (sl(r, 2).body.match(/<td>0\.\d<\x2Ftd>/g) || []).join(" ") + " (the stored fractions, not the percentages)"; });
C("d05-two-series", "medium", D5, "a line chart of two years", "A column for each year, a row for each month.", seq(3, [["tr", 0, "| 2025 | 2026"], ["tr", 0, "Jan | 5 | 6"], ["tr", 0, "Feb | 6 | 8"], ["tr", 0, "Mar | 7 | 9"]]));
C("d05-scatter", "low", D5, "an XY scatter chart", "Each point's x and y.", seq(4, [["tr", 0, "| Pump A"], ["tr", 0, "1 | 2.5"], ["tr", 0, "2 | 4.0"], ["tr", 0, "3 | 5.5"]]));
C("d05-text-beside-chart", "medium", D5, "Two Content: points on the left, a chart on the right (its top 0.15 in above the points')", "The points first, then the chart (left column, then right).",
  order(5, ["Hours are rising", "Plan the service", "Pump 1"]));
C("d05-dates", "low", D5, "a line chart by month (dates)", "The months as dates (Jan 2025 ...), not day numbers.", function (r) { return /4565\d/.test(sl(r, 6).body) ? "months shown as day numbers: " + sl(r, 6).body.match(/4565\d[.\d]*/)[0] : ""; });
C("d05-said", "low", D5, "six charts", "Says the charts were kept as tables, with their slides.", said(/charts? kept as tables? of (its|their) numbers.*\(slides 1, 2, 3, 4, 5 and 6\)/, "the charts kept as tables"));

// --- d06: pictures ----------------------------------------------------------------------------------------------------
var D6 = "d06_pictures.pptx";
C("d06-only-picture", "high", D6, "a Blank slide that is one photo", "No title, no text, the photo.", all(both(1, "", ""), pic(1, "image/png")));
C("d06-beside", "high", D6, "points on the left, a portrait photo in the right content box", "The points and the photo (300 by 400).",
  all(body(2, "<ul><li>Check the guard</li><li>Check the belt</li></ul>"), pic(2, "image/png"), function (r) { var s = pngSize(sl(r, 2).img); return s[0] === 300 && s[1] === 400 ? "" : "kept a " + s.join("x") + " picture"; }));
C("d06-largest", "medium", D6, "a small logo in the corner and a big photo", "The big photo kept; the logo said as not kept.",
  all(function (r) { var s = sl(r, 3).img ? pngSize(sl(r, 3).img) : []; return s[0] === 300 ? "" : "kept " + s.join("x"); }, said(/1 more picture.*\(slide 3\)/, "the other picture on slide 3")));
C("d06-jpeg", "medium", D6, "a JPEG photo", "Kept.", pic(4, "image/jpeg"));
C("d06-gif", "low", D6, "a GIF", "Kept.", pic(5, "image/gif"));
C("d06-tiff", "medium", D6, "a TIFF scan", "Not shown by browsers: said, with its slide.", all(pic(6, null), said(/TIFF.*\(slide 6\)/, "the TIFF on slide 6")));
C("d06-svg", "low", D6, "an icon PowerPoint keeps as SVG with a PNG beside it", "The PNG kept; nothing said about slide 7.", all(pic(7, "image/png"), notSaid(/slide 7\)/, "something about slide 7")));
C("d06-linked", "medium", D6, "a picture linked to a file on the trainer's PC", "Said, with its slide.", said(/linked.*\(slide 8\)/, "the linked picture"));
C("d06-shape-fill", "low", D6, "a rounded box filled with a photo, with words on it", "The words, and the photo.", all(body(9, "<p>Our new pump</p>"), pic(9, "image/jpeg")));
C("d06-empty-picture-box", "low", D6, "Picture with Caption with the picture box still empty", "The caption; no picture; nothing said about it.",
  all(body(10, "<p>Add the photo of the panel here</p>"), pic(10, null), notSaid(/slide 10\)/, "something about slide 10")));
C("d06-bmp", "low", D6, "a BMP", "Kept.", pic(11, "image/bmp"));
C("d06-turned", "medium", D6, "a landscape photo turned a quarter in PowerPoint (xfrm rot=90\u00b0), so it shows upright as portrait", "Shown as PowerPoint shows it (portrait), or said that the turn was not kept: a sideways photo of a panel is misread.",
  function (r, x) { var s = sl(r, 12); if (!s.img) return "no picture"; var z = pngSize(s.img); return z[0] < z[1] || /turn|rotat/i.test(x.said(r)) ? "" : "kept " + z.join("x") + " (landscape, sideways) and said nothing"; });
C("d06-cropped", "low", D6, "a photo cropped to its middle half in PowerPoint", "Shown cropped, or said that the crop was not kept (what was cropped away comes back).",
  function (r, x) { var s = sl(r, 13); if (!s.img) return "no picture"; var z = pngSize(s.img); return z[0] <= 200 || /crop/i.test(x.said(r)) ? "" : "kept the whole " + z.join("x") + " photo and said nothing"; });

// --- d07: reading order and groups --------------------------------------------------------------------------------------
var D7 = "d07_order.pptx";
C("d07-columns", "high", D7, "Before (left) and After (right) columns, the right box 0.02 in higher", "Before, then After.", order(1, ["Before: the old valve", "It leaked at the stem", "After: the new valve", "No leak at 6 bar"]));
C("d07-bottom-first", "high", D7, "three boxes stacked, written in the file bottom first", "Top to bottom: First, Second, Third.", order(2, ["First:", "Second:", "Third:"]));
C("d07-group", "medium", D7, "a moved and halved group with a box outside it between its two", "Top, middle, bottom as drawn.", order(3, ["Inside, top", "Outside, middle", "Inside, bottom"]));
C("d07-three-steps", "high", D7, "three step boxes along a line, written 3, 1, 2", "1, 2, 3, left to right.", order(4, ["1. Isolate", "2. Lock", "3. Test"]));
C("d07-steps-uneven", "high", D7, "three step boxes along a line, their tops 0.15 to 0.3 in apart", "1. Isolate, 2. Lock, 3. Test: left to right.", order(8, ["1. Isolate", "2. Lock", "3. Test"]));
C("d07-vertical-title", "medium", D7, "Vertical Title and Text", "The title, and the text (bulleted, from the master).", both(5, "Vertical title", "<ul><li>Text beside it</li></ul>"));
C("d07-flow", "medium", D7, "a flow chart: three boxes with words, two connector lines", "The words left to right; the lines said with the slide.",
  all(order(6, ["Fault found", "Safe to fix?", "Fix it"]), said(/lines \(slide 6\)/, "the drawn lines on slide 6")));
C("d07-grouped-photo", "medium", D7, "a photo and its caption grouped together", "The photo and the caption both kept.", all(body(9, "<p>Float switches on the left wall</p>"), pic(9, "image/png")));

// --- d08: characters -----------------------------------------------------------------------------------------------------
var D8 = "d08_text.pptx";
C("d08-tab", "low", D8, "\u201cPump 1<TAB>120 h\u201d", "The words on both sides of the tab, apart.", function (r) { return /Pump 1\s+120 h/.test(sl(r, 1).body) ? "" : sl(r, 1).body; });
C("d08-nbsp", "low", D8, "\u201c10<NBSP>bar\u201d", "10 bar.", function (r, x) { return /10\s bar|10\u00a0bar/.test(x.plain(sl(r, 1).body)) || /10.bar/.test(sl(r, 1).body) ? "" : sl(r, 1).body; });
C("d08-emoji", "medium", D8, "emoji in the title and points", "Kept as typed.", both(2, "Checks \u2705", "<ul><li>\u2705 Guard on</li><li>\u26a0\ufe0f Belt worn</li><li>\ud83d\udd25 Hot surface</li></ul>"));
C("d08-arabic", "medium", D8, "an Arabic title and right-to-left points", "The Arabic words kept.", all(title(3, "\u0627\u0644\u0633\u0644\u0627\u0645\u0629 \u0623\u0648\u0644\u0627\u064b"), order(3, ["\u0627\u0631\u062a\u062f\u0650 \u0627\u0644\u062e\u0648\u0630\u0629", "\u0627\u0641\u062d\u0635 \u0627\u0644\u0633\u0644\u0645"])));
C("d08-rtl-direction", "low", D8, "right-to-left paragraphs (rtl=1, right-aligned)", "They read right to left as a block (dir=rtl or right-aligned), as PowerPoint lays them out. Unsure how much Slides can hold: low.",
  function (r) { return /dir=|rtl|right/.test(sl(r, 3).body) ? "" : "the paragraphs lose their direction: " + sl(r, 3).body; });
C("d08-cjk", "medium", D8, "a Chinese title and Japanese points", "Kept.", both(4, "\u5b89\u5168\u7b2c\u4e00", "<ul><li>\u30d8\u30eb\u30e1\u30c3\u30c8\u3092\u7740\u7528</li><li>\u5b89\u5168\u5e2f\u3092\u7740\u7528</li></ul>"));
C("d08-line-break", "medium", D8, "a point with a line break (Shift+Enter)", "One point over two lines.", body(5, "<ul><li>First line<br>second line</li><li>Next point</li></ul>"));
C("d08-title-break", "medium", D8, "a title of two lines", "\u201cLockout Tagout\u201d.", title(6, "Lockout Tagout"));
C("d08-looks", "medium", D8, "m\u00b2 raised, H\u2082O lowered, a struck old limit, an underlined word", "Each kept.", body(7, "<ul><li>Area in m<sup>2</sup></li><li>H<sub>2</sub>O</li><li><s>Old limit</s> New limit</li><li><u>Must</u> wear gloves</li></ul>"));
C("d08-links", "medium", D8, "a web link, a mail link, a link to another slide", "The web and mail links kept as links; the link to a slide keeps its words.",
  body(8, "<ul><li>See <a href=\x22https://www.hse.gov.uk/work-equipment-machinery/\x22>the HSE page</a></li><li>Mail <a href=\x22mailto:trainer@example.org\x22>the trainer</a></li><li>Go to the quiz</li></ul>"));
C("d08-field", "low", D8, "\u201cPage \u201d and a slide-number field", "Page 9.", body(9, "<p>Page 9</p>"));
C("d08-escape", "high", D8, "a title and points with < & > and quotes", "The title as typed; the points as text, not as markup.",
  both(10, "Signs: <stop> & \u201cgo\u201d", "<ul><li>5 &lt; 6 &amp; 7 &gt; 3</li><li>\u201cQuoted\u201d and \u2018single\u2019</li></ul>"));
C("d08-caps", "low", D8, "\u201cWarning\u201d set in All Caps (cap=all), so PowerPoint shows WARNING", "WARNING, as shown. A look, but it is the word a person sees: low.",
  function (r) { return /WARNING/.test(sl(r, 11).body) ? "" : "shows " + sl(r, 11).body; });

// --- d09: notes -----------------------------------------------------------------------------------------------------------
var D9 = "d09_notes.pptx";
C("d09-blank-line", "low", D9, "notes with a blank line between two paragraphs", "The blank line kept (the trainer's pause).", notes(1, "Say this first.\n\nThen pause and say this."));
C("d09-bullets", "low", D9, "notes with a line and two bulleted questions", "All three lines, the questions marked.", notes(2, "Ask the crew:\n- who checked the guard?\n- who signed the card?"));
C("d09-line-break", "low", D9, "notes with a line break (Shift+Enter) in a paragraph", "Two lines.", notes(3, "Hold up the tag\nthen the lock"));
C("d09-empty", "low", D9, "a notes page left empty", "No notes.", function (r) { return sl(r, 4).notes ? "notes " + q(sl(r, 4).notes) : ""; });
C("d09-no-idx", "medium", D9, "notes in a body box with no idx (as LibreOffice writes it)", "The notes.", notes(5, "Notes in a box with no number."));
C("d09-long", "medium", D9, "twelve paragraphs of notes", "All twelve.", function (r) { var s = sl(r, 6).notes || ""; return s.split("\n").length === 12 ? "" : s.split("\n").length + " lines"; });

// --- d10: as PowerPoint 365 writes ------------------------------------------------------------------------------------
var D10 = "d10_powerpoint.pptx";
C("d10-order", "high", D10, "slide files 1-5 listed in the deck as 3, 1, 2, 5, 4; targets written as /ppt/slides/...", "The deck's order: Three, One, Two, Five, Four.",
  function (r) { var t = r.slides.map(function (s) { return s.h; }).join(","); return t === "Slide Three,Slide One,Slide Two,Slide Five,Slide Four" ? "" : t; });
C("d10-hidden", "medium", D10, "slide One hidden (show=0), second in the deck", "Shown, and said as hidden (slide 2).", said(/hidden.*\(slide 2\)/, "the hidden slide 2"));
C("d10-transition", "low", D10, "a transition in mc:AlternateContent and a p14 creation id", "The slide reads as any other.", both(2, "Slide One", "<ul><li>Point on slide one</li></ul>"));
C("d10-equation", "low", D10, "a text box \u201cFlow: [equation Q=A\u00b7v] (area times speed)\u201d (a14:m, with PowerPoint's picture of it as the fallback)", "The words and the equation as text, or the picture of the line kept and nothing lost silently.",
  function (r) { var s = sl(r, 3); return /area times speed/.test(s.body) || s.img ? "" : "the line is gone: " + s.body; });
C("d10-comments", "low", D10, "a modern comment (slide 1) and an old-style comment (slide 5)", "Said, with both slides.", said(/comments \(slides 1 and 5\)/, "the comments on slides 1 and 5"));
C("d10-sections", "low", D10, "sections Start and End", "Lantern has no sections; says their names were not kept (a trainer's deck is often organised by them).",
  said(/section/i, "the sections"));

// --- d11: as Google Slides exports ------------------------------------------------------------------------------------
var D11 = "d11_google.pptx";
C("d11-opens", "high", D11, "a zip written with data descriptors (as Google's exporter writes it)", "It opens: six slides.", count(6));
C("d11-title", "high", D11, "TITLE layout: title and subtitle, an empty run after", "Title, and the subtitle plain.", both(1, "Welcome to the site", "<p>Induction for new starters</p>"));
C("d11-bullets", "high", D11, "bullets at two levels (\u25cf, \u25cb), split runs, a bold word, a link, an empty paragraph", "The points at their levels with the bold word and the link.",
  all(seq(2, [["ul", 1, "Hard hat at all times"], ["ul", 2, "Even in the office corridor"], ["ul", 1, "Sign in at the gate"], ["ul", 1, "See the site map"]]),
      function (r) { var b = sl(r, 2).body; return /<b>office<\x2Fb>/.test(b) && /href=\x22https:\x2F\x2Fexample.org\x2Fsite-map\x22/.test(b) ? "" : b; }));
C("d11-two-columns", "high", D11, "TITLE_AND_TWO_COLUMNS", "Left column, then right.", order(3, ["Phones in the canteen", "Radios on site", "Phones on the scaffold", "Smoking"]));
C("d11-section", "medium", D11, "SECTION_HEADER: a title alone", "The title, no text.", both(4, "Part two: emergencies", ""));
C("d11-plain", "high", D11, "bullets turned off in the body (buNone) and a Google text box", "Three plain lines in order.", body(5, "<p>Leave by the nearest exit.</p><p>Do not stop for belongings.</p><p>Assembly point: car park B</p>"));
C("d11-layout-none", "high", D11, "ONE_COLUMN_TEXT: the layout's body has no bullets, the paragraphs no pPr", "Plain lines.", body(6, "<p>Sam in the office</p><p>Jo in the yard</p>"));
C("d11-notes", "high", D11, "speaker notes in Google's notes box", "The notes.", all(notes(1, "Introduce yourself.\nHand out the badges."), notes(2, "Stress the hard hat rule.")));

// --- d12: as Keynote exports --------------------------------------------------------------------------------------------
var D12 = "d12_keynote.pptx";
C("d12-title", "high", D12, "Keynote's Title & Subtitle (the subtitle a body placeholder idx 13, no bullets by the layout)", "Title, and the subtitle plain.", both(1, "Solar panel basics", "<p>For the community workshop</p>"));
C("d12-bullets", "high", D12, "Title & Bullets, placed only by the master; a level-2 point", "Bulleted points at their levels.",
  seq(2, [["ul", 1, "Sunlight"], ["ul", 1, "Facing south in the north"], ["ul", 2, "No shade at noon"], ["ul", 1, "A clean surface"]]));
C("d12-photo", "medium", D12, "Title, Bullets & Photo: a JPEG in the photo placeholder", "The points and the photo.", all(seq(3, [["ul", 1, "Turns DC into AC"], ["ul", 1, "Keep it ventilated"]]), pic(3, "image/jpeg")));
C("d12-statement", "low", D12, "Statement: one big line, no title box", "The line kept (as title or text).", function (r, x) { var s = sl(r, 4); return /Never open the DC isolator/.test(s.h + x.plain(s.body)) ? "" : "lost"; });
C("d12-notes", "high", D12, "Keynote's notes", "The notes.", notes(2, "Show the panel.\nPoint at the cells."));
C("d12-deck-title", "low", D12, "the file's title property", "\u201cSolar panel basics\u201d.", function (r) { return r.title === "Solar panel basics" ? "" : r.title; });

// --- d13: as LibreOffice saves ----------------------------------------------------------------------------------------
C("d13-lo-titles", "high", "d13_lo_course.pptx", "d01 saved by LibreOffice Impress", "The same eleven titles.",
  function (r, x) { var a = r.slides.map(function (s) { return s.h; }), b = x.read(D1).slides.map(function (s) { return s.h; }); return JSON.stringify(a) === JSON.stringify(b) ? "" : short(JSON.stringify(a)); });
C("d13-lo-text", "high", "d13_lo_course.pptx", "d01 saved by LibreOffice: bullets, levels, the subtitle, the section text", "The same points and levels as in PowerPoint's file.",
  function (r, x) { var d = x.read(D1); for (var n = 1; n <= 4; n++) if (JSON.stringify(x.lines(sl(r, n).body)) !== JSON.stringify(x.lines(sl(d, n).body))) return "slide " + n + " reads " + short(sl(r, n).body); return ""; });
C("d13-lo-notes", "high", "d13_lo_course.pptx", "d01's notes, saved by LibreOffice", "The same notes.", all(notes(2, "Walk round the truck with them.\nPoint at each item."), notes(10, "Ask who has been warned.\nShow the signs.")));
C("d13-lo-picture", "medium", "d13_lo_course.pptx", "d01's captioned photo, saved by LibreOffice", "The photo kept.", pic(9, "image/png"));
C("d13-lo-numbers", "high", "d13_lo_numbers.pptx", "d02 saved by LibreOffice", "Numbered lists, from 5 where it starts at 5, with the bulleted details.",
  all(seq(1, [["ol", 1, "Tell the operator"], ["ol", 1, "Switch off"], ["ol", 1, "Lock and tag"], ["ol", 1, "Prove dead"]]), body(2, "<ol start=\x225\x22><li>Refit the guard</li><li>Remove your lock</li></ol>"),
      body(5, "<ol><li>Isolate<ul><li>At the main breaker</li><li>And at the local switch</li></ul></li><li>Prove dead</li></ol>")));
C("d13-lo-tables", "medium", "d13_lo_tables.pptx", "d04 saved by LibreOffice", "The same cells, joined cells joined.",
  function (r, x) { var d = x.read("d04_tables.pptx"); for (var n = 1; n <= 6; n++) if (x.plain(sl(r, n).body) !== x.plain(sl(d, n).body) || (sl(r, n).body.match(/span/g) || []).length !== (sl(d, n).body.match(/span/g) || []).length) return "slide " + n + ": " + short(sl(r, n).body); return ""; });
C("d13-lo-from-odp", "medium", "d13_lo_from_odp.pptx", "a deck made in Impress (.odp), saved as .pptx", "The same titles and lists as the deck it came from.",
  function (r, x) { var d = x.read("d02_numbers.pptx"); for (var n = 1; n <= 7; n++) if (sl(r, n).h !== sl(d, n).h || x.plain(sl(r, n).body) !== x.plain(sl(d, n).body)) return "slide " + n + ": " + short(sl(r, n).h + " / " + sl(r, n).body); return ""; });

// --- d14: Strict ----------------------------------------------------------------------------------------------------------
C("d14-strict", "high", "d14_strict.pptx", "d01 in ISO/IEC 29500 Strict names (purl.oclc.org)", "Read as d01: titles, text, notes, the photo.",
  function (r, x) { var d = x.read(D1); if (r.slides.length !== d.slides.length) return r.slides.length + " slides"; for (var n = 1; n <= d.slides.length; n++) { var a = sl(r, n), b = sl(d, n); if (a.h !== b.h || a.body !== b.body || (a.notes || "") !== (b.notes || "") || !!a.img !== !!b.img) return "slide " + n + " differs: " + short(a.h + " / " + a.body); } return ""; });

// --- d15: a 4:3 deck of text boxes --------------------------------------------------------------------------------------
var D15 = "d15_4x3.pptx";
C("d15-textbox-title", "medium", D15, "Blank slides: a short line at the top, the text under it", "The top line is the title; the rest its text.", both(1, "Hand washing", "<p>Wet, soap, rub for 20 seconds</p><p>Rinse and dry</p>"));
C("d15-low-line", "medium", D15, "a short line in the middle of the slide, a second box under it", "No title: both lines are text.", both(2, "", "<p>Low on the slide</p><p>A second box under it</p>"));
C("d15-two-lines", "medium", D15, "two lines at the top (one box)", "No title taken from a two-line box: all text.", title(3, ""));
C("d15-empty-title-box", "low", D15, "Title Only with its title left empty, a text box under it", "The text kept (PowerPoint's title is empty).", function (r, x) { var s = sl(r, 5); return /A title box left empty/.test(s.h + x.plain(s.body)) ? "" : "lost"; });

// --- d16, d17: many slides, empty things ----------------------------------------------------------------------------------
C("d16-sixty", "high", "d16_sixty.pptx", "a sixty-slide course, notes every tenth slide", "Sixty slides, titled Module 1 to 60, each four points; notes on 10, 20 ... 60.",
  function (r) {
    if (r.slides.length !== 60) return r.slides.length + " slides";
    for (var i = 1; i <= 60; i++) { var s = sl(r, i); if (s.h !== "Module " + i || (s.body.match(/<li>/g) || []).length !== 4 || !!s.notes !== (i % 10 === 0)) return "slide " + i + " is " + short(JSON.stringify(s)); }
    return "";
  });
var D17 = "d17_empty.pptx";
C("d17-count", "high", D17, "six slides, some empty", "Six slides (an empty slide is still a slide).", count(6));
C("d17-blank", "high", D17, "a Blank slide with nothing on it", "No title, no text.", both(1, "", ""));
C("d17-untyped", "high", D17, "a Title and Content slide never typed in", "No title, no text: not the layout's prompts (\u201cClick to add title\u201d).", both(2, "", ""));
C("d17-title-only", "medium", D17, "a title and an empty content box", "The title, no text.", both(3, "Only a title", ""));
C("d17-no-title", "medium", D17, "points, the title box empty", "No title; the point.", both(4, "", "<ul><li>Points with no title</li></ul>"));
C("d17-space-title", "low", D17, "a title of spaces", "No title.", title(5, ""));
C("d17-empty-points", "medium", D17, "points with empty paragraphs and one of a space between", "The two points (no empty bullets).", body(6, "<ul><li>One</li><li>Two</li></ul>"));

// --- d18: damaged files --------------------------------------------------------------------------------------------------
C("d18-bad-slide", "medium", "d18_bad_slide.pptx", "slide 2's XML cut in half", "The other six slides open, and slide 2 is said as not readable (PowerPoint offers a repair that keeps the rest).",
  function (r, x) { if (r.error) return "refused the whole deck: " + r.error; return r.slides.length === 6 && /\(slide 2\)/.test(x.said(r)) ? "" : r.slides.length + " slides; said " + short(x.said(r)); });
C("d18-bad-notes", "medium", "d18_bad_notes.pptx", "the notes page of slide 1 damaged", "Every slide opens; slide 1's notes said as lost.",
  function (r, x) { if (r.error) return "refused the whole deck over its notes: " + r.error; return r.slides.length === 6 && /notes/.test(x.said(r)) ? "" : short(x.said(r)); });
C("d18-bad-core", "medium", "d18_bad_core.pptx", "the file's properties part (docProps/core.xml: title, author) damaged", "The slides open; the deck is named for the file.",
  function (r) { return r.error ? "refused the whole deck over its properties: " + r.error : r.slides.length === 7 ? "" : r.slides.length + " slides"; });
C("d18-missing-slide", "medium", "d18_missing_slide.pptx", "slide 3's part missing", "Six slides; slide 3 said as missing.", all(count(6), said(/\(slide 3\)/, "the missing slide 3")));
C("d18-missing-picture", "medium", "d18_missing_picture.pptx", "the photo missing from the file", "The slides; the missing picture said with its slide.", said(/missing.*\(slide 9\)/, "the missing picture on slide 9"));
C("d18-missing-layout", "low", "d18_missing_layout.pptx", "the Title and Content layout missing", "The slides and their text.", function (r) { return r.slides.length === 7 && sl(r, 1).h === "Lockout steps" ? "" : "lost slides"; });
C("d18-bad-layout", "low", "d18_bad_layout.pptx", "the Title and Content layout damaged", "The slides and their text (the layout said as lost).", function (r) { return r.error ? "refused the whole deck over a layout: " + r.error : r.slides.length === 7 ? "" : r.slides.length + " slides"; });
C("d18-truncated", "medium", "d18_truncated.pptx", "a file cut short (a broken download)", "Refused, saying the file is damaged or incomplete.", refused(/damaged|cut short|incomplete/, "that it is damaged or cut short"));
C("d18-no-content-types", "low", "d18_no_content_types.pptx", "a package without [Content_Types].xml", "Opened, or refused with a plain message.", function (r) { return r.error ? (/PowerPoint|damaged/.test(r.error) ? "" : r.error) : ""; });
C("d20-stored", "medium", "d20_stored.pptx", "a zip whose parts are stored, not compressed", "Opens as any other.", function (r, x) { return r.slides.length === 7 && sl(r, 1).body === sl(x.read(D2), 1).body ? "" : "differs"; });

// --- d19: things a Lantern slide cannot hold -----------------------------------------------------------------------------
var D19 = "d19_objects.pptx";
C("d19-smartart", "medium", D19, "a SmartArt process: Plan, Isolate, Work, Restore", "Its words kept (as a list), or said with its slide.",
  function (r, x) { var t = x.plain(sl(r, 1).body); return /Plan.*Isolate.*Work.*Restore/.test(t) || /SmartArt.*\(slide 1\)/.test(x.said(r)) ? "" : "lost without a word"; });
C("d19-visio", "medium", D19, "an embedded Visio drawing whose picture is EMF", "Said: Visio, EMF, slide 2.", said(/Visio.*EMF.*\(slides? 2/, "the Visio drawing on slide 2"));
C("d19-video", "medium", D19, "a video", "Said, with its slide.", said(/video.*\(slides 3 and 4\)/, "the video and the sound"));
C("d19-ink", "low", D19, "an ink drawing (with PowerPoint's picture of it)", "Kept as a picture, or said.", function (r, x) { return sl(r, 5).img || /ink/i.test(x.said(r)) ? "" : "lost"; });
C("d19-excel", "medium", D19, "an embedded Excel table whose picture is EMF", "Said: Excel, slide 6.", said(/Excel.*\(slides 2 and 6\)/, "the Excel object on slide 6"));

// --- files that are not presentations, and PowerPoint's other kinds ------------------------------------------------------
var path = require("path");
var REPO = path.join(__dirname, "..", "..", "..");
function wrong(id, harm, fileDesc, get, re, right) {
  cases.push({ id: id, harm: harm, input: fileDesc, right: right, run: function (x) {
    var r; try { r = x.L.pptx.read(x.u8(get(x)), fileDesc.split(" ")[0]); } catch (e) { return Promise.resolve(re.test(e.message) ? "" : "refused with " + q(e.message)); }
    return Promise.resolve("opened it as " + r.slides.length + " slides");
  } });
}
var fs = require("fs");
wrong("w-docx", "high", "letter.docx (a Word document)", function () { return fs.readFileSync(path.join(REPO, "tests", "fixtures", "docx", "word_plain.docx")); }, /Word document/, "Refused: it is a Word document, Writer opens it.");
wrong("w-xlsx", "high", "book.xlsx (an Excel workbook)", function () { return fs.readFileSync(path.join(REPO, "tests", "fixtures", "docx", "book.xlsx")); }, /Excel workbook/, "Refused: it is an Excel workbook, Sheets opens it.");
wrong("w-ppt", "medium", "old.ppt (PowerPoint 97-2003)", function (x) { return x.file("w_old.ppt"); }, /\.ppt\b/, "Refused, saying it is an older PowerPoint file to save as .pptx first.");
wrong("w-locked", "medium", "locked.pptx (a .pptx with a password to open: a compound file holding EncryptionInfo and EncryptedPackage)", function (x) { return x.file("w_locked.pptx"); }, /password|locked|encrypt|protected/i,
  "Refused, saying it is locked with a password (remove it in PowerPoint and save again) - not that it is an old .ppt, which sends the person looking for a file they do not have.");
wrong("w-odp", "low", "talk.odp (a LibreOffice Impress presentation)", function (x) { return x.file("w_impress.odp"); }, /OpenDocument|Impress|\.odp/i, "Refused, saying it is an Impress (.odp) presentation to save as .pptx in LibreOffice; \u201ca zip file with no PowerPoint presentation\u201d does not tell a teacher what to do.");
wrong("w-key", "low", "talk.key (a Keynote presentation)", function (x) { return x.file("w_keynote.key"); }, /Keynote/i, "Refused, saying it is a Keynote file to export as PowerPoint from Keynote.");
wrong("w-empty", "low", "empty.pptx (0 bytes: a failed copy)", function (x) { return x.file("w_empty.pptx"); }, /empty|0 bytes|nothing in it|not a zip/i, "Refused, plainly.");
wrong("w-pdf", "low", "handout.pptx that is really a PDF", function (x) { return x.file("w_pdf.pptx"); }, /PDF/, "Refused, saying it is a PDF.");
C("w-ppsx", "medium", "w_show.ppsx", "a PowerPoint Show (.ppsx)", "Opens as a deck.", count(7));
C("w-ppsx-name", "low", "w_show.ppsx", "a PowerPoint Show named w_show.ppsx, no title property", "The deck is named w_show, without the extension.", function (r) { return r.title === "w_show" ? "" : "named " + q(r.title); });
C("w-potx", "low", "w_template.potx", "a PowerPoint template (.potx)", "Opens as a deck.", count(7));
C("w-pptm", "low", "w_macros.pptm", "a macro-enabled deck (.pptm)", "Opens as a deck (the macros are not run).", count(7));

module.exports = cases;

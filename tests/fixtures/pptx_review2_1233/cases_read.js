// cases_read.js -- Lantern.pptx.read on the second review's decks (decks/, made by make_decks.py): the kinds of decks
// teachers, trainers and tradesmen have, from PowerPoint's template, a Google Slides-style file, LibreOffice's saves,
// and damaged and wrong files. Each case: {id, harm, input, right, run() -> Promise of "" (Lantern does right) or what it
// did}. Judged by what a person and PowerPoint expect.
"use strict";
var H = require("./h.js");
var memo = {};
function deck(name) {
  if (!(name in memo)) { try { memo[name] = { r: H.read(name) }; } catch (e) { memo[name] = { err: String(e && e.message || e) }; } }
  if (memo[name].err) throw new Error("refused: " + memo[name].err);
  return memo[name].r;
}
function refusal(name) { try { deck(name); return null; } catch (e) { return memo[name].err || String(e.message); } }
function sl(name, n) { return deck(name).slides[n - 1] || {}; }
function said(name) { return deck(name).notes.join(" | "); }
// paragraphs in reading order, as plain text
function order(html) { return String(html || "").replace(/<(\x2F?)(p|li|td|th|tr|ul|ol|table)\b[^>]*>/g, "\n").replace(/<[^>]+>/g, "").split("\n").map(function (t) { return t.replace(/\s+/g, " ").trim(); }).filter(String); }
function C(id, harm, input, right, f) {
  return { id: id, harm: harm, input: input, right: right, run: function () { return new Promise(function (ok) { var r; try { r = f(); } catch (e) { r = "threw: " + String(e && e.message || e).slice(0, 300); } ok(r || ""); }); } };
}
function eq(got, want, what) { return JSON.stringify(got) === JSON.stringify(want) ? "" : (what ? what + ": " : "") + "got " + JSON.stringify(got).slice(0, 500) + ", wanted " + JSON.stringify(want).slice(0, 500); }
function seq(name, n, want) { var got = order(sl(name, n).body); return eq(got.join(" / "), want.join(" / "), "reading order"); }
function has(text, re, what) { return re.test(text) ? "" : what + " -- said: " + String(text).slice(0, 400); }
function hasNot(text, re, what) { return re.test(text) ? what + " -- said: " + String(text).slice(0, 400) : ""; }

var cases = [
  // ---- a toolbox talk, PowerPoint's own layouts -----------------------------------------------------------------------
  C("read-title-slide", "low", "r01_toolbox.pptx slide 1: Title Slide layout, title and subtitle", "title “Safe Lifting”, the subtitle as a paragraph",
    function () { var s = sl("r01_toolbox.pptx", 1); return eq([s.h, s.body], ["Safe Lifting", "<p>Toolbox talk, Monday 7:30</p>"]); }),
  C("read-bullet-levels", "medium", "r01 slide 2: Title and Content, bullets at levels 0, 1, 2, 1, 0 (the master's bullets)", "a list nested as the levels are",
    function () { return eq(sl("r01_toolbox.pptx", 2).body, "<ul><li>Size up the load<ul><li>Weight on the label<ul><li>Over 25 kg: two people</li></ul></li><li>Sharp edges</li></ul></li><li>Clear the path</li></ul>"); }),
  C("read-section-header", "low", "r01 slide 3: Section Header (its text placeholder has no bullets in the layout)", "a plain paragraph",
    function () { return eq([sl("r01_toolbox.pptx", 3).h, sl("r01_toolbox.pptx", 3).body], ["Part 2: Carrying", "<p>Keep it close</p>"]); }),
  C("read-two-content", "medium", "r01 slide 4: Two Content, hand tools left, power tools right", "the left list, then the right list",
    function () { return eq(sl("r01_toolbox.pptx", 4).body, "<ul><li>Saw</li><li>Chisel</li><li>Plane</li></ul><ul><li>Drill</li><li>Grinder</li><li>Router</li></ul>"); }),
  C("read-comparison", "medium", "r01 slide 5: Comparison layout, a heading over each column's points", "Leather, its points, Nitrile, its points; the headings plain (the layout gives them no bullet)",
    function () { return eq(sl("r01_toolbox.pptx", 5).body, "<p>Leather</p><ul><li>Rough timber</li><li>Steel edges</li></ul><p>Nitrile</p><ul><li>Oils</li><li>Solvents</li></ul>"); }),
  C("read-picture-caption", "medium", "r01 slide 6: Picture with Caption, a photo in the picture placeholder and a caption", "the title, the caption as its text, the photo as its picture",
    function () { var s = sl("r01_toolbox.pptx", 6); return eq([s.h, s.body, /^data:image\x2Fpng/.test(s.img || "")], ["The right grip", "<p>Palms under the box, elbows in.</p>", true]); }),
  C("read-notes-pauses", "medium", "r01 slide 6's notes: a blank line for a pause, a line break", "the notes with the blank line kept",
    function () { return eq(sl("r01_toolbox.pptx", 6).notes, "Show the grip.\n\nPause: let them try it.\nAsk who has a bad back."); }),
  C("read-core-title", "low", "r01: the file's own title (core properties) “Safe lifting”", "the deck's title", function () { return eq(deck("r01_toolbox.pptx").title, "Safe lifting"); }),
  C("read-nothing-said-wrong", "low", "r01: a deck with nothing Lantern leaves out but the layout", "no word of lost pictures, charts or broken parts",
    function () { return hasNot(said("r01_toolbox.pptx"), /more picture|chart|could not be read|linked|SmartArt|video/, "said something was lost that was not"); }),

  // ---- boxes on a slide: grids, timelines, headings over columns, step boxes ------------------------------------------
  C("read-grid4-even", "medium", "r02 slide 1: four numbered steps in a 2 by 2 grid, the same gap across and down", "1, 2, 3, 4: across the top row, then the bottom",
    function () { return seq("r02_boxes.pptx", 1, ["1. Prepare the form", "Oil the boards", "2. Mix", "3 sand to 1 cement", "3. Pour", "Fill in layers", "4. Cure", "Keep it wet 7 days"]); }),
  C("read-grid6-tight", "medium", "r02 slide 2: six numbered steps in a 3 by 2 grid just under the title", "1 to 6, row by row",
    function () { return seq("r02_boxes.pptx", 2, ["1. Isolate", "Main switch off", "2. Lock", "Your own lock", "3. Tag", "Name and date", "4. Test", "Try the start button", "5. Work", "Only now", "6. Restore", "Tell the crew"]); }),
  C("read-timeline-row", "medium", "r02 slide 3: a timeline of five boxes in one row above a line", "the years left to right, each with its event",
    function () { return seq("r02_boxes.pptx", 3, ["1985", "Founded", "1992", "First depot", "2001", "Second depot", "2012", "New fleet", "2020", "Solar roof"]); }),
  C("read-timeline-staggered", "medium", "r02 slide 4: a timeline whose boxes sit above and below its line in turn (1985 up, 1992 down, ...)", "the years in their order left to right: 1985, 1992, 2001, 2012, 2020",
    function () { return seq("r02_boxes.pptx", 4, ["1985", "Founded", "1992", "First depot", "2001", "Second depot", "2012", "New fleet", "2020", "Solar roof"]); }),
  C("read-heading-over-columns", "medium", "r02 slide 5: one heading across the slide, two columns under it", "the heading, the left column, the right column",
    function () { return seq("r02_boxes.pptx", 5, ["Turn the water off first, at the stop tap.", "Compression joint", "Tighten a quarter turn", "Do not overtighten", "Soldered joint", "Drain the pipe", "Clean and flux"]); }),
  C("read-column-headings-close", "medium", "r02 slide 6: a heading over each column, 0.15 in under the title box and 0.15 in above its points", "each heading with its own points: Petrol engines, its points, Diesel engines, its points",
    function () { return seq("r02_boxes.pptx", 6, ["Petrol engines", "Spark plugs", "Lighter oil", "Diesel engines", "Glow plugs", "Fuel filter water trap"]); }),
  C("read-chevrons", "medium", "r02 slide 7: four chevron step shapes left to right, each a little lower", "Plan, Order parts, Fit, Test",
    function () { return seq("r02_boxes.pptx", 7, ["Plan", "Order parts", "Fit", "Test"]); }),
  C("read-picture-beside-words", "low", "r02 slide 8: a photo on the left, a heading and two points on the right", "the picture kept, the words in order",
    function () { var s = sl("r02_boxes.pptx", 8); return eq([!!s.img, order(s.body).join(" / ")], [true, "The old pump / Bearings worn / Seal leaking"]); }),
  C("read-grid6-low", "medium", "r13 slide 1: six numbered steps in a 3 by 2 grid well under the title (gaps 0.5 in across, 0.25 in down)", "1 to 6, row by row, as the numbers say",
    function () { return seq("r13_more_boxes.pptx", 1, ["1. Isolate", "Main switch off", "2. Lock", "Your own lock", "3. Tag", "Name and date", "4. Test", "Try the start button", "5. Work", "Only now", "6. Restore", "Tell the crew"]); }),
  C("read-grid4-gutter", "medium", "r13 slide 2: four numbered steps for mixing mortar in a 2 by 2 grid with a wide gutter", "1, 2, 3, 4",
    function () { return seq("r13_more_boxes.pptx", 2, ["1. Measure", "3 sand, 1 cement", "2. Dry mix", "Until one colour", "3. Add water", "A little at a time", "4. Use it", "Within two hours"]); }),
  C("read-timeline-two-rows", "low", "r13 slide 3: a timeline with each year above the line and its event below it", "each year with its event (1985 Founded, 1992 First depot, ...); unsure: a person may also read the years first",
    function () { return seq("r13_more_boxes.pptx", 3, ["1985", "Founded", "1992", "First depot", "2001", "Second depot", "2012", "New fleet"]); }),
  C("read-column-headings-usual", "medium", "r13 slide 4: a heading over each column at the usual distance under the title", "each heading with its own points",
    function () { return seq("r13_more_boxes.pptx", 4, ["Petrol engines", "Spark plugs", "Lighter oil", "Diesel engines", "Glow plugs", "Fuel filter water trap"]); }),
  C("read-grid4-uneven", "medium", "r13 slide 5: four seasons in a 2 by 2 grid placed by hand, the right column a little lower", "Spring, Summer, Autumn, Winter",
    function () { return seq("r13_more_boxes.pptx", 5, ["Spring", "Sow peas", "Summer", "Water at dusk", "Autumn", "Lift potatoes", "Winter", "Mend tools"]); }),

  // ---- tables and charts ----------------------------------------------------------------------------------------------
  C("read-table-joined", "medium", "r03 slide 1: a rota table, a header row, a cell joined down two rows and one across two columns", "the same table, joined cells joined",
    function () { return eq(sl("r03_tables_charts.pptx", 1).body, "<table><tr><th>Day</th><th>Morning</th><th>Afternoon</th><th>Night</th></tr><tr><td>Mon</td><td>Ann</td><td>Bo</td><td>Cy</td></tr><tr><td>Tue</td><td>Ann</td><td>Dee</td><td rowspan=\x222\x22>Eve</td></tr><tr><td>Wed</td><td colspan=\x222\x22>Off</td></tr></table>"); }),
  C("read-chart-pie-percent", "medium", "r03 slide 2: a pie chart of shares 0.25, 0.5, 0.25 formatted 0%", "25%, 50%, 25%",
    function () { return has(sl("r03_tables_charts.pptx", 2).body, /<td>Kitchen<\x2Ftd><td>25%<\x2Ftd>.*<td>Bathroom<\x2Ftd><td>50%<\x2Ftd>/, "not 25% and 50%"); }),
  C("read-chart-month-dates", "low", "r03 slide 3: a line chart over months, dates formatted mmm yyyy", "Jan 2025, Feb 2025, Mar 2025",
    function () { return seq("r03_tables_charts.pptx", 3, ["mm", "Jan 2025", "80", "Feb 2025", "62", "Mar 2025", "71"]); }),
  C("read-chart-series", "medium", "r03 slide 4: test scores, three series for two classes", "a column for each series, a row for each class",
    function () { return eq(sl("r03_tables_charts.pptx", 4).body, "<table><tr><th></th><th>Maths</th><th>Reading</th><th>Science</th></tr><tr><td>Class A</td><td>61</td><td>75</td><td>58</td></tr><tr><td>Class B</td><td>70</td><td>68</td><td>66</td></tr></table>"); }),
  C("read-chart-percent-decimal", "low", "r03 slide 5: pass rates 0.875 and 0.9125 formatted 0.0%", "87.5% and 91.3%, as the chart shows them (one decimal)",
    function () { var b = sl("r03_tables_charts.pptx", 5).body; return /87\.5%/.test(b) && /91\.3%/.test(b) ? "" : "shown as " + order(b).filter(function (t) { return /%/.test(t); }).join(", "); }),
  C("read-chart-literal-percent", "high", "r03 slide 6: work done typed as whole numbers 40 and 65, formatted 0\x22%\x22 (a percent sign as text, no scaling)", "40% and 65%",
    function () { var b = sl("r03_tables_charts.pptx", 6).body; return /<td>40%<\x2Ftd>/.test(b) && /<td>65%<\x2Ftd>/.test(b) ? "" : "shown as " + order(b).filter(function (t) { return /%/.test(t); }).join(", "); }),
  C("read-chart-day-dates", "low", "r03 slide 7: deliveries by day, dates formatted d-mmm-yy", "3-Mar-25, 4-Mar-25, 5-Mar-25 (or the day before the month)",
    function () { var o = order(sl("r03_tables_charts.pptx", 7).body); return /^3[- ]Mar/.test(o[1] || "") ? "" : "the first day shown as " + JSON.stringify(o[1]); }),
  C("read-chart-years", "low", "r03 slide 8: sales by year, dates formatted yyyy", "2022, 2023, 2024",
    function () { var o = order(sl("r03_tables_charts.pptx", 8).body); return eq([o[1], o[3], o[5]].join(","), "2022,2023,2024"); }),
  C("read-chart-said", "low", "r03: seven charts", "said as kept as tables of their numbers",
    function () { return has(said("r03_tables_charts.pptx"), /7 charts kept as tables/, "not said"); }),
  C("read-chart-two-levels", "medium", "r15 slide 1: sales by quarter under two years (two levels of categories: Q1, Q2 in 2023 and 2024)", "each row named by its quarter (with its year): no row named only 2023 or 2024",
    function () { var b = sl("r15_more_charts.pptx", 1).body, rows = b.match(/<tr><td>[^<]*<\x2Ftd>/g) || []; var cats = rows.map(function (r) { return r.replace(/<[^>]+>/g, ""); }); return cats.length === 4 && cats.every(function (c) { return /Q[12]/.test(c); }) && /Q1/.test(cats[0]) ? "" : "rows named " + JSON.stringify(cats); }),
  C("read-chart-escaped-percent", "high", "r15 slide 2: attendance 92 and 88 formatted 0\\% (a percent sign written as a character)", "92% and 88%",
    function () { var b = sl("r15_more_charts.pptx", 2).body; return /<td>92%<\x2Ftd>/.test(b) ? "" : "shown as " + order(b).filter(function (t) { return /%/.test(t); }).join(", "); }),
  C("read-chart-us-dates", "low", "r15 slide 3: inspection dates formatted m/d/yyyy", "3/4/2025 and 3/11/2025, as the chart shows them (unsure whether a person wants this over 2025-03-04)",
    function () { var o = order(sl("r15_more_charts.pptx", 3).body); return /^3\x2F4\x2F2025$/.test(o[1] || "") ? "" : "shown as " + JSON.stringify(o[1]); }),

  // ---- looks, links, notes, groups, hidden slides, sections, slides with no title ---------------------------------
  C("read-run-looks", "medium", "r04 slide 1: “Wear ear and eye protection, always” with ear bold, eye italic, always underlined", "the same looks on the same words",
    function () { return has(sl("r04_notes_looks.pptx", 1).body, /<li>Wear <b>ear<\x2Fb> and <i>eye<\x2Fi> protection, <u>always<\x2Fu><\x2Fli>/, "the looks differ: " + sl("r04_notes_looks.pptx", 1).body.slice(0, 200)); }),
  C("read-link", "low", "r04 slide 1: a link to a page", "the words kept as a link to that page",
    function () { return has(sl("r04_notes_looks.pptx", 1).body, /<a href=\x22https:\x2F\x2Fexample\.org\x2Fsafety[^\x22]*\x22>the safety site<\x2Fa>/, "no link"); }),
  C("read-notes-blank-lines", "low", "r04 slide 1's notes: paragraphs with one and with two blank lines between", "the pauses kept (a blank line)",
    function () { var n = sl("r04_notes_looks.pptx", 1).notes || ""; return /^Welcome everyone\.\n\n+Pause here for questions\.\n\n+Then move on\.$/.test(n) ? "" : "notes " + JSON.stringify(n); }),
  C("read-groups-nested", "medium", "r04 slide 2: two boxes in a group inside a group on the left, one box in the outer group on the right", "Top, Bottom (the left column), then Beside",
    function () { return seq("r04_notes_looks.pptx", 2, ["Top of the inner group", "Bottom of the inner group", "Beside, in the outer group"]); }),
  C("read-hidden-said", "low", "r04 slide 3: hidden in PowerPoint", "kept, and said hidden", function () { return eq([sl("r04_notes_looks.pptx", 3).h, /hidden in PowerPoint[^|]*slide 3/.test(said("r04_notes_looks.pptx"))], ["Trainer only", true]); }),
  C("read-sections-said", "low", "r04: two sections, Welcome and Practice", "said by name", function () { return has(said("r04_notes_looks.pptx"), /sections \(Welcome, Practice\)/, "sections not said"); }),
  C("read-empty-title-box", "medium", "r04 slide 4: a title box left empty, “Questions?” in the content box", "no title; Questions? in its text", function () { var s = sl("r04_notes_looks.pptx", 4); return eq([s.h, order(s.body).join("/")], ["", "Questions?"]); }),
  C("read-no-title-box", "medium", "r04 slide 5: Blank layout, a short line at the top and two lines under it", "the short top line as its title, the rest as text", function () { var s = sl("r04_notes_looks.pptx", 5); return eq([s.h, s.body], ["Water filter care", "<p>Rinse the candle weekly</p><p>Never use soap</p>"]); }),
  C("read-only-line", "low", "r04 slide 6: Blank layout, only “Thank you” in the middle", "“Thank you” as its title", function () { return eq(sl("r04_notes_looks.pptx", 6).h, "Thank you"); }),

  // ---- numbering as PowerPoint writes it ------------------------------------------------------------------------------
  C("read-num-letters", "medium", "r05 slide 1: a) b) c) (alphaLcParenR)", "a list lettered a, b, c", function () { return eq(sl("r05_numbering.pptx", 1).body, "<ol type=\x22a\x22><li>Gloves</li><li>Goggles</li><li>Boots</li></ol>"); }),
  C("read-num-roman-from-4", "medium", "r05 slide 2: IV. V. (romanUcPeriod from 4)", "a list numbered IV, V", function () { return eq(sl("r05_numbering.pptx", 2).body, "<ol type=\x22I\x22 start=\x224\x22><li>Fourth</li><li>Fifth</li></ol>"); }),
  C("read-num-substeps", "medium", "r05 slide 3: 1. 2. 3. with a. b. under the first", "the sub-steps lettered under step 1, the steps going on at 2", function () { return eq(sl("r05_numbering.pptx", 3).body, "<ol><li>Isolate<ol type=\x22a\x22><li>Breaker off</li><li>Lock on</li></ol></li><li>Prove dead</li><li>Work</li></ol>"); }),
  C("read-num-after-plain", "medium", "r05 slide 4: a plain line, then 1) 2)", "the line, then a list numbered from 1", function () { return eq(sl("r05_numbering.pptx", 4).body, "<p>Read this first</p><ol><li>Open the valve</li><li>Bleed the air</li></ol>"); }),
  C("read-rtl", "low", "r05 slide 5: an Arabic title and a right-to-left point", "the point marked right to left", function () { return has(sl("r05_numbering.pptx", 5).body, /dir=\x22rtl\x22/, "not marked right to left"); }),

  // ---- pictures (jsdom: their places; the browser cases put them together) --------------------------------------------
  C("read-six-photos", "medium", "r06 slide 1: six photos in a 3 by 2 grid", "all six with their places (for Slides to put together)", function () { var s = sl("r06_pictures.pptx", 1); return eq([!!s.img, (s.pics || []).length, (s.pics || []).every(function (p) { return p.w > 2e6 && p.h > 1.5e6; })], [true, 6, true]); }),
  C("read-crop-kept", "low", "r06 slide 2: a picture cropped to its top-left quarter", "the crop kept with it", function () { var p = (sl("r06_pictures.pptx", 2).pics || [])[0] || {}; return eq(p.look && p.look.crop, { l: 0, t: 0, r: 0.5, b: 0.5 }); }),
  C("read-turn-flip-kept", "low", "r06 slide 3: a picture turned 90 degrees and flipped", "the turn and flip kept with it", function () { var p = (sl("r06_pictures.pptx", 3).pics || [])[0] || {}; return eq(p.look && [p.look.rot, p.look.flipH, p.look.flipV], [90, true, false]); }),
  C("read-gif", "low", "r06 slide 4: a GIF", "shown", function () { return eq(/^data:image\x2Fgif/.test(sl("r06_pictures.pptx", 4).img || ""), true); }),
  C("read-bmp", "low", "r06 slide 5: a BMP", "shown", function () { return eq(/^data:image\x2Fbmp/.test(sl("r06_pictures.pptx", 5).img || ""), true); }),
  C("read-tiff-said", "low", "r06 slide 6: a TIFF (PowerPoint shows it, no browser does)", "said, on its slide", function () { return has(said("r06_pictures.pptx"), /TIFF, which no browser shows \(slide 6\)/, "not said"); }),

  // ---- wide decks, footers, SmartArt, other programs' files -----------------------------------------------------------
  C("read-emf-said", "low", "r17 in jsdom (no canvas): an EMF, an EMZ and another EMF picture", "each said as not drawn here, on its slide", function () { return /3 pictures in EMF or EMZ that Lantern could not draw \(slides 1, 2 and 3\)/.test(said("r17_emf.pptx")) ? "" : "said " + said("r17_emf.pptx").slice(0, 300); }),
  C("read-hostile", "high", "r18: markup meant to run a script, in a title, text, a link's address, a javascript: link, a chart's names, a table cell and the notes", "all of it as plain text: no element or event handler in the slide's HTML, no javascript: link (a title is plain text: the browser case open-hostile shows it as text)",
    function () { var r = deck("r18_hostile.pptx"), bad = []; r.slides.forEach(function (s, i) { var b = s.body || ""; if (/<(img|script|svg|iframe)\b|<b on|\son\w+=\x22|href=\x22javascript/i.test(b)) bad.push("slide " + (i + 1) + ": " + b.slice(0, 200)); }); return bad.join("; "); }),
  C("read-wide-footer", "medium", "r07: a 16:9 deck, a footer and a slide number placed on the slide itself", "the size kept; the footer and number not in the slide's text; the file's title",
    function () { var r = deck("r07_wide.pptx"); return eq([r.size.cx > 12e6, r.slides[0].body, r.title], [true, "<ul><li>Tyres</li><li>Forks</li><li>Horn</li></ul>", "Forklift refresher"]); }),
  C("read-smartart-process", "medium", "r08 slide 1: a SmartArt process of three steps", "a list of the three steps in order", function () { return eq(sl("r08_smartart.pptx", 1).body, "<ul><li>Isolate</li><li>Lock and tag</li><li>Prove dead</li></ul>"); }),
  C("read-smartart-hierarchy", "low", "r08 slide 2: a SmartArt chain of who reports to whom", "each one under the one above", function () { return eq(order(sl("r08_smartart.pptx", 2).body).join("/"), "Site manager/Foreman/Electrician/Apprentice") || has(sl("r08_smartart.pptx", 2).body, /<ul><li>Site manager<ul><li>Foreman/, "not nested"); }),
  C("read-smartart-order", "medium", "r14: a SmartArt process whose step “Tag” was put in between later (last in the list of points, third in the order of its connections)", "Isolate, Lock, Tag, Prove dead -- the order the diagram shows (unsure whether PowerPoint itself writes the points out of order)",
    function () { return eq(order(sl("r14_smartart_order.pptx", 1).body).join(", "), "Isolate, Lock, Tag, Prove dead"); }),
  C("read-google-style", "medium", "r09 slide 2: bullets written on each paragraph, as Google Slides writes them", "the same nested list", function () { return eq(sl("r09_google_style.pptx", 2).body, "<ul><li>Peas<ul><li>Direct in the ground</li></ul></li><li>Lettuce</li></ul>"); }),
  C("read-google-notes", "low", "r09 slide 2's notes", "kept", function () { return eq(sl("r09_google_style.pptx", 2).notes, "Bring the seed packets."); }),
  C("read-strict", "medium", "r10: the toolbox talk with the Strict names (ISO/IEC 29500 Strict)", "read as the same deck", function () { return eq(deck("r10_strict.pptx").slides.map(function (s) { return s.h + "|" + s.body; }), deck("r01_toolbox.pptx").slides.map(function (s) { return s.h + "|" + s.body; })); }),
  C("read-streamed-zip", "high", "r11: the toolbox talk zipped with sizes after each part (as Java and Google's servers write zips)", "read as the same deck", function () { return eq(deck("r11_streamed_zip.pptx").slides.length, 6) || eq(deck("r11_streamed_zip.pptx").slides[1].body, deck("r01_toolbox.pptx").slides[1].body); }),
  C("read-pptm", "medium", "r12_kind.pptm: a macro-enabled deck", "its slides read", function () { return eq(deck("r12_kind.pptm").slides.length, 6); }),
  C("read-ppsx", "medium", "r12_kind.ppsx: a slide show file", "its slides read", function () { return eq(deck("r12_kind.ppsx").slides.length, 6); }),
  C("read-potx", "low", "r12_kind.potx: a template", "its slides read", function () { return eq(deck("r12_kind.potx").slides.length, 6); }),
  C("read-subtitle-only", "low", "r16 slide 1: a title slide with only its subtitle filled", "no title (its title box is empty); the subtitle as its text", function () { var s = sl("r16_small_things.pptx", 1); return eq([s.h, s.body], ["", "<p>Week 3: knots</p>"]); }),
  C("read-table-no-header", "low", "r16 slide 2: a table with its header row turned off", "plain cells", function () { return hasNot(sl("r16_small_things.pptx", 2).body, /<th/, "a header row made"); }),
  C("read-notes-bullets", "low", "r16 slide 3's notes: a line, then two bulleted lines", "the bulleted lines marked", function () { return eq(sl("r16_small_things.pptx", 3).notes, "Hand out rope.\n- Pair them up\n- Check each knot"); }),
  C("read-escaped-vt", "low", "r16 slide 4: a run holding _x000B_ (python-pptx's escape of a vertical tab)", "as LibreOffice shows it: the characters as stored (unsure what PowerPoint shows)", function () { return has(sl("r16_small_things.pptx", 4).body, /Name_x000B_Date|Name<br>Date/, "neither as stored nor as a break"); }),
  C("read-title-break", "low", "r16 slide 5: a title with a line break", "one line, a space for the break", function () { return eq(sl("r16_small_things.pptx", 5).h, "Week 3 Knots"); }),
  C("read-lo-toolbox", "medium", "lo01: the toolbox talk as LibreOffice Impress saves it", "the same titles, lists, picture and notes",
    function () { var a = deck("lo01_toolbox.pptx").slides, b = deck("r01_toolbox.pptx").slides; return eq(a.map(function (s) { return s.h + "|" + s.body.replace(/<\x2F?b>/g, "") + "|" + (s.notes || "") + "|" + !!s.img; }), b.map(function (s) { return s.h + "|" + s.body + "|" + (s.notes || "") + "|" + !!s.img; })); }),
  C("read-lo-boxes", "low", "lo02: the boxes deck as LibreOffice saves it", "the same reading as PowerPoint's file", function () { return eq(deck("lo02_boxes.pptx").slides.map(function (s) { return s.body; }), deck("r02_boxes.pptx").slides.map(function (s) { return s.body; })); }),
  C("read-lo-numbering", "medium", "lo05: the numbering deck as LibreOffice saves it", "the same numbered lists", function () { return eq(deck("lo05_numbering.pptx").slides.map(function (s) { return s.body; }), deck("r05_numbering.pptx").slides.map(function (s) { return s.body; })); }),

  // ---- damaged and wrong files ----------------------------------------------------------------------------------------
  C("wrong-empty", "medium", "w01: 0 bytes", "refused: the file is empty", function () { return has(refusal("w01_empty.pptx") || "", /empty/, "not said empty"); }),
  C("wrong-cut-short", "medium", "w02: the first half of a deck (a copy that did not finish)", "refused: damaged, cut short", function () { return has(refusal("w02_cut_short.pptx") || "", /damaged|cut short|incomplete/, "not said damaged"); }),
  C("wrong-text", "low", "w03: a text note named .pptx", "refused in plain words", function () { var m = refusal("w03_text.pptx"); return m && m.length < 200 && !/undefined|null|TypeError/.test(m) ? "" : "said " + m; }),
  C("damaged-slide", "medium", "w04: slide 2's XML cut in half", "the other five slides, and slide 2 said as unreadable", function () { var r = deck("w04_broken_slide.pptx"); return eq([r.slides.length, /1 slide that could not be read[^|]*slide 2/.test(said("w04_broken_slide.pptx"))], [5, true]); }),
  C("damaged-notes", "low", "w05: slide 6's notes not readable XML", "the slide kept, its notes said as unreadable", function () { var r = deck("w05_broken_notes.pptx"); return eq([r.slides.length, !r.slides[5].notes, /notes that could not be read \(slide 6\)/.test(said("w05_broken_notes.pptx"))], [6, true, true]); }),
  C("damaged-layout", "low", "w06: the Title and Content layout's XML broken", "the deck read, the part said", function () { return eq([deck("w06_broken_layout.pptx").slides.length, /slideLayout2/.test(said("w06_broken_layout.pptx"))], [6, true]); }),
  C("damaged-media", "low", "w07: the picture part missing", "the slide kept, the picture said as missing", function () { return eq([deck("w07_missing_picture.pptx").slides.length, /missing from it \(slide 6\)/.test(said("w07_missing_picture.pptx"))], [6, true]); }),
  C("damaged-content-types", "low", "w08: [Content_Types].xml cut short; the presentation and its parts all there", "the deck read (PowerPoint offers to repair it), or refused as damaged -- not “no PowerPoint presentation in it”",
    function () { var m = refusal("w08_broken_content_types.pptx"); return !m || /damaged/.test(m) ? "" : "said " + m; }),
  C("damaged-slide-missing", "medium", "w09: slide 3's part missing from the zip", "the others read, slide 3 said", function () { return eq([deck("w09_missing_slide_part.pptx").slides.length, /slide 3/.test(said("w09_missing_slide_part.pptx"))], [5, true]); }),
  C("wrong-keynote", "medium", "w10: a Keynote file named .pptx", "refused: a Keynote presentation, and how to export it", function () { return has(refusal("w10_keynote.pptx") || "", /Keynote/, "not said Keynote"); }),
  C("wrong-photos-zip", "low", "w11: a zip of photos named .pptx", "refused: no presentation in it", function () { return has(refusal("w11_photos.zip.pptx") || "", /no PowerPoint presentation/, "not said"); }),
  C("wrong-docx", "low", "w12: a Word document named .pptx", "refused: a Word document", function () { return has(refusal("w12_word.pptx") || "", /Word document/, "not said Word"); }),
  C("wrong-xlsx", "low", "w13: an Excel workbook named .pptx", "refused: an Excel workbook", function () { return has(refusal("w13_excel.pptx") || "", /Excel workbook/, "not said Excel"); }),
  C("wrong-ppt", "medium", "w14: an old PowerPoint file (a compound file with a PowerPoint Document stream)", "refused: an old .ppt, save it as .pptx", function () { return has(refusal("w14_old_ppt.pptx") || "", /old PowerPoint file \(\.ppt\)/, "not said .ppt"); }),
  C("wrong-odp", "medium", "w15: LibreOffice's .odp of the toolbox talk, named .pptx", "refused: an OpenDocument presentation", function () { return has(refusal("w15_odp.pptx") || "", /OpenDocument presentation/, "not said .odp"); }),
  C("wrong-pdf", "medium", "w16: LibreOffice's PDF of the toolbox talk, named .pptx", "refused: a PDF", function () { return has(refusal("w16_pdf.pptx") || "", /PDF/, "not said PDF"); }),
  C("wrong-locked", "medium", "w17: a password-locked PowerPoint file (a compound file with EncryptionInfo and EncryptedPackage)", "refused: locked with a password, how to take it off", function () { return has(refusal("w17_locked.pptx") || "", /password/, "not said locked"); }),
  { id: "wrong-ppt-libreoffice", harm: "medium", input: "the toolbox talk saved as .ppt by LibreOffice (made at replay time; 500 KB)", right: "refused: an old .ppt",
    run: function () {
      var cp = require("child_process"), so = null;
      try { so = cp.execSync("command -v soffice || command -v libreoffice", { encoding: "utf8" }).trim(); } catch (e) { so = null; }
      if (!so) return Promise.resolve("SKIP: LibreOffice is not installed");
      var os = require("os"), tmp = H.fs.mkdtempSync(H.path.join(os.tmpdir(), "r2ppt_"));
      try { cp.execFileSync(so, ["--headless", "--convert-to", "ppt", "--outdir", tmp, H.deck("r01_toolbox.pptx")], { env: Object.assign({}, process.env, { HOME: tmp }), stdio: "ignore", timeout: 180000 }); } catch (e) { return Promise.resolve("SKIP: LibreOffice made no .ppt"); }
      var f = H.path.join(tmp, "r01_toolbox.ppt");
      if (!H.fs.existsSync(f)) return Promise.resolve("SKIP: LibreOffice made no .ppt");
      var m = null; try { H.readBytes(H.fs.readFileSync(f), "r01_toolbox.ppt"); } catch (e) { m = e.message; }
      return Promise.resolve(m && /old PowerPoint file/.test(m) ? "" : "said " + m);
    } }
];
module.exports = cases;

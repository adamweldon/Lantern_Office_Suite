# cases.py -- the second grid reviewer's cases for Lantern 1.24.29 (draft d348224), written without seeing the first
# reviewer's. Each case is played in Chromium with the real mouse and keyboard (engine.py) and judged by what
# Microsoft Excel (Windows, Microsoft 365) does; formula moves are worked out in LibreOffice Calc as Excel's stand-in
# (lo_expect.py -> lo_expect.json). A case Excel's behaviour is not sure for is "judged": False and is not counted.
# rule: "1" to "7" are Adam's rules as the first review mended them; "sel", "menu", "fx", "hid", "xlsx", "undo",
# "keys" the rest of what the draft claims.
ELL = "…"
ROWM = ["Cut", "Copy", "Paste", "Insert", "Delete", "Clear Contents", "Format Cells" + ELL, "Row Height" + ELL, "Hide", "Unhide"]
COLM = ["Cut", "Copy", "Paste", "Insert", "Delete", "Clear Contents", "Format Cells" + ELL, "Column Width" + ELL, "Hide", "Unhide"]
CELLM = ["Cut", "Copy", "Paste", "Insert" + ELL, "Delete" + ELL, "Clear Contents", "Sort A to Z", "Sort Z to A", "Format Cells" + ELL]
CASES = []


def case(id, rule, title, excel, steps, expect, harm, judged=True, lo=None):
    c = {"id": id, "rule": rule, "title": title, "excel": excel, "steps": steps, "expect": expect, "harm": harm, "judged": judged}
    if lo:
        c["lo"] = lo
    CASES.append(c)


def op(cells, more=None, title=None):
    return ["open", cells, more, title]


def click(t, *mods):
    return ["click", t, list(mods)]


def rclick(t):
    return ["rclick", t]


def drag(a, b):
    return ["drag", a, b]


def press(k):
    return ["press", k]


def typ(s):
    return ["type", s]


def menu(t):
    return ["menu", t]


def fill(v):
    return ["fill", v]


def radio(t):
    return ["radio", t]


def tick(t, on):
    return ["tick", t, on]


OK, CANCEL = ["ok"], ["cancel"]
CTRLPLUS, CTRLMINUS = press("Control+Shift+Equal"), press("Control+Minus")

# ---------------------------------------------------------------------------------------------------------------
# Rule 1: a row number or column letter selects exactly that row (column) when a merged cell crosses it; Insert and
# Delete then grow or shrink the merged cell and never take out its other rows.
M1 = {"A3": "m", "C2": "c2", "C3": "c3", "C4": "c4", "C5": "c5", "C6": "c6"}
MM = {"merges": ["A3:B5"]}
case("r1-row-click", "1", "row 4's number with A3:B5 merged", "Row 4 alone is selected (4:4); the merged cell does not widen it.",
     [op(M1, MM), click("row:4")], {"range": "A4:Z4"}, "high: a row's Insert/Delete would act on three rows")
case("r1-row-insert", "1", "Insert on row 4 through A3:B5", "One row goes in at 4; the merged cell grows to A3:B6; C4 to C6 move down one.",
     [op(M1, MM), click("row:4"), rclick("row:4"), menu("Insert")],
     {"merges": ["A3:B6"], "cells": {"A3": "m", "C3": "c3", "C4": None, "C5": "c4", "C6": "c5", "C7": "c6"}}, "high: rows of data moved wrongly")
case("r1-row-delete", "1", "Delete on row 4 (right-clicked, not chosen first) through A3:B5",
     "Row 4 alone goes; the merged cell shrinks to A3:B4 and keeps its value; rows 3 and 5 stay.",
     [op(M1, MM), rclick("row:4"), menu("Delete")],
     {"range": "A4:Z4", "merges": ["A3:B4"], "cells": {"A3": "m", "C3": "c3", "C4": "c5", "C5": "c6", "C6": None}}, "high: the merged cell's other rows deleted")
case("r1-insert-top", "1", "Insert on row 3, the merged cell's first row", "The row goes in above the merged cell, which moves down whole to A4:B6.",
     [op(M1, MM), rclick("row:3"), menu("Insert")], {"merges": ["A4:B6"], "cells": {"A3": None, "A4": "m", "C4": "c3"}}, "high: merged cell torn")
case("r1-insert-last", "1", "Insert on row 5, the merged cell's last row", "A row inside the merged cell: it grows to A3:B6.",
     [op(M1, MM), rclick("row:5"), menu("Insert")], {"merges": ["A3:B6"], "cells": {"C5": None, "C6": "c5", "C7": "c6"}}, "medium: merged cell wrong size")
case("r1-insert-below", "1", "Insert on row 6, just below A3:B5", "The merged cell is not touched.",
     [op(M1, MM), rclick("row:6"), menu("Insert")], {"merges": ["A3:B5"], "cells": {"C6": None, "C7": "c6"}}, "medium: merged cell grown wrongly")
case("r1-delete-last", "1", "Delete on row 5, the merged cell's last row", "The merged cell shrinks to A3:B4.",
     [op(M1, MM), rclick("row:5"), menu("Delete")], {"merges": ["A3:B4"], "cells": {"C4": "c4", "C5": "c6"}}, "high: rows deleted")
case("r1-drag-rows", "1", "drag down the numbers 4 to 6 through A3:B5", "Rows 4:6 exactly.",
     [op(M1, MM), drag("row:4", "row:6")], {"range": "A4:Z6"}, "high: wider rows chosen for Insert/Delete")
case("r1-drag-rows-delete", "1", "rows 4:6 dragged, Ctrl+- through A3:B5", "Rows 4 to 6 go; the merged cell keeps row 3: A3:B3, its value kept.",
     [op(M1, MM), drag("row:4", "row:6"), CTRLMINUS], {"merges": ["A3:B3"], "cells": {"A3": "m", "C3": "c3", "C4": None, "C2": "c2"}}, "high: row 3 deleted too")
case("r1-ctrl-plus", "1", "row 4 chosen, Ctrl++", "Whole rows selected: a row goes in at once, no dialog; A3:B6.",
     [op(M1, MM), click("row:4"), CTRLPLUS], {"dlg_open": False, "merges": ["A3:B6"], "cells": {"C5": "c4"}}, "medium")
case("r1-ctrl-minus", "1", "row 4 chosen, Ctrl+-", "Row 4 goes at once; A3:B4.",
     [op(M1, MM), click("row:4"), CTRLMINUS], {"dlg_open": False, "merges": ["A3:B4"], "cells": {"C4": "c5"}}, "high")
case("r1-col-click", "1", "column C's letter with B2:D2 merged", "Column C alone (C:C).",
     [op({"B2": "h", "C1": "c1", "C5": "c5", "E2": "e2"}, {"merges": ["B2:D2"]}), click("col:C")], {"range": "C1:C100"}, "high")
case("r1-col-insert", "1", "Insert on column C through B2:D2", "A column goes in at C; the merged cell grows to B2:E2.",
     [op({"B2": "h", "C1": "c1", "C5": "c5", "E2": "e2"}, {"merges": ["B2:D2"]}), rclick("col:C"), menu("Insert")],
     {"merges": ["B2:E2"], "cells": {"B2": "h", "C1": None, "D1": "c1", "D5": "c5", "F2": "e2"}}, "high")
case("r1-col-delete", "1", "Delete on column C through B2:D2", "Column C goes; the merged cell shrinks to B2:C2; E2 moves to D2.",
     [op({"B2": "h", "C1": "c1", "C5": "c5", "E2": "e2"}, {"merges": ["B2:D2"]}), rclick("col:C"), menu("Delete")],
     {"merges": ["B2:C2"], "cells": {"B2": "h", "C1": None, "D2": "e2", "E2": None}}, "high: columns deleted")
case("r1-shift-space", "1", "Shift+Space on C4, A3:B5 merged", "Row 4 alone.",
     [op(M1, MM), click("C4"), press("Shift+Space")], {"range": "A4:Z4"}, "high")
case("r1-two-merges", "1", "Delete on row 4 through A3:A5 and C2:D6", "Both shrink by one row: A3:A4, C2:D5; E5 (was E6) moves up.",
     [op({"A3": "a", "C2": "c", "E4": "e4", "E6": "e6"}, {"merges": ["A3:A5", "C2:D6"]}), rclick("row:4"), menu("Delete")],
     {"merges": ["A3:A4", "C2:D5"], "cells": {"A3": "a", "C2": "c", "E4": None, "E5": "e6"}}, "high")
case("r1-tall-merge", "1", "rows 5:6 deleted through A2:A10", "The merged cell shrinks to A2:A8; B7 moves to B5.",
     [op({"A2": "t", "B7": "b7"}, {"merges": ["A2:A10"]}), drag("row:5", "row:6"), rclick("row:5"), menu("Delete")],
     {"merges": ["A2:A8"], "cells": {"A2": "t", "B5": "b7"}}, "high")
case("r1-col-inside", "1", "Insert on column B, the merged A3:B5's second column", "B alone is selected; the merged cell grows to A3:C5.",
     [op(M1, MM), click("col:B"), rclick("col:B"), menu("Insert")], {"range": "B1:B100", "merges": ["A3:C5"]}, "medium")
case("r1-delete-undo", "1", "row 4 deleted through A3:B5, then Ctrl+Z", "All back: A3:B5, C4 and C6 as they were.",
     [op(M1, MM), rclick("row:4"), menu("Delete"), press("Control+z")], {"merges": ["A3:B5"], "cells": {"C4": "c4", "C6": "c6"}}, "high")
case("r1-row-menu", "1", "right-click row 4's number through A3:B5", "The row's menu (Insert, Delete, Row Height, Hide, Unhide).",
     [op(M1, MM), rclick("row:4")], {"menu": ROWM, "range": "A4:Z4"}, "medium")

# ---------------------------------------------------------------------------------------------------------------
# Rule 2: typing starts editing at once; a click puts a reference into a formula, a drag a range; a second click or
# drag right after replaces it (Point mode); typing then clicking another cell commits.
P = {"B1": "1", "B2": "5", "B3": "3", "B4": "4", "C2": "2", "C3": "7", "D4": "10", "D5": "20", "D6": "30", "E5": "9"}
case("r2-equals", "2", "= typed on A1", "Editing starts with = in the cell (Enter mode).",
     [op(P), click("A1"), typ("=")], {"bar": "=", "focus": "bar"}, "high: typing lost")
case("r2-click-enter", "2", "= then C3 clicked, Enter", "A1 holds =C3 (7); the cursor goes to A2.",
     [op(P), click("A1"), typ("="), click("C3"), press("Enter")], {"cells": {"A1": "=C3"}, "values": {"A1": 7}, "active": "A2"}, "high")
case("r2-drag-range", "2", "= then a drag B2 to C4", "=B2:C4.",
     [op(P), click("A1"), typ("="), drag("B2", "C4")], {"bar": "=B2:C4"}, "high")
case("r2-click-click", "2", "= then B2 clicked, then C3 clicked", "The second click replaces the first: =C3.",
     [op(P), click("A1"), typ("="), click("B2"), click("C3")], {"bar": "=C3"}, "medium")
case("r2-drag-drag", "2", "= then two drags", "The second range replaces the first: =D4:D6.",
     [op(P), click("A1"), typ("="), drag("B2", "C3"), drag("D4", "D6")], {"bar": "=D4:D6"}, "medium")
case("r2-click-drag", "2", "= then a click on B2, then a drag D4 to D6", "=D4:D6.",
     [op(P), click("A1"), typ("="), click("B2"), drag("D4", "D6")], {"bar": "=D4:D6"}, "medium")
case("r2-plus", "2", "= B2 clicked, + typed, C3 clicked, Enter", "=B2+C3 (12).",
     [op(P), click("A1"), typ("="), click("B2"), typ("+"), click("C3"), press("Enter")], {"cells": {"A1": "=B2+C3"}, "values": {"A1": 12}}, "high")
case("r2-sum-drag", "2", "=SUM( then a drag B1 to B3, ) and Enter", "=SUM(B1:B3) (9).",
     [op(P), click("A1"), typ("=SUM("), drag("B1", "B3"), typ(")"), press("Enter")], {"cells": {"A1": "=SUM(B1:B3)"}, "values": {"A1": 9}}, "high")
case("r2-text-commit", "2", "abc typed in A1, then a click on E7", "abc is entered in A1 and E7 is selected.",
     [op(P), click("A1"), typ("abc"), click("E7")], {"cells": {"A1": "abc"}, "active": "E7", "focus": "grid"}, "high: typing lost")
case("r2-number-formula-commit", "2", "=1+2 typed, then a click on E7", "No operator before the cursor, so not Point mode: =1+2 is entered, E7 selected.",
     [op(P), click("A1"), typ("=1+2"), click("E7")], {"cells": {"A1": "=1+2"}, "active": "E7"}, "medium")
case("r2-type-after-point", "2", "= B2 clicked, then 5 typed", "Typing goes on after the reference: =B25.",
     [op(P), click("A1"), typ("="), click("B2"), typ("5")], {"bar": "=B25"}, "low")
case("r2-escape", "2", "A1 holds old: = typed, B2 clicked, Escape", "Escape cancels: A1 still old.",
     [op(dict(P, A1="old")), click("A1"), typ("="), click("B2"), press("Escape")], {"cells": {"A1": "old"}, "active": "A1"}, "high")
case("r2-shift-click-point", "2", "=SUM( B1 clicked, then Shift+click B4", "In Point mode Shift+click extends the reference to a range: =SUM(B1:B4.",
     [op(P), click("A1"), typ("=SUM("), click("B1"), click("B4", "Shift")], {"bar": "=SUM(B1:B4"}, "low: the range must be dragged or typed")
case("r2-arrow-point", "2", "= typed on B5, then the Up arrow", "An arrow in Point mode points at the cell above: =B4.",
     [op(P), click("B5"), typ("="), press("ArrowUp")], {"bar": "=B4"}, "low: arrows cannot point (not claimed by the draft)")
case("r2-col-letter-point", "2", "=SUM( then column C's letter clicked", "A column letter in Point mode puts in the whole column: =SUM(C:C.",
     [op(P), click("A1"), typ("=SUM("), click("col:C")], {"bar": "=SUM(C:C"}, "low: whole columns must be typed")
case("r2-overtype-tab", "2", "new typed over B2's 5, Tab", "Typing replaces the cell: new; C2 is next.",
     [op(P), click("B2"), typ("new"), press("Tab")], {"cells": {"B2": "new"}, "active": "C2"}, "high")
case("r2-range-typing", "2", "A6:B7 dragged, 5 Enter 6 Enter", "Typing goes into the active cell and Enter moves down within the range: A6 5, A7 6, then B6.",
     [op(P), drag("A6", "B7"), typ("5"), press("Enter"), typ("6"), press("Enter")],
     {"cells": {"A6": "5", "A7": "6"}, "active": "B6", "range": "A6:B7"}, "medium")
case("r2-commit-then-delete", "2", "42 typed in A1, D4 clicked, Delete", "A1 is 42, and Delete then empties D4.",
     [op(dict(P, D4="x")), click("A1"), typ("42"), click("D4"), press("Delete")], {"cells": {"A1": "42", "D4": None}, "focus": "grid"}, "high")
case("r2-f2", "2", "F2 on B4 (=B1), *2 typed, Enter", "F2 edits with the cursor at the end: =B1*2.",
     [op(dict(P, B4="=B1")), click("B4"), press("F2"), typ("*2"), press("Enter")], {"cells": {"B4": "=B1*2"}}, "medium")
case("r2-point-type-click", "2", "= B2 clicked, +5 typed, E7 clicked", "+5 ends Point mode: =B2+5 is entered and E7 selected.",
     [op(P), click("A1"), typ("="), click("B2"), typ("+5"), click("E7")], {"cells": {"A1": "=B2+5"}, "active": "E7"}, "medium")
case("r2-plus-start", "2", "+ typed on A1 (the keypad habit), B2 clicked, Enter", "A leading + starts a formula as = does: A1 becomes =+B2 (5).",
     [op(P), click("A1"), typ("+"), click("B2"), press("Enter")], {"cells": {"A1": "=+B2"}, "values": {"A1": 5}},
     "medium: + is entered as text in A1 and the click moves away; a keypad user's formula is lost")
case("r2-ctrl-click-point", "2", "=SUM( B1 clicked, then Ctrl+click B3", "Ctrl+click in Point mode adds a reference after a comma: =SUM(B1,B3.",
     [op(P), click("A1"), typ("=SUM("), click("B1"), click("B3", "Control")], {"bar": "=SUM(B1,B3"}, "low: the first reference is replaced")
case("r2-f4", "2", "= B2 clicked, F4", "F4 makes the reference absolute: =$B$2.",
     [op(P), click("A1"), typ("="), click("B2"), press("F4")], {"bar": "=$B$2"}, "low: $ must be typed (not claimed by the draft)")
case("r2-in-range", "2", "A1:B2 dragged, = typed, D4 clicked, Enter", "=D4 goes into A1; the cursor moves to A2 inside the range, which stays.",
     [op(P), drag("A1", "B2"), typ("="), click("D4"), press("Enter")], {"cells": {"A1": "=D4"}, "active": "A2", "range": "A1:B2"},
     "high: the formula is lost (the click after a drag takes the keys from it, and Enter then moves on without entering it)")
case("r2-drag-back", "2", "= then a drag B2 to C3 and back to B2", "Where the drag ends: =B2.",
     [op(P), click("A1"), typ("="), ["path", "B2", "C3", "B2"]], {"bar": "=B2"}, "low")
case("r2-after-drag-text", "2", "A1:B2 dragged, abc typed, E7 clicked", "abc is entered in A1 and E7 is selected (as after a click).",
     [op(P), drag("A1", "B2"), typ("abc"), click("E7")], {"cells": {"A1": "abc"}, "active": "E7", "range": "E7:E7"},
     "high: right after a drag the click neither enters the typing nor selects E7; the next Delete empties A1")
case("r2-after-drag-point", "2", "A1:B2 dragged, = typed, D4 clicked, +1 typed, Enter", "A1 holds =D4+1 (11).",
     [op(P), drag("A1", "B2"), typ("="), click("D4"), typ("+1"), press("Enter")], {"cells": {"A1": "=D4+1"}, "values": {"A1": 11}},
     "high: the formula being written is lost (the click takes the keys away from it)")
case("r2-after-drag-focus", "2", "A1:B2 dragged, = typed, D4 clicked", "Still writing the formula: =D4, the keys in it.",
     [op(P), drag("A1", "B2"), typ("="), click("D4")], {"bar": "=D4", "focus": "bar"}, "high")
case("r2-after-row-drag", "2", "rows 2:4 dragged by their numbers, = typed, D6 clicked, Enter", "A2 holds =D6 (30).",
     [op(P), drag("row:2", "row:4"), typ("="), click("D6"), press("Enter")], {"cells": {"A2": "=D6"}, "values": {"A2": 30}}, "high: the formula is lost")
case("r2-text-then-drag", "2", "abc typed in A1, then a drag C3 to D4, then Delete", "abc is entered in A1, C3:D4 selected, and Delete empties C3:D4.",
     [op(P), click("A1"), typ("abc"), drag("C3", "D4"), press("Delete")], {"cells": {"A1": "abc", "C3": None, "D4": None}},
     "high: the drag does nothing, and the Delete meant for C3:D4 empties A1 instead (abc lost, C3:D4 kept)")
case("r2-text-then-row", "2", "abc typed in A1, then row 5's number clicked", "abc is entered in A1 and row 5 is selected.",
     [op(P), click("A1"), typ("abc"), click("row:5")], {"cells": {"A1": "abc"}, "range": "A5:Z5"},
     "medium: the click does nothing and abc is left half-typed")
case("r2-tab-commit", "2", "= C3 clicked, Tab", "A1 holds =C3; B1 is next.",
     [op(P), click("A1"), typ("="), click("C3"), press("Tab")], {"cells": {"A1": "=C3"}, "active": "B1"}, "medium")

# ---------------------------------------------------------------------------------------------------------------
# Rule 3: after a press or a drag on the grid the keys go to the grid -- also on a sheet just opened.
K = {"A1": "a1", "B1": "b1", "B2": "x", "A3": "a3", "C3": "c3"}
case("r3-click-delete", "3", "a sheet just opened: B2 clicked, Delete", "B2 is emptied.",
     [op(K), click("B2"), press("Delete")], {"cells": {"B2": None}, "focus": "grid"}, "high")
case("r3-drag-delete", "3", "A1 to B2 dragged, Delete", "All four emptied.",
     [op(K), drag("A1", "B2"), press("Delete")], {"cells": {"A1": None, "B1": None, "B2": None}}, "high")
case("r3-copy-paste", "3", "A1:B1 dragged, Ctrl+C, D5 clicked, Ctrl+V", "a1 and b1 pasted at D5:E5.",
     [op(K), drag("A1", "B1"), press("Control+c"), click("D5"), press("Control+v")], {"cells": {"D5": "a1", "E5": "b1"}}, "high")
case("r3-shift-space", "3", "C3 clicked, Shift+Space", "Row 3.",
     [op(K), click("C3"), press("Shift+Space")], {"range": "A3:Z3"}, "medium")
case("r3-ctrl-1", "3", "C3 clicked, Ctrl+1", "Format Cells opens.",
     [op(K), click("C3"), press("Control+1")], {"dlg": "Format Cells"}, "medium")
case("r3-type", "3", "C3 clicked, q typed, Enter", "C3 is q.",
     [op(K), click("C3"), typ("q"), press("Enter")], {"cells": {"C3": "q"}, "active": "C4"}, "high")
case("r3-row-delete-key", "3", "row 3's number clicked, Delete", "Row 3 emptied.",
     [op(K), click("row:3"), press("Delete")], {"cells": {"A3": None, "C3": None, "B2": "x"}}, "high")
case("r3-col-type", "3", "column C's letter clicked, 5 typed, Enter", "5 goes into C1; Enter moves down the column to C2; C:C stays selected.",
     [op(K), click("col:C"), typ("5"), press("Enter")], {"cells": {"C1": "5"}, "active": "C2", "range": "C1:C100"}, "medium")
case("r3-bar-then-click", "3", "D1 chosen, zz typed in the formula bar, B2 clicked, Delete", "zz is entered in D1; Delete then empties B2.",
     [op(K), click("D1"), click("bar"), typ("zz"), click("B2"), press("Delete")], {"cells": {"D1": "zz", "B2": None}}, "high")
case("r3-menu-escape", "3", "right-click C3, Escape, Delete", "The menu closes and Delete empties C3.",
     [op(K), rclick("C3"), press("Escape"), press("Delete")], {"cells": {"C3": None}, "menu_open": False}, "medium")
case("r3-row-copy", "3", "rows 2:3 dragged by their numbers, Ctrl+C, row 6 clicked, Ctrl+V", "Rows 2:3 pasted at 6:7.",
     [op(K), drag("row:2", "row:3"), press("Control+c"), click("row:6"), press("Control+v")], {"cells": {"B6": "x", "A7": "a3", "C7": "c3"}}, "high")
case("r3-dialog-ok-type", "3", "Row Height 20 on row 3, OK, then q Enter", "The keys come back to the grid: A3 is q.",
     [op(K), rclick("row:3"), menu("Row Height" + ELL), fill(20), OK, typ("q"), press("Enter")], {"cells": {"A3": "q"}, "heights": {"3": 20}}, "medium")
case("r3-title-then-cell", "3", "the sheet's name box clicked, then B2, then w Enter", "w goes into B2, not the sheet's name.",
     [op(K), click("input[placeholder='Sheet name']"), click("B2"), typ("w"), press("Enter")], {"cells": {"B2": "w"}}, "medium")
case("r3-list-open-type", "3", "the sheet opened from the list, 5 typed at once, Enter",
     "A workbook just opened takes the keys: 5 goes into A1.",
     [op(K, None, "Zebra42"), click("button:has-text('← Sheets')"), click(".list .item .t:text-is('Zebra42')"), typ("5"), press("Enter")],
     {"cells": {"A1": "5"}}, "low: the first keys are lost until a cell is clicked")
case("r3-list-open-click", "3", "the sheet opened from the list, B2 clicked, Delete", "B2 emptied.",
     [op(K, None, "Zebra43"), click("button:has-text('← Sheets')"), click(".list .item .t:text-is('Zebra43')"), click("B2"), press("Delete")],
     {"cells": {"B2": None}}, "high")
case("r3-row-type", "3", "row 5's number clicked, q typed, Enter", "q goes into A5; in a one-row selection Enter moves right, to B5.",
     [op(K), click("row:5"), typ("q"), press("Enter")], {"cells": {"A5": "q"}, "active": "B5"}, "medium")
case("r3-menu-copy-keys", "3", "Copy from B2's menu, Down, Ctrl+V", "After a menu choice the keys are the grid's: x pasted in B3.",
     [op(K), rclick("B2"), menu("Copy"), press("ArrowDown"), press("Control+v")], {"cells": {"B3": "x"}}, "medium")
case("r3-dialog-escape", "3", "Ctrl+1, Escape, Delete", "The dialog closes and Delete empties C3.",
     [op(K), click("C3"), press("Control+1"), press("Escape"), press("Delete")], {"cells": {"C3": None}, "dlg_open": False}, "medium")
case("r3-dialog-enter", "3", "Row Height 20 typed, Enter, then q Enter", "Enter is OK; the keys come back: A3 is q.",
     [op(K), rclick("row:3"), menu("Row Height" + ELL), fill(20), press("Enter"), typ("q"), press("Enter")], {"heights": {"3": 20}, "cells": {"A3": "q"}}, "medium")

# ---------------------------------------------------------------------------------------------------------------
# Rule 4: Shift+arrow passes over hidden rows and columns to the next shown one.
H34 = {"hidden": {"3": 1, "4": 1}}
case("r4-down", "4", "rows 3:4 hidden, A2, Shift+Down", "A2:A5 (the hidden rows inside).",
     [op({"A1": "1"}, H34), click("A2"), press("Shift+ArrowDown")], {"range": "A2:A5"}, "medium")
case("r4-down-up", "4", "rows 3:4 hidden, A2, Shift+Down, Shift+Up", "Back to A2 alone.",
     [op({"A1": "1"}, H34), click("A2"), press("Shift+ArrowDown"), press("Shift+ArrowUp")], {"range": "A2:A2"}, "medium")
case("r4-right", "4", "column C hidden, B1, Shift+Right", "B1:D1.",
     [op({"A1": "1"}, {"hidden": {"C": 1}}), click("B1"), press("Shift+ArrowRight")], {"range": "B1:D1"}, "medium")
case("r4-down-four", "4", "rows 3:6 hidden, A2, Shift+Down", "A2:A7.",
     [op({"A1": "1"}, {"hidden": {"3": 1, "4": 1, "5": 1, "6": 1}}), click("A2"), press("Shift+ArrowDown")], {"range": "A2:A7"}, "medium")
case("r4-down-twice", "4", "row 4 hidden, A3, Shift+Down twice", "A3:A6.",
     [op({"A1": "1"}, {"hidden": {"4": 1}}), click("A3"), press("Shift+ArrowDown"), press("Shift+ArrowDown")], {"range": "A3:A6"}, "medium")
case("r4-arrow-down", "4", "rows 3:4 hidden, A2, Down", "A5.",
     [op({"A1": "1"}, H34), click("A2"), press("ArrowDown")], {"range": "A5:A5"}, "medium")
case("r4-arrow-up", "4", "rows 3:4 hidden, A5, Up", "A2.",
     [op({"A1": "1"}, H34), click("A5"), press("ArrowUp")], {"range": "A2:A2"}, "medium")
case("r4-enter", "4", "rows 3:4 hidden, x typed in A2, Enter", "x in A2; the cursor goes to A5.",
     [op({"A1": "1"}, H34), click("A2"), typ("x"), press("Enter")], {"cells": {"A2": "x"}, "active": "A5"}, "medium: typing into hidden rows")
case("r4-tab", "4", "column C hidden, B1, Tab", "D1.",
     [op({"A1": "1"}, {"hidden": {"C": 1}}), click("B1"), press("Tab")], {"active": "D1"}, "medium")
case("r4-hide-then-shift", "4", "row 3 hidden by the menu, A2, Shift+Down", "A2:A4.",
     [op({"A1": "1"}), rclick("row:3"), menu("Hide"), click("A2"), press("Shift+ArrowDown")], {"range": "A2:A4", "hidden": {"3": 1}}, "medium")
case("r4-left", "4", "column C hidden, D1, Shift+Left", "B1:D1.",
     [op({"A1": "1"}, {"hidden": {"C": 1}}), click("D1"), press("Shift+ArrowLeft")], {"range": "B1:D1"}, "medium")
case("r4-col-letter", "4", "column C hidden, B's letter, Shift+Right", "Columns B:D.",
     [op({"A1": "1"}, {"hidden": {"C": 1}}), click("col:B"), press("Shift+ArrowRight")], {"range": "B1:D100"}, "medium")
case("r4-row-number", "4", "rows 3:4 hidden, row 2's number, Shift+Down", "Rows 2:5.",
     [op({"A1": "1"}, H34), click("row:2"), press("Shift+ArrowDown")], {"range": "A2:Z5"}, "medium")
case("r4-merged", "4", "A1:B2 merged over hidden rows 3:4, Shift+Down from it", "A1:B5.",
     [op({"A1": "m"}, {"merges": ["A1:B2"], "hidden": {"3": 1, "4": 1}}), click("A1"), press("Shift+ArrowDown")], {"range": "A1:B5"}, "medium")
case("r4-shrink", "4", "rows 3:4 hidden, A2 then Shift+click A6, Shift+Up", "A2:A5.",
     [op({"A1": "1"}, H34), click("A2"), click("A6", "Shift"), press("Shift+ArrowUp")], {"range": "A2:A5"}, "medium")

# ---------------------------------------------------------------------------------------------------------------
# Rule 5: merging cells whose other cells hold values asks first.
MG = {"A1": "a", "B1": "b"}
MERGE = [drag("A1", "C1"), press("Control+1"), tick("Merge cells", True), OK]
case("r5-warns", "5", "A1:C1 with b in B1: Merge cells, OK", "Excel warns that only the upper-left value is kept; nothing merged yet.",
     [op(MG)] + MERGE, {"dlg_open": True, "warn": True, "merges": [], "cells": {"B1": "b"}}, "high: values lost without asking")
case("r5-ok-again", "5", "the warning, then OK again", "Merged A1:C1; a kept, b gone.",
     [op(MG)] + MERGE + [OK], {"dlg_open": False, "merges": ["A1:C1"], "cells": {"A1": "a", "B1": None}}, "medium")
case("r5-cancel", "5", "the warning, then Cancel", "Nothing merged; b kept.",
     [op(MG)] + MERGE + [CANCEL], {"dlg_open": False, "merges": [], "cells": {"B1": "b"}}, "high")
case("r5-only-top-left", "5", "only A1 filled: Merge cells, OK", "No warning: merged at once.",
     [op({"A1": "a"})] + MERGE, {"dlg_open": False, "merges": ["A1:C1"], "cells": {"A1": "a"}}, "low: a needless question")
case("r5-top-left-empty", "5", "only B1 filled: Merge cells, OK", "Excel warns (only the upper-left value, here none, is kept).",
     [op({"B1": "b"})] + MERGE, {"dlg_open": True, "warn": True, "merges": []}, "high")
case("r5-top-left-empty-ok", "5", "only B1 filled: the warning, OK again", "Merged; b gone, A1 empty.",
     [op({"B1": "b"})] + MERGE + [OK], {"merges": ["A1:C1"], "cells": {"A1": None, "B1": None}}, "medium")
case("r5-from-menu", "5", "Format Cells from the right-click menu, Merge cells, OK", "The same warning.",
     [op(MG), drag("A1", "C1"), rclick("B1"), menu("Format Cells" + ELL), tick("Merge cells", True), OK], {"dlg_open": True, "warn": True, "merges": []}, "high")
case("r5-unmerge", "5", "A1:C1 merged with a: Merge cells unticked, OK", "Unmerged at once, a kept.",
     [op({"A1": "a"}, {"merges": ["A1:C1"]}), click("A1"), press("Control+1"), tick("Merge cells", False), OK],
     {"dlg_open": False, "merges": [], "cells": {"A1": "a"}}, "low")
case("r5-formula", "5", "A1:B2 with a formula in B2: Merge cells, OK", "Excel warns.",
     [op({"A1": "1", "B2": "=1+1"}), drag("A1", "B2"), press("Control+1"), tick("Merge cells", True), OK], {"dlg_open": True, "warn": True, "merges": []}, "high")
case("r5-undo", "5", "merged after the warning, then Ctrl+Z", "b back, nothing merged.",
     [op(MG)] + MERGE + [OK, press("Control+z")], {"merges": [], "cells": {"B1": "b"}}, "high")
case("r5-around-merge", "5", "A1:D1 with a in A1 and B1:C1 merged holding b: Merge cells, OK", "Excel warns (b would go).",
     [op({"A1": "a", "B1": "b"}, {"merges": ["B1:C1"]}), drag("A1", "D1"), press("Control+1"), tick("Merge cells", True), OK],
     {"dlg_open": True, "warn": True, "merges": ["B1:C1"], "cells": {"B1": "b"}}, "high")
case("r5-enter", "5", "Merge cells ticked, Enter, Enter", "Enter is OK: the first warns, the second merges.",
     [op(MG), drag("A1", "C1"), press("Control+1"), tick("Merge cells", True), press("Enter"), press("Enter")],
     {"dlg_open": False, "merges": ["A1:C1"], "cells": {"B1": None}}, "medium")

# ---------------------------------------------------------------------------------------------------------------
# Rule 6: Column Width in Excel's characters, saved as Excel writes it, drawn in proportion (64 px = 88 px).
CW = [rclick("col:C"), menu("Column Width" + ELL)]
case("r6-shows-843", "6", "Column Width on a column never sized", "8.43.",
     [op({"A1": "a"})] + CW, {"dlgValue": "8.43"}, "low")
case("r6-20", "6", "Column Width 20", "Kept as Excel writes it: 20.7109375.",
     [op({"A1": "a"})] + CW + [fill(20), OK], {"widths": {"C": 20.7109375}}, "medium")
case("r6-20-saved", "6", "Column Width 20, Save .xlsx", "width=\"20.7109375\" customWidth for C.",
     [op({"A1": "a"})] + CW + [fill(20), OK, ["save", "w20"]], {"xlsx": {"file": "w20", "cols": {"C": {"width": 20.7109375, "custom": True}}}}, "none seen: written 20.710938, which Excel draws 145 px as it does 20.7109375")
case("r6-drawn-20", "6", "a column of width 20 drawn beside a usual one", "Excel draws 145 px against 64: 2.27 times.",
     [op({"A1": "a"}, {"widths": {"C": 20.7109375}})], {"px": {"ratio:C/A": 145 / 64}}, "low")
case("r6-10", "6", "Column Width 10", "10.7109375.",
     [op({"A1": "a"})] + CW + [fill(10), OK], {"widths": {"C": 10.7109375}}, "medium")
case("r6-12-5", "6", "Column Width 12.5",
     "Excel keeps a column a whole number of pixels: 12.5 becomes 12.43 or 12.57 (92 or 93 px), written 13.140625 or 13.28125 -- never a width between pixels.",
     [op({"A1": "a"})] + CW + [fill(12.5), OK], {"widths_any": {"C": [13.140625, 13.28125]}}, "none seen: the file's number is one Excel never writes; Excel draws it 92 px")
case("r6-import-15", "6", "an imported column of 15.7109375, Column Width", "It shows 15.",
     [op({"A1": "a"}), ["import", {"name": "w15", "cells": {"A1": 1}, "widths": {"C": 15.7109375}}]] + CW, {"dlgValue": "15"}, "low")
case("r6-several", "6", "columns C:E dragged, Column Width 12", "All three 12.7109375.",
     [op({"A1": "a"}), drag("col:C", "col:E"), rclick("col:D"), menu("Column Width" + ELL), fill(12), OK],
     {"widths": {"C": 12.7109375, "D": 12.7109375, "E": 12.7109375}}, "medium")
case("r6-zero", "6", "Column Width 0", "The column is hidden.",
     [op({"A1": "a"})] + CW + [fill(0), OK], {"hidden": {"C": 1}}, "medium")
case("r6-256", "6", "Column Width 256", "Refused (0 to 255); nothing changes.",
     [op({"A1": "a"})] + CW + [fill(256), OK], {"dlg_open": True, "widths": {"C": None}}, "low")
case("r6-usual-drawn", "6", "an imported column of Excel's usual 9.140625", "Drawn as the grid's usual column.",
     [op({"A1": "a"}, {"widths": {"C": 9.140625}})], {"px": {"ratio:C/A": 1.0}}, "low")
case("r6-undo", "6", "Column Width 20, then Ctrl+Z", "The usual width again.",
     [op({"A1": "a"})] + CW + [fill(20), OK, press("Control+z")], {"widths": {"C": None}}, "low")
case("r6-insert-takes-width", "6", "a column put in right of a column of 20", "It takes the width of the column to its left.",
     [op({"A1": "a"}, {"widths": {"C": 20.7109375}}), rclick("col:D"), menu("Insert")], {"widths": {"C": 20.7109375, "D": 20.7109375}}, "low")
case("r6-keyboard", "6", "Ctrl+Space, Shift+F10, Column Width 15", "15.7109375.",
     [op({"A1": "a"}), click("C1"), press("Control+Space"), press("Shift+F10"), menu("Column Width" + ELL), fill(15), OK], {"widths": {"C": 15.7109375}}, "medium")
case("r6-drawn-30", "6", "a column of width 30 drawn", "Excel 215 px against 64: 3.36 times.",
     [op({"A1": "a"}, {"widths": {"C": 30.7109375}})], {"px": {"ratio:C/A": 215 / 64}}, "low")
case("r6-back-to-843", "6", "a column of 20 set back to 8.43", "9.140625, Excel's usual.",
     [op({"A1": "a"}, {"widths": {"C": 20.7109375}})] + CW + [fill(8.43), OK], {"widths": {"C": 9.140625}}, "low")
case("r6-insert-left", "6", "a column put in at B, left of C of width 20", "C's width moves with it to D; the new B takes A's (the usual).",
     [op({"A1": "a"}, {"widths": {"C": 20.7109375}}), rclick("col:B"), menu("Insert")], {"widths": {"B": None, "C": None, "D": 20.7109375}}, "low")
case("r6-round-trip", "6", "Column Width 20, saved, imported again", "20.7109375 again.",
     [op({"A1": "a"})] + CW + [fill(20), OK, ["save", "rt20"], ["import", {"saved": "rt20"}]], {"widths": {"C": 20.7109375}}, "none seen: comes back 20.710938, drawn the same")

# ---------------------------------------------------------------------------------------------------------------
# Rule 7: the menu key or Shift+F10 with whole rows selected opens the row's menu.
case("r7-shift-f10", "7", "row 4 chosen, Shift+F10", "The row's menu.", [op({"A1": "a"}), click("row:4"), press("Shift+F10")], {"menu": ROWM}, "medium")
case("r7-menu-key", "7", "row 4 chosen, the menu key", "The row's menu.", [op({"A1": "a"}), click("row:4"), press("ContextMenu")], {"menu": ROWM}, "medium")
case("r7-shift-space", "7", "C4, Shift+Space, Shift+F10", "The row's menu.", [op({"A1": "a"}), click("C4"), press("Shift+Space"), press("Shift+F10")], {"menu": ROWM}, "medium")
case("r7-insert-three", "7", "rows 3:5 dragged, Shift+F10, Insert", "Three rows go in above row 3.",
     [op({"A3": "a3", "A6": "a6"}), drag("row:3", "row:5"), press("Shift+F10"), menu("Insert")], {"cells": {"A3": None, "A6": "a3", "A9": "a6"}}, "high")
case("r7-col", "7", "column C chosen, Shift+F10", "The column's menu.", [op({"A1": "a"}), click("col:C"), press("Shift+F10")], {"menu": COLM}, "medium")
case("r7-cell", "7", "C3, Shift+F10", "The cell's menu.", [op({"A1": "a"}), click("C3"), press("Shift+F10")], {"menu": CELLM}, "medium")
case("r7-keys-choose", "7", "row 4, Shift+F10, Down three times, Enter", "Insert chosen from the keyboard: x moves to A5.",
     [op({"A4": "x"}), click("row:4"), press("Shift+F10"), press("ArrowDown"), press("ArrowDown"), press("ArrowDown"), press("Enter")],
     {"cells": {"A4": None, "A5": "x"}}, "medium")
case("r7-escape", "7", "row 4, Shift+F10, Escape", "The menu closes; row 4 still selected; the keys are the grid's.",
     [op({"A1": "a"}), click("row:4"), press("Shift+F10"), press("Escape")], {"menu_open": False, "range": "A4:Z4", "focus": "grid"}, "low")
case("r7-keys-row-height", "7", "row 4, Shift+F10, End, Up, Up, Enter", "Row Height... chosen from the keyboard.",
     [op({"A1": "a"}), click("row:4"), press("Shift+F10"), press("End"), press("ArrowUp"), press("ArrowUp"), press("Enter")], {"dlg": "Row Height"}, "low")
case("r7-cols-dragged", "7", "letters B to D dragged, the menu key", "The column's menu.",
     [op({"A1": "a"}), drag("col:B", "col:D"), press("ContextMenu")], {"menu": COLM, "range": "B1:D100"}, "medium")

# ---------------------------------------------------------------------------------------------------------------
# Selecting with the mouse and keys
case("sel-drag", "sel", "drag B2 to D4", "B2:D4, B2 active.", [op({}), drag("B2", "D4")], {"range": "B2:D4", "active": "B2"}, "high")
case("sel-drag-back", "sel", "drag D4 to B2", "B2:D4, D4 active.", [op({}), drag("D4", "B2")], {"range": "B2:D4", "active": "D4"}, "medium")
case("sel-shift-click", "sel", "B2, Shift+click D5", "B2:D5, B2 active.", [op({}), click("B2"), click("D5", "Shift")], {"range": "B2:D5", "active": "B2"}, "high")
case("sel-col-drag", "sel", "drag across the letters B to D", "Columns B:D.", [op({}), drag("col:B", "col:D")], {"range": "B1:D100"}, "high")
case("sel-row-drag", "sel", "drag down the numbers 2 to 5", "Rows 2:5.", [op({}), drag("row:2", "row:5")], {"range": "A2:Z5"}, "high")
case("sel-shift-down-merged", "sel", "the merged B2:C3, Shift+Down", "The next row below it: B2:C4.",
     [op({"B2": "m"}, {"merges": ["B2:C3"]}), click("B2"), press("Shift+ArrowDown")], {"range": "B2:C4"}, "low: the first Shift+arrow from a merged cell does nothing")
case("sel-shift-right-merged", "sel", "the merged B2:C3, Shift+Right", "B2:D3.",
     [op({"B2": "m"}, {"merges": ["B2:C3"]}), click("B2"), press("Shift+ArrowRight")], {"range": "B2:D3"}, "low")
case("sel-row-drag-up", "sel", "drag up the numbers 5 to 2", "Rows 2:5; A5, where the drag began, active.", [op({}), drag("row:5", "row:2")], {"range": "A2:Z5", "active": "A5"}, "medium")
case("sel-row-into-cells", "sel", "drag from row 2's number into D5", "Rows 2:5.", [op({}), drag("row:2", "D5")], {"range": "A2:Z5"}, "medium")
case("sel-corner", "sel", "the corner above row 1", "The whole sheet.", [op({}), click("C3"), click("corner")], {"range": "A1:Z100"}, "medium")
case("sel-cell-shift-col", "sel", "B3, Shift+click E's letter", "Columns B:E, B3 still active.", [op({}), click("B3"), click("col:E", "Shift")], {"range": "B1:E100", "active": "B3"}, "low")
case("sel-shift-space-down", "sel", "C3, Shift+Space, Shift+Down", "Rows 3:4.", [op({}), click("C3"), press("Shift+Space"), press("Shift+ArrowDown")], {"range": "A3:Z4"}, "medium")
case("sel-ctrl-space-right", "sel", "C3, Ctrl+Space, Shift+Right", "Columns C:D.", [op({}), click("C3"), press("Control+Space"), press("Shift+ArrowRight")], {"range": "C1:D100"}, "medium")
case("sel-range-shift-space", "sel", "B2:C4 dragged, Shift+Space", "Rows 2:4.", [op({}), drag("B2", "C4"), press("Shift+Space")], {"range": "A2:Z4"}, "medium")
case("sel-drag-merged", "sel", "drag A1 to B2, B2:C3 merged", "A1:C3 (the merged cell whole).",
     [op({"B2": "m"}, {"merges": ["B2:C3"]}), drag("A1", "B2")], {"range": "A1:C3"}, "medium")
case("sel-shift-click-merged", "sel", "A1, Shift+click the merged B2:D4", "A1:D4.",
     [op({"B2": "m"}, {"merges": ["B2:D4"]}), click("A1"), click("B2", "Shift")], {"range": "A1:D4"}, "medium")
# ---------------------------------------------------------------------------------------------------------------
# The right-click menus
T = {"A1": "Name", "B1": "Qty", "A2": "pear", "B2": "3", "A3": "apple", "B3": "1", "A4": "fig", "B4": "2"}
case("menu-cell", "menu", "right-click C3", "C3 selected; the cell's menu.", [op({}), rclick("C3")], {"menu": CELLM, "range": "C3:C3"}, "medium")
case("menu-inside-range", "menu", "B2:D4 dragged, right-click C3", "The range stays selected.", [op({}), drag("B2", "D4"), rclick("C3")], {"range": "B2:D4", "menu": CELLM}, "high: Delete... would act on one cell")
case("menu-outside-range", "menu", "B2:D4 dragged, right-click F8", "F8 selected.", [op({}), drag("B2", "D4"), rclick("F8")], {"range": "F8:F8"}, "high")
case("menu-row", "menu", "right-click row 4's number", "Row 4 selected; the row's menu.", [op({}), rclick("row:4")], {"menu": ROWM, "range": "A4:Z4"}, "medium")
case("menu-col", "menu", "right-click column C's letter", "Column C; the column's menu.", [op({}), rclick("col:C")], {"menu": COLM, "range": "C1:C100"}, "medium")
case("menu-rows-kept", "menu", "rows 3:5 dragged, right-click row 4", "Rows 3:5 stay.", [op({}), drag("row:3", "row:5"), rclick("row:4")], {"range": "A3:Z5"}, "high")
case("menu-cells-then-row", "menu", "B2:D4 dragged, right-click row 3", "Row 3 (it was not wholly selected).", [op({}), drag("B2", "D4"), rclick("row:3")], {"range": "A3:Z3"}, "high")
case("menu-clear", "menu", "Clear Contents on B2:C3, B2 bold", "Emptied; B2 stays bold.",
     [op({"B2": "1", "C3": "2"}, {"fmt": {"B2": {"b": 1}}}), drag("B2", "C3"), rclick("B2"), menu("Clear Contents")],
     {"cells": {"B2": None, "C3": None}, "fmt": {"B2": {"b": 1}}}, "medium")
case("menu-copy-paste", "menu", "Copy A1:B1 from the menu, Paste at D4", "5 and =D4*2.",
     [op({"A1": "5", "B1": "=A1*2"}), drag("A1", "B1"), rclick("A1"), menu("Copy"), rclick("D4"), menu("Paste")], {"cells": {"D4": "5", "E4": "=D4*2"}}, "high")
case("menu-cut-paste", "menu", "Cut A1 from the menu, Paste at D4", "Moved; B1's formula follows: =D4*2.",
     [op({"A1": "5", "B1": "=A1*2"}), rclick("A1"), menu("Cut"), rclick("D4"), menu("Paste")], {"cells": {"A1": None, "D4": "5", "B1": "=D4*2"}}, "high")
case("menu-sort-az", "menu", "Sort A to Z on B3 of a table with headings", "Sorted by Qty, the heading row left on top.",
     [op(T), rclick("B3"), menu("Sort A to Z")], {"cells": {"A1": "Name", "A2": "apple", "B2": "1", "A3": "fig", "A4": "pear", "B4": "3"}}, "high: rows torn")
case("menu-row-height-30", "menu", "Row Height 30", "30 points; twice the usual row.",
     [op({}), rclick("row:3"), menu("Row Height" + ELL), fill(30), OK], {"heights": {"3": 30}, "px": {"rratio:3/2": 2.0}}, "low")
case("menu-row-height-several", "menu", "rows 3:5 dragged, Row Height 25", "All three 25.",
     [op({}), drag("row:3", "row:5"), rclick("row:4"), menu("Row Height" + ELL), fill(25), OK], {"heights": {"3": 25, "4": 25, "5": 25}}, "low")
case("menu-row-height-0", "menu", "Row Height 0", "The row is hidden.", [op({}), rclick("row:3"), menu("Row Height" + ELL), fill(0), OK], {"hidden": {"3": 1}}, "low")
case("menu-hide-rows", "menu", "rows 3:4 dragged, Hide", "Both hidden.", [op({}), drag("row:3", "row:4"), rclick("row:3"), menu("Hide")], {"hidden": {"3": 1, "4": 1}}, "medium")
case("menu-unhide-rows", "menu", "rows 3:4 hidden; 2:5 dragged, Unhide", "Shown again.",
     [op({}, H34), drag("row:2", "row:5"), rclick("row:2"), menu("Unhide")], {"hidden": {}}, "medium")
case("menu-unhide-one-side", "menu", "rows 3:4 hidden; row 5 alone, Unhide", "Nothing to unhide in row 5: they stay hidden.",
     [op({}, H34), rclick("row:5"), menu("Unhide")], {"hidden": {"3": 1, "4": 1}}, "low")
case("menu-hide-unhide-col", "menu", "column C hidden by the menu, then B:D dragged, Unhide", "C shown again.",
     [op({}), rclick("col:C"), menu("Hide"), drag("col:B", "col:D"), rclick("col:B"), menu("Unhide")], {"hidden": {}}, "medium")
case("menu-unhide-all", "menu", "rows 3:4 hidden; the corner, then Unhide on row 2's menu", "All rows shown.",
     [op({}, H34), click("corner"), rclick("row:2"), menu("Unhide")], {"hidden": {}}, "medium")
case("menu-long-press-row", "menu", "a finger held on row 4's number (a touch screen)", "Press and hold is a right-click: row 4 and its menu.",
     [op({"A4": "x"}), ["longpress", "row:4"]], {"menu": ROWM, "range": "A4:Z4"}, "medium: no menu on a touch screen")
CASES[-1]["touch"] = True
case("menu-long-press-cell", "menu", "a finger held on C3 (a touch screen)", "C3 and the cell's menu.",
     [op({"C3": "x"}), ["longpress", "C3"]], {"menu": CELLM, "range": "C3:C3"}, "medium")
CASES[-1]["touch"] = True
case("menu-cell-in-rows", "menu", "row 3 chosen by its number, right-click D3 inside it",
     "Whole rows selected: Excel shows the row's menu (Row Height, Hide, Unhide) wherever in them it is right-clicked.",
     [op({}), click("row:3"), rclick("D3")], {"menu": ROWM}, "low: Row Height/Hide/Unhide missing there")
case("menu-insert-copied", "menu", "row 2 copied, right-click row 5's number", "Excel offers Insert Copied Cells in place of Insert.",
     [op({"B2": "1"}), click("row:2"), press("Control+c"), rclick("row:5")],
     {"menu": ["Cut", "Copy", "Paste", "Insert Copied Cells", "Delete", "Clear Contents", "Format Cells" + ELL, "Row Height" + ELL, "Hide", "Unhide"]}, "low: a copied row cannot be put in between rows in one step")
case("menu-insert-cut", "menu", "row 2 cut, right-click row 5's number", "Excel offers Insert Cut Cells in place of Insert.",
     [op({"B2": "1"}), click("row:2"), press("Control+x"), rclick("row:5")],
     {"menu": ["Cut", "Copy", "Paste", "Insert Cut Cells", "Delete", "Clear Contents", "Format Cells" + ELL, "Row Height" + ELL, "Hide", "Unhide"]}, "low: rows cannot be moved between others in one step")
case("menu-insert-one", "menu", "Insert... on one cell", "Shift cells down is chosen first.", [op({}), rclick("C3"), menu("Insert" + ELL)], {"dlgChecked": ["Shift cells down"]}, "low")
case("menu-delete-one", "menu", "Delete... on one cell", "Shift cells up.", [op({}), rclick("C3"), menu("Delete" + ELL)], {"dlgChecked": ["Shift cells up"]}, "low")
case("menu-insert-tall", "menu", "Insert... on B2:B5", "Shift cells right (taller than wide).", [op({}), drag("B2", "B5"), rclick("B3"), menu("Insert" + ELL)], {"dlgChecked": ["Shift cells right"]}, "low")
case("menu-entire-row", "menu", "Insert... Entire row on B2:C3", "Two rows go in at 2.",
     [op({"A2": "a2", "B3": "b3", "A5": "a5"}), drag("B2", "C3"), rclick("B2"), menu("Insert" + ELL), radio("Entire row"), OK],
     {"cells": {"A2": None, "A4": "a2", "B5": "b3", "A7": "a5"}}, "high")
case("menu-merged-edge", "menu", "Insert... Shift cells down on B2:B3 with B4:C4 merged", "Excel will not move part of a merged cell: nothing moves.",
     [op({"B4": "m", "B6": "b6"}, {"merges": ["B4:C4"]}), drag("B2", "B3"), rclick("B2"), menu("Insert" + ELL), radio("Shift cells down"), OK],
     {"merges": ["B4:C4"], "cells": {"B4": "m", "B6": "b6"}}, "high")
case("menu-z-in-use", "menu", "Insert on column B with Z filled (the accepted limit)", "Refused with a message; nothing lost.",
     [op({"Z1": "z", "A1": "a", "B1": "b"}), rclick("col:B"), menu("Insert")], {"cells": {"Z1": "z", "A1": "a", "B1": "b"}, "note_has": "Z"}, "high: Z lost")
case("menu-sort-merged", "menu", "Sort A to Z in a table with a merged cell", "Excel refuses (merged cells of different sizes); nothing moves.",
     [op(dict(T), {"merges": ["A3:B3"]}), rclick("B2"), menu("Sort A to Z")], {"cells": {"A2": "pear", "A3": "apple", "A4": "fig"}}, "high")
case("menu-insert-takes-height", "menu", "a row put in under row 3 of 30 points", "It takes row 3's height.",
     [op({"A3": "x"}, {"heights": {"3": 30}}), rclick("row:4"), menu("Insert")], {"heights": {"3": 30, "4": 30}}, "low")
case("menu-delete-heights", "menu", "row 4 deleted with rows 3 and 6 sized", "Row 6's height moves to 5.",
     [op({}, {"heights": {"3": 30, "6": 20}}), rclick("row:4"), menu("Delete")], {"heights": {"3": 30, "5": 20}}, "low")
case("menu-insert-above-hidden", "menu", "a row put in at 3 with row 5 hidden", "The hidden row moves to 6.",
     [op({"A5": "h"}, {"hidden": {"5": 1}}), rclick("row:3"), menu("Insert")], {"hidden": {"6": 1}, "cells": {"A6": "h"}}, "medium")
# ---------------------------------------------------------------------------------------------------------------
# Formulas following Insert and Delete (LibreOffice Calc worked the same out: lo_expect.json)
FB = {"B2": "1", "B3": "2", "B4": "3", "B5": "4", "B6": "5", "B7": "6", "B8": "7", "B9": "8",
      "D1": "=SUM(B2:B9)", "D2": "=B5*2", "D3": "=$B$5+B4", "D4": "=SUM(B:B)", "D5": "=SUM(B$3:B$6)", "D6": "=AVERAGE(B4:B7)",
      "D7": "=B9-B2", "E1": "=SUM(3:4)", "E2": "=\"B5\"&B5", "E3": "=LOG10(B6)", "E5": "=INDEX(B2:B9,3)"}
CB = {"A1": "1", "B1": "2", "C1": "3", "D1": "4", "E1": "5", "A3": "=SUM(A1:E1)", "B3": "=C1*2", "C3": "=$C$1+B1", "D3": "=SUM(C:C)",
      "A4": "=SUM($B1:$D1)", "B4": "=A1+E1", "A5": "=SUM(A1:C2)", "F3": "=C$1+1", "F4": "=COUNT(B:D)"}
BB = {"A2": "a2", "B2": "1", "C2": "10", "B3": "2", "C3": "20", "B4": "3", "C4": "30", "B5": "4", "C5": "40", "B6": "5", "C6": "50",
      "E1": "=SUM(B2:B6)", "E2": "=B4", "E3": "=SUM(B2:C6)", "E4": "=SUM(A2:C6)", "E5": "=C5+A5", "E6": "=SUM(B:B)", "E7": "=B$4*2",
      "C8": "=B4+A4", "E8": "=SUM(4:4)"}
LOH = "high: formulas point at the wrong cells"
case("fx-ins-row5", "fx", "Insert on row 5", "Every formula follows (Calc: insertCells ROWS).", [op(FB), rclick("row:5"), menu("Insert")], {"lo": True}, LOH, lo=["insert", "A5:A5", "ROWS"])
case("fx-del-row5", "fx", "Delete on row 5", "B5 gone: =B5*2 is #REF!; ranges shrink.", [op(FB), rclick("row:5"), menu("Delete")], {"lo": True}, LOH, lo=["remove", "A5:A5", "ROWS"])
case("fx-del-rows2-3", "fx", "Ctrl+- on rows 2:3, the top of the ranges", "Ranges start at what was row 4.", [op(FB), drag("row:2", "row:3"), CTRLMINUS], {"lo": True}, LOH, lo=["remove", "A2:A3", "ROWS"])
case("fx-ins-row2", "fx", "Insert on row 2, above the ranges", "Ranges move down whole.", [op(FB), rclick("row:2"), menu("Insert")], {"lo": True}, LOH, lo=["insert", "A2:A2", "ROWS"])
case("fx-ins-row10", "fx", "Insert on row 10, just under the ranges", "Ranges stay.", [op(FB), rclick("row:10"), menu("Insert")], {"lo": True}, LOH, lo=["insert", "A10:A10", "ROWS"])
case("fx-del-rows3-4", "fx", "Delete on rows 3:4 (=SUM(3:4) named them)", "=SUM(3:4) is #REF!.", [op(FB), drag("row:3", "row:4"), rclick("row:3"), menu("Delete")], {"lo": True}, LOH, lo=["remove", "A3:A4", "ROWS"])
case("fx-ins-colB", "fx", "Insert on column B", "Every formula follows.", [op(CB), rclick("col:B"), menu("Insert")], {"lo": True}, LOH, lo=["insert", "B1:B1", "COLUMNS"])
case("fx-del-colC", "fx", "Delete on column C", "C1 and C:C gone: #REF!.", [op(CB), rclick("col:C"), menu("Delete")], {"lo": True}, LOH, lo=["remove", "C1:C1", "COLUMNS"])
case("fx-del-colsDE", "fx", "Ctrl+- on columns D:E", "Ranges end at C.", [op(CB), drag("col:D", "col:E"), CTRLMINUS], {"lo": True}, LOH, lo=["remove", "D1:E1", "COLUMNS"])
case("fx-shift-down", "fx", "Insert... Shift cells down on B4:C4", "Only B:C below row 3 move; ranges wholly in B:C follow.",
     [op(BB), drag("B4", "C4"), rclick("B4"), menu("Insert" + ELL), radio("Shift cells down"), OK], {"lo": True}, LOH, lo=["insert", "B4:C4", "DOWN"])
case("fx-shift-up", "fx", "Delete... Shift cells up on B4:C5", "B:C below move up; references to B4:C5 are #REF!.",
     [op(BB), drag("B4", "C5"), rclick("B4"), menu("Delete" + ELL), radio("Shift cells up"), OK], {"lo": True}, LOH, lo=["remove", "B4:C5", "UP"])
case("fx-shift-right", "fx", "Insert... Shift cells right on B3:B4", "Rows 3:4 from B move right.",
     [op(BB), drag("B3", "B4"), rclick("B3"), menu("Insert" + ELL), radio("Shift cells right"), OK], {"lo": True}, LOH, lo=["insert", "B3:B4", "RIGHT"])
case("fx-shift-left", "fx", "Delete... Shift cells left on A3:B3", "Row 3 from C moves left.",
     [op(BB), drag("A3", "B3"), rclick("A3"), menu("Delete" + ELL), radio("Shift cells left"), OK], {"lo": True}, LOH, lo=["remove", "A3:B3", "LEFT"])
case("fx-ctrl-plus-enter", "fx", "B4, Ctrl++, Enter (Shift cells down)", "As Insert... Shift cells down on B4.",
     [op(BB), click("B4"), CTRLPLUS, press("Enter")], {"lo": True}, LOH + " / or the dialog's Enter does nothing", lo=["insert", "B4:B4", "DOWN"])
case("fx-ctrl-minus-enter", "fx", "C3, Ctrl+-, Enter (Shift cells up)", "As Delete... Shift cells up on C3.",
     [op(BB), click("C3"), CTRLMINUS, press("Enter")], {"lo": True}, LOH + " / or the dialog's Enter does nothing", lo=["remove", "C3:C3", "UP"])
case("fx-entire-row", "fx", "Insert... Entire row on C6", "A whole row in at 6.",
     [op(BB), rclick("C6"), menu("Insert" + ELL), radio("Entire row"), OK], {"lo": True}, LOH, lo=["insert", "C6:C6", "ROWS"])
case("fx-entire-col", "fx", "Delete... Entire column on C6", "Column C goes.",
     [op(BB), rclick("C6"), menu("Delete" + ELL), radio("Entire column"), OK], {"lo": True}, LOH, lo=["remove", "C6:C6", "COLUMNS"])
case("fx-other-sheet", "fx", "Insert on row 3 with =Jan!B6+B6", "A reference to another sheet stays: =Jan!B6+B7.",
     [op({"B6": "1", "C1": "=Jan!B6+B6"}), rclick("row:3"), menu("Insert")], {"cells": {"C1": "=Jan!B6+B7"}}, "high: the formula reads another sheet's wrong cell, silently")
case("fx-book-other-sheet", "fx", "an Excel workbook (Jan, Sum: =Jan!B6*2): a row put in at 3 on Jan",
     "Sum's formula follows the cell it names: =Jan!B7*2, still 2.",
     [op({}), ["import", {"name": "book2", "sheet": "Jan", "cells": {"B6": 1}, "more": [["Sum", {"A1": "=Jan!B6*2"}]]}], rclick("row:3"), menu("Insert")],
     {"cells": {"B7": "1"}, "book": {"Sum": {"cells": {"A1": "=Jan!B7*2"}, "values": {"A1": 2}}}}, "high: another sheet's total goes wrong, silently")
case("fx-other-sheet-quoted", "fx", "Insert on row 3 with ='My Sheet'!B6*2", "Unchanged.",
     [op({"B6": "1", "C2": "='My Sheet'!B6*2"}), rclick("row:3"), menu("Insert")], {"cells": {"C2": "='My Sheet'!B6*2"}}, "high")

# ---------------------------------------------------------------------------------------------------------------
# Hidden rows: SUBTOTAL 101-111 and AGGREGATE 1, 3, 5, 7 leave them out
HB = {"A1": "1", "A2": "2", "A3": "3", "A4": "x", "A5": "4"}
H3 = {"hidden": {"3": 1}}
for hid, f, v, title in [("hid-109", "=SUBTOTAL(109,A1:A5)", 7, "SUBTOTAL 109"), ("hid-9", "=SUBTOTAL(9,A1:A5)", 10, "SUBTOTAL 9 (hidden rows counted)"),
                         ("hid-103", "=SUBTOTAL(103,A1:A5)", 4, "SUBTOTAL 103 (COUNTA)"), ("hid-agg5", "=AGGREGATE(9,5,A1:A5)", 7, "AGGREGATE(9,5)"), ("hid-agg6", "=AGGREGATE(9,6,A1:A5)", 10, "AGGREGATE(9,6) (hidden counted)"),
                         ("hid-agg1", "=AGGREGATE(9,1,A1:A5)", 7, "AGGREGATE(9,1)"),
                         ("hid-agg3", "=AGGREGATE(9,3,A1:A5)", 7, "AGGREGATE(9,3)")]:
    case(hid, "hid", title + " with row 3 hidden", "%s gives %s." % (f, round(v, 4)), [op(dict(HB, C1=f), H3)], {"values": {"C1": v}}, "high: a wrong total")
case("hid-104", "hid", "SUBTOTAL 104 (MAX) with the largest hidden", "4.", [op(dict(HB, A3="30", C1="=SUBTOTAL(104,A1:A5)"), H3)], {"values": {"C1": 4}}, "high")
case("hid-agg7", "hid", "AGGREGATE(9,7) with an error shown and row 3 hidden", "Errors and hidden rows left out: 5.",
     [op(dict(HB, A2="=1/0", C1="=AGGREGATE(9,7,A1:A5)"), H3)], {"values": {"C1": 5}}, "high")
case("hid-agg-large", "hid", "AGGREGATE(14,5,A1:A5,1), the largest hidden", "4.", [op(dict(HB, A3="30", C1="=AGGREGATE(14,5,A1:A5,1)"), H3)], {"values": {"C1": 4}}, "high")
case("hid-col", "hid", "SUBTOTAL 109 across a hidden column", "Hidden columns are not left out (only rows are): 6.",
     [op({"A1": "1", "B1": "2", "C1": "3", "A3": "=SUBTOTAL(109,A1:C1)"}, {"hidden": {"B": 1}})], {"values": {"A3": 6}}, "high")
case("hid-agg-nested-sub", "hid", "AGGREGATE(9,3) over a range with a SUBTOTAL in it", "Options 0 to 3 leave nested SUBTOTALs out: 13.",
     [op({"A1": "1", "A2": "2", "A3": "=SUBTOTAL(9,A1:A2)", "A4": "10", "B1": "=AGGREGATE(9,3,A1:A4)"})], {"values": {"B1": 13}}, "medium: a total counted twice")
case("hid-agg-nested-agg", "hid", "AGGREGATE(9,1) over a range with an AGGREGATE in it", "Options 0 to 3 leave nested AGGREGATEs out: 13.",
     [op({"A1": "1", "A2": "2", "A3": "=AGGREGATE(9,4,A1:A2)", "A4": "10", "B1": "=AGGREGATE(9,1,A1:A4)"})], {"values": {"B1": 13}}, "medium: a total counted twice")
case("hid-ui-hide", "hid", "row 3 hidden by the menu under SUBTOTAL(109)", "7, shown at once.",
     [op(dict(HB, C1="=SUBTOTAL(109,A1:A5)")), rclick("row:3"), menu("Hide")], {"values": {"C1": 7}, "shown": {"C1": "7"}}, "high")
case("hid-ui-unhide", "hid", "row 3 shown again under SUBTOTAL(109)", "10.",
     [op(dict(HB, C1="=SUBTOTAL(109,A1:A5)"), H3), drag("row:2", "row:4"), rclick("row:2"), menu("Unhide")], {"values": {"C1": 10}, "shown": {"C1": "10"}}, "high")

# ---------------------------------------------------------------------------------------------------------------
# Excel files: hidden rows and columns and heights kept
case("xlsx-hidden-row", "xlsx", "row 4 hidden, Save .xlsx", "<row r=4 hidden=1>.",
     [op({"A4": "x", "A5": "y"}, {"hidden": {"4": 1}}), ["save", "hr"]], {"xlsx": {"file": "hr", "rows": {"4": {"hidden": True}, "5": {"hidden": False}}}}, "medium")
case("xlsx-hidden-col", "xlsx", "column C hidden, Save .xlsx", "<col C hidden=1>.",
     [op({"C1": "x"}, {"hidden": {"C": 1}}), ["save", "hc"]], {"xlsx": {"file": "hc", "cols": {"C": {"hidden": True}}}}, "medium")
case("xlsx-height", "xlsx", "row 3 of 30 points, Save .xlsx", "ht=30 customHeight.",
     [op({"A3": "x"}, {"heights": {"3": 30}}), ["save", "ht"]], {"xlsx": {"file": "ht", "rows": {"3": {"height": 30}}}}, "medium")
case("xlsx-hidden-height", "xlsx", "row 4 hidden and of 30 points, Save .xlsx", "Both kept.",
     [op({"A4": "x"}, {"hidden": {"4": 1}, "heights": {"4": 30}}), ["save", "hh"]], {"xlsx": {"file": "hh", "rows": {"4": {"hidden": True, "height": 30}}}}, "low")
case("xlsx-merge-after-insert", "xlsx", "row put in through A3:B5, Save .xlsx", "mergeCell A3:B6.",
     [op(M1, MM), rclick("row:4"), menu("Insert"), ["save", "mg"]], {"xlsx": {"file": "mg", "merges": ["A3:B6"], "cells": {"C7": "c6"}}}, "medium")
case("xlsx-import-hidden", "xlsx", "an Excel file with row 3 and column C hidden, imported", "Both hidden.",
     [op({}), ["import", {"name": "ih", "cells": {"A1": 1, "C1": 2, "A3": 3}, "hiderows": [3], "hidecols": ["C"]}]], {"hidden": {"3": 1, "C": 1}}, "medium")
case("xlsx-import-hidden-height", "xlsx", "an Excel file with row 2 hidden and of 30 points, imported",
     "Excel keeps the height of a hidden row: shown again, it is 30 points.",
     [op({}), ["import", {"name": "ihh", "cells": {"A1": 1}, "heights": {"2": 30}, "hiderows": [2]}]], {"hidden": {"2": 1}, "heights": {"2": 30}},
     "low: a row unhidden after import comes back at 15 points")
case("xlsx-round-trip", "xlsx", "hidden row and column, a height and a width, saved and imported", "All kept.",
     [op({"A1": "a"}, {"hidden": {"5": 1, "D": 1}, "heights": {"3": 30}, "widths": {"C": 20.7109375}}), ["save", "rt"], ["import", {"saved": "rt"}]],
     {"hidden": {"5": 1, "D": 1}, "heights": {"3": 30}, "widths": {"C": 20.7109375}}, "medium for hidden rows and heights; none seen for the width")
case("xlsx-import-subtotal", "xlsx", "an Excel file with row 2 hidden and SUBTOTAL(109), imported", "4.",
     [op({}), ["import", {"name": "isub", "cells": {"A1": 1, "A2": 2, "A3": 3, "A4": "=SUBTOTAL(109,A1:A3)"}, "hiderows": [2]}]], {"values": {"A4": 4}}, "high")

# ---------------------------------------------------------------------------------------------------------------
# Undo
case("undo-insert-row", "undo", "Insert on row 2, Ctrl+Z", "As it was.",
     [op({"A1": "1", "A2": "2", "A3": "=SUM(A1:A2)"}), rclick("row:2"), menu("Insert"), press("Control+z")], {"cells": {"A2": "2", "A3": "=SUM(A1:A2)", "A4": None}}, "high")
case("undo-delete-col", "undo", "Delete on column B, Ctrl+Z", "As it was.",
     [op({"A1": "a", "B1": "b", "C1": "=B1"}), rclick("col:B"), menu("Delete"), press("Control+z")], {"cells": {"B1": "b", "C1": "=B1"}}, "high")
case("undo-hide", "undo", "Hide on row 3, Ctrl+Z", "Shown again.", [op({}), rclick("row:3"), menu("Hide"), press("Control+z")], {"hidden": {}}, "medium")
case("undo-shift-left", "undo", "Delete... Shift cells left on B2, Ctrl+Z", "As it was.",
     [op({"B2": "b", "C2": "c"}), rclick("B2"), menu("Delete" + ELL), radio("Shift cells left"), OK, press("Control+z")], {"cells": {"B2": "b", "C2": "c"}}, "high")
case("undo-redo", "undo", "Insert on row 2, Ctrl+Z, Ctrl+Y", "The row is in again.",
     [op({"A2": "2"}), rclick("row:2"), menu("Insert"), press("Control+z"), press("Control+y")], {"cells": {"A2": None, "A3": "2"}}, "medium")

# ---------------------------------------------------------------------------------------------------------------
# Keys on a range
case("keys-backspace-range", "keys", "A1:B2 dragged, Backspace", "Backspace empties only the active cell (A1) and starts editing it; B1, A2, B2 stay.",
     [op({"A1": "1", "B1": "2", "A2": "3", "B2": "4"}), drag("A1", "B2"), press("Backspace")], {"cells": {"A1": None, "B1": "2", "A2": "3", "B2": "4"}},
     "medium: three more cells emptied than in Excel (Ctrl+Z brings them back)")
case("keys-delete-range", "keys", "A1:B2 dragged, Delete", "All four emptied.",
     [op({"A1": "1", "B1": "2", "A2": "3", "B2": "4"}), drag("A1", "B2"), press("Delete")], {"cells": {"A1": None, "B1": None, "A2": None, "B2": None}}, "high")
case("keys-ctrl-minus-col", "keys", "column C chosen, Ctrl+-", "Column C goes; D moves to C.",
     [op({"C1": "c", "D1": "d"}), click("col:C"), CTRLMINUS], {"cells": {"C1": "d", "D1": None}}, "high")
# ---------------------------------------------------------------------------------------------------------------
# Not judged: what Excel does here is not sure enough to count (printed UNJUDGED with what Lantern did)
case("unj-row-through-merge-type", "1", "row 4's number through A3:B5, z typed, Enter",
     "Not sure which cell Excel makes active (A4 is covered by the merged cell); if it is the merged cell, z replaces m as here.",
     [op(M1, MM), click("row:4"), typ("z"), press("Enter")], {"cells": {"A3": "m"}}, "-", judged=False)
case("unj-delete-merge-top", "1", "row 3, the merged A3:B5's first row (holding m), deleted",
     "Not sure whether Excel keeps m in the merged cell left (A3:B4).", [op(M1, MM), rclick("row:3"), menu("Delete")],
     {"merges": ["A3:B4"], "cells": {"A3": "m"}}, "-", judged=False)
case("unj-delete-key-through-merge", "1", "row 4's number through A3:B5, Delete",
     "Not sure whether Excel empties the merged cell, refuses, or leaves it.", [op(M1, MM), click("row:4"), press("Delete")],
     {"cells": {"A3": "m", "C4": None}}, "-", judged=False)
case("unj-ctrl-down-hidden", "4", "A1:A5 filled, row 5 hidden, Ctrl+Down from A1", "Not sure where Excel stops (A4 is the last shown filled cell).",
     [op({"A1": "1", "A2": "2", "A3": "3", "A4": "4", "A5": "5"}, {"hidden": {"5": 1}}), click("A1"), press("Control+ArrowDown")], {"active": "A4"}, "-", judged=False)
case("unj-corner-menu", "7", "the corner, then Shift+F10", "Not sure which menu Excel shows with the whole sheet selected.",
     [op({"A1": "a"}), click("corner"), press("Shift+F10")], {"menu": ROWM}, "-", judged=False)
case("keys-ctrl-9", "keys", "row 3 chosen, Ctrl+9", "Ctrl+9 hides the selected rows.",
     [op({}), click("row:3"), press("Control+9")], {"hidden": {"3": 1}}, "low: not claimed by the draft; Hide is on the menu")

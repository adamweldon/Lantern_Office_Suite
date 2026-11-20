// cases_standards.js -- what Lantern says about the standards it cites, checked against the documents themselves
// (fetched 2026-11-20). Ten States: the FDEP copy (https://floridadep.gov/sites/default/files/10statestandards_wastewater.pdf)
// is the 2004 EDITION; the 2014 edition Lantern names was read in Ohio EPA's copy
// (https://dam.assets.ohio.gov/image/upload/epa.ohio.gov/Portals/35/pti/10wastewaterstandards-2014.pdf). Both have the same
// words at the same numbers. Ontario: https://www.ontario.ca/document/design-guidelines-sewage-works/sewage-pumping-stations
"use strict";
function blk(kind, title, lines) { return "MAKE " + kind + ": " + title + "\n" + lines.join("\n") + "\nEND"; }
function piping(ctx) { return ctx.L.aiAct.build(blk("PIPING", "S", ["pump P1", "pump P2"]), "Draw the piping for a 2 pump lift station").summary; }
function levels(lines) { return function (ctx) { return ctx.L.aiAct.build(blk("LEVELS", "W", lines), "Draw the float levels in the wet well").summary; }; }
function src(ctx) { return ctx.L.aiPumpStation && ctx.L.aiPumpStation.piping ? (ctx.L.aiPumpStation.piping.PROMPT || []).join("\n") + "\n" + piping(ctx) : ""; }
var Q = "\x22";
module.exports = [
  { id: "E-ts-4252-both-valves", rule: "E", right: true, type: "standard", lantern: piping, says: "each pump needs one",
    claim: "42.52: a shutoff valve and a check valve on each pump's discharge.",
    quote: "42.52 Discharge Line: “Suitable shutoff and check valves shall be placed on the discharge line of each pump (except on screw pumps).” (2004 and 2014 editions)",
    verdict: "confirmed", note: "42.52 says shutoff and check valves on each pump's discharge (except screw pumps)", why: "Lantern adds a check and a shutoff valve to each pump.", harm: "high" },
  { id: "E-ts-4252-order", rule: "E", right: true, type: "standard", lantern: piping, says: "The check valve sits between the pump and the shutoff valve.*42\\.52",
    claim: "42.52: the check valve between the shutoff valve and the pump.",
    quote: "42.52: “The check valve shall be located between the shutoff valve and the pump.”",
    verdict: "confirmed", note: "word for word in 42.52", why: "The order Lantern draws and says.", harm: "high" },
  { id: "E-ts-4252-horizontal", rule: "E", right: true, type: "standard", lantern: piping, says: "check valve",
    claim: "(drawn) the check valves on the horizontal run.",
    quote: "42.52: “Check valves shall be suitable for the material being handled and shall be placed on the horizontal portion of discharge piping except for ball checks, which may be placed in the vertical run.”",
    verdict: "confirmed", note: "Lantern draws each check valve on the horizontal run in the vault, as 42.52 asks", why: "The drawing agrees with the rest of 42.52.", harm: "low" },
  { id: "E-ts-444-vault", rule: "E", right: true, type: "standard", lantern: piping, says: "the valves are in a vault of their own, out of the wet well.*44\\.4",
    claim: "44.4: a submersible station's valves in a separate chamber.",
    quote: "44 SUBMERSIBLE PUMP STATIONS - SPECIAL CONSIDERATIONS; 44.4 Valves: “Valves required under Paragraph 42.5 shall be located in a separate valve chamber.” It goes on: “Check valves that are integral to the pump need not be located in a separate valve chamber provided that the valve can be removed from the wet well in accordance with Paragraph 44.2.”",
    verdict: "confirmed", note: "44.4 says so (Lantern does not mention the exception for check valves built into the pump, which is fine for a drawing of the usual layout)", why: "The vault.", harm: "high" },
  { id: "E-ts-4264-vent", rule: "E", right: true, type: "standard", lantern: piping, says: "an inverted J vent \\(a covered wet well needs a way for air in and out\\)",
    claim: "42.64: an inverted J tube for a covered wet well's air.",
    quote: "42.64 Air Displacement: “Covered wet wells shall have provisions for air displacement to the atmosphere, such as an inverted “j” tube or other means.”",
    verdict: "confirmed", note: "42.64 says so; Lantern's words to the person do not name 42.64 (only its code comment does), which is no harm", why: "The vent.", harm: "low" },
  { id: "E-ts-edition", rule: "E", right: true, type: "standard", lantern: piping, says: "Recommended Standards for Wastewater Facilities, 2014",
    claim: "The edition: 2014.",
    quote: "Ohio EPA's copy: cover “2014 EDITION”; foreword “These standards have again been revised and are published herein as the 2014 edition.” The FDEP copy the review was pointed to is the “2004 EDITION”, with the same text at 42.52, 44.4 and 42.64.",
    verdict: "confirmed", note: "the 2014 edition has 42.52, 44.4 and 42.64 as Lantern cites them (the FDEP link is the 2004 edition; same words)", why: "The citation.", harm: "low" },
  { id: "E-ont-725-300mm", rule: "E", right: true, type: "standard", lantern: levels(["float FS1 " + Q + "off" + Q + " 0.5 m", "float FS2 " + Q + "lead on" + Q + " 0.7 m"]), says: "Ontario’s design guidelines keep floats at least 300 mm \\(12 in\\) apart",
    claim: "Ontario, Design Guidelines for Sewage Works, 7.2.5: floats at least 300 mm (12 in) apart.",
    quote: "7.2.5 Controls: “Float controls should be at least 300 mm (12 in) vertically and 450 mm (18 in) horizontally apart”",
    verdict: "confirmed", note: "7.2.5 (Controls) gives 300 mm (12 in) vertically (and 450 mm horizontally); the page fetched does not print the year 2008 that Lantern's code comment gives", why: "The note on close floats.", harm: "medium" },
  { id: "E-ont-725-alarm-inlet", rule: "E", right: true, type: "standard", lantern: levels(["float FS1 " + Q + "off" + Q + " 2 ft", "float FS2 " + Q + "lead on" + Q + " 3 ft", "float FS3 " + Q + "high level alarm" + Q + " 5 ft", "inlet 4.5 ft"]), says: "the inlet sewer fills before it sounds",
    claim: "(not cited) an alarm at or above the inlet's invert: the inlet sewer fills before it sounds.",
    quote: "7.2.5: the high level “should be approximately 300 mm (12 in) below the invert of the inlet sewer” where basement flooding or solids deposition cannot otherwise be avoided (the page puts this on the lag pump's start level).",
    verdict: "confirmed", note: "physically true and in line with 7.2.5, which asks for the high level about 300 mm below the inlet invert where flooding or solids are a risk", why: "The note on the alarm and the inlet.", harm: "low" },
  { id: "E-ont-725-off-level", rule: "E", right: true, type: "standard", lantern: levels(["float FS1 " + Q + "off" + Q + " 2 ft", "float FS2 " + Q + "lead on" + Q + " 3 ft"]), says: "Set the off level by the pump maker’s minimum submergence.*Lantern does not know them",
    claim: "The off level: the pump maker's minimum submergence, which Lantern does not know.",
    quote: "7.2.5 (the page's own summary of it): the pump shutdown level is set relative to the pump volute and the flared intake, with clearances from the suction diameter (“Low sewage level (pump shut down) should be at least 300 mm (12 in) or twice the pump suction diameter (D)”).",
    verdict: "confirmed", note: "saying the maker's submergence sets it is right; the chapter Lantern cites does give a rule of thumb (300 mm or twice the suction diameter) that Lantern could also say", why: "What Lantern does not know.", harm: "low" }
];

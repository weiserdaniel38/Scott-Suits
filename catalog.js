const JACKET_CATALOG = {
  // Fabric (patternTypes-based, see FABRIC_PATTERN_TYPES) is wired in via
  // JACKET_CATALOG.fabric = {...} further down, once FABRIC_PATTERN_TYPES
  // and flattenColorFamilies() are both defined -- same pattern as
  // buttoncolor/threadColor below.
  collar: {
    label: "Lapel Style",
    column: "collar_style",
    // Trimmed to the four lapel styles the shop offers: Notch, Peak, Shawl
    // and Diamond (drawings supplied by the shop). The other styles
    // (Narrow/Gorge notch, Curve Peak, the Shawl variants, Safari, Top
    // Collar) were removed on request -- they are saved in
    // catalog_BACKUP_before_lapel_cleanup_20261005.js.txt. The stored
    // names are unchanged, so older orders still read correctly.
    options: [
      { name: "Notch Lapel", img: "./assets/jacket-collar-new-notch.jpg" },
      { name: "Peak Lapel", img: "./assets/jacket-collar-new-peak.jpg" },
      { name: "Shawl", img: "./assets/jacket-collar-new-shawl.jpg" },
      { name: "Diamond Lapel", img: "./assets/jacket-collar-new-diamond.jpg" },
    ],
  },
  lapelwidth: {
    label: "Lapel Width",
    column: "lapel_width",
    // Four simple choices for the customer. The stored value stays the real
    // measurement (e.g. "9 cm") so the printed Client Form / production
    // sheet still tells the shop exactly what to cut; displayName is only
    // what the customer sees. (8.5, 9.5 and 10.5 cm were removed.)
    options: [
      { name: "9 cm", displayName: "Standard", img: "./assets/jacket-lapelwidth-new-9.jpg" },
      { name: "8 cm", displayName: "Thin", img: "./assets/jacket-lapelwidth-new-8.jpg" },
      { name: "10 cm", displayName: "Wide", img: "./assets/jacket-lapelwidth-new-10.jpg" },
      { name: "11 cm", displayName: "Extra Wide", img: "./assets/jacket-lapelwidth-new-11.jpg" },
    ],
  },
  lapelbuttonhole: {
    label: "Lapel Buttonhole",
    column: "lapel_buttonhole",
    // When the Collar Style is Shawl or Diamond Lapel, only these two choices
    // are offered (see allowedOptions() in main.js). Notch and Peak keep the
    // full list.
    allowedBySelection: {
      collar: {
        "Shawl": ["Buttonhole On Left, Only For Shawl And Diamond Lapel", "No Lapel Buttonhole"],
        "Diamond Lapel": ["Buttonhole On Left, Only For Shawl And Diamond Lapel", "No Lapel Buttonhole"],
      },
    },
    // Ordered by buttonhole count (one, then two, then three-plus), each
    // count grouped left/right/both -- rather than the style book's own
    // arbitrary order -- with the shawl/diamond-only special case and "No
    // Lapel Buttonhole" (the absence of one) both placed at the end.
    options: [
      { name: "Standard", img: "./assets/jacket-lapelbuttonhole-left.jpg" },
      { name: "Right", img: "./assets/jacket-lapelbuttonhole-right.jpg" },
      { name: "Right & Left", img: "./assets/jacket-lapelbuttonhole-right-left.jpg" },
      { name: "Left Two", img: "./assets/jacket-lapelbuttonhole-left-two.jpg" },
      { name: "Right Two", img: "./assets/jacket-lapelbuttonhole-right-two.jpg" },
      { name: "Left Three", img: "./assets/jacket-lapelbuttonhole-left-three.jpg" },
      { name: "Left Three, Right Two", img: "./assets/jacket-lapelbuttonhole-left-three-right-two.jpg" },
      { name: "4 Buttonholes On Left", img: "./assets/jacket-lapelbuttonhole-four-left.jpg" },
      { name: "Buttonhole On Left, Only For Shawl And Diamond Lapel", displayName: "Lapel Buttonhole", img: "./assets/jacket-lapelbuttonhole-shawl-diamond-only.jpg" },
      { name: "No Lapel Buttonhole", img: "./assets/jacket-lapelbuttonhole-none.jpg",
        // Shows the shawl drawing (no buttonhole) when the collar is Shawl or Diamond.
        imgBySelection: { collar: { "Shawl": "./assets/jacket-lapelbuttonhole-new-none-shawl.jpg", "Diamond Lapel": "./assets/jacket-lapelbuttonhole-new-none-shawl.jpg" } } },
    ],
  },
  frontbutton: {
    label: "Front Button",
    column: "front_button_request",
    options: [
      { section: "Single Breasted", name: "Single Breasted One Button", img: "./assets/jacket-frontbutton-new-sb1b.jpg" },
      { section: "Single Breasted", name: "Single Breasted Two Buttons", img: "./assets/jacket-frontbutton-new-sb2b.jpg" },
      { section: "Single Breasted", name: "Single Breasted Three Buttons", img: "./assets/jacket-frontbutton-new-sb3b.jpg" },
      { section: "Double Breasted", name: "Double Breasted 6X2", badge: "Standard", img: "./assets/jacket-frontbutton-new-db6x2.jpg" },
      { section: "Double Breasted", name: "Double Breasted 4X2", img: "./assets/jacket-frontbutton-new-db4x2.jpg" },
      { section: "Double Breasted", name: "Double Breasted 6X3", img: "./assets/jacket-frontbutton-new-db6x3.jpg" },
      { section: "Double Breasted", name: "Double Breasted 4X1", img: "./assets/jacket-frontbutton-new-db4x1.jpg" },
      { section: "Double Breasted", name: "Double Breasted One Button", img: "./assets/jacket-frontbutton-new-db1b.jpg" },
      { section: "Double Breasted", name: "Double Breasted 2X1", img: "./assets/jacket-frontbutton-new-db2x1.jpg" },
      { section: "Double Breasted", name: "Double Breasted 6X1", img: "./assets/jacket-frontbutton-new-db6x1.jpg" },
    ],
  },
  sleevecrown: {
    label: "Top Sleeve Crown Type",
    column: "sleeve_crown_type",
    options: [
      { name: "Regular Armhole", img: "./assets/jacket-sleevecrown-regulararmhole.jpg", badge: "Standard" },
      { name: "Naples Sleeve", img: "./assets/jacket-sleevecrown-naplessleeve.jpg" },
      { name: "Close Seam Sleeve", img: "./assets/jacket-sleevecrown-closeseam.jpg" },
    ],
  },
  pockettype: {
    label: "Chest Pocket",
    column: "pocket_type",
    options: [
      { name: "Normal Pocket", img: "./assets/jacket-pockettype-new-normal.jpg" },
      { name: "Boat Shape Pocket", img: "./assets/jacket-pockettype-new-boatshape.jpg" },
      { name: "Single Besom Pocket", img: "./assets/jacket-pockettype-new-singlebesom.jpg" },
      { name: "Double Besom Pocket", img: "./assets/jacket-pockettype-new-doublebesom.jpg" },
      { name: "Patch Pocket No Flap", img: "./assets/jacket-pockettype-new-patchnoflap.jpg" },
      { name: "No Pocket", img: "./assets/jacket-pockettype-new-nohandkerchief.jpg" },
    ],
  },
  lowerpocket: {
    label: "Lower Pockets",
    column: "lower_pocket",
    // 23 options grouped under small headings (Besom / Welt / Slant Besom / Flap /
    // Slant Flap / Patch / High-Back Patch / No Pockets); within a family the
    // rows read plain -> + single ticket pocket -> + double/flap ticket pocket.
    options: [
      { section: "Besom", name: "Single Besom Pocket", img: "./assets/jacket-lowerpocket-new-sb.jpg" },
      { section: "Besom", name: "Double Besom Pocket", img: "./assets/jacket-lowerpocket-new-db.jpg" },
      { section: "Besom", name: "Single Besom Pocket + Single Besom Ticket Pocket", displayName: "Single Besom + Single Besom Ticket", img: "./assets/jacket-lowerpocket-new-sbsbt.jpg" },
      { section: "Besom", name: "Double Besom Pocket + Double Besom Ticket Pocket", displayName: "Double Besom + Double Besom Ticket", img: "./assets/jacket-lowerpocket-new-dbdbt.jpg" },
      { section: "Welt", name: "Flat Welt Pocket", img: "./assets/jacket-lowerpocket-new-flatwelt.jpg" },
      { section: "Slant Besom", name: "Single Besom Slant Pocket", img: "./assets/jacket-lowerpocket-new-sbslant.jpg" },
      { section: "Slant Besom", name: "Double Besom Slant Pocket", img: "./assets/jacket-lowerpocket-new-dbslant.jpg" },
      { section: "Flap", name: "Double Besom W/ Flap", displayName: "Flap Pockets", img: "./assets/jacket-lowerpocket-new-dbwflap.jpg" },
      { section: "Flap", name: "Double Besom W/ Flap And Single Besom Ticket Pocket", displayName: "Flap Pockets + Single Besom Ticket", img: "./assets/jacket-lowerpocket-new-dbwflapsbt.jpg" },
      { section: "Flap", name: "Double Besom W/ Flap And Double Besom Ticket Pocket", displayName: "Flap Pockets + Double Besom Ticket", img: "./assets/jacket-lowerpocket-new-dbwflapdbt.jpg" },
      { section: "Flap", name: "Double Besom W/ Flap And Ticket Pocket W/ Flap", displayName: "Flap Pockets + Flap Ticket Pocket", img: "./assets/jacket-lowerpocket-new-flapft.jpg" },
      { section: "Slant Flap", name: "Slant Pocket Flap", displayName: "Slant Flap Pocket", img: "./assets/jacket-lowerpocket-new-slantflap.jpg" },
      { section: "Slant Flap", name: "Slant Pocket Flap + Single Besom Ticket Pocket", displayName: "Slant Flap + Single Besom Ticket", img: "./assets/jacket-lowerpocket-new-slantflapsbt.jpg" },
      { section: "Slant Flap", name: "Slant Pocket Flap + Double Besom Ticket Pocket", displayName: "Slant Flap + Double Besom Ticket", img: "./assets/jacket-lowerpocket-new-slantflapdbt.jpg" },
      { section: "Slant Flap", name: "Slant Pocket Flap + Double Besom W/ Flat Ticket Pocket", displayName: "Slant Flap + Flap Ticket Pocket", img: "./assets/jacket-lowerpocket-new-slantflapft.jpg" },
      { section: "Patch", name: "Patch Pocket", displayName: "Patch Pocket", img: "./assets/jacket-lowerpocket-new-patch.jpg" },
      { section: "Patch", name: "Patch Pocket + Single Besom Ticket Pocket", displayName: "Patch Pocket + Single Besom Ticket", img: "./assets/jacket-lowerpocket-new-patchsbt.jpg" },
      { section: "Patch", name: "Patch Pocket + Double Besom Ticket Pocket", displayName: "Patch Pocket + Double Besom Ticket", img: "./assets/jacket-lowerpocket-new-patchdbt.jpg" },
      { section: "Patch", name: "Curved Patch Pocket", img: "./assets/jacket-lowerpocket-new-curvedpatch.jpg" },
      { section: "High-Back Patch", name: "Patch Pocket With Highly Back", displayName: "High-Back Patch Pocket", img: "./assets/jacket-lowerpocket-new-patchhighback.jpg" },
      { section: "High-Back Patch", name: "Patch Pocket With Highly Back + Single Besom Pocket", displayName: "High-Back Patch + Single Besom Ticket", img: "./assets/jacket-lowerpocket-new-patchhighbacksbt.jpg" },
      { section: "High-Back Patch", name: "Patch Pocket With Highly Back + Double Besom Ticket", displayName: "High-Back Patch + Double Besom Ticket", img: "./assets/jacket-lowerpocket-new-patchhighbackdbt.jpg" },
      { section: "No Pockets", name: "No Front Pocket", img: "./assets/jacket-lowerpocket-new-nofront.jpg" },
    ],
  },
  buttonNail: {
    label: "Button Nail Method",
    column: "jacket_button_nail_method",
    options: [
      { name: "X Shape Sewing Button", displayName: "X Shape Sewing", img: "./assets/buttonnail-new-x.jpg" },
      { name: "II Shape Sewing Button", displayName: "Parallel Sewing", img: "./assets/buttonnail-new-parallel.jpg" },
      { name: "Hand Shape Sewing Button", displayName: "Arrow Shape Sewing", img: "./assets/buttonnail-new-arrow.jpg" },
    ],
  },
  construction: {
    label: "Construction",
    column: "jacket_construction",
    options: [
      { name: "Fused Construction", img: "./assets/jacket-construction-new-fused.jpg", badge: "Standard" },
      { name: "Full Canvas Construction", img: "./assets/jacket-construction-new-canvas.jpg" },
    ],
  },
  facing: {
    label: "Facing Style",
    column: "facing_style",
    // Shown on the options page as a brief explainer -- most customers
    // won't know this tailoring term on sight the way they might "collar"
    // or "pocket".
    description: "The facing is the inside lining along the jacket's front edge, behind the lapel and buttons -- its shape and coverage affect the jacket's structure and weight.",
    // Options taken off the designer. A draft saved while one of these was
    // picked has it cleared on reload (see reconcileSelections in main.js)
    // so the customer is asked again instead of ordering a retired style.
    retiredOptions: [
      "Small Round Facing",
      "Arrow Shape Facing W/ Normal Inside Pocket + Cigarette Pocket",
      "No Lining Light Construction W/ Piping Seam",
    ],
    options: [
      { name: "Round Shape Facing", img: "./assets/jacket-facing-new-round.jpg", badge: "Standard" },
      { name: "Half Lining W/ Fabric Facing", img: "./assets/jacket-facing-new-halflwfabric.jpg" },
      { name: "No Lining Construction", img: "./assets/jacket-facing-new-nolining.jpg" },
    ],
  },
  insidepocket: {
    label: "Inside Pocket Style",
    column: "inside_pocket_style",
    options: [
      { name: "Normal Inside Pocket W/ Pen Pocket", img: "./assets/jacket-insidepocket-new-pen.jpg" },
      { name: "Normal Inside Pocket W/ Water Drop Pen Pocket", img: "./assets/jacket-insidepocket-new-waterdrop.jpg" },
      { name: "Normal Inside Pocket W/ Pen Pocket + Cigarette Pocket", img: "./assets/jacket-insidepocket-new-pencig.jpg" },
    ],
  },
  monogram: {
    label: "Monogram Placement",
    column: "jacket_monogram_placement",
    // A "type your monogram" box shown above the placement cards (see
    // textInput handling in createDesigner, main.js); required once any
    // placement other than skipWhen is chosen.
    textInput: { label: "Your monogram", placeholder: "Type your monogram (initials or name)", hint: "Type it exactly as you'd like it stitched.", maxLength: 24, skipWhen: "No Monogram Need" },
    options: [
      { name: "No Monogram Need", displayName: "No Monogram", img: "./assets/jacket-monogram-new-nomonogram.jpg" },
      { name: "On Left Inside Pocket", displayName: "Left Inside Pocket", img: "./assets/jacket-monogram-new-onleftinsidepkt.jpg" },
      { name: "On Right Inside Pocket", displayName: "Right Inside Pocket", img: "./assets/jacket-monogram-new-onrightinsidepkt.jpg" },
      { name: "On Right Inside Pocket, Monogram On Satin", displayName: "Inside Pocket Satin Tape", img: "./assets/jacket-monogram-new-pocketsatin.jpg" },
      { name: "Monogram On Middle Under Collar", displayName: "Middle Under Collar", img: "./assets/jacket-monogram-new-middlecollar.jpg" },
      { name: "Monogram Placement On Left Button", displayName: "Left Lapel Placement", img: "./assets/jacket-monogram-new-lapel.jpg" },
      { name: "Above Left Sleeve Cuff 2cm", displayName: "Above Left Sleeve Cuff", img: "./assets/jacket-monogram-new-leftcuff.jpg" },
      { name: "Above Right Sleeve Cuff 2cm", displayName: "Above Right Sleeve Cuff", img: "./assets/jacket-monogram-new-rightcuff.jpg" },
    ],
  },
  backvent: {
    label: "Back Vents",
    column: "back_vents",
    options: [
      { name: "Side Vent", img: "./assets/jacket-backvent-new-side.jpg" },
      { name: "Center Vent", img: "./assets/jacket-backvent-new-center.jpg" },
      { name: "No Vent", img: "./assets/jacket-backvent-new-no.jpg" },
    ],
  },
  sleevecuffstyle: {
    label: "Sleeve Cuff Styles",
    column: "sleeve_cuff_style",
    options: [
      { name: "Working Sleeve Cuff", displayName: "Opening Sleeve Cuff", img: "./assets/jacket-sleevecuffstyle-new-working.jpg" },
      { name: "Imitation Button Hole On Sleeve Cuff", displayName: "Imitation Buttonhole Sleeve Cuff", img: "./assets/jacket-sleevecuffstyle-new-imitation.jpg" },
      { name: "Working Sleeve Cuff W/ Slant Type Button", displayName: "Opening Sleeve Cuff With Slant Buttons", img: "./assets/jacket-sleevecuffstyle-new-workingws.jpg" },
      { name: "Imitation Button Hole On Sleeve Cuff W/ Slant Type Button", displayName: "Imitation Buttonhole Cuff With Slant Buttons", img: "./assets/jacket-sleevecuffstyle-new-imitationws.jpg" },
    ],
  },
  cuffbuttons: {
    label: "Buttons On Sleeve Cuff",
    column: "sleeve_cuff_buttons",
    compactCards: true,  // smaller picture cards (more per row) -- 13 options

    options: [
      { section: "Flat", name: "3 Flat Button", img: "./assets/jacket-cuffbuttons-new-flat3.jpg" },
      { section: "Flat", name: "4 Flat Button", img: "./assets/jacket-cuffbuttons-new-flat4.jpg" },
      { section: "Flat", name: "5 Flat Button", img: "./assets/jacket-cuffbuttons-new-flat5.jpg" },
      { section: "Overlap", name: "4 Overlap Button", img: "./assets/jacket-cuffbuttons-new-overlap4.jpg" },
      { section: "Overlap", name: "5 Overlap Button", img: "./assets/jacket-cuffbuttons-new-overlap5.jpg" },
      { section: "Overlap", name: "6 Overlap Button", img: "./assets/jacket-cuffbuttons-new-overlap6.jpg" },
      { section: "Slant Flat", name: "4 Slant Button", displayName: "4 Slant Flat Button", img: "./assets/jacket-cuffbuttons-new-slant4.jpg" },
      { section: "Slant Flat", name: "5 Slant Button", displayName: "5 Slant Flat Button", img: "./assets/jacket-cuffbuttons-new-slant5.jpg" },
      { section: "Slant Overlap", name: "4 Slant Overlap Button", img: "./assets/jacket-cuffbuttons-new-slantoverlap4.jpg" },
      { section: "Slant Overlap", name: "5 Slant Overlap Button", img: "./assets/jacket-cuffbuttons-new-slantoverlap5.jpg" },
      { section: "Slant Overlap", name: "6 Slant Overlap Button", img: "./assets/jacket-cuffbuttons-new-slantoverlap6.jpg" },
      { section: "No Buttons", name: "Button Less Sleeve (4 Buttons)", img: "./assets/jacket-cuffbuttons-new-less.jpg" },
    ],
  },
};

// Groups the jacket's 15 option categories into a handful of labeled
// sections (Fabric, Collar & Lapel, and so on) instead of one long flat list
// of tabs -- the categories themselves and their order inside each group are
// unchanged, this just clusters related ones under a heading so the tab list
// reads as organized rather than a wall of options. Every JACKET_CATALOG key
// must appear in exactly one group here, in the order it should be offered.
const JACKET_CATALOG_GROUPS = [
  { label: "Fabric", keys: ["fabric"] },
  { label: "Shape & Lapel", keys: ["frontbutton", "collar", "lapelwidth"] },
  { label: "Pockets & Vents", keys: ["pockettype", "lowerpocket", "backvent"] },
  { label: "Sleeves", keys: ["sleevecuffstyle", "cuffbuttons"] },
  { label: "Buttons, Lining & Details", keys: ["buttoncolor", "lining", "lapelbuttonhole", "buttonholeThreadColor", "feltundercollar", "feltColor", "threadColor", "buttonNail", "insidepocket"] },
  { label: "Personalization", keys: ["monogram"] },
  // Technical tailoring questions go last so they don't slow down the
  // visible style choices above.
  { label: "Tailor's Details", keys: ["construction", "facing", "sleevecrown"] },
];

const PANTS_CATALOG = {
  // Fabric wired in below via PANTS_CATALOG.fabric = {...}, same as jacket.
  waistLineHeight: {
    label: "Waist Line Height",
    column: "waist_line_height",
    options: [
      // Stored names stay "5.0 cm" / "5.5 cm" (what the factory form prints);
      // customers see Standard / Tall.
      { name: "5.0 cm", displayName: "Standard", img: "./assets/pants-waist-new-standard.jpg" },
      { name: "5.5 cm", displayName: "Tall", img: "./assets/pants-waist-new-tall.jpg" },
    ],
  },
  waistbandExtension: {
    label: "Waistband Extension Style",
    column: "waistband_extension_style",
    compactCards: true,  // smaller picture cards (3 per row on phone)
    options: [
      { section: "Round", name: "Round Shape 5cm", displayName: "Round Shape", img: "./assets/pants-wext-new-round.jpg" },
      { section: "Round", name: "Round Shape 5cm (No Button/Hole)", displayName: "Round Shape (No Button/Hole)", img: "./assets/pants-wext-new-round-nobh.jpg" },
      { section: "Round", name: "Long Round Shape", img: "./assets/pants-wext-new-longround.jpg" },
      { section: "Arrow", name: "Arrow Shape 5cm", displayName: "Arrow Shape", img: "./assets/pants-wext-new-arrow.jpg" },
      { section: "Arrow", name: "Arrow Shape 5cm (No Button/Hole)", displayName: "Arrow Shape (No Button/Hole)", img: "./assets/pants-wext-new-arrow-nobh.jpg" },
      { section: "Square", name: "Square Shape 5cm", displayName: "Square Shape", img: "./assets/pants-wext-new-square.jpg" },
      { section: "Square", name: "Square Shape 5cm (No Button/Hole)", displayName: "Square Shape (No Button/Hole)", img: "./assets/pants-wext-new-square-nobh.jpg" },
      { section: "Square", name: "Square Waistband (No Button/Hole)", displayName: "Square Waistband Centered", formNote: "Centered over zipper", img: "./assets/pants-wext-new-squarewb-nobh.jpg" },
      { section: "Square", name: "Square Shape W/ Long Extension", img: "./assets/pants-wext-new-square-longext.jpg" },
      { section: "No Waistband", name: "No Waistband + String", img: "./assets/pants-wext-new-nowaistbandstring.jpg" },
    ],
  },
  waistbandStyle: {
    label: "Waistband Style",
    column: "waistband_style",
    options: [
      { name: "Normal Waistband", img: "./assets/pants-wstyle-new-normal.jpg" },
      { name: "Elastic Waistband On Side Buttons", img: "./assets/pants-wstyle-new-elastic.jpg" },
      { name: "Arrow Shape Belt W/ Adjustable Buckle", img: "./assets/pants-wstyle-new-arrowbelt.jpg" },
      { name: "Adjustable Waistband On Side W/ Buckle", img: "./assets/pants-wstyle-new-adjside.jpg" },
    ],
  },
  frontPleat: {
    label: "Front Pleat",
    column: "front_pleat",
    options: [
      { name: "No Pleat", img: "./assets/pants-pleat-new-no.jpg" },
      { name: "Single Pleat", img: "./assets/pants-pleat-new-single.jpg" },
      { name: "Double Pleat", img: "./assets/pants-pleat-new-double.jpg" },
    ],
  },
  beltLoops: {
    label: "Belt Loops",
    column: "belt_loops",
    options: [
      { name: "Belt Loops", img: "./assets/pants-beltloop-new-yes.jpg" },
      { name: "X Loops", img: "./assets/pants-beltloop-new-x.jpg" },
      { name: "No Belt Loop", img: "./assets/pants-beltloop-new-no.jpg" },
    ],
  },
  hookEye: {
    label: "Hook And Eye Style",
    column: "hook_and_eye_style",
    // Shown on the options page as a brief explainer -- most customers
    // won't know this tailoring term on sight.
    description: "The hook and eye is the small fastener that closes the waistband at the very top of the fly, above the zipper -- its style affects how the waistband closes and sits.",
    options: [
      { name: "Metal Hook And Eye", img: "./assets/pants-hookeye-new-metal.jpg" },
      { name: "Arrow Shape Extension (Button)", img: "./assets/pants-hookeye-new-arrow.jpg" },
    ],
  },
  frontPocket: {
    label: "Front Pocket Style",
    column: "front_pocket_style",
    options: [
      { name: "Slant Pocket", img: "./assets/pants-fpocket-new-slant.jpg" },
      { name: "Single Besom", img: "./assets/pants-fpocket-new-single-besom.jpg" },
      { name: "Double Besom", img: "./assets/pants-fpocket-new-double-besom.jpg" },
      { name: "On Seam Pocket", img: "./assets/pants-fpocket-new-onseam.jpg" },
      { name: "Moon Shape Pocket", img: "./assets/pants-fpocket-new-moon.jpg" },
      { name: "Moon Shape Pocket + Coin Pocket", img: "./assets/pants-fpocket-new-moon-coin.jpg" },
    ],
  },
  bottomStyle: {
    label: "Bottom Style",
    column: "bottom_style",
    options: [
      // displayName "Hem" is the customer-facing label; the underlying name
      // stays "Turn Up Bottom" because that's still what should print on the
      // Client Form / order data (see friendlyName/displayValue vs.
      // resolvedValue in main.js).
      { name: "Turn Up Bottom", displayName: "Hem", img: "./assets/pants-bottom-new-hem.jpg", badge: "Standard" },
      // Customer-facing names only; the stored names ("W/ Cuff 3.5 cm" etc.)
      // stay as the supplier values for the Client Form / order data.
      { name: "W/ Cuff 3.5 cm", displayName: "Thin Cuff", img: "./assets/pants-bottom-new-thin.jpg" },
      { name: "W/ Cuff 4.0 cm", displayName: "Classic Cuff", img: "./assets/pants-bottom-new-classic.jpg" },
      { name: "W/ Cuff 5.0 cm", displayName: "Tall Cuff", img: "./assets/pants-bottom-new-tall.jpg" },
    ],
  },
  buttonNail: {
    label: "Button Nail Method",
    column: "button_nail_method",
    options: [
      { name: "X Shape Sewing Button", displayName: "X Shape Sewing", img: "./assets/buttonnail-new-x.jpg" },
      { name: "II Shape Sewing Button", displayName: "Parallel Sewing", img: "./assets/buttonnail-new-parallel.jpg" },
      { name: "Hand Shape Sewing Button", displayName: "Arrow Shape Sewing", img: "./assets/buttonnail-new-arrow.jpg" },
    ],
  },
  watchPocket: {
    label: "Watch Pocket Placement",
    column: "watch_pocket_placement",
    options: [
      { name: "Right Waist Sewn Up", img: "./assets/pants-watch-new-rightsewn.jpg" },
      { name: "Peach-Shaped Pocket", img: "./assets/pants-watch-new-peach.jpg" },
      { name: "Top Of Right Waist", displayName: "Top of Right Waist", img: "./assets/pants-watch-new-topright.jpg" },
      { name: "No Watch Pocket", img: "./assets/pants-watch-new-no.jpg" },
    ],
  },
  backWaistShape: {
    label: "Back Waist Shape",
    column: "back_waist_shape",
    options: [
      { name: "No V Open", img: "./assets/pants-backwaist-new-no-v.jpg" },
      { name: "Back Waist Seam V Shape", img: "./assets/pants-backwaist-new-v-shape.jpg" },
      { name: "Back Seam W/ Straight 3/8 Top Open", img: "./assets/pants-backwaist-new-straight-38.jpg" },
    ],
  },
  monogram: {
    label: "Monogram Placement",
    column: "monogram_placement",
    // A "type your monogram" box shown above the placement cards (see
    // textInput handling in createDesigner, main.js); required once any
    // placement other than skipWhen is chosen.
    textInput: { label: "Your monogram", placeholder: "Type your monogram (initials or name)", hint: "Type it exactly as you'd like it stitched.", maxLength: 24, skipWhen: "No Monogram Need" },
    options: [
      { name: "No Monogram Need", displayName: "No Monogram", img: "./assets/pants-monogram-new-none.jpg" },
      { name: "Monogram On Left Back Pocket", displayName: "Left Back Pocket", img: "./assets/pants-monogram-new-leftback.jpg" },
      { name: "On Right Side Below Waistband Seam", displayName: "Right Side Below Waistband Seam", img: "./assets/pants-monogram-new-rightbelow.jpg" },
      { name: "Monogram Inside Left Waist", displayName: "Inside Left Waist", img: "./assets/pants-monogram-new-insideleft.jpg" },
    ],
  },
  backPocket: {
    label: "Back Pocket Style",
    column: "back_pocket_style",
    options: [
      { section: "Besom (Both Sides)", name: "Besom Pocket W/ Button", displayName: "Single Besom With Buttons", img: "./assets/pants-bpocket-new-single-besom-buttons.jpg" },
      { section: "Besom (Both Sides)", name: "Double Besom Pocket", displayName: "Double Besom With Buttons", img: "./assets/pants-bpocket-new-db-buttons.jpg" },
      { section: "Besom (Both Sides)", name: "Double Besom Pocket Left W/ Button", displayName: "Double Besom, Left Button", img: "./assets/pants-bpocket-new-db-leftbutton.jpg" },
      { section: "Besom (Both Sides)", name: "Double Besom Pocket W/ No Button", displayName: "Double Besom, No Buttons", img: "./assets/pants-bpocket-new-db-nobuttons.jpg" },
      { section: "Right Side Only", name: "Right Side Double Besom Pocket W/ Button", displayName: "Right Double Besom With Button", img: "./assets/pants-bpocket-new-right-db-button.jpg" },
      { section: "Right Side Only", name: "Right Side Double Besom Pocket No Button", displayName: "Right Double Besom, No Button", img: "./assets/pants-bpocket-new-right-db-nobutton.jpg" },
      { section: "Flap", name: "Rhombus Shape Pocket Flap", displayName: "Rhombus Pocket Flap", img: "./assets/pants-bpocket-new-rhombus.jpg" },
      { section: "Flap", name: "Peach Shape Pocket Flap", img: "./assets/pants-bpocket-new-peach.jpg" },
      { section: "Flap", name: "Slant Corner Pocket Flap", img: "./assets/pants-bpocket-new-slantcorner.jpg" },
      { section: "Flap", name: "Wave Pocket Flap", img: "./assets/pants-bpocket-new-wave.jpg" },
      { section: "No Pocket", name: "No Pocket", img: "./assets/pants-bpocket-new-none.jpg" },
    ],
  },
};

// Same idea as JACKET_CATALOG_GROUPS above -- groups the pants' 14 option
// categories into labeled sections instead of one long flat tab list. Every
// PANTS_CATALOG key must appear in exactly one group here, in the order it
// should be offered.
const PANTS_CATALOG_GROUPS = [
  { label: "Fabric", keys: ["fabric"] },
  { label: "Front & Waistband", keys: ["frontPleat", "waistLineHeight", "waistbandStyle", "waistbandExtension", "beltLoops"] },
  { label: "Pockets", keys: ["frontPocket", "backPocket", "watchPocket"] },
  { label: "Bottom & Details", keys: ["bottomStyle", "backWaistShape", "hookEye", "threadColor", "buttonholeThreadColor", "buttonNail"] },
  { label: "Personalization", keys: ["monogram"] },
];

// "part" says which garment each measurement belongs to -- used to show/
// require only the jacket measurements for a "Jacket Only" order (see
// activeMeasurements() in main.js) instead of also asking for pants
// measurements nobody's ordering.
const MEASUREMENTS = [
  { id: "shoulder", label: "Shoulder", part: "jacket" },
  { id: "sleeve_length", label: "Sleeve Length", part: "jacket" },
  { id: "wrist", label: "Wrist", part: "jacket" },
  { id: "chest", label: "Chest", part: "jacket" },
  { id: "stomach", label: "Stomach", part: "jacket" },
  { id: "front_jacket", label: "Front Jacket", part: "jacket" },
  { id: "back_jacket", label: "Back Jacket", part: "jacket" },
  { id: "bicep", label: "Bicep", part: "jacket" },
  { id: "hips", label: "Hips", part: "pants" },
  { id: "waist", label: "Waist", part: "pants" },
  { id: "leg_length", label: "Full Pants Length", part: "pants" },
  { id: "crotch", label: "Crotch", part: "pants" },
  { id: "thigh", label: "Thigh", part: "pants" },
  { id: "knee", label: "Knee", part: "pants" },
  { id: "calf", label: "Calf", part: "pants" },
  { id: "cuff", label: "Cuff", part: "pants" },
];

// ---------------------------------------------------------------------
// "Don't know your measurements?" size-based estimator
//
// A customer who doesn't have a tape measure handy can instead pick their
// usual off-the-rack jacket size (chest + length) and pants size (waist +
// inseam); we use that to fill in a starting-point estimate for every field
// in MEASUREMENTS above, in centimeters, which the customer can then review
// and adjust before continuing.
//
// This IS grounded in the factory's own graded size chart (Regular column,
// sizes 36-52 -- see LEMON_TREE_SIZE_CHART_R below, transcribed directly
// from their spec sheet). Every field the chart actually covers is linearly
// interpolated (or, past the chart's own 36-52 range, extrapolated along
// the same slope as the nearest pair of real sizes) from those real
// numbers, in inches, rather than guessed. Only crotch and calf have no
// corresponding row in the chart, so those two still fall back to a
// reasonable ratio of waist -- everything else below is real factory data.
// ---------------------------------------------------------------------
const IN_TO_CM = 2.54;

const JACKET_CHEST_SIZE_OPTIONS = [34, 36, 38, 40, 42, 44, 46, 48, 50, 52, 54];
const PANTS_WAIST_SIZE_OPTIONS = [28, 30, 32, 34, 36, 38, 40, 42, 44, 46, 48, 50];

const PANTS_INSEAM_OPTIONS = [28, 30, 32, 34, 36, 38];

// The customer picks a nominal inseam size same as waist above; that inseam
// converts to a finished Full Pants Length (waistband to hem) via the shop's
// own printed reference chart, in cm, used exactly as given below rather
// than re-derived from a flat rise formula.
const PANTS_INSEAM_TO_FULL_LENGTH_CM = {
  28: 96.5,
  30: 101.6,
  32: 106.7,
  34: 111.8,
  36: 116.8,
  38: 121.9,
};

// Looks up the chart above for an exact inseam match (the only values the
// dropdown ever offers); falls back to interpolating/extrapolating along the
// chart's own trend for any other value, same technique as
// interpolateFromChart() below, so an unexpected input still gets a
// reasonable number instead of undefined.
function pantsInseamToFullLengthCm(inseamIn) {
  if (PANTS_INSEAM_TO_FULL_LENGTH_CM[inseamIn] !== undefined) {
    return PANTS_INSEAM_TO_FULL_LENGTH_CM[inseamIn];
  }
  const points = Object.keys(PANTS_INSEAM_TO_FULL_LENGTH_CM).map((k) => [
    Number(k),
    PANTS_INSEAM_TO_FULL_LENGTH_CM[k],
  ]);
  return interpolateFromChart(inseamIn, points);
}

// Lemon Tree's own graded spec chart, Regular column only (sizes 36R-52R).
// "size" is the nominal suit size label the customer picks from the jacket
// chest dropdown; every other value is that size's real finished
// measurement in inches, straight from the chart. (The chart's separate
// 34L/38L/40S columns aren't needed here -- see the Short/Long deltas
// below, which are calibrated from those columns instead of duplicating
// them into this table.)
const LEMON_TREE_SIZE_CHART_R = [
  { size: 36, chest: 38, stomach: 34.6, shoulder: 17.2, frontLength: 28, sleeve: 24.2, bicep: 12.5, wrist: 10, waist: 31, hips: 37, thigh: 23, knee: 16.5, cuff: 13 },
  { size: 38, chest: 40, stomach: 35.8, shoulder: 18, frontLength: 28, sleeve: 24.5, bicep: 13.5, wrist: 10, waist: 33, hips: 39, thigh: 25, knee: 16.9, cuff: 13 },
  { size: 40, chest: 42, stomach: 37.8, shoulder: 18.5, frontLength: 29, sleeve: 25, bicep: 14.5, wrist: 10.5, waist: 34, hips: 41, thigh: 26, knee: 17.5, cuff: 13 },
  { size: 42, chest: 44, stomach: 39.7, shoulder: 19, frontLength: 29, sleeve: 25, bicep: 15.5, wrist: 10.5, waist: 36, hips: 42, thigh: 27, knee: 17.7, cuff: 13.5 },
  { size: 44, chest: 46, stomach: 41.7, shoulder: 19.5, frontLength: 30, sleeve: 25.25, bicep: 16.5, wrist: 10.5, waist: 38, hips: 45, thigh: 28, knee: 18.1, cuff: 13.5 },
  { size: 46, chest: 48, stomach: 43.7, shoulder: 20, frontLength: 30, sleeve: 25.25, bicep: 17.5, wrist: 11, waist: 40, hips: 47, thigh: 29, knee: 18.8, cuff: 14 },
  { size: 48, chest: 50, stomach: 46, shoulder: 20.25, frontLength: 31.5, sleeve: 25.25, bicep: 19, wrist: 12, waist: 42, hips: 49, thigh: 30, knee: 19.6, cuff: 14 },
  { size: 50, chest: 52, stomach: 48, shoulder: 20.5, frontLength: 32, sleeve: 25.5, bicep: 20, wrist: 12, waist: 44, hips: 51, thigh: 31, knee: 20.4, cuff: 15 },
  { size: 52, chest: 54.3, stomach: 50.3, shoulder: 20.8, frontLength: 33, sleeve: 25.9, bicep: 20, wrist: 12.5, waist: 46.4, hips: 54, thigh: 30, knee: 21.2, cuff: 15 },
];

// Piecewise-linear lookup: interpolates between the two real chart points
// bracketing x, or extrapolates past either end using the slope of the
// nearest real segment -- so dropdown values inside the chart's own range
// (most of them) read out an exact or interpolated real number, and only
// the couple of values outside it (e.g. a 34 chest, below the chart's
// smallest 36) fall back to extending the real trend rather than a guess.
function interpolateFromChart(x, points) {
  const pts = points.slice().sort((a, b) => a[0] - b[0]);
  if (x <= pts[0][0]) {
    const [x0, y0] = pts[0];
    const [x1, y1] = pts[1];
    return y0 + ((y1 - y0) / (x1 - x0)) * (x - x0);
  }
  if (x >= pts[pts.length - 1][0]) {
    const [x0, y0] = pts[pts.length - 2];
    const [x1, y1] = pts[pts.length - 1];
    return y1 + ((y1 - y0) / (x1 - x0)) * (x - x1);
  }
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[i + 1];
    if (x >= x0 && x <= x1) {
      return y0 + ((y1 - y0) / (x1 - x0)) * (x - x0);
    }
  }
  return pts[pts.length - 1][1];
}

function chartLookup(x, field, xField) {
  const points = LEMON_TREE_SIZE_CHART_R.map((row) => [row[xField], row[field]]);
  return interpolateFromChart(x, points);
}

// Jacket length (Short/Regular/Long) deltas for the two true "length"
// fields, calibrated from the chart's own 40S and 38L columns compared
// against the Regular column at the same size label (40S vs 40R, 38L vs
// 38R) -- not a guess, the actual observed difference in the chart.
// Circumference/frame fields (chest, shoulder, wrist, bicep, stomach)
// don't shift with length in the chart, so they're left alone here.
const JACKET_LENGTH_DELTA_IN = {
  S: { frontLength: -1, sleeve: -1.5 },
  R: { frontLength: 0, sleeve: 0 },
  L: { frontLength: 0, sleeve: 1.5 },
};

// Same idea for pants: a Short/Regular/Long leg-length preference nudges the
// finished leg length up or down from the size-based estimate, same 1.5in
// step as the jacket sleeve above (no chart row for pants length by size, so
// this is a flat offset rather than a chart-calibrated one).
const PANTS_LENGTH_DELTA_IN = {
  S: { leg_length: -1.5 },
  R: { leg_length: 0 },
  L: { leg_length: 1.5 },
};

// Fit preference nudges circumference/width fields in slightly, relative to
// the Regular-Fit chart numbers above -- which fields exactly differs by
// garment (see estimateJacketMeasurementsIn's chest/stomach/bicep and
// estimatePantsMeasurementsIn's thigh/knee). It never touches the
// direct-input anchors (waist -- see the one-size-up note on
// estimatePantsMeasurementsIn() below -- and leg_length, which is looked up
// from the inseam -> Full Pants Length chart instead) or the
// structural/length fields (shoulder, sleeve_length, wrist, front_jacket,
// back_jacket, crotch), which are driven by frame size, not fit preference.
// The same regular/slim/superslim keys drive both garments' fit dropdowns,
// even though pants labels these "Tapered"/"Skinny"/"Extra Skinny" rather
// than the jacket's "Regular Fit"/"Slim Fit"/"Super Slim Fit" (see the
// estPantsFit options in index.html).
const FIT_OPTIONS = [
  { value: "regular", label: "Regular Fit" },
  { value: "slim", label: "Slim Fit" },
  { value: "superslim", label: "Super Slim Fit" },
];
const FIT_ADJUST = { regular: 1, slim: 0.96, superslim: 0.91 };

function estimateJacketMeasurementsIn(chestIn, lengthKey, fitKey) {
  const lenDelta = JACKET_LENGTH_DELTA_IN[lengthKey] || JACKET_LENGTH_DELTA_IN.R;
  const fitMult = FIT_ADJUST[fitKey] || 1;
  const frontJacket = chartLookup(chestIn, "frontLength", "size") + lenDelta.frontLength;
  return {
    chest: chartLookup(chestIn, "chest", "size") * fitMult,
    shoulder: chartLookup(chestIn, "shoulder", "size"),
    sleeve_length: chartLookup(chestIn, "sleeve", "size") + lenDelta.sleeve,
    wrist: chartLookup(chestIn, "wrist", "size"),
    stomach: chartLookup(chestIn, "stomach", "size") * fitMult,
    bicep: chartLookup(chestIn, "bicep", "size") * fitMult,
    front_jacket: frontJacket,
    // back_jacket isn't computed here -- it's always derived from the
    // (calibration-corrected) front_jacket in cm, see estimateMeasurementsCm.
  };
}

function estimatePantsMeasurementsIn(waistIn, fitKey) {
  const fitMult = FIT_ADJUST[fitKey] || 1;
  // Waist is picked as a nominal off-the-rack size, which runs snugger than
  // a made-to-measure finished waist -- so this direct-input anchor fills in
  // one size up (the shop's waist sizes step by 2in) from what was actually
  // picked. Leg length isn't included here -- it comes from the inseam ->
  // Full Pants Length chart above (see estimateMeasurementsCm below), in cm
  // directly, rather than through this inches-based path. Every other field
  // estimates off the actual selected waist for correct body proportions.
  // Pants fit (Tapered / Skinny / Extra Skinny) only tapers thigh and knee --
  // waist, hips, cuff, crotch and calf all stay the same regardless of fit,
  // unlike the jacket's fit adjustment above which does taper its own
  // circumference fields.
  return {
    waist: waistIn + 2,
    hips: chartLookup(waistIn, "hips", "waist"),
    thigh: chartLookup(waistIn, "thigh", "waist") * fitMult,
    knee: chartLookup(waistIn, "knee", "waist") * fitMult,
    cuff: chartLookup(waistIn, "cuff", "waist"),
    // Chart has no crotch or calf row -- these two remain an estimated
    // ratio of waist, same as before.
    crotch: waistIn * 0.78,
    calf: waistIn * 0.42,
  };
}

// Calibration corrections for the jacket chart estimate above, from
// comparing it against real completed orders -- applied directly in cm,
// after the inches-based chart conversion, since they're flat real-world
// corrections rather than something calibrated in inches. Positive means
// the chart estimate was running small (so this adds to it); negative means
// it was running big.
const JACKET_ESTIMATE_CM_CORRECTIONS = {
  shoulder: -2, // chart estimate runs 2cm big
  sleeve_length: 1.5, // chart estimate runs 1.5cm small
  front_jacket: 2, // chart estimate runs 2cm small
  bicep: 1, // chart estimate runs 1cm small
};
// back_jacket isn't its own correction -- it's always exactly this much
// less than the (corrected) front_jacket, per the shop's own rule of thumb.
const JACKET_BACK_LENGTH_DROP_CM = 1.5;

// Same idea for pants -- the chart estimate for thigh/knee just runs 5cm
// big across the board, independent of fit preference. This used to be
// applied only when pantsFitKey was "regular" (on the theory that Skinny/
// Extra Skinny were already correctly calibrated via FIT_ADJUST's own
// tapering), but that made Tapered's thigh/knee come out equal to or even
// narrower than Skinny's at some waists -- exactly backwards, since Tapered
// is meant to be the loosest of the three and Extra Skinny the tightest.
// Applying the same flat offset to all three fits fixes that: subtracting
// an equal constant from FIT_ADJUST's already-monotonic 1.00/0.96/0.91
// multiplier results can't change their relative order, so Tapered stays
// loosest and Extra Skinny stays tightest no matter what this offset is.
const PANTS_THIGH_KNEE_CM_CORRECTION = {
  thigh: -5, // chart estimate runs 5cm big
  knee: -5, // chart estimate runs 5cm big
};

// The cuff (ankle opening) chart estimate keeps climbing with waist size, but
// a cuff any wider than this stops looking right regardless of waist or fit,
// so it's capped rather than left to climb indefinitely.
const PANTS_CUFF_MAX_CM = 33;

// Returns { [measurementId]: cmValue } for every id in MEASUREMENTS. Every
// field but leg_length is rounded to the nearest 0.5cm; leg_length instead
// comes straight from the shop's own inseam -> Full Pants Length chart (see
// above) and is only rounded to the nearest 0.1cm, so it matches that chart
// exactly for a Regular length preference rather than getting bucketed into
// the coarser 0.5cm grid used for the rest of the estimate.
function estimateMeasurementsCm(jacketChestIn, jacketLength, pantsWaistIn, pantsInseamIn, pantsLengthKey, jacketFitKey, pantsFitKey) {
  const jacketIn = estimateJacketMeasurementsIn(jacketChestIn, jacketLength, jacketFitKey);
  const pantsIn = estimatePantsMeasurementsIn(pantsWaistIn, pantsFitKey);
  const allIn = Object.assign({}, jacketIn, pantsIn);
  const result = {};
  MEASUREMENTS.forEach((m) => {
    const valueIn = allIn[m.id];
    if (valueIn === undefined) return;
    result[m.id] = Math.round(valueIn * IN_TO_CM * 2) / 2;
  });

  Object.keys(JACKET_ESTIMATE_CM_CORRECTIONS).forEach((key) => {
    if (result[key] !== undefined) result[key] += JACKET_ESTIMATE_CM_CORRECTIONS[key];
  });
  // Applied to every fit (not just Tapered/regular) -- see the comment on
  // PANTS_THIGH_KNEE_CM_CORRECTION above for why.
  Object.keys(PANTS_THIGH_KNEE_CM_CORRECTION).forEach((key) => {
    if (result[key] !== undefined) result[key] += PANTS_THIGH_KNEE_CM_CORRECTION[key];
  });
  if (result.front_jacket !== undefined) {
    result.back_jacket = result.front_jacket - JACKET_BACK_LENGTH_DROP_CM;
  }

  // The cuff (ankle opening) chart estimate keeps climbing with waist size,
  // but a cuff this wide never actually looks right -- cap it regardless of
  // waist or fit.
  if (result.cuff !== undefined) {
    result.cuff = Math.min(result.cuff, PANTS_CUFF_MAX_CM);
  }

  const lenDelta = PANTS_LENGTH_DELTA_IN[pantsLengthKey] || PANTS_LENGTH_DELTA_IN.R;
  const fullLengthCm = pantsInseamToFullLengthCm(pantsInseamIn) + lenDelta.leg_length * IN_TO_CM;
  result.leg_length = Math.round(fullLengthCm * 10) / 10;

  return result;
}
// ---------------------------------------------------------------------
// Thread color catalogs -- extracted from the shop's physical thread
// swatch books / cone-photo catalogs. Each category is grouped into
// named color families (e.g. "Blue", "Brown & Tan"), and the shades
// within a family are ordered lightest to darkest so the family's own
// grid reads as a gradient. See flattenColorFamilies() and the
// colorFamilies-aware rendering in main.js's createDesigner().
// ---------------------------------------------------------------------
const THREAD_COLOR_FAMILIES = [
  {
    name: "Gray",
    swatchHex: "#6c6c68",
    options: [
      { name: "C9114", displayName: "Light Gray", img: "./assets/thread-color-c9114.jpg", hex: "#cacbc6" },
      { name: "C9631", displayName: "Frosted Smoke", img: "./assets/thread-color-c9631.jpg", hex: "#989993" },
      { name: "C9623", displayName: "Cool Pewter", img: "./assets/thread-color-c9623.jpg", hex: "#838383" },
      { name: "C9666", displayName: "Polished Slate", img: "./assets/thread-color-c9666.jpg", hex: "#676561" },
      { name: "C9949", displayName: "Dusty Ash", img: "./assets/thread-color-c9949.jpg", hex: "#4b4642" },
      { name: "C9313", displayName: "Antique Stone", img: "./assets/thread-color-c9313.jpg", hex: "#423e3f" },
      { name: "C5987", displayName: "Soft Steel", img: "./assets/thread-color-c5987.jpg", hex: "#54574b" },
      { name: "C5943", displayName: "Muted Gray", img: "./assets/thread-color-c5943.jpg", hex: "#353937" },
    ],
  },
  {
    name: "Red & Wine",
    swatchHex: "#b26267",
    options: [
      { name: "C3156", displayName: "Frosted Brick", img: "./assets/thread-color-c3156.jpg", hex: "#e0cecd" },
      { name: "C3166", displayName: "Pale Sienna", img: "./assets/thread-color-c3166.jpg", hex: "#e5abbf" },
      { name: "C3646", displayName: "Cool Cherry", img: "./assets/thread-color-c3646.jpg", hex: "#e77c9a" },
      { name: "C3867", displayName: "Polished Crimson", img: "./assets/thread-color-c3867.jpg", hex: "#d54334" },
      { name: "C3853", displayName: "Gentle Wine", img: "./assets/thread-color-c3853.jpg", hex: "#ad3b36" },
      { name: "C3966", displayName: "Crisp Brick", img: "./assets/thread-color-c3966.jpg", hex: "#7e3536" },
      { name: "C3993", displayName: "Antique Garnet", img: "./assets/thread-color-c3993.jpg", hex: "#793437" },
      { name: "C3952", displayName: "Muted Maroon", img: "./assets/thread-color-c3952.jpg", hex: "#6b343b" },
    ],
  },
  {
    name: "Yellow & Gold",
    swatchHex: "#dac85d",
    options: [
      { name: "C1172", displayName: "Cool Amber", img: "./assets/thread-color-c1172.jpg", hex: "#e2dea4" },
      { name: "C1231", displayName: "Refined Canary", img: "./assets/thread-color-c1231.jpg", hex: "#e3d773" },
      { name: "C1257", displayName: "Soft Marigold", img: "./assets/thread-color-c1257.jpg", hex: "#e7ce5a" },
      { name: "C1202", displayName: "Fine Honey", img: "./assets/thread-color-c1202.jpg", hex: "#e8de26" },
      { name: "C1424", displayName: "Bright Butter", img: "./assets/thread-color-c1424.jpg", hex: "#e2be3a" },
      { name: "C2376", displayName: "Refined Gold", img: "./assets/thread-color-c2376.jpg", hex: "#a3935f" },
    ],
  },
  {
    name: "Blue",
    swatchHex: "#687da9",
    options: [
      { name: "C7279", displayName: "Refined Royal Blue", img: "./assets/thread-color-c7279.jpg", hex: "#adbcd2" },
      { name: "C7201", displayName: "Soft Sky Blue", img: "./assets/thread-color-c7201.jpg", hex: "#849ac5" },
      { name: "C6935", displayName: "Crisp Slate Blue", img: "./assets/thread-color-c6935.jpg", hex: "#558aba" },
      { name: "C7305", displayName: "Fine Steel Blue", img: "./assets/thread-color-c7305.jpg", hex: "#405596" },
      { name: "C4987", displayName: "Muted Cobalt", img: "./assets/thread-color-c4987.jpg", hex: "#443e65" },
    ],
  },
  {
    name: "Purple & Indigo",
    swatchHex: "#766091",
    options: [
      { name: "C4106", displayName: "Refined Mulberry", img: "./assets/thread-color-c4106.jpg", hex: "#b5a7cf" },
      { name: "C4328", displayName: "Soft Violet", img: "./assets/thread-color-c4328.jpg", hex: "#8678ad" },
      { name: "C4351", displayName: "Antique Plum", img: "./assets/thread-color-c4351.jpg", hex: "#65416b" },
      { name: "C4300", displayName: "Crisp Amethyst", img: "./assets/thread-color-c4300.jpg", hex: "#64498e" },
      { name: "C4983", displayName: "Muted Eggplant", img: "./assets/thread-color-c4983.jpg", hex: "#4b3961" },
    ],
  },
  {
    name: "Orange",
    swatchHex: "#bc926b",
    options: [
      { name: "C2740", displayName: "Pale Papaya", img: "./assets/thread-color-c2740.jpg", hex: "#e4e1db" },
      { name: "C2427", displayName: "Crisp Copper", img: "./assets/thread-color-c2427.jpg", hex: "#e87b20" },
      { name: "WCG001", displayName: "Fine Persimmon", img: "./assets/thread-color-wcg001.jpg", hex: "#977668" },
      { name: "C8501", displayName: "Refined Tangerine", img: "./assets/thread-color-c8501.jpg", hex: "#8d7448" },
    ],
  },
  {
    name: "Olive & Green-Yellow",
    swatchHex: "#7f874b",
    options: [
      { name: "C5345", displayName: "Bright Citron", img: "./assets/thread-color-c5345.jpg", hex: "#abb576" },
      { name: "C5337", displayName: "Fine Chartreuse", img: "./assets/thread-color-c5337.jpg", hex: "#748138" },
      { name: "C5744", displayName: "Muted Olive", img: "./assets/thread-color-c5744.jpg", hex: "#5e5e34" },
    ],
  },
  {
    name: "Navy",
    swatchHex: "#33323e",
    options: [
      { name: "C7930", displayName: "Antique Navy", img: "./assets/thread-color-c7930.jpg", hex: "#373643" },
      { name: "C7978", displayName: "Muted Midnight Navy", img: "./assets/thread-color-c7978.jpg", hex: "#2f2d3a" },
    ],
  },
  {
    name: "Green",
    swatchHex: "#608563",
    options: [
      { name: "C5140", displayName: "Warm Pine", img: "./assets/thread-color-c5140.jpg", hex: "#84ad81" },
      { name: "C5229", displayName: "Muted Forest", img: "./assets/thread-color-c5229.jpg", hex: "#3c5d45" },
    ],
  },
  {
    name: "Brown & Tan",
    swatchHex: "#624e3c",
    options: [
      { name: "C8587", displayName: "Fine Umber", img: "./assets/thread-color-c8587.jpg", hex: "#755e43" },
      { name: "C8989", displayName: "Muted Espresso", img: "./assets/thread-color-c8989.jpg", hex: "#4e3e34" },
    ],
  },
  {
    name: "White & Ivory",
    swatchHex: "#e4e4df",
    options: [
      { name: "C1740", displayName: "Pale Ivory", img: "./assets/thread-color-c1740.jpg", hex: "#e4e4df" },
    ],
  },
  {
    name: "Black",
    swatchHex: "#30302e",
    options: [
      { name: "C9770", displayName: "Muted Onyx", img: "./assets/thread-color-c9770.jpg", hex: "#30302e" },
    ],
  },
  {
    name: "Teal",
    swatchHex: "#9ec7bf",
    options: [
      { name: "C6178", displayName: "Frosted Teal", img: "./assets/thread-color-c6178.jpg", hex: "#9ec7bf" },
    ],
  },
  {
    name: "Pink & Magenta",
    swatchHex: "#8d657b",
    options: [
      { name: "WCG007", displayName: "Refined Blush", img: "./assets/thread-color-wcg007.jpg", hex: "#8d657b" },
    ],
  }
];

const BUTTONHOLE_THREAD_COLOR_FAMILIES = [
  {
    name: "Gray",
    swatchHex: "#6c6c68",
    options: [
      { name: "C9114", displayName: "Light Gray", img: "./assets/thread-color-c9114.jpg", hex: "#cacbc6" },
      { name: "C9631", displayName: "Frosted Smoke", img: "./assets/thread-color-c9631.jpg", hex: "#989993" },
      { name: "C9623", displayName: "Cool Pewter", img: "./assets/thread-color-c9623.jpg", hex: "#838383" },
      { name: "C9666", displayName: "Polished Slate", img: "./assets/thread-color-c9666.jpg", hex: "#676561" },
      { name: "C9949", displayName: "Dusty Ash", img: "./assets/thread-color-c9949.jpg", hex: "#4b4642" },
      { name: "C9313", displayName: "Antique Stone", img: "./assets/thread-color-c9313.jpg", hex: "#423e3f" },
      { name: "C5987", displayName: "Soft Steel", img: "./assets/thread-color-c5987.jpg", hex: "#54574b" },
      { name: "C5943", displayName: "Muted Gray", img: "./assets/thread-color-c5943.jpg", hex: "#353937" },
    ],
  },
  {
    name: "Red & Wine",
    swatchHex: "#b26267",
    options: [
      { name: "C3156", displayName: "Frosted Brick", img: "./assets/thread-color-c3156.jpg", hex: "#e0cecd" },
      { name: "C3166", displayName: "Pale Sienna", img: "./assets/thread-color-c3166.jpg", hex: "#e5abbf" },
      { name: "C3646", displayName: "Cool Cherry", img: "./assets/thread-color-c3646.jpg", hex: "#e77c9a" },
      { name: "C3867", displayName: "Polished Crimson", img: "./assets/thread-color-c3867.jpg", hex: "#d54334" },
      { name: "C3853", displayName: "Gentle Wine", img: "./assets/thread-color-c3853.jpg", hex: "#ad3b36" },
      { name: "C3966", displayName: "Crisp Brick", img: "./assets/thread-color-c3966.jpg", hex: "#7e3536" },
      { name: "C3993", displayName: "Antique Garnet", img: "./assets/thread-color-c3993.jpg", hex: "#793437" },
      { name: "C3952", displayName: "Muted Maroon", img: "./assets/thread-color-c3952.jpg", hex: "#6b343b" },
    ],
  },
  {
    name: "Yellow & Gold",
    swatchHex: "#dac85d",
    options: [
      { name: "C1172", displayName: "Cool Amber", img: "./assets/thread-color-c1172.jpg", hex: "#e2dea4" },
      { name: "C1231", displayName: "Refined Canary", img: "./assets/thread-color-c1231.jpg", hex: "#e3d773" },
      { name: "C1257", displayName: "Soft Marigold", img: "./assets/thread-color-c1257.jpg", hex: "#e7ce5a" },
      { name: "C1202", displayName: "Fine Honey", img: "./assets/thread-color-c1202.jpg", hex: "#e8de26" },
      { name: "C1424", displayName: "Bright Butter", img: "./assets/thread-color-c1424.jpg", hex: "#e2be3a" },
      { name: "C2376", displayName: "Refined Gold", img: "./assets/thread-color-c2376.jpg", hex: "#a3935f" },
    ],
  },
  {
    name: "Blue",
    swatchHex: "#687da9",
    options: [
      { name: "C7279", displayName: "Refined Royal Blue", img: "./assets/thread-color-c7279.jpg", hex: "#adbcd2" },
      { name: "C7201", displayName: "Soft Sky Blue", img: "./assets/thread-color-c7201.jpg", hex: "#849ac5" },
      { name: "C6935", displayName: "Crisp Slate Blue", img: "./assets/thread-color-c6935.jpg", hex: "#558aba" },
      { name: "C7305", displayName: "Fine Steel Blue", img: "./assets/thread-color-c7305.jpg", hex: "#405596" },
      { name: "C4987", displayName: "Muted Cobalt", img: "./assets/thread-color-c4987.jpg", hex: "#443e65" },
    ],
  },
  {
    name: "Purple & Indigo",
    swatchHex: "#766091",
    options: [
      { name: "C4106", displayName: "Refined Mulberry", img: "./assets/thread-color-c4106.jpg", hex: "#b5a7cf" },
      { name: "C4328", displayName: "Soft Violet", img: "./assets/thread-color-c4328.jpg", hex: "#8678ad" },
      { name: "C4351", displayName: "Antique Plum", img: "./assets/thread-color-c4351.jpg", hex: "#65416b" },
      { name: "C4300", displayName: "Crisp Amethyst", img: "./assets/thread-color-c4300.jpg", hex: "#64498e" },
      { name: "C4983", displayName: "Muted Eggplant", img: "./assets/thread-color-c4983.jpg", hex: "#4b3961" },
    ],
  },
  {
    name: "Orange",
    swatchHex: "#bc926b",
    options: [
      { name: "C2740", displayName: "Pale Papaya", img: "./assets/thread-color-c2740.jpg", hex: "#e4e1db" },
      { name: "C2427", displayName: "Crisp Copper", img: "./assets/thread-color-c2427.jpg", hex: "#e87b20" },
      { name: "WCG001", displayName: "Fine Persimmon", img: "./assets/thread-color-wcg001.jpg", hex: "#977668" },
      { name: "C8501", displayName: "Refined Tangerine", img: "./assets/thread-color-c8501.jpg", hex: "#8d7448" },
    ],
  },
  {
    name: "Olive & Green-Yellow",
    swatchHex: "#7f874b",
    options: [
      { name: "C5345", displayName: "Bright Citron", img: "./assets/thread-color-c5345.jpg", hex: "#abb576" },
      { name: "C5337", displayName: "Fine Chartreuse", img: "./assets/thread-color-c5337.jpg", hex: "#748138" },
      { name: "C5744", displayName: "Muted Olive", img: "./assets/thread-color-c5744.jpg", hex: "#5e5e34" },
    ],
  },
  {
    name: "Navy",
    swatchHex: "#33323e",
    options: [
      { name: "C7930", displayName: "Antique Navy", img: "./assets/thread-color-c7930.jpg", hex: "#373643" },
      { name: "C7978", displayName: "Muted Midnight Navy", img: "./assets/thread-color-c7978.jpg", hex: "#2f2d3a" },
    ],
  },
  {
    name: "Green",
    swatchHex: "#608563",
    options: [
      { name: "C5140", displayName: "Warm Pine", img: "./assets/thread-color-c5140.jpg", hex: "#84ad81" },
      { name: "C5229", displayName: "Muted Forest", img: "./assets/thread-color-c5229.jpg", hex: "#3c5d45" },
    ],
  },
  {
    name: "Brown & Tan",
    swatchHex: "#624e3c",
    options: [
      { name: "C8587", displayName: "Fine Umber", img: "./assets/thread-color-c8587.jpg", hex: "#755e43" },
      { name: "C8989", displayName: "Muted Espresso", img: "./assets/thread-color-c8989.jpg", hex: "#4e3e34" },
    ],
  },
  {
    name: "White & Ivory",
    swatchHex: "#e4e4df",
    options: [
      { name: "C1740", displayName: "Pale Ivory", img: "./assets/thread-color-c1740.jpg", hex: "#e4e4df" },
    ],
  },
  {
    name: "Black",
    swatchHex: "#30302e",
    options: [
      { name: "C9770", displayName: "Muted Onyx", img: "./assets/thread-color-c9770.jpg", hex: "#30302e" },
    ],
  },
  {
    name: "Teal",
    swatchHex: "#9ec7bf",
    options: [
      { name: "C6178", displayName: "Frosted Teal", img: "./assets/thread-color-c6178.jpg", hex: "#9ec7bf" },
    ],
  },
  {
    name: "Pink & Magenta",
    swatchHex: "#8d657b",
    options: [
      { name: "WCG007", displayName: "Refined Blush", img: "./assets/thread-color-wcg007.jpg", hex: "#8d657b" },
    ],
  }
];

const MONOGRAM_THREAD_COLOR_FAMILIES = [
  {
    name: "Red & Wine",
    swatchHex: "#7f4043",
    options: [
      { name: "3701", displayName: "Bright Garnet", img: "./assets/monogram-thread-3701.jpg", hex: "#c4a9aa" },
      { name: "624", displayName: "Warm Maroon", img: "./assets/monogram-thread-624.jpg", hex: "#b96575" },
      { name: "1034", displayName: "Refined Sienna", img: "./assets/monogram-thread-1034.jpg", hex: "#aa4c58" },
      { name: "714", displayName: "Cool Cherry", img: "./assets/monogram-thread-714.jpg", hex: "#9b332e" },
      { name: "138", displayName: "Quiet Crimson", img: "./assets/monogram-thread-138.jpg", hex: "#7f1f1c" },
      { name: "144", displayName: "Soft Wine", img: "./assets/monogram-thread-144.jpg", hex: "#5b1f1f" },
      { name: "145", displayName: "Antique Garnet", img: "./assets/monogram-thread-145.jpg", hex: "#531e22" },
      { name: "1196", displayName: "Muted Maroon", img: "./assets/monogram-thread-1196.jpg", hex: "#422228" },
      { name: "489", displayName: "Dusty Brick", img: "./assets/monogram-thread-489.jpg", hex: "#433735" },
    ],
  },
  {
    name: "Yellow & Gold",
    swatchHex: "#ae9d4e",
    options: [
      { name: "101", displayName: "Light Honey", img: "./assets/monogram-thread-101.jpg", hex: "#cfccbf" },
      { name: "352", displayName: "Frosted Gold", img: "./assets/monogram-thread-352.jpg", hex: "#c9c293" },
      { name: "1017", displayName: "Crisp Butter", img: "./assets/monogram-thread-1017.jpg", hex: "#a08e3e" },
      { name: "3077", displayName: "Cool Amber", img: "./assets/monogram-thread-3077.jpg", hex: "#d2be56" },
      { name: "3172", displayName: "Gentle Marigold", img: "./assets/monogram-thread-3172.jpg", hex: "#cbaf18" },
      { name: "312", displayName: "Polished Canary", img: "./assets/monogram-thread-312.jpg", hex: "#d3ae20" },
      { name: "1173", displayName: "Muted Gold", img: "./assets/monogram-thread-1173.jpg", hex: "#413b21" },
      { name: "MG2", displayName: "Fine Honey", img: "./assets/monogram-thread-mg2.jpg", hex: "#8b7532" },
    ],
  },
  {
    name: "Gray",
    swatchHex: "#8a8384",
    options: [
      { name: "102", displayName: "Pale Smoke", img: "./assets/monogram-thread-102.jpg", hex: "#ccc9c3" },
      { name: "3750", displayName: "Cool Pewter", img: "./assets/monogram-thread-3750.jpg", hex: "#9f9896" },
      { name: "3747", displayName: "Crisp Ash", img: "./assets/monogram-thread-3747.jpg", hex: "#888489" },
      { name: "3687", displayName: "Fine Stone", img: "./assets/monogram-thread-3687.jpg", hex: "#635e63" },
      { name: "3618", displayName: "Muted Gray", img: "./assets/monogram-thread-3618.jpg", hex: "#4a3f3d" },
      { name: "177", displayName: "Polished Slate", img: "./assets/monogram-thread-177.jpg", hex: "#978196" },
      { name: "MS1", displayName: "Gentle Steel", img: "./assets/monogram-thread-ms1.jpg", hex: "#918f81" },
    ],
  },
  {
    name: "Blue",
    swatchHex: "#5c6c97",
    options: [
      { name: "432", displayName: "Refined Royal Blue", img: "./assets/monogram-thread-432.jpg", hex: "#8c97a7" },
      { name: "599", displayName: "Gentle Sky Blue", img: "./assets/monogram-thread-599.jpg", hex: "#6f7ea6" },
      { name: "1059", displayName: "Fine Steel Blue", img: "./assets/monogram-thread-1059.jpg", hex: "#3b6aa2" },
      { name: "455", displayName: "Muted Cobalt", img: "./assets/monogram-thread-455.jpg", hex: "#2d377a" },
      { name: "633", displayName: "Crisp Slate Blue", img: "./assets/monogram-thread-633.jpg", hex: "#6b648a" },
    ],
  },
  {
    name: "Brown & Tan",
    swatchHex: "#433227",
    options: [
      { name: "3099", displayName: "Quiet Cognac", img: "./assets/monogram-thread-3099.jpg", hex: "#705138" },
      { name: "572", displayName: "Soft Walnut", img: "./assets/monogram-thread-572.jpg", hex: "#3f372c" },
      { name: "3694", displayName: "Deepest Espresso", img: "./assets/monogram-thread-3694.jpg", hex: "#2c2621" },
      { name: "1161", displayName: "Rich Chestnut", img: "./assets/monogram-thread-1161.jpg", hex: "#3c271e" },
      { name: "1162", displayName: "Deep Umber", img: "./assets/monogram-thread-1162.jpg", hex: "#38271f" },
    ],
  },
  {
    name: "Black",
    swatchHex: "#2a2324",
    options: [
      { name: "3655", displayName: "Deep Jet", img: "./assets/monogram-thread-3655.jpg", hex: "#26211d" },
      { name: "3712", displayName: "Soft Ink", img: "./assets/monogram-thread-3712.jpg", hex: "#352d34" },
      { name: "3720", displayName: "Rich Ebony", img: "./assets/monogram-thread-3720.jpg", hex: "#282126" },
      { name: "103", displayName: "Deepest Onyx", img: "./assets/monogram-thread-103.jpg", hex: "#231e1a" },
    ],
  },
  {
    name: "Purple & Indigo",
    swatchHex: "#3e2942",
    options: [
      { name: "1203", displayName: "Muted Eggplant", img: "./assets/monogram-thread-1203.jpg", hex: "#302439" },
      { name: "189", displayName: "Soft Violet", img: "./assets/monogram-thread-189.jpg", hex: "#4c2f4a" },
      { name: "3601", displayName: "Dusty Amethyst", img: "./assets/monogram-thread-3601.jpg", hex: "#412a46" },
      { name: "3742", displayName: "Antique Plum", img: "./assets/monogram-thread-3742.jpg", hex: "#392840" },
    ],
  },
  {
    name: "Orange",
    swatchHex: "#9e6c45",
    options: [
      { name: "321", displayName: "Crisp Copper", img: "./assets/monogram-thread-321.jpg", hex: "#c96123" },
      { name: "392", displayName: "Refined Tangerine", img: "./assets/monogram-thread-392.jpg", hex: "#8e7149" },
      { name: "598", displayName: "Fine Persimmon", img: "./assets/monogram-thread-598.jpg", hex: "#847264" },
    ],
  },
  {
    name: "Green",
    swatchHex: "#496956",
    options: [
      { name: "1093", displayName: "Bright Hunter Green", img: "./assets/monogram-thread-1093.jpg", hex: "#80afa1" },
      { name: "1116", displayName: "Antique Pine", img: "./assets/monogram-thread-1116.jpg", hex: "#34563a" },
      { name: "3813", displayName: "Muted Forest", img: "./assets/monogram-thread-3813.jpg", hex: "#283628" },
    ],
  },
  {
    name: "Olive & Green-Yellow",
    swatchHex: "#787e41",
    options: [
      { name: "3334", displayName: "Fine Chartreuse", img: "./assets/monogram-thread-3334.jpg", hex: "#9aa45c" },
      { name: "262", displayName: "Muted Olive", img: "./assets/monogram-thread-262.jpg", hex: "#565826" },
    ],
  }
];

const BUTTON_COLOR_FAMILIES = [
  {
    name: "Gray",
    swatchHex: "#575156",
    options: [
      { name: "KNJ070", displayName: "Marbled Charcoal Gray", img: "./assets/jacket-buttoncolor-knj070.jpg", hex: "#4c4647" },
      { name: "KB285", displayName: "Glossy Dove Gray", img: "./assets/jacket-buttoncolor-kb285.jpg", hex: "#474c4c" },
      { name: "KB289", displayName: "Refined Steel Gray", img: "./assets/jacket-buttoncolor-kb289.jpg", hex: "#9c99a5" },
      { name: "KB277", displayName: "Glossy Steel Gray", img: "./assets/jacket-buttoncolor-kb277.jpg", hex: "#453735" },
      { name: "KB288", displayName: "Marbled Slate Gray", img: "./assets/jacket-buttoncolor-kb288.jpg", hex: "#382627" },
      { name: "KG239", displayName: "Rich Dove Gray", img: "./assets/jacket-buttoncolor-kg239.jpg", hex: "#473d44" },
      { name: "KG221", displayName: "Classic Steel Gray", img: "./assets/jacket-buttoncolor-kg221.jpg", hex: "#312b2c" },
      { name: "KSZ429", displayName: "Refined Slate Gray", img: "./assets/jacket-buttoncolor-ksz429.jpg", hex: "#453b38" },
      { name: "KSZ455", displayName: "Marbled Dove Gray", img: "./assets/jacket-buttoncolor-ksz455.jpg", hex: "#95929a" },
      { name: "KSZ430", displayName: "Rich Steel Gray", img: "./assets/jacket-buttoncolor-ksz430.jpg", hex: "#3c3131" },
      { name: "KSZ432", displayName: "Smoky Smoke Gray", img: "./assets/jacket-buttoncolor-ksz432.jpg", hex: "#39302f" },
      { name: "KSZ426", displayName: "Classic Slate Gray", img: "./assets/jacket-buttoncolor-ksz426.jpg", hex: "#4f3f3d" },
      { name: "KSZ436", displayName: "Marbled Smoke Gray", img: "./assets/jacket-buttoncolor-ksz436.jpg", hex: "#413131" },
      { name: "KSZ424", displayName: "Refined Dove Gray", img: "./assets/jacket-buttoncolor-ksz424.jpg", hex: "#372d2c" },
      { name: "KSZ425", displayName: "Classic Dove Gray", img: "./assets/jacket-buttoncolor-ksz425.jpg", hex: "#35323f" },
      { name: "KSZ440", displayName: "Marbled Steel Gray", img: "./assets/jacket-buttoncolor-ksz440.jpg", hex: "#5f4f52" },
      { name: "KSZ448", displayName: "Polished Charcoal Gray", img: "./assets/jacket-buttoncolor-ksz448.jpg", hex: "#535157" },
      { name: "KNJ052", displayName: "Refined Smoke Gray", img: "./assets/jacket-buttoncolor-knj052.jpg", hex: "#4e4c50" },
      { name: "KNJ031", displayName: "Glossy Charcoal Gray", img: "./assets/jacket-buttoncolor-knj031.jpg", hex: "#352d30" },
      { name: "KNJ033", displayName: "Polished Slate Gray", img: "./assets/jacket-buttoncolor-knj033.jpg", hex: "#3d3136" },
      { name: "KNJ013", displayName: "Polished Smoke Gray", img: "./assets/jacket-buttoncolor-knj013.jpg", hex: "#454144" },
      { name: "KB111", displayName: "Antique Dove Gray", img: "./assets/jacket-buttoncolor-kb111.jpg", hex: "#4e515c" },
      { name: "KB1112", displayName: "Smoky Dove Gray", img: "./assets/jacket-buttoncolor-kb1112.jpg", hex: "#75747a" },
      { name: "KB151", displayName: "Antique Slate Gray", img: "./assets/jacket-buttoncolor-kb151.jpg", hex: "#7b7988" },
      { name: "KB026", displayName: "Rich Slate Gray", img: "./assets/jacket-buttoncolor-kb026.jpg", hex: "#545452" },
      { name: "KB027", displayName: "Smoky Slate Gray", img: "./assets/jacket-buttoncolor-kb027.jpg", hex: "#9d9ea8" },
      { name: "KB011", displayName: "Classic Smoke Gray", img: "./assets/jacket-buttoncolor-kb011.jpg", hex: "#565555" },
      { name: "KB021", displayName: "Glossy Slate Gray", img: "./assets/jacket-buttoncolor-kb021.jpg", hex: "#525568" },
      { name: "KB029", displayName: "Classic Charcoal Gray", img: "./assets/jacket-buttoncolor-kb029.jpg", hex: "#918f9c" },
      { name: "KB030", displayName: "Glossy Smoke Gray", img: "./assets/jacket-buttoncolor-kb030.jpg", hex: "#94939f" },
      { name: "KG109", displayName: "Smoky Steel Gray", img: "./assets/jacket-buttoncolor-kg109.jpg", hex: "#464859" },
      { name: "KG206", displayName: "Antique Steel Gray", img: "./assets/jacket-buttoncolor-kg206.jpg", hex: "#52393c" },
      { name: "KSZ257", displayName: "Refined Charcoal Gray", img: "./assets/jacket-buttoncolor-ksz257.jpg", hex: "#5f5d62" },
      { name: "KSZ260", displayName: "Polished Steel Gray", img: "./assets/jacket-buttoncolor-ksz260.jpg", hex: "#7f7c83" },
      { name: "KSZ263", displayName: "Antique Charcoal Gray", img: "./assets/jacket-buttoncolor-ksz263.jpg", hex: "#373739" },
      { name: "KSZ298", displayName: "Rich Smoke Gray", img: "./assets/jacket-buttoncolor-ksz298.jpg", hex: "#7a787e" },
      { name: "KSZ299", displayName: "Smoky Charcoal Gray", img: "./assets/jacket-buttoncolor-ksz299.jpg", hex: "#3f3e43" },
    ],
  },
  {
    name: "Black",
    swatchHex: "#241f21",
    options: [
      { name: "KNJ075", displayName: "Polished Jet", img: "./assets/jacket-buttoncolor-knj075.jpg", hex: "#1a191b" },
      { name: "KNJ076", displayName: "Smoky Raven", img: "./assets/jacket-buttoncolor-knj076.jpg", hex: "#19191a" },
      { name: "KNJ077", displayName: "Glossy Ebony", img: "./assets/jacket-buttoncolor-knj077.jpg", hex: "#171716" },
      { name: "KNJ069", displayName: "Classic Raven", img: "./assets/jacket-buttoncolor-knj069.jpg", hex: "#2c2828" },
      { name: "KNJ078", displayName: "Classic Jet", img: "./assets/jacket-buttoncolor-knj078.jpg", hex: "#242325" },
      { name: "KNJ068", displayName: "Refined Ebony", img: "./assets/jacket-buttoncolor-knj068.jpg", hex: "#302828" },
      { name: "KNJ079", displayName: "Polished Ebony", img: "./assets/jacket-buttoncolor-knj079.jpg", hex: "#2c2424" },
      { name: "KNJ074", displayName: "Smoky Ebony", img: "./assets/jacket-buttoncolor-knj074.jpg", hex: "#252123" },
      { name: "KNJ072", displayName: "Marbled Jet", img: "./assets/jacket-buttoncolor-knj072.jpg", hex: "#141315" },
      { name: "KNJ080", displayName: "Polished Raven", img: "./assets/jacket-buttoncolor-knj080.jpg", hex: "#272020" },
      { name: "KNJ084", displayName: "Marbled Raven", img: "./assets/jacket-buttoncolor-knj084.jpg", hex: "#1e1c1d" },
      { name: "KG224", displayName: "Rich Coal", img: "./assets/jacket-buttoncolor-kg224.jpg", hex: "#242125" },
      { name: "KG240", displayName: "Marbled Ebony", img: "./assets/jacket-buttoncolor-kg240.jpg", hex: "#331815" },
      { name: "KG238", displayName: "Classic Onyx", img: "./assets/jacket-buttoncolor-kg238.jpg", hex: "#130f10" },
      { name: "KG244", displayName: "Refined Coal", img: "./assets/jacket-buttoncolor-kg244.jpg", hex: "#181515" },
      { name: "KG226", displayName: "Antique Ebony", img: "./assets/jacket-buttoncolor-kg226.jpg", hex: "#1b1919" },
      { name: "KSZ428", displayName: "Rich Jet", img: "./assets/jacket-buttoncolor-ksz428.jpg", hex: "#292528" },
      { name: "KSZ431", displayName: "Marbled Onyx", img: "./assets/jacket-buttoncolor-ksz431.jpg", hex: "#2c282b" },
      { name: "KSZ421", displayName: "Smoky Onyx", img: "./assets/jacket-buttoncolor-ksz421.jpg", hex: "#2f201d" },
      { name: "KSZ423", displayName: "Rich Raven", img: "./assets/jacket-buttoncolor-ksz423.jpg", hex: "#2f2a2f" },
      { name: "KSZ433", displayName: "Glossy Jet", img: "./assets/jacket-buttoncolor-ksz433.jpg", hex: "#2e2726" },
      { name: "KNJ030", displayName: "Glossy Onyx", img: "./assets/jacket-buttoncolor-knj030.jpg", hex: "#212022" },
      { name: "KNJ023", displayName: "Glossy Coal", img: "./assets/jacket-buttoncolor-knj023.jpg", hex: "#2e1d1e" },
      { name: "KNJ024", displayName: "Rich Onyx", img: "./assets/jacket-buttoncolor-knj024.jpg", hex: "#18171c" },
      { name: "KNJ036", displayName: "Antique Onyx", img: "./assets/jacket-buttoncolor-knj036.jpg", hex: "#232225" },
      { name: "KNJ011", displayName: "Smoky Coal", img: "./assets/jacket-buttoncolor-knj011.jpg", hex: "#2b2a2e" },
      { name: "KG197", displayName: "Classic Coal", img: "./assets/jacket-buttoncolor-kg197.jpg", hex: "#1a181d" },
      { name: "KG199", displayName: "Antique Coal", img: "./assets/jacket-buttoncolor-kg199.jpg", hex: "#2d2724" },
      { name: "KG191", displayName: "Refined Raven", img: "./assets/jacket-buttoncolor-kg191.jpg", hex: "#232229" },
      { name: "KSZ199", displayName: "Refined Jet", img: "./assets/jacket-buttoncolor-ksz199.jpg", hex: "#242121" },
    ],
  },
  {
    name: "Tan",
    swatchHex: "#bba79a",
    options: [
      { name: "KB272", displayName: "Marbled Wheat Tan", img: "./assets/jacket-buttoncolor-kb272.jpg", hex: "#6b635a" },
      { name: "KB275", displayName: "Marbled Camel Tan", img: "./assets/jacket-buttoncolor-kb275.jpg", hex: "#f8f0ec" },
      { name: "KB273", displayName: "Classic Sand Tan", img: "./assets/jacket-buttoncolor-kb273.jpg", hex: "#978f91" },
      { name: "KB274", displayName: "Antique Fawn Tan", img: "./assets/jacket-buttoncolor-kb274.jpg", hex: "#968e8d" },
      { name: "KG220", displayName: "Classic Wheat Tan", img: "./assets/jacket-buttoncolor-kg220.jpg", hex: "#deb494" },
      { name: "KG241", displayName: "Refined Sand Tan", img: "./assets/jacket-buttoncolor-kg241.jpg", hex: "#796b6a" },
      { name: "KSZ435", displayName: "Refined Beige Tan", img: "./assets/jacket-buttoncolor-ksz435.jpg", hex: "#d7cecc" },
      { name: "KSZ443", displayName: "Rich Wheat Tan", img: "./assets/jacket-buttoncolor-ksz443.jpg", hex: "#ddd2cf" },
      { name: "KSZ438", displayName: "Marbled Beige Tan", img: "./assets/jacket-buttoncolor-ksz438.jpg", hex: "#a9907f" },
      { name: "KSZ422", displayName: "Marbled Fawn Tan", img: "./assets/jacket-buttoncolor-ksz422.jpg", hex: "#dabea2" },
      { name: "KNG010", displayName: "Glossy Wheat Tan", img: "./assets/jacket-buttoncolor-kng010.jpg", hex: "#fdf7f5" },
      { name: "KNJ039", displayName: "Smoky Beige Tan", img: "./assets/jacket-buttoncolor-knj039.jpg", hex: "#897c74" },
      { name: "KB116", displayName: "Polished Beige Tan", img: "./assets/jacket-buttoncolor-kb116.jpg", hex: "#b2a297" },
      { name: "KB010", displayName: "Glossy Sand Tan", img: "./assets/jacket-buttoncolor-kb010.jpg", hex: "#d7d1c5" },
      { name: "KB002", displayName: "Classic Beige Tan", img: "./assets/jacket-buttoncolor-kb002.jpg", hex: "#faf1e7" },
      { name: "KB001", displayName: "Classic Camel Tan", img: "./assets/jacket-buttoncolor-kb001.jpg", hex: "#615a5c" },
      { name: "KB023", displayName: "Glossy Fawn Tan", img: "./assets/jacket-buttoncolor-kb023.jpg", hex: "#6b6866" },
      { name: "KG190", displayName: "Smoky Fawn Tan", img: "./assets/jacket-buttoncolor-kg190.jpg", hex: "#b29883" },
      { name: "KG108", displayName: "Refined Wheat Tan", img: "./assets/jacket-buttoncolor-kg108.jpg", hex: "#c78966" },
      { name: "KSZ255", displayName: "Antique Camel Tan", img: "./assets/jacket-buttoncolor-ksz255.jpg", hex: "#cba486" },
      { name: "KSZ259", displayName: "Polished Wheat Tan", img: "./assets/jacket-buttoncolor-ksz259.jpg", hex: "#b69569" },
      { name: "KSZ297", displayName: "Smoky Camel Tan", img: "./assets/jacket-buttoncolor-ksz297.jpg", hex: "#e9d0c1" },
      { name: "KSZ196", displayName: "Antique Sand Tan", img: "./assets/jacket-buttoncolor-ksz196.jpg", hex: "#fae4dd" },
      { name: "KSZ198", displayName: "Rich Camel Tan", img: "./assets/jacket-buttoncolor-ksz198.jpg", hex: "#9d897d" },
      { name: "KSZ261", displayName: "Polished Fawn Tan", img: "./assets/jacket-buttoncolor-ksz261.jpg", hex: "#efdcc4" },
      { name: "KSZ277", displayName: "Rich Sand Tan", img: "./assets/jacket-buttoncolor-ksz277.jpg", hex: "#bc967f" },
      { name: "KSZ276", displayName: "Glossy Camel Tan", img: "./assets/jacket-buttoncolor-ksz276.jpg", hex: "#a78b81" },
    ],
  },
  {
    name: "Brown",
    swatchHex: "#764831",
    options: [
      { name: "KB287", displayName: "Glossy Chestnut", img: "./assets/jacket-buttoncolor-kb287.jpg", hex: "#a37148" },
      { name: "KB278", displayName: "Polished Walnut", img: "./assets/jacket-buttoncolor-kb278.jpg", hex: "#663b28" },
      { name: "KG214", displayName: "Refined Walnut", img: "./assets/jacket-buttoncolor-kg214.jpg", hex: "#b86642" },
      { name: "KG245", displayName: "Rich Chestnut", img: "./assets/jacket-buttoncolor-kg245.jpg", hex: "#6a2e1a" },
      { name: "KG237", displayName: "Classic Chestnut", img: "./assets/jacket-buttoncolor-kg237.jpg", hex: "#3b1f19" },
      { name: "KG222", displayName: "Marbled Walnut", img: "./assets/jacket-buttoncolor-kg222.jpg", hex: "#432318" },
      { name: "KG242", displayName: "Smoky Espresso", img: "./assets/jacket-buttoncolor-kg242.jpg", hex: "#ac7856" },
      { name: "KSZ434", displayName: "Marbled Umber", img: "./assets/jacket-buttoncolor-ksz434.jpg", hex: "#8c4727" },
      { name: "KSZ427", displayName: "Smoky Umber", img: "./assets/jacket-buttoncolor-ksz427.jpg", hex: "#61341f" },
      { name: "KSZ442", displayName: "Refined Cocoa", img: "./assets/jacket-buttoncolor-ksz442.jpg", hex: "#4e3531" },
      { name: "KB008", displayName: "Antique Espresso", img: "./assets/jacket-buttoncolor-kb008.jpg", hex: "#693626" },
      { name: "KG198", displayName: "Glossy Espresso", img: "./assets/jacket-buttoncolor-kg198.jpg", hex: "#4a3c30" },
      { name: "KSZ258", displayName: "Classic Cocoa", img: "./assets/jacket-buttoncolor-ksz258.jpg", hex: "#704733" },
      { name: "KSZ197", displayName: "Rich Cocoa", img: "./assets/jacket-buttoncolor-ksz197.jpg", hex: "#bb8b57" },
    ],
  },
  {
    name: "Cream",
    swatchHex: "#c7bcbf",
    options: [
      { name: "KB279", displayName: "Refined Alabaster Cream", img: "./assets/jacket-buttoncolor-kb279.jpg", hex: "#d2caca" },
      { name: "KB286", displayName: "Marbled Ivory Cream", img: "./assets/jacket-buttoncolor-kb286.jpg", hex: "#b7a3ab" },
      { name: "KSZ454", displayName: "Glossy Pearl Cream", img: "./assets/jacket-buttoncolor-ksz454.jpg", hex: "#d0cac7" },
      { name: "KB115", displayName: "Classic Vanilla Cream", img: "./assets/jacket-buttoncolor-kb115.jpg", hex: "#aba2a9" },
      { name: "KSZ256", displayName: "Smoky Bone Cream", img: "./assets/jacket-buttoncolor-ksz256.jpg", hex: "#ded3d6" },
    ],
  },
  {
    name: "Tortoiseshell",
    swatchHex: "#b16e4f",
    options: [
      { name: "KNJ071", displayName: "Refined Chestnut", img: "./assets/jacket-buttoncolor-knj071.jpg", hex: "#e1c094" },
      { name: "KNJ053", displayName: "Glossy Amber", img: "./assets/jacket-buttoncolor-knj053.jpg", hex: "#a35f50" },
      { name: "KNJ012", displayName: "Classic Honey", img: "./assets/jacket-buttoncolor-knj012.jpg", hex: "#8f361c" },
      { name: "KNJ014", displayName: "Marbled Toffee", img: "./assets/jacket-buttoncolor-knj014.jpg", hex: "#b2633b" },
    ],
  },
  {
    name: "Navy",
    swatchHex: "#2c3445",
    options: [
      { name: "KG223", displayName: "Refined Regal Navy", img: "./assets/jacket-buttoncolor-kg223.jpg", hex: "#333c4d" },
      { name: "KG243", displayName: "Glossy Slate Navy", img: "./assets/jacket-buttoncolor-kg243.jpg", hex: "#2a444d" },
      { name: "KSZ439", displayName: "Marbled Dusk Navy", img: "./assets/jacket-buttoncolor-ksz439.jpg", hex: "#2c2b40" },
      { name: "KSZ262", displayName: "Classic Midnight Navy", img: "./assets/jacket-buttoncolor-ksz262.jpg", hex: "#282739" },
    ],
  },
  {
    name: "Burgundy",
    swatchHex: "#4d2b2c",
    options: [
      { name: "KG225", displayName: "Marbled Garnet Burgundy", img: "./assets/jacket-buttoncolor-kg225.jpg", hex: "#592923" },
      { name: "KB152", displayName: "Glossy Merlot Burgundy", img: "./assets/jacket-buttoncolor-kb152.jpg", hex: "#4e3330" },
      { name: "KB016", displayName: "Classic Wine Burgundy", img: "./assets/jacket-buttoncolor-kb016.jpg", hex: "#412532" },
    ],
  },
  {
    name: "Pink",
    swatchHex: "#f1ddde",
    options: [
      { name: "KB028", displayName: "Marbled Rose Pink", img: "./assets/jacket-buttoncolor-kb028.jpg", hex: "#efd6d6" },
      { name: "KB020", displayName: "Glossy Carnation Pink", img: "./assets/jacket-buttoncolor-kb020.jpg", hex: "#f7eff0" },
      { name: "KG195", displayName: "Classic Blush Pink", img: "./assets/jacket-buttoncolor-kg195.jpg", hex: "#edd3d4" },
    ],
  },
  {
    name: "White",
    swatchHex: "#eee8e8",
    options: [
      { name: "KB276", displayName: "Marbled Pearl White", img: "./assets/jacket-buttoncolor-kb276.jpg", hex: "#f0ebeb" },
      { name: "KB022", displayName: "Classic Snow White", img: "./assets/jacket-buttoncolor-kb022.jpg", hex: "#ece4e6" },
    ],
  },
  {
    name: "Blue",
    swatchHex: "#a8acbe",
    options: [
      { name: "KB280", displayName: "Marbled Powder Blue", img: "./assets/jacket-buttoncolor-kb280.jpg", hex: "#a8abbf" },
      { name: "KB114", displayName: "Classic Sky Blue", img: "./assets/jacket-buttoncolor-kb114.jpg", hex: "#a9adbc" },
    ],
  },
  {
    name: "Multi-Color",
    swatchHex: "#e5dcda",
    options: [
      { name: "KB150", displayName: "Marbled Mosaic Multi-Color", img: "./assets/jacket-buttoncolor-kb150.jpg", hex: "#f0e5dc" },
      { name: "KG196", displayName: "Classic Confetti Multi-Color", img: "./assets/jacket-buttoncolor-kg196.jpg", hex: "#dad3d9" },
    ],
  },
  {
    name: "Purple",
    swatchHex: "#dcd8e1",
    options: [
      { name: "KB113", displayName: "Classic Plum Purple", img: "./assets/jacket-buttoncolor-kb113.jpg", hex: "#dcd8e1" },
    ],
  },
  {
    name: "Red",
    swatchHex: "#841c21",
    options: [
      { name: "KG192", displayName: "Classic Scarlet Red", img: "./assets/jacket-buttoncolor-kg192.jpg", hex: "#841c21" },
    ],
  }
];

const FELT_COLOR_FAMILIES = [
  {
    name: "Pattern",
    // A small collage of four of this family's printed felts, shown on the
    // family card instead of a flat color chip (a chip can't show a pattern).
    representativeImg: "./assets/felt-pattern-card.jpg",
    swatchHex: "#514758",
    options: [
      { name: "FLD-12345", displayName: "Deepest Charcoal", img: "./assets/jacket-feltcolor-fld-12345.jpg", hex: "#28262e" },
      { name: "FLD-DPP-4", displayName: "Deep Graphite", img: "./assets/jacket-feltcolor-fld-dpp-4.jpg", hex: "#29272d" },
      { name: "FLD-0110", displayName: "Rich Raven", img: "./assets/jacket-feltcolor-fld-0110.jpg", hex: "#2a2a2c" },
      { name: "FLD-DPP-7", displayName: "Dark Smoke", img: "./assets/jacket-feltcolor-fld-dpp-7.jpg", hex: "#2c2b2e" },
      { name: "FLD-DPP-18", displayName: "Quiet Slate Blue", img: "./assets/jacket-feltcolor-fld-dpp-18.jpg", hex: "#2c293d" },
      { name: "FLD-DPP-19", displayName: "Earthy Cobalt", img: "./assets/jacket-feltcolor-fld-dpp-19.jpg", hex: "#2f2d3e" },
      { name: "FLD-DPP-17", displayName: "Muted Navy", img: "./assets/jacket-feltcolor-fld-dpp-17.jpg", hex: "#2e2c40" },
      { name: "JFLD-7421", displayName: "Antique Anthracite", img: "./assets/jacket-feltcolor-jfld-7421.jpg", hex: "#38373e" },
      { name: "FLD-DPP-8", displayName: "Dusty Wine", img: "./assets/jacket-feltcolor-fld-dpp-8.jpg", hex: "#463245" },
      { name: "JFLD-7420", displayName: "Soft Pewter", img: "./assets/jacket-feltcolor-jfld-7420.jpg", hex: "#47464e" },
      { name: "JFLD-7436", displayName: "Quiet Iron", img: "./assets/jacket-feltcolor-jfld-7436.jpg", hex: "#504e5b" },
      { name: "FLD-DPP-29", displayName: "Cool Plum", img: "./assets/jacket-feltcolor-fld-dpp-29.jpg", hex: "#62476c" },
      { name: "FLD-DPP-6", displayName: "Fine Ash", img: "./assets/jacket-feltcolor-fld-dpp-6.jpg", hex: "#82818d" },
      { name: "FLD-DPP-14", displayName: "Refined Maroon", img: "./assets/jacket-feltcolor-fld-dpp-14.jpg", hex: "#b52e42" },
      { name: "FLD-DPP-30", displayName: "Soft Silver", img: "./assets/jacket-feltcolor-fld-dpp-30.jpg", hex: "#9796a2" },
      { name: "FLD-DPP-5", displayName: "Refined Mist", img: "./assets/jacket-feltcolor-fld-dpp-5.jpg", hex: "#9896a4" },
      { name: "FLD-DPP-28", displayName: "Bright Indigo Blue", img: "./assets/jacket-feltcolor-fld-dpp-28.jpg", hex: "#597ec0" },
    ],
  },
  {
    name: "Black",
    swatchHex: "#181816",
    options: [
      { name: "JFLD-F900-1", displayName: "Deepest Onyx", img: "./assets/jacket-feltcolor-jfld-f900-1.jpg", hex: "#171815" },
      { name: "JFLD-F900-9", displayName: "Deep Ink", img: "./assets/jacket-feltcolor-jfld-f900-9.jpg", hex: "#16171b" },
      { name: "JFLD-F900-2", displayName: "Deep Umber", img: "./assets/jacket-feltcolor-jfld-f900-2.jpg", hex: "#1b1813" },
      { name: "JFLD-F900-014", displayName: "Rich Ebony", img: "./assets/jacket-feltcolor-jfld-f900-014.jpg", hex: "#191a15" },
    ],
  },
  {
    name: "Navy",
    swatchHex: "#1f252d",
    options: [
      { name: "JFLD-F900-47", displayName: "Smoky Slate Blue", img: "./assets/jacket-feltcolor-jfld-f900-47.jpg", hex: "#172026" },
      { name: "JFLD-F900-22", displayName: "Deep Navy", img: "./assets/jacket-feltcolor-jfld-f900-22.jpg", hex: "#1d1f29" },
      { name: "JFLD-F900-21", displayName: "Deepest Midnight Blue", img: "./assets/jacket-feltcolor-jfld-f900-21.jpg", hex: "#1f2730" },
      { name: "JFLD-F900-11", displayName: "Antique Navy", img: "./assets/jacket-feltcolor-jfld-f900-11.jpg", hex: "#292f36" },
    ],
  },
  {
    name: "Purple & Indigo",
    swatchHex: "#503e59",
    options: [
      { name: "JFLD-F900-41", displayName: "Deep Aubergine", img: "./assets/jacket-feltcolor-jfld-f900-41.jpg", hex: "#271b26" },
      { name: "JFLD-F900-46", displayName: "Refined Eggplant", img: "./assets/jacket-feltcolor-jfld-f900-46.jpg", hex: "#7a618d" },
    ],
  },
  {
    name: "Green",
    swatchHex: "#4e584a",
    options: [
      { name: "JFLD-F900-35", displayName: "Deepest Forest", img: "./assets/jacket-feltcolor-jfld-f900-35.jpg", hex: "#2c3022" },
      { name: "JFLD-F900-27", displayName: "Deep Olive", img: "./assets/jacket-feltcolor-jfld-f900-27.jpg", hex: "#34331a" },
      { name: "JFLD-F900-20", displayName: "Antique Pine", img: "./assets/jacket-feltcolor-jfld-f900-20.jpg", hex: "#40594f" },
      { name: "JFLD-F900-17", displayName: "Pale Sage", img: "./assets/jacket-feltcolor-jfld-f900-17.jpg", hex: "#98a59d" },
    ],
  },
  {
    name: "Red & Wine",
    swatchHex: "#731e21",
    options: [
      { name: "FLD-W028", displayName: "Deepest Maroon", img: "./assets/jacket-feltcolor-fld-w028.jpg", hex: "#331413" },
      { name: "FLD-0646", displayName: "Antique Garnet", img: "./assets/jacket-feltcolor-fld-0646.jpg", hex: "#5d1518" },
      { name: "JFLD-F900-50", displayName: "Gentle Maroon", img: "./assets/jacket-feltcolor-jfld-f900-50.jpg", hex: "#99272c" },
      { name: "FLD-W050", displayName: "Polished Garnet", img: "./assets/jacket-feltcolor-fld-w050.jpg", hex: "#a5282f" },
    ],
  },
  {
    name: "Gray",
    swatchHex: "#646064",
    options: [
      { name: "JFLD-1195-7", displayName: "Rich Charcoal", img: "./assets/jacket-feltcolor-jfld-1195-7.jpg", hex: "#2a282c" },
      { name: "JFLD-F900-5", displayName: "Muted Slate", img: "./assets/jacket-feltcolor-jfld-f900-5.jpg", hex: "#39373d" },
      { name: "FLD-W003", displayName: "Fine Stone", img: "./assets/jacket-feltcolor-fld-w003.jpg", hex: "#77767f" },
      { name: "JFLD-F900-8", displayName: "Frosted Stone", img: "./assets/jacket-feltcolor-jfld-f900-8.jpg", hex: "#b9aca8" },
    ],
  },
  {
    name: "Brown & Tan",
    swatchHex: "#896f5f",
    options: [
      { name: "JFLD-0620", displayName: "Deepest Sienna", img: "./assets/jacket-feltcolor-jfld-0620.jpg", hex: "#342420" },
      { name: "JFLD-F900-10", displayName: "Antique Umber", img: "./assets/jacket-feltcolor-jfld-f900-10.jpg", hex: "#4e3522" },
      { name: "JFLD-F900-30", displayName: "Dusty Taupe", img: "./assets/jacket-feltcolor-jfld-f900-30.jpg", hex: "#5a4841" },
      { name: "JFLD-0641", displayName: "Warm Taupe", img: "./assets/jacket-feltcolor-jfld-0641.jpg", hex: "#8a7671" },
      { name: "JFLD-F900-33", displayName: "Soft Khaki", img: "./assets/jacket-feltcolor-jfld-f900-33.jpg", hex: "#8e8876" },
      { name: "JFLD-F900-43", displayName: "Crisp Chestnut", img: "./assets/jacket-feltcolor-jfld-f900-43.jpg", hex: "#b27450" },
      { name: "JFLD-F900-42", displayName: "Warm Sienna", img: "./assets/jacket-feltcolor-jfld-f900-42.jpg", hex: "#b79283" },
      { name: "JFLD-F900-26", displayName: "Pale Peach", img: "./assets/jacket-feltcolor-jfld-f900-26.jpg", hex: "#edd3bc" },
    ],
  },
  {
    name: "Blue",
    swatchHex: "#5279a1",
    options: [
      { name: "JFLD-049", displayName: "Muted Midnight Blue", img: "./assets/jacket-feltcolor-jfld-049.jpg", hex: "#344170" },
      { name: "JFLD-F900-16", displayName: "Steel Blue", img: "./assets/jacket-feltcolor-jfld-f900-16.jpg", hex: "#566879" },
      { name: "JFLD-F900-37", displayName: "Crisp Indigo Blue", img: "./assets/jacket-feltcolor-jfld-f900-37.jpg", hex: "#3c6bb4" },
      { name: "JFLD-F900-38", displayName: "Bright Sky Blue", img: "./assets/jacket-feltcolor-jfld-f900-38.jpg", hex: "#82d2e8" },
    ],
  },
  {
    name: "Pink & Rose",
    swatchHex: "#b15f78",
    options: [
      { name: "JFLD-F900-6", displayName: "Dusty Rose", img: "./assets/jacket-feltcolor-jfld-f900-6.jpg", hex: "#a57674" },
      { name: "JFLD-F900-F8", displayName: "Cool Berry", img: "./assets/jacket-feltcolor-jfld-f900-f8.jpg", hex: "#be487d" },
    ],
  },
  {
    name: "Orange",
    swatchHex: "#f3763c",
    options: [
      { name: "FLD-SM-079", displayName: "Bright Tangerine", img: "./assets/jacket-feltcolor-fld-sm-079.jpg", hex: "#f3763c" },
    ],
  },
  {
    name: "Yellow & Gold",
    swatchHex: "#e9c85c",
    options: [
      { name: "FLD-P055", displayName: "Bright Marigold", img: "./assets/jacket-feltcolor-fld-p055.jpg", hex: "#e9c85c" },
    ],
  },
  {
    name: "White & Ivory",
    swatchHex: "#eae4e6",
    options: [
      { name: "JFLD-F900-31", displayName: "Warm Ivory", img: "./assets/jacket-feltcolor-jfld-f900-31.jpg", hex: "#ede3da" },
      { name: "JFLD-F900-32", displayName: "Frosted Lilac", img: "./assets/jacket-feltcolor-jfld-f900-32.jpg", hex: "#e8e5f2" },
    ],
  },
];

const FABRIC_PATTERN_TYPES = [
  {
    name: "Solid",
    representativeImg: "./assets/jacket-fabric-26su217-dbv3530.jpg",
    swatchHex: "#29272d",
    colorFamilies: [
  {
    name: "Black",
    swatchHex: "#1c1c1a",
    options: [
      { name: "26SU218.DBV3529", displayName: "Smoky Onyx", img: "./assets/jacket-fabric-26su218-dbv3529.jpg", hex: "#161615" },
      { name: "26SU209.DLL0177", displayName: "Rich Ink", img: "./assets/jacket-fabric-26su209-dll0177.jpg", hex: "#161617" },
      { name: "26SU204.DPP0191", displayName: "Rich Onyx", img: "./assets/jacket-fabric-26su204-dpp0191.jpg", hex: "#1a1916" },
      { name: "26SU203.DLL0160", displayName: "Dark Smoke", img: "./assets/jacket-fabric-26su203-dll0160.jpg", hex: "#1f1f19" },
      { name: "26SU245.DZZ0072", displayName: "Rich Raven", img: "./assets/jacket-fabric-26su245-dzz0072.jpg", hex: "#221f24" },
      { name: "26SU244.DZZ0071", displayName: "Dark Charcoal", img: "./assets/jacket-fabric-26su244-dzz0071.jpg", hex: "#24241e" },
    ],
  },
  {
    name: "Navy",
    swatchHex: "#131525",
    options: [
      { name: "26SU207.DLL0175", displayName: "Sterling Cobalt", img: "./assets/jacket-fabric-26su207-dll0175.jpg", hex: "#0b101d" },
      { name: "26SU230.DZZ0129", displayName: "Deep Steel Blue", img: "./assets/jacket-fabric-26su230-dzz0129.jpg", hex: "#0f111d" },
      { name: "26SU196.DLL0176", displayName: "Dark Slate Blue", img: "./assets/jacket-fabric-26su196-dll0176.jpg", hex: "#13151b" },
      { name: "26SU185.DZZ0105", displayName: "Deep Slate Blue", img: "./assets/jacket-fabric-26su185-dzz0105.jpg", hex: "#12121e" },
      { name: "26SU229.DZZ0128", displayName: "Deepest Indigo Blue", img: "./assets/jacket-fabric-26su229-dzz0128.jpg", hex: "#12111e" },
      { name: "26SU247.DZZ0073", displayName: "Rich Steel Blue", img: "./assets/jacket-fabric-26su247-dzz0073.jpg", hex: "#141420" },
      { name: "26SU217.DBV3530", displayName: "Sterling Midnight Blue", img: "./assets/jacket-fabric-26su217-dbv3530.jpg", hex: "#121620" },
      { name: "26SU216.DBV3531", displayName: "Sterling Navy", img: "./assets/jacket-fabric-26su216-dbv3531.jpg", hex: "#121627" },
      { name: "26SU213.DEE1018", displayName: "Sterling Indigo Blue", img: "./assets/jacket-fabric-26su213-dee1018.jpg", hex: "#161527" },
      { name: "26SU212.DBQ796A", displayName: "Rich Slate Blue", img: "./assets/jacket-fabric-26su212-dbq796a.jpg", hex: "#0d122e" },
      { name: "26SU246.DZZ0069", displayName: "Deepest Steel Blue", img: "./assets/jacket-fabric-26su246-dzz0069.jpg", hex: "#191b24" },
      { name: "26SU206.DLL0174", displayName: "Rich Cobalt", img: "./assets/jacket-fabric-26su206-dll0174.jpg", hex: "#14192e" },
      { name: "26SU205.DLL0173", displayName: "Soft Steel Blue", img: "./assets/jacket-fabric-26su205-dll0173.jpg", hex: "#1b2146" },
    ],
  },
  {
    name: "Purple",
    swatchHex: "#16121b",
    options: [
      { name: "26SU235.DZZ0132", displayName: "Deepest Amethyst", img: "./assets/jacket-fabric-26su235-dzz0132.jpg", hex: "#171219" },
      { name: "26SU241.DZZ0057", displayName: "Smoky Plum", img: "./assets/jacket-fabric-26su241-dzz0057.jpg", hex: "#16111d" },
    ],
  },
  {
    name: "Burgundy",
    swatchHex: "#200b10",
    options: [
      { name: "26SU201.DLL0168", displayName: "Deep Berry", img: "./assets/jacket-fabric-26su201-dll0168.jpg", hex: "#1b0915" },
      { name: "26SU211.DBP323A", displayName: "Deepest Mulberry Red", img: "./assets/jacket-fabric-26su211-dbp323a.jpg", hex: "#200810" },
      { name: "26SU199.DLL0169", displayName: "Sterling Crimson", img: "./assets/jacket-fabric-26su199-dll0169.jpg", hex: "#230b0e" },
      { name: "26SU200.DLL0170", displayName: "Dark Terracotta", img: "./assets/jacket-fabric-26su200-dll0170.jpg", hex: "#220f0f" },
    ],
  },
  {
    name: "Brown",
    swatchHex: "#251910",
    options: [
      { name: "26SU198.DLL0172", displayName: "Rich Chestnut", img: "./assets/jacket-fabric-26su198-dll0172.jpg", hex: "#201305" },
      { name: "26SU243.DZZ0070", displayName: "Deepest Brick", img: "./assets/jacket-fabric-26su243-dzz0070.jpg", hex: "#2a1f1a" },
    ],
  },
  {
    name: "Green",
    swatchHex: "#1c302a",
    options: [
      { name: "26SU202.DBV3537", displayName: "Deepest Forest", img: "./assets/jacket-fabric-26su202-dbv3537.jpg", hex: "#1c302a" },
    ],
  },
  {
    name: "Charcoal",
    swatchHex: "#383839",
    options: [
      { name: "26SU215.DBV3535", displayName: "Muted Iron", img: "./assets/jacket-fabric-26su215-dbv3535.jpg", hex: "#383839" },
    ],
  },
  {
    name: "Gray",
    swatchHex: "#686256",
    options: [
      { name: "26SU197.DLL0171", displayName: "Refined Stone", img: "./assets/jacket-fabric-26su197-dll0171.jpg", hex: "#686256" },
    ],
  },
  {
    name: "Cream",
    swatchHex: "#eeeae2",
    options: [
      { name: "26SU210.DBP325A", displayName: "Soft Ivory", img: "./assets/jacket-fabric-26su210-dbp325a.jpg", hex: "#ece7e4" },
      { name: "26SU196.DLL0167", displayName: "Warm Ivory", img: "./assets/jacket-fabric-26su196-dll0167.jpg", hex: "#f0eee0" },
    ],
  },
    ],
  },
  {
    name: "Pinstripe",
    representativeImg: "./assets/jacket-fabric-26su187-dzz0108.jpg",
    swatchHex: "#1c1925",
    colorFamilies: [
  {
    name: "Navy Pattern",
    swatchHex: "#191726",
    options: [
      { name: "26SU190.DPP0193", displayName: "Rich Midnight Blue", img: "./assets/jacket-fabric-26su190-dpp0193.jpg", hex: "#161422" },
      { name: "26SU188.DZZ0109", displayName: "Smoky Eggplant", img: "./assets/jacket-fabric-26su188-dzz0109.jpg", hex: "#1c1923" },
      { name: "26SU187.DZZ0108", displayName: "Dark Midnight Blue", img: "./assets/jacket-fabric-26su187-dzz0108.jpg", hex: "#161428" },
      { name: "26SU234.DZZ0061", displayName: "Deepest Cobalt", img: "./assets/jacket-fabric-26su234-dzz0061.jpg", hex: "#1c1a29" },
    ],
  },
  {
    name: "Brown Pattern",
    swatchHex: "#2a2122",
    options: [
      { name: "26SU225.DBV6495", displayName: "Deep Umber", img: "./assets/jacket-fabric-26su225-dbv6495.jpg", hex: "#2a2122" },
    ],
  },
    ],
  },
  {
    name: "Herringbone",
    representativeImg: "./assets/jacket-fabric-26su184-dzz0103.jpg",
    swatchHex: "#232023",
    colorFamilies: [
  {
    name: "Black Pattern",
    swatchHex: "#181618",
    options: [
      { name: "26SU237.DZZ0134", displayName: "Deepest Onyx", img: "./assets/jacket-fabric-26su237-dzz0134.jpg", hex: "#121011" },
      { name: "26SU236.DZZ0133", displayName: "Smoky Mulberry", img: "./assets/jacket-fabric-26su236-dzz0133.jpg", hex: "#151116" },
      { name: "26SU242.DZZ0054", displayName: "Rich Black", img: "./assets/jacket-fabric-26su242-dzz0054.jpg", hex: "#171314" },
      { name: "26SU192.DZZ0102", displayName: "Dark Mulberry", img: "./assets/jacket-fabric-26su192-dzz0102.jpg", hex: "#151219" },
      { name: "26SU231.DZZ0130", displayName: "Sterling Jet", img: "./assets/jacket-fabric-26su231-dzz0130.jpg", hex: "#141717" },
      { name: "26SU233.DZZ0060", displayName: "Deepest Charcoal", img: "./assets/jacket-fabric-26su233-dzz0060.jpg", hex: "#1b1819" },
      { name: "26SU184.DZZ0103", displayName: "Deep Graphite", img: "./assets/jacket-fabric-26su184-dzz0103.jpg", hex: "#1a1a1a" },
      { name: "DAT9758.DZZ0099", displayName: "Smoky Olive", img: "./assets/jacket-fabric-dat9758-dzz0099.jpg", hex: "#1b1c16" },
      { name: "26SU232.DZZ0131", displayName: "Deep Smoke", img: "./assets/jacket-fabric-26su232-dzz0131.jpg", hex: "#1d181d" },
      { name: "26SU191.DZZ0101", displayName: "Deep Raven", img: "./assets/jacket-fabric-26su191-dzz0101.jpg", hex: "#1f1c21" },
    ],
  },
  {
    name: "Navy Pattern",
    swatchHex: "#161623",
    options: [
      { name: "26SU186.DZZ0107", displayName: "Deep Indigo Blue", img: "./assets/jacket-fabric-26su186-dzz0107.jpg", hex: "#0f101a" },
      { name: "26SU228.DZZ0127", displayName: "Smoky Slate Blue", img: "./assets/jacket-fabric-26su228-dzz0127.jpg", hex: "#141424" },
      { name: "26SU240.DZZ0056", displayName: "Deepest Midnight Blue", img: "./assets/jacket-fabric-26su240-dzz0056.jpg", hex: "#1f1e2b" },
    ],
  },
  {
    name: "Brown Pattern",
    swatchHex: "#251c1a",
    options: [
      { name: "26SU238.DZZ0053", displayName: "Deepest Sienna", img: "./assets/jacket-fabric-26su238-dzz0053.jpg", hex: "#201815" },
      { name: "26SU194.DZZ0100", displayName: "Deep Walnut", img: "./assets/jacket-fabric-26su194-dzz0100.jpg", hex: "#241a16" },
      { name: "26SU227.DZZ0126", displayName: "Rich Walnut", img: "./assets/jacket-fabric-26su227-dzz0126.jpg", hex: "#2c2123" },
    ],
  },
  {
    name: "Charcoal Pattern",
    swatchHex: "#2e2e35",
    options: [
      { name: "26SU239.DZZ0055", displayName: "Rich Charcoal", img: "./assets/jacket-fabric-26su239-dzz0055.jpg", hex: "#2a2a2c" },
      { name: "26SU189.DPP0192", displayName: "Muted Pewter", img: "./assets/jacket-fabric-26su189-dpp0192.jpg", hex: "#32323e" },
    ],
  },
  {
    name: "Gray Pattern",
    swatchHex: "#97907d",
    options: [
      { name: "26SU193.DZZ0098", displayName: "Refined Gray", img: "./assets/jacket-fabric-26su193-dzz0098.jpg", hex: "#97907d" },
    ],
  },
    ],
  },
  {
    name: "Plaid",
    representativeImg: "./assets/jacket-fabric-26su173-dzz0110.jpg",
    swatchHex: "#2d2d35",
    colorFamilies: [
  {
    name: "Black Pattern",
    swatchHex: "#1e1e1e",
    options: [
      { name: "26SU226.DBV6494", displayName: "Deepest Graphite", img: "./assets/jacket-fabric-26su226-dbv6494.jpg", hex: "#1e1e1e" },
    ],
  },
  {
    name: "Navy Pattern",
    swatchHex: "#1b1e2a",
    options: [
      { name: "26SU224.DZZ0124", displayName: "Dark Steel Blue", img: "./assets/jacket-fabric-26su224-dzz0124.jpg", hex: "#101017" },
      { name: "26SU223.DZZ0125", displayName: "Deepest Slate Blue", img: "./assets/jacket-fabric-26su223-dzz0125.jpg", hex: "#14151b" },
      { name: "26SU179.DZZ0114", displayName: "Dark Cobalt", img: "./assets/jacket-fabric-26su179-dzz0114.jpg", hex: "#1a1923" },
      { name: "26SU183.DGG1120", displayName: "Deep Cobalt", img: "./assets/jacket-fabric-26su183-dgg1120.jpg", hex: "#161a25" },
      { name: "26SU181.DGG1118", displayName: "Deep Midnight Blue", img: "./assets/jacket-fabric-26su181-dgg1118.jpg", hex: "#181c28" },
      { name: "26SU178.DZZ0113", displayName: "Deep Navy", img: "./assets/jacket-fabric-26su178-dzz0113.jpg", hex: "#1a1d33" },
      { name: "26SU220.DZZ0064", displayName: "Deepest Navy", img: "./assets/jacket-fabric-26su220-dzz0064.jpg", hex: "#20212a" },
      { name: "26SU173.DZZ0110", displayName: "Rich Indigo Blue", img: "./assets/jacket-fabric-26su173-dzz0110.jpg", hex: "#222c38" },
      { name: "26SU176.DGG1133", displayName: "Antique Navy", img: "./assets/jacket-fabric-26su176-dgg1133.jpg", hex: "#2a3046" },
    ],
  },
  {
    name: "Teal Pattern",
    swatchHex: "#1e2a30",
    options: [
      { name: "26SU177.DZZ0112", displayName: "Deepest Teal", img: "./assets/jacket-fabric-26su177-dzz0112.jpg", hex: "#1e2a30" },
    ],
  },
  {
    name: "Brown Pattern",
    swatchHex: "#362a24",
    options: [
      { name: "26SU221.DBV6499", displayName: "Deepest Espresso", img: "./assets/jacket-fabric-26su221-dbv6499.jpg", hex: "#261e1e" },
      { name: "26SU219.DZZ0062", displayName: "Muted Espresso", img: "./assets/jacket-fabric-26su219-dzz0062.jpg", hex: "#46352b" },
    ],
  },
  {
    name: "Charcoal Pattern",
    swatchHex: "#322f33",
    options: [
      { name: "26SU182.DGG1119", displayName: "Dark Graphite", img: "./assets/jacket-fabric-26su182-dgg1119.jpg", hex: "#272227" },
      { name: "26SU222.DZZ0123", displayName: "Deepest Smoke", img: "./assets/jacket-fabric-26su222-dzz0123.jpg", hex: "#2a2726" },
      { name: "26SU180.DGG1117", displayName: "Muted Slate", img: "./assets/jacket-fabric-26su180-dgg1117.jpg", hex: "#303037" },
      { name: "26SU175.DGG1132", displayName: "Antique Pewter", img: "./assets/jacket-fabric-26su175-dgg1132.jpg", hex: "#454247" },
    ],
  },
  {
    name: "Gray Pattern",
    swatchHex: "#d1cdd4",
    options: [
      { name: "26SU214.DBV3534", displayName: "Light Fog", img: "./assets/jacket-fabric-26su214-dbv3534.jpg", hex: "#d1cdd4" },
    ],
  },
    ],
  },
];
const LINING_PATTERN_TYPES = [{"name": "Solid", "representativeImg": "./assets/lining-FLLYK1780-254.jpg", "swatchHex": "#635b5a", "colorFamilies": [{"name": "Black", "swatchHex": "#131414", "representativeImg": "./assets/lining-FLLYK1780-198.jpg", "options": [{"name": "FLLYK1780-198", "displayName": "Ink Black", "img": "./assets/lining-FLLYK1780-198.jpg", "hex": "#101417"}, {"name": "FLLYK1780-197", "displayName": "Jet Black", "img": "./assets/lining-FLLYK1780-197.jpg", "hex": "#11110e"}, {"name": "FLLYK1780-200", "displayName": "Onyx", "img": "./assets/lining-FLLYK1780-200.jpg", "hex": "#181717"}]}, {"name": "Navy & Blue", "swatchHex": "#546579", "representativeImg": "./assets/lining-FLLYK1780-185.jpg", "options": [{"name": "FLLYK1780-185", "displayName": "Charcoal Blue", "img": "./assets/lining-FLLYK1780-185.jpg", "hex": "#37414c"}, {"name": "FLLYK1780-254", "displayName": "Cobalt Blue", "img": "./assets/lining-FLLYK1780-254.jpg", "hex": "#1b5083"}, {"name": "FLLYK1780-101", "displayName": "Frost Blue", "img": "./assets/lining-FLLYK1780-101.jpg", "hex": "#c6d0d9"}, {"name": "FLLYK1780-193", "displayName": "Midnight Navy", "img": "./assets/lining-FLLYK1780-193.jpg", "hex": "#1c222b"}, {"name": "FLLYK1780-168", "displayName": "Navy Blue", "img": "./assets/lining-FLLYK1780-168.jpg", "hex": "#23354f"}, {"name": "FLLYK1780-156", "displayName": "Pewter Blue", "img": "./assets/lining-FLLYK1780-156.jpg", "hex": "#5e6571"}, {"name": "FLLYK1780-110", "displayName": "Powder Blue", "img": "./assets/lining-FLLYK1780-110.jpg", "hex": "#a4b1c2"}, {"name": "FLLYK1780-365", "displayName": "Slate Blue", "img": "./assets/lining-FLLYK1780-365.jpg", "hex": "#475b71"}]}, {"name": "Gray", "swatchHex": "#86898a", "representativeImg": "./assets/lining-FLLYK1780-187.jpg", "options": [{"name": "FLLYK1780-187", "displayName": "Charcoal Gray", "img": "./assets/lining-FLLYK1780-187.jpg", "hex": "#3f3d42"}, {"name": "FLLYK1780-117", "displayName": "Pearl Gray", "img": "./assets/lining-FLLYK1780-117.jpg", "hex": "#c2c8c6"}, {"name": "FLLYK1780-222", "displayName": "Silver Gray", "img": "./assets/lining-FLLYK1780-222.jpg", "hex": "#acaeb8"}, {"name": "FLLYK1780-219", "displayName": "Steel Gray", "img": "./assets/lining-FLLYK1780-219.jpg", "hex": "#626f74"}, {"name": "FLLYK1780-371", "displayName": "Stone Gray", "img": "./assets/lining-FLLYK1780-371.jpg", "hex": "#8d8b7d"}]}, {"name": "White & Cream", "swatchHex": "#d4d2be", "representativeImg": "./assets/lining-FLLYK1780-320.jpg", "options": [{"name": "FLLYK1780-320", "displayName": "Butter Cream", "img": "./assets/lining-FLLYK1780-320.jpg", "hex": "#d8cb9e"}, {"name": "FLLYK1780-112", "displayName": "Ice White", "img": "./assets/lining-FLLYK1780-112.jpg", "hex": "#d1dade"}]}, {"name": "Brown & Tan", "swatchHex": "#604f40", "representativeImg": "./assets/lining-FLLYK1780-225.jpg", "options": [{"name": "FLLYK1780-225", "displayName": "Caramel Brown", "img": "./assets/lining-FLLYK1780-225.jpg", "hex": "#80583e"}, {"name": "FLLYK1780-149", "displayName": "Dark Chocolate", "img": "./assets/lining-FLLYK1780-149.jpg", "hex": "#261a19"}, {"name": "FLLYK1780-189", "displayName": "Espresso", "img": "./assets/lining-FLLYK1780-189.jpg", "hex": "#231c19"}, {"name": "FLLYK1780-107", "displayName": "Mushroom", "img": "./assets/lining-FLLYK1780-107.jpg", "hex": "#a2978a"}, {"name": "FLLYK1780-127", "displayName": "Olive Taupe", "img": "./assets/lining-FLLYK1780-127.jpg", "hex": "#746f5f"}, {"name": "FLLYK1780-143", "displayName": "Tobacco Brown", "img": "./assets/lining-FLLYK1780-143.jpg", "hex": "#634729"}]}, {"name": "Gold & Orange", "swatchHex": "#835028", "representativeImg": "./assets/lining-FLLYK1780-258.jpg", "options": [{"name": "FLLYK1780-258", "displayName": "Antique Gold", "img": "./assets/lining-FLLYK1780-258.jpg", "hex": "#7c6235"}, {"name": "FLLYK1780-134", "displayName": "Burnt Orange", "img": "./assets/lining-FLLYK1780-134.jpg", "hex": "#7f3617"}, {"name": "FLLYK1780-226", "displayName": "Cognac", "img": "./assets/lining-FLLYK1780-226.jpg", "hex": "#8d582b"}]}, {"name": "Red & Burgundy", "swatchHex": "#6f131b", "representativeImg": "./assets/lining-FLLYK1780-139.jpg", "options": [{"name": "FLLYK1780-139", "displayName": "Burgundy", "img": "./assets/lining-FLLYK1780-139.jpg", "hex": "#54151e"}, {"name": "FLLYK1780-230", "displayName": "Scarlet Red", "img": "./assets/lining-FLLYK1780-230.jpg", "hex": "#8a1118"}]}, {"name": "Pink & Purple", "swatchHex": "#84697b", "representativeImg": "./assets/lining-FLLYK1780-236.jpg", "options": [{"name": "FLLYK1780-236", "displayName": "Deep Purple", "img": "./assets/lining-FLLYK1780-236.jpg", "hex": "#3a2b49"}, {"name": "FLLYK1780-272", "displayName": "Dusty Rose", "img": "./assets/lining-FLLYK1780-272.jpg", "hex": "#c3a8a6"}, {"name": "FLLYK1780-131", "displayName": "Mauve Orchid", "img": "./assets/lining-FLLYK1780-131.jpg", "hex": "#8f6783"}]}, {"name": "Green", "swatchHex": "#263c37", "representativeImg": "./assets/lining-FLLYK1780-268.jpg", "options": [{"name": "FLLYK1780-268", "displayName": "Black Olive", "img": "./assets/lining-FLLYK1780-268.jpg", "hex": "#191e1a"}, {"name": "FLLYK1780-345", "displayName": "Dark Olive", "img": "./assets/lining-FLLYK1780-345.jpg", "hex": "#2b3934"}, {"name": "FLLYK1780-266", "displayName": "Emerald Green", "img": "./assets/lining-FLLYK1780-266.jpg", "hex": "#133a35"}, {"name": "FLLYK1780-340", "displayName": "Spruce Green", "img": "./assets/lining-FLLYK1780-340.jpg", "hex": "#405e5a"}]}]}, {"name": "Stretch Solid", "representativeImg": "./assets/lining-FLL7500Z-3.jpg", "swatchHex": "#767379", "colorFamilies": [{"name": "Black", "swatchHex": "#0e100f", "representativeImg": "./assets/lining-FLL7500Z-BK.jpg", "options": [{"name": "FLL7500Z-BK", "displayName": "True Black", "img": "./assets/lining-FLL7500Z-BK.jpg", "hex": "#0e100f"}]}, {"name": "Navy & Blue", "swatchHex": "#49698b", "representativeImg": "./assets/lining-FLL7500Z-521.jpg", "options": [{"name": "FLL7500Z-521", "displayName": "Aqua Blue", "img": "./assets/lining-FLL7500Z-521.jpg", "hex": "#6bafc6"}, {"name": "FLL7500Z-148", "displayName": "Classic Navy", "img": "./assets/lining-FLL7500Z-148.jpg", "hex": "#232d41"}, {"name": "FLL7500Z-40", "displayName": "Dark Navy", "img": "./assets/lining-FLL7500Z-40.jpg", "hex": "#252934"}, {"name": "FLL7500Z-3", "displayName": "Royal Blue", "img": "./assets/lining-FLL7500Z-3.jpg", "hex": "#284fa3"}, {"name": "FLL7500Z-1016", "displayName": "Sky Blue", "img": "./assets/lining-FLL7500Z-1016.jpg", "hex": "#91b7d8"}]}, {"name": "Gray", "swatchHex": "#7f8082", "representativeImg": "./assets/lining-FLL7500Z-32.jpg", "options": [{"name": "FLL7500Z-32", "displayName": "Cool Gray", "img": "./assets/lining-FLL7500Z-32.jpg", "hex": "#8a8f97"}, {"name": "FLL7500Z-307", "displayName": "Graphite", "img": "./assets/lining-FLL7500Z-307.jpg", "hex": "#616061"}, {"name": "FLL7500Z-553", "displayName": "Light Silver", "img": "./assets/lining-FLL7500Z-553.jpg", "hex": "#b0b0b6"}, {"name": "FLL7500Z-1025", "displayName": "Moss Gray", "img": "./assets/lining-FLL7500Z-1025.jpg", "hex": "#616158"}]}, {"name": "White & Cream", "swatchHex": "#f4f0ea", "representativeImg": "./assets/lining-FLL7500Z-568A.jpg", "options": [{"name": "FLL7500Z-568A", "displayName": "Bright White", "img": "./assets/lining-FLL7500Z-568A.jpg", "hex": "#f1f1f1"}, {"name": "FLL7500Z-242", "displayName": "Ivory", "img": "./assets/lining-FLL7500Z-242.jpg", "hex": "#f7f0e2"}]}, {"name": "Brown & Tan", "swatchHex": "#937958", "representativeImg": "./assets/lining-FLL7500Z-538.jpg", "options": [{"name": "FLL7500Z-538", "displayName": "Camel", "img": "./assets/lining-FLL7500Z-538.jpg", "hex": "#b39c7b"}, {"name": "FLL7500Z-1043", "displayName": "Walnut Brown", "img": "./assets/lining-FLL7500Z-1043.jpg", "hex": "#735636"}]}, {"name": "Red & Burgundy", "swatchHex": "#71202a", "representativeImg": "./assets/lining-FLL7500Z-1047.jpg", "options": [{"name": "FLL7500Z-1047", "displayName": "Crimson", "img": "./assets/lining-FLL7500Z-1047.jpg", "hex": "#991827"}, {"name": "FLL7500Z-154", "displayName": "Oxblood", "img": "./assets/lining-FLL7500Z-154.jpg", "hex": "#49292e"}]}, {"name": "Pink & Purple", "swatchHex": "#cda4a7", "representativeImg": "./assets/lining-FLL7500Z-248.jpg", "options": [{"name": "FLL7500Z-248", "displayName": "Blush Pink", "img": "./assets/lining-FLL7500Z-248.jpg", "hex": "#cda4a7"}]}, {"name": "Green", "swatchHex": "#1b3d37", "representativeImg": "./assets/lining-FLL7500Z-1020.jpg", "options": [{"name": "FLL7500Z-1020", "displayName": "Forest Green", "img": "./assets/lining-FLL7500Z-1020.jpg", "hex": "#1b3d37"}]}]}, {"name": "Tonal Jacquard", "representativeImg": "./assets/lining-FLL624-166.jpg", "swatchHex": "#706b73", "colorFamilies": [{"name": "Navy & Blue", "swatchHex": "#5d6d87", "representativeImg": "./assets/lining-JFLL624-017.jpg", "options": [{"name": "JFLL624-017", "displayName": "Navy Tonal Paisley", "img": "./assets/lining-JFLL624-017.jpg", "hex": "#20293b"}, {"name": "FLL624-163", "displayName": "Periwinkle Tonal Paisley", "img": "./assets/lining-FLL624-163.jpg", "hex": "#7387a9"}, {"name": "FLL624-171", "displayName": "Sky Blue Tonal Paisley", "img": "./assets/lining-FLL624-171.jpg", "hex": "#8598b2"}]}, {"name": "Gray", "swatchHex": "#60626c", "representativeImg": "./assets/lining-FLL624-173.jpg", "options": [{"name": "FLL624-173", "displayName": "Charcoal Tonal Paisley", "img": "./assets/lining-FLL624-173.jpg", "hex": "#252934"}, {"name": "FLL624-170", "displayName": "Silver Tonal Paisley", "img": "./assets/lining-FLL624-170.jpg", "hex": "#9b9ba4"}]}, {"name": "White & Cream", "swatchHex": "#eae4e7", "representativeImg": "./assets/lining-FLL624-165.jpg", "options": [{"name": "FLL624-165", "displayName": "White Tonal Paisley", "img": "./assets/lining-FLL624-165.jpg", "hex": "#eae4e7"}]}, {"name": "Brown & Tan", "swatchHex": "#9a7766", "representativeImg": "./assets/lining-FLL624-166.jpg", "options": [{"name": "FLL624-166", "displayName": "Copper Tonal Paisley", "img": "./assets/lining-FLL624-166.jpg", "hex": "#b18269"}, {"name": "FLL624-167", "displayName": "Taupe Tonal Paisley", "img": "./assets/lining-FLL624-167.jpg", "hex": "#826c64"}]}, {"name": "Red & Burgundy", "swatchHex": "#642e32", "representativeImg": "./assets/lining-FLL624-164.jpg", "options": [{"name": "FLL624-164", "displayName": "Crimson Tonal Rosette", "img": "./assets/lining-FLL624-164.jpg", "hex": "#642e32"}]}, {"name": "Pink & Purple", "swatchHex": "#5b4e5e", "representativeImg": "./assets/lining-FLL624-174.jpg", "options": [{"name": "FLL624-174", "displayName": "Plum Tonal Paisley", "img": "./assets/lining-FLL624-174.jpg", "hex": "#5b4e5e"}]}, {"name": "Green", "swatchHex": "#1c3d3d", "representativeImg": "./assets/lining-FLL624-169.jpg", "options": [{"name": "FLL624-169", "displayName": "Emerald Tonal Paisley", "img": "./assets/lining-FLL624-169.jpg", "hex": "#1c3d3d"}]}]}, {"name": "Paisley", "representativeImg": "./assets/lining-FLLYH190.jpg", "swatchHex": "#61636a", "colorFamilies": [{"name": "Black", "swatchHex": "#45454a", "representativeImg": "./assets/lining-FLLYH183.jpg", "options": [{"name": "FLLYH183", "displayName": "Silver Night Paisley", "img": "./assets/lining-FLLYH183.jpg", "hex": "#45454a"}]}, {"name": "Navy & Blue", "swatchHex": "#4e5262", "representativeImg": "./assets/lining-FLLYH190.jpg", "options": [{"name": "FLLYH190", "displayName": "Cobalt Bandana Medallion", "img": "./assets/lining-FLLYH190.jpg", "hex": "#273c53"}, {"name": "FLLYH179", "displayName": "Cobalt Swirl Paisley", "img": "./assets/lining-FLLYH179.jpg", "hex": "#383e56"}, {"name": "FLLYH191", "displayName": "Midnight Bandana Medallion", "img": "./assets/lining-FLLYH191.jpg", "hex": "#313e4c"}, {"name": "FLLYH178", "displayName": "Navy Star Paisley", "img": "./assets/lining-FLLYH178.jpg", "hex": "#545056"}, {"name": "FLLYH188", "displayName": "Orchid Medallion Paisley", "img": "./assets/lining-FLLYH188.jpg", "hex": "#44364b"}, {"name": "FLLYH187", "displayName": "Rose Medallion Paisley", "img": "./assets/lining-FLLYH187.jpg", "hex": "#443941"}, {"name": "FLLYH152", "displayName": "Royal Blue Paisley Garden", "img": "./assets/lining-FLLYH152.jpg", "hex": "#5e718b"}, {"name": "FLLYH163", "displayName": "Saffron Blue Paisley Swirl", "img": "./assets/lining-FLLYH163.jpg", "hex": "#a6a9ab"}]}, {"name": "White & Cream", "swatchHex": "#acaaaa", "representativeImg": "./assets/lining-FLLYH154.jpg", "options": [{"name": "FLLYH154", "displayName": "Charcoal Sketch Paisley", "img": "./assets/lining-FLLYH154.jpg", "hex": "#999696"}, {"name": "FLLYH184", "displayName": "Ivory Paisley Bloom", "img": "./assets/lining-FLLYH184.jpg", "hex": "#b9b9b7"}, {"name": "FLLYH182", "displayName": "Mocha Sketch Paisley", "img": "./assets/lining-FLLYH182.jpg", "hex": "#b2b0b2"}]}, {"name": "Brown & Tan", "swatchHex": "#675850", "representativeImg": "./assets/lining-FLLYH189.jpg", "options": [{"name": "FLLYH189", "displayName": "Bronze Bandana Medallion", "img": "./assets/lining-FLLYH189.jpg", "hex": "#493f39"}, {"name": "FLLYH181", "displayName": "Chocolate Leaf Paisley", "img": "./assets/lining-FLLYH181.jpg", "hex": "#857267"}]}, {"name": "Green", "swatchHex": "#4e5b5a", "representativeImg": "./assets/lining-FLLYH186.jpg", "options": [{"name": "FLLYH186", "displayName": "Forest Medallion Paisley", "img": "./assets/lining-FLLYH186.jpg", "hex": "#3d4a45"}, {"name": "FLLYH155", "displayName": "Sage Swirl Paisley", "img": "./assets/lining-FLLYH155.jpg", "hex": "#3d5252"}, {"name": "FLLYH180", "displayName": "Teal Teardrop Paisley", "img": "./assets/lining-FLLYH180.jpg", "hex": "#717576"}]}]}, {"name": "Novelty Print", "representativeImg": "./assets/lining-FLLYH159.jpg", "swatchHex": "#717b88", "colorFamilies": [{"name": "Black", "swatchHex": "#44494e", "representativeImg": "./assets/lining-FLLYH166.jpg", "options": [{"name": "FLLYH166", "displayName": "Black Soccer Match", "img": "./assets/lining-FLLYH166.jpg", "hex": "#514e50"}, {"name": "FLLYH185", "displayName": "Charcoal Acanthus Scroll", "img": "./assets/lining-FLLYH185.jpg", "hex": "#414b51"}, {"name": "FLLYH153", "displayName": "Midnight Orchid", "img": "./assets/lining-FLLYH153.jpg", "hex": "#394248"}]}, {"name": "Navy & Blue", "swatchHex": "#6c7b95", "representativeImg": "./assets/lining-FLLYH164.jpg", "options": [{"name": "FLLYH164", "displayName": "Alpine Ski Slopes", "img": "./assets/lining-FLLYH164.jpg", "hex": "#6783b7"}, {"name": "FLLYH194", "displayName": "Blue Seaside Village", "img": "./assets/lining-FLLYH194.jpg", "hex": "#9ab1cd"}, {"name": "FLLYH172", "displayName": "Delft Blue Foliage", "img": "./assets/lining-FLLYH172.jpg", "hex": "#7d8daa"}, {"name": "FLLYH192", "displayName": "Gothic Arch Collage", "img": "./assets/lining-FLLYH192.jpg", "hex": "#99a0a3"}, {"name": "FLLYH162", "displayName": "Gridiron Helmets", "img": "./assets/lining-FLLYH162.jpg", "hex": "#696b7c"}, {"name": "FLLYH177", "displayName": "Midnight Football Pop", "img": "./assets/lining-FLLYH177.jpg", "hex": "#555770"}, {"name": "FLLYH157", "displayName": "Midnight Snowboard", "img": "./assets/lining-FLLYH157.jpg", "hex": "#3c486b"}, {"name": "FLLYH169", "displayName": "Navy Baseball All-Stars", "img": "./assets/lining-FLLYH169.jpg", "hex": "#384055"}, {"name": "FLLYH150", "displayName": "Navy Clover Medallion", "img": "./assets/lining-FLLYH150.jpg", "hex": "#4e657c"}, {"name": "FLLYH160", "displayName": "Navy Soccer Stars", "img": "./assets/lining-FLLYH160.jpg", "hex": "#58607a"}, {"name": "FLLYH159", "displayName": "Ocean Tall Ships", "img": "./assets/lining-FLLYH159.jpg", "hex": "#6891be"}, {"name": "FLLYH158", "displayName": "Starry Night Sailboats", "img": "./assets/lining-FLLYH158.jpg", "hex": "#586d95"}, {"name": "FLLYH176", "displayName": "Teal Acanthus Scroll", "img": "./assets/lining-FLLYH176.jpg", "hex": "#92a2ad"}, {"name": "FLLYH175", "displayName": "Voyager Compass Map", "img": "./assets/lining-FLLYH175.jpg", "hex": "#a4acb0"}]}, {"name": "Gray", "swatchHex": "#817885", "representativeImg": "./assets/lining-FLLYH161.jpg", "options": [{"name": "FLLYH161", "displayName": "Vintage Footballs", "img": "./assets/lining-FLLYH161.jpg", "hex": "#817885"}]}, {"name": "White & Cream", "swatchHex": "#b6b2aa", "representativeImg": "./assets/lining-FLLYH174.jpg", "options": [{"name": "FLLYH174", "displayName": "Autumn Laurel Leaves", "img": "./assets/lining-FLLYH174.jpg", "hex": "#b0aaa0"}, {"name": "FLLYH156", "displayName": "Roman Collage", "img": "./assets/lining-FLLYH156.jpg", "hex": "#bdbbb4"}]}, {"name": "Brown & Tan", "swatchHex": "#beb1aa", "representativeImg": "./assets/lining-FLLYH193.jpg", "options": [{"name": "FLLYH193", "displayName": "Tuscan Village Watercolor", "img": "./assets/lining-FLLYH193.jpg", "hex": "#beb1aa"}]}, {"name": "Pink & Purple", "swatchHex": "#a5918f", "representativeImg": "./assets/lining-FLLYH173.jpg", "options": [{"name": "FLLYH173", "displayName": "Blush Rose Garden", "img": "./assets/lining-FLLYH173.jpg", "hex": "#a5918f"}]}, {"name": "Green", "swatchHex": "#667676", "representativeImg": "./assets/lining-FLLYH170.jpg", "options": [{"name": "FLLYH170", "displayName": "Emerald Marble Swirl", "img": "./assets/lining-FLLYH170.jpg", "hex": "#7e8c8a"}, {"name": "FLLYH165", "displayName": "Forest Baseball Slugger", "img": "./assets/lining-FLLYH165.jpg", "hex": "#35454d"}, {"name": "FLLYH167", "displayName": "Geometric Soccer", "img": "./assets/lining-FLLYH167.jpg", "hex": "#697577"}, {"name": "FLLYH171", "displayName": "Green Baseball Field", "img": "./assets/lining-FLLYH171.jpg", "hex": "#374248"}, {"name": "FLLYH195", "displayName": "Jade Seaside Village", "img": "./assets/lining-FLLYH195.jpg", "hex": "#81a09d"}, {"name": "FLLYH168", "displayName": "Tropical Fern Leaves", "img": "./assets/lining-FLLYH168.jpg", "hex": "#929b93"}]}]}, {"name": "Quilted", "representativeImg": "./assets/lining-FLL232.jpg", "swatchHex": "#373437", "colorFamilies": [{"name": "Black", "swatchHex": "#171a1b", "representativeImg": "./assets/lining-FLL233.jpg", "options": [{"name": "FLL233", "displayName": "Black Quilted", "img": "./assets/lining-FLL233.jpg", "hex": "#171a1b"}]}, {"name": "Navy & Blue", "swatchHex": "#1f2c41", "representativeImg": "./assets/lining-FLL232.jpg", "options": [{"name": "FLL232", "displayName": "Navy Quilted", "img": "./assets/lining-FLL232.jpg", "hex": "#1f2c41"}]}, {"name": "Gray", "swatchHex": "#545357", "representativeImg": "./assets/lining-FLL231.jpg", "options": [{"name": "FLL231", "displayName": "Charcoal Quilted", "img": "./assets/lining-FLL231.jpg", "hex": "#545357"}]}, {"name": "Brown & Tan", "swatchHex": "#533629", "representativeImg": "./assets/lining-FLL230.jpg", "options": [{"name": "FLL230", "displayName": "Chocolate Quilted", "img": "./assets/lining-FLL230.jpg", "hex": "#533629"}]}]}];

// Lining zoom map: every lining has its own full-quality photo, taken from
// the supplier's 25A1 Premium Linings catalog (the embedded photos, cropped
// to a centered square at their native 768-827px). The grid card shows a
// 360x360 copy (opt.img); this map points the zoom view at the full-size
// crop -- loaded via a plain <img src> swap in openLightbox (see main.js).
// Like fabric, the zoom never upscales past native pixels, so it opens at
// the same size as a fabric zoom and stays sharp.
const LINING_ZOOM_MAP = {
  "FLLYK1780-112": "./assets/lining-zoom-FLLYK1780-112.jpg",
  "FLLYK1780-110": "./assets/lining-zoom-FLLYK1780-110.jpg",
  "FLLYK1780-365": "./assets/lining-zoom-FLLYK1780-365.jpg",
  "FLLYK1780-254": "./assets/lining-zoom-FLLYK1780-254.jpg",
  "FLLYK1780-168": "./assets/lining-zoom-FLLYK1780-168.jpg",
  "FLLYK1780-193": "./assets/lining-zoom-FLLYK1780-193.jpg",
  "FLLYK1780-198": "./assets/lining-zoom-FLLYK1780-198.jpg",
  "FLLYK1780-197": "./assets/lining-zoom-FLLYK1780-197.jpg",
  "FLLYK1780-127": "./assets/lining-zoom-FLLYK1780-127.jpg",
  "FLLYK1780-219": "./assets/lining-zoom-FLLYK1780-219.jpg",
  "FLLYK1780-340": "./assets/lining-zoom-FLLYK1780-340.jpg",
  "FLLYK1780-266": "./assets/lining-zoom-FLLYK1780-266.jpg",
  "FLLYK1780-345": "./assets/lining-zoom-FLLYK1780-345.jpg",
  "FLLYK1780-268": "./assets/lining-zoom-FLLYK1780-268.jpg",
  "FLLYK1780-156": "./assets/lining-zoom-FLLYK1780-156.jpg",
  "FLLYK1780-185": "./assets/lining-zoom-FLLYK1780-185.jpg",
  "FLLYK1780-187": "./assets/lining-zoom-FLLYK1780-187.jpg",
  "FLLYK1780-200": "./assets/lining-zoom-FLLYK1780-200.jpg",
  "FLLYK1780-101": "./assets/lining-zoom-FLLYK1780-101.jpg",
  "FLLYK1780-117": "./assets/lining-zoom-FLLYK1780-117.jpg",
  "FLLYK1780-371": "./assets/lining-zoom-FLLYK1780-371.jpg",
  "FLLYK1780-107": "./assets/lining-zoom-FLLYK1780-107.jpg",
  "FLLYK1780-225": "./assets/lining-zoom-FLLYK1780-225.jpg",
  "FLLYK1780-258": "./assets/lining-zoom-FLLYK1780-258.jpg",
  "FLLYK1780-226": "./assets/lining-zoom-FLLYK1780-226.jpg",
  "FLLYK1780-134": "./assets/lining-zoom-FLLYK1780-134.jpg",
  "FLLYK1780-143": "./assets/lining-zoom-FLLYK1780-143.jpg",
  "FLLYK1780-189": "./assets/lining-zoom-FLLYK1780-189.jpg",
  "FLLYK1780-320": "./assets/lining-zoom-FLLYK1780-320.jpg",
  "FLLYK1780-272": "./assets/lining-zoom-FLLYK1780-272.jpg",
  "FLLYK1780-230": "./assets/lining-zoom-FLLYK1780-230.jpg",
  "FLLYK1780-139": "./assets/lining-zoom-FLLYK1780-139.jpg",
  "FLLYK1780-149": "./assets/lining-zoom-FLLYK1780-149.jpg",
  "FLLYK1780-222": "./assets/lining-zoom-FLLYK1780-222.jpg",
  "FLLYK1780-131": "./assets/lining-zoom-FLLYK1780-131.jpg",
  "FLLYK1780-236": "./assets/lining-zoom-FLLYK1780-236.jpg",
  "FLLYH184": "./assets/lining-zoom-FLLYH184.jpg",
  "FLLYH181": "./assets/lining-zoom-FLLYH181.jpg",
  "FLLYH180": "./assets/lining-zoom-FLLYH180.jpg",
  "FLLYH178": "./assets/lining-zoom-FLLYH178.jpg",
  "FLLYH179": "./assets/lining-zoom-FLLYH179.jpg",
  "FLLYH183": "./assets/lining-zoom-FLLYH183.jpg",
  "FLL7500Z-568A": "./assets/lining-zoom-FLL7500Z-568A.jpg",
  "FLL7500Z-1016": "./assets/lining-zoom-FLL7500Z-1016.jpg",
  "FLL7500Z-521": "./assets/lining-zoom-FLL7500Z-521.jpg",
  "FLL7500Z-3": "./assets/lining-zoom-FLL7500Z-3.jpg",
  "FLL7500Z-148": "./assets/lining-zoom-FLL7500Z-148.jpg",
  "FLL7500Z-40": "./assets/lining-zoom-FLL7500Z-40.jpg",
  "FLL7500Z-1025": "./assets/lining-zoom-FLL7500Z-1025.jpg",
  "FLL7500Z-1020": "./assets/lining-zoom-FLL7500Z-1020.jpg",
  "FLL7500Z-553": "./assets/lining-zoom-FLL7500Z-553.jpg",
  "FLL7500Z-32": "./assets/lining-zoom-FLL7500Z-32.jpg",
  "FLL7500Z-307": "./assets/lining-zoom-FLL7500Z-307.jpg",
  "FLL7500Z-BK": "./assets/lining-zoom-FLL7500Z-BK.jpg",
  "FLL7500Z-242": "./assets/lining-zoom-FLL7500Z-242.jpg",
  "FLL7500Z-538": "./assets/lining-zoom-FLL7500Z-538.jpg",
  "FLL7500Z-1043": "./assets/lining-zoom-FLL7500Z-1043.jpg",
  "FLL7500Z-248": "./assets/lining-zoom-FLL7500Z-248.jpg",
  "FLL7500Z-1047": "./assets/lining-zoom-FLL7500Z-1047.jpg",
  "FLL7500Z-154": "./assets/lining-zoom-FLL7500Z-154.jpg",
  "FLL624-165": "./assets/lining-zoom-FLL624-165.jpg",
  "FLL624-166": "./assets/lining-zoom-FLL624-166.jpg",
  "FLL624-167": "./assets/lining-zoom-FLL624-167.jpg",
  "FLL624-169": "./assets/lining-zoom-FLL624-169.jpg",
  "FLL624-164": "./assets/lining-zoom-FLL624-164.jpg",
  "FLL624-170": "./assets/lining-zoom-FLL624-170.jpg",
  "FLL624-171": "./assets/lining-zoom-FLL624-171.jpg",
  "JFLL624-017": "./assets/lining-zoom-JFLL624-017.jpg",
  "FLL624-173": "./assets/lining-zoom-FLL624-173.jpg",
  "FLL624-174": "./assets/lining-zoom-FLL624-174.jpg",
  "FLL624-163": "./assets/lining-zoom-FLL624-163.jpg",
  "FLLYH186": "./assets/lining-zoom-FLLYH186.jpg",
  "FLLYH187": "./assets/lining-zoom-FLLYH187.jpg",
  "FLLYH188": "./assets/lining-zoom-FLLYH188.jpg",
  "FLLYH189": "./assets/lining-zoom-FLLYH189.jpg",
  "FLLYH190": "./assets/lining-zoom-FLLYH190.jpg",
  "FLLYH191": "./assets/lining-zoom-FLLYH191.jpg",
  "FLLYH154": "./assets/lining-zoom-FLLYH154.jpg",
  "FLLYH182": "./assets/lining-zoom-FLLYH182.jpg",
  "FLLYH152": "./assets/lining-zoom-FLLYH152.jpg",
  "FLLYH155": "./assets/lining-zoom-FLLYH155.jpg",
  "FLLYH168": "./assets/lining-zoom-FLLYH168.jpg",
  "FLLYH174": "./assets/lining-zoom-FLLYH174.jpg",
  "FLLYH173": "./assets/lining-zoom-FLLYH173.jpg",
  "FLLYH153": "./assets/lining-zoom-FLLYH153.jpg",
  "FLLYH150": "./assets/lining-zoom-FLLYH150.jpg",
  "FLLYH176": "./assets/lining-zoom-FLLYH176.jpg",
  "FLLYH185": "./assets/lining-zoom-FLLYH185.jpg",
  "FLLYH172": "./assets/lining-zoom-FLLYH172.jpg",
  "FLLYH170": "./assets/lining-zoom-FLLYH170.jpg",
  "FLLYH163": "./assets/lining-zoom-FLLYH163.jpg",
  "FLLYH156": "./assets/lining-zoom-FLLYH156.jpg",
  "FLLYH192": "./assets/lining-zoom-FLLYH192.jpg",
  "FLLYH193": "./assets/lining-zoom-FLLYH193.jpg",
  "FLLYH194": "./assets/lining-zoom-FLLYH194.jpg",
  "FLLYH195": "./assets/lining-zoom-FLLYH195.jpg",
  "FLLYH175": "./assets/lining-zoom-FLLYH175.jpg",
  "FLLYH159": "./assets/lining-zoom-FLLYH159.jpg",
  "FLLYH158": "./assets/lining-zoom-FLLYH158.jpg",
  "FLLYH161": "./assets/lining-zoom-FLLYH161.jpg",
  "FLLYH177": "./assets/lining-zoom-FLLYH177.jpg",
  "FLLYH162": "./assets/lining-zoom-FLLYH162.jpg",
  "FLLYH164": "./assets/lining-zoom-FLLYH164.jpg",
  "FLLYH157": "./assets/lining-zoom-FLLYH157.jpg",
  "FLLYH160": "./assets/lining-zoom-FLLYH160.jpg",
  "FLLYH165": "./assets/lining-zoom-FLLYH165.jpg",
  "FLLYH171": "./assets/lining-zoom-FLLYH171.jpg",
  "FLLYH169": "./assets/lining-zoom-FLLYH169.jpg",
  "FLLYH167": "./assets/lining-zoom-FLLYH167.jpg",
  "FLLYH166": "./assets/lining-zoom-FLLYH166.jpg",
  "FLL230": "./assets/lining-zoom-FLL230.jpg",
  "FLL231": "./assets/lining-zoom-FLL231.jpg",
  "FLL232": "./assets/lining-zoom-FLL232.jpg",
  "FLL233": "./assets/lining-zoom-FLL233.jpg"
};


// matchesFabric: true tells the renderer (see renderSwatchCard in main.js) to
// swap this card's generic icon for the actual swatch of whichever fabric is
// currently selected on this same garment, so the customer sees exactly what
// "match the fabric" will look like instead of a placeholder texture.
const MATCH_FABRIC_COLOR_OPTION = { name: "Match Fabric Color", img: "./assets/match-fabric-color-icon.jpg", matchesFabric: true };
const BEST_MATCH_FABRIC_BUTTON_OPTION = { name: "Best Match to Fabric", img: "./assets/match-fabric-color-icon.jpg", matchesFabric: true };

// Flattens a colorFamilies array into the plain options list every other
// catalog category already has -- keeps buildRow/getSelections/"Same as
// Jacket" lookups (which all search cat.options by name) working
// unchanged for these categories too.
function flattenColorFamilies(families) {
  const opts = [];
  families.forEach((fam) => { fam.options.forEach((o) => opts.push(o)); });
  return opts;
}

// Same idea as flattenColorFamilies(), one level deeper: flattens a
// patternTypes array (pattern type -> colorFamilies -> options) into the
// same plain options list, so buildRow/getSelections/"Same as Jacket"/
// resolveBestMatchOption all keep working against cat.options unchanged
// regardless of how many picker levels the UI shows on top of it.
function flattenPatternTypes(types) {
  const opts = [];
  types.forEach((pt) => { pt.colorFamilies.forEach((fam) => { fam.options.forEach((o) => opts.push(o)); }); });
  return opts;
}

// Color-first view of the same fabrics: one group per base color (Black,
// Navy, ...), each holding that color's fabrics bucketed by pattern
// (Solid / Pinstripe / Herringbone / Plaid), dark -> light inside each
// bucket. Derived from FABRIC_PATTERN_TYPES so there is still exactly one
// source of truth -- a fabric added or moved there shows up here by itself.
// ---------------------------------------------------------------------
// Fabric color palette (the color grid shown first in the Fabric step) and
// the table that files every fabric under one palette color. A palette color
// with no fabrics is simply not shown. hex:null = no palette swatch yet (the
// swatch is averaged from its fabrics) -- Navy and Teal are interim entries
// until the rest of the palette is supplied.
// ---------------------------------------------------------------------
const FABRIC_PALETTE = [
  { name: "Jet Black", hex: "#0A0A0A" },
  { name: "Navy", hex: "#1F2B4D" },
  { name: "Deep Charcoal", hex: "#2B2C30" },
  { name: "Slate Grey", hex: "#4F5560" },
  { name: "Mid Grey", hex: "#656870" },
  { name: "Smoke", hex: "#787C80" },
  { name: "Light Grey", hex: "#9A9DA4" },
  { name: "Dove Grey", hex: "#B8B5AD" },
  { name: "Stone", hex: "#9E988C" },
  { name: "Pure White", hex: "#FFFFFF" },
  { name: "Off White", hex: "#F7F3EC" },
  { name: "Pearl", hex: "#ECE5D3" },
  { name: "Ivory White", hex: "#F5EFE1" },
  { name: "Cream Ivory", hex: "#ECDFC4" },
  { name: "Champagne", hex: "#DFC8A8" },
  { name: "Oat", hex: "#CDBF9C" },
  { name: "Warm Sand", hex: "#C9B48A" },
  { name: "Lemon", hex: "#F4ECCD" },
  { name: "Mustard", hex: "#B08A2C" },
  { name: "Khaki", hex: "#A89F7F" },
  { name: "Camel", hex: "#B08866" },
  { name: "Tan", hex: "#C49968" },
  { name: "Cognac", hex: "#7A4A22" },
  { name: "Chocolate Brown", hex: "#3B2A1E" },
  { name: "Taupe", hex: "#8C7A66" },
  { name: "Oxblood", hex: "#4A1420" },
  { name: "Burgundy", hex: "#5C1D2A" },
  { name: "Wine", hex: "#6E2332" },
  { name: "Terracotta", hex: "#A54A3A" },
  { name: "Coral", hex: "#D97A6C" },
  { name: "Rose Gold", hex: "#B86A5A" },
  { name: "Dusty Rose", hex: "#C89292" },
  { name: "Peach", hex: "#F0BF9B" },
  { name: "Blush", hex: "#ECC8C1" },
  { name: "Pink", hex: "#F3D8D6" },
  { name: "Mauve", hex: "#A07D8C" },
  { name: "Lavender", hex: "#B29BC4" },
  { name: "Lilac", hex: "#D8CAE3" },
  { name: "Plum", hex: "#56344C" },
  { name: "Aubergine", hex: "#361F39" },
  { name: "Forest Green", hex: "#273E2A" },
  { name: "Teal", hex: "#1F5560" }
];
const FABRIC_COLOR_ASSIGN = {
  "26SU218.DBV3529": "Jet Black",
  "26SU209.DLL0177": "Jet Black",
  "26SU204.DPP0191": "Jet Black",
  "26SU203.DLL0160": "Jet Black",
  "26SU245.DZZ0072": "Jet Black",
  "26SU244.DZZ0071": "Jet Black",
  "26SU207.DLL0175": "Navy",
  "26SU230.DZZ0129": "Navy",
  "26SU196.DLL0176": "Navy",
  "26SU185.DZZ0105": "Navy",
  "26SU229.DZZ0128": "Navy",
  "26SU247.DZZ0073": "Navy",
  "26SU217.DBV3530": "Navy",
  "26SU216.DBV3531": "Navy",
  "26SU213.DEE1018": "Navy",
  "26SU212.DBQ796A": "Navy",
  "26SU246.DZZ0069": "Navy",
  "26SU206.DLL0174": "Navy",
  "26SU205.DLL0173": "Navy",
  "26SU235.DZZ0132": "Aubergine",
  "26SU241.DZZ0057": "Aubergine",
  "26SU201.DLL0168": "Burgundy",
  "26SU211.DBP323A": "Burgundy",
  "26SU199.DLL0169": "Burgundy",
  "26SU200.DLL0170": "Burgundy",
  "26SU198.DLL0172": "Chocolate Brown",
  "26SU243.DZZ0070": "Chocolate Brown",
  "26SU202.DBV3537": "Forest Green",
  "26SU215.DBV3535": "Deep Charcoal",
  "26SU197.DLL0171": "Mid Grey",
  "26SU210.DBP325A": "Off White",
  "26SU196.DLL0167": "Ivory White",
  "26SU190.DPP0193": "Navy",
  "26SU188.DZZ0109": "Navy",
  "26SU187.DZZ0108": "Navy",
  "26SU234.DZZ0061": "Navy",
  "26SU225.DBV6495": "Chocolate Brown",
  "26SU237.DZZ0134": "Jet Black",
  "26SU236.DZZ0133": "Jet Black",
  "26SU242.DZZ0054": "Jet Black",
  "26SU192.DZZ0102": "Jet Black",
  "26SU231.DZZ0130": "Jet Black",
  "26SU233.DZZ0060": "Jet Black",
  "26SU184.DZZ0103": "Jet Black",
  "DAT9758.DZZ0099": "Jet Black",
  "26SU232.DZZ0131": "Jet Black",
  "26SU191.DZZ0101": "Jet Black",
  "26SU186.DZZ0107": "Navy",
  "26SU228.DZZ0127": "Navy",
  "26SU240.DZZ0056": "Navy",
  "26SU238.DZZ0053": "Chocolate Brown",
  "26SU194.DZZ0100": "Chocolate Brown",
  "26SU227.DZZ0126": "Chocolate Brown",
  "26SU239.DZZ0055": "Deep Charcoal",
  "26SU189.DPP0192": "Deep Charcoal",
  "26SU193.DZZ0098": "Stone",
  "26SU226.DBV6494": "Jet Black",
  "26SU224.DZZ0124": "Navy",
  "26SU223.DZZ0125": "Navy",
  "26SU179.DZZ0114": "Navy",
  "26SU183.DGG1120": "Navy",
  "26SU181.DGG1118": "Navy",
  "26SU178.DZZ0113": "Navy",
  "26SU220.DZZ0064": "Navy",
  "26SU173.DZZ0110": "Navy",
  "26SU176.DGG1133": "Navy",
  "26SU177.DZZ0112": "Teal",
  "26SU221.DBV6499": "Chocolate Brown",
  "26SU219.DZZ0062": "Chocolate Brown",
  "26SU182.DGG1119": "Deep Charcoal",
  "26SU222.DZZ0123": "Deep Charcoal",
  "26SU180.DGG1117": "Deep Charcoal",
  "26SU175.DGG1132": "Deep Charcoal",
  "26SU214.DBV3534": "Dove Grey"
};
const FABRIC_TYPE_ORDER = ["Solid", "Plaid", "Herringbone", "Pinstripe"];
const FABRIC_TYPE_IMG = {
  "Solid": "./assets/fabrictype-solid.jpg",
  "Plaid": "./assets/fabrictype-plaid.jpg",
  "Herringbone": "./assets/fabrictype-herringbone.jpg",
  "Pinstripe": "./assets/fabrictype-pinstripe.jpg"
};
// Very short customer-facing description of a fabric, shown once it's
// selected (see renderColorFirstOptions in main.js). The whole collection is
// the supplier's Elite Wool book, so it's built from what the catalog knows:
// the weave (pattern type) plus a season/occasion read from the fabric's
// color group and how dark its photo is.
// Hand-written short line per fabric (color + pattern + use), keyed by
// supplier code. fabricDescription() below is the fallback for any fabric
// added later without one.
const FABRIC_DESCRIPTIONS = {
  "26SU218.DBV3529": "Smoky black solid. Sharp for evening.",
  "26SU209.DLL0177": "Inky black solid. Made for black tie.",
  "26SU204.DPP0191": "Deep black solid. Timeless for weddings.",
  "26SU203.DLL0160": "Warm near-black solid. Easy to dress up or down.",
  "26SU245.DZZ0072": "Cool-toned black solid. Polished for dinners out.",
  "26SU244.DZZ0071": "Very dark charcoal solid. An everyday business staple.",
  "26SU237.DZZ0134": "Black herringbone. Formal, with quiet texture.",
  "26SU236.DZZ0133": "Black herringbone with a mulberry tint. Subtle color in the light.",
  "26SU242.DZZ0054": "Classic black herringbone. Rich texture for evening.",
  "26SU192.DZZ0102": "Deep mulberry herringbone. Distinctive but understated.",
  "26SU231.DZZ0130": "Jet black herringbone with a cool cast. Sleek and modern.",
  "26SU233.DZZ0060": "Darkest charcoal herringbone. Dependable for meetings.",
  "26SU184.DZZ0103": "Graphite herringbone. Modern and easy year-round.",
  "DAT9758.DZZ0099": "Dark olive herringbone. A quietly unusual fall pick.",
  "26SU232.DZZ0131": "Smoky gray-black herringbone. Relaxed yet sharp.",
  "26SU191.DZZ0101": "Raven-dark herringbone. Great for winter evenings.",
  "26SU226.DBV6494": "Graphite plaid with a tonal check. Dark and formal.",
  "26SU207.DLL0175": "Deep cobalt navy solid. Crisp for business.",
  "26SU230.DZZ0129": "Steel-toned navy solid. A sharp office suit.",
  "26SU196.DLL0176": "Muted slate blue solid. Understated and versatile.",
  "26SU185.DZZ0105": "Near-navy slate blue solid. Boardroom to wedding.",
  "26SU229.DZZ0128": "Darkest indigo solid. As formal as black, but richer.",
  "26SU247.DZZ0073": "Rich steel blue solid. Polished for daily wear.",
  "26SU217.DBV3530": "Midnight blue solid. The classic alternative to black.",
  "26SU216.DBV3531": "True navy solid. The most versatile suit color.",
  "26SU213.DEE1018": "Violet-tinted indigo solid. Elegant for events.",
  "26SU212.DBQ796A": "Saturated slate blue solid. Stands out in a good way.",
  "26SU246.DZZ0069": "Gray-cast steel blue solid. Calm and professional.",
  "26SU206.DLL0174": "Rich cobalt blue solid. Lively color for spring.",
  "26SU205.DLL0173": "Bright steel blue solid. Our boldest blue.",
  "26SU190.DPP0193": "Midnight blue pinstripe. The classic power suit.",
  "26SU188.DZZ0109": "Eggplant pinstripe. Traditional stripe, modern color.",
  "26SU187.DZZ0108": "Dark midnight pinstripe. A long, sharp line.",
  "26SU234.DZZ0061": "Deep cobalt pinstripe. Bold business wear.",
  "26SU186.DZZ0107": "Indigo herringbone. Navy with extra character.",
  "26SU228.DZZ0127": "Smoky slate blue herringbone. Soft texture for cooler days.",
  "26SU240.DZZ0056": "Midnight blue herringbone. Smart for fall and winter.",
  "26SU224.DZZ0124": "Dark steel blue plaid. A check that stays professional.",
  "26SU223.DZZ0125": "Slate blue plaid. A quiet check for the office.",
  "26SU179.DZZ0114": "Cobalt plaid with a tonal grid. Interest without noise.",
  "26SU183.DGG1120": "Deep cobalt plaid. A classic British-style check.",
  "26SU181.DGG1118": "Midnight blue plaid. Business or weekend.",
  "26SU178.DZZ0113": "Navy plaid with a visible check. A bit bolder.",
  "26SU220.DZZ0064": "Darkest navy plaid. Subtle up close.",
  "26SU173.DZZ0110": "Indigo plaid with a lighter blue grid. Lively and stylish.",
  "26SU176.DGG1133": "Faded navy plaid. A relaxed vintage feel.",
  "26SU215.DBV3535": "Iron gray solid. A clean alternative to navy.",
  "26SU239.DZZ0055": "Charcoal herringbone. Smart for winter business.",
  "26SU189.DPP0192": "Blue-gray pewter herringbone. Textured and refined.",
  "26SU182.DGG1119": "Warm graphite plaid. A subtle, easy check.",
  "26SU222.DZZ0123": "Smoky charcoal plaid. A muted everyday check.",
  "26SU180.DGG1117": "Cool slate gray plaid. A fresh take on gray.",
  "26SU175.DGG1132": "Pewter gray plaid. Vintage look, great with brown shoes.",
  "26SU197.DLL0171": "Warm stone gray solid. Relaxed for any season.",
  "26SU214.DBV3534": "Pale fog gray plaid. Light for spring and summer.",
  "26SU193.DZZ0098": "Taupe-gray herringbone. Easygoing for daytime.",
  "26SU210.DBP325A": "Soft ivory solid. Bright and summery.",
  "26SU196.DLL0167": "Warm cream solid. For outdoor celebrations.",
  "26SU198.DLL0172": "Chestnut brown solid. Warm and rich for fall.",
  "26SU243.DZZ0070": "Brick brown solid. Earthy and a little different.",
  "26SU225.DBV6495": "Umber brown pinstripe. A warmer classic stripe.",
  "26SU238.DZZ0053": "Sienna brown herringbone. Cozy for cooler weather.",
  "26SU194.DZZ0100": "Walnut brown herringbone. Country texture, city polish.",
  "26SU227.DZZ0126": "Reddish walnut herringbone. Made for autumn.",
  "26SU221.DBV6499": "Espresso brown plaid. Heritage style.",
  "26SU219.DZZ0062": "Light espresso plaid. Warm and relaxed.",
  "26SU201.DLL0168": "Deep berry solid. A bold evening color.",
  "26SU211.DBP323A": "Dark mulberry red solid. Striking for the holidays.",
  "26SU199.DLL0169": "Deep crimson solid. Confident for celebrations.",
  "26SU200.DLL0170": "Terracotta red-brown solid. Warm for fall.",
  "26SU235.DZZ0132": "Deep amethyst purple solid. Elegant at night.",
  "26SU241.DZZ0057": "Smoky plum solid. Moody and refined.",
  "26SU202.DBV3537": "Forest green solid. Rich for fall and winter.",
  "26SU177.DZZ0112": "Dark teal plaid. A standout check for cooler months.",
};
const FABRIC_WEAVE_TEXT = {
  "Solid": "Smooth, fine wool",
  "Herringbone": "Textured herringbone wool",
  "Plaid": "Soft wool in a classic check",
  "Pinstripe": "Crisp pinstripe wool",
};
function fabricDescription(pattern, colorGroup, hex) {
  const n = parseInt(String(hex || "#808080").replace("#", ""), 16);
  const lum = 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255);
  const rich = /burgundy|aubergine|plum|wine|green|teal|brown|cognac|rust|olive/i.test(colorGroup || "");
  let use;
  if (lum >= 150) use = "Light and fresh for spring and summer.";
  else if (lum >= 70) use = "Versatile for any season.";
  else if (rich) use = "A rich tone for fall and winter.";
  else use = "Year-round, from business to evening.";
  return (FABRIC_WEAVE_TEXT[pattern] || "Fine wool") + ". " + use;
}
const FABRIC_COLOR_FIRST = (function () {
  const lum = (hex) => {
    const n = parseInt(String(hex || "#808080").replace("#", ""), 16);
    return 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255);
  };
  const mean = (opts) => {
    const rgb = opts.reduce((acc, o) => {
      const n = parseInt(String(o.hex || "#808080").replace("#", ""), 16);
      acc[0] += (n >> 16) & 255; acc[1] += (n >> 8) & 255; acc[2] += n & 255; return acc;
    }, [0, 0, 0]).map((v) => Math.round(v / opts.length));
    return "#" + rgb.map((v) => v.toString(16).padStart(2, "0")).join("");
  };
  const byColor = {};
  FABRIC_PATTERN_TYPES.forEach((pt) => {
    pt.colorFamilies.forEach((fam) => {
      fam.options.forEach((o) => {
        const color = FABRIC_COLOR_ASSIGN[o.name] || fam.name.replace(/\s+Pattern$/i, "");
        if (!byColor[color]) byColor[color] = { name: color, patterns: [], all: [] };
        let bucket = byColor[color].patterns.find((b) => b.name === pt.name);
        if (!bucket) { bucket = { name: pt.name, img: FABRIC_TYPE_IMG[pt.name], options: [] }; byColor[color].patterns.push(bucket); }
        o.pattern = pt.name; // Solid / Plaid / Herringbone / Pinstripe -- shown when the fabric is selected
        o.description = FABRIC_DESCRIPTIONS[o.name] || fabricDescription(pt.name, color, o.hex); // short line shown under the grid once selected
        bucket.options.push(o); byColor[color].all.push(o);
      });
    });
  });
  const groups = [];
  FABRIC_PALETTE.forEach((p) => {
    // Palette colors with no fabrics yet still get a tile (shown as "Coming soon").
    const g = byColor[p.name] || { name: p.name, patterns: [], all: [], empty: true };
    g.patterns.forEach((b) => b.options.sort((a, c) => lum(a.hex) - lum(c.hex)));
    g.patterns.sort((a, b) => FABRIC_TYPE_ORDER.indexOf(a.name) - FABRIC_TYPE_ORDER.indexOf(b.name));
    g.swatchHex = p.hex || mean(g.all);
    groups.push(g);
    delete byColor[p.name];
  });
  // Safety net: any fabric whose color isn't in the palette still shows up.
  Object.keys(byColor).forEach((k) => { const g = byColor[k]; g.swatchHex = mean(g.all); groups.push(g); });
  return groups;
})();

// ---------------------------------------------------------------------
// Wires the thread color catalogs above onto both garments. Each of these
// four categories renders as the two-level "pick a color family, then a
// shade within it" picker (see createDesigner()'s colorFamilies branch in
// main.js) instead of the usual flat single grid.
// ---------------------------------------------------------------------
// Fabric is grouped into named color families the same way thread and
// button colors are (see BUTTON_COLOR_FAMILIES below) -- pick a color, then the
// specific fabric within it. Shared between jacket and pants, same pattern
// as THREAD_COLOR_FAMILIES.
JACKET_CATALOG.fabric = {
  label: "Fabric",
  column: "fabric",
  // Pattern-type-first browsing: pick a pattern (Solid/Pinstripe/
  // Herringbone/Plaid), then a color family within it, then a
  // shade -- see FABRIC_PATTERN_TYPES above and the patternTypes branch in
  // main.js's renderOptions(). cat.options stays the flat 429-item list
  // (via flattenPatternTypes) so every other lookup (buildRow,
  // getSelections, "Same as Jacket", resolveBestMatchOption) is unaffected.
  patternTypes: FABRIC_PATTERN_TYPES,
  colorFirst: FABRIC_COLOR_FIRST,
  options: flattenPatternTypes(FABRIC_PATTERN_TYPES),
};
PANTS_CATALOG.fabric = {
  label: "Fabric",
  column: "pants_fabric",
  patternTypes: FABRIC_PATTERN_TYPES,
  colorFirst: FABRIC_COLOR_FIRST,
  options: flattenPatternTypes(FABRIC_PATTERN_TYPES),
};

// ---------------------------------------------------------------------
// Lining -- jacket-only, same pattern-type-first browsing as Fabric above
// (pick Tonal Jacquard or Novelty Print, then a color/theme family, then a
// specific lining within it). See LINING_PATTERN_TYPES above.
// ---------------------------------------------------------------------
// Two extra top-level lining choices, shown ahead of the pattern types:
// - "Match Fabric": the factory picks a lining to go with the fabric (we don't
//   resolve it here).
// - "Upload Your Own Photo": the customer supplies their own lining image
//   (+$80 on that suit). `uploadPhoto` makes the picker open a file chooser
//   instead of the zoom view; `surchargeUsd` is added to that suit's price
//   (see itemPriceUsd in main.js).
const LINING_MATCH_OPTION = { name: "Match Fabric", img: "./assets/match-fabric-color-icon.jpg", matchesFabric: true };
const LINING_UPLOAD_OPTION = { name: "Customer's Own Photo", displayName: "Upload Your Own Photo (+$80)", img: "./assets/match-fabric-color-icon.jpg", uploadPhoto: true, surchargeUsd: 80 };
JACKET_CATALOG.lining = {
  label: "Lining",
  column: "jacket_lining",
  patternTypes: LINING_PATTERN_TYPES,
  specialOptions: [LINING_MATCH_OPTION, LINING_UPLOAD_OPTION],
  options: [LINING_MATCH_OPTION, LINING_UPLOAD_OPTION].concat(flattenPatternTypes(LINING_PATTERN_TYPES)),
};

JACKET_CATALOG.threadColor = {
  label: "Thread Color",
  column: "jacket_thread_color",
  colorFamilies: THREAD_COLOR_FAMILIES,
  specialOptions: [MATCH_FABRIC_COLOR_OPTION],
  options: [MATCH_FABRIC_COLOR_OPTION].concat(flattenColorFamilies(THREAD_COLOR_FAMILIES)),
};
JACKET_CATALOG.buttonholeThreadColor = {
  // Renamed from "Buttonhole Thread Color" (the pants one keeps that name).
  // chooseOtherColor: the first screen offers just two cards -- match the
  // fabric, or "Choose Other Color", which then opens the full color
  // families (see renderColorFamilyOptions in main.js). The stored values
  // and the column are unchanged.
  label: "Lapel Buttonhole Color",
  flatColorTiles: true, // one flat palette of color tiles, dark to light (see renderFlatColorTiles in main.js)
  chooseOtherColor: true,
  column: "jacket_buttonhole_thread_color",
  colorFamilies: BUTTONHOLE_THREAD_COLOR_FAMILIES,
  specialOptions: [MATCH_FABRIC_COLOR_OPTION],
  options: [MATCH_FABRIC_COLOR_OPTION].concat(flattenColorFamilies(BUTTONHOLE_THREAD_COLOR_FAMILIES)),
};
// Felt under collar: the hidden structural layer sewn beneath the outer
// collar fabric (not visible when worn) -- a plain style pick like Facing
// Style above, not a colorFamilies swatch picker, since the supplier's own
// spec sheet only shows named construction options with small diagram
// icons, not photographed color swatches. Icons cropped directly from that
// supplier PDF page ("Flet undercollar style" / codes C-0671/C-0672/C-0673).
// A 4th option (C-0679, "Reverse Side Of Selected Fabric") was on the same
// spec sheet but was dropped from this catalog at Daniel's request.
JACKET_CATALOG.feltundercollar = {
  label: "Felt Under Collar",
  column: "felt_under_collar",
  description: "The felt under collar is a hidden layer sewn beneath the outer collar fabric, on the underside against your shirt -- it's never visible when worn, but its material affects the collar's structure and cost.",
  options: [
    { name: "Match Felt Undercollar", img: "./assets/jacket-felt-new-match.jpg", badge: "Standard" },
    { name: "Customer-Appointed Felt", displayName: "Choose Your Felt", img: "./assets/jacket-felt-new-customer.jpg" },
  ],
};
// Felt color: the actual felt swatch choices, used when "Customer-Appointed
// Felt" is selected above -- a separate colorFamilies tab (like Thread/
// Button Color) rather than a nested picker, since the site's designer only
// supports flat top-level tabs. Swatches are supplier felt photos (codes
// prefixed AY/HPM), including a handful of striped/patterned felts among
// the mostly-solid colors -- classified/named the same way as any other
// swatch, by its dominant sampled color.
JACKET_CATALOG.feltColor = {
  label: "Felt Color",
  column: "felt_color",
  description: "The felt color used for a customer-appointed felt under collar.",
  colorFamilies: FELT_COLOR_FAMILIES,
  options: flattenColorFamilies(FELT_COLOR_FAMILIES),
  requiresEquals: { key: "feltundercollar", value: "Customer-Appointed Felt" },
};
JACKET_CATALOG.monogramThreadColor = {
  label: "Monogram Thread Color",
  column: "jacket_monogram_thread_color",
  colorFamilies: MONOGRAM_THREAD_COLOR_FAMILIES,
  options: flattenColorFamilies(MONOGRAM_THREAD_COLOR_FAMILIES),
  // Only offered/required when this garment's own Monogram Placement isn't
  // "No Monogram Need" -- see the isApplicable() gating in createDesigner().
  requiresOtherThan: { key: "monogram", value: "No Monogram Need" },
};
// Buttons are browsed by material first (Horn / Shell / Corozo /
// Polyester), then the specific button. The supplier code prefix says the
// material (both button books print it on every label: KNJ/KNG = Real
// Horn, KB = Shell, KG = Corozo, KSZ = Polyester, shown as "Classic").
// Within a material the buttons are grouped under color headings, dark to
// light, using BUTTON_COLOR_FAMILIES (which
// still holds each button's color family and stays the source of truth for
// names/images/hex). "Best Match to Fabric" lets the customer defer the
// exact pick to the shop instead of choosing one themselves.
const BUTTON_TYPE_ORDER = [
  { name: "Horn", prefixes: ["KNJ", "KNG"], representativeImg: "./assets/jacket-buttoncolor-knj014.jpg" },
  { name: "Shell", prefixes: ["KB"], representativeImg: "./assets/jacket-buttoncolor-kb113.jpg" },
  { name: "Corozo", prefixes: ["KG"], representativeImg: "./assets/jacket-buttoncolor-kg198.jpg" },
  // Polyester buttons are shown to customers as "Classic" (stored values
  // are the button codes, so the label is display-only).
  { name: "Classic", prefixes: ["KSZ"], representativeImg: "./assets/jacket-buttoncolor-ksz255.jpg" },
];
const BUTTON_COLOR_SORT = ["Black", "Navy", "Gray", "Blue", "Purple", "Brown", "Tortoiseshell", "Burgundy", "Red", "Tan", "Cream", "Pink", "White", "Multi-Color"];
const BUTTON_TYPES = BUTTON_TYPE_ORDER.map((t) => {
  const options = [];
  // Color heading for each button, shown above each color's run in the
  // type's grid (see colorSections in renderColorFamilyOptions, main.js).
  const colorSections = {};
  BUTTON_COLOR_SORT.concat(BUTTON_COLOR_FAMILIES.map((f) => f.name))
    .filter((name, i, all) => all.indexOf(name) === i)
    .forEach((famName) => {
      const fam = BUTTON_COLOR_FAMILIES.find((f) => f.name === famName);
      if (!fam) return;
      fam.options.forEach((o) => {
        const prefix = (o.name.match(/^[A-Z]+/) || [""])[0];
        if (t.prefixes.indexOf(prefix) === -1) return;
        options.push(o);
        colorSections[o.name] = { name: fam.name, hex: fam.swatchHex };
      });
    });
  return { name: t.name, representativeImg: t.representativeImg, options, colorSections };
});
JACKET_CATALOG.buttoncolor = {
  label: "Button Color",
  column: "button_color",
  colorFamilies: BUTTON_TYPES,
  // Wording for the family-picker UI, since these groups are materials
  // rather than colors (see renderColorFamilyOptions in main.js).
  familyCountNoun: "button",
  familyBackLabel: "All Button Types",
  familySpecLabel: "button",
  specialOptions: [BEST_MATCH_FABRIC_BUTTON_OPTION],
  options: [BEST_MATCH_FABRIC_BUTTON_OPTION].concat(flattenColorFamilies(BUTTON_COLOR_FAMILIES)),
};

PANTS_CATALOG.threadColor = {
  label: "Thread Color",
  column: "pants_thread_color",
  colorFamilies: THREAD_COLOR_FAMILIES,
  specialOptions: [MATCH_FABRIC_COLOR_OPTION],
  options: [MATCH_FABRIC_COLOR_OPTION].concat(flattenColorFamilies(THREAD_COLOR_FAMILIES)),
};
PANTS_CATALOG.buttonholeThreadColor = {
  label: "Buttonhole Thread Color",
  flatColorTiles: true,
  column: "pants_buttonhole_thread_color",
  colorFamilies: BUTTONHOLE_THREAD_COLOR_FAMILIES,
  specialOptions: [MATCH_FABRIC_COLOR_OPTION],
  options: [MATCH_FABRIC_COLOR_OPTION].concat(flattenColorFamilies(BUTTONHOLE_THREAD_COLOR_FAMILIES)),
};
PANTS_CATALOG.monogramThreadColor = {
  label: "Monogram Thread Color",
  column: "pants_monogram_thread_color",
  colorFamilies: MONOGRAM_THREAD_COLOR_FAMILIES,
  options: flattenColorFamilies(MONOGRAM_THREAD_COLOR_FAMILIES),
  requiresOtherThan: { key: "monogram", value: "No Monogram Need" },
};

// Thread Color sits right after Button Nail Method (Sleeves group on the
// jacket, Bottom & Details on pants). Buttonhole Thread Color is placed
// differently per garment: on the jacket it sits right after Lapel
// Buttonhole (Collar & Lapel group), since that's the buttonhole its thread
// actually sews; pants have no lapel/buttonhole style category to anchor
// to, so it stays alongside Thread Color in Bottom & Details there. Neither
// garment offers a Handmade Lapel Buttonhole Thread Color option anymore.
// Monogram Thread Color is the exception: it stays in Personalization,
// right after Monogram Placement, since it only ever applies once a real
// monogram is chosen.
JACKET_CATALOG_GROUPS.find((g) => g.label === "Personalization").keys.push("monogramThreadColor");
PANTS_CATALOG_GROUPS.find((g) => g.label === "Personalization").keys.push("monogramThreadColor");

// === FABRIC_ZOOM_MAP:BEGIN ===
// Auto-generated: maps each fabric's real supplier code to its
// high-resolution zoom tile's sprite sheet (AVIF, 1560x1560 per tile,
// packed 6x6 per sheet) + grid position. Regenerated for the 26SU10 Elite
// Wool fabric set (74 fabrics) -- see pack_sprites.py.
const FABRIC_ZOOM_TILE_SIZE = 1560;
const FABRIC_ZOOM_MAP = {
  "26SU173.DZZ0110": { sprite: "./assets/fabric-zoom-sprite-00.avif", col: 0, row: 0 },
  "26SU175.DGG1132": { sprite: "./assets/fabric-zoom-sprite-00.avif", col: 1, row: 0 },
  "26SU176.DGG1133": { sprite: "./assets/fabric-zoom-sprite-00.avif", col: 2, row: 0 },
  "26SU177.DZZ0112": { sprite: "./assets/fabric-zoom-sprite-00.avif", col: 3, row: 0 },
  "26SU178.DZZ0113": { sprite: "./assets/fabric-zoom-sprite-00.avif", col: 4, row: 0 },
  "26SU179.DZZ0114": { sprite: "./assets/fabric-zoom-sprite-00.avif", col: 5, row: 0 },
  "26SU180.DGG1117": { sprite: "./assets/fabric-zoom-sprite-00.avif", col: 0, row: 1 },
  "26SU181.DGG1118": { sprite: "./assets/fabric-zoom-sprite-00.avif", col: 1, row: 1 },
  "26SU182.DGG1119": { sprite: "./assets/fabric-zoom-sprite-00.avif", col: 2, row: 1 },
  "26SU183.DGG1120": { sprite: "./assets/fabric-zoom-sprite-00.avif", col: 3, row: 1 },
  "26SU184.DZZ0103": { sprite: "./assets/fabric-zoom-sprite-00.avif", col: 4, row: 1 },
  "26SU185.DZZ0105": { sprite: "./assets/fabric-zoom-sprite-00.avif", col: 5, row: 1 },
  "26SU186.DZZ0107": { sprite: "./assets/fabric-zoom-sprite-00.avif", col: 0, row: 2 },
  "26SU187.DZZ0108": { sprite: "./assets/fabric-zoom-sprite-00.avif", col: 1, row: 2 },
  "26SU188.DZZ0109": { sprite: "./assets/fabric-zoom-sprite-00.avif", col: 2, row: 2 },
  "26SU189.DPP0192": { sprite: "./assets/fabric-zoom-sprite-00.avif", col: 3, row: 2 },
  "26SU190.DPP0193": { sprite: "./assets/fabric-zoom-sprite-00.avif", col: 4, row: 2 },
  "26SU191.DZZ0101": { sprite: "./assets/fabric-zoom-sprite-00.avif", col: 5, row: 2 },
  "26SU192.DZZ0102": { sprite: "./assets/fabric-zoom-sprite-00.avif", col: 0, row: 3 },
  "26SU193.DZZ0098": { sprite: "./assets/fabric-zoom-sprite-00.avif", col: 1, row: 3 },
  "26SU194.DZZ0100": { sprite: "./assets/fabric-zoom-sprite-00.avif", col: 2, row: 3 },
  "26SU196.DLL0167": { sprite: "./assets/fabric-zoom-sprite-00.avif", col: 3, row: 3 },
  "26SU196.DLL0176": { sprite: "./assets/fabric-zoom-sprite-00.avif", col: 4, row: 3 },
  "26SU197.DLL0171": { sprite: "./assets/fabric-zoom-sprite-00.avif", col: 5, row: 3 },
  "26SU198.DLL0172": { sprite: "./assets/fabric-zoom-sprite-00.avif", col: 0, row: 4 },
  "26SU199.DLL0169": { sprite: "./assets/fabric-zoom-sprite-00.avif", col: 1, row: 4 },
  "26SU200.DLL0170": { sprite: "./assets/fabric-zoom-sprite-00.avif", col: 2, row: 4 },
  "26SU201.DLL0168": { sprite: "./assets/fabric-zoom-sprite-00.avif", col: 3, row: 4 },
  "26SU202.DBV3537": { sprite: "./assets/fabric-zoom-sprite-00.avif", col: 4, row: 4 },
  "26SU203.DLL0160": { sprite: "./assets/fabric-zoom-sprite-00.avif", col: 5, row: 4 },
  "26SU204.DPP0191": { sprite: "./assets/fabric-zoom-sprite-00.avif", col: 0, row: 5 },
  "26SU205.DLL0173": { sprite: "./assets/fabric-zoom-sprite-00.avif", col: 1, row: 5 },
  "26SU206.DLL0174": { sprite: "./assets/fabric-zoom-sprite-00.avif", col: 2, row: 5 },
  "26SU207.DLL0175": { sprite: "./assets/fabric-zoom-sprite-00.avif", col: 3, row: 5 },
  "26SU209.DLL0177": { sprite: "./assets/fabric-zoom-sprite-00.avif", col: 4, row: 5 },
  "26SU210.DBP325A": { sprite: "./assets/fabric-zoom-sprite-00.avif", col: 5, row: 5 },
  "26SU211.DBP323A": { sprite: "./assets/fabric-zoom-sprite-01.avif", col: 0, row: 0 },
  "26SU212.DBQ796A": { sprite: "./assets/fabric-zoom-sprite-01.avif", col: 1, row: 0 },
  "26SU213.DEE1018": { sprite: "./assets/fabric-zoom-sprite-01.avif", col: 2, row: 0 },
  "26SU214.DBV3534": { sprite: "./assets/fabric-zoom-sprite-01.avif", col: 3, row: 0 },
  "26SU215.DBV3535": { sprite: "./assets/fabric-zoom-sprite-01.avif", col: 4, row: 0 },
  "26SU216.DBV3531": { sprite: "./assets/fabric-zoom-sprite-01.avif", col: 5, row: 0 },
  "26SU217.DBV3530": { sprite: "./assets/fabric-zoom-sprite-01.avif", col: 0, row: 1 },
  "26SU218.DBV3529": { sprite: "./assets/fabric-zoom-sprite-01.avif", col: 1, row: 1 },
  "26SU219.DZZ0062": { sprite: "./assets/fabric-zoom-sprite-01.avif", col: 2, row: 1 },
  "26SU220.DZZ0064": { sprite: "./assets/fabric-zoom-sprite-01.avif", col: 3, row: 1 },
  "26SU221.DBV6499": { sprite: "./assets/fabric-zoom-sprite-01.avif", col: 4, row: 1 },
  "26SU222.DZZ0123": { sprite: "./assets/fabric-zoom-sprite-01.avif", col: 5, row: 1 },
  "26SU223.DZZ0125": { sprite: "./assets/fabric-zoom-sprite-01.avif", col: 0, row: 2 },
  "26SU224.DZZ0124": { sprite: "./assets/fabric-zoom-sprite-01.avif", col: 1, row: 2 },
  "26SU225.DBV6495": { sprite: "./assets/fabric-zoom-sprite-01.avif", col: 2, row: 2 },
  "26SU226.DBV6494": { sprite: "./assets/fabric-zoom-sprite-01.avif", col: 3, row: 2 },
  "26SU227.DZZ0126": { sprite: "./assets/fabric-zoom-sprite-01.avif", col: 4, row: 2 },
  "26SU228.DZZ0127": { sprite: "./assets/fabric-zoom-sprite-01.avif", col: 5, row: 2 },
  "26SU229.DZZ0128": { sprite: "./assets/fabric-zoom-sprite-01.avif", col: 0, row: 3 },
  "26SU230.DZZ0129": { sprite: "./assets/fabric-zoom-sprite-01.avif", col: 1, row: 3 },
  "26SU231.DZZ0130": { sprite: "./assets/fabric-zoom-sprite-01.avif", col: 2, row: 3 },
  "26SU232.DZZ0131": { sprite: "./assets/fabric-zoom-sprite-01.avif", col: 3, row: 3 },
  "26SU233.DZZ0060": { sprite: "./assets/fabric-zoom-sprite-01.avif", col: 4, row: 3 },
  "26SU234.DZZ0061": { sprite: "./assets/fabric-zoom-sprite-01.avif", col: 5, row: 3 },
  "26SU235.DZZ0132": { sprite: "./assets/fabric-zoom-sprite-01.avif", col: 0, row: 4 },
  "26SU236.DZZ0133": { sprite: "./assets/fabric-zoom-sprite-01.avif", col: 1, row: 4 },
  "26SU237.DZZ0134": { sprite: "./assets/fabric-zoom-sprite-01.avif", col: 2, row: 4 },
  "26SU238.DZZ0053": { sprite: "./assets/fabric-zoom-sprite-01.avif", col: 3, row: 4 },
  "26SU239.DZZ0055": { sprite: "./assets/fabric-zoom-sprite-01.avif", col: 4, row: 4 },
  "26SU240.DZZ0056": { sprite: "./assets/fabric-zoom-sprite-01.avif", col: 5, row: 4 },
  "26SU241.DZZ0057": { sprite: "./assets/fabric-zoom-sprite-01.avif", col: 0, row: 5 },
  "26SU242.DZZ0054": { sprite: "./assets/fabric-zoom-sprite-01.avif", col: 1, row: 5 },
  "26SU243.DZZ0070": { sprite: "./assets/fabric-zoom-sprite-01.avif", col: 2, row: 5 },
  "26SU244.DZZ0071": { sprite: "./assets/fabric-zoom-sprite-01.avif", col: 3, row: 5 },
  "26SU245.DZZ0072": { sprite: "./assets/fabric-zoom-sprite-01.avif", col: 4, row: 5 },
  "26SU246.DZZ0069": { sprite: "./assets/fabric-zoom-sprite-01.avif", col: 5, row: 5 },
  "26SU247.DZZ0073": { sprite: "./assets/fabric-zoom-sprite-02.avif", col: 0, row: 0 },
  "DAT9758.DZZ0099": { sprite: "./assets/fabric-zoom-sprite-02.avif", col: 1, row: 0 }
};
// === FABRIC_ZOOM_MAP:END ===

// === STEP TAGLINES:START ===
// One fun sentence per step, shown under each step's title in place of the
// plain "Choose one." hint (see tagline in main.js renderOptions).
const JACKET_STEP_TAGLINES = {
  collar: "Your lapels' big first impression.",
  lapelwidth: "How much lapel real estate you want.",
  lapelbuttonhole: "A tiny slit that's dying to hold a flower.",
  frontbutton: "How many buttons clock in for duty.",
  sleevecrown: "Where sleeve meets shoulder: smooth or a little swagger.",
  pockettype: "Home for your pocket square (or nothing, no judgment).",
  lowerpocket: "Hip pockets with personality.",
  buttonNail: "A stitch only you will know about.",
  construction: "What's hiding inside: light or hand-shaped canvas.",
  facing: "The inside edge that peeks out when you swing open.",
  insidepocket: "Secret pockets for pens, phones and snacks.",
  monogram: "Your initials, hidden where only hugs find them.",
  backvent: "The slit that lets you sit like a human.",
  sleevecuffstyle: "Wrist finish: working buttonholes or clean and sewn.",
  cuffbuttons: "Buttons on your cuff, noticed up close.",
  fabric: "The star of the show.",
  lining: "The secret fashion only you see.",
  threadColor: "Blend in with your fabric or make it pop.",
  buttonholeThreadColor: "Match the suit or flash a little color.",
  feltundercollar: "", // intentionally no one-liner
  feltColor: "A sneaky pop of color when you flip your collar.",
  monogramThreadColor: "Whisper tone-on-tone or shout in contrast.",
  buttoncolor: "The little finishing touch (sparkle optional)."
};
const PANTS_STEP_TAGLINES = {
  waistLineHeight: "Where your pants sit: standard or tall.",
  waistbandExtension: "The little tab that closes your waist in style.",
  waistbandStyle: "How your waist is built.",
  frontPleat: "Sleek flat-front or old-school swagger.",
  beltLoops: "Loops, fancy X's or no belt at all.",
  hookEye: "The tiny fastener above your zipper.",
  frontPocket: "Where your hands live.",
  bottomStyle: "Clean hem or folded-up cuff.",
  buttonNail: "A stitch only you will know about.",
  watchPocket: "A tiny pocket for a watch or a spare coin.",
  backWaistShape: "The back seam that helps pants hug your waist.",
  monogram: "Your initials, discreetly on your pants.",
  backPocket: "Your back pockets: buttons, flaps or none.",
  fabric: "Pick the cloth for your pants.",
  threadColor: "Blend in with your fabric or make it pop.",
  buttonholeThreadColor: "Match your pants or flash a little color.",
  monogramThreadColor: "Whisper tone-on-tone or shout in contrast."
};
Object.keys(JACKET_STEP_TAGLINES).forEach((k) => { if (JACKET_CATALOG[k]) JACKET_CATALOG[k].tagline = JACKET_STEP_TAGLINES[k]; });
Object.keys(PANTS_STEP_TAGLINES).forEach((k) => { if (PANTS_CATALOG[k]) PANTS_CATALOG[k].tagline = PANTS_STEP_TAGLINES[k]; });
// === STEP TAGLINES:END ===

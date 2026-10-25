const JACKET_CATALOG = {
  // Fabric (patternTypes-based, see FABRIC_PATTERN_TYPES) is wired in via
  // JACKET_CATALOG.fabric = {...} further down, once FABRIC_PATTERN_TYPES
  // and flattenColorFamilies() are both defined -- same pattern as
  // buttoncolor/threadColor below.
  collar: {
    label: "Lapel Style",
    column: "collar_style",
    // Trimmed to the lapel styles the shop offers: Notch, Semi-Notch, Peak,
    // Semi-Peak, Shawl and Diamond (drawings supplied by the shop). The other styles
    // (Narrow/Gorge notch, Curve Peak, the Shawl variants, Safari, Top
    // Collar) were removed on request -- they are saved in
    // catalog_BACKUP_before_lapel_cleanup_20261005.js.txt. The stored
    // names are unchanged, so older orders still read correctly.
    options: [
      { name: "Notch Lapel", factoryCode: "0001", img: "./assets/jacket-collar-new-notch.jpg",
        // Not offered on a double breasted jacket (Daniel, 2026-10-11). A
        // Notch picked earlier becomes Peak when the front turns double
        // breasted (see reconcileSelections() in main.js).
        hiddenWhen: { frontbutton: ["Double Breasted 6X2", "Double Breasted 4X2", "Double Breasted 6X3", "Double Breasted 4X1", "Double Breasted One Button", "Double Breasted 2X1", "Double Breasted 6X1"] },
        replaceWith: "Peak Lapel" },
      // Semi-notch and semi-peak added from Daniel's drawings (2026-10-24).
      // Semi-notch follows Notch: not offered double breasted, becomes
      // Semi-Peak there.
      { name: "Semi-Notch Lapel", factoryCode: "0003", img: "./assets/jacket-collar-new-seminotch.jpg",
        hiddenWhen: { frontbutton: ["Double Breasted 6X2", "Double Breasted 4X2", "Double Breasted 6X3", "Double Breasted 4X1", "Double Breasted One Button", "Double Breasted 2X1", "Double Breasted 6X1"] },
        replaceWith: "Semi-Peak Lapel" },
      { name: "Peak Lapel", factoryCode: "0002", img: "./assets/jacket-collar-new-peak.jpg" },
      { name: "Semi-Peak Lapel", factoryCode: "0004", img: "./assets/jacket-collar-new-semipeak.jpg" },
      { name: "Shawl", displayName: "Shawl Collar", specName: "Shawl", factoryCode: "0005", img: "./assets/jacket-collar-new-shawl.jpg" },
      { name: "Diamond Lapel", factoryCode: "001R", img: "./assets/jacket-collar-new-diamond.jpg" },
    ],
  },
  lapelwidth: {
    label: "Lapel Width",
    column: "lapel_width",
    // Four simple choices for the customer. The stored value stays the real
    // measurement (e.g. "9 cm") so the printed Client Form / production
    // sheet still tells the shop exactly what to cut; displayName is only
    // what the customer sees. (8.5, 9.5 and 10.5 cm were removed.)
    // A Diamond Lapel comes only in 8 cm: the factory's Place Order refuses
    // 00N5 with collar 001R and its site offers only 8.0cm (Daniel,
    // 2026-10-25). The step is skipped and set to 8 cm (fixedBySelection,
    // see reconcileSelections() in main.js).
    allowedBySelection: {
      collar: {
        "Diamond Lapel": ["8 cm"],
      },
    },
    fixedBySelection: {
      collar: {
        "Diamond Lapel": "8 cm",
      },
    },
    options: [
      { name: "9 cm", displayName: "Standard", factoryCode: "00N5", img: "./assets/jacket-lapelwidth-new-9.jpg" },
      { name: "8 cm", displayName: "Thin", factoryCode: "00X6", img: "./assets/jacket-lapelwidth-new-8.jpg" },
      { name: "10 cm", displayName: "Wide", factoryCode: "00N0", img: "./assets/jacket-lapelwidth-new-10.jpg" },
      { name: "11 cm", displayName: "Extra Wide", factoryCode: "00S2", img: "./assets/jacket-lapelwidth-new-11.jpg" },
    ],
  },
  lapelbuttonhole: {
    label: "Lapel Buttonhole",
    column: "lapel_buttonhole",
    // A Shawl or Diamond Lapel takes no lapel buttonhole at all: the factory
    // refuses Shawl 0005 and Diamond collar 001R with Left bttn hole 0541
    // (test drafts, 2026-10-25). Notch and Peak keep the full list (see
    // allowedOptions() in main.js).
    allowedBySelection: {
      collar: {
        "Shawl": ["No Lapel Buttonhole"],
        "Diamond Lapel": ["No Lapel Buttonhole"],
      },
    },
    // Exactly the factory's (Kutetailor) Jacket > Hole Position choices, in
    // its order (Daniel, 2026-10-20). factoryCode is the factory's option
    // code, printed on the order form. Stored names are kept from the older,
    // longer list so saved designs still resolve.
    options: [
      { name: "No Lapel Buttonhole", displayName: "No Buttonhole", specName: "No Lapel Buttonhole", factoryCode: "0544", img: "./assets/jacket-lapelbuttonhole-none.jpg",
        // Shows the shawl drawing (no buttonhole) when the collar is Shawl or Diamond.
        imgBySelection: { collar: { "Shawl": "./assets/jacket-lapelbuttonhole-new-none-shawl.jpg", "Diamond Lapel": "./assets/jacket-lapelbuttonhole-new-none-shawl.jpg" } } },
      { name: "Standard", displayName: "One on Left Lapel", specName: "Left Buttonhole", factoryCode: "0541", formNote: "1 buttonhole on left lapel", img: "./assets/jacket-lapelbuttonhole-left.jpg",
        imgBySelection: { collar: { "Shawl": "./assets/jacket-lapelbuttonhole-shawl-diamond-only.jpg", "Diamond Lapel": "./assets/jacket-lapelbuttonhole-shawl-diamond-only.jpg" } } },
      { name: "Left Two", displayName: "Two on Left Lapel", specName: "Double Left Buttonhole", factoryCode: "0545", formNote: "2 buttonholes on left lapel", img: "./assets/jacket-lapelbuttonhole-left-two.jpg" },
      { name: "Right & Left", displayName: "One on Each Lapel", specName: "Right & Left Buttonhole", factoryCode: "0543", formNote: "1 buttonhole on each lapel", img: "./assets/jacket-lapelbuttonhole-right-left.jpg" },
    ],
  },
  frontbutton: {
    label: "Front Buttons",
    // The suit picture generator still knows this step by its old name.
    specLabel: "Front Button",
    column: "front_button_request",
    options: [
      { section: "Single Breasted", name: "Single Breasted One Button", displayName: "Single Breasted, 1 Button", specName: "Single Breasted One Button", factoryCode: "0011", img: "./assets/jacket-frontbutton-new-sb1b.jpg" },
      { section: "Single Breasted", name: "Single Breasted Two Buttons", displayName: "Single Breasted, 2 Buttons", specName: "Single Breasted Two Buttons", factoryCode: "0012", img: "./assets/jacket-frontbutton-new-sb2b.jpg" },
      { section: "Single Breasted", name: "Single Breasted Three Buttons", displayName: "Single Breasted, 3 Buttons", specName: "Single Breasted Three Buttons", factoryCode: "0013", img: "./assets/jacket-frontbutton-new-sb3b.jpg" },
      { section: "Double Breasted", name: "Double Breasted 6X2", displayName: "Double Breasted, 6 Buttons (2 Fasten)", specName: "Double Breasted 6X2", factoryCode: "0016", badge: "Standard", img: "./assets/jacket-frontbutton-new-db6x2.jpg" },
      { section: "Double Breasted", name: "Double Breasted 4X2", displayName: "Double Breasted, 4 Buttons (2 Fasten)", specName: "Double Breasted 4X2", factoryCode: "0015", img: "./assets/jacket-frontbutton-new-db4x2.jpg" },
      { section: "Double Breasted", name: "Double Breasted 6X3", displayName: "Double Breasted, 6 Buttons (3 Fasten)", specName: "Double Breasted 6X3", factoryCode: "0019", img: "./assets/jacket-frontbutton-new-db6x3.jpg" },
      { section: "Double Breasted", name: "Double Breasted 4X1", displayName: "Double Breasted, 4 Buttons (1 Fastens)", specName: "Double Breasted 4X1", factoryCode: "0017", img: "./assets/jacket-frontbutton-new-db4x1.jpg" },
      { section: "Double Breasted", name: "Double Breasted One Button", displayName: "Double Breasted, 1 Button", specName: "Double Breasted One Button", img: "./assets/jacket-frontbutton-new-db1b.jpg" },
      { section: "Double Breasted", name: "Double Breasted 2X1", displayName: "Double Breasted, 2 Buttons (1 Fastens)", specName: "Double Breasted 2X1", factoryCode: "002F", img: "./assets/jacket-frontbutton-new-db2x1.jpg" },
      { section: "Double Breasted", name: "Double Breasted 6X1", displayName: "Double Breasted, 6 Buttons (1 Fastens)", specName: "Double Breasted 6X1", factoryCode: "0018", img: "./assets/jacket-frontbutton-new-db6x1.jpg" },
    ],
  },
  sleevecrown: {
    label: "Shoulder Style",
    // The suit picture generator still knows this step by its old name.
    specLabel: "Top Sleeve Crown Type",
    column: "sleeve_crown_type",
    options: [
      { name: "Regular Armhole", displayName: "Regular Shoulder", specName: "Regular Armhole", factoryCode: "0601", img: "./assets/jacket-sleevecrown-regulararmhole.jpg", badge: "Standard" },
      { name: "Naples Sleeve", displayName: "Gathered Shoulder (Neapolitan)", specName: "Naples Sleeve", factoryCode: "060N", img: "./assets/jacket-sleevecrown-naplessleeve.jpg" },
      { name: "Close Seam Sleeve", displayName: "Topstitched Shoulder", specName: "Close Seam Sleeve", factoryCode: "0603", img: "./assets/jacket-sleevecrown-closeseam.jpg" },
    ],
  },
  pockettype: {
    label: "Chest Pocket",
    column: "pocket_type",
    options: [
      { name: "Normal Pocket", displayName: "Classic Welt Pocket", specName: "Normal Pocket", factoryCode: "0101", img: "./assets/jacket-pockettype-new-normal.jpg" },
      { name: "Boat Shape Pocket", displayName: "Curved Welt Pocket", specName: "Boat Shape Pocket", factoryCode: "0103", img: "./assets/jacket-pockettype-new-boatshape.jpg" },
      { name: "Double Besom Pocket", displayName: "Slit Pocket", specName: "Besom Pocket", factoryCode: "0110", img: "./assets/jacket-pockettype-new-doublebesom.jpg" },
      { name: "Patch Pocket No Flap", displayName: "Patch Pocket (Sewn On)", specName: "Patch Pocket No Flap", factoryCode: "0150",
        // The factory refuses a chest patch pocket on these fronts (test drafts, 2026-10-25).
        hiddenWhen: { frontbutton: ["Double Breasted 6X2", "Double Breasted 6X3", "Double Breasted 6X1"] }, img: "./assets/jacket-pockettype-new-patchnoflap.jpg" },
      { name: "No Pocket", displayName: "No Chest Pocket", specName: "No Pocket", factoryCode: "0100", img: "./assets/jacket-pockettype-new-nohandkerchief.jpg" },
    ],
  },
  lowerpocket: {
    label: "Lower Pockets",
    column: "lower_pocket",
    // Options grouped under small headings (Besom / Welt / Slant Besom / Flap /
    // Slant Flap / Diamond Flap / Patch / High-Back Patch / No Pockets); within a family the
    // rows read plain -> + besom ticket pocket -> + flap ticket pocket. Single besom
    // options were removed (Daniel, 2026-10-21); "Double Besom" is shown as "Besom".
    // factoryCode is two factory codes: lower pocket, then ticket pocket (027H = none).
    options: [
      { section: "Slit", name: "Double Besom Pocket", displayName: "Slit Pockets", specName: "Besom Pocket", factoryCode: "0231,027H", img: "./assets/jacket-lowerpocket-new-db.jpg" },
      { section: "Slit", name: "Double Besom Pocket + Double Besom Ticket Pocket", displayName: "Slit Pockets + Small Slit Pocket", specName: "Besom + Besom Ticket", factoryCode: "0231,027A", img: "./assets/jacket-lowerpocket-new-dbdbt.jpg" },
      { section: "Welt", name: "Flat Welt Pocket", displayName: "Welt Pockets", specName: "Flat Welt Pocket", factoryCode: "0267,027H", img: "./assets/jacket-lowerpocket-new-flatwelt-v2.jpg" },
      { section: "Slanted Slit", name: "Double Besom Slant Pocket", displayName: "Slanted Slit Pockets", specName: "Besom Slant Pocket", factoryCode: "02B6,027H", img: "./assets/jacket-lowerpocket-new-dbslant.jpg" },
      { section: "Flap", name: "Double Besom W/ Flap", displayName: "Flap Pockets", factoryCode: "0201,027H", img: "./assets/jacket-lowerpocket-new-dbwflap.jpg" },
      { section: "Flap", name: "Double Besom W/ Flap And Double Besom Ticket Pocket", displayName: "Flap Pockets + Small Slit Pocket", specName: "Flap Pockets + Besom Ticket", factoryCode: "0201,027A", img: "./assets/jacket-lowerpocket-new-dbwflapdbt.jpg" },
      { section: "Flap", name: "Double Besom W/ Flap And Ticket Pocket W/ Flap", displayName: "Flap Pockets + Small Flap Pocket", specName: "Flap Pockets + Flap Ticket Pocket", factoryCode: "0201,0270", img: "./assets/jacket-lowerpocket-new-flapft.jpg" },
      { section: "Slanted Flap", name: "Slant Pocket Flap", displayName: "Slanted Flap Pockets", specName: "Slant Flap Pocket", factoryCode: "02A1,027H", img: "./assets/jacket-lowerpocket-new-slantflap.jpg" },
      { section: "Slanted Flap", name: "Slant Pocket Flap + Double Besom Ticket Pocket", displayName: "Slanted Flap Pockets + Small Slit Pocket", specName: "Slant Flap + Besom Ticket", factoryCode: "02A1,02R4", img: "./assets/jacket-lowerpocket-new-slantflapdbt.jpg" },
      { section: "Slanted Flap", name: "Slant Pocket Flap + Double Besom W/ Flat Ticket Pocket", displayName: "Slanted Flap Pockets + Small Flap Pocket", specName: "Slant Flap + Flap Ticket Pocket", factoryCode: "02A1,02A2", img: "./assets/jacket-lowerpocket-new-slantflapft.jpg" },
      { section: "Pointed Flap", name: "Diamond Flap", displayName: "Pointed Flap Pockets", specName: "Diamond Flap", factoryCode: "0237,027H", img: "./assets/jacket-lowerpocket-new-diamondflap-v2.jpg" },
      { section: "Pointed Flap", name: "Diamond Flap With Buttons", displayName: "Pointed Flap Pockets With Buttons", specName: "Diamond Flap With Buttons", factoryCode: "0211,027H", img: "./assets/jacket-lowerpocket-new-diamondflapbtn-v2.jpg" },
      { section: "Patch", name: "Patch Pocket", displayName: "Patch Pockets", specName: "Patch Pocket", factoryCode: "02J1,027H", img: "./assets/jacket-lowerpocket-new-patch.jpg" },
      { section: "Patch", name: "Patch Pocket + Double Besom Ticket Pocket", displayName: "Patch Pockets + Small Slit Pocket", specName: "Patch Pocket + Besom Ticket", factoryCode: "02J1,027A", img: "./assets/jacket-lowerpocket-new-patchdbt.jpg" },
      { section: "Sloped Patch", name: "Patch Pocket With Highly Back", displayName: "Sloped Patch Pockets", specName: "High-Back Patch Pocket", factoryCode: "02J0,027H", img: "./assets/jacket-lowerpocket-new-patchhighback.jpg" },
      { section: "Sloped Patch", name: "Patch Pocket With Highly Back + Double Besom Ticket", displayName: "Sloped Patch Pockets + Small Slit Pocket", specName: "High-Back Patch + Besom Ticket", factoryCode: "02J0,027A", img: "./assets/jacket-lowerpocket-new-patchhighbackdbt.jpg" },
      { section: "No Pockets", name: "No Front Pocket", displayName: "No Lower Pockets", specName: "No Front Pocket", factoryCode: "0200,027H", img: "./assets/jacket-lowerpocket-new-nofront.jpg" },
    ],
  },
  buttonNail: {
    label: "Button Stitching",
    // The suit picture generator still knows this step by its old name.
    specLabel: "Button Nail Method",
    column: "jacket_button_nail_method",
    options: [
      { name: "X Shape Sewing Button", displayName: "X Stitch", specName: "X Shape Sewing", factoryCode: "0644", img: "./assets/buttonnail-new-x.jpg" },
      { name: "II Shape Sewing Button", displayName: "Parallel Stitch", specName: "Parallel Sewing", factoryCode: "0643", img: "./assets/buttonnail-new-parallel.jpg" },
      { name: "Square Shape Sewing Button", displayName: "Square Stitch", specName: "Square Sewing", factoryCode: "0646", img: "./assets/buttonnail-square-sewing.jpg" },
    ],
  },
  construction: {
    label: "Construction",
    column: "jacket_construction",
    description: "What's inside the front of your jacket that gives it shape. Fused: a light inner layer bonded to the cloth, crisp and easy to care for. Full canvas: a sewn-in canvas layer that shapes to your chest over time. Unconstructed: no inner layer, soft and relaxed.",
    options: [
      // The factory only makes an unlined jacket unconstructed (Daniel,
      // 2026-10-21): picking "No Lining Construction" moves fused or full
      // canvas to Unconstructed.
      { name: "Fused Construction", displayName: "Fused", specName: "Fused Construction", factoryCode: "00C1", img: "./assets/jacket-construction-new-fused-v2.jpg", badge: "Standard", hiddenWhen: { facing: ["No Lining Construction"] }, replaceWith: "Unconstructed" },
      { name: "Full Canvas Construction", displayName: "Full Canvas (+$200)", specName: "Full Canvas Construction (+$200)", surchargeUsd: 200, factoryCode: "000A", img: "./assets/jacket-construction-new-canvas-v2.jpg", hiddenWhen: { facing: ["No Lining Construction"] }, replaceWith: "Unconstructed" },
      { name: "Unconstructed", displayName: "Unconstructed (Soft)", specName: "Unconstructed", factoryCode: "00D1", img: "./assets/jacket-construction-new-unconstructed-v2.jpg" },
    ],
  },
  facing: {
    label: "Lining Style",
    // The suit picture generator still knows this step by its old name.
    specLabel: "Facing Style",
    column: "facing_style",
    // Shown on the options page as a brief explainer -- most customers
    // won't know this tailoring term on sight the way they might "collar"
    // or "pocket".
    description: "How much of the inside of your jacket is lined.",
    // Options taken off the designer. A draft saved while one of these was
    // picked has it cleared on reload (see reconcileSelections in main.js)
    // so the customer is asked again instead of ordering a retired style.
    retiredOptions: [
      "Small Round Facing",
      "Arrow Shape Facing W/ Normal Inside Pocket + Cigarette Pocket",
      "No Lining Light Construction W/ Piping Seam",
      // The factory refuses every no-lining order ("You do not have a
      // specified process": inner facing F 0866/0706), test drafts 2026-10-25.
      "No Lining Construction",
    ],
    options: [
      { name: "Round Shape Facing", displayName: "Full Lining", specName: "Round Shape Facing", factoryCode: "0702", img: "./assets/jacket-facing-new-round.jpg", badge: "Standard" },
      { name: "Half Lining W/ Fabric Facing", displayName: "Half Lining", specName: "Half Lining W/ Fabric Facing", img: "./assets/jacket-facing-new-halflwfabric.jpg" },
    ],
  },
  insidepocket: {
    label: "Inside Pockets",
    // The suit picture generator still knows this step by its old name.
    specLabel: "Inside Pocket Style",
    column: "inside_pocket_style",
    // The factory's basic inner pocket shapes only (Daniel, 2026-10-21).
    // A draft saved with an older style is asked again.
    retiredOptions: [
      "Normal Inside Pocket W/ Pen Pocket",
      "Normal Inside Pocket W/ Water Drop Pen Pocket",
      "Normal Inside Pocket W/ Pen Pocket + Cigarette Pocket",
    ],
    options: [
      { name: "Regular Inner Pocket", displayName: "Standard Inside Pockets", specName: "Regular Inner Pocket", factoryCode: "0801", img: "./assets/jacket-insidepocket-factory-regular.jpg", badge: "Standard" },
      { name: "Fashion Inner Pocket", displayName: "Extra Lower Pocket", specName: "Fashion Inner Pocket", factoryCode: "0803", img: "./assets/jacket-insidepocket-factory-fashion.jpg" },
      { name: "Combination Inner Pocket", displayName: "Extra Pen Pockets", specName: "Combination Inner Pocket", factoryCode: "080X", img: "./assets/jacket-insidepocket-factory-combination.jpg" },
      { name: "No Inner Pockets", displayName: "No Inside Pockets", specName: "No Inner Pockets", factoryCode: "0806", img: "./assets/jacket-insidepocket-factory-none.jpg" },
    ],
  },

  monogram: {
    label: "Monogram Placement",
    column: "jacket_monogram_placement",
    // A "type your monogram" box shown above the placement cards (see
    // textInput handling in createDesigner, main.js); required once any
    // placement other than skipWhen is chosen.
    textInput: { label: "Your monogram", placeholder: "Type your monogram (initials or name)", hint: "Up to 24 characters; capital letters count as 2. For two lines, put (/) between them, e.g. Beijing(/)China.", maxLength: 24, skipWhen: "No Monogram Need" },
    options: [
      { name: "No Monogram Need", displayName: "No Monogram", img: "./assets/jacket-monogram-new-nomonogram.jpg" },
      { name: "On Left Inside Pocket", displayName: "Left Inside Pocket", hiddenWhen: { insidepocket: ["No Inner Pockets"] }, img: "./assets/jacket-monogram-new-onleftinsidepkt.jpg" },
      { name: "On Right Inside Pocket", displayName: "Right Inside Pocket", hiddenWhen: { insidepocket: ["No Inner Pockets"] }, img: "./assets/jacket-monogram-new-onrightinsidepkt.jpg" },
      { name: "On Right Inside Pocket, Monogram On Satin", displayName: "Name Label, Left Inner Pocket", specName: "Inside Pocket Satin Tape", hiddenWhen: { insidepocket: ["No Inner Pockets"] }, img: "./assets/jacket-monogram-new-leftnamelabel.jpg" },
      { name: "Monogram On Middle Under Collar", displayName: "Under the Collar", specName: "Middle Under Collar", img: "./assets/jacket-monogram-new-middlecollar.jpg" },
    ],
  },
  backvent: {
    label: "Back Vents",
    column: "back_vents",
    options: [
      { name: "Side Vent", displayName: "Two Side Vents", specName: "Side Vent", factoryCode: "04N2", img: "./assets/jacket-backvent-new-side.jpg" },
      { name: "Center Vent", displayName: "One Center Vent", specName: "Center Vent", factoryCode: "04N1", img: "./assets/jacket-backvent-new-center.jpg" },
      { name: "No Vent", displayName: "No Vents", specName: "No Vent", factoryCode: "04N0", img: "./assets/jacket-backvent-new-no.jpg" },
    ],
  },
  sleevecuffstyle: {
    label: "Sleeve Buttonholes",
    // The suit picture generator still knows this step by its old name.
    specLabel: "Sleeve Cuff Styles",
    column: "sleeve_cuff_style",
    options: [
      { name: "Working Sleeve Cuff", displayName: "Working Buttonholes", specName: "Opening Sleeve Cuff", img: "./assets/jacket-sleevecuffstyle-new-working.jpg" },
      { name: "Imitation Button Hole On Sleeve Cuff", displayName: "Decorative Buttonholes (Sewn Shut)", specName: "Imitation Buttonhole Sleeve Cuff", img: "./assets/jacket-sleevecuffstyle-new-imitation.jpg" },
    ],
  },
  cuffbuttons: {
    label: "Sleeve Buttons",
    // The suit picture generator still knows this step by its old name.
    specLabel: "Buttons On Sleeve Cuff",
    column: "sleeve_cuff_buttons",
    compactCards: true,  // smaller picture cards (more per row) -- 13 options

    options: [
      { section: "Spaced", name: "3 Flat Button", displayName: "3 Buttons, Spaced", specName: "3 Flat Button", img: "./assets/jacket-cuffbuttons-new-flat3.jpg" },
      { section: "Spaced", name: "4 Flat Button", displayName: "4 Buttons, Spaced", specName: "4 Flat Button", img: "./assets/jacket-cuffbuttons-new-flat4.jpg" },
      { section: "Spaced", name: "5 Flat Button", displayName: "5 Buttons, Spaced", specName: "5 Flat Button", img: "./assets/jacket-cuffbuttons-new-flat5.jpg" },
      { section: "Overlapping", name: "4 Overlap Button", displayName: "4 Buttons, Overlapping", specName: "4 Overlap Button", img: "./assets/jacket-cuffbuttons-new-overlap4.jpg" },
      { section: "Overlapping", name: "5 Overlap Button", displayName: "5 Buttons, Overlapping", specName: "5 Overlap Button", img: "./assets/jacket-cuffbuttons-new-overlap5.jpg" },
      { section: "Overlapping", name: "6 Overlap Button", displayName: "6 Buttons, Overlapping", specName: "6 Overlap Button", img: "./assets/jacket-cuffbuttons-new-overlap6.jpg" },
      { section: "Spaced & Slanted", name: "4 Slant Button", displayName: "4 Buttons, Spaced & Slanted", specName: "4 Slant Flat Button", img: "./assets/jacket-cuffbuttons-new-slant4.jpg" },
      { section: "Spaced & Slanted", name: "5 Slant Button", displayName: "5 Buttons, Spaced & Slanted", specName: "5 Slant Flat Button", img: "./assets/jacket-cuffbuttons-new-slant5.jpg" },
      { section: "Overlapping & Slanted", name: "4 Slant Overlap Button", displayName: "4 Buttons, Overlapping & Slanted", specName: "4 Slant Overlap Button", img: "./assets/jacket-cuffbuttons-new-slantoverlap4.jpg" },
      { section: "Overlapping & Slanted", name: "5 Slant Overlap Button", displayName: "5 Buttons, Overlapping & Slanted", specName: "5 Slant Overlap Button", img: "./assets/jacket-cuffbuttons-new-slantoverlap5.jpg" },
      { section: "Overlapping & Slanted", name: "6 Slant Overlap Button", displayName: "6 Buttons, Overlapping & Slanted", specName: "6 Slant Overlap Button", img: "./assets/jacket-cuffbuttons-new-slantoverlap6.jpg" },
      { section: "No Buttons", name: "Button Less Sleeve (4 Buttons)", displayName: "No Buttons (4 Buttonholes Only)", specName: "Button Less Sleeve (4 Buttons)", img: "./assets/jacket-cuffbuttons-new-less.jpg" },
    ],
  },
};

// Groups the jacket's 15 option categories into a handful of labeled
// sections (Fabric, Collar & Lapel, and so on) instead of one long flat list
// of tabs -- the categories themselves and their order inside each group are
// unchanged, this just clusters related ones under a heading so the tab list
// reads as organized rather than a wall of options. Every JACKET_CATALOG key
// must appear in exactly one group here, in the order it should be offered.
// Pick stitching: a row of small hand-look stitches 0.6 cm in from the
// edge, in thread matching the fabric. Daniel offers only the classic 0.6 cm
// width; the customer picks where it goes (2026-10-21).
JACKET_CATALOG.pickStitch = {
  label: "Pick Stitching",
  column: "jacket_pick_stitch",
  description: "Pick stitching is a row of small stitches just inside the edges, a classic hand-tailored detail.",
  options: [
    { name: "No Pick Stitching", displayName: "None", factoryCode: "0570", img: "./assets/jacket-pickstitch-none.jpg?v=2", badge: "Standard" },
    // The factory refuses these with some pockets (test drafts, 2026-10-25),
    // so they're hidden after those pockets are picked.
    { name: "Pick Stitch Edges", displayName: "Lapels & Edges", factoryCode: "0576", img: "./assets/jacket-pickstitch-edges.jpg?v=2",
      hiddenWhen: {
        pockettype: ["No Pocket"],
        lowerpocket: ["Double Besom Pocket", "Double Besom Pocket + Double Besom Ticket Pocket", "Double Besom Slant Pocket", "Patch Pocket", "Patch Pocket + Double Besom Ticket Pocket", "No Front Pocket"],
      } },
    { name: "Pick Stitch All Seams", displayName: "Lapels, Edges & Seams", factoryCode: "0577", img: "./assets/jacket-pickstitch-seams.jpg?v=2", hiddenWhen: { pockettype: ["No Pocket"] } },
  ],
};

const JACKET_CATALOG_GROUPS = [
  { label: "Fabric", keys: ["fabric"] },
  { label: "Shape & Lapel", keys: ["frontbutton", "collar", "lapelwidth"] },
  { label: "Pockets & Vents", keys: ["pockettype", "lowerpocket", "backvent"] },
  { label: "Sleeves", keys: ["sleevecuffstyle", "cuffbuttons"] },
  { label: "Buttons, Lining & Details", keys: ["buttoncolor", "lining", "lapelbuttonhole", "buttonholeThreadColor", "frontButtonholeThreadColor", "feltundercollar", "feltColor", "threadColor", "pickStitch", "buttonNail", "insidepocket"] },
  { label: "Personalization", keys: ["monogram"] },
  // Technical tailoring questions go last so they don't slow down the
  // visible style choices above.
  { label: "Tailor's Details", keys: ["construction", "facing", "sleevecrown"] },
];

const PANTS_CATALOG = {
  // Fabric wired in below via PANTS_CATALOG.fabric = {...}, same as jacket.
  waistLineHeight: {
    label: "Waistband Height",
    // The suit picture generator still knows this step by its old name.
    specLabel: "Waist Line Height",
    column: "waist_line_height",
    options: [
      // The factory's waist widths (Daniel, 2026-10-21): Standard 4.0 cm,
      // Tall 5.0 cm. Customers see Standard / Tall.
      { name: "4.0 cm", displayName: "Standard", factoryCode: "301D", img: "./assets/pants-waist-new-standard.jpg" },
      { name: "5.0 cm", displayName: "Tall", factoryCode: "301F", img: "./assets/pants-waist-new-tall.jpg" },
    ],
  },
  waistbandExtension: {
    label: "Waistband Closure Tab",
    // The suit picture generator still knows this step by its old name.
    specLabel: "Waistband Extension Style",
    column: "waistband_extension_style",
    compactCards: true,  // smaller picture cards (3 per row on phone)
    // The square tabs are hidden on the tall waistband: the factory refuses
    // 342A and 3417 with 5.0cm 301F (test drafts, 2026-10-25).
    options: [
      { section: "Rounded", name: "Round Shape 5cm", factoryCode: "3413", displayName: "Rounded Tab", specName: "Round Shape", img: "./assets/pants-wext-new-round.jpg" },
      { section: "Rounded", name: "Round Shape 5cm (No Button/Hole)", factoryCode: "342R", displayName: "Rounded Tab, No Visible Button", specName: "Round Shape (No Button/Hole)", img: "./assets/pants-wext-new-round-nobh.jpg" },
      { section: "Rounded", name: "Long Round Shape", displayName: "Long Rounded Tab", specName: "Long Round Shape", factoryCode: "3415", img: "./assets/pants-wext-new-longround.jpg" },
      { section: "Pointed", name: "Arrow Shape 5cm", factoryCode: "3412", displayName: "Pointed Tab", specName: "Arrow Shape", img: "./assets/pants-wext-new-arrow.jpg" },
      { section: "Pointed", name: "Arrow Shape 5cm (No Button/Hole)", factoryCode: "342T", displayName: "Pointed Tab, No Visible Button", specName: "Arrow Shape (No Button/Hole)", img: "./assets/pants-wext-new-arrow-nobh.jpg" },
      { section: "Square", name: "Square Shape 5cm", factoryCode: "342A", hiddenWhen: { waistLineHeight: ["5.0 cm"] }, displayName: "Square Tab", specName: "Square Shape", img: "./assets/pants-wext-new-square.jpg" },
      { section: "Square", name: "Square Shape 5cm (No Button/Hole)", factoryCode: "3414", displayName: "Square Tab, No Visible Button", specName: "Square Shape (No Button/Hole)", img: "./assets/pants-wext-new-square-nobh.jpg" },
      { section: "Square", name: "Square Waistband (No Button/Hole)", factoryCode: "3410", displayName: "No Tab (Meets at Center)", specName: "Square Waistband Centered", formNote: "Centered over zipper", img: "./assets/pants-wext-new-squarewb-nobh.jpg" },
      { section: "Square", name: "Square Shape W/ Long Extension", hiddenWhen: { waistLineHeight: ["5.0 cm"] }, displayName: "Long Square Tab", specName: "Square Shape W/ Long Extension", factoryCode: "3417", img: "./assets/pants-wext-new-square-longext.jpg" },
    ],
  },
  waistbandStyle: {
    label: "Waistband Adjusters",
    // The suit picture generator still knows this step by its old name.
    specLabel: "Waistband Style",
    column: "waistband_style",
    // The two buckle styles (factory 3352, 33TG) go to the factory with the
    // buckle written after the code (kute-factory order.ts adds it).
    options: [
      { name: "Normal Waistband", displayName: "No Adjusters (Plain Waistband)", specName: "Normal Waistband", factoryCode: "3349", img: "./assets/pants-wstyle-new-normal.jpg" },
      { name: "Elastic Waistband On Side Buttons", displayName: "Side Button Tabs", specName: "Elastic Waistband On Side Buttons", factoryCode: "3351", img: "./assets/pants-wstyle-new-sidetabs.jpg" },
      { name: "Arrow Shape Belt W/ Adjustable Buckle", displayName: "Pointed Side Straps With Buckle", specName: "Arrow Shape Belt W/ Adjustable Buckle", factoryCode: "3352", img: "./assets/pants-wstyle-new-arrowbelt.jpg" },
      { name: "Adjustable Waistband On Side W/ Buckle", displayName: "Side Buckle Tabs", specName: "Adjustable Waistband On Side W/ Buckle", factoryCode: "33TG", img: "./assets/pants-wstyle-new-adjside.jpg" },
    ],
  },
  frontPleat: {
    label: "Front Pleat",
    column: "front_pleat",
    // Pleat depth sent to the factory with every pleated pair (3.2 cm).
    // Factory/admin only, never shown to customers.
    pleatDepthCode: "302F",
    options: [
      { name: "No Pleat", displayName: "Flat Front (No Pleats)", specName: "No Pleat", factoryCode: "302L", img: "./assets/pants-pleat-new-no.jpg" },
      // `allowances`: the factory's table "Men's Pants: Seat & Thigh
      // Allowances by Pleat Style & Depth" -- cm added to the finished
      // NON-pleated seat (hips) and thigh, by pleat depth code
      // (depth cm in `depth`). The factory order adds the row for
      // pleatDepthCode to finished measurements.
      { name: "Single Pleat", factoryCode: "3021", img: "./assets/pants-pleat-new-single.jpg", allowances: {
        "303Z": { depth: 1.5, seat: 2, thigh: 1.2 },
        "302H": { depth: 2, seat: 2.5, thigh: 1.5 },
        "302E": { depth: 2.5, seat: 3, thigh: 1.8 },
        "302F": { depth: 3.2, seat: 5.1, thigh: 3 },
        "302G": { depth: 3.8, seat: 6.9, thigh: 3.6 },
        "302N": { depth: 4.4, seat: 8.7, thigh: 4.5 },
      } },
      { name: "Double Pleat", factoryCode: "3023", img: "./assets/pants-pleat-new-double.jpg", allowances: {
        "303Z": { depth: 1.5, seat: 4, thigh: 2.4 },
        "302H": { depth: 2, seat: 4, thigh: 2.4 },
        "302E": { depth: 2.5, seat: 5, thigh: 3 },
        "302F": { depth: 3.2, seat: 7.1, thigh: 4 },
        "302G": { depth: 3.8, seat: 8.9, thigh: 4.5 },
        "302N": { depth: 4.4, seat: 10.7, thigh: 5.2 },
      } },
    ],
    // Triple pleats aren't offered on the site; kept so the table is whole.
    tripleAllowances: {
      "302E": { depth: 2.5, seat: 7, thigh: 4 },
      "302F": { depth: 3.2, seat: 9.1, thigh: 4.7 },
      "302G": { depth: 3.8, seat: 10.9, thigh: 5.2 },
    },
  },
  beltLoops: {
    label: "Belt Loops",
    column: "belt_loops",
    options: [
      { name: "Belt Loops", displayName: "Standard Belt Loops", specName: "Belt Loops", factoryCode: "3330", img: "./assets/pants-beltloop-new-yes.jpg" },
      { name: "X Loops", displayName: "Crossed (X) Belt Loops", specName: "X Loops", factoryCode: "333E", img: "./assets/pants-beltloop-new-x.jpg" },
      { name: "No Belt Loop", displayName: "No Belt Loops", specName: "No Belt Loop", factoryCode: "3329", img: "./assets/pants-beltloop-new-no.jpg" },
    ],
  },
  frontPocket: {
    label: "Front Pockets",
    // The suit picture generator still knows this step by its old name.
    specLabel: "Front Pocket Style",
    column: "front_pocket_style",
    // The factory refuses its jeans pocket (Arc jeans 3135) with pleats,
    // crossed belt loops or any watch pocket, and with the coin pocket 3530
    // at all (test drafts, 2026-10-25).
    retiredOptions: ["Moon Shape Pocket + Coin Pocket"],
    options: [
      { name: "Slant Pocket", displayName: "Slanted Pockets", specName: "Slant Pocket", factoryCode: "3104,3533", img: "./assets/pants-fpocket-new-slant.jpg" },
      { name: "Double Besom", displayName: "Slit Pockets", specName: "Besom", factoryCode: "3131,3533", img: "./assets/pants-fpocket-new-double-besom.jpg" },
      { name: "On Seam Pocket", displayName: "Side Seam Pockets", specName: "On Seam Pocket", factoryCode: "3130,3533", img: "./assets/pants-fpocket-new-onseam.jpg" },
      { name: "Moon Shape Pocket", displayName: "Curved Pockets (Jeans Style)", specName: "Moon Shape Pocket", factoryCode: "3135,3533", hiddenWhen: { frontPleat: ["Single Pleat", "Double Pleat"], beltLoops: ["X Loops"] }, img: "./assets/pants-fpocket-new-moon.jpg" },
    ],
  },
  bottomStyle: {
    label: "Pant Bottoms",
    // The suit picture generator still knows this step by its old name.
    specLabel: "Bottom Style",
    column: "bottom_style",
    options: [
      // displayName "Hem" is the customer-facing label; the underlying name
      // stays "Turn Up Bottom" because that's still what should print on the
      // Client Form / order data (see friendlyName/displayValue vs.
      // resolvedValue in main.js).
      { name: "Turn Up Bottom", factoryCode: "3600", displayName: "Plain Hem (No Cuff)", specName: "Hem", img: "./assets/pants-bottom-new-hem.jpg", badge: "Standard" },
      // Customer-facing names only; the stored names ("W/ Cuff 3.5 cm" etc.)
      // stay as the supplier values for the Client Form / order data.
      { name: "W/ Cuff 3.5 cm", factoryCode: "3602", displayName: "Thin Cuff", img: "./assets/pants-bottom-new-thin.jpg" },
      { name: "W/ Cuff 4.0 cm", factoryCode: "3603", displayName: "Classic Cuff", img: "./assets/pants-bottom-new-classic.jpg" },
      { name: "W/ Cuff 5.0 cm", factoryCode: "3605", displayName: "Tall Cuff", img: "./assets/pants-bottom-new-tall.jpg" },
    ],
  },
  buttonNail: {
    label: "Button Stitching",
    // The suit picture generator still knows this step by its old name.
    specLabel: "Button Nail Method",
    column: "button_nail_method",
    options: [
      { name: "X Shape Sewing Button", displayName: "X Stitch", specName: "X Shape Sewing", factoryCode: "345B", img: "./assets/buttonnail-new-x.jpg" },
      { name: "II Shape Sewing Button", displayName: "Parallel Stitch", specName: "Parallel Sewing", factoryCode: "345A", img: "./assets/buttonnail-new-parallel.jpg" },
      { name: "Square Shape Sewing Button", displayName: "Square Stitch", specName: "Square Sewing", factoryCode: "34Y1", img: "./assets/buttonnail-square-sewing.jpg" },
    ],
  },
  watchPocket: {
    label: "Watch Pocket",
    // The suit picture generator still knows this step by its old name.
    specLabel: "Watch Pocket Placement",
    column: "watch_pocket_placement",
    // Hidden where the factory refuses them (test drafts, 2026-10-25).
    options: [
      { name: "Right Waist Sewn Up", displayName: "Small Pocket Below Waistband", specName: "Welt Pocket Below Waistband", factoryCode: "3181", hiddenWhen: { frontPleat: ["Double Pleat"], frontPocket: ["Moon Shape Pocket"] }, img: "./assets/pants-watch-new-rightsewn.jpg" },
      { name: "Peach-Shaped Pocket", displayName: "Small Flap Pocket With Button", specName: "Flap Pocket With Button", factoryCode: "3186", hiddenWhen: { frontPocket: ["Moon Shape Pocket"] }, img: "./assets/pants-watch-new-peach.jpg" },
      { name: "Top Of Right Waist", displayName: "Pocket In Top Of Waistband", factoryCode: "3180", hiddenWhen: { frontPocket: ["Moon Shape Pocket"] }, img: "./assets/pants-watch-new-topright.jpg" },
      { name: "No Watch Pocket", factoryCode: "3169", img: "./assets/pants-watch-new-no.jpg" },
    ],
  },
  monogram: {
    label: "Monogram Placement",
    column: "monogram_placement",
    // A "type your monogram" box shown above the placement cards (see
    // textInput handling in createDesigner, main.js); required once any
    // placement other than skipWhen is chosen.
    textInput: { label: "Your monogram", placeholder: "Type your monogram (initials or name)", hint: "Up to 24 characters; capital letters count as 2. For two lines, put (/) between them, e.g. Beijing(/)China.", maxLength: 24, skipWhen: "No Monogram Need" },
    options: [
      { name: "No Monogram Need", displayName: "No Monogram", img: "./assets/pants-monogram-new-none.jpg" },
      { name: "Monogram On Left Back Pocket", displayName: "Left Back Pocket", img: "./assets/pants-monogram-new-leftback.jpg" },
      { name: "Monogram Inside Left Waist", displayName: "Inside the Waistband", specName: "Inside Left Waist", img: "./assets/pants-monogram-new-insideleft.jpg" },
    ],
  },
  backPocket: {
    label: "Back Pockets",
    // The suit picture generator still knows this step by its old name.
    specLabel: "Back Pocket Style",
    column: "back_pocket_style",
    options: [
      { section: "Both Sides", name: "Double Besom Pocket", factoryCode: "3201", displayName: "Two Slit Pockets With Buttons", specName: "Besom With Buttons", img: "./assets/pants-bpocket-new-db-buttons.jpg" },
      { section: "Both Sides", name: "Double Besom Pocket Left W/ Button", factoryCode: "320B", displayName: "Two Slit Pockets, Button on Left", specName: "Besom, Left Button", img: "./assets/pants-bpocket-new-db-leftbutton.jpg" },
      { section: "Both Sides", name: "Double Besom Pocket W/ No Button", factoryCode: "3200", displayName: "Two Slit Pockets, No Buttons", specName: "Besom, No Buttons", img: "./assets/pants-bpocket-new-db-nobuttons.jpg" },
      { section: "Right Side Only", name: "Right Side Double Besom Pocket W/ Button", factoryCode: "320G", displayName: "Right Slit Pocket With Button", specName: "Right Besom With Button", img: "./assets/pants-bpocket-new-right-db-button.jpg" },
      { section: "Right Side Only", name: "Right Side Double Besom Pocket No Button", factoryCode: "320F", displayName: "Right Slit Pocket, No Button", specName: "Right Besom, No Button", img: "./assets/pants-bpocket-new-right-db-nobutton.jpg" },
      { section: "Flap", name: "Rhombus Shape Pocket Flap", factoryCode: "3213", displayName: "Pointed Flap Pockets", specName: "Rhombus Pocket Flap", img: "./assets/pants-bpocket-new-rhombus.jpg" },
      { section: "Flap", name: "Peach Shape Pocket Flap", displayName: "Curved Flap Pockets", specName: "Peach Shape Pocket Flap", factoryCode: "3215", img: "./assets/pants-bpocket-new-peach.jpg" },
      { section: "None", name: "No Pocket", displayName: "No Back Pockets", specName: "No Pocket", factoryCode: "31A0", img: "./assets/pants-bpocket-new-none.jpg" },
    ],
  },
};

// Same idea as JACKET_CATALOG_GROUPS above -- groups the pants' 14 option
// categories into labeled sections instead of one long flat tab list. Every
// PANTS_CATALOG key must appear in exactly one group here, in the order it
// should be offered.
PANTS_CATALOG.pickStitch = {
  label: "Pick Stitching",
  column: "pants_pick_stitch",
  description: "A row of small stitches along the front pocket openings, to match a pick stitched jacket.",
  options: [
    { name: "No Pick Stitching", displayName: "None", factoryCode: "31A6", img: "./assets/pants-pickstitch-none.jpg?v=2", badge: "Standard" },
    // The factory refuses it with slit front pockets (test drafts, 2026-10-25).
    { name: "Pick Stitch Front Pockets", displayName: "Front Pockets", factoryCode: "31A5", hiddenWhen: { frontPocket: ["Double Besom"] }, img: "./assets/pants-pickstitch-pockets.jpg?v=2" },
  ],
};

const PANTS_CATALOG_GROUPS = [
  { label: "Fabric", keys: ["fabric"] },
  { label: "Front & Waistband", keys: ["frontPleat", "waistLineHeight", "waistbandStyle", "waistbandExtension", "beltLoops"] },
  { label: "Pockets", keys: ["frontPocket", "backPocket", "watchPocket"] },
  { label: "Bottom & Details", keys: ["bottomStyle", "threadColor", "pickStitch", "buttonNail"] },
  { label: "Personalization", keys: ["monogram"] },
];

// "part" says which garment each measurement belongs to -- used to show/
// require only the jacket measurements for a "Jacket Only" order (see
// activeMeasurements() in main.js) instead of also asking for pants
// measurements nobody's ordering.
// Height and weight ("body") come first and are asked on every order: the
// factory needs both. Every other field is in cm; height is in inches and
// weight in pounds (`unit`), and kute-factory sends them in those units.
// min/max are the factory's own limits for each measurement (from its Open
// API, public.factory_codes; calf and height/weight have none there, so
// they get sensible ones); the site won't take a value outside them.
// factoryOptional: the factory doesn't require it (its "required" flag is 0
// for that position), so the customer isn't asked for it. Bicep, Wrist, Knee
// and Cuff aren't required either but are still asked: they keep the sleeves
// and pant legs from coming out baggy. Kept here so older
// orders and saved profiles that have the value still show and send it.
const MEASUREMENTS = [
  { id: "height", label: "Height", part: "body", unit: "in", step: "0.5", min: 48, max: 96 },
  { id: "weight", label: "Weight", part: "body", unit: "lb", step: "1", min: 70, max: 500 },
  { id: "shoulder", label: "Shoulder", part: "jacket", min: 31, max: 72 },
  { id: "sleeve_length", label: "Sleeve Length", part: "jacket", min: 20, max: 85 },
  { id: "wrist", label: "Wrist", part: "jacket", min: 20, max: 90 },
  { id: "chest", label: "Chest", part: "jacket", min: 72, max: 211 },
  { id: "stomach", label: "Stomach", part: "jacket", min: 60, max: 221 },
  { id: "front_jacket", label: "Front Jacket", part: "jacket", min: 47, max: 108, factoryOptional: true },
  { id: "back_jacket", label: "Back Jacket", part: "jacket", min: 47, max: 101 },
  { id: "bicep", label: "Bicep", part: "jacket", min: 26, max: 86 },
  { id: "hips", label: "Hips", part: "pants", min: 65, max: 243 },
  { id: "waist", label: "Waist", part: "pants", min: 58, max: 221 },
  { id: "leg_length", label: "Full Pants Length", part: "pants", min: 40, max: 135 },
  { id: "crotch", label: "Full Crotch", part: "pants", hint: "The FULL crotch of the suit pants, snug, not baggy: front waistband, down between the legs, up to the back waistband", min: 50, max: 132 },
  { id: "thigh", label: "Thigh", part: "pants", min: 46, max: 137 },
  { id: "knee", label: "Knee", part: "pants", min: 30, max: 124 },
  { id: "calf", label: "Calf", part: "pants", min: 25, max: 90, factoryOptional: true },
  { id: "cuff", label: "Cuff", part: "pants", min: 26, max: 80 },
  // Body measurements (mode "body"): the customer measures themselves and
  // picks a fit; the factory adds its own allowances. Every entry above
  // without a `mode` is a finished-garment measurement. Each id is its
  // orders column; kute-factory maps them to the factory's body positions.
  { id: "body_neck", label: "Neck", part: "jacket", mode: "body", hint: "Around the base of your neck", min: 30, max: 70 },
  { id: "body_chest", label: "Chest", part: "jacket", mode: "body", hint: "Around the fullest part, under your arms", min: 66, max: 224 },
  { id: "body_stomach", label: "Stomach", part: "jacket", mode: "body", hint: "Around your belly at the navel", min: 55, max: 219 },
  { id: "body_seat", label: "Seat", part: "jacket", pantsToo: true, mode: "body", hint: "Around the fullest part of your seat", min: 68, max: 220 },
  { id: "body_bicep", label: "Bicep", part: "jacket", mode: "body", hint: "Around the fullest part of your upper arm", min: 19, max: 74 },
  { id: "body_shoulder", label: "Shoulder Width", part: "jacket", mode: "body", hint: "Across your back, shoulder point to shoulder point", min: 31, max: 72 },
  { id: "body_sleeve", label: "Arm Length", part: "jacket", mode: "body", hint: "Shoulder point to wrist bone, arm relaxed", min: 25, max: 90 },
  { id: "body_nape_waist", label: "Nape to Waist", part: "jacket", mode: "body", hint: "Back of your neck down to your natural waist", min: 27, max: 63 },
  { id: "body_back_length", label: "Jacket Length", part: "jacket", mode: "body", hint: "Back of your neck down to where the jacket should end", min: 47, max: 105 },
  { id: "body_front_waist", label: "Front Waist Length", part: "jacket", mode: "body", hint: "Shoulder at the neck, down the front to your natural waist", min: 30, max: 75 },
  { id: "body_waist", label: "Waist", part: "pants", mode: "body", hint: "Around where you wear your trousers", min: 58, max: 202 },
  { id: "body_thigh", label: "Thigh", part: "pants", mode: "body", hint: "Around the fullest part of your upper thigh", min: 39, max: 113 },
  { id: "body_u_rise", label: "U-Rise", part: "pants", mode: "body", hint: "Front waist, between your legs, to the back waist", min: 50, max: 120 },
  { id: "body_front_waist_h", label: "Front Waist Height", part: "pants", mode: "body", hint: "How far below your natural waist the trousers sit at the front", min: 1, max: 30 },
  { id: "body_back_waist_h", label: "Back Waist Height", part: "pants", mode: "body", hint: "How far below your natural waist the trousers sit at the back", min: 1, max: 21 },
  { id: "body_outseam", label: "Outseam", part: "pants", mode: "body", hint: "Side of your waist down to where the trousers should end", min: 54, max: 148 },
];
// Fits offered with body measurements (the factory's fit names).
const BODY_FITS = ["Slim", "Regular", "Loose"];

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
    name: "Black",
    swatchHex: "#241f21",
    options: [
      { name: "KG221", displayName: "Matte Coal", img: "./assets/button-photo-kg221.jpg", hex: "#312b2c" },
      { name: "KSZ424", displayName: "Feathered Onyx", img: "./assets/button-photo-ksz424.jpg", hex: "#372d2c" },
      { name: "KNJ033", displayName: "Horn Ebony", img: "./assets/button-photo-knj033.jpg", hex: "#3d3136" },
      { name: "KNJ013", displayName: "Satin Jet", img: "./assets/button-photo-knj013.jpg", hex: "#454144" },
      { name: "KSZ260", displayName: "Dark Horn Onyx", img: "./assets/button-photo-ksz260.jpg", hex: "#7f7c83" },
      { name: "KSZ263", displayName: "Misted Jet", img: "./assets/button-photo-ksz263.jpg", hex: "#373739" },
      { name: "KNJ075", displayName: "Polished Jet", img: "./assets/button-photo-knj075.jpg", hex: "#1a191b" },
      { name: "KNJ076", displayName: "Smoky Raven", img: "./assets/button-photo-knj076.jpg", hex: "#19191a" },
      { name: "KNJ077", displayName: "Glossy Ebony", img: "./assets/button-photo-knj077.jpg", hex: "#171716" },
      { name: "KNJ078", displayName: "Classic Jet", img: "./assets/button-photo-knj078.jpg", hex: "#242325" },
      { name: "KNJ068", displayName: "Refined Ebony", img: "./assets/button-photo-knj068.jpg", hex: "#302828" },
      { name: "KNJ072", displayName: "Marbled Jet", img: "./assets/button-photo-knj072.jpg", hex: "#141315" },
      { name: "KNJ080", displayName: "Polished Raven", img: "./assets/button-photo-knj080.jpg", hex: "#272020" },
      { name: "KNJ084", displayName: "Marbled Raven", img: "./assets/button-photo-knj084.jpg", hex: "#1e1c1d" },
      { name: "KG224", displayName: "Rich Coal", img: "./assets/button-photo-kg224.jpg", hex: "#242125" },
      { name: "KG238", displayName: "Classic Onyx", img: "./assets/button-photo-kg238.jpg", hex: "#130f10" },
      { name: "KG244", displayName: "Refined Coal", img: "./assets/button-photo-kg244.jpg", hex: "#181515" },
      { name: "KG226", displayName: "Antique Ebony", img: "./assets/button-photo-kg226.jpg", hex: "#1b1919" },
      { name: "KSZ428", displayName: "Rich Jet", img: "./assets/button-photo-ksz428.jpg", hex: "#292528" },
      { name: "KSZ431", displayName: "Marbled Onyx", img: "./assets/button-photo-ksz431.jpg", hex: "#2c282b" },
      { name: "KSZ423", displayName: "Rich Raven", img: "./assets/button-photo-ksz423.jpg", hex: "#2f2a2f" },
      { name: "KSZ433", displayName: "Glossy Jet", img: "./assets/button-photo-ksz433.jpg", hex: "#2e2726" },
      { name: "KNJ030", displayName: "Glossy Onyx", img: "./assets/button-photo-knj030.jpg", hex: "#212022" },
      { name: "KNJ023", displayName: "Glossy Coal", img: "./assets/button-photo-knj023.jpg", hex: "#2e1d1e" },
      { name: "KNJ024", displayName: "Rich Onyx", img: "./assets/button-photo-knj024.jpg", hex: "#18171c" },
      { name: "KNJ036", displayName: "Antique Onyx", img: "./assets/button-photo-knj036.jpg", hex: "#232225" },
      { name: "KNJ011", displayName: "Smoky Coal", img: "./assets/button-photo-knj011.jpg", hex: "#2b2a2e" },
      { name: "KG197", displayName: "Classic Coal", img: "./assets/button-photo-kg197.jpg", hex: "#1a181d" },
      { name: "KG199", displayName: "Antique Coal", img: "./assets/button-photo-kg199.jpg", hex: "#2d2724" },
      { name: "KSZ199", displayName: "Refined Jet", img: "./assets/button-photo-ksz199.jpg", hex: "#242121" },
    ],
  },
  {
    name: "Navy",
    swatchHex: "#2c3445",
    options: [
      { name: "KSZ425", displayName: "Streaked Midnight Navy", img: "./assets/button-photo-ksz425.jpg", hex: "#35323f" },
      { name: "KB021", displayName: "Textured Navy", img: "./assets/button-photo-kb021.jpg", hex: "#525568" },
      { name: "KG206", displayName: "Rust-Flecked Navy", img: "./assets/button-photo-kg206.jpg", hex: "#52393c" },
      { name: "KG191", displayName: "Deep Navy", img: "./assets/button-photo-kg191.jpg", hex: "#232229" },
      { name: "KSZ439", displayName: "Marbled Dusk Navy", img: "./assets/button-photo-ksz439.jpg", hex: "#2c2b40" },
      { name: "KSZ262", displayName: "Classic Midnight Navy", img: "./assets/button-photo-ksz262.jpg", hex: "#282739" },
    ],
  },
  {
    name: "Gray",
    swatchHex: "#575156",
    options: [
      { name: "KNJ070", displayName: "Marbled Charcoal Gray", img: "./assets/button-photo-knj070.jpg", hex: "#4c4647" },
      { name: "KB285", displayName: "Glossy Dove Gray", img: "./assets/button-photo-kb285.jpg", hex: "#474c4c" },
      { name: "KB289", displayName: "Refined Steel Gray", img: "./assets/button-photo-kb289.jpg", hex: "#9c99a5" },
      { name: "KG239", displayName: "Rich Dove Gray", img: "./assets/button-photo-kg239.jpg", hex: "#473d44" },
      { name: "KSZ455", displayName: "Marbled Dove Gray", img: "./assets/button-photo-ksz455.jpg", hex: "#95929a" },
      { name: "KSZ448", displayName: "Polished Charcoal Gray", img: "./assets/button-photo-ksz448.jpg", hex: "#535157" },
      { name: "KNJ052", displayName: "Refined Smoke Gray", img: "./assets/button-photo-knj052.jpg", hex: "#4e4c50" },
      { name: "KB111", displayName: "Antique Dove Gray", img: "./assets/button-photo-kb111.jpg", hex: "#4e515c" },
      { name: "KB1112", displayName: "Smoky Dove Gray", img: "./assets/button-photo-kb1112.jpg", hex: "#75747a" },
      { name: "KB151", displayName: "Antique Slate Gray", img: "./assets/button-photo-kb151.jpg", hex: "#7b7988" },
      { name: "KB026", displayName: "Rich Slate Gray", img: "./assets/button-photo-kb026.jpg", hex: "#545452" },
      { name: "KB027", displayName: "Smoky Slate Gray", img: "./assets/button-photo-kb027.jpg", hex: "#9d9ea8" },
      { name: "KB011", displayName: "Classic Smoke Gray", img: "./assets/button-photo-kb011.jpg", hex: "#565555" },
      { name: "KB029", displayName: "Classic Charcoal Gray", img: "./assets/button-photo-kb029.jpg", hex: "#918f9c" },
      { name: "KB030", displayName: "Glossy Smoke Gray", img: "./assets/button-photo-kb030.jpg", hex: "#94939f" },
      { name: "KG109", displayName: "Anchor Slate Gray", img: "./assets/button-photo-kg109.jpg", hex: "#464859" },
      { name: "KSZ257", displayName: "Refined Charcoal Gray", img: "./assets/button-photo-ksz257.jpg", hex: "#5f5d62" },
      { name: "KSZ298", displayName: "Rich Smoke Gray", img: "./assets/button-photo-ksz298.jpg", hex: "#7a787e" },
      { name: "KSZ299", displayName: "Smoky Charcoal Gray", img: "./assets/button-photo-ksz299.jpg", hex: "#3f3e43" },
      { name: "KB272", displayName: "Smoky Pearl Gray", img: "./assets/button-photo-kb272.jpg", hex: "#6b635a" },
      { name: "KB273", displayName: "Black-Rim Pearl Gray", img: "./assets/button-photo-kb273.jpg", hex: "#978f91" },
      { name: "KB274", displayName: "Silver Pearl Gray", img: "./assets/button-photo-kb274.jpg", hex: "#968e8d" },
      { name: "KG241", displayName: "Soft Dove Gray", img: "./assets/button-photo-kg241.jpg", hex: "#796b6a" },
      { name: "KSZ435", displayName: "Pale Silver Gray", img: "./assets/button-photo-ksz435.jpg", hex: "#d7cecc" },
      { name: "KB001", displayName: "Smoky Shell Gray", img: "./assets/button-photo-kb001.jpg", hex: "#615a5c" },
      { name: "KB023", displayName: "Scalloped Gray", img: "./assets/button-photo-kb023.jpg", hex: "#6b6866" },
      { name: "KB279", displayName: "Silver Shell Gray", img: "./assets/button-photo-kb279.jpg", hex: "#d2caca" },
      { name: "KB115", displayName: "Abalone Gray", img: "./assets/button-photo-kb115.jpg", hex: "#aba2a9" },
    ],
  },
  {
    name: "Blue",
    swatchHex: "#a8acbe",
    options: [
      { name: "KB280", displayName: "Marbled Powder Blue", img: "./assets/button-photo-kb280.jpg", hex: "#a8abbf" },
      { name: "KB114", displayName: "Classic Sky Blue", img: "./assets/button-photo-kb114.jpg", hex: "#a9adbc" },
    ],
  },
  {
    name: "Purple",
    swatchHex: "#dcd8e1",
    options: [
      { name: "KB286", displayName: "Pearl Mauve Purple", img: "./assets/button-photo-kb286.jpg", hex: "#b7a3ab" },
      { name: "KB016", displayName: "Deep Plum Purple", img: "./assets/button-photo-kb016.jpg", hex: "#412532" },
    ],
  },
  {
    name: "Green",
    swatchHex: "#3b5a4a",
    options: [
      { name: "KG198", displayName: "Olive Green", img: "./assets/button-photo-kg198.jpg", hex: "#4a3c30" },
      { name: "KG243", displayName: "Deep Teal Green", img: "./assets/button-photo-kg243.jpg", hex: "#2a444d" },
    ],
  },
  {
    name: "Brown",
    swatchHex: "#764831",
    options: [
      { name: "KB277", displayName: "Smoky Mocha Brown", img: "./assets/button-photo-kb277.jpg", hex: "#453735" },
      { name: "KB288", displayName: "Dark Espresso Brown", img: "./assets/button-photo-kb288.jpg", hex: "#382627" },
      { name: "KSZ429", displayName: "Streaked Horn Brown", img: "./assets/button-photo-ksz429.jpg", hex: "#453b38" },
      { name: "KSZ430", displayName: "Deep Cocoa Brown", img: "./assets/button-photo-ksz430.jpg", hex: "#3c3131" },
      { name: "KSZ432", displayName: "Smoky Bark Brown", img: "./assets/button-photo-ksz432.jpg", hex: "#39302f" },
      { name: "KSZ426", displayName: "Mottled Chocolate Brown", img: "./assets/button-photo-ksz426.jpg", hex: "#4f3f3d" },
      { name: "KSZ436", displayName: "Muted Taupe Brown", img: "./assets/button-photo-ksz436.jpg", hex: "#413131" },
      { name: "KSZ440", displayName: "Matte Mocha Brown", img: "./assets/button-photo-ksz440.jpg", hex: "#5f4f52" },
      { name: "KNJ069", displayName: "Dark Horn Brown", img: "./assets/button-photo-knj069.jpg", hex: "#2c2828" },
      { name: "KNJ079", displayName: "Streaked Mahogany Brown", img: "./assets/button-photo-knj079.jpg", hex: "#2c2424" },
      { name: "KG240", displayName: "Glossy Mahogany Brown", img: "./assets/button-photo-kg240.jpg", hex: "#331815" },
      { name: "KSZ421", displayName: "Swirled Chocolate Brown", img: "./assets/button-photo-ksz421.jpg", hex: "#2f201d" },
      { name: "KB287", displayName: "Glossy Chestnut", img: "./assets/button-photo-kb287.jpg", hex: "#a37148" },
      { name: "KB278", displayName: "Polished Walnut", img: "./assets/button-photo-kb278.jpg", hex: "#663b28" },
      { name: "KG214", displayName: "Refined Walnut", img: "./assets/button-photo-kg214.jpg", hex: "#b86642" },
      { name: "KG245", displayName: "Rich Chestnut", img: "./assets/button-photo-kg245.jpg", hex: "#6a2e1a" },
      { name: "KG237", displayName: "Classic Chestnut", img: "./assets/button-photo-kg237.jpg", hex: "#3b1f19" },
      { name: "KG222", displayName: "Marbled Walnut", img: "./assets/button-photo-kg222.jpg", hex: "#432318" },
      { name: "KSZ434", displayName: "Marbled Umber", img: "./assets/button-photo-ksz434.jpg", hex: "#8c4727" },
      { name: "KSZ427", displayName: "Smoky Umber", img: "./assets/button-photo-ksz427.jpg", hex: "#61341f" },
      { name: "KSZ442", displayName: "Refined Cocoa", img: "./assets/button-photo-ksz442.jpg", hex: "#4e3531" },
      { name: "KB008", displayName: "Antique Espresso", img: "./assets/button-photo-kb008.jpg", hex: "#693626" },
      { name: "KG225", displayName: "Burnt Sienna Brown", img: "./assets/button-photo-kg225.jpg", hex: "#592923" },
      { name: "KB152", displayName: "Glossy Russet Brown", img: "./assets/button-photo-kb152.jpg", hex: "#4e3330" },
    ],
  },
  {
    name: "Tortoiseshell",
    swatchHex: "#b16e4f",
    options: [
      { name: "KNJ031", displayName: "Black Tortoise", img: "./assets/button-photo-knj031.jpg", hex: "#352d30" },
      { name: "KNJ074", displayName: "Mottled Tortoise", img: "./assets/button-photo-knj074.jpg", hex: "#252123" },
      { name: "KNJ039", displayName: "Blonde Tortoise", img: "./assets/button-photo-knj039.jpg", hex: "#897c74" },
      { name: "KSZ255", displayName: "Classic Tortoise", img: "./assets/button-photo-ksz255.jpg", hex: "#cba486" },
      { name: "KSZ259", displayName: "Light Tortoise", img: "./assets/button-photo-ksz259.jpg", hex: "#b69569" },
      { name: "KSZ198", displayName: "Smoky Horn Tortoise", img: "./assets/button-photo-ksz198.jpg", hex: "#9d897d" },
      { name: "KSZ276", displayName: "Clear Tortoise", img: "./assets/button-photo-ksz276.jpg", hex: "#a78b81" },
      { name: "KSZ258", displayName: "Rich Tortoise", img: "./assets/button-photo-ksz258.jpg", hex: "#704733" },
      { name: "KSZ197", displayName: "Golden Horn", img: "./assets/button-photo-ksz197.jpg", hex: "#bb8b57" },
      { name: "KNJ053", displayName: "Glossy Amber", img: "./assets/button-photo-knj053.jpg", hex: "#a35f50" },
      { name: "KNJ012", displayName: "Classic Honey", img: "./assets/button-photo-knj012.jpg", hex: "#8f361c" },
      { name: "KNJ014", displayName: "Marbled Toffee", img: "./assets/button-photo-knj014.jpg", hex: "#b2633b" },
    ],
  },
  {
    name: "Red",
    swatchHex: "#841c21",
    options: [
      { name: "KG192", displayName: "Classic Scarlet Red", img: "./assets/button-photo-kg192.jpg", hex: "#841c21" },
    ],
  },
  {
    name: "Tan",
    swatchHex: "#bba79a",
    options: [
      { name: "KG220", displayName: "Classic Wheat Tan", img: "./assets/button-photo-kg220.jpg", hex: "#deb494" },
      { name: "KSZ438", displayName: "Marbled Beige Tan", img: "./assets/button-photo-ksz438.jpg", hex: "#a9907f" },
      { name: "KSZ422", displayName: "Marbled Fawn Tan", img: "./assets/button-photo-ksz422.jpg", hex: "#dabea2" },
      { name: "KG190", displayName: "Smoky Fawn Tan", img: "./assets/button-photo-kg190.jpg", hex: "#b29883" },
      { name: "KG108", displayName: "Anchor Copper Tan", img: "./assets/button-photo-kg108.jpg", hex: "#c78966" },
      { name: "KSZ297", displayName: "Smoky Camel Tan", img: "./assets/button-photo-ksz297.jpg", hex: "#e9d0c1" },
      { name: "KSZ277", displayName: "Rich Sand Tan", img: "./assets/button-photo-ksz277.jpg", hex: "#bc967f" },
      { name: "KG242", displayName: "Wavy Camel Tan", img: "./assets/button-photo-kg242.jpg", hex: "#ac7856" },
    ],
  },
  {
    name: "Cream",
    swatchHex: "#c7bcbf",
    options: [
      { name: "KNG010", displayName: "Ivory Horn Cream", img: "./assets/button-photo-kng010.jpg", hex: "#fdf7f5" },
      { name: "KB002", displayName: "Pearl Cream", img: "./assets/button-photo-kb002.jpg", hex: "#faf1e7" },
      { name: "KSZ196", displayName: "Soft Bone Cream", img: "./assets/button-photo-ksz196.jpg", hex: "#fae4dd" },
      { name: "KSZ261", displayName: "Polished Ivory Cream", img: "./assets/button-photo-ksz261.jpg", hex: "#efdcc4" },
      { name: "KSZ256", displayName: "Smoky Bone Cream", img: "./assets/button-photo-ksz256.jpg", hex: "#ded3d6" },
      { name: "KNJ071", displayName: "Natural Horn Cream", img: "./assets/button-photo-knj071.jpg", hex: "#e1c094" },
      { name: "KB150", displayName: "Mother of Pearl Cream", img: "./assets/button-photo-kb150.jpg", hex: "#f0e5dc" },
    ],
  },
  {
    name: "Pink",
    swatchHex: "#f1ddde",
    options: [
      { name: "KB028", displayName: "Marbled Rose Pink", img: "./assets/button-photo-kb028.jpg", hex: "#efd6d6" },
    ],
  },
  {
    name: "White",
    swatchHex: "#eee8e8",
    options: [
      { name: "KB275", displayName: "Pure Pearl White", img: "./assets/button-photo-kb275.jpg", hex: "#f8f0ec" },
      { name: "KSZ443", displayName: "Speckled Chalk White", img: "./assets/button-photo-ksz443.jpg", hex: "#ddd2cf" },
      { name: "KB010", displayName: "Clear Pearl White", img: "./assets/button-photo-kb010.jpg", hex: "#d7d1c5" },
      { name: "KSZ454", displayName: "Marbled Frost White", img: "./assets/button-photo-ksz454.jpg", hex: "#d0cac7" },
      { name: "KB020", displayName: "Textured Pearl White", img: "./assets/button-photo-kb020.jpg", hex: "#f7eff0" },
      { name: "KB276", displayName: "Marbled Pearl White", img: "./assets/button-photo-kb276.jpg", hex: "#f0ebeb" },
      { name: "KB022", displayName: "Classic Snow White", img: "./assets/button-photo-kb022.jpg", hex: "#ece4e6" },
      { name: "KB113", displayName: "Rippled Pearl White", img: "./assets/button-photo-kb113.jpg", hex: "#dcd8e1" },
    ],
  },
  {
    name: "Multi-Color",
    swatchHex: "#e5dcda",
    options: [
      { name: "KB116", displayName: "Abalone Multi-Color", img: "./assets/button-photo-kb116.jpg", hex: "#b2a297" },
      { name: "KG223", displayName: "Teal & Tan Multi-Color", img: "./assets/button-photo-kg223.jpg", hex: "#333c4d" },
      { name: "KG195", displayName: "Cream & Red Multi-Color", img: "./assets/button-photo-kg195.jpg", hex: "#edd3d4" },
      { name: "KG196", displayName: "Cream & Navy Multi-Color", img: "./assets/button-photo-kg196.jpg", hex: "#dad3d9" },
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
      { name: "26SU208.DLL0176", displayName: "Dark Slate Blue", img: "./assets/jacket-fabric-26su196-dll0176.jpg", hex: "#13151b" },
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
      { name: "26SU195.DZZ0099", displayName: "Smoky Olive", img: "./assets/jacket-fabric-dat9758-dzz0099.jpg", hex: "#1b1c16" },
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

// ---------------------------------------------------------------------
// New Fabrics (Daniel, 2026-10-25): 100% wool fabrics from the factory's
// other 26FW books, $15-45/m and in stock when added (no brown, coffee,
// jacquard, pink or orange). They are filed into FABRIC_PATTERN_TYPES
// below like every other fabric (so the order, picture generator and 3D
// jacket all see them), flagged isNew so the Fabric step shows them in
// their own "New Fabrics" section, grouped by color (NEW_FABRIC_COLOR_GROUPS)
// and then by site price. Their zoom photos are single 1200 px tiles
// (FABRIC_ZOOM_MAP entries with tile: 1200).
// pattern / family: where the fabric sits in FABRIC_PATTERN_TYPES;
// palette: FABRIC_COLOR_ASSIGN; tier: FABRIC_PRICE_TIER (cost per meter in
// the trailing comment).
// ---------------------------------------------------------------------
const NEW_FABRICS = [
  { name: "26SU273.DBT604A", displayName: "Slate Gray Stripe", img: "./assets/jacket-fabric-26su273-dbt604a.jpg", hex: "#434346", pattern: "Pinstripe", family: "Charcoal Pattern", palette: "Slate Grey", tier: 0, description: "Slate Gray stripe in pure wool. Year-round, from business to evening." }, // $15/m
  { name: "26SU083.DBV396A", displayName: "Slate Gray", img: "./assets/jacket-fabric-26su083-dbv396a.jpg", hex: "#404446", pattern: "Solid", family: "Charcoal", palette: "Slate Grey", tier: 0, description: "Slate Gray solid in Super 100s pure wool. Year-round, from business to evening." }, // $17/m
  { name: "26SU084.DBV397A", displayName: "Charcoal", img: "./assets/jacket-fabric-26su084-dbv397a.jpg", hex: "#23262a", pattern: "Solid", family: "Charcoal", palette: "Deep Charcoal", tier: 0, description: "Charcoal solid in Super 100s pure wool. Year-round, from business to evening." }, // $17/m
  { name: "26SU085.DBV400A", displayName: "Cobalt", img: "./assets/jacket-fabric-26su085-dbv400a.jpg", hex: "#222839", pattern: "Solid", family: "Navy", palette: "Navy", tier: 0, description: "Cobalt solid in Super 100s pure wool. Year-round, from business to evening." }, // $17/m
  { name: "26SU086.DBV401A", displayName: "Classic Cobalt", img: "./assets/jacket-fabric-26su086-dbv401a.jpg", hex: "#1d282e", pattern: "Solid", family: "Navy", palette: "Navy", tier: 0, description: "Cobalt solid in Super 100s pure wool. Year-round, from business to evening." }, // $17/m
  { name: "26SU087.DBV402A", displayName: "Fine Cobalt", img: "./assets/jacket-fabric-26su087-dbv402a.jpg", hex: "#181b2c", pattern: "Solid", family: "Navy", palette: "Navy", tier: 0, description: "Cobalt solid in Super 100s pure wool. Year-round, from business to evening." }, // $17/m
  { name: "26SU088.DBV403A", displayName: "Midnight Navy", img: "./assets/jacket-fabric-26su088-dbv403a.jpg", hex: "#1c1f27", pattern: "Solid", family: "Navy", palette: "Navy", tier: 0, description: "Midnight Navy solid in Super 100s pure wool. Year-round, from business to evening." }, // $17/m
  { name: "26SU076.DBV405A", displayName: "Cobalt Check", img: "./assets/jacket-fabric-26su076-dbv405a.jpg", hex: "#232c35", pattern: "Plaid", family: "Navy Pattern", palette: "Navy", tier: 0, description: "Cobalt check in Super 100s pure wool. Year-round, from business to evening." }, // $17/m
  { name: "26SU118.DBV386A", displayName: "Charcoal Herringbone", img: "./assets/jacket-fabric-26su118-dbv386a.jpg", hex: "#373a35", pattern: "Herringbone", family: "Charcoal Pattern", palette: "Deep Charcoal", tier: 0, description: "Charcoal herringbone in pure wool. Year-round, from business to evening." }, // $20/m
  { name: "26SU117.DBV389A", displayName: "Forest Green Herringbone", img: "./assets/jacket-fabric-26su117-dbv389a.jpg", hex: "#2c3226", pattern: "Herringbone", family: "Green Pattern", palette: "Forest Green", tier: 0, description: "Forest Green herringbone in pure wool. A rich tone for fall and winter." }, // $20/m
  { name: "26L6.DEB5111", displayName: "Ivory", img: "./assets/jacket-fabric-26l6-deb5111.jpg", hex: "#faf4e3", pattern: "Solid", family: "Cream", palette: "Off White", tier: 0, description: "Ivory solid in pure wool. Light and fresh for spring and summer." }, // $22/m
  { name: "26L6.DEB5114", displayName: "Classic Slate Gray", img: "./assets/jacket-fabric-26l6-deb5114.jpg", hex: "#515559", pattern: "Solid", family: "Charcoal", palette: "Slate Grey", tier: 0, description: "Slate Gray solid in pure wool. Versatile for any season." }, // $22/m
  { name: "26SU073.DGG1130", displayName: "Gray Check", img: "./assets/jacket-fabric-26su073-dgg1130.jpg", hex: "#5a5e62", pattern: "Plaid", family: "Gray Pattern", palette: "Mid Grey", tier: 0, description: "Gray check in Super 110s pure wool. Versatile for any season." }, // $23.5/m
  { name: "26SU074.DGG1131", displayName: "Navy Check", img: "./assets/jacket-fabric-26su074-dgg1131.jpg", hex: "#252a3c", pattern: "Plaid", family: "Navy Pattern", palette: "Navy", tier: 0, description: "Navy check in Super 110s pure wool. Year-round, from business to evening." }, // $23.5/m
  { name: "26SU106.DAV7773", displayName: "Forest Green", img: "./assets/jacket-fabric-26su106-dav7773.jpg", hex: "#1c211a", pattern: "Solid", family: "Green", palette: "Forest Green", tier: 0, description: "Forest Green solid in pure wool. A rich tone for fall and winter." }, // $25/m
  { name: "26SU112.DAV7777", displayName: "Onyx", img: "./assets/jacket-fabric-26su112-dav7777.jpg", hex: "#222327", pattern: "Solid", family: "Black", palette: "Jet Black", tier: 0, description: "Onyx solid in pure wool. Year-round, from business to evening." }, // $25/m
  { name: "26SU071.DBV4054", displayName: "Indigo Check", img: "./assets/jacket-fabric-26su071-dbv4054.jpg", hex: "#2e3851", pattern: "Plaid", family: "Navy Pattern", palette: "Navy", tier: 0, description: "Indigo check in pure wool. Year-round, from business to evening." }, // $25/m
  { name: "26SU108.DBV4754", displayName: "Classic Charcoal", img: "./assets/jacket-fabric-26su108-dbv4754.jpg", hex: "#23282b", pattern: "Solid", family: "Charcoal", palette: "Deep Charcoal", tier: 0, description: "Charcoal solid in pure wool. Year-round, from business to evening." }, // $25/m
  { name: "26SU110.DBV4765", displayName: "Classic Midnight Navy", img: "./assets/jacket-fabric-26su110-dbv4765.jpg", hex: "#191d27", pattern: "Solid", family: "Navy", palette: "Navy", tier: 0, description: "Midnight Navy solid in pure wool. Year-round, from business to evening." }, // $25/m
  { name: "26SU103.DBV5296", displayName: "Sand", img: "./assets/jacket-fabric-26su103-dbv5296.jpg", hex: "#d1c8bb", pattern: "Solid", family: "Khaki", palette: "Oat", tier: 0, description: "Sand solid in pure wool. Light and fresh for spring and summer." }, // $25/m
  { name: "26SU104.DBV5297", displayName: "Smoke Gray", img: "./assets/jacket-fabric-26su104-dbv5297.jpg", hex: "#8a857c", pattern: "Solid", family: "Gray", palette: "Smoke", tier: 0, description: "Smoke Gray solid in pure wool. Versatile for any season." }, // $25/m
  { name: "26SU107.DBV5298", displayName: "Rich Slate Gray", img: "./assets/jacket-fabric-26su107-dbv5298.jpg", hex: "#535557", pattern: "Solid", family: "Charcoal", palette: "Slate Grey", tier: 0, description: "Slate Gray solid in pure wool. Versatile for any season." }, // $25/m
  { name: "26SU111.DBV5304", displayName: "Rich Midnight Navy", img: "./assets/jacket-fabric-26su111-dbv5304.jpg", hex: "#181a25", pattern: "Solid", family: "Navy", palette: "Navy", tier: 0, description: "Midnight Navy solid in pure wool. Year-round, from business to evening." }, // $25/m
  { name: "26SU120.DBV5579", displayName: "Onyx Houndstooth", img: "./assets/jacket-fabric-26su120-dbv5579.jpg", hex: "#6d6e6b", pattern: "Houndstooth", family: "Black Pattern", palette: "Jet Black", tier: 0, description: "Onyx houndstooth in pure wool. Versatile for any season." }, // $25/m
  { name: "26SU368.DBV5953", displayName: "Olive Stripe", img: "./assets/jacket-fabric-26su368-dbv5953.jpg", hex: "#453c31", pattern: "Pinstripe", family: "Green Pattern", palette: "Forest Green", tier: 0, description: "Olive stripe in pure wool. A rich tone for fall and winter." }, // $25/m
  { name: "26SU369.DBV5955", displayName: "Navy Stripe", img: "./assets/jacket-fabric-26su369-dbv5955.jpg", hex: "#323441", pattern: "Pinstripe", family: "Navy Pattern", palette: "Navy", tier: 0, description: "Navy stripe in pure wool. Year-round, from business to evening." }, // $25/m
  { name: "26SU094.DBV6378", displayName: "Classic Navy Check", img: "./assets/jacket-fabric-26su094-dbv6378.jpg", hex: "#21262e", pattern: "Plaid", family: "Navy Pattern", palette: "Navy", tier: 0, description: "Navy check in pure wool. Year-round, from business to evening." }, // $25/m
  { name: "26SU099.DEE2023", displayName: "Stone", img: "./assets/jacket-fabric-26su099-dee2023.jpg", hex: "#916b3f", pattern: "Solid", family: "Khaki", palette: "Stone", tier: 0, description: "Stone solid in pure wool. Versatile for any season." }, // $25/m
  { name: "26SU102.DEE2027", displayName: "Classic Forest Green", img: "./assets/jacket-fabric-26su102-dee2027.jpg", hex: "#1d251a", pattern: "Solid", family: "Green", palette: "Forest Green", tier: 0, description: "Forest Green solid in pure wool. A rich tone for fall and winter." }, // $25/m
  { name: "26SU089.DZZ0004", displayName: "Olive Check", img: "./assets/jacket-fabric-26su089-dzz0004.jpg", hex: "#48473d", pattern: "Plaid", family: "Green Pattern", palette: "Forest Green", tier: 0, description: "Olive check in Super 100s pure wool. Versatile for any season." }, // $25/m
  { name: "26SU095.DZZ0010", displayName: "Forest Green Stripe", img: "./assets/jacket-fabric-26su095-dzz0010.jpg", hex: "#33342d", pattern: "Pinstripe", family: "Green Pattern", palette: "Forest Green", tier: 0, description: "Forest Green stripe in Super 100s pure wool. A rich tone for fall and winter." }, // $25/m
  { name: "26SU096.DZZ0013", displayName: "Classic Navy Stripe", img: "./assets/jacket-fabric-26su096-dzz0013.jpg", hex: "#1e1f2e", pattern: "Pinstripe", family: "Navy Pattern", palette: "Navy", tier: 0, description: "Navy stripe in Super 100s pure wool. Year-round, from business to evening." }, // $25/m
  { name: "26L8.DBT6768", displayName: "Black", img: "./assets/jacket-fabric-26l8-dbt6768.jpg", hex: "#121415", pattern: "Solid", family: "Black", palette: "Jet Black", tier: 0, description: "Black solid in pure wool. Year-round, from business to evening." }, // $28/m
  { name: "26L8.DBT6772", displayName: "Classic Stone", img: "./assets/jacket-fabric-26l8-dbt6772.jpg", hex: "#8b6837", pattern: "Solid", family: "Khaki", palette: "Stone", tier: 0, description: "Stone solid in pure wool. Versatile for any season." }, // $28/m
  { name: "26SU078.DLL0153", displayName: "Charcoal Stripe", img: "./assets/jacket-fabric-26su078-dll0153.jpg", hex: "#373737", pattern: "Pinstripe", family: "Charcoal Pattern", palette: "Deep Charcoal", tier: 0, description: "Charcoal stripe in Super 110s pure wool. Year-round, from business to evening." }, // $28/m
  { name: "26SU079.DLL0154", displayName: "Rich Navy Stripe", img: "./assets/jacket-fabric-26su079-dll0154.jpg", hex: "#1f2435", pattern: "Pinstripe", family: "Navy Pattern", palette: "Navy", tier: 0, description: "Navy stripe in Super 110s pure wool. Year-round, from business to evening." }, // $28/m
  { name: "26L8.DBT6770", displayName: "Classic Ivory", img: "./assets/jacket-fabric-26l8-dbt6770.jpg", hex: "#e9e7df", pattern: "Solid", family: "Cream", palette: "Off White", tier: 1, description: "Ivory solid in pure wool. Light and fresh for spring and summer." }, // $30/m
  { name: "26L8.DZZ0094", displayName: "Stone Stripe", img: "./assets/jacket-fabric-26l8-dzz0094.jpg", hex: "#8a7f75", pattern: "Pinstripe", family: "Khaki Pattern", palette: "Stone", tier: 1, description: "Stone stripe in pure wool. Versatile for any season." }, // $30/m
  { name: "26SU280.DZZ0016", displayName: "Fine Midnight Navy", img: "./assets/jacket-fabric-26su280-dzz0016.jpg", hex: "#141724", pattern: "Solid", family: "Navy", palette: "Navy", tier: 1, description: "Midnight Navy solid in Super 110s pure wool. Year-round, from business to evening." }, // $38/m
  { name: "26SU281.DZZ0017", displayName: "Classic Onyx", img: "./assets/jacket-fabric-26su281-dzz0017.jpg", hex: "#222222", pattern: "Solid", family: "Black", palette: "Jet Black", tier: 1, description: "Onyx solid in Super 110s pure wool. Year-round, from business to evening." }, // $38/m
  { name: "26SU279.DZZ0019", displayName: "Fine Charcoal", img: "./assets/jacket-fabric-26su279-dzz0019.jpg", hex: "#37363b", pattern: "Solid", family: "Charcoal", palette: "Deep Charcoal", tier: 1, description: "Charcoal solid in Super 110s pure wool. Year-round, from business to evening." }, // $38/m
  { name: "26SU275.DZZ0021", displayName: "Fine Onyx", img: "./assets/jacket-fabric-26su275-dzz0021.jpg", hex: "#262020", pattern: "Solid", family: "Black", palette: "Jet Black", tier: 1, description: "Onyx solid in Super 110s pure wool. Year-round, from business to evening." }, // $38/m
  { name: "26SU097.DZZ0085", displayName: "Classic Charcoal Stripe", img: "./assets/jacket-fabric-26su097-dzz0085.jpg", hex: "#313332", pattern: "Pinstripe", family: "Charcoal Pattern", palette: "Deep Charcoal", tier: 1, description: "Charcoal stripe in Super 100s pure wool. Year-round, from business to evening." }, // $38/m
  { name: "26SU098.DZZ0086", displayName: "Midnight Navy Stripe", img: "./assets/jacket-fabric-26su098-dzz0086.jpg", hex: "#191824", pattern: "Pinstripe", family: "Navy Pattern", palette: "Navy", tier: 1, description: "Midnight Navy stripe in Super 100s pure wool. Year-round, from business to evening." }, // $38/m
  { name: "26SU348.DEB510A", displayName: "Heritage Charcoal", img: "./assets/jacket-fabric-26su348-deb510a.jpg", hex: "#272729", pattern: "Solid", family: "Charcoal", palette: "Deep Charcoal", tier: 2, description: "Charcoal solid in pure wool. Year-round, from business to evening." }, // $40/m
  { name: "26SU338.DEB513A", displayName: "Charcoal Check", img: "./assets/jacket-fabric-26su338-deb513a.jpg", hex: "#2e2e31", pattern: "Plaid", family: "Charcoal Pattern", palette: "Deep Charcoal", tier: 2, description: "Charcoal check in pure wool. Year-round, from business to evening." }, // $40/m
  { name: "26SU372.DEB520A", displayName: "Rich Forest Green", img: "./assets/jacket-fabric-26su372-deb520a.jpg", hex: "#342f20", pattern: "Solid", family: "Green", palette: "Forest Green", tier: 2, description: "Forest Green solid in pure wool. A rich tone for fall and winter." }, // $40/m
  { name: "26SU374.DEB522A", displayName: "Royal Charcoal", img: "./assets/jacket-fabric-26su374-deb522a.jpg", hex: "#333234", pattern: "Solid", family: "Charcoal", palette: "Deep Charcoal", tier: 2, description: "Charcoal solid in pure wool. Year-round, from business to evening." }, // $40/m
  { name: "26SU376.DEB524A", displayName: "Navy", img: "./assets/jacket-fabric-26su376-deb524a.jpg", hex: "#1d202a", pattern: "Solid", family: "Navy", palette: "Navy", tier: 2, description: "Navy solid in pure wool. Year-round, from business to evening." }, // $40/m
  { name: "26SU377.DEB526A", displayName: "Heritage Onyx", img: "./assets/jacket-fabric-26su377-deb526a.jpg", hex: "#222222", pattern: "Solid", family: "Black", palette: "Jet Black", tier: 2, description: "Onyx solid in pure wool. Year-round, from business to evening." }, // $40/m
  { name: "26SU355.DEB527A", displayName: "Khaki", img: "./assets/jacket-fabric-26su355-deb527a.jpg", hex: "#b8a68a", pattern: "Solid", family: "Khaki", palette: "Khaki", tier: 2, description: "Khaki solid in pure wool. Light and fresh for spring and summer." }, // $40/m
  { name: "26SU359.DEB531A", displayName: "Olive", img: "./assets/jacket-fabric-26su359-deb531a.jpg", hex: "#393624", pattern: "Solid", family: "Green", palette: "Forest Green", tier: 2, description: "Olive solid in pure wool. A rich tone for fall and winter." }, // $40/m
  { name: "26SU360.DEB532A", displayName: "Fine Slate Gray", img: "./assets/jacket-fabric-26su360-deb532a.jpg", hex: "#4c4c4d", pattern: "Solid", family: "Charcoal", palette: "Slate Grey", tier: 2, description: "Slate Gray solid in pure wool. Versatile for any season." }, // $40/m
  { name: "26SU351.DEB536A", displayName: "Classic Olive Stripe", img: "./assets/jacket-fabric-26su351-deb536a.jpg", hex: "#574732", pattern: "Pinstripe", family: "Green Pattern", palette: "Forest Green", tier: 2, description: "Olive stripe in pure wool. Versatile for any season." }, // $40/m
  { name: "26SU353.DEB538A", displayName: "Classic Slate Gray Stripe", img: "./assets/jacket-fabric-26su353-deb538a.jpg", hex: "#403f3f", pattern: "Pinstripe", family: "Charcoal Pattern", palette: "Slate Grey", tier: 2, description: "Slate Gray stripe in pure wool. Year-round, from business to evening." }, // $40/m
  { name: "26SU354.DEB539A", displayName: "Heritage Cobalt", img: "./assets/jacket-fabric-26su354-deb539a.jpg", hex: "#323245", pattern: "Solid", family: "Navy", palette: "Navy", tier: 2, description: "Cobalt solid in pure wool. Year-round, from business to evening." }, // $40/m
  { name: "26SU364.DEB545A", displayName: "Classic Olive Check", img: "./assets/jacket-fabric-26su364-deb545a.jpg", hex: "#403b2d", pattern: "Plaid", family: "Green Pattern", palette: "Forest Green", tier: 2, description: "Olive check in pure wool. A rich tone for fall and winter." }, // $40/m
  { name: "26SU365.DEB546A", displayName: "Rich Olive Check", img: "./assets/jacket-fabric-26su365-deb546a.jpg", hex: "#3e382f", pattern: "Plaid", family: "Green Pattern", palette: "Forest Green", tier: 2, description: "Olive check in pure wool. A rich tone for fall and winter." }, // $40/m
  { name: "26SU366.DEB547A", displayName: "Rich Navy Check", img: "./assets/jacket-fabric-26su366-deb547a.jpg", hex: "#2f353d", pattern: "Plaid", family: "Navy Pattern", palette: "Navy", tier: 2, description: "Navy check in pure wool. Year-round, from business to evening." }, // $40/m
  { name: "26SU274.DZZ0020", displayName: "Rich Ivory", img: "./assets/jacket-fabric-26su274-dzz0020.jpg", hex: "#efece3", pattern: "Solid", family: "Cream", palette: "Off White", tier: 2, description: "Ivory solid in Super 110s pure wool. Light and fresh for spring and summer." }, // $41/m
  { name: "26SU344.DEB5121", displayName: "Slate Gray Check", img: "./assets/jacket-fabric-26su344-deb5121.jpg", hex: "#464747", pattern: "Plaid", family: "Charcoal Pattern", palette: "Slate Grey", tier: 2, description: "Slate Gray check in pure wool. Versatile for any season." }, // $42/m
  { name: "26SU345.DEB5122", displayName: "Fine Navy Check", img: "./assets/jacket-fabric-26su345-deb5122.jpg", hex: "#2b303f", pattern: "Plaid", family: "Navy Pattern", palette: "Navy", tier: 2, description: "Navy check in pure wool. Year-round, from business to evening." }, // $42/m
  { name: "26MZ104.DAT5785", displayName: "Gray", img: "./assets/jacket-fabric-26mz104-dat5785.jpg", hex: "#5f5f5d", pattern: "Solid", family: "Gray", palette: "Mid Grey", tier: 2, description: "Gray solid in pure wool from Marzotto, Italy. Versatile for any season." }, // $45/m
  { name: "26MZ118.DAT5811", displayName: "Gray Stripe", img: "./assets/jacket-fabric-26mz118-dat5811.jpg", hex: "#736b67", pattern: "Pinstripe", family: "Gray Pattern", palette: "Mid Grey", tier: 2, description: "Gray stripe in pure wool from Marzotto, Italy. Versatile for any season." }, // $45/m
  { name: "26MZ120.DAT5813", displayName: "Classic Gray Stripe", img: "./assets/jacket-fabric-26mz120-dat5813.jpg", hex: "#636362", pattern: "Pinstripe", family: "Gray Pattern", palette: "Mid Grey", tier: 2, description: "Gray stripe in pure wool from Marzotto, Italy. Versatile for any season." }, // $45/m
  { name: "26MZ121.DAT5814", displayName: "Fine Navy Stripe", img: "./assets/jacket-fabric-26mz121-dat5814.jpg", hex: "#2c2c36", pattern: "Pinstripe", family: "Navy Pattern", palette: "Navy", tier: 2, description: "Navy stripe in pure wool from Marzotto, Italy. Year-round, from business to evening." }, // $45/m
  { name: "26MZ051.DAX9347", displayName: "Classic Navy", img: "./assets/jacket-fabric-26mz051-dax9347.jpg", hex: "#1e254c", pattern: "Solid", family: "Navy", palette: "Navy", tier: 2, description: "Navy solid in pure wool from Marzotto, Italy. Year-round, from business to evening." }, // $45/m
  { name: "26MZ050.DAX9350", displayName: "Heritage Slate Gray", img: "./assets/jacket-fabric-26mz050-dax9350.jpg", hex: "#54535d", pattern: "Solid", family: "Charcoal", palette: "Slate Grey", tier: 2, description: "Slate Gray solid in pure wool from Marzotto, Italy. Versatile for any season." }, // $45/m
  { name: "26MZ048.DAX9352", displayName: "Classic Sand", img: "./assets/jacket-fabric-26mz048-dax9352.jpg", hex: "#cfcacc", pattern: "Solid", family: "Khaki", palette: "Oat", tier: 2, description: "Sand solid in pure wool from Marzotto, Italy. Light and fresh for spring and summer." }, // $45/m
  { name: "26GB015.DAY4344", displayName: "Rich Navy", img: "./assets/jacket-fabric-26gb015-day4344.jpg", hex: "#2b3052", pattern: "Solid", family: "Navy", palette: "Navy", tier: 2, description: "Navy solid in pure wool from Guabello, Italy. Year-round, from business to evening." }, // $45/m
  { name: "26GB014.DAY4345", displayName: "Steel Blue", img: "./assets/jacket-fabric-26gb014-day4345.jpg", hex: "#3e55a0", pattern: "Solid", family: "Navy", palette: "Navy", tier: 2, description: "Steel Blue solid in pure wool from Guabello, Italy. Versatile for any season." }, // $45/m
  { name: "26GB009.DAY4347", displayName: "Rich Sand", img: "./assets/jacket-fabric-26gb009-day4347.jpg", hex: "#b9b3a5", pattern: "Solid", family: "Khaki", palette: "Oat", tier: 2, description: "Sand solid in pure wool from Guabello, Italy. Light and fresh for spring and summer." }, // $45/m
  { name: "26GB010.DAY4348", displayName: "Rich Stone", img: "./assets/jacket-fabric-26gb010-day4348.jpg", hex: "#908881", pattern: "Solid", family: "Khaki", palette: "Stone", tier: 2, description: "Stone solid in pure wool from Guabello, Italy. Versatile for any season." }, // $45/m
  { name: "26GB012.DAY4350", displayName: "Classic Olive", img: "./assets/jacket-fabric-26gb012-day4350.jpg", hex: "#3a3d34", pattern: "Solid", family: "Green", palette: "Forest Green", tier: 2, description: "Olive solid in pure wool from Guabello, Italy. A rich tone for fall and winter." }, // $45/m
  { name: "26GB011.DAY4351", displayName: "Fine Stone", img: "./assets/jacket-fabric-26gb011-day4351.jpg", hex: "#907957", pattern: "Solid", family: "Khaki", palette: "Stone", tier: 2, description: "Stone solid in pure wool from Guabello, Italy. Versatile for any season." }, // $45/m
  { name: "26GB084.DAY4355", displayName: "Stone Check", img: "./assets/jacket-fabric-26gb084-day4355.jpg", hex: "#7b7675", pattern: "Plaid", family: "Khaki Pattern", palette: "Stone", tier: 2, description: "Stone check in pure wool from Guabello, Italy. Versatile for any season." }, // $45/m
  { name: "26GB110.DAY4358", displayName: "Onyx Stripe", img: "./assets/jacket-fabric-26gb110-day4358.jpg", hex: "#28272a", pattern: "Pinstripe", family: "Black Pattern", palette: "Jet Black", tier: 2, description: "Onyx stripe in pure wool from Guabello, Italy. Year-round, from business to evening." }, // $45/m
  { name: "26GB111.DAY4359", displayName: "Heritage Navy Stripe", img: "./assets/jacket-fabric-26gb111-day4359.jpg", hex: "#26252f", pattern: "Pinstripe", family: "Navy Pattern", palette: "Navy", tier: 2, description: "Navy stripe in pure wool from Guabello, Italy. Year-round, from business to evening." }, // $45/m
  { name: "26GB078.DAY4366", displayName: "Classic Gray Check", img: "./assets/jacket-fabric-26gb078-day4366.jpg", hex: "#5a5c60", pattern: "Plaid", family: "Gray Pattern", palette: "Mid Grey", tier: 2, description: "Gray check in pure wool from Guabello, Italy. Versatile for any season." }, // $45/m
  { name: "26GB080.DAY4367", displayName: "Heritage Navy Check", img: "./assets/jacket-fabric-26gb080-day4367.jpg", hex: "#272b40", pattern: "Plaid", family: "Navy Pattern", palette: "Navy", tier: 2, description: "Navy check in pure wool from Guabello, Italy. Year-round, from business to evening." }, // $45/m
  { name: "26GB079.DAY4368", displayName: "Steel Blue Check", img: "./assets/jacket-fabric-26gb079-day4368.jpg", hex: "#354575", pattern: "Plaid", family: "Navy Pattern", palette: "Navy", tier: 2, description: "Steel Blue check in pure wool from Guabello, Italy. Year-round, from business to evening." }, // $45/m
  { name: "26GB044.DAY4378", displayName: "Rich Slate Gray Stripe", img: "./assets/jacket-fabric-26gb044-day4378.jpg", hex: "#525759", pattern: "Pinstripe", family: "Charcoal Pattern", palette: "Slate Grey", tier: 2, description: "Slate Gray stripe in pure wool from Guabello, Italy. Versatile for any season." }, // $45/m
  { name: "26GB045.DAY4379", displayName: "Rich Charcoal Stripe", img: "./assets/jacket-fabric-26gb045-day4379.jpg", hex: "#343a40", pattern: "Pinstripe", family: "Charcoal Pattern", palette: "Deep Charcoal", tier: 2, description: "Charcoal stripe in pure wool from Guabello, Italy. Year-round, from business to evening." }, // $45/m
  { name: "26GB046.DAY4380", displayName: "Royal Navy Stripe", img: "./assets/jacket-fabric-26gb046-day4380.jpg", hex: "#262b3f", pattern: "Pinstripe", family: "Navy Pattern", palette: "Navy", tier: 2, description: "Navy stripe in pure wool from Guabello, Italy. Year-round, from business to evening." }, // $45/m
  { name: "26GB096.DAY4385", displayName: "Classic Stone Check", img: "./assets/jacket-fabric-26gb096-day4385.jpg", hex: "#808283", pattern: "Plaid", family: "Khaki Pattern", palette: "Stone", tier: 2, description: "Stone check in pure wool from Guabello, Italy. Versatile for any season." }, // $45/m
  { name: "26GB099.DAY4386", displayName: "Royal Navy Check", img: "./assets/jacket-fabric-26gb099-day4386.jpg", hex: "#2b2e3a", pattern: "Plaid", family: "Navy Pattern", palette: "Navy", tier: 2, description: "Navy check in pure wool from Guabello, Italy. Year-round, from business to evening." }, // $45/m
  { name: "26GB100.DAY4387", displayName: "Savile Navy Check", img: "./assets/jacket-fabric-26gb100-day4387.jpg", hex: "#292b3f", pattern: "Plaid", family: "Navy Pattern", palette: "Navy", tier: 2, description: "Navy check in pure wool from Guabello, Italy. Year-round, from business to evening." }, // $45/m
  { name: "26GB108.DAY4403", displayName: "Fine Slate Gray Stripe", img: "./assets/jacket-fabric-26gb108-day4403.jpg", hex: "#4a494e", pattern: "Pinstripe", family: "Charcoal Pattern", palette: "Slate Grey", tier: 2, description: "Slate Gray stripe in pure wool from Guabello, Italy. Versatile for any season." }, // $45/m
  { name: "26GB042.DAY4416", displayName: "Cobalt Stripe", img: "./assets/jacket-fabric-26gb042-day4416.jpg", hex: "#292f45", pattern: "Pinstripe", family: "Navy Pattern", palette: "Navy", tier: 2, description: "Cobalt stripe in pure wool from Guabello, Italy. Year-round, from business to evening." }, // $45/m
  { name: "26GB054.DAY4419", displayName: "Wine Stripe", img: "./assets/jacket-fabric-26gb054-day4419.jpg", hex: "#332122", pattern: "Pinstripe", family: "Burgundy Pattern", palette: "Wine", tier: 2, description: "Wine stripe in pure wool from Guabello, Italy. A rich tone for fall and winter." }, // $45/m
  { name: "26GB024.DAY4465", displayName: "Fine Forest Green", img: "./assets/jacket-fabric-26gb024-day4465.jpg", hex: "#253129", pattern: "Solid", family: "Green", palette: "Forest Green", tier: 2, description: "Forest Green solid in pure wool from Guabello, Italy. A rich tone for fall and winter." }, // $45/m
  { name: "26VB017.DAY9076", displayName: "Classic Gray", img: "./assets/jacket-fabric-26vb017-day9076.jpg", hex: "#656b6e", pattern: "Solid", family: "Gray", palette: "Mid Grey", tier: 2, description: "Gray solid in pure wool from Vitale Barberis Canonico, Italy. Versatile for any season." }, // $45/m
  { name: "26VB024.DAY9079", displayName: "Fine Navy", img: "./assets/jacket-fabric-26vb024-day9079.jpg", hex: "#1f1f2f", pattern: "Solid", family: "Navy", palette: "Navy", tier: 2, description: "Navy solid in pure wool from Vitale Barberis Canonico, Italy. Year-round, from business to evening." }, // $45/m
  { name: "26VB018.DAY9082", displayName: "Rich Olive", img: "./assets/jacket-fabric-26vb018-day9082.jpg", hex: "#44564d", pattern: "Solid", family: "Green", palette: "Forest Green", tier: 2, description: "Olive solid in pure wool from Vitale Barberis Canonico, Italy. Versatile for any season." }, // $45/m
  { name: "26VB019.DAY9083", displayName: "Heritage Forest Green", img: "./assets/jacket-fabric-26vb019-day9083.jpg", hex: "#162b2a", pattern: "Solid", family: "Green", palette: "Forest Green", tier: 2, description: "Forest Green solid in pure wool from Vitale Barberis Canonico, Italy. A rich tone for fall and winter." }, // $45/m
  { name: "26VB038.DAY9086", displayName: "Sage", img: "./assets/jacket-fabric-26vb038-day9086.jpg", hex: "#81907f", pattern: "Solid", family: "Green", palette: "Forest Green", tier: 2, description: "Sage solid in pure wool from Vitale Barberis Canonico, Italy. Versatile for any season." }, // $45/m
  { name: "26VB039.DAY9087", displayName: "Fine Olive", img: "./assets/jacket-fabric-26vb039-day9087.jpg", hex: "#405758", pattern: "Solid", family: "Green", palette: "Forest Green", tier: 2, description: "Olive solid in pure wool from Vitale Barberis Canonico, Italy. Versatile for any season." }, // $45/m
  { name: "26VB041.DAY9089", displayName: "Burgundy", img: "./assets/jacket-fabric-26vb041-day9089.jpg", hex: "#7d2a34", pattern: "Solid", family: "Burgundy", palette: "Wine", tier: 2, description: "Burgundy solid in pure wool from Vitale Barberis Canonico, Italy. A rich tone for fall and winter." }, // $45/m
  { name: "26VB043.DAY9091", displayName: "Plum", img: "./assets/jacket-fabric-26vb043-day9091.jpg", hex: "#431a37", pattern: "Solid", family: "Purple", palette: "Plum", tier: 2, description: "Plum solid in pure wool from Vitale Barberis Canonico, Italy. A rich tone for fall and winter." }, // $45/m
  { name: "26VB095.DAY9129", displayName: "Classic Slate Gray Check", img: "./assets/jacket-fabric-26vb095-day9129.jpg", hex: "#424546", pattern: "Plaid", family: "Charcoal Pattern", palette: "Slate Grey", tier: 2, description: "Slate Gray check in Super 110s pure wool from Vitale Barberis Canonico, Italy. Year-round, from business to evening." }, // $45/m
  { name: "26VB096.DAY9130", displayName: "Windsor Navy Check", img: "./assets/jacket-fabric-26vb096-day9130.jpg", hex: "#353643", pattern: "Plaid", family: "Navy Pattern", palette: "Navy", tier: 2, description: "Navy check in Super 110s pure wool from Vitale Barberis Canonico, Italy. Year-round, from business to evening." }, // $45/m
  { name: "26VB083.DAY9131", displayName: "Savile Navy Stripe", img: "./assets/jacket-fabric-26vb083-day9131.jpg", hex: "#25292e", pattern: "Pinstripe", family: "Navy Pattern", palette: "Navy", tier: 2, description: "Navy stripe in Super 110s pure wool from Vitale Barberis Canonico, Italy. Year-round, from business to evening." }, // $45/m
  { name: "26VB084.DAY9132", displayName: "Classic Onyx Stripe", img: "./assets/jacket-fabric-26vb084-day9132.jpg", hex: "#1c2121", pattern: "Pinstripe", family: "Black Pattern", palette: "Jet Black", tier: 2, description: "Onyx stripe in Super 110s pure wool from Vitale Barberis Canonico, Italy. Year-round, from business to evening." }, // $45/m
  { name: "26VB088.DAY9134", displayName: "Rich Gray Stripe", img: "./assets/jacket-fabric-26vb088-day9134.jpg", hex: "#666b6c", pattern: "Pinstripe", family: "Gray Pattern", palette: "Mid Grey", tier: 2, description: "Gray stripe in Super 110s pure wool from Vitale Barberis Canonico, Italy. Versatile for any season." }, // $45/m
  { name: "26VB089.DAY9135", displayName: "Fine Charcoal Stripe", img: "./assets/jacket-fabric-26vb089-day9135.jpg", hex: "#39383b", pattern: "Pinstripe", family: "Charcoal Pattern", palette: "Deep Charcoal", tier: 2, description: "Charcoal stripe in Super 110s pure wool from Vitale Barberis Canonico, Italy. Year-round, from business to evening." }, // $45/m
  { name: "26VB090.DAY9136", displayName: "Windsor Navy Stripe", img: "./assets/jacket-fabric-26vb090-day9136.jpg", hex: "#2e2c36", pattern: "Pinstripe", family: "Navy Pattern", palette: "Navy", tier: 2, description: "Navy stripe in Super 110s pure wool from Vitale Barberis Canonico, Italy. Year-round, from business to evening." }, // $45/m
  { name: "26VB085.DAY9137", displayName: "Heritage Charcoal Stripe", img: "./assets/jacket-fabric-26vb085-day9137.jpg", hex: "#313536", pattern: "Pinstripe", family: "Charcoal Pattern", palette: "Deep Charcoal", tier: 2, description: "Charcoal stripe in Super 110s pure wool from Vitale Barberis Canonico, Italy. Year-round, from business to evening." }, // $45/m
  { name: "26VB086.DAY9138", displayName: "Mayfair Navy Stripe", img: "./assets/jacket-fabric-26vb086-day9138.jpg", hex: "#282e37", pattern: "Pinstripe", family: "Navy Pattern", palette: "Navy", tier: 2, description: "Navy stripe in Super 110s pure wool from Vitale Barberis Canonico, Italy. Year-round, from business to evening." }, // $45/m
  { name: "26VB092.DAY9140", displayName: "Fine Gray Stripe", img: "./assets/jacket-fabric-26vb092-day9140.jpg", hex: "#676e6f", pattern: "Pinstripe", family: "Gray Pattern", palette: "Mid Grey", tier: 2, description: "Gray stripe in Super 110s pure wool from Vitale Barberis Canonico, Italy. Versatile for any season." }, // $45/m
  { name: "26VB093.DAY9141", displayName: "Royal Charcoal Stripe", img: "./assets/jacket-fabric-26vb093-day9141.jpg", hex: "#292d2e", pattern: "Pinstripe", family: "Charcoal Pattern", palette: "Deep Charcoal", tier: 2, description: "Charcoal stripe in Super 110s pure wool from Vitale Barberis Canonico, Italy. Year-round, from business to evening." }, // $45/m
  { name: "26VB076.DAY9146", displayName: "Slate Gray Herringbone", img: "./assets/jacket-fabric-26vb076-day9146.jpg", hex: "#515657", pattern: "Herringbone", family: "Charcoal Pattern", palette: "Slate Grey", tier: 2, description: "Slate Gray herringbone in Super 110s pure wool from Vitale Barberis Canonico, Italy. Versatile for any season." }, // $45/m
  { name: "26VB077.DAY9147", displayName: "Classic Charcoal Herringbone", img: "./assets/jacket-fabric-26vb077-day9147.jpg", hex: "#353a3b", pattern: "Herringbone", family: "Charcoal Pattern", palette: "Deep Charcoal", tier: 2, description: "Charcoal herringbone in Super 110s pure wool from Vitale Barberis Canonico, Italy. Year-round, from business to evening." }, // $45/m
  { name: "26VB080.DAY9149", displayName: "Navy Herringbone", img: "./assets/jacket-fabric-26vb080-day9149.jpg", hex: "#252a37", pattern: "Herringbone", family: "Navy Pattern", palette: "Navy", tier: 2, description: "Navy herringbone in Super 110s pure wool from Vitale Barberis Canonico, Italy. Year-round, from business to evening." }, // $45/m
  { name: "26VB081.DAY9150", displayName: "Classic Navy Herringbone", img: "./assets/jacket-fabric-26vb081-day9150.jpg", hex: "#212429", pattern: "Herringbone", family: "Navy Pattern", palette: "Navy", tier: 2, description: "Navy herringbone in Super 110s pure wool from Vitale Barberis Canonico, Italy. Year-round, from business to evening." }, // $45/m
  { name: "26VB082.DAY9151", displayName: "Onyx Herringbone", img: "./assets/jacket-fabric-26vb082-day9151.jpg", hex: "#1b2021", pattern: "Herringbone", family: "Black Pattern", palette: "Jet Black", tier: 2, description: "Onyx herringbone in Super 110s pure wool from Vitale Barberis Canonico, Italy. Year-round, from business to evening." }, // $45/m
  { name: "26VB063.DAY9152", displayName: "Rich Gray", img: "./assets/jacket-fabric-26vb063-day9152.jpg", hex: "#666c6d", pattern: "Solid", family: "Gray", palette: "Mid Grey", tier: 2, description: "Gray solid in Super 110s pure wool from Vitale Barberis Canonico, Italy. Versatile for any season." }, // $45/m
  { name: "26VB064.DAY9153", displayName: "Royal Slate Gray", img: "./assets/jacket-fabric-26vb064-day9153.jpg", hex: "#474b4c", pattern: "Solid", family: "Charcoal", palette: "Slate Grey", tier: 2, description: "Slate Gray solid in Super 110s pure wool from Vitale Barberis Canonico, Italy. Versatile for any season." }, // $45/m
  { name: "26VB065.DAY9154", displayName: "Savile Charcoal", img: "./assets/jacket-fabric-26vb065-day9154.jpg", hex: "#2f3437", pattern: "Solid", family: "Charcoal", palette: "Deep Charcoal", tier: 2, description: "Charcoal solid in Super 110s pure wool from Vitale Barberis Canonico, Italy. Year-round, from business to evening." }, // $45/m
  { name: "26VB066.DAY9155", displayName: "Heritage Navy", img: "./assets/jacket-fabric-26vb066-day9155.jpg", hex: "#263148", pattern: "Solid", family: "Navy", palette: "Navy", tier: 2, description: "Navy solid in Super 110s pure wool from Vitale Barberis Canonico, Italy. Year-round, from business to evening." }, // $45/m
  { name: "26VB067.DAY9156", displayName: "Royal Navy", img: "./assets/jacket-fabric-26vb067-day9156.jpg", hex: "#2d3647", pattern: "Solid", family: "Navy", palette: "Navy", tier: 2, description: "Navy solid in Super 110s pure wool from Vitale Barberis Canonico, Italy. Year-round, from business to evening." }, // $45/m
  { name: "26VB046.DAY9159", displayName: "Dove Gray", img: "./assets/jacket-fabric-26vb046-day9159.jpg", hex: "#adb5b5", pattern: "Solid", family: "Gray", palette: "Dove Grey", tier: 2, description: "Dove Gray solid in Super 110s pure wool from Vitale Barberis Canonico, Italy. Light and fresh for spring and summer." }, // $45/m
  { name: "26VB047.DAY9160", displayName: "Classic Smoke Gray", img: "./assets/jacket-fabric-26vb047-day9160.jpg", hex: "#7e8686", pattern: "Solid", family: "Gray", palette: "Smoke", tier: 2, description: "Smoke Gray solid in Super 110s pure wool from Vitale Barberis Canonico, Italy. Versatile for any season." }, // $45/m
  { name: "26VB048.DAY9161", displayName: "Savile Slate Gray", img: "./assets/jacket-fabric-26vb048-day9161.jpg", hex: "#3e4445", pattern: "Solid", family: "Charcoal", palette: "Slate Grey", tier: 2, description: "Slate Gray solid in Super 110s pure wool from Vitale Barberis Canonico, Italy. Year-round, from business to evening." }, // $45/m
  { name: "26VB044.DAY9162", displayName: "Classic Dove Gray", img: "./assets/jacket-fabric-26vb044-day9162.jpg", hex: "#c4c5c3", pattern: "Solid", family: "Gray", palette: "Dove Grey", tier: 2, description: "Dove Gray solid in Super 110s pure wool from Vitale Barberis Canonico, Italy. Light and fresh for spring and summer." }, // $45/m
  { name: "26VB045.DAY9163", displayName: "Fine Gray", img: "./assets/jacket-fabric-26vb045-day9163.jpg", hex: "#71726e", pattern: "Solid", family: "Gray", palette: "Mid Grey", tier: 2, description: "Gray solid in Super 110s pure wool from Vitale Barberis Canonico, Italy. Versatile for any season." }, // $45/m
  { name: "26VB058.DAY9164", displayName: "Savile Navy", img: "./assets/jacket-fabric-26vb058-day9164.jpg", hex: "#242c34", pattern: "Solid", family: "Navy", palette: "Navy", tier: 2, description: "Navy solid in Super 110s pure wool from Vitale Barberis Canonico, Italy. Year-round, from business to evening." }, // $45/m
  { name: "26VB049.DAY9165", displayName: "Fine Ivory", img: "./assets/jacket-fabric-26vb049-day9165.jpg", hex: "#edede7", pattern: "Solid", family: "Cream", palette: "Off White", tier: 2, description: "Ivory solid in Super 110s pure wool from Vitale Barberis Canonico, Italy. Light and fresh for spring and summer." }, // $45/m
  { name: "26VB055.DAY9169", displayName: "Heritage Olive", img: "./assets/jacket-fabric-26vb055-day9169.jpg", hex: "#353c36", pattern: "Solid", family: "Green", palette: "Forest Green", tier: 2, description: "Olive solid in Super 110s pure wool from Vitale Barberis Canonico, Italy. A rich tone for fall and winter." }, // $45/m
  { name: "26VB056.DAY9170", displayName: "Windsor Navy", img: "./assets/jacket-fabric-26vb056-day9170.jpg", hex: "#273653", pattern: "Solid", family: "Navy", palette: "Navy", tier: 2, description: "Navy solid in Super 110s pure wool from Vitale Barberis Canonico, Italy. Year-round, from business to evening." }, // $45/m
  { name: "26VB113.DAY9172", displayName: "Smoke Gray Stripe", img: "./assets/jacket-fabric-26vb113-day9172.jpg", hex: "#767b7c", pattern: "Pinstripe", family: "Gray Pattern", palette: "Smoke", tier: 2, description: "Smoke Gray stripe in Super 120s pure wool from Vitale Barberis Canonico, Italy. Versatile for any season." }, // $45/m
  { name: "26VB114.DAY9173", displayName: "Heritage Slate Gray Stripe", img: "./assets/jacket-fabric-26vb114-day9173.jpg", hex: "#44494a", pattern: "Pinstripe", family: "Charcoal Pattern", palette: "Slate Grey", tier: 2, description: "Slate Gray stripe in Super 120s pure wool from Vitale Barberis Canonico, Italy. Versatile for any season." }, // $45/m
  { name: "26VB115.DAY9175", displayName: "Indigo Stripe", img: "./assets/jacket-fabric-26vb115-day9175.jpg", hex: "#3b485f", pattern: "Pinstripe", family: "Navy Pattern", palette: "Navy", tier: 2, description: "Indigo stripe in Super 120s pure wool from Vitale Barberis Canonico, Italy. Versatile for any season." }, // $45/m
  { name: "26VB116.DAY9176", displayName: "Chelsea Navy Stripe", img: "./assets/jacket-fabric-26vb116-day9176.jpg", hex: "#2b303e", pattern: "Pinstripe", family: "Navy Pattern", palette: "Navy", tier: 2, description: "Navy stripe in Super 120s pure wool from Vitale Barberis Canonico, Italy. Year-round, from business to evening." }, // $45/m
  { name: "26VB108.DAY9188", displayName: "Royal Forest Green", img: "./assets/jacket-fabric-26vb108-day9188.jpg", hex: "#2a2f2b", pattern: "Solid", family: "Green", palette: "Forest Green", tier: 2, description: "Forest Green solid in Super 120s pure wool from Vitale Barberis Canonico, Italy. A rich tone for fall and winter." }, // $45/m
  { name: "26VB110.DAY9189", displayName: "Mayfair Navy", img: "./assets/jacket-fabric-26vb110-day9189.jpg", hex: "#24252d", pattern: "Solid", family: "Navy", palette: "Navy", tier: 2, description: "Navy solid in Super 120s pure wool from Vitale Barberis Canonico, Italy. Year-round, from business to evening." }, // $45/m
  { name: "26RE048.DAY9208", displayName: "Rich Dove Gray", img: "./assets/jacket-fabric-26re048-day9208.jpg", hex: "#bebdc0", pattern: "Solid", family: "Gray", palette: "Dove Grey", tier: 2, description: "Dove Gray solid in Super 110s pure wool from Reda, Italy. Light and fresh for spring and summer." }, // $45/m
  { name: "26RE049.DAY9209", displayName: "Heritage Gray", img: "./assets/jacket-fabric-26re049-day9209.jpg", hex: "#62636b", pattern: "Solid", family: "Gray", palette: "Mid Grey", tier: 2, description: "Gray solid in Super 110s pure wool from Reda, Italy. Versatile for any season." }, // $45/m
  { name: "26RE050.DAY9210", displayName: "Royal Cobalt", img: "./assets/jacket-fabric-26re050-day9210.jpg", hex: "#393c4d", pattern: "Solid", family: "Navy", palette: "Navy", tier: 2, description: "Cobalt solid in Super 110s pure wool from Reda, Italy. Year-round, from business to evening." }, // $45/m
  { name: "26RE055.DAY9214", displayName: "Claret", img: "./assets/jacket-fabric-26re055-day9214.jpg", hex: "#1a100f", pattern: "Solid", family: "Burgundy", palette: "Wine", tier: 2, description: "Claret solid in Super 110s pure wool from Reda, Italy. A rich tone for fall and winter." }, // $45/m
  { name: "26RE065.DAY9242", displayName: "Classic Forest Green Stripe", img: "./assets/jacket-fabric-26re065-day9242.jpg", hex: "#1e201d", pattern: "Pinstripe", family: "Green Pattern", palette: "Forest Green", tier: 2, description: "Forest Green stripe in Super 130s pure wool from Reda, Italy. A rich tone for fall and winter." }, // $45/m
  { name: "26RE067.DAY9244", displayName: "Rich Forest Green Stripe", img: "./assets/jacket-fabric-26re067-day9244.jpg", hex: "#151a1f", pattern: "Pinstripe", family: "Green Pattern", palette: "Forest Green", tier: 2, description: "Forest Green stripe in Super 130s pure wool from Reda, Italy. A rich tone for fall and winter." }, // $45/m
  { name: "26RE102.DAY9249", displayName: "Royal Slate Gray Stripe", img: "./assets/jacket-fabric-26re102-day9249.jpg", hex: "#4c4d4d", pattern: "Pinstripe", family: "Charcoal Pattern", palette: "Slate Grey", tier: 2, description: "Slate Gray stripe in Super 130s pure wool from Reda, Italy. Versatile for any season." }, // $45/m
  { name: "26RE103.DAY9250", displayName: "Classic Midnight Navy Stripe", img: "./assets/jacket-fabric-26re103-day9250.jpg", hex: "#1b1e27", pattern: "Pinstripe", family: "Navy Pattern", palette: "Navy", tier: 2, description: "Midnight Navy stripe in Super 130s pure wool from Reda, Italy. Year-round, from business to evening." }, // $45/m
  { name: "26RE104.DAY9251", displayName: "Rich Midnight Navy Stripe", img: "./assets/jacket-fabric-26re104-day9251.jpg", hex: "#15151c", pattern: "Pinstripe", family: "Navy Pattern", palette: "Navy", tier: 2, description: "Midnight Navy stripe in Super 130s pure wool from Reda, Italy. Year-round, from business to evening." }, // $45/m
  { name: "26RE081.DAY9255", displayName: "Classic Cobalt Check", img: "./assets/jacket-fabric-26re081-day9255.jpg", hex: "#22242d", pattern: "Plaid", family: "Navy Pattern", palette: "Navy", tier: 2, description: "Cobalt check in Super 110s pure wool from Reda, Italy. Year-round, from business to evening." }, // $45/m
  { name: "26RE071.DAY9257", displayName: "Classic Charcoal Check", img: "./assets/jacket-fabric-26re071-day9257.jpg", hex: "#3a3c3d", pattern: "Plaid", family: "Charcoal Pattern", palette: "Deep Charcoal", tier: 2, description: "Charcoal check in Super 110s pure wool from Reda, Italy. Year-round, from business to evening." }, // $45/m
  { name: "26RE072.DAY9259", displayName: "Mayfair Navy Check", img: "./assets/jacket-fabric-26re072-day9259.jpg", hex: "#232833", pattern: "Plaid", family: "Navy Pattern", palette: "Navy", tier: 2, description: "Navy check in Super 110s pure wool from Reda, Italy. Year-round, from business to evening." }, // $45/m
  { name: "26VB097.DAY9267", displayName: "Dove Gray Check", img: "./assets/jacket-fabric-26vb097-day9267.jpg", hex: "#bdbeba", pattern: "Plaid", family: "Gray Pattern", palette: "Dove Grey", tier: 2, description: "Dove Gray check in pure wool from Vitale Barberis Canonico, Italy. Light and fresh for spring and summer." }, // $45/m
  { name: "26VB098.DAY9268", displayName: "Smoke Gray Check", img: "./assets/jacket-fabric-26vb098-day9268.jpg", hex: "#838989", pattern: "Plaid", family: "Gray Pattern", palette: "Smoke", tier: 2, description: "Smoke Gray check in pure wool from Vitale Barberis Canonico, Italy. Versatile for any season." }, // $45/m
  { name: "26VB099.DAY9269", displayName: "Chelsea Navy Check", img: "./assets/jacket-fabric-26vb099-day9269.jpg", hex: "#292e3a", pattern: "Plaid", family: "Navy Pattern", palette: "Navy", tier: 2, description: "Navy check in pure wool from Vitale Barberis Canonico, Italy. Year-round, from business to evening." }, // $45/m
  { name: "26VB100.DAY9273", displayName: "Rich Gray Check", img: "./assets/jacket-fabric-26vb100-day9273.jpg", hex: "#656a6a", pattern: "Plaid", family: "Gray Pattern", palette: "Mid Grey", tier: 2, description: "Gray check in pure wool from Vitale Barberis Canonico, Italy. Versatile for any season." }, // $45/m
  { name: "26VB102.DAY9274", displayName: "Oxford Navy Check", img: "./assets/jacket-fabric-26vb102-day9274.jpg", hex: "#29313a", pattern: "Plaid", family: "Navy Pattern", palette: "Navy", tier: 2, description: "Navy check in pure wool from Vitale Barberis Canonico, Italy. Year-round, from business to evening." }, // $45/m
  { name: "26VB070.DAY9276", displayName: "Gray Herringbone", img: "./assets/jacket-fabric-26vb070-day9276.jpg", hex: "#616667", pattern: "Herringbone", family: "Gray Pattern", palette: "Mid Grey", tier: 2, description: "Gray herringbone in pure wool from Vitale Barberis Canonico, Italy. Versatile for any season." }, // $45/m
  { name: "26VB059.DAY9284", displayName: "Royal Onyx", img: "./assets/jacket-fabric-26vb059-day9284.jpg", hex: "#1e2423", pattern: "Solid", family: "Black", palette: "Jet Black", tier: 2, description: "Onyx solid in pure wool from Vitale Barberis Canonico, Italy. Year-round, from business to evening." }, // $45/m
  { name: "26VB050.DAY9285", displayName: "Cream", img: "./assets/jacket-fabric-26vb050-day9285.jpg", hex: "#d3d2ca", pattern: "Solid", family: "Cream", palette: "Cream Ivory", tier: 2, description: "Cream solid in pure wool from Vitale Barberis Canonico, Italy. Light and fresh for spring and summer." }, // $45/m
  { name: "26VB103.DAY9290", displayName: "Fine Dove Gray", img: "./assets/jacket-fabric-26vb103-day9290.jpg", hex: "#b8bcbc", pattern: "Solid", family: "Gray", palette: "Dove Grey", tier: 2, description: "Dove Gray solid in Super 120s pure wool from Vitale Barberis Canonico, Italy. Light and fresh for spring and summer." }, // $45/m
  { name: "26VB104.DAY9291", displayName: "Rich Smoke Gray", img: "./assets/jacket-fabric-26vb104-day9291.jpg", hex: "#6f7576", pattern: "Solid", family: "Gray", palette: "Smoke", tier: 2, description: "Smoke Gray solid in Super 120s pure wool from Vitale Barberis Canonico, Italy. Versatile for any season." }, // $45/m
  { name: "26VB105.DAY9292", displayName: "Windsor Slate Gray", img: "./assets/jacket-fabric-26vb105-day9292.jpg", hex: "#414546", pattern: "Solid", family: "Charcoal", palette: "Slate Grey", tier: 2, description: "Slate Gray solid in Super 120s pure wool from Vitale Barberis Canonico, Italy. Year-round, from business to evening." }, // $45/m
  { name: "26VB109.DAY9293", displayName: "Chelsea Navy", img: "./assets/jacket-fabric-26vb109-day9293.jpg", hex: "#282b34", pattern: "Solid", family: "Navy", palette: "Navy", tier: 2, description: "Navy solid in Super 120s pure wool from Vitale Barberis Canonico, Italy. Year-round, from business to evening." }, // $45/m
  { name: "26VB111.DAY9294", displayName: "Savile Onyx", img: "./assets/jacket-fabric-26vb111-day9294.jpg", hex: "#1b1e1b", pattern: "Solid", family: "Black", palette: "Jet Black", tier: 2, description: "Onyx solid in Super 120s pure wool from Vitale Barberis Canonico, Italy. Year-round, from business to evening." }, // $45/m
  { name: "26RE079.DAY9302", displayName: "Rich Slate Gray Check", img: "./assets/jacket-fabric-26re079-day9302.jpg", hex: "#4f4a47", pattern: "Plaid", family: "Charcoal Pattern", palette: "Slate Grey", tier: 2, description: "Slate Gray check in pure wool from Reda, Italy. Versatile for any season." }, // $45/m
  { name: "26RE080.DAY9303", displayName: "Rich Charcoal Check", img: "./assets/jacket-fabric-26re080-day9303.jpg", hex: "#323333", pattern: "Plaid", family: "Charcoal Pattern", palette: "Deep Charcoal", tier: 2, description: "Charcoal check in pure wool from Reda, Italy. Year-round, from business to evening." }, // $45/m
];
// Color headings inside the New Fabrics section, in order, each listing the
// FABRIC_PALETTE colors it covers.
const NEW_FABRIC_COLOR_GROUPS = [
  ["Black", ["Jet Black"]],
  ["Navy & Blue", ["Navy"]],
  ["Charcoal & Gray", ["Deep Charcoal", "Slate Grey", "Mid Grey", "Smoke", "Light Grey", "Dove Grey"]],
  ["Khaki & Stone", ["Stone", "Khaki", "Oat"]],
  ["Ivory & Cream", ["Off White", "Cream Ivory"]],
  ["Green", ["Forest Green"]],
  ["Burgundy & Plum", ["Wine", "Plum"]],
];
NEW_FABRICS.forEach((f) => {
  let pt = FABRIC_PATTERN_TYPES.find((p) => p.name === f.pattern);
  if (!pt) { pt = { name: f.pattern, representativeImg: f.img, swatchHex: f.hex, colorFamilies: [] }; FABRIC_PATTERN_TYPES.push(pt); }
  let fam = pt.colorFamilies.find((c) => c.name === f.family);
  if (!fam) { fam = { name: f.family, swatchHex: f.hex, options: [] }; pt.colorFamilies.push(fam); }
  fam.options.push({ name: f.name, displayName: f.displayName, img: f.img, hex: f.hex, isNew: true });
});
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
  "26SU208.DLL0176": "Navy",
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
  "26SU195.DZZ0099": "Jet Black",
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
const FABRIC_TYPE_ORDER = ["Solid", "Plaid", "Herringbone", "Pinstripe", "Houndstooth"];
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
  "26SU195.DZZ0099": "Dark olive herringbone. A quietly unusual fall pick.",
  "26SU232.DZZ0131": "Smoky gray-black herringbone. Relaxed yet sharp.",
  "26SU191.DZZ0101": "Raven-dark herringbone. Great for winter evenings.",
  "26SU226.DBV6494": "Graphite plaid with a tonal check. Dark and formal.",
  "26SU207.DLL0175": "Deep cobalt navy solid. Crisp for business.",
  "26SU230.DZZ0129": "Steel-toned navy solid. A sharp office suit.",
  "26SU208.DLL0176": "Muted slate blue solid. Understated and versatile.",
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
// ---------------------------------------------------------------------
// Fabric price tiers. Each fabric's factory cost per meter (USD, from the
// factory's 26FW Swatch / LookBook fabric lists) puts it in one of three
// tiers, priced so every suit or jacket clears about $100 after the
// factory's fused-canvas CMT (suit $150 + 3.5 m of fabric, jacket $100 +
// 2.2 m). Tier 0 is up to $28/m, tier 1 $30-38/m, tier 2 $39-45/m.
// The price of an order item comes from fabricPriceTier() in main.js; a
// fabric missing from FABRIC_PRICE_TIER falls back to the top tier so a
// newly added fabric is never sold below cost.
// ---------------------------------------------------------------------
// Pants on their own (Daniel, 2026-10-22): from $150, stepping up with the
// fabric tier.
const FABRIC_PRICE_TIERS = [
  { suitUsd: 350, jacketUsd: 265, pantsUsd: 150 },
  { suitUsd: 385, jacketUsd: 285, pantsUsd: 165 },
  { suitUsd: 400, jacketUsd: 300, pantsUsd: 180 },
];
const FABRIC_PRICE_TIER = {
  "26SU210.DBP325A": 0, // $15/m Soft Ivory
  "26SU212.DBQ796A": 0, // $15/m Rich Slate Blue
  "26SU211.DBP323A": 0, // $17/m Deepest Mulberry Red
  "26SU213.DEE1018": 0, // $17/m Sterling Indigo Blue
  "26SU189.DPP0192": 0, // $20/m Muted Pewter
  "26SU190.DPP0193": 0, // $20/m Rich Midnight Blue
  "26SU221.DBV6499": 0, // $20/m Deepest Espresso
  "26SU225.DBV6495": 0, // $20/m Deep Umber
  "26SU226.DBV6494": 0, // $20/m Deepest Graphite
  "26SU175.DGG1132": 0, // $21.5/m Antique Pewter
  "26SU176.DGG1133": 0, // $21.5/m Antique Navy
  "26SU182.DGG1119": 0, // $21.5/m Dark Graphite
  "26SU183.DGG1120": 0, // $21.5/m Deep Cobalt
  "26SU204.DPP0191": 0, // $24/m Rich Onyx
  "26SU202.DBV3537": 0, // $25/m Deepest Forest
  "26SU214.DBV3534": 0, // $25/m Light Fog
  "26SU215.DBV3535": 0, // $25/m Muted Iron
  "26SU216.DBV3531": 0, // $25/m Sterling Navy
  "26SU217.DBV3530": 0, // $25/m Sterling Midnight Blue
  "26SU218.DBV3529": 0, // $25/m Smoky Onyx
  "26SU180.DGG1117": 0, // $26/m Muted Slate
  "26SU181.DGG1118": 0, // $26/m Deep Midnight Blue
  "26SU196.DLL0167": 0, // $27.5/m Warm Ivory
  "26SU199.DLL0169": 0, // $27.5/m Sterling Crimson
  "26SU200.DLL0170": 0, // $27.5/m Dark Terracotta
  "26SU201.DLL0168": 0, // $27.5/m Deep Berry
  "26SU203.DLL0160": 0, // $27.5/m Dark Smoke
  "26SU197.DLL0171": 0, // $28/m Refined Stone
  "26SU198.DLL0172": 0, // $28/m Rich Chestnut
  "26SU205.DLL0173": 0, // $28/m Soft Steel Blue
  "26SU206.DLL0174": 0, // $28/m Rich Cobalt
  "26SU207.DLL0175": 0, // $28/m Sterling Cobalt
  "26SU208.DLL0176": 0, // $28/m Dark Slate Blue
  "26SU209.DLL0177": 0, // $28/m Rich Ink
  "26SU233.DZZ0060": 1, // $30/m Deepest Charcoal
  "26SU234.DZZ0061": 1, // $30/m Deepest Cobalt
  "26SU173.DZZ0110": 1, // $35/m Rich Indigo Blue
  "26SU187.DZZ0108": 1, // $35/m Dark Midnight Blue
  "26SU188.DZZ0109": 1, // $35/m Smoky Eggplant
  "26SU193.DZZ0098": 1, // $36/m Refined Gray
  "26SU194.DZZ0100": 1, // $36/m Deep Walnut
  "26SU195.DZZ0099": 1, // $36/m Smoky Olive
  "26SU186.DZZ0107": 1, // $37/m Deep Indigo Blue
  "26SU219.DZZ0062": 1, // $38/m Muted Espresso
  "26SU220.DZZ0064": 1, // $38/m Deepest Navy
  "26SU238.DZZ0053": 1, // $38/m Deepest Sienna
  "26SU239.DZZ0055": 1, // $38/m Rich Charcoal
  "26SU240.DZZ0056": 1, // $38/m Deepest Midnight Blue
  "26SU241.DZZ0057": 1, // $38/m Smoky Plum
  "26SU242.DZZ0054": 1, // $38/m Rich Black
  "26SU179.DZZ0114": 2, // $39/m Dark Cobalt
  "26SU177.DZZ0112": 2, // $40/m Deepest Teal
  "26SU178.DZZ0113": 2, // $40/m Deep Navy
  "26SU222.DZZ0123": 2, // $40/m Deepest Smoke
  "26SU223.DZZ0125": 2, // $40/m Deepest Slate Blue
  "26SU224.DZZ0124": 2, // $40/m Dark Steel Blue
  "26SU243.DZZ0070": 2, // $40/m Deepest Brick
  "26SU244.DZZ0071": 2, // $40/m Dark Charcoal
  "26SU245.DZZ0072": 2, // $40/m Rich Raven
  "26SU246.DZZ0069": 2, // $40/m Deepest Steel Blue
  "26SU247.DZZ0073": 2, // $40/m Rich Steel Blue
  "26SU184.DZZ0103": 2, // $42/m Deep Graphite
  "26SU185.DZZ0105": 2, // $42/m Deep Slate Blue
  "26SU191.DZZ0101": 2, // $42/m Deep Raven
  "26SU192.DZZ0102": 2, // $42/m Dark Mulberry
  "26SU227.DZZ0126": 2, // $45/m Rich Walnut
  "26SU228.DZZ0127": 2, // $45/m Smoky Slate Blue
  "26SU229.DZZ0128": 2, // $45/m Deepest Indigo Blue
  "26SU230.DZZ0129": 2, // $45/m Deep Steel Blue
  "26SU231.DZZ0130": 2, // $45/m Sterling Jet
  "26SU232.DZZ0131": 2, // $45/m Deep Smoke
  "26SU235.DZZ0132": 2, // $45/m Deepest Amethyst
  "26SU236.DZZ0133": 2, // $45/m Smoky Mulberry
  "26SU237.DZZ0134": 2, // $45/m Deepest Onyx
};

// The New Fabrics' color, description and price tier (see NEW_FABRICS).
NEW_FABRICS.forEach((f) => {
  FABRIC_COLOR_ASSIGN[f.name] = f.palette;
  FABRIC_DESCRIPTIONS[f.name] = f.description;
  FABRIC_PRICE_TIER[f.name] = f.tier;
});

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
const LINING_MATCH_OPTION = { name: "Match Fabric", displayName: "Match Suit Fabric", specName: "Match Fabric", img: "./assets/match-fabric-color-icon.jpg", matchesFabric: true };
const LINING_UPLOAD_OPTION = { name: "Customer's Own Photo", displayName: "Upload Your Own Photo (+$80)", img: "./assets/match-fabric-color-icon.jpg", uploadPhoto: true, surchargeUsd: 80 };
JACKET_CATALOG.lining = {
  label: "Lining Fabric",
  // The suit picture generator still knows this step by its old name.
  specLabel: "Lining",
  column: "jacket_lining",
  patternTypes: LINING_PATTERN_TYPES,
  // Back from a color's linings returns to that pattern type's color boxes,
  // not all the way to the list of linings (see renderPatternTypeOptions).
  backToColorFamilies: true,
  specialOptions: [LINING_MATCH_OPTION, LINING_UPLOAD_OPTION],
  // An unlined jacket has no body or sleeve lining: the factory refuses a
  // lining fabric with "No lining" (Daniel, 2026-10-21).
  hiddenWhenEquals: { key: "facing", value: "No Lining Construction" },
  options: [LINING_MATCH_OPTION, LINING_UPLOAD_OPTION].concat(flattenPatternTypes(LINING_PATTERN_TYPES)),
};

JACKET_CATALOG.threadColor = {
  label: "Thread Color",
  flatColorTiles: true, // plain color tiles, dark to light, like Fabric (see renderFlatColorTiles in main.js)
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
  // Only offered once a real lapel buttonhole is picked: with "No Lapel
  // Buttonhole" there's no buttonhole to color, so the step is hidden and
  // any color picked earlier is cleared (see isApplicable in main.js).
  requiresOtherThan: { key: "lapelbuttonhole", value: "No Lapel Buttonhole" },
  column: "jacket_buttonhole_thread_color",
  colorFamilies: BUTTONHOLE_THREAD_COLOR_FAMILIES,
  specialOptions: [MATCH_FABRIC_COLOR_OPTION],
  options: [MATCH_FABRIC_COLOR_OPTION].concat(flattenColorFamilies(BUTTONHOLE_THREAD_COLOR_FAMILIES)),
};
// The thread around the jacket's other buttonholes -- the front closure and
// the sleeve cuffs. Added 2026-10-11 at Daniel's request: until then only the
// lapel buttonhole had a color. Same 49 colors and flat tiles as the lapel
// step, always offered (every jacket has front buttonholes).
JACKET_CATALOG.frontButtonholeThreadColor = {
  label: "Front & Sleeve Buttonhole Color",
  flatColorTiles: true,
  column: "jacket_front_buttonhole_thread_color",
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
  label: "Under-Collar Felt",
  // The suit picture generator still knows this step by its old name.
  specLabel: "Felt Under Collar",
  column: "felt_under_collar",
  description: "The felt under collar is a hidden layer sewn beneath the outer collar fabric, on the underside against your shirt -- it's never visible when worn, but its material affects the collar's structure and cost.",
  options: [
    { name: "Match Felt Undercollar", displayName: "Matching Felt", specName: "Match Felt Undercollar", img: "./assets/jacket-felt-new-match.jpg", badge: "Standard" },
    { name: "Customer-Appointed Felt", displayName: "Choose a Felt Color", specName: "Choose Your Felt", img: "./assets/jacket-felt-new-customer.jpg" },
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
  flatColorTiles: true, // plain color tiles, dark to light, like Fabric (see renderFlatColorTiles in main.js)
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
  { name: "Horn", prefixes: ["KNJ", "KNG"], representativeImg: "./assets/button-photo-knj014.jpg" },
  { name: "Shell", prefixes: ["KB"], representativeImg: "./assets/button-photo-kb113.jpg" },
  { name: "Corozo", prefixes: ["KG"], representativeImg: "./assets/button-photo-kg198.jpg" },
  // Polyester buttons are shown to customers as "Classic" (stored values
  // are the button codes, so the label is display-only).
  { name: "Classic", prefixes: ["KSZ"], representativeImg: "./assets/button-photo-ksz255.jpg" },
];
const BUTTON_COLOR_SORT = ["Black", "Navy", "Gray", "Blue", "Purple", "Green", "Brown", "Tortoiseshell", "Burgundy", "Red", "Tan", "Cream", "Pink", "White", "Multi-Color"];
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
  label: "Buttons",
  // The suit picture generator still knows this step by its old name.
  specLabel: "Button Color",
  column: "button_color",
  colorFamilies: BUTTON_TYPES,
  // Wording for the family-picker UI, since these groups are materials
  // rather than colors (see renderColorFamilyOptions in main.js).
  familyCountNoun: "button",
  familyBackLabel: "All Button Types",
  familySpecLabel: "button",
  compactCards: true, // smaller button cards: 3 per row on phones, 4 on desktop
  specialOptions: [BEST_MATCH_FABRIC_BUTTON_OPTION],
  options: [BEST_MATCH_FABRIC_BUTTON_OPTION].concat(flattenColorFamilies(BUTTON_COLOR_FAMILIES)),
};

PANTS_CATALOG.threadColor = {
  label: "Thread Color",
  flatColorTiles: true, // plain color tiles, dark to light, like Fabric (see renderFlatColorTiles in main.js)
  column: "pants_thread_color",
  colorFamilies: THREAD_COLOR_FAMILIES,
  specialOptions: [MATCH_FABRIC_COLOR_OPTION],
  options: [MATCH_FABRIC_COLOR_OPTION].concat(flattenColorFamilies(THREAD_COLOR_FAMILIES)),
};
PANTS_CATALOG.monogramThreadColor = {
  label: "Monogram Thread Color",
  flatColorTiles: true, // plain color tiles, dark to light, like Fabric (see renderFlatColorTiles in main.js)
  column: "pants_monogram_thread_color",
  colorFamilies: MONOGRAM_THREAD_COLOR_FAMILIES,
  options: flattenColorFamilies(MONOGRAM_THREAD_COLOR_FAMILIES),
  requiresOtherThan: { key: "monogram", value: "No Monogram Need" },
};

// Monogram fonts: the factory's 11 embroidery fonts (Kutetailor System
// embroidery, codes RC01-RC11). The stored name is the factory's font name
// and factoryCode is printed on the order form. The factory's fonts aren't
// web fonts, so `css` is the closest free Google font, used only to show
// the customer's typed monogram on the site (see MONOGRAM_FONTS_CSS_URL).
// Grouped by look (script, classic, block); the first is the default.
const MONOGRAM_FONT_OPTIONS = [
  { group: "Script", name: "Calligraphy", factoryCode: "RC01", css: "'Great Vibes', cursive", size: 1.25 },
  { group: "Script", name: "Script", factoryCode: "RC04", css: "'Allura', cursive", size: 1.3 },
  { group: "Script", name: "Book Script", factoryCode: "RC07", css: "'Parisienne', cursive", size: 1.15 },
  { group: "Script", name: "Gradl", factoryCode: "RC09", css: "'Pinyon Script', cursive", size: 1.15 },
  { group: "Script", name: "Bradley", factoryCode: "RC05", css: "'Caveat', cursive", weight: 500, size: 1.2 },
  { group: "Classic", name: "Times Roman", factoryCode: "RC02", css: "'Tinos', 'Times New Roman', serif" },
  { group: "Classic", name: "Cochin", factoryCode: "RC11", css: "'Cormorant Garamond', Georgia, serif", weight: 600, size: 1.1 },
  { group: "Classic", name: "Kennerley Old Style Bold", displayName: "Kennerley Old Style", factoryCode: "RC10", css: "'Goudy Bookletter 1911', Georgia, serif", weight: 700 },
  { group: "Classic", name: "Old English", factoryCode: "RC08", css: "'UnifrakturMaguntia', serif", size: 1.1 },
  { group: "Block", name: "Block", factoryCode: "RC03", css: "'Oswald', 'Arial Narrow', sans-serif", weight: 500 },
  { group: "Block", name: "Bank Gothic Light BT", displayName: "Bank Gothic", factoryCode: "RC06", css: "'Michroma', sans-serif", size: 0.8 },
];
const MONOGRAM_FONTS_CSS_URL = "https://fonts.googleapis.com/css2?family=Great+Vibes&family=Tinos&family=Oswald:wght@500&family=Allura&family=Caveat:wght@500&family=Michroma&family=Parisienne&family=UnifrakturMaguntia&family=Pinyon+Script&family=Goudy+Bookletter+1911&family=Cormorant+Garamond:wght@600&display=swap";
// The factory's limits on the typed text, checked by monogramTextProblem().
const MONOGRAM_TEXT_RULES = {
  maxUnits: 24, // capital letters count as 2
  unsupported: "?\u00e0\u00e2\u00ea\u00e8\u00eb\u00ee\u00ef\u00f4\u00fb\u00fc\u00f9\u00e7",
};
JACKET_CATALOG.monogramFont = {
  label: "Monogram Font",
  column: "jacket_monogram_font",
  description: "The lettering style your jacket monogram is embroidered in.",
  fontCards: true, // cards show the customer's own text in each font (see renderInlineFonts in main.js)
  inlineWith: "monogram", // picked on the monogram step, under the text box; no step of its own
  options: MONOGRAM_FONT_OPTIONS,
  requiresOtherThan: { key: "monogram", value: "No Monogram Need" },
};
PANTS_CATALOG.monogramFont = {
  label: "Monogram Font",
  column: "pants_monogram_font",
  description: "The lettering style your pants monogram is embroidered in.",
  fontCards: true,
  inlineWith: "monogram",
  options: MONOGRAM_FONT_OPTIONS,
  requiresOtherThan: { key: "monogram", value: "No Monogram Need" },
};

// Thread Color sits right after Button Nail Method (Sleeves group on the
// jacket, Bottom & Details on pants). Buttonhole Thread Color is jacket-only
// (removed from pants 2026-10-07): it sits right after Lapel Buttonhole
// (Collar & Lapel group), since that's the buttonhole its thread actually
// sews. Neither garment offers a Handmade Lapel Buttonhole Thread Color option anymore.
// Monogram Thread Color is the exception: it stays in Personalization,
// right after Monogram Placement, since it only ever applies once a real
// monogram is chosen.
// Monogram Font goes between them (placement, font, thread color).
JACKET_CATALOG_GROUPS.find((g) => g.label === "Personalization").keys.push("monogramFont", "monogramThreadColor");
PANTS_CATALOG_GROUPS.find((g) => g.label === "Personalization").keys.push("monogramFont", "monogramThreadColor");

// Each thread step says plainly which thread it is for -- "Thread Color"
// alone left customers guessing (seams? buttonholes? buttons?). Labels and
// descriptions only; the stored columns are unchanged.
JACKET_CATALOG.threadColor.label = "Button Thread Color";
JACKET_CATALOG.threadColor.description = "The thread your jacket's buttons are sewn on with.";
JACKET_CATALOG.buttonholeThreadColor.description = "The thread stitched around the buttonhole on your lapel.";
JACKET_CATALOG.frontButtonholeThreadColor.description = "The thread stitched around the buttonholes on your jacket front and sleeves.";
JACKET_CATALOG.monogramThreadColor.description = "The thread your jacket monogram is embroidered in.";
PANTS_CATALOG.threadColor.label = "Button Thread Color";
PANTS_CATALOG.threadColor.description = "The thread your pants buttons are sewn on with.";
PANTS_CATALOG.monogramThreadColor.description = "The thread your pants monogram is embroidered in.";

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
  "26SU208.DLL0176": { sprite: "./assets/fabric-zoom-sprite-00.avif", col: 4, row: 3 },
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
  "26SU195.DZZ0099": { sprite: "./assets/fabric-zoom-sprite-02.avif", col: 1, row: 0 }
};
// === FABRIC_ZOOM_MAP:END ===
// New Fabrics: one 1200 px photo per fabric (a one-tile "sprite").
Object.assign(FABRIC_ZOOM_MAP, {
  "26SU273.DBT604A": { sprite: "./assets/fabric-zoom-26su273-dbt604a.avif", col: 0, row: 0, tile: 1200 },
  "26SU083.DBV396A": { sprite: "./assets/fabric-zoom-26su083-dbv396a.avif", col: 0, row: 0, tile: 1200 },
  "26SU084.DBV397A": { sprite: "./assets/fabric-zoom-26su084-dbv397a.avif", col: 0, row: 0, tile: 1200 },
  "26SU085.DBV400A": { sprite: "./assets/fabric-zoom-26su085-dbv400a.avif", col: 0, row: 0, tile: 1200 },
  "26SU086.DBV401A": { sprite: "./assets/fabric-zoom-26su086-dbv401a.avif", col: 0, row: 0, tile: 1200 },
  "26SU087.DBV402A": { sprite: "./assets/fabric-zoom-26su087-dbv402a.avif", col: 0, row: 0, tile: 1200 },
  "26SU088.DBV403A": { sprite: "./assets/fabric-zoom-26su088-dbv403a.avif", col: 0, row: 0, tile: 1200 },
  "26SU076.DBV405A": { sprite: "./assets/fabric-zoom-26su076-dbv405a.avif", col: 0, row: 0, tile: 1200 },
  "26SU118.DBV386A": { sprite: "./assets/fabric-zoom-26su118-dbv386a.avif", col: 0, row: 0, tile: 1200 },
  "26SU117.DBV389A": { sprite: "./assets/fabric-zoom-26su117-dbv389a.avif", col: 0, row: 0, tile: 1200 },
  "26L6.DEB5111": { sprite: "./assets/fabric-zoom-26l6-deb5111.avif", col: 0, row: 0, tile: 1200 },
  "26L6.DEB5114": { sprite: "./assets/fabric-zoom-26l6-deb5114.avif", col: 0, row: 0, tile: 1200 },
  "26SU073.DGG1130": { sprite: "./assets/fabric-zoom-26su073-dgg1130.avif", col: 0, row: 0, tile: 1200 },
  "26SU074.DGG1131": { sprite: "./assets/fabric-zoom-26su074-dgg1131.avif", col: 0, row: 0, tile: 1200 },
  "26SU106.DAV7773": { sprite: "./assets/fabric-zoom-26su106-dav7773.avif", col: 0, row: 0, tile: 1200 },
  "26SU112.DAV7777": { sprite: "./assets/fabric-zoom-26su112-dav7777.avif", col: 0, row: 0, tile: 1200 },
  "26SU071.DBV4054": { sprite: "./assets/fabric-zoom-26su071-dbv4054.avif", col: 0, row: 0, tile: 1200 },
  "26SU108.DBV4754": { sprite: "./assets/fabric-zoom-26su108-dbv4754.avif", col: 0, row: 0, tile: 1200 },
  "26SU110.DBV4765": { sprite: "./assets/fabric-zoom-26su110-dbv4765.avif", col: 0, row: 0, tile: 1200 },
  "26SU103.DBV5296": { sprite: "./assets/fabric-zoom-26su103-dbv5296.avif", col: 0, row: 0, tile: 1200 },
  "26SU104.DBV5297": { sprite: "./assets/fabric-zoom-26su104-dbv5297.avif", col: 0, row: 0, tile: 1200 },
  "26SU107.DBV5298": { sprite: "./assets/fabric-zoom-26su107-dbv5298.avif", col: 0, row: 0, tile: 1200 },
  "26SU111.DBV5304": { sprite: "./assets/fabric-zoom-26su111-dbv5304.avif", col: 0, row: 0, tile: 1200 },
  "26SU120.DBV5579": { sprite: "./assets/fabric-zoom-26su120-dbv5579.avif", col: 0, row: 0, tile: 1200 },
  "26SU368.DBV5953": { sprite: "./assets/fabric-zoom-26su368-dbv5953.avif", col: 0, row: 0, tile: 1200 },
  "26SU369.DBV5955": { sprite: "./assets/fabric-zoom-26su369-dbv5955.avif", col: 0, row: 0, tile: 1200 },
  "26SU094.DBV6378": { sprite: "./assets/fabric-zoom-26su094-dbv6378.avif", col: 0, row: 0, tile: 1200 },
  "26SU099.DEE2023": { sprite: "./assets/fabric-zoom-26su099-dee2023.avif", col: 0, row: 0, tile: 1200 },
  "26SU102.DEE2027": { sprite: "./assets/fabric-zoom-26su102-dee2027.avif", col: 0, row: 0, tile: 1200 },
  "26SU089.DZZ0004": { sprite: "./assets/fabric-zoom-26su089-dzz0004.avif", col: 0, row: 0, tile: 1200 },
  "26SU095.DZZ0010": { sprite: "./assets/fabric-zoom-26su095-dzz0010.avif", col: 0, row: 0, tile: 1200 },
  "26SU096.DZZ0013": { sprite: "./assets/fabric-zoom-26su096-dzz0013.avif", col: 0, row: 0, tile: 1200 },
  "26L8.DBT6768": { sprite: "./assets/fabric-zoom-26l8-dbt6768.avif", col: 0, row: 0, tile: 1200 },
  "26L8.DBT6772": { sprite: "./assets/fabric-zoom-26l8-dbt6772.avif", col: 0, row: 0, tile: 1200 },
  "26SU078.DLL0153": { sprite: "./assets/fabric-zoom-26su078-dll0153.avif", col: 0, row: 0, tile: 1200 },
  "26SU079.DLL0154": { sprite: "./assets/fabric-zoom-26su079-dll0154.avif", col: 0, row: 0, tile: 1200 },
  "26L8.DBT6770": { sprite: "./assets/fabric-zoom-26l8-dbt6770.avif", col: 0, row: 0, tile: 1200 },
  "26L8.DZZ0094": { sprite: "./assets/fabric-zoom-26l8-dzz0094.avif", col: 0, row: 0, tile: 1200 },
  "26SU280.DZZ0016": { sprite: "./assets/fabric-zoom-26su280-dzz0016.avif", col: 0, row: 0, tile: 1200 },
  "26SU281.DZZ0017": { sprite: "./assets/fabric-zoom-26su281-dzz0017.avif", col: 0, row: 0, tile: 1200 },
  "26SU279.DZZ0019": { sprite: "./assets/fabric-zoom-26su279-dzz0019.avif", col: 0, row: 0, tile: 1200 },
  "26SU275.DZZ0021": { sprite: "./assets/fabric-zoom-26su275-dzz0021.avif", col: 0, row: 0, tile: 1200 },
  "26SU097.DZZ0085": { sprite: "./assets/fabric-zoom-26su097-dzz0085.avif", col: 0, row: 0, tile: 1200 },
  "26SU098.DZZ0086": { sprite: "./assets/fabric-zoom-26su098-dzz0086.avif", col: 0, row: 0, tile: 1200 },
  "26SU348.DEB510A": { sprite: "./assets/fabric-zoom-26su348-deb510a.avif", col: 0, row: 0, tile: 1200 },
  "26SU338.DEB513A": { sprite: "./assets/fabric-zoom-26su338-deb513a.avif", col: 0, row: 0, tile: 1200 },
  "26SU372.DEB520A": { sprite: "./assets/fabric-zoom-26su372-deb520a.avif", col: 0, row: 0, tile: 1200 },
  "26SU374.DEB522A": { sprite: "./assets/fabric-zoom-26su374-deb522a.avif", col: 0, row: 0, tile: 1200 },
  "26SU376.DEB524A": { sprite: "./assets/fabric-zoom-26su376-deb524a.avif", col: 0, row: 0, tile: 1200 },
  "26SU377.DEB526A": { sprite: "./assets/fabric-zoom-26su377-deb526a.avif", col: 0, row: 0, tile: 1200 },
  "26SU355.DEB527A": { sprite: "./assets/fabric-zoom-26su355-deb527a.avif", col: 0, row: 0, tile: 1200 },
  "26SU359.DEB531A": { sprite: "./assets/fabric-zoom-26su359-deb531a.avif", col: 0, row: 0, tile: 1200 },
  "26SU360.DEB532A": { sprite: "./assets/fabric-zoom-26su360-deb532a.avif", col: 0, row: 0, tile: 1200 },
  "26SU351.DEB536A": { sprite: "./assets/fabric-zoom-26su351-deb536a.avif", col: 0, row: 0, tile: 1200 },
  "26SU353.DEB538A": { sprite: "./assets/fabric-zoom-26su353-deb538a.avif", col: 0, row: 0, tile: 1200 },
  "26SU354.DEB539A": { sprite: "./assets/fabric-zoom-26su354-deb539a.avif", col: 0, row: 0, tile: 1200 },
  "26SU364.DEB545A": { sprite: "./assets/fabric-zoom-26su364-deb545a.avif", col: 0, row: 0, tile: 1200 },
  "26SU365.DEB546A": { sprite: "./assets/fabric-zoom-26su365-deb546a.avif", col: 0, row: 0, tile: 1200 },
  "26SU366.DEB547A": { sprite: "./assets/fabric-zoom-26su366-deb547a.avif", col: 0, row: 0, tile: 1200 },
  "26SU274.DZZ0020": { sprite: "./assets/fabric-zoom-26su274-dzz0020.avif", col: 0, row: 0, tile: 1200 },
  "26SU344.DEB5121": { sprite: "./assets/fabric-zoom-26su344-deb5121.avif", col: 0, row: 0, tile: 1200 },
  "26SU345.DEB5122": { sprite: "./assets/fabric-zoom-26su345-deb5122.avif", col: 0, row: 0, tile: 1200 },
  "26MZ104.DAT5785": { sprite: "./assets/fabric-zoom-26mz104-dat5785.avif", col: 0, row: 0, tile: 1200 },
  "26MZ118.DAT5811": { sprite: "./assets/fabric-zoom-26mz118-dat5811.avif", col: 0, row: 0, tile: 1200 },
  "26MZ120.DAT5813": { sprite: "./assets/fabric-zoom-26mz120-dat5813.avif", col: 0, row: 0, tile: 1200 },
  "26MZ121.DAT5814": { sprite: "./assets/fabric-zoom-26mz121-dat5814.avif", col: 0, row: 0, tile: 1200 },
  "26MZ051.DAX9347": { sprite: "./assets/fabric-zoom-26mz051-dax9347.avif", col: 0, row: 0, tile: 1200 },
  "26MZ050.DAX9350": { sprite: "./assets/fabric-zoom-26mz050-dax9350.avif", col: 0, row: 0, tile: 1200 },
  "26MZ048.DAX9352": { sprite: "./assets/fabric-zoom-26mz048-dax9352.avif", col: 0, row: 0, tile: 1200 },
  "26GB015.DAY4344": { sprite: "./assets/fabric-zoom-26gb015-day4344.avif", col: 0, row: 0, tile: 1200 },
  "26GB014.DAY4345": { sprite: "./assets/fabric-zoom-26gb014-day4345.avif", col: 0, row: 0, tile: 1200 },
  "26GB009.DAY4347": { sprite: "./assets/fabric-zoom-26gb009-day4347.avif", col: 0, row: 0, tile: 1200 },
  "26GB010.DAY4348": { sprite: "./assets/fabric-zoom-26gb010-day4348.avif", col: 0, row: 0, tile: 1200 },
  "26GB012.DAY4350": { sprite: "./assets/fabric-zoom-26gb012-day4350.avif", col: 0, row: 0, tile: 1200 },
  "26GB011.DAY4351": { sprite: "./assets/fabric-zoom-26gb011-day4351.avif", col: 0, row: 0, tile: 1200 },
  "26GB084.DAY4355": { sprite: "./assets/fabric-zoom-26gb084-day4355.avif", col: 0, row: 0, tile: 1200 },
  "26GB110.DAY4358": { sprite: "./assets/fabric-zoom-26gb110-day4358.avif", col: 0, row: 0, tile: 1200 },
  "26GB111.DAY4359": { sprite: "./assets/fabric-zoom-26gb111-day4359.avif", col: 0, row: 0, tile: 1200 },
  "26GB078.DAY4366": { sprite: "./assets/fabric-zoom-26gb078-day4366.avif", col: 0, row: 0, tile: 1200 },
  "26GB080.DAY4367": { sprite: "./assets/fabric-zoom-26gb080-day4367.avif", col: 0, row: 0, tile: 1200 },
  "26GB079.DAY4368": { sprite: "./assets/fabric-zoom-26gb079-day4368.avif", col: 0, row: 0, tile: 1200 },
  "26GB044.DAY4378": { sprite: "./assets/fabric-zoom-26gb044-day4378.avif", col: 0, row: 0, tile: 1200 },
  "26GB045.DAY4379": { sprite: "./assets/fabric-zoom-26gb045-day4379.avif", col: 0, row: 0, tile: 1200 },
  "26GB046.DAY4380": { sprite: "./assets/fabric-zoom-26gb046-day4380.avif", col: 0, row: 0, tile: 1200 },
  "26GB096.DAY4385": { sprite: "./assets/fabric-zoom-26gb096-day4385.avif", col: 0, row: 0, tile: 1200 },
  "26GB099.DAY4386": { sprite: "./assets/fabric-zoom-26gb099-day4386.avif", col: 0, row: 0, tile: 1200 },
  "26GB100.DAY4387": { sprite: "./assets/fabric-zoom-26gb100-day4387.avif", col: 0, row: 0, tile: 1200 },
  "26GB108.DAY4403": { sprite: "./assets/fabric-zoom-26gb108-day4403.avif", col: 0, row: 0, tile: 1200 },
  "26GB042.DAY4416": { sprite: "./assets/fabric-zoom-26gb042-day4416.avif", col: 0, row: 0, tile: 1200 },
  "26GB054.DAY4419": { sprite: "./assets/fabric-zoom-26gb054-day4419.avif", col: 0, row: 0, tile: 1200 },
  "26GB024.DAY4465": { sprite: "./assets/fabric-zoom-26gb024-day4465.avif", col: 0, row: 0, tile: 1200 },
  "26VB017.DAY9076": { sprite: "./assets/fabric-zoom-26vb017-day9076.avif", col: 0, row: 0, tile: 1200 },
  "26VB024.DAY9079": { sprite: "./assets/fabric-zoom-26vb024-day9079.avif", col: 0, row: 0, tile: 1200 },
  "26VB018.DAY9082": { sprite: "./assets/fabric-zoom-26vb018-day9082.avif", col: 0, row: 0, tile: 1200 },
  "26VB019.DAY9083": { sprite: "./assets/fabric-zoom-26vb019-day9083.avif", col: 0, row: 0, tile: 1200 },
  "26VB038.DAY9086": { sprite: "./assets/fabric-zoom-26vb038-day9086.avif", col: 0, row: 0, tile: 1200 },
  "26VB039.DAY9087": { sprite: "./assets/fabric-zoom-26vb039-day9087.avif", col: 0, row: 0, tile: 1200 },
  "26VB041.DAY9089": { sprite: "./assets/fabric-zoom-26vb041-day9089.avif", col: 0, row: 0, tile: 1200 },
  "26VB043.DAY9091": { sprite: "./assets/fabric-zoom-26vb043-day9091.avif", col: 0, row: 0, tile: 1200 },
  "26VB095.DAY9129": { sprite: "./assets/fabric-zoom-26vb095-day9129.avif", col: 0, row: 0, tile: 1200 },
  "26VB096.DAY9130": { sprite: "./assets/fabric-zoom-26vb096-day9130.avif", col: 0, row: 0, tile: 1200 },
  "26VB083.DAY9131": { sprite: "./assets/fabric-zoom-26vb083-day9131.avif", col: 0, row: 0, tile: 1200 },
  "26VB084.DAY9132": { sprite: "./assets/fabric-zoom-26vb084-day9132.avif", col: 0, row: 0, tile: 1200 },
  "26VB088.DAY9134": { sprite: "./assets/fabric-zoom-26vb088-day9134.avif", col: 0, row: 0, tile: 1200 },
  "26VB089.DAY9135": { sprite: "./assets/fabric-zoom-26vb089-day9135.avif", col: 0, row: 0, tile: 1200 },
  "26VB090.DAY9136": { sprite: "./assets/fabric-zoom-26vb090-day9136.avif", col: 0, row: 0, tile: 1200 },
  "26VB085.DAY9137": { sprite: "./assets/fabric-zoom-26vb085-day9137.avif", col: 0, row: 0, tile: 1200 },
  "26VB086.DAY9138": { sprite: "./assets/fabric-zoom-26vb086-day9138.avif", col: 0, row: 0, tile: 1200 },
  "26VB092.DAY9140": { sprite: "./assets/fabric-zoom-26vb092-day9140.avif", col: 0, row: 0, tile: 1200 },
  "26VB093.DAY9141": { sprite: "./assets/fabric-zoom-26vb093-day9141.avif", col: 0, row: 0, tile: 1200 },
  "26VB076.DAY9146": { sprite: "./assets/fabric-zoom-26vb076-day9146.avif", col: 0, row: 0, tile: 1200 },
  "26VB077.DAY9147": { sprite: "./assets/fabric-zoom-26vb077-day9147.avif", col: 0, row: 0, tile: 1200 },
  "26VB080.DAY9149": { sprite: "./assets/fabric-zoom-26vb080-day9149.avif", col: 0, row: 0, tile: 1200 },
  "26VB081.DAY9150": { sprite: "./assets/fabric-zoom-26vb081-day9150.avif", col: 0, row: 0, tile: 1200 },
  "26VB082.DAY9151": { sprite: "./assets/fabric-zoom-26vb082-day9151.avif", col: 0, row: 0, tile: 1200 },
  "26VB063.DAY9152": { sprite: "./assets/fabric-zoom-26vb063-day9152.avif", col: 0, row: 0, tile: 1200 },
  "26VB064.DAY9153": { sprite: "./assets/fabric-zoom-26vb064-day9153.avif", col: 0, row: 0, tile: 1200 },
  "26VB065.DAY9154": { sprite: "./assets/fabric-zoom-26vb065-day9154.avif", col: 0, row: 0, tile: 1200 },
  "26VB066.DAY9155": { sprite: "./assets/fabric-zoom-26vb066-day9155.avif", col: 0, row: 0, tile: 1200 },
  "26VB067.DAY9156": { sprite: "./assets/fabric-zoom-26vb067-day9156.avif", col: 0, row: 0, tile: 1200 },
  "26VB046.DAY9159": { sprite: "./assets/fabric-zoom-26vb046-day9159.avif", col: 0, row: 0, tile: 1200 },
  "26VB047.DAY9160": { sprite: "./assets/fabric-zoom-26vb047-day9160.avif", col: 0, row: 0, tile: 1200 },
  "26VB048.DAY9161": { sprite: "./assets/fabric-zoom-26vb048-day9161.avif", col: 0, row: 0, tile: 1200 },
  "26VB044.DAY9162": { sprite: "./assets/fabric-zoom-26vb044-day9162.avif", col: 0, row: 0, tile: 1200 },
  "26VB045.DAY9163": { sprite: "./assets/fabric-zoom-26vb045-day9163.avif", col: 0, row: 0, tile: 1200 },
  "26VB058.DAY9164": { sprite: "./assets/fabric-zoom-26vb058-day9164.avif", col: 0, row: 0, tile: 1200 },
  "26VB049.DAY9165": { sprite: "./assets/fabric-zoom-26vb049-day9165.avif", col: 0, row: 0, tile: 1200 },
  "26VB055.DAY9169": { sprite: "./assets/fabric-zoom-26vb055-day9169.avif", col: 0, row: 0, tile: 1200 },
  "26VB056.DAY9170": { sprite: "./assets/fabric-zoom-26vb056-day9170.avif", col: 0, row: 0, tile: 1200 },
  "26VB113.DAY9172": { sprite: "./assets/fabric-zoom-26vb113-day9172.avif", col: 0, row: 0, tile: 1200 },
  "26VB114.DAY9173": { sprite: "./assets/fabric-zoom-26vb114-day9173.avif", col: 0, row: 0, tile: 1200 },
  "26VB115.DAY9175": { sprite: "./assets/fabric-zoom-26vb115-day9175.avif", col: 0, row: 0, tile: 1200 },
  "26VB116.DAY9176": { sprite: "./assets/fabric-zoom-26vb116-day9176.avif", col: 0, row: 0, tile: 1200 },
  "26VB108.DAY9188": { sprite: "./assets/fabric-zoom-26vb108-day9188.avif", col: 0, row: 0, tile: 1200 },
  "26VB110.DAY9189": { sprite: "./assets/fabric-zoom-26vb110-day9189.avif", col: 0, row: 0, tile: 1200 },
  "26RE048.DAY9208": { sprite: "./assets/fabric-zoom-26re048-day9208.avif", col: 0, row: 0, tile: 1200 },
  "26RE049.DAY9209": { sprite: "./assets/fabric-zoom-26re049-day9209.avif", col: 0, row: 0, tile: 1200 },
  "26RE050.DAY9210": { sprite: "./assets/fabric-zoom-26re050-day9210.avif", col: 0, row: 0, tile: 1200 },
  "26RE055.DAY9214": { sprite: "./assets/fabric-zoom-26re055-day9214.avif", col: 0, row: 0, tile: 1200 },
  "26RE065.DAY9242": { sprite: "./assets/fabric-zoom-26re065-day9242.avif", col: 0, row: 0, tile: 1200 },
  "26RE067.DAY9244": { sprite: "./assets/fabric-zoom-26re067-day9244.avif", col: 0, row: 0, tile: 1200 },
  "26RE102.DAY9249": { sprite: "./assets/fabric-zoom-26re102-day9249.avif", col: 0, row: 0, tile: 1200 },
  "26RE103.DAY9250": { sprite: "./assets/fabric-zoom-26re103-day9250.avif", col: 0, row: 0, tile: 1200 },
  "26RE104.DAY9251": { sprite: "./assets/fabric-zoom-26re104-day9251.avif", col: 0, row: 0, tile: 1200 },
  "26RE081.DAY9255": { sprite: "./assets/fabric-zoom-26re081-day9255.avif", col: 0, row: 0, tile: 1200 },
  "26RE071.DAY9257": { sprite: "./assets/fabric-zoom-26re071-day9257.avif", col: 0, row: 0, tile: 1200 },
  "26RE072.DAY9259": { sprite: "./assets/fabric-zoom-26re072-day9259.avif", col: 0, row: 0, tile: 1200 },
  "26VB097.DAY9267": { sprite: "./assets/fabric-zoom-26vb097-day9267.avif", col: 0, row: 0, tile: 1200 },
  "26VB098.DAY9268": { sprite: "./assets/fabric-zoom-26vb098-day9268.avif", col: 0, row: 0, tile: 1200 },
  "26VB099.DAY9269": { sprite: "./assets/fabric-zoom-26vb099-day9269.avif", col: 0, row: 0, tile: 1200 },
  "26VB100.DAY9273": { sprite: "./assets/fabric-zoom-26vb100-day9273.avif", col: 0, row: 0, tile: 1200 },
  "26VB102.DAY9274": { sprite: "./assets/fabric-zoom-26vb102-day9274.avif", col: 0, row: 0, tile: 1200 },
  "26VB070.DAY9276": { sprite: "./assets/fabric-zoom-26vb070-day9276.avif", col: 0, row: 0, tile: 1200 },
  "26VB059.DAY9284": { sprite: "./assets/fabric-zoom-26vb059-day9284.avif", col: 0, row: 0, tile: 1200 },
  "26VB050.DAY9285": { sprite: "./assets/fabric-zoom-26vb050-day9285.avif", col: 0, row: 0, tile: 1200 },
  "26VB103.DAY9290": { sprite: "./assets/fabric-zoom-26vb103-day9290.avif", col: 0, row: 0, tile: 1200 },
  "26VB104.DAY9291": { sprite: "./assets/fabric-zoom-26vb104-day9291.avif", col: 0, row: 0, tile: 1200 },
  "26VB105.DAY9292": { sprite: "./assets/fabric-zoom-26vb105-day9292.avif", col: 0, row: 0, tile: 1200 },
  "26VB109.DAY9293": { sprite: "./assets/fabric-zoom-26vb109-day9293.avif", col: 0, row: 0, tile: 1200 },
  "26VB111.DAY9294": { sprite: "./assets/fabric-zoom-26vb111-day9294.avif", col: 0, row: 0, tile: 1200 },
  "26RE079.DAY9302": { sprite: "./assets/fabric-zoom-26re079-day9302.avif", col: 0, row: 0, tile: 1200 },
  "26RE080.DAY9303": { sprite: "./assets/fabric-zoom-26re080-day9303.avif", col: 0, row: 0, tile: 1200 },
});

// === STEP TAGLINES:START ===
// One fun sentence per step, shown under each step's title in place of the
// plain "Choose one." hint (see tagline in main.js renderOptions).
const JACKET_STEP_TAGLINES = {
  pickStitch: "Tiny stitches that brag about being handmade.",
  collar: "Your lapels walk into the room before you do.",
  lapelwidth: "Skinny, classic or full 1970s game show host.",
  lapelbuttonhole: "A tiny slit with big boutonniere dreams.",
  frontbutton: "How many buttons are on the payroll.",
  sleevecrown: "Shoulders: smooth operator or a little extra.",
  pockettype: "A cozy apartment for your pocket square.",
  lowerpocket: "Where your hands go when the small talk dies.",
  buttonNail: "A secret stitch. Tell no one.",
  construction: "The guts of the jacket. Abs optional.",
  facing: "The inside trim that winks when your jacket swings open.",
  insidepocket: "Secret pockets for pens, phones and emergency snacks.",
  monogram: "Your initials, for when the jacket gets lost at a wedding.",
  backvent: "The slit that lets you sit without splitting.",
  sleevecuffstyle: "Working buttonholes: the tailor's secret handshake.",
  cuffbuttons: "Wrist bling for people who talk with their hands.",
  fabric: "The star of the show. Everything else is backup dancers.",
  lining: "Business on the outside, party on the inside.",
  threadColor: "Blend in quietly or let your seams show off.",
  buttonholeThreadColor: "Match the suit or let your buttonholes flirt a little.",
  frontButtonholeThreadColor: "Matching thread or a tiny bit of mischief up front.",
  feltundercollar: "", // intentionally no one-liner
  feltColor: "A sneaky pop of color for dramatic collar flips.",
  monogramThreadColor: "Whisper your initials or shout them.",
  monogramFont: "Pick a font. Your initials have feelings too.",
  buttoncolor: "Jewelry for your jacket. Bling optional."
};
const PANTS_STEP_TAGLINES = {
  pickStitch: "Tiny stitches so your pants can keep up with your jacket.",
  waistLineHeight: "Where your pants sit: regular or high and mighty.",
  waistbandExtension: "The little tab that holds everything together. Literally.",
  waistbandStyle: "How your waist gets hugged.",
  frontPleat: "Sleek flat front or extra room for Thanksgiving.",
  beltLoops: "Loops, fancy X's or belts are for quitters.",
  frontPocket: "Where your hands go when you're thinking hard.",
  bottomStyle: "Clean hem or a cuff with a little attitude.",
  buttonNail: "A secret stitch. Tell no one.",
  watchPocket: "A tiny pocket for a watch, a coin or a very small secret.",
  monogram: "Your initials, in case your pants ever wander off.",
  backPocket: "Buttons, flaps or nothing. Your rear, your rules.",
  fabric: "The cloth your legs will brag about.",
  threadColor: "Blend in quietly or let your seams show off.",
  monogramThreadColor: "Whisper your initials or shout them.",
  monogramFont: "Pick a font. Your initials have feelings too."
};
Object.keys(JACKET_STEP_TAGLINES).forEach((k) => { if (JACKET_CATALOG[k]) JACKET_CATALOG[k].tagline = JACKET_STEP_TAGLINES[k]; });
Object.keys(PANTS_STEP_TAGLINES).forEach((k) => { if (PANTS_CATALOG[k]) PANTS_CATALOG[k].tagline = PANTS_STEP_TAGLINES[k]; });
// === STEP TAGLINES:END ===

// === CLASSIC SUIT PRESET ===
// A third card on "What are we building?" (Daniel, 2026-10-11): a full suit
// where the customer only picks the fabric (4 dark solids: 2 black, 2 navy),
// single or double breasted, and the lapel style. Everything else is fixed:
// SB is always two buttons, DB the standard 6X2; standard lapel width;
// lining, buttons and threads match the fabric; 5 slant cuff buttons. The
// pants are fixed too (fabric same as the jacket) and the Pants step is
// skipped. See setPreset() in createDesigner (main.js).
//   steps:   the only questions asked, in the designer's usual order
//   allowed: options offered for a step (others hidden)
//   fixed:   values filled in for every other question
//   fixedBySelection: extra fixed values that depend on a pick (a Shawl or
//            Diamond lapel takes its own lapel buttonhole)
const CLASSIC_SUIT_PRESET = {
  jacket: {
    steps: ["fabric", "frontbutton", "collar", "lowerpocket"],
    allowed: {
      // Single welt or flap, each straight or slanted (Daniel, 2026-10-11).
      lowerpocket: ["Double Besom Pocket", "Double Besom Slant Pocket", "Double Besom W/ Flap", "Slant Pocket Flap"],
      fabric: ["26SU218.DBV3529", "26SU209.DLL0177", "26SU216.DBV3531", "26SU217.DBV3530"],
      frontbutton: ["Single Breasted Two Buttons", "Double Breasted 6X2"],
    },
    fixed: {
      lapelwidth: "9 cm",
      pockettype: "Normal Pocket",
      backvent: "Side Vent",
      // The slant cuff styles were removed from the site (Daniel, 2026-10-19).
      sleevecuffstyle: "Working Sleeve Cuff",
      cuffbuttons: "5 Slant Overlap Button",
      buttoncolor: "Best Match to Fabric",
      lining: "Match Fabric",
      lapelbuttonhole: "Standard",
      buttonholeThreadColor: "Match Fabric Color",
      frontButtonholeThreadColor: "Match Fabric Color",
      feltundercollar: "Match Felt Undercollar",
      threadColor: "Match Fabric Color",
      buttonNail: "X Shape Sewing Button",
      insidepocket: "Regular Inner Pocket",
      monogram: "No Monogram Need",
      construction: "Fused Construction",
      facing: "Round Shape Facing",
      sleevecrown: "Regular Armhole",
      pickStitch: "No Pick Stitching",
    },
    fixedBySelection: {
      collar: {
        "Shawl": { lapelbuttonhole: "No Lapel Buttonhole" },
        "Diamond Lapel": { lapelbuttonhole: "No Lapel Buttonhole", lapelwidth: "8 cm" },
      },
    },
  },
  pants: {
    // One pants question: hem or a classic cuff (Daniel, 2026-10-11).
    steps: ["bottomStyle"],
    allowed: {
      bottomStyle: ["Turn Up Bottom", "W/ Cuff 4.0 cm"],
    },
    fixed: {
      fabric: "__same_as__fabric",
      frontPleat: "No Pleat",
      waistLineHeight: "4.0 cm",
      waistbandStyle: "Normal Waistband",
      waistbandExtension: "Round Shape 5cm",
      beltLoops: "Belt Loops",
      frontPocket: "Slant Pocket",
      backPocket: "Double Besom Pocket",
      watchPocket: "No Watch Pocket",
      threadColor: "Match Fabric Color",
      buttonNail: "X Shape Sewing Button",
      monogram: "No Monogram Need",
      pickStitch: "No Pick Stitching",
    },
  },
};

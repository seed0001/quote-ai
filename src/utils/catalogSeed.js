// Seed data for the Price Catalog. These are generalized, ballpark remodel
// products with typical retail pricing — meant as a starting point the user can
// edit. Prices are intentionally rough and static until live price tracking is
// integrated later. `price` is per `unit`.
export const DEFAULT_CATALOG = [
  // --- Plumbing ---
  { id: 'cat-plumb-tub', name: 'Standard Alcove Bathtub (60")', category: 'Plumbing', unit: 'each', price: 250, store: 'Home Depot / Lowe\'s', description: 'White acrylic 60-inch alcove tub, left or right drain.' },
  { id: 'cat-plumb-toilet', name: 'Two-Piece Toilet (standard)', category: 'Plumbing', unit: 'each', price: 130, store: 'Home Depot / Lowe\'s', description: 'Elongated 2-piece toilet, 1.28 GPF.' },
  { id: 'cat-plumb-toilet-ch', name: 'Comfort-Height Toilet', category: 'Plumbing', unit: 'each', price: 220, store: 'Ferguson / Home Depot', description: 'ADA comfort-height elongated toilet, dual flush.' },
  { id: 'cat-plumb-sink-drop', name: 'Drop-In Bathroom Sink', category: 'Plumbing', unit: 'each', price: 70, store: 'Lowe\'s', description: 'White vitreous china drop-in lavatory sink.' },
  { id: 'cat-plumb-sink-under', name: 'Undermount Bathroom Sink', category: 'Plumbing', unit: 'each', price: 90, store: 'Build.com', description: 'Oval undermount porcelain bathroom sink.' },
  { id: 'cat-plumb-faucet-bath', name: 'Bathroom Faucet (widespread)', category: 'Plumbing', unit: 'each', price: 110, store: 'Home Depot', description: 'Widespread 2-handle lavatory faucet, brushed nickel.' },
  { id: 'cat-plumb-faucet-kit', name: 'Kitchen Faucet (pull-down)', category: 'Plumbing', unit: 'each', price: 180, store: 'Lowe\'s', description: 'Single-handle pull-down kitchen faucet, stainless.' },
  { id: 'cat-plumb-sink-kit', name: 'Stainless Kitchen Sink (double bowl)', category: 'Plumbing', unit: 'each', price: 240, store: 'Home Depot', description: '18-gauge double-bowl undermount stainless sink.' },
  { id: 'cat-plumb-valve', name: 'Shower Valve & Trim Kit', category: 'Plumbing', unit: 'each', price: 160, store: 'Ferguson', description: 'Pressure-balance shower valve with trim, chrome.' },
  { id: 'cat-plumb-tankless', name: 'Tankless Water Heater (gas)', category: 'Plumbing', unit: 'each', price: 950, store: 'Home Depot / Ferguson', description: 'Gas tankless water heater, ~199k BTU.' },
  { id: 'cat-plumb-wh40', name: '40-Gallon Water Heater', category: 'Plumbing', unit: 'each', price: 550, store: 'Lowe\'s', description: '40-gallon natural gas water heater.' },
  { id: 'cat-plumb-shower-door', name: 'Frameless Shower Door', category: 'Plumbing', unit: 'each', price: 600, store: 'Home Depot', description: 'Frameless glass shower door, 3/8-inch tempered.' },
  { id: 'cat-plumb-pex', name: 'PEX Supply Rough-In (per fixture)', category: 'Plumbing', unit: 'each', price: 35, store: 'Local plumbing supply', description: 'PEX supply line rough-in materials per fixture.' },

  // --- Lighting ---
  { id: 'cat-light-recessed', name: 'Recessed LED Downlight (6")', category: 'Lighting', unit: 'each', price: 25, store: 'Home Depot', description: '6-inch canless LED recessed light, dimmable.' },
  { id: 'cat-light-vanity', name: 'Vanity Light Bar', category: 'Lighting', unit: 'each', price: 90, store: 'Lowe\'s', description: '3-light vanity bar, brushed nickel.' },
  { id: 'cat-light-fan', name: 'Ceiling Fan w/ Light', category: 'Lighting', unit: 'each', price: 140, store: 'Home Depot', description: '52-inch ceiling fan with LED light kit.' },
  { id: 'cat-light-pendant', name: 'Pendant Light Fixture', category: 'Lighting', unit: 'each', price: 80, store: 'Build.com', description: 'Single modern pendant light fixture.' },
  { id: 'cat-light-exhaust', name: 'Bath Exhaust Fan', category: 'Lighting', unit: 'each', price: 110, store: 'Home Depot', description: '110 CFM low-sone bath exhaust fan.' },

  // --- Electrical ---
  { id: 'cat-elec-gfci', name: 'GFCI Outlet', category: 'Electrical', unit: 'each', price: 22, store: 'Lowe\'s', description: '20A tamper-resistant GFCI receptacle.' },
  { id: 'cat-elec-device', name: 'Outlet / Switch (Decora)', category: 'Electrical', unit: 'each', price: 4, store: 'Home Depot', description: 'Standard Decora outlet or switch, per device.' },
  { id: 'cat-elec-dimmer', name: 'Dimmer Switch', category: 'Electrical', unit: 'each', price: 25, store: 'Lowe\'s', description: 'LED-compatible dimmer switch.' },
  { id: 'cat-elec-panel', name: 'Electrical Panel (200A)', category: 'Electrical', unit: 'each', price: 350, store: 'Home Depot', description: '200-amp main breaker load center.' },
  { id: 'cat-elec-romex', name: 'Romex 12/2 Wire (250 ft)', category: 'Electrical', unit: 'each', price: 120, store: 'Home Depot', description: '12/2 NM-B copper wire, 250 ft roll.' },

  // --- Tile & Stone ---
  { id: 'cat-tile-porc', name: 'Porcelain Floor Tile', category: 'Tile & Stone', unit: 'sq ft', price: 3.50, store: 'Floor & Decor', description: 'Mid-range porcelain floor tile.' },
  { id: 'cat-tile-ceramic', name: 'Ceramic Wall Tile', category: 'Tile & Stone', unit: 'sq ft', price: 2.25, store: 'Floor & Decor / Lowe\'s', description: 'Glazed ceramic wall tile.' },
  { id: 'cat-tile-marble', name: 'Natural Stone Tile (marble)', category: 'Tile & Stone', unit: 'sq ft', price: 9.00, store: 'Floor & Decor', description: 'Marble field/mosaic tile.' },
  { id: 'cat-tile-thinset', name: 'Thinset Mortar (50 lb)', category: 'Tile & Stone', unit: 'each', price: 18, store: 'Home Depot', description: 'Modified thinset mortar, 50 lb bag.' },
  { id: 'cat-tile-grout', name: 'Grout (25 lb)', category: 'Tile & Stone', unit: 'each', price: 22, store: 'Floor & Decor', description: 'Sanded grout, 25 lb.' },
  { id: 'cat-tile-backer', name: 'Cement Backer Board (3x5)', category: 'Tile & Stone', unit: 'each', price: 14, store: 'Lowe\'s', description: '1/2-inch cement backer board sheet.' },
  { id: 'cat-tile-leveler', name: 'Self-Leveling Underlayment (bag)', category: 'Tile & Stone', unit: 'each', price: 35, store: 'Home Depot', description: 'Floor leveling compound, per bag.' },

  // --- Flooring ---
  { id: 'cat-floor-lvp', name: 'Luxury Vinyl Plank (LVP)', category: 'Flooring', unit: 'sq ft', price: 2.80, store: 'Lowe\'s / Floor & Decor', description: 'Waterproof rigid-core LVP.' },
  { id: 'cat-floor-laminate', name: 'Laminate Flooring', category: 'Flooring', unit: 'sq ft', price: 1.80, store: 'Home Depot', description: 'Laminate plank flooring.' },
  { id: 'cat-floor-hardwood', name: 'Engineered Hardwood', category: 'Flooring', unit: 'sq ft', price: 5.50, store: 'Floor & Decor', description: 'Engineered hardwood flooring.' },
  { id: 'cat-floor-carpet', name: 'Carpet w/ Pad', category: 'Flooring', unit: 'sq ft', price: 3.25, store: 'Home Depot / Lowe\'s', description: 'Mid-grade carpet with padding.' },

  // --- Cabinets & Tops ---
  { id: 'cat-cab-base', name: 'Stock Base Cabinet (24")', category: 'Cabinets & Tops', unit: 'each', price: 180, store: 'Home Depot / Lowe\'s', description: '24-inch stock base cabinet.' },
  { id: 'cat-cab-wall', name: 'Stock Wall Cabinet (30")', category: 'Cabinets & Tops', unit: 'each', price: 150, store: 'Lowe\'s', description: '30-inch stock wall cabinet.' },
  { id: 'cat-cab-vanity', name: 'Bathroom Vanity (36" w/ top)', category: 'Cabinets & Tops', unit: 'each', price: 450, store: 'Home Depot', description: '36-inch vanity with cultured marble top.' },
  { id: 'cat-cab-hardware', name: 'Cabinet Hardware (pull/knob)', category: 'Cabinets & Tops', unit: 'each', price: 4, store: 'Home Depot', description: 'Cabinet pull or knob, per piece.' },
  { id: 'cat-cab-quartz', name: 'Quartz Countertop (installed)', category: 'Cabinets & Tops', unit: 'sq ft', price: 75, store: 'Local fabricator', description: 'Quartz countertop fabricated & installed.' },
  { id: 'cat-cab-granite', name: 'Granite Countertop (installed)', category: 'Cabinets & Tops', unit: 'sq ft', price: 60, store: 'Local fabricator', description: 'Granite countertop fabricated & installed.' },
  { id: 'cat-cab-laminate-top', name: 'Laminate Countertop', category: 'Cabinets & Tops', unit: 'linear ft', price: 30, store: 'Lowe\'s', description: 'Pre-formed laminate countertop.' },

  // --- Drywall ---
  { id: 'cat-dry-sheet', name: 'Drywall Sheet (1/2" 4x8)', category: 'Drywall', unit: 'each', price: 14, store: 'Home Depot', description: '1/2-inch drywall sheet, 4x8.' },
  { id: 'cat-dry-mr', name: 'Moisture-Resistant Drywall (4x8)', category: 'Drywall', unit: 'each', price: 18, store: 'Lowe\'s', description: 'Green board moisture-resistant drywall.' },
  { id: 'cat-dry-mud', name: 'Joint Compound (4.5 gal)', category: 'Drywall', unit: 'each', price: 16, store: 'Home Depot', description: 'All-purpose joint compound bucket.' },

  // --- Framing & Insulation ---
  { id: 'cat-frame-stud', name: '2x4 Stud (8 ft)', category: 'Framing', unit: 'each', price: 4, store: 'Home Depot / Menards', description: 'SPF 2x4x8 framing stud.' },
  { id: 'cat-frame-ply', name: 'Plywood Sheathing (3/4" 4x8)', category: 'Framing', unit: 'each', price: 55, store: 'Home Depot', description: '3/4-inch plywood sheet, 4x8.' },
  { id: 'cat-insul-batt', name: 'Fiberglass Insulation (R-13 batt)', category: 'Insulation', unit: 'sq ft', price: 0.65, store: 'Home Depot', description: 'R-13 fiberglass batt insulation.' },

  // --- Painting ---
  { id: 'cat-paint-int', name: 'Interior Paint (gallon)', category: 'Painting', unit: 'each', price: 40, store: 'Sherwin-Williams / Home Depot', description: 'Premium interior latex paint, per gallon.' },
  { id: 'cat-paint-primer', name: 'Primer (gallon)', category: 'Painting', unit: 'each', price: 28, store: 'Sherwin-Williams', description: 'Interior primer/sealer, per gallon.' },

  // --- Doors & Trim ---
  { id: 'cat-door-int', name: 'Pre-Hung Interior Door', category: 'Doors & Trim', unit: 'each', price: 150, store: 'Home Depot / Lowe\'s', description: 'Pre-hung hollow-core interior door with jamb.' },
  { id: 'cat-door-ext', name: 'Exterior Entry Door', category: 'Doors & Trim', unit: 'each', price: 400, store: 'Home Depot', description: 'Insulated steel exterior entry door, slab + frame.' },
  { id: 'cat-trim-base', name: 'Baseboard Moulding (MDF)', category: 'Doors & Trim', unit: 'linear ft', price: 1.80, store: 'Lowe\'s', description: 'Primed MDF baseboard.' },
];

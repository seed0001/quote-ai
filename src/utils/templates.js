// Neutral starter items. Businesses can replace these with their own catalog.
// `materialCost` is retained as the internal unit-price field for compatibility
// with existing saved quotes, regardless of whether an item is a product,
// service, fee, rental, or other charge.
export const ESTIMATOR_TEMPLATES = [
  { id: 't-consult', category: 'Consulting', name: 'Consultation / discovery session', unit: 'hour', materialCost: 0, laborHours: 1 },
  { id: 't-planning', category: 'Planning', name: 'Project planning and coordination', unit: 'hour', materialCost: 0, laborHours: 1 },
  { id: 't-design', category: 'Design', name: 'Design / creative services', unit: 'hour', materialCost: 0, laborHours: 1 },
  { id: 't-production', category: 'Services', name: 'Production / implementation services', unit: 'hour', materialCost: 0, laborHours: 1 },
  { id: 't-onsite', category: 'Services', name: 'On-site service visit', unit: 'visit', materialCost: 0, laborHours: 1 },
  { id: 't-product', category: 'Products', name: 'Custom product or supplied item', unit: 'each', materialCost: 0, laborHours: 0 },
  { id: 't-equipment', category: 'Equipment', name: 'Equipment usage or rental', unit: 'day', materialCost: 0, laborHours: 0 },
  { id: 't-delivery', category: 'Delivery', name: 'Delivery / shipping charge', unit: 'each', materialCost: 0, laborHours: 0 },
  { id: 't-travel', category: 'Travel', name: 'Travel or mileage charge', unit: 'mile', materialCost: 0, laborHours: 0 },
  { id: 't-license', category: 'Licenses & Fees', name: 'License, permit, or administrative fee', unit: 'each', materialCost: 0, laborHours: 0 },
  { id: 't-subcontract', category: 'Subcontractors', name: 'Outside vendor / subcontracted service', unit: 'each', materialCost: 0, laborHours: 0 },
  { id: 't-package', category: 'Packages', name: 'Custom project package', unit: 'package', materialCost: 0, laborHours: 0 },
];

export const CATEGORIES = [
  'Products',
  'Services',
  'Labor',
  'Consulting',
  'Planning',
  'Design',
  'Production',
  'Equipment',
  'Rentals',
  'Delivery',
  'Travel',
  'Licenses & Fees',
  'Subcontractors',
  'Packages',
  'Other',
];

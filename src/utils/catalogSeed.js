// Neutral examples that demonstrate the catalog without assuming an industry.
// Users can edit or remove every item and create their own categories and units.
export const DEFAULT_CATALOG = [
  { id: 'cat-discovery', name: 'Discovery Session', category: 'Consulting', unit: 'hour', price: 125, store: '', description: 'Initial requirements, goals, and project scoping.' },
  { id: 'cat-planning', name: 'Project Planning', category: 'Planning', unit: 'hour', price: 100, store: '', description: 'Scheduling, coordination, and project preparation.' },
  { id: 'cat-design', name: 'Design Services', category: 'Design', unit: 'hour', price: 150, store: '', description: 'Creative, technical, or solution design work.' },
  { id: 'cat-implementation', name: 'Implementation Services', category: 'Services', unit: 'hour', price: 110, store: '', description: 'General production, setup, or implementation work.' },
  { id: 'cat-onsite', name: 'On-Site Service Visit', category: 'Services', unit: 'visit', price: 175, store: '', description: 'Standard on-site appointment or service call.' },
  { id: 'cat-pm', name: 'Project Management', category: 'Services', unit: 'hour', price: 95, store: '', description: 'Client communication, scheduling, and delivery management.' },
  { id: 'cat-equipment', name: 'Equipment Rental', category: 'Rentals', unit: 'day', price: 150, store: '', description: 'Example daily equipment or resource charge.' },
  { id: 'cat-travel', name: 'Travel / Mileage', category: 'Travel', unit: 'mile', price: 0.7, store: '', description: 'Example mileage reimbursement rate.' },
  { id: 'cat-delivery', name: 'Delivery / Shipping', category: 'Delivery', unit: 'each', price: 50, store: '', description: 'Example flat delivery or shipping charge.' },
  { id: 'cat-admin', name: 'Administrative Fee', category: 'Licenses & Fees', unit: 'each', price: 75, store: '', description: 'Example processing, filing, or administrative charge.' },
  { id: 'cat-package', name: 'Custom Project Package', category: 'Packages', unit: 'package', price: 500, store: '', description: 'Replace with a packaged offering from your business.' },
];

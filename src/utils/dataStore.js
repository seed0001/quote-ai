import { DEFAULT_CATALOG } from './catalogSeed';

// LocalStorage Keys
const PROJECTS_KEY = 'quote_ai_projects';
const CLIENTS_KEY = 'quote_ai_clients';
const SETTINGS_KEY = 'quote_ai_settings';
const CATALOG_KEY = 'quote_ai_catalog';

const DEFAULT_SETTINGS = {
  companyName: 'My Business',
  businessType: 'General products and services',
  businessDescription: 'Describe what your business sells, delivers, or manages so the AI can tailor quotes and project outlines.',
  personaStatement: '',
  contractorName: '',
  email: '',
  phone: '',
  address: '',
  defaultLaborRate: 85.00,
  defaultMarkupPercent: 20.0,
  defaultTaxPercent: 8.25,
  companyLogo: '',
  depositPercent: 50,
  proposalTerms: 'A 50% deposit is required to schedule work; the balance is due upon completion. This proposal is valid for 30 days from the date above.',
  openRouterKey: '',
  openRouterModel: 'openrouter/auto',
  fishAudioKey: '',
  fishAudioModel: 's2.1-pro-free',
  fishVoiceId: '',
  fishVoiceName: '',
};

const MOCK_CLIENTS = [
  {
    id: 'c-1',
    name: 'Sarah Jenkins',
    company: '',
    email: 'sarah.jenkins@gmail.com',
    phone: '(512) 555-0143',
    address: '1204 Pine Street, Austin, TX 78704',
    notes: 'Prefers communication via email. High attention to detail. Budget-conscious but values quality materials.',
  },
  {
    id: 'c-2',
    name: 'David and Linda Miller',
    company: '',
    email: 'miller.david@outlook.com',
    phone: '(512) 555-8822',
    address: '4308 Westlake Dr, Austin, TX 78746',
    notes: 'Lakefront home. Full master bath remodel. Interested in high-end stone finishes and custom steam shower.',
  },
  {
    id: 'c-3',
    name: 'Marcus Vance',
    company: 'Vance Properties LLC',
    email: 'marcus@vanceproperties.com',
    phone: '(512) 555-3091',
    address: '702 Congress Ave, Austin, TX 78701',
    notes: 'Real estate investor. Fast-paced. Doing a kitchen and partial floor remodel to prep property for rental.',
  },
];

const MOCK_PROJECTS = [
  {
    id: 'p-1',
    name: 'Modern Master Suite Renovation',
    clientId: 'c-2',
    status: 'progress',
    startDate: '2026-06-15',
    endDate: '2026-07-20',
    laborRate: 90.00,
    markupPercent: 25.0,
    taxPercent: 8.25,
    rooms: [
      {
        name: 'Master Bathroom',
        items: [
          { id: 'i-1', category: 'Demolition', name: 'Remove existing vanity, toilet, garden tub, & wall tile', unit: 'each', quantity: 1, materialCost: 20.00, laborHours: 12.00 },
          { id: 'i-2', category: 'Plumbing', name: 'Rough-in supply & drain lines for double vanity and steam shower', unit: 'each', quantity: 1, materialCost: 450.00, laborHours: 16.00 },
          { id: 'i-3', category: 'Tile & Stone', name: 'Install marble wall tile in shower enclosure (waterproof backing)', unit: 'sq ft', quantity: 140, materialCost: 9.50, laborHours: 1.20 },
          { id: 'i-4', category: 'Tile & Stone', name: 'Install heated tile floor underlayment & porcelain tile', unit: 'sq ft', quantity: 85, materialCost: 6.00, laborHours: 0.80 },
          { id: 'i-5', category: 'Electrical', name: 'Run new circuit for floor heating & steam shower generator', unit: 'each', quantity: 2, materialCost: 150.00, laborHours: 4.50 },
          { id: 'i-6', category: 'Cabinets & Tops', name: 'Install custom double vanity cabinet + quartz countertop', unit: 'each', quantity: 1, materialCost: 1850.00, laborHours: 4.00 }
        ]
      },
      {
        name: 'Master Closet Walk-In',
        items: [
          { id: 'i-7', category: 'Drywall', name: 'Repair ceiling drywall and patch wall finishes', unit: 'sq ft', quantity: 45, materialCost: 0.85, laborHours: 0.15 },
          { id: 'i-8', category: 'Painting', name: 'Prime and paint walls and ceiling (2 coats semi-gloss)', unit: 'sq ft', quantity: 300, materialCost: 0.40, laborHours: 0.05 },
          { id: 'i-9', category: 'Trim & Finish', name: 'Install modular custom shelving & storage system', unit: 'each', quantity: 1, materialCost: 1200.00, laborHours: 8.00 }
        ]
      }
    ],
    changeOrders: [
      {
        id: 'co-1',
        title: 'Add Backlit LED Vanity Mirrors & Extra Outlet',
        description: 'Client requested upgraded backlit mirrors requiring dedicated electrical wiring behind the vanity wall.',
        status: 'approved',
        date: '2026-06-22',
        items: [
          { id: 'coi-1', category: 'Electrical', name: 'Wiring and mounting for 2 backlit mirrors', unit: 'each', quantity: 2, materialCost: 110.00, laborHours: 2.00 },
          { id: 'coi-2', category: 'Electrical', name: 'Install extra outlet inside vanity cabinet', unit: 'each', quantity: 1, materialCost: 45.00, laborHours: 1.50 }
        ]
      },
      {
        id: 'co-2',
        title: 'Subfloor Dry Rot Remediation',
        description: 'Discovered significant dry rot beneath the old tub decking. Requires framing joist sistering and subfloor replacement before tiling.',
        status: 'pending',
        date: '2026-06-28',
        items: [
          { id: 'coi-3', category: 'Framing', name: 'Replace damaged floor joist sections & lay new plywood subfloor', unit: 'sq ft', quantity: 24, materialCost: 6.50, laborHours: 0.50 }
        ]
      }
    ],
    checklists: [
      { id: 'ck-1', text: 'Permit pulled & posted on site', completed: true },
      { id: 'ck-2', text: 'Demolition & haul away complete', completed: true },
      { id: 'ck-3', text: 'Rough plumbing inspection passed', completed: true },
      { id: 'ck-4', text: 'Rough electrical inspection passed', completed: true },
      { id: 'ck-5', text: 'Shower waterproofing membrane water-tested (24hr test)', completed: true },
      { id: 'ck-6', text: 'Install tile shower walls', completed: false },
      { id: 'ck-7', text: 'Drywall repairs & closet cabinet installation', completed: false },
      { id: 'ck-8', text: 'Trim, paint, & light fixture finish out', completed: false }
    ],
    photos: [
      {
        id: 'ph-1',
        url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200" viewBox="0 0 300 200"><rect width="100%" height="100%" fill="%231a202c"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="%23718096" font-family="sans-serif" font-size="14">Demolition Stage - Garden Tub Removed</text></svg>',
        title: 'Bathroom Demolition complete',
        phase: 'Demolition',
        date: '2026-06-16'
      },
      {
        id: 'ph-2',
        url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200" viewBox="0 0 300 200"><rect width="100%" height="100%" fill="%231a202c"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="%23718096" font-family="sans-serif" font-size="14">Shower Framing & Rough-In Plumbing</text></svg>',
        title: 'Shower plumbing rough-in',
        phase: 'Plumbing',
        date: '2026-06-19'
      }
    ]
  },
  {
    id: 'p-2',
    name: 'Mid-Century Kitchen Makeover',
    clientId: 'c-1',
    status: 'quoting',
    startDate: '2026-08-10',
    endDate: '2026-08-28',
    laborRate: 85.00,
    markupPercent: 20.0,
    taxPercent: 8.25,
    rooms: [
      {
        name: 'Kitchen Main Area',
        items: [
          { id: 'i-10', category: 'Demolition', name: 'Tear out non-bearing load kitchen wall partitioning dining room', unit: 'each', quantity: 1, materialCost: 50.00, laborHours: 8.00 },
          { id: 'i-11', category: 'Cabinets & Tops', name: 'Install flat panel walnut cabinetry (uppers & lowers)', unit: 'each', quantity: 14, materialCost: 320.00, laborHours: 1.50 },
          { id: 'i-12', category: 'Cabinets & Tops', name: 'Terrazzo solid countertop slabs fabrication & install', unit: 'each', quantity: 1, materialCost: 3800.00, laborHours: 0.00 }, // Subcontracted cost included in material
          { id: 'i-13', category: 'Electrical', name: 'Re-wire kitchen outlets for GFCI and run dedicated lines for oven', unit: 'each', quantity: 1, materialCost: 350.00, laborHours: 12.00 },
          { id: 'i-14', category: 'Tile & Stone', name: 'Tile kitchen backsplash (ceramic stacked tiles)', unit: 'sq ft', quantity: 48, materialCost: 5.50, laborHours: 0.60 }
        ]
      }
    ],
    changeOrders: [],
    checklists: [
      { id: 'ck-9', text: 'Sign master contract & collect deposit', completed: false },
      { id: 'ck-10', text: 'Order walnut cabinetry & terrazzo slab', completed: true },
      { id: 'ck-11', text: 'Schedule framing subcontractor for wall opening inspection', completed: false }
    ],
    photos: []
  },
  {
    id: 'p-3',
    name: 'Rental Condo Interior Re-fresh',
    clientId: 'c-3',
    status: 'lead',
    startDate: '',
    endDate: '',
    laborRate: 80.00,
    markupPercent: 15.0,
    taxPercent: 8.25,
    rooms: [
      {
        name: 'Entire Condo',
        items: [
          { id: 'i-15', category: 'Demolition', name: 'Pull carpet in living room and bedrooms', unit: 'sq ft', quantity: 950, materialCost: 0.00, laborHours: 0.03 },
          { id: 'i-16', category: 'Trim & Finish', name: 'Install Luxury Vinyl Plank (LVP) flooring + underlayment', unit: 'sq ft', quantity: 950, materialCost: 3.20, laborHours: 0.08 },
          { id: 'i-17', category: 'Painting', name: 'Full paint of interior walls, doors, trim (flat white)', unit: 'sq ft', quantity: 2400, materialCost: 0.35, laborHours: 0.04 }
        ]
      }
    ],
    changeOrders: [],
    checklists: [],
    photos: []
  }
];

// INITIALIZATION
export const initDataStore = () => {
  if (!localStorage.getItem(PROJECTS_KEY)) {
    localStorage.setItem(PROJECTS_KEY, JSON.stringify([]));
  }
  if (!localStorage.getItem(CLIENTS_KEY)) {
    localStorage.setItem(CLIENTS_KEY, JSON.stringify([]));
  }
  if (!localStorage.getItem(SETTINGS_KEY)) {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(DEFAULT_SETTINGS));
  }
  if (!localStorage.getItem(CATALOG_KEY)) {
    localStorage.setItem(CATALOG_KEY, JSON.stringify([]));
  }
};

// GETTERS
export const getProjects = () => {
  initDataStore();
  try {
    return JSON.parse(localStorage.getItem(PROJECTS_KEY));
  } catch (e) {
    console.error('Error parsing projects data', e);
    return [];
  }
};

export const getClients = () => {
  initDataStore();
  try {
    return JSON.parse(localStorage.getItem(CLIENTS_KEY));
  } catch (e) {
    console.error('Error parsing clients data', e);
    return [];
  }
};

export const getSettings = () => {
  initDataStore();
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY));
    return {
      ...DEFAULT_SETTINGS,
      ...saved,
      // Migrate earlier builds that predated the S2.1 Pro Free API release.
      fishAudioModel: saved?.fishAudioModel === 's2.1-pro-free'
        ? saved.fishAudioModel
        : 's2.1-pro-free',
    };
  } catch (e) {
    console.error('Error parsing settings data', e);
    return DEFAULT_SETTINGS;
  }
};

export const getCatalog = () => {
  initDataStore();
  try {
    return JSON.parse(localStorage.getItem(CATALOG_KEY)) || [];
  } catch (e) {
    console.error('Error parsing catalog data', e);
    return [];
  }
};

export const masterResetData = () => {
  const appKeys = [];
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (key?.startsWith('quote_ai_')) appKeys.push(key);
  }
  appKeys.forEach((key) => localStorage.removeItem(key));
  sessionStorage.clear();
};

// SETTERS / WRITERS
export const saveProjects = (projects) => {
  localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
};

export const saveClients = (clients) => {
  localStorage.setItem(CLIENTS_KEY, JSON.stringify(clients));
};

export const saveSettings = (settings) => {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
};

export const saveCatalog = (catalog) => {
  localStorage.setItem(CATALOG_KEY, JSON.stringify(catalog));
};

export const addCatalogItem = (item) => {
  const catalog = getCatalog();
  const newItem = {
    name: '', category: 'Other', unit: 'each', price: 0, store: '', description: '',
    ...item,
    id: item.id || `cat-${Date.now()}`,
  };
  catalog.push(newItem);
  saveCatalog(catalog);
  return newItem;
};

export const updateCatalogItem = (updatedItem) => {
  const catalog = getCatalog();
  const index = catalog.findIndex(i => i.id === updatedItem.id);
  if (index !== -1) {
    catalog[index] = { ...catalog[index], ...updatedItem };
    saveCatalog(catalog);
    return true;
  }
  return false;
};

export const deleteCatalogItem = (id) => {
  const catalog = getCatalog().filter(i => i.id !== id);
  saveCatalog(catalog);
};

// HELPERS
export const addProject = (project) => {
  const projects = getProjects();
  const newProject = {
    ...project,
    id: project.id || `p-${Date.now()}`,
    rooms: project.rooms || [],
    changeOrders: project.changeOrders || [],
    checklists: project.checklists || [],
    photos: project.photos || [],
  };
  projects.push(newProject);
  saveProjects(projects);
  return newProject;
};

export const updateProject = (updatedProject) => {
  const projects = getProjects();
  const index = projects.findIndex(p => p.id === updatedProject.id);
  if (index !== -1) {
    projects[index] = updatedProject;
    saveProjects(projects);
    return true;
  }
  return false;
};

export const deleteProject = (id) => {
  const projects = getProjects();
  const filtered = projects.filter(p => p.id !== id);
  saveProjects(filtered);
};

export const addClient = (client) => {
  const clients = getClients();
  const newClient = {
    // Defaults guarantee every record has the fields the UI reads (e.g. email).
    name: '', company: '', email: '', phone: '', address: '', notes: '',
    ...client,
    id: client.id || `c-${Date.now()}`,
  };
  clients.push(newClient);
  saveClients(clients);
  return newClient;
};

export const updateClient = (updatedClient) => {
  const clients = getClients();
  const index = clients.findIndex(c => c.id === updatedClient.id);
  if (index !== -1) {
    // Merge so a partial update (e.g. address only) never wipes other fields.
    clients[index] = { ...clients[index], ...updatedClient };
    saveClients(clients);
    return true;
  }
  return false;
};

export const deleteClient = (id) => {
  const clients = getClients();
  const filtered = clients.filter(c => c.id !== id);
  saveClients(filtered);
};

// EXPORT / IMPORT
export const exportDataBackup = () => {
  const data = {
    projects: getProjects(),
    clients: getClients(),
    settings: getSettings(),
    exportedAt: new Date().toISOString(),
  };
  const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(data, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute('href', dataStr);
  downloadAnchor.setAttribute('download', `apex_quote_ai_backup_${new Date().toISOString().slice(0,10)}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
};

export const importDataBackup = (jsonData) => {
  try {
    const data = JSON.parse(jsonData);
    if (data.projects && Array.isArray(data.projects)) {
      saveProjects(data.projects);
    }
    if (data.clients && Array.isArray(data.clients)) {
      saveClients(data.clients);
    }
    if (data.settings && typeof data.settings === 'object') {
      saveSettings(data.settings);
    }
    return { success: true };
  } catch (e) {
    console.error('Import error', e);
    return { success: false, error: e.message };
  }
};

// PRICING CALCULATION LOGIC FOR ESTIMATES
export const calculateQuoteTotals = (project, settings) => {
  const laborRate = project.laborRate || settings.defaultLaborRate || 85.00;
  const markupPercent = project.markupPercent !== undefined ? project.markupPercent : (settings.defaultMarkupPercent || 20.0);
  const taxPercent = project.taxPercent !== undefined ? project.taxPercent : (settings.defaultTaxPercent || 8.25);

  let subtotalMaterials = 0;
  let subtotalLaborHours = 0;
  let subtotalLaborCost = 0;

  // Process items in rooms
  project.rooms.forEach(room => {
    room.items.forEach(item => {
      const qty = parseFloat(item.quantity) || 0;
      const mat = parseFloat(item.materialCost) || 0;
      const hrs = parseFloat(item.laborHours) || 0;

      subtotalMaterials += mat * qty;
      subtotalLaborHours += hrs * qty;
    });
  });

  subtotalLaborCost = subtotalLaborHours * laborRate;
  const directCost = subtotalMaterials + subtotalLaborCost;
  
  const markupAmount = directCost * (markupPercent / 100);
  const grossSubtotal = directCost + markupAmount;
  
  // The legacy `materials` field represents the taxable unit-price subtotal.
  const taxAmount = subtotalMaterials * (taxPercent / 100);
  const grandTotal = grossSubtotal + taxAmount;

  // Calculate change orders
  let approvedChangeOrdersTotal = 0;
  let pendingChangeOrdersTotal = 0;

  project.changeOrders.forEach(co => {
    let coMaterials = 0;
    let coLaborHours = 0;
    
    co.items.forEach(item => {
      const qty = parseFloat(item.quantity) || 0;
      const mat = parseFloat(item.materialCost) || 0;
      const hrs = parseFloat(item.laborHours) || 0;
      coMaterials += mat * qty;
      coLaborHours += hrs * qty;
    });

    const coDirect = coMaterials + (coLaborHours * laborRate);
    const coMarkup = coDirect * (markupPercent / 100);
    const coTax = coMaterials * (taxPercent / 100);
    const coTotal = coDirect + coMarkup + coTax;

    if (co.status === 'approved') {
      approvedChangeOrdersTotal += coTotal;
    } else if (co.status === 'pending') {
      pendingChangeOrdersTotal += coTotal;
    }
  });

  return {
    materials: subtotalMaterials,
    laborHours: subtotalLaborHours,
    laborCost: subtotalLaborCost,
    directCost,
    markupPercent,
    markupAmount,
    taxPercent,
    taxAmount,
    baseTotal: grandTotal,
    approvedChangeOrdersTotal,
    pendingChangeOrdersTotal,
    netTotal: grandTotal + approvedChangeOrdersTotal,
  };
};

export const evaluateExpression = (expr) => {
  if (typeof expr === 'number') return expr;
  if (typeof expr !== 'string') return 0;
  try {
    // Replace standard visual math symbols like 'x' or 'X' with '*'
    let cleaned = expr.replace(/[xX]/g, '*');
    // Sanitize to only allow numbers, spaces, dots, and basic operators
    cleaned = cleaned.replace(/[^0-9\s.+\-*/()]/g, '');
    if (!cleaned.trim()) return 0;
    
    const result = new Function(`return ${cleaned}`)();
    return typeof result === 'number' && isFinite(result) ? result : 0;
  } catch (e) {
    console.error('Error evaluating math expression:', expr, e);
    const parsed = parseFloat(expr);
    return isNaN(parsed) ? 0 : parsed;
  }
};

export const dispatchNLPActions = (actions, callbacks) => {
  let projects = getProjects();
  let clients = getClients();
  let settings = getSettings();
  const catalog = getCatalog();
  let activeProjectId = null;
  let viewChanged = null;

  // Resolve an item's material unit price. When a catalogId is supplied, the
  // catalog price is authoritative (the AI cannot override it with a guess).
  // Otherwise fall back to the explicitly provided materialCost.
  const resolveMaterialCost = (item) => {
    if (item.catalogId) {
      const product = catalog.find(c => c.id === item.catalogId);
      if (product) return product.price;
    }
    return evaluateExpression(item.materialCost) || 0;
  };

  actions.forEach(action => {
    const { type, payload } = action;
    switch (type) {
      case 'CREATE_CLIENT': {
        const newClient = addClient(payload);
        clients = getClients();
        callbacks.setClients(clients);
        break;
      }
      case 'UPDATE_CLIENT': {
        updateClient(payload);
        clients = getClients();
        callbacks.setClients(clients);
        break;
      }
      case 'DELETE_CLIENT': {
        deleteClient(payload.id);
        clients = getClients();
        callbacks.setClients(clients);
        break;
      }
      case 'CREATE_PROJECT': {
        const newProject = addProject({
          ...payload,
          laborRate: payload.laborRate ? evaluateExpression(payload.laborRate) : (settings.defaultLaborRate || 85.00),
          markupPercent: payload.markupPercent !== undefined ? evaluateExpression(payload.markupPercent) : (settings.defaultMarkupPercent || 20.0),
          taxPercent: payload.taxPercent !== undefined ? evaluateExpression(payload.taxPercent) : (settings.defaultTaxPercent || 8.25),
        });
        projects = getProjects();
        callbacks.setProjects(projects);
        activeProjectId = newProject.id;
        break;
      }
      case 'UPDATE_PROJECT_STATUS': {
        const project = projects.find(p => p.id === payload.id);
        if (project) {
          project.status = payload.status;
          updateProject(project);
          projects = getProjects();
          callbacks.setProjects(projects);
        }
        break;
      }
      case 'UPDATE_PROJECT': {
        const project = projects.find(p => p.id === payload.id);
        if (project) {
          // Only overwrite fields the caller actually supplied.
          if (payload.name !== undefined) project.name = payload.name;
          if (payload.clientId !== undefined) project.clientId = payload.clientId;
          if (payload.status !== undefined) project.status = payload.status;
          if (payload.startDate !== undefined) project.startDate = payload.startDate;
          if (payload.endDate !== undefined) project.endDate = payload.endDate;
          if (payload.laborRate !== undefined) project.laborRate = evaluateExpression(payload.laborRate);
          if (payload.markupPercent !== undefined) project.markupPercent = evaluateExpression(payload.markupPercent);
          if (payload.taxPercent !== undefined) project.taxPercent = evaluateExpression(payload.taxPercent);
          updateProject(project);
          projects = getProjects();
          callbacks.setProjects(projects);
          activeProjectId = payload.id;
        }
        break;
      }
      case 'ADD_QUOTE_ITEM': {
        const pId = payload.projectId;
        const project = projects.find(p => p.id === pId);
        if (project) {
          const roomName = payload.roomName || 'General Scope';
          let room = project.rooms.find(r => r.name.toLowerCase() === roomName.toLowerCase());
          if (!room) {
            room = { name: roomName, items: [] };
            project.rooms.push(room);
          }
          const product = payload.catalogId ? catalog.find(c => c.id === payload.catalogId) : null;
          const newItem = {
            id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
            category: payload.category || product?.category || 'Other',
            name: payload.name || product?.name || 'Custom Quote Item',
            unit: payload.unit || product?.unit || 'each',
            quantity: evaluateExpression(payload.quantity) || 1,
            materialCost: resolveMaterialCost(payload),
            laborHours: evaluateExpression(payload.laborHours) || 0,
            catalogId: payload.catalogId || null
          };
          room.items.push(newItem);
          updateProject(project);
          projects = getProjects();
          callbacks.setProjects(projects);
          activeProjectId = pId;
        }
        break;
      }
      case 'UPDATE_QUOTE_ITEM': {
        const pId = payload.projectId;
        const project = projects.find(p => p.id === pId);
        if (project) {
          project.rooms.forEach(room => {
            const item = room.items.find(i => i.id === payload.itemId);
            if (item) {
              if (payload.name !== undefined) item.name = payload.name;
              if (payload.category !== undefined) item.category = payload.category;
              if (payload.unit !== undefined) item.unit = payload.unit;
              if (payload.quantity !== undefined) item.quantity = evaluateExpression(payload.quantity);
              if (payload.catalogId !== undefined) {
                // Re-point to a catalog product: price becomes authoritative.
                item.catalogId = payload.catalogId;
                item.materialCost = resolveMaterialCost(payload);
              } else if (payload.materialCost !== undefined) {
                item.materialCost = evaluateExpression(payload.materialCost);
              }
              if (payload.laborHours !== undefined) item.laborHours = evaluateExpression(payload.laborHours);
            }
          });
          updateProject(project);
          projects = getProjects();
          callbacks.setProjects(projects);
          activeProjectId = pId;
        }
        break;
      }
      case 'DELETE_QUOTE_ITEM': {
        const pId = payload.projectId;
        const project = projects.find(p => p.id === pId);
        if (project) {
          project.rooms.forEach(room => {
            room.items = room.items.filter(i => i.id !== payload.itemId);
          });
          updateProject(project);
          projects = getProjects();
          callbacks.setProjects(projects);
          activeProjectId = pId;
        }
        break;
      }
      case 'ADD_CHECKLIST_ITEM': {
        const pId = payload.projectId;
        const project = projects.find(p => p.id === pId);
        if (project) {
          const newItem = {
            id: `ck-${Date.now()}`,
            text: payload.text,
            completed: false
          };
          project.checklists.push(newItem);
          updateProject(project);
          projects = getProjects();
          callbacks.setProjects(projects);
          activeProjectId = pId;
        }
        break;
      }
      case 'TOGGLE_CHECKLIST_ITEM': {
        const pId = payload.projectId;
        const project = projects.find(p => p.id === pId);
        if (project) {
          const item = project.checklists.find(c => c.id === payload.checklistItemId);
          if (item) {
            item.completed = !item.completed;
            updateProject(project);
            projects = getProjects();
            callbacks.setProjects(projects);
            activeProjectId = pId;
          }
        }
        break;
      }
      case 'CREATE_CHANGE_ORDER': {
        const pId = payload.projectId;
        const project = projects.find(p => p.id === pId);
        if (project) {
          const items = (payload.items || []).map(item => {
            const product = item.catalogId ? catalog.find(c => c.id === item.catalogId) : null;
            return {
              id: `coi-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
              category: item.category || product?.category || 'Other',
              name: item.name || product?.name || 'Change Order Task',
              unit: item.unit || product?.unit || 'each',
              quantity: evaluateExpression(item.quantity) || 1,
              materialCost: resolveMaterialCost(item),
              laborHours: evaluateExpression(item.laborHours) || 0,
              catalogId: item.catalogId || null
            };
          });
          const newCO = {
            id: `co-${Date.now()}`,
            title: payload.title || 'Additional Work Scope',
            description: payload.description || '',
            status: 'pending',
            date: new Date().toISOString().slice(0, 10),
            items
          };
          project.changeOrders.push(newCO);
          updateProject(project);
          projects = getProjects();
          callbacks.setProjects(projects);
          activeProjectId = pId;
        }
        break;
      }
      case 'APPROVE_CHANGE_ORDER': {
        const pId = payload.projectId;
        const project = projects.find(p => p.id === pId);
        if (project) {
          const co = project.changeOrders.find(c => c.id === payload.changeOrderId);
          if (co) {
            co.status = 'approved';
            updateProject(project);
            projects = getProjects();
            callbacks.setProjects(projects);
            activeProjectId = pId;
          }
        }
        break;
      }
      case 'REJECT_CHANGE_ORDER': {
        const pId = payload.projectId;
        const project = projects.find(p => p.id === pId);
        if (project) {
          const co = project.changeOrders.find(c => c.id === payload.changeOrderId);
          if (co) {
            co.status = 'rejected';
            updateProject(project);
            projects = getProjects();
            callbacks.setProjects(projects);
            activeProjectId = pId;
          }
        }
        break;
      }
      case 'SWITCH_VIEW': {
        viewChanged = {
          view: payload.view,
          projectId: payload.projectId || activeProjectId
        };
        break;
      }
      default:
        break;
    }
  });

  // Apply view changes if any
  if (viewChanged) {
    callbacks.setCurrentView(viewChanged.view);
    if (viewChanged.projectId) {
      callbacks.setActiveProjectId(viewChanged.projectId);
    }
  } else if (activeProjectId) {
    callbacks.setActiveProjectId(activeProjectId);
  }
};

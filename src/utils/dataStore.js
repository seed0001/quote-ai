import { DEFAULT_CATALOG } from './catalogSeed';

// LocalStorage Keys — now used only as an OFFLINE FALLBACK mirror. The shared
// source of truth for projects/clients/catalog lives on the host computer and
// is served by the /api/data endpoints (see vite.config.js). Settings continue
// to flow through /api/host-config.
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

// ---------------------------------------------------------------------------
// Host-backed store with an in-memory cache.
//
// The rest of the app calls getProjects()/saveProjects() synchronously, so we
// keep a live cache that is hydrated once from the host at startup. Reads return
// the cache; writes update the cache, mirror to localStorage (offline backup),
// and push the change to the host. Whole-array saves are diffed down to
// per-record POST/PUT/DELETE calls so two employees editing at once don't
// clobber each other's records.
// ---------------------------------------------------------------------------
const cache = { projects: [], clients: [], catalog: [] };
const LOCAL_KEYS = { projects: PROJECTS_KEY, clients: CLIENTS_KEY, catalog: CATALOG_KEY };

const mirrorLocal = (name) => {
  try {
    localStorage.setItem(LOCAL_KEYS[name], JSON.stringify(cache[name]));
  } catch (e) {
    console.error(`Unable to mirror ${name} to local fallback`, e);
  }
};

const readLocal = (key) => {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
};

// Fire-and-forget host write. The localStorage mirror is already updated, so a
// transient host hiccup never loses the user's input locally.
const hostWrite = (method, suffix, body) => {
  fetch(`/api/data${suffix}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  }).catch((e) => console.error(`Host save failed (${method} ${suffix})`, e));
};

const postRecord = (name, record) => hostWrite('POST', `/${name}`, record);
const putRecord = (name, record) => hostWrite('PUT', `/${name}/${record.id}`, record);
const removeRecord = (name, id) => hostWrite('DELETE', `/${name}/${id}`);

// Turn a whole-collection replacement into the minimal set of per-record calls.
const syncCollection = (name, prev, next) => {
  const prevById = new Map(prev.map((r) => [r.id, r]));
  const nextById = new Map(next.map((r) => [r.id, r]));
  next.forEach((record) => {
    const old = prevById.get(record.id);
    if (!old) postRecord(name, record);
    else if (JSON.stringify(old) !== JSON.stringify(record)) putRecord(name, record);
  });
  prev.forEach((record) => {
    if (!nextById.has(record.id)) removeRecord(name, record.id);
  });
};

const setCollection = (name, next) => {
  syncCollection(name, cache[name], next);
  cache[name] = next;
  mirrorLocal(name);
};

// INITIALIZATION — seed the cache synchronously from the local fallback so the
// synchronous getters work even before the async host hydrate resolves.
export const initDataStore = () => {
  cache.projects = readLocal(PROJECTS_KEY);
  cache.clients = readLocal(CLIENTS_KEY);
  cache.catalog = readLocal(CATALOG_KEY);
  if (!localStorage.getItem(SETTINGS_KEY)) {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(DEFAULT_SETTINGS));
    } catch (e) {
      console.error('Unable to seed default settings', e);
    }
  }
};

// Pull the authoritative shared data from the host into the cache. Call once at
// startup (and await it before rendering). Falls back to the local mirror when
// the host is unreachable so the app still functions offline.
export const hydrateFromHost = async () => {
  try {
    const response = await fetch('/api/data', { cache: 'no-store' });
    if (!response.ok) throw new Error(`Host data unavailable (${response.status})`);
    const data = await response.json();
    cache.projects = Array.isArray(data.projects) ? data.projects : [];
    cache.clients = Array.isArray(data.clients) ? data.clients : [];
    cache.catalog = Array.isArray(data.catalog) ? data.catalog : [];
    mirrorLocal('projects');
    mirrorLocal('clients');
    mirrorLocal('catalog');
    return true;
  } catch (e) {
    console.error('Host unreachable — using local fallback data.', e);
    initDataStore();
    return false;
  }
};

// GETTERS
export const getProjects = () => cache.projects;

export const getClients = () => cache.clients;

export const getCatalog = () => cache.catalog;

export const getSettings = () => {
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

export const masterResetData = () => {
  cache.projects = [];
  cache.clients = [];
  cache.catalog = [];
  const appKeys = [];
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (key?.startsWith('quote_ai_')) appKeys.push(key);
  }
  appKeys.forEach((key) => localStorage.removeItem(key));
  sessionStorage.clear();
  // Wipe the shared copy on the host too.
  fetch('/api/data', { method: 'DELETE' }).catch((e) => console.error('Host reset failed', e));
};

// SETTERS / WRITERS
export const saveProjects = (projects) => setCollection('projects', projects);

export const saveClients = (clients) => setCollection('clients', clients);

export const saveCatalog = (catalog) => setCollection('catalog', catalog);

export const saveSettings = (settings) => {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (e) {
    console.error('Unable to save settings locally', e);
  }
};

export const addCatalogItem = (item) => {
  const newItem = {
    name: '', category: 'Other', unit: 'each', price: 0, store: '', description: '',
    ...item,
    id: item.id || `cat-${Date.now()}`,
  };
  cache.catalog = [...cache.catalog, newItem];
  mirrorLocal('catalog');
  postRecord('catalog', newItem);
  return newItem;
};

export const updateCatalogItem = (updatedItem) => {
  const index = cache.catalog.findIndex(i => i.id === updatedItem.id);
  if (index === -1) return false;
  const merged = { ...cache.catalog[index], ...updatedItem };
  cache.catalog = cache.catalog.map(i => (i.id === merged.id ? merged : i));
  mirrorLocal('catalog');
  putRecord('catalog', merged);
  return true;
};

export const deleteCatalogItem = (id) => {
  cache.catalog = cache.catalog.filter(i => i.id !== id);
  mirrorLocal('catalog');
  removeRecord('catalog', id);
};

// HELPERS
export const addProject = (project) => {
  const newProject = {
    ...project,
    id: project.id || `p-${Date.now()}`,
    rooms: project.rooms || [],
    changeOrders: project.changeOrders || [],
    checklists: project.checklists || [],
    photos: project.photos || [],
  };
  cache.projects = [...cache.projects, newProject];
  mirrorLocal('projects');
  postRecord('projects', newProject);
  return newProject;
};

export const updateProject = (updatedProject) => {
  const index = cache.projects.findIndex(p => p.id === updatedProject.id);
  if (index === -1) return false;
  cache.projects = cache.projects.map(p => (p.id === updatedProject.id ? updatedProject : p));
  mirrorLocal('projects');
  putRecord('projects', updatedProject);
  return true;
};

export const deleteProject = (id) => {
  cache.projects = cache.projects.filter(p => p.id !== id);
  mirrorLocal('projects');
  removeRecord('projects', id);
};

export const addClient = (client) => {
  const newClient = {
    // Defaults guarantee every record has the fields the UI reads (e.g. email).
    name: '', company: '', email: '', phone: '', address: '', notes: '',
    ...client,
    id: client.id || `c-${Date.now()}`,
  };
  cache.clients = [...cache.clients, newClient];
  mirrorLocal('clients');
  postRecord('clients', newClient);
  return newClient;
};

export const updateClient = (updatedClient) => {
  const index = cache.clients.findIndex(c => c.id === updatedClient.id);
  if (index === -1) return false;
  // Merge so a partial update (e.g. address only) never wipes other fields.
  const merged = { ...cache.clients[index], ...updatedClient };
  cache.clients = cache.clients.map(c => (c.id === merged.id ? merged : c));
  mirrorLocal('clients');
  putRecord('clients', merged);
  return true;
};

export const deleteClient = (id) => {
  cache.clients = cache.clients.filter(c => c.id !== id);
  mirrorLocal('clients');
  removeRecord('clients', id);
};

// EXPORT / IMPORT
export const exportDataBackup = () => {
  const data = {
    projects: getProjects(),
    clients: getClients(),
    catalog: getCatalog(),
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
    if (data.catalog && Array.isArray(data.catalog)) {
      saveCatalog(data.catalog);
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
  let catalog = getCatalog();
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
      case 'CREATE_CATALOG_ITEM': {
        addCatalogItem({
          ...payload,
          price: payload.price !== undefined ? evaluateExpression(payload.price) : 0,
        });
        // Refresh so a quote item created later this same turn can reference it.
        catalog = getCatalog();
        callbacks.setCatalog?.(catalog);
        break;
      }
      case 'UPDATE_CATALOG_ITEM': {
        updateCatalogItem({
          ...payload,
          ...(payload.price !== undefined ? { price: evaluateExpression(payload.price) } : {}),
        });
        catalog = getCatalog();
        callbacks.setCatalog?.(catalog);
        break;
      }
      case 'DELETE_CATALOG_ITEM': {
        deleteCatalogItem(payload.id);
        catalog = getCatalog();
        callbacks.setCatalog?.(catalog);
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

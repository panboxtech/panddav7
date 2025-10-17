// js/clients/clients-service.js
// mock storage e operações "transacionais" + checagem global simulada

const STORAGE_CLIENTS = 'mock_clients_v2';
const STORAGE_POINTS = 'mock_points_v2'; // pontos globais para checagens
const STORAGE_APPS = 'mock_apps_v1'; // mock metadata de apps
const STORAGE_SERVERS = 'mock_servers_v1';
const STORAGE_PLANS = 'mock_plans_v1';

// util helpers
function _read(key){ const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : []; }
function _write(key, val){ localStorage.setItem(key, JSON.stringify(val)); }

export function seedMocksIfEmpty(){
  if(!_read(STORAGE_APPS).length){
    _write(STORAGE_APPS, [
      { id:'app1', name:'App A', multiplosAcessos:true },
      { id:'app2', name:'App B', multiplosAcessos:false },
      { id:'app3', name:'App C', multiplosAcessos:true }
    ]);
  }
  if(!_read(STORAGE_SERVERS).length){
    _write(STORAGE_SERVERS, [
      { id:'srv1', name:'Servidor 1' },
      { id:'srv2', name:'Servidor 2' }
    ]);
  }
  if(!_read(STORAGE_PLANS).length){
    _write(STORAGE_PLANS, [
      { id:'plan1', name:'Mensal', months:1 },
      { id:'plan3', name:'Trimestral', months:3 },
      { id:'plan12', name:'Anual', months:12 }
    ]);
  }
  if(!_read(STORAGE_CLIENTS).length){
    _write(STORAGE_CLIENTS, []);
  }
  if(!_read(STORAGE_POINTS).length){
    _write(STORAGE_POINTS, []);
  }
}

// CRUD clientes (simples)
export async function listClientsMock(){
  seedMocksIfEmpty();
  return _read(STORAGE_CLIENTS);
}
export async function createClientMock(payload){
  seedMocksIfEmpty();
  const clients = _read(STORAGE_CLIENTS);
  const id = Date.now().toString(36);
  const client = { id, ...payload };
  clients.push(client);
  _write(STORAGE_CLIENTS, clients);
  // registrar pontos global
  const allPoints = _read(STORAGE_POINTS);
  const pts = (payload.points || []).map(p => ({ ...p, clientId:id, pointId: Date.now().toString(36) + Math.random().toString(36).slice(2,6) }));
  _write(STORAGE_POINTS, allPoints.concat(pts));
  return client;
}

export async function updateClientMock(id, payload){
  seedMocksIfEmpty();
  const clients = _read(STORAGE_CLIENTS);
  const idx = clients.findIndex(c=>c.id===id);
  if(idx === -1) throw new Error('Cliente não encontrado');
  clients[idx] = { ...clients[idx], ...payload };
  _write(STORAGE_CLIENTS, clients);
  // replace points for that client in global points store
  const allPoints = _read(STORAGE_POINTS).filter(p=>p.clientId !== id);
  const pts = (payload.points || []).map(p => ({ ...p, clientId:id, pointId: Date.now().toString(36) + Math.random().toString(36).slice(2,6) }));
  _write(STORAGE_POINTS, allPoints.concat(pts));
  return clients[idx];
}

export async function removeClientMock(id){
  seedMocksIfEmpty();
  let clients = _read(STORAGE_CLIENTS).filter(c=>c.id!==id);
  _write(STORAGE_CLIENTS, clients);
  let pts = _read(STORAGE_POINTS).filter(p=>p.clientId!==id);
  _write(STORAGE_POINTS, pts);
  return true;
}

// metadata getters
export async function listApps(){
  seedMocksIfEmpty();
  return _read(STORAGE_APPS);
}
export async function getAppById(id){
  const apps = _read(STORAGE_APPS);
  return apps.find(a=>a.id===id) || null;
}
export async function listServers(){
  seedMocksIfEmpty();
  return _read(STORAGE_SERVERS);
}
export async function listPlans(){
  seedMocksIfEmpty();
  return _read(STORAGE_PLANS);
}
export async function getPlanById(id){
  const plans = _read(STORAGE_PLANS);
  return plans.find(p=>p.id===id) || null;
}

// checagem global simulada
// retorna true se já existe ponto global com mesmo appId e user (app exclusivo)
export async function checkGlobalUniqueness(appId, user){
  seedMocksIfEmpty();
  const allPoints = _read(STORAGE_POINTS);
  return allPoints.some(p => p.appId === appId && String(p.user) === String(user));
}

// transação mock: tenta criar/atualizar cliente com pontos e reverte se conflito detectado
export async function persistClientTransaction({ mode='create', clientId=null, clientPayload }){
  seedMocksIfEmpty();
  // checagens finais: global uniqueness for exclusive apps
  const apps = _read(STORAGE_APPS);
  const points = clientPayload.points || [];

  for(const p of points){
    const app = apps.find(a=>a.id===p.appId);
    if(!app) throw new Error(`App não encontrado: ${p.appId}`);
    if(app.multiplosAcessos === false){
      const exists = await checkGlobalUniqueness(p.appId, p.user);
      // if exists and belongs to another client (for update, allow points that were owned by same client)
      if(exists){
        // in mock, check owner
        const allPoints = _read(STORAGE_POINTS);
        const found = allPoints.find(q => q.appId === p.appId && String(q.user) === String(p.user));
        if(found && mode === 'update' && String(found.clientId) === String(clientId)){
          // ok - existing point belongs to same client being updated
        } else {
          throw new Error(`Conflito global: usuário ${p.user} já usado no app ${p.appId}`);
        }
      }
    }
  }

  // se passou nas checagens, commit mock: create or update
  if(mode === 'create'){
    const created = await createClientMock(clientPayload);
    return { success:true, client:created };
  } else if(mode === 'update'){
    const updated = await updateClientMock(clientId, clientPayload);
    return { success:true, client:updated };
  } else {
    throw new Error('Modo desconhecido');
  }
}

// disponibiliza global para compatibilidade com views
window.clientsService = {
  seedMocksIfEmpty,
  listClientsMock,
  createClientMock,
  updateClientMock,
  removeClientMock,
  listApps,
  listServers,
  listPlans,
  getPlanById,
  getAppById,
  checkGlobalUniqueness,
  persistClientTransaction
};
export default window.clientsService;

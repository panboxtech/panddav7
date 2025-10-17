// Serviço de acesso a dados de clientes.
// Mock localStorage com API async compatível para fácil troca para Supabase depois.
const STORAGE_KEY = 'mock_clients_v1';

function _readAll(){
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : [];
}
function _writeAll(list){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

export async function listClients(query){
  const all = _readAll();
  if(!query) return all;
  const s = query.toLowerCase();
  return all.filter(c => (c.name||'').toLowerCase().includes(s) || (c.user||'').toLowerCase().includes(s) || (c.phone||'').toLowerCase().includes(s));
}

export async function createClient(payload){
  const list = _readAll();
  const id = Date.now().toString(36);
  const item = { id, ...payload };
  list.unshift(item);
  _writeAll(list);
  return item;
}

export async function updateClient(id, payload){
  const list = _readAll();
  const idx = list.findIndex(x=>x.id===id);
  if(idx === -1) throw new Error('Not found');
  list[idx] = {...list[idx], ...payload};
  _writeAll(list);
  return list[idx];
}

export async function removeClient(id){
  let list = _readAll();
  list = list.filter(x=>x.id!==id);
  _writeAll(list);
  return true;
}

// disponibiliza global para uso por outros módulos sem import default
window.clientsService = {
  list: listClients,
  create: createClient,
  update: updateClient,
  remove: removeClient
};

// js/clients/clients-validation.js
// funções puras de validação das regras descritas

export function normalizePhone(str){
  if(!str) return '';
  return String(str).replace(/\D/g, '');
}

export function validateName(name){
  if(!name) return { ok:false, msg:'Nome obrigatório' };
  if(String(name).trim().length === 0) return { ok:false, msg:'Nome inválido' };
  return { ok:true };
}

export function validatePhoneRaw(raw){
  const digits = normalizePhone(raw);
  if(!digits || digits.length < 1) return { ok:false, msg:'Telefone obrigatório (mínimo 1 dígito)' , digits:'' };
  return { ok:true, digits };
}

export function validateEmail(email){
  if(!email) return { ok:true };
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email) ? { ok:true } : { ok:false, msg:'Email inválido' };
}

export function validateScreens(n){
  const v = Number(n);
  if(!Number.isFinite(v) || v < 1) return { ok:false, msg:'Telas por servidor deve ser ≥ 1' };
  return { ok:true, value: Math.floor(v) };
}

export function validateDueDate(dueIso){
  if(!dueIso) return { ok:false, msg:'Data de vencimento obrigatória' };
  const now = new Date(); now.setHours(0,0,0,0);
  const due = new Date(dueIso);
  due.setHours(0,0,0,0);
  if(due <= now) return { ok:false, msg:'Data de vencimento deve ser maior que hoje' };
  return { ok:true };
}

export function validatePointLocal(point, appMeta, screensPerServer, existingPointsForServer){
  // point: {serverId, appId, conns, user, pass}
  // appMeta: {id, multiplosAcessos:boolean}
  if(!point.serverId) return { ok:false, msg:'Servidor obrigatório' };
  if(!point.appId) return { ok:false, msg:'App obrigatório' };
  if(!point.user || String(point.user).trim().length===0) return { ok:false, msg:'Usuário obrigatório' };
  if(!point.pass || String(point.pass).length===0) return { ok:false, msg:'Senha obrigatória' };

  if(!appMeta) return { ok:false, msg:'Meta do app não encontrada' };

  if(appMeta.multiplosAcessos === false){
    if(Number(point.conns) !== 1) return { ok:false, msg:'App exclusivo: conexões devem ser 1' };
  } else {
    const v = Number(point.conns);
    if(!Number.isFinite(v) || v < 1) return { ok:false, msg:'Conexões deve ser ≥ 1' };
    // soma parcial não pode exceder screensPerServer
    const sum = existingPointsForServer.reduce((s,p)=>s + Number(p.conns || 0), 0) + v;
    if(sum > screensPerServer) return { ok:false, msg:`Excede quota do servidor (máx ${screensPerServer})` };
  }

  return { ok:true };
}

// soma por servidor
export function sumConns(points){
  const map = {};
  for(const p of points){
    if(!p.serverId) continue;
    map[p.serverId] = (map[p.serverId] || 0) + Number(p.conns || 0);
  }
  return map;
}

// checa unicidade local app+user entre pontos do cliente
export function checkLocalUniqueAppUser(points){
  const seen = new Set();
  for(const p of points){
    if(!p.appId || !p.user) continue;
    const key = `${p.appId}::${p.user}`;
    if(seen.has(key)) return { ok:false, msg:`Usuário duplicado para app exclusivo: ${p.user}` };
    seen.add(key);
  }
  return { ok:true };
}

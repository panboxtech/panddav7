// js/clients/clients-view.js
import { createEmptyClient, createEmptyPoint } from './clients-models.js';
import * as V from './clients-validation.js';
import clientsService from './clients-service.js';

const ClientsView = (function(){
  let state = {
    client: createEmptyClient(),
    editingPointId: null,
    appsMeta: [],
    serversMeta: [],
    plansMeta: []
  };

  // DOM refs
  let rootOverlay;
  let formTemplate, pointTemplate, pointItemTemplate;
  let inputs = {};

  function q(sel, ctx=document){ return ctx.querySelector(sel); }
  function qa(sel, ctx=document){ return Array.from((ctx||document).querySelectorAll(sel)); }

  async function init(){
    // load metadata
    clientsService.seedMocksIfEmpty();
    state.appsMeta = await clientsService.listApps();
    state.serversMeta = await clientsService.listServers();
    state.plansMeta = await clientsService.listPlans();

    // ensure templates in document
    if(!document.getElementById('clientFormTemplate')){
      const res = await fetch('./views/client-form.html', { cache:'no-store' });
      if(res.ok){
        const text = await res.text();
        const tmp = document.createElement('div');
        tmp.innerHTML = text;
        tmp.querySelectorAll('template').forEach(t => document.body.appendChild(t));
      } else {
        throw new Error('Não foi possível carregar templates: ' + res.status);
      }
    }

    formTemplate = document.getElementById('clientFormTemplate');
    pointTemplate = document.getElementById('pointFormTemplate');
    pointItemTemplate = document.getElementById('pointItemTemplate');

    if(!formTemplate) throw new Error('clientFormTemplate ausente');

    openOverlay();
  }

  function openOverlay(){
    // create overlay from template and attach to body
    const clone = formTemplate.content.cloneNode(true);
    rootOverlay = clone.querySelector('.overlay-modal') || document.createElement('div');
    document.body.appendChild(clone);
    // after appended, bind refs inside overlay
    bindElements();
    attachHandlers();
    renderSummaries();
    updateSaveState();
    // open default: data expanded, points collapsed
    setPanelExpanded('panel-data', true);
    setPanelExpanded('panel-points', false);
  }

  function bindElements(){
    inputs.overlay = document.querySelector('.overlay-modal');
    inputs.closeBtn = q('#closeClientModal', inputs.overlay);
    inputs.cancelClientBtn = q('#cancelClientBtn', inputs.overlay);
    inputs.saveBtn = q('#saveClientBtn', inputs.overlay);
    inputs.globalFeedback = q('#globalFeedback', inputs.overlay);

    // panel data refs
    inputs.c_name = q('#c_name', inputs.overlay);
    inputs.c_phone = q('#c_phone', inputs.overlay);
    inputs.c_email = q('#c_email', inputs.overlay);
    inputs.btnSelectPlan = q('#btnSelectPlan', inputs.overlay);
    inputs.chipPlan = q('#chipPlan', inputs.overlay);
    inputs.c_dueDate = q('#c_dueDate', inputs.overlay);
    inputs.c_screens = q('#c_screens', inputs.overlay);
    inputs.btnSelectServer1 = q('#btnSelectServer1', inputs.overlay);
    inputs.chipServer1 = q('#chipServer1', inputs.overlay);
    inputs.btnSelectServer2 = q('#btnSelectServer2', inputs.overlay);
    inputs.chipServer2 = q('#chipServer2', inputs.overlay);
    inputs.summaryName = q('#summaryName', inputs.overlay);
    inputs.summaryPlan = q('#summaryPlan', inputs.overlay);
    inputs.summaryScreens = q('#summaryScreens', inputs.overlay);
    inputs.statusData = q('#statusData', inputs.overlay);

    // panel points refs
    inputs.btnAddPoint = q('#btnAddPoint', inputs.overlay);
    inputs.pointsList = q('#pointsList', inputs.overlay);
    inputs.pointFormRoot = q('#pointFormRoot', inputs.overlay);
    inputs.quotaServer1 = q('#quotaServer1', inputs.overlay);
    inputs.quotaServer2 = q('#quotaServer2', inputs.overlay);
    inputs.pointsBadges = q('#pointsBadges', inputs.overlay);
    inputs.statusPoints = q('#statusPoints', inputs.overlay);

    // panel headers for toggling
    inputs.panelDataHeader = q('#panel-data-header', inputs.overlay);
    inputs.panelPointsHeader = q('#panel-points-header', inputs.overlay);
  }

  function attachHandlers(){
    if(inputs.closeBtn) inputs.closeBtn.addEventListener('click', onCancel);
    if(inputs.cancelClientBtn) inputs.cancelClientBtn.addEventListener('click', onCancel);
    if(inputs.saveBtn) inputs.saveBtn.addEventListener('click', onSaveClient);

    // data panel handlers
    if(inputs.c_name) inputs.c_name.addEventListener('input', onClientInput);
    if(inputs.c_phone) inputs.c_phone.addEventListener('input', onClientInput);
    if(inputs.c_email) inputs.c_email.addEventListener('input', onClientInput);
    if(inputs.c_screens){
      inputs.c_screens.addEventListener('input', onClientInput);
      // stepper buttons inside overlay
      qa('.stepper-incr', inputs.overlay).forEach(b => b.addEventListener('click', ()=> changeScreens(1)));
      qa('.stepper-decr', inputs.overlay).forEach(b => b.addEventListener('click', ()=> changeScreens(-1)));
    }
    if(inputs.btnSelectPlan) inputs.btnSelectPlan.addEventListener('click', onSelectPlanPrompt);
    if(inputs.btnSelectServer1) inputs.btnSelectServer1.addEventListener('click', onSelectServer1Prompt);
    if(inputs.btnSelectServer2) inputs.btnSelectServer2.addEventListener('click', onSelectServer2Prompt);

    // panel expansion toggles
    if(inputs.panelDataHeader) inputs.panelDataHeader.addEventListener('click', ()=> togglePanel('panel-data'));
    if(inputs.panelPointsHeader) inputs.panelPointsHeader.addEventListener('click', ()=> togglePanel('panel-points'));
    // keyboard accessibility
    if(inputs.panelDataHeader) inputs.panelDataHeader.addEventListener('keydown', (e)=> { if(e.key==='Enter' || e.key===' ') togglePanel('panel-data'); });
    if(inputs.panelPointsHeader) inputs.panelPointsHeader.addEventListener('keydown', (e)=> { if(e.key==='Enter' || e.key===' ') togglePanel('panel-points'); });

    // points
    if(inputs.btnAddPoint) inputs.btnAddPoint.addEventListener('click', ()=> openPointForm(null));
  }

  function onClientInput(){
    state.client.name = inputs.c_name ? inputs.c_name.value : '';
    if(inputs.c_phone) state.client.phone = V.normalizePhone(inputs.c_phone.value);
    state.client.email = inputs.c_email ? inputs.c_email.value : '';
    state.client.screensPerServer = inputs.c_screens ? Number(inputs.c_screens.value) || 1 : 1;
    if(inputs.c_dueDate) state.client.dueDate = inputs.c_dueDate.value;
    // live summary
    renderSummaries();
    validateStep1();
    updateSaveState();
  }

  function changeScreens(delta){
    if(!inputs.c_screens) return;
    const cur = Number(inputs.c_screens.value) || 1;
    inputs.c_screens.value = Math.max(1, cur + delta);
    onClientInput();
  }

  function renderSummaries(){
    inputs.summaryName && (inputs.summaryName.textContent = state.client.name ? state.client.name : '—');
    const planLabel = state.plansMeta.find(p=>p.id===state.client.planId)?.name || '—';
    inputs.summaryPlan && (inputs.summaryPlan.textContent = planLabel);
    inputs.summaryScreens && (inputs.summaryScreens.textContent = `Telas: ${state.client.screensPerServer || 1}`);
    // points badges
    if(state.client.points && state.client.points.length){
      inputs.pointsBadges.innerHTML = '';
      state.client.points.forEach(p=>{
        const appName = state.appsMeta.find(a=>a.id===p.appId)?.name || p.appId;
        const b = document.createElement('span');
        b.className = 'badge';
        b.textContent = `${appName} · ${p.conns}`;
        inputs.pointsBadges.appendChild(b);
      });
    } else {
      inputs.pointsBadges.textContent = 'Nenhum ponto';
    }
    updateQuotasView();
  }

  function validateStep1(){
    const nameV = V.validateName(state.client.name);
    const phoneV = V.validatePhoneRaw(inputs.c_phone ? inputs.c_phone.value : '');
    const emailV = V.validateEmail(state.client.email);
    const screensV = V.validateScreens(inputs.c_screens ? inputs.c_screens.value : 1);
    const dueV = V.validateDueDate(inputs.c_dueDate ? inputs.c_dueDate.value : null);

    q('#err_name', inputs.overlay) && (q('#err_name', inputs.overlay).textContent = nameV.ok ? '' : nameV.msg);
    q('#err_phone', inputs.overlay) && (q('#err_phone', inputs.overlay).textContent = phoneV.ok ? '' : phoneV.msg);
    q('#err_email', inputs.overlay) && (q('#err_email', inputs.overlay).textContent = emailV.ok ? '' : emailV.msg);
    q('#err_screens', inputs.overlay) && (q('#err_screens', inputs.overlay).textContent = screensV.ok ? '' : screensV.msg);
    q('#err_dueDate', inputs.overlay) && (q('#err_dueDate', inputs.overlay).textContent = dueV.ok ? '' : dueV.msg);
    q('#err_plan', inputs.overlay) && (q('#err_plan', inputs.overlay).textContent = state.client.planId ? '' : 'Plano obrigatório');
    q('#err_server1', inputs.overlay) && (q('#err_server1', inputs.overlay).textContent = state.client.server1Id ? '' : 'Servidor1 obrigatório');

    // show header hint for data panel
    if(inputs.statusData) {
      const ok = nameV.ok && phoneV.ok && emailV.ok && screensV.ok && dueV.ok && !!state.client.planId && !!state.client.server1Id;
      inputs.statusData.textContent = ok ? '' : 'Preencha os campos obrigatórios';
    }
  }

  function updateQuotasView(){
    const sums = V.sumConns(state.client.points);
    const s1id = state.client.server1Id;
    const s2id = state.client.server2Id;
    const screens = state.client.screensPerServer || 1;
    if(inputs.quotaServer1) inputs.quotaServer1.textContent = s1id ? `${sums[s1id] || 0} / ${screens}` : '-';
    if(inputs.quotaServer2) inputs.quotaServer2.textContent = s2id ? `${sums[s2id] || 0} / ${screens}` : '-';
    // header hint for points
    if(inputs.statusPoints){
      // if any server sums exceed screens show warning
      let warn = '';
      if(s1id && (sums[s1id]||0) > screens) warn = 'Quota excedida Servidor1';
      if(s2id && (sums[s2id]||0) > screens) warn = (warn ? warn + '; ' : '') + 'Quota excedida Servidor2';
      inputs.statusPoints.textContent = warn;
    }
  }

  // panel expand/collapse helpers
  function setPanelExpanded(panelId, expanded){
    const header = q(`#${panelId}-header`);
    const body = q(`#${panelId}-body`);
    if(!header || !body) return;
    header.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    if(expanded){ body.classList.remove('hidden'); header.focus(); } else { body.classList.add('hidden'); }
  }
  function togglePanel(panelId){
    const header = q(`#${panelId}-header`);
    const expanded = header && header.getAttribute('aria-expanded') === 'true';
    setPanelExpanded(panelId, !expanded);
    // scroll into view on expand for mobile
    if(!expanded) { q(`#${panelId}-header`).scrollIntoView({behavior:'smooth', block:'center'}); }
  }

  // selection prompts (for prototype) - same UX as before but allow replacement with modals
  async function onSelectPlanPrompt(){
    const options = state.plansMeta.map(p=>`${p.id}: ${p.name} (${p.months}m)`).join('\n');
    const pick = prompt(`Escolha plano:\n${options}`);
    if(!pick) return;
    const id = pick.split(':')[0].trim();
    const plan = state.plansMeta.find(p=>p.id===id);
    if(plan){
      state.client.planId = plan.id;
      if(inputs.chipPlan){ inputs.chipPlan.textContent = `${plan.name} • ${plan.months}m`; inputs.chipPlan.setAttribute('aria-hidden','false'); }
      // auto suggest due date
      const due = new Date(); due.setMonth(due.getMonth() + (plan.months || 0));
      inputs.c_dueDate && (inputs.c_dueDate.value = due.toISOString().slice(0,10));
      state.client.dueDate = inputs.c_dueDate.value;
      renderSummaries();
      validateStep1();
      updateSaveState();
    }
  }

  async function onSelectServer1Prompt(){
    const options = state.serversMeta.map(s=>`${s.id}: ${s.name}`).join('\n');
    const pick = prompt(`Escolha Servidor1:\n${options}`);
    if(!pick) return;
    const id = pick.split(':')[0].trim();
    const server = state.serversMeta.find(s=>s.id===id);
    if(server){
      state.client.server1Id = server.id;
      if(inputs.chipServer1){ inputs.chipServer1.textContent = server.name; inputs.chipServer1.setAttribute('aria-hidden','false'); }
      if(state.client.server2Id === server.id){ state.client.server2Id = null; if(inputs.chipServer2){ inputs.chipServer2.textContent=''; inputs.chipServer2.setAttribute('aria-hidden','true'); } }
      renderSummaries(); validateStep1(); updateSaveState();
    }
  }

  async function onSelectServer2Prompt(){
    const available = state.serversMeta.filter(s => s.id !== state.client.server1Id);
    if(available.length===0){ alert('Nenhum servidor adicional disponível'); return; }
    const options = available.map(s=>`${s.id}: ${s.name}`).join('\n');
    const pick = prompt(`Escolha Servidor2:\n${options}`);
    if(!pick) return;
    const id = pick.split(':')[0].trim();
    const server = available.find(s=>s.id===id);
    if(server){ state.client.server2Id = server.id; if(inputs.chipServer2){ inputs.chipServer2.textContent = server.name; inputs.chipServer2.setAttribute('aria-hidden','false'); } renderSummaries(); validateStep1(); updateSaveState(); }
  }

  // Points CRUD with select for app and server
  function openPointForm(editPoint=null){
    const clone = pointTemplate.content.cloneNode(true);
    const formEl = clone.querySelector('.point-form');

    // populate server select
    const selServer = formEl.querySelector('#p_server');
    selServer.innerHTML = '';
    const serverOptions = prepareServerOptionsForPoint();
    serverOptions.forEach(s => {
      const opt = document.createElement('option'); opt.value = s.id; opt.textContent = s.name; selServer.appendChild(opt);
    });

    // populate app select
    const selApp = formEl.querySelector('#p_app');
    selApp.innerHTML = '';
    state.appsMeta.forEach(a => {
      const opt = document.createElement('option'); opt.value = a.id; opt.textContent = a.name + (a.multiplosAcessos ? '' : ' (exclusivo)');
      selApp.appendChild(opt);
    });

    // prefill when editing
    if(editPoint){
      state.editingPointId = editPoint.id;
      selServer.value = editPoint.serverId;
      selApp.value = editPoint.appId;
      formEl.querySelector('#p_conns').value = editPoint.conns;
      formEl.querySelector('#p_user').value = editPoint.user;
      formEl.querySelector('#p_pass').value = editPoint.pass;
      formEl.querySelector('#pointFormTitle').textContent = 'Editar Ponto';
    } else {
      state.editingPointId = null;
      const pre = selectPreServerForNewPoint();
      if(pre) selServer.value = pre.id;
      formEl.querySelector('#pointFormTitle').textContent = 'Novo Ponto';
      formEl.querySelector('#p_conns').value = 1;
      formEl.querySelector('#p_user').value = '';
      formEl.querySelector('#p_pass').value = '';
    }

    // apply app rules on change
    const inputConns = formEl.querySelector('#p_conns');
    selApp.addEventListener('change', ()=>{
      const meta = state.appsMeta.find(a => a.id === selApp.value);
      if(meta && meta.multiplosAcessos === false){
        inputConns.value = 1; inputConns.setAttribute('disabled','true');
        q('#err_p_conns', formEl) && (q('#err_p_conns', formEl).textContent = 'App exclusivo: conexões fixas em 1');
      } else {
        inputConns.removeAttribute('disabled');
        q('#err_p_conns', formEl) && (q('#err_p_conns', formEl).textContent = '');
      }
    });

    // steppers
    formEl.querySelector('.stepper-decr').addEventListener('click', ()=> { inputConns.value = Math.max(1, Number(inputConns.value||1)-1); });
    formEl.querySelector('.stepper-incr').addEventListener('click', ()=> { inputConns.value = Math.max(1, Number(inputConns.value||1)+1); });

    // cancel/add handlers
    formEl.querySelector('#cancelPointBtn').addEventListener('click', ()=> {
      state.editingPointId = null;
      inputs.pointFormRoot.classList.add('hidden'); inputs.pointFormRoot.innerHTML = '';
      updateQuotasView(); updateSaveState();
    });

    formEl.querySelector('#addPointBtn').addEventListener('click', ()=> {
      const point = {
        id: state.editingPointId || ('p_' + Date.now().toString(36)),
        serverId: selServer.value,
        appId: selApp.value || null,
        conns: Number(inputConns.value || 1),
        user: formEl.querySelector('#p_user').value.trim(),
        pass: formEl.querySelector('#p_pass').value
      };

      const appMeta = state.appsMeta.find(a => a.id === point.appId);
      const existing = state.client.points.filter(p => p.serverId === point.serverId && p.id !== point.id);

      const valid = V.validatePointLocal(point, appMeta, state.client.screensPerServer, existing);
      if(!valid.ok){ q('#err_p_conns', formEl) && (q('#err_p_conns', formEl).textContent = valid.msg); return; }

      if(appMeta && appMeta.multiplosAcessos === false){
        const dup = state.client.points.find(p => p.appId === point.appId && p.user === point.user && p.id !== point.id);
        if(dup){ alert('Usuário duplicado para app exclusivo no cliente (corrija antes de adicionar).'); return; }
      }

      if(state.editingPointId){
        const idx = state.client.points.findIndex(p => p.id === state.editingPointId);
        if(idx !== -1) state.client.points[idx] = point;
      } else {
        state.client.points.push(point);
      }

      state.editingPointId = null;
      inputs.pointFormRoot.classList.add('hidden');
      inputs.pointFormRoot.innerHTML = '';
      renderPointsList();
      updateQuotasView();
      updateSaveState();
      renderSummaries();
    });

    // show point form
    inputs.pointFormRoot.innerHTML = '';
    inputs.pointFormRoot.appendChild(clone);
    inputs.pointFormRoot.classList.remove('hidden');
    inputs.pointFormRoot.setAttribute('aria-hidden','false');

    // trigger change to apply app rule initial state
    selApp.dispatchEvent(new Event('change'));
  }

  function prepareServerOptionsForPoint(){
    const s1 = state.client.server1Id ? state.serversMeta.find(s=>s.id===state.client.server1Id) : null;
    const s2 = state.client.server2Id ? state.serversMeta.find(s=>s.id===state.client.server2Id) : null;
    const opts = [];
    if(s1) opts.push({ id:s1.id, name:s1.name });
    if(s2) opts.push({ id:s2.id, name:s2.name });
    return opts;
  }

  function selectPreServerForNewPoint(){
    const s1 = state.client.server1Id;
    const s2 = state.client.server2Id;
    const screens = state.client.screensPerServer || 1;
    const sums = V.sumConns(state.client.points);
    const s1sum = sums[s1] || 0;
    if(s1 && s1sum < screens) return state.serversMeta.find(s=>s.id===s1);
    if(s2) return state.serversMeta.find(s=>s.id===s2);
    return null;
  }

  function renderPointsList(){
    inputs.pointsList.innerHTML = '';
    if(state.client.points.length === 0){
      const empty = document.createElement('div'); empty.className = 'card'; empty.textContent = 'Nenhum ponto adicionado'; inputs.pointsList.appendChild(empty); return;
    }

    state.client.points.forEach(p=>{
      const clone = pointItemTemplate.content.cloneNode(true);
      const item = clone.querySelector('.point-item');
      item.dataset.id = p.id;
      item.querySelector('.point-server').textContent = state.serversMeta.find(s=>s.id===p.serverId)?.name || p.serverId;
      item.querySelector('.point-app').textContent = state.appsMeta.find(a=>a.id===p.appId)?.name || p.appId;
      item.querySelector('.point-conns').textContent = `Conexões: ${p.conns}`;
      item.querySelector('.point-user').textContent = `Usuário: ${p.user}`;
      // senha exibida em texto claro conforme solicitado
      item.querySelector('.point-pass').textContent = `Senha: ${p.pass || ''}`;

      item.querySelector('.edit-point').addEventListener('click', ()=> openPointForm(p));
      item.querySelector('.remove-point').addEventListener('click', ()=> {
        if(!confirm('Remover ponto?')) return;
        state.client.points = state.client.points.filter(x=>x.id !== p.id);
        renderPointsList();
        updateQuotasView();
        updateSaveState();
        renderSummaries();
      });

      inputs.pointsList.appendChild(clone);
    });
  }

  async function updateSaveState(){
    const nameV = V.validateName(state.client.name);
    const phoneV = V.validatePhoneRaw(state.client.phone);
    const screensV = V.validateScreens(state.client.screensPerServer);
    const dueV = V.validateDueDate(inputs.c_dueDate ? inputs.c_dueDate.value : null);
    const planSelected = !!state.client.planId;
    const server1Selected = !!state.client.server1Id;

    const sums = V.sumConns(state.client.points);
    const s1id = state.client.server1Id;
    const s2id = state.client.server2Id;
    const screens = state.client.screensPerServer || 1;

    let quotaExact = true;
    if(s1id){ if((sums[s1id] || 0) !== screens) quotaExact = false; }
    if(s2id){ if((sums[s2id] || 0) !== screens) quotaExact = false; }
    else { if(s1id && (sums[s1id] || 0) !== screens) quotaExact = false; }

    const localUnique = V.checkLocalUniqueAppUser(state.client.points);
    const enable = nameV.ok && phoneV.ok && screensV.ok && dueV.ok && planSelected && server1Selected && quotaExact && localUnique.ok;
    if(inputs.saveBtn) inputs.saveBtn.disabled = !enable;

    // feedback for user
    if(!localUnique.ok && inputs.globalFeedback) inputs.globalFeedback.textContent = localUnique.msg;
    else inputs.globalFeedback.textContent = '';
  }

  async function onSaveClient(){
    inputs.globalFeedback && (inputs.globalFeedback.textContent = 'Validando e salvando...');
    const payload = {
      name: state.client.name.trim(),
      phone: V.normalizePhone(inputs.c_phone ? inputs.c_phone.value : ''),
      email: state.client.email ? state.client.email.trim() : null,
      planId: state.client.planId,
      dueDate: inputs.c_dueDate ? inputs.c_dueDate.value : null,
      screensPerServer: state.client.screensPerServer,
      server1Id: state.client.server1Id,
      server2Id: state.client.server2Id,
      points: state.client.points.map(p => ({ serverId:p.serverId, appId:p.appId, conns:p.conns, user:p.user, pass:p.pass }))
    };

    try{
      if(inputs.saveBtn) inputs.saveBtn.disabled = true;
      const res = await clientsService.persistClientTransaction({ mode:'create', clientPayload:payload });
      if(res && res.success){
        alert('Cliente salvo com sucesso');
        closeOverlay();
        // ideally refresh list outside (UI integration)
      } else {
        throw new Error('Falha ao salvar');
      }
    }catch(err){
      alert('Erro ao salvar: ' + (err.message || String(err)));
      if(inputs.saveBtn) inputs.saveBtn.disabled = false;
      inputs.globalFeedback && (inputs.globalFeedback.textContent = 'Erro: ' + (err.message || String(err)));
    }
  }

  function onCancel(){
    if(confirm('Fechar sem salvar? Alterações serão perdidas.')) closeOverlay();
  }

  function closeOverlay(){
    const overlay = document.querySelector('.overlay-modal');
    if(overlay) overlay.remove();
    // reset state
    state = { client: createEmptyClient(), editingPointId: null, appsMeta: state.appsMeta, serversMeta: state.serversMeta, plansMeta: state.plansMeta };
  }

  return { init };
})();

window.clientsView = ClientsView;
export default ClientsView;

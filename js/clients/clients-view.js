// js/clients/clients-view.js
// implementação do wizard e lógica conforme regras descritas
import { createEmptyClient, createEmptyPoint } from './clients-models.js';
import * as V from './clients-validation.js';
import clientsService from './clients-service.js';

const ClientsView = (function(){
  // estado local do formulário
  let state = {
    client: createEmptyClient(),
    editingPointId: null,
    appsMeta: [],
    serversMeta: [],
    plansMeta: []
  };

  // referências DOM na view (serão vinculadas quando a view for carregada)
  let root, formTemplate, pointTemplate, pointItemTemplate;
  let btnSelectPlan, btnSelectServer1, btnSelectServer2, btnAddPoint;
  let inputs = {};

  // helpers
  function q(sel, ctx=root){ return ctx ? ctx.querySelector(sel) : document.querySelector(sel); }
  function qa(sel, ctx=root){ return Array.from((ctx||document).querySelectorAll(sel)); }

  async function init(){
    try{
      // carregar metadados
      clientsService.seedMocksIfEmpty();
      state.appsMeta = await clientsService.listApps();
      state.serversMeta = await clientsService.listServers();
      state.plansMeta = await clientsService.listPlans();

      // Certificar que templates do formulário estão no DOM.
      // Se não estiverem, carregar views/client-form.html e injetar seus templates no document.
      if(!document.getElementById('clientFormTemplate') || !document.getElementById('pointFormTemplate')){
        const res = await fetch('./views/client-form.html', { cache: 'no-store' });
        if(!res.ok) throw new Error(`Falha ao carregar templates: ${res.status}`);
        const text = await res.text();
        const tmp = document.createElement('div');
        tmp.innerHTML = text;
        // mover templates para o body (document) para que possam ser acessados por id
        const templates = tmp.querySelectorAll('template');
        templates.forEach(t => document.body.appendChild(t));
      }

      // localizar templates agora presentes no DOM
      formTemplate = document.getElementById('clientFormTemplate');
      pointTemplate = document.getElementById('pointFormTemplate');
      pointItemTemplate = document.getElementById('pointItemTemplate');

      if(!formTemplate || !pointTemplate || !pointItemTemplate){
        throw new Error('Templates do formulário não encontrados após carregamento');
      }

      // clonar o template principal e anexar ao clientFormRoot existente na view
      const tpl = formTemplate.content.cloneNode(true);
      root = document.createElement('div');
      root.appendChild(tpl);

      const clientFormRoot = document.getElementById('clientFormRoot');
      if(!clientFormRoot) throw new Error('#clientFormRoot não encontrado na view');
      clientFormRoot.innerHTML = '';
      clientFormRoot.appendChild(root);
      clientFormRoot.classList.remove('hidden');
      clientFormRoot.setAttribute('aria-hidden','false');

      bindElements();
      attachHandlers();
      renderInitial();
      updateSaveState();
    }catch(err){
      console.error('Erro inicializando clientsView:', err);
      // exibir erro simples no lugar do formulário, sem quebrar o restante da app
      const clientFormRoot = document.getElementById('clientFormRoot');
      if(clientFormRoot){
        clientFormRoot.classList.remove('hidden');
        clientFormRoot.innerHTML = `<div class="card"><strong>Erro ao carregar formulário</strong><div style="margin-top:.5rem;color:var(--muted)">${String(err)}</div></div>`;
      }
      throw err;
    }
  }

  function bindElements(){
    // inputs step1
    inputs.name = q('#c_name');
    inputs.phone = q('#c_phone');
    inputs.email = q('#c_email');
    inputs.planBtn = q('#btnSelectPlan');
    inputs.planChip = q('#chipPlan');
    inputs.dueDate = q('#c_dueDate');
    inputs.screens = q('#c_screens');
    inputs.server1Btn = q('#btnSelectServer1');
    inputs.server1Chip = q('#chipServer1');
    inputs.server2Btn = q('#btnSelectServer2');
    inputs.server2Chip = q('#chipServer2');
    // step navigation
    inputs.toStep2 = q('#toStep2');
    inputs.backToStep1 = q('#backToStep1');
    // points area
    btnAddPoint = q('#btnAddPoint');
    inputs.pointsList = q('#pointsList');
    inputs.quotaServer1 = q('#quotaServer1');
    inputs.quotaServer2 = q('#quotaServer2');
    inputs.pointFormRoot = q('#pointFormRoot');
    inputs.saveBtn = q('#saveClientBtn');
    // modal controls
    const closeBtn = q('#closeClientModal');
    if(closeBtn) closeBtn.addEventListener('click', closeModal);
    qa('.step').forEach(btn => btn.addEventListener('click', onStepClick));
    // steppers: local delegation (may be multiple steppers, so selecting by class inside document)
    qa('.stepper-incr').forEach(b => b.addEventListener('click', () => changeScreens(1)));
    qa('.stepper-decr').forEach(b => b.addEventListener('click', () => changeScreens(-1)));
  }

  function attachHandlers(){
    if(inputs.name) inputs.name.addEventListener('input', onClientInput);
    if(inputs.phone) inputs.phone.addEventListener('input', onClientInput);
    if(inputs.email) inputs.email.addEventListener('input', onClientInput);
    if(inputs.screens) inputs.screens.addEventListener('input', onClientInput);
    if(inputs.planBtn) inputs.planBtn.addEventListener('click', onSelectPlan);
    if(inputs.server1Btn) inputs.server1Btn.addEventListener('click', onSelectServer1);
    if(inputs.server2Btn) inputs.server2Btn.addEventListener('click', onSelectServer2);
    if(inputs.toStep2) inputs.toStep2.addEventListener('click', gotoStep2);
    if(inputs.backToStep1) inputs.backToStep1.addEventListener('click', gotoStep1);
    if(btnAddPoint) btnAddPoint.addEventListener('click', openPointForm);
    if(inputs.saveBtn) inputs.saveBtn.addEventListener('click', onSaveClient);
  }

  function renderInitial(){
    // preencher valores iniciais
    if(inputs.screens) inputs.screens.value = state.client.screensPerServer || 1;
    if(inputs.quotaServer1) inputs.quotaServer1.textContent = '0';
    if(inputs.quotaServer2) inputs.quotaServer2.textContent = '0';
    renderPointsList();
  }

  function onClientInput(){
    state.client.name = inputs.name ? inputs.name.value : '';
    // keep raw phone in input but normalize for storage
    const rawPhone = inputs.phone ? inputs.phone.value : '';
    state.client.phone = V.normalizePhone(rawPhone);
    state.client.email = inputs.email ? inputs.email.value : '';
    state.client.screensPerServer = inputs.screens ? Number(inputs.screens.value) || 1 : 1;
    updateDerivedFromPlan();
    updateQuotasView();
    validateStep1();
    updateSaveState();
  }

  function updateDerivedFromPlan(){
    if(state.client.planId){
      const plan = state.plansMeta.find(p=>p.id === state.client.planId);
      if(plan && plan.months && inputs.dueDate){
        const due = new Date();
        due.setMonth(due.getMonth() + plan.months);
        const iso = due.toISOString().slice(0,10);
        inputs.dueDate.value = iso;
        state.client.dueDate = iso;
      }
    }
  }

  function changeScreens(delta){
    if(!inputs.screens) return;
    const cur = Number(inputs.screens.value) || 1;
    const next = Math.max(1, cur + delta);
    inputs.screens.value = next;
    onClientInput();
  }

  async function onSelectPlan(){
    const options = state.plansMeta.map(p=>`${p.id}: ${p.name} (${p.months}m)`).join('\n');
    const pick = prompt(`Escolha plano:\n${options}`);
    if(!pick) return;
    const id = pick.split(':')[0].trim();
    const plan = state.plansMeta.find(p=>p.id===id);
    if(plan){
      state.client.planId = plan.id;
      if(inputs.planChip) { inputs.planChip.textContent = `${plan.name} • ${plan.months}m`; inputs.planChip.setAttribute('aria-hidden','false'); }
      updateDerivedFromPlan();
      validateStep1();
      updateSaveState();
    } else {
      alert('Plano não encontrado');
    }
  }

  async function onSelectServer1(){
    const options = state.serversMeta.map(s=>`${s.id}: ${s.name}`).join('\n');
    const pick = prompt(`Escolha Servidor1:\n${options}`);
    if(!pick) return;
    const id = pick.split(':')[0].trim();
    const server = state.serversMeta.find(s=>s.id===id);
    if(server){
      state.client.server1Id = server.id;
      if(inputs.server1Chip){ inputs.server1Chip.textContent = server.name; inputs.server1Chip.setAttribute('aria-hidden','false'); }
      if(state.client.server2Id === server.id){
        state.client.server2Id = null;
        if(inputs.server2Chip){ inputs.server2Chip.textContent=''; inputs.server2Chip.setAttribute('aria-hidden','true'); }
      }
      validateStep1();
      updateQuotasView();
      updateSaveState();
    }
  }

  async function onSelectServer2(){
    const available = state.serversMeta.filter(s => s.id !== state.client.server1Id);
    if(available.length === 0){ alert('Nenhum servidor adicional disponível'); return; }
    const options = available.map(s=>`${s.id}: ${s.name}`).join('\n');
    const pick = prompt(`Escolha Servidor2:\n${options}`);
    if(!pick) return;
    const id = pick.split(':')[0].trim();
    const server = available.find(s=>s.id===id);
    if(server){
      state.client.server2Id = server.id;
      if(inputs.server2Chip){ inputs.server2Chip.textContent = server.name; inputs.server2Chip.setAttribute('aria-hidden','false'); }
      validateStep1();
      updateQuotasView();
      updateSaveState();
    }
  }

  function validateStep1(){
    const nameV = V.validateName(state.client.name);
    const phoneV = V.validatePhoneRaw(inputs.phone ? inputs.phone.value : '');
    const emailV = V.validateEmail(state.client.email);
    const screensV = V.validateScreens(inputs.screens ? inputs.screens.value : 1);
    const dueV = V.validateDueDate(inputs.dueDate ? inputs.dueDate.value : null);

    if(document.getElementById('err_name')) document.getElementById('err_name').textContent = nameV.ok ? '' : nameV.msg;
    if(document.getElementById('err_phone')) document.getElementById('err_phone').textContent = phoneV.ok ? '' : phoneV.msg;
    if(document.getElementById('err_email')) document.getElementById('err_email').textContent = emailV.ok ? '' : emailV.msg;
    if(document.getElementById('err_screens')) document.getElementById('err_screens').textContent = screensV.ok ? '' : screensV.msg;
    if(document.getElementById('err_dueDate')) document.getElementById('err_dueDate').textContent = dueV.ok ? '' : dueV.msg;
    if(document.getElementById('err_plan')) document.getElementById('err_plan').textContent = state.client.planId ? '' : 'Plano obrigatório';
    if(document.getElementById('err_server1')) document.getElementById('err_server1').textContent = state.client.server1Id ? '' : 'Servidor1 obrigatório';

    const ok = nameV.ok && phoneV.ok && emailV.ok && screensV.ok && dueV.ok && !!state.client.planId && !!state.client.server1Id;
    if(inputs.toStep2) inputs.toStep2.disabled = !ok;
  }

  function gotoStep2(){
    qa('.step').forEach(b => { b.classList.remove('active'); b.setAttribute('aria-selected','false'); });
    const s2 = document.querySelector('.step[data-step="2"]'); if(s2) { s2.classList.add('active'); s2.setAttribute('aria-selected','true'); }
    const panel1 = document.querySelector('.step-panel[data-step="1"]');
    const panel2 = document.querySelector('.step-panel[data-step="2"]');
    if(panel1) { panel1.classList.add('hidden'); panel1.setAttribute('aria-hidden','true'); }
    if(panel2) { panel2.classList.remove('hidden'); panel2.setAttribute('aria-hidden','false'); }
    updateQuotasView();
    renderPointsList();
    updateSaveState();
  }

  function gotoStep1(){
    qa('.step').forEach(b => { b.classList.remove('active'); b.setAttribute('aria-selected','false'); });
    const s1 = document.querySelector('.step[data-step="1"]'); if(s1) { s1.classList.add('active'); s1.setAttribute('aria-selected','true'); }
    const panel1 = document.querySelector('.step-panel[data-step="1"]');
    const panel2 = document.querySelector('.step-panel[data-step="2"]');
    if(panel2) { panel2.classList.add('hidden'); panel2.setAttribute('aria-hidden','true'); }
    if(panel1) { panel1.classList.remove('hidden'); panel1.setAttribute('aria-hidden','false'); }
    updateSaveState();
  }

  function updateQuotasView(){
    const sums = V.sumConns(state.client.points);
    const s1id = state.client.server1Id;
    const s2id = state.client.server2Id;
    const screens = state.client.screensPerServer || 1;
    if(inputs.quotaServer1) inputs.quotaServer1.textContent = `${sums[s1id] || 0} / ${screens}`;
    if(inputs.quotaServer2) inputs.quotaServer2.textContent = s2id ? `${sums[s2id] || 0} / ${screens}` : '-';
  }

  // ponto CRUD
  function openPointForm(editPoint=null){
    const clone = pointTemplate.content.cloneNode(true);
    const formEl = clone.querySelector('.point-form');
    const sel = formEl.querySelector('#p_server');
    // preencher opções de servidor
    sel.innerHTML = '';
    const servers = prepareServerOptionsForPoint();
    servers.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s.id; opt.textContent = s.name; sel.appendChild(opt);
    });

    if(editPoint){
      state.editingPointId = editPoint.id;
      formEl.querySelector('#p_conns').value = editPoint.conns;
      formEl.querySelector('#p_user').value = editPoint.user;
      formEl.querySelector('#p_pass').value = editPoint.pass;
      sel.value = editPoint.serverId;
      const appMeta = state.appsMeta.find(a=>a.id===editPoint.appId);
      if(appMeta) formEl.querySelector('#chipApp').textContent = appMeta.name;
      formEl.querySelector('#pointFormTitle').textContent = 'Editar Ponto';
      formEl.dataset.appid = editPoint.appId;
    } else {
      state.editingPointId = null;
      const pre = selectPreServerForNewPoint();
      if(pre) sel.value = pre.id;
      formEl.querySelector('#pointFormTitle').textContent = 'Novo Ponto';
    }

    const btnSelectAppLocal = formEl.querySelector('#btnSelectApp');
    const chipApp = formEl.querySelector('#chipApp');
    const inputConns = formEl.querySelector('#p_conns');
    const stepDec = formEl.querySelector('.stepper-decr');
    const stepInc = formEl.querySelector('.stepper-incr');
    const btnCancel = formEl.querySelector('#cancelPointBtn');
    const btnAdd = formEl.querySelector('#addPointBtn');

    btnSelectAppLocal.addEventListener('click', async ()=>{
      const options = state.appsMeta.map(a=>`${a.id}: ${a.name} (mult:${a.multiplosAcessos})`).join('\n');
      const pick = prompt(`Escolha App:\n${options}`);
      if(!pick) return;
      const id = pick.split(':')[0].trim();
      const meta = state.appsMeta.find(a=>a.id===id);
      if(meta){
        formEl.dataset.appid = meta.id;
        chipApp.textContent = meta.name;
        chipApp.setAttribute('aria-hidden','false');
        if(meta.multiplosAcessos === false){
          inputConns.value = 1;
          inputConns.setAttribute('disabled','true');
        } else {
          inputConns.removeAttribute('disabled');
        }
      }
    });

    stepDec.addEventListener('click', ()=> {
      const cur = Math.max(1, Number(inputConns.value || 1)-1);
      inputConns.value = cur;
    });
    stepInc.addEventListener('click', ()=> {
      const cur = Math.max(1, Number(inputConns.value || 1)+1);
      inputConns.value = cur;
    });

    btnCancel.addEventListener('click', ()=> {
      state.editingPointId = null;
      inputs.pointFormRoot.classList.add('hidden');
      inputs.pointFormRoot.innerHTML = '';
      updateQuotasView();
      updateSaveState();
    });

    btnAdd.addEventListener('click', async ()=>{
      const point = {
        id: state.editingPointId || ('p_' + Date.now().toString(36)),
        serverId: sel.value,
        appId: formEl.dataset.appid || null,
        conns: Number(inputConns.value || 1),
        user: formEl.querySelector('#p_user').value.trim(),
        pass: formEl.querySelector('#p_pass').value
      };

      const appMeta = state.appsMeta.find(a=>a.id === point.appId);
      const existing = state.client.points.filter(p => p.serverId === point.serverId && p.id !== point.id);

      const valid = V.validatePointLocal(point, appMeta, state.client.screensPerServer, existing);
      if(!valid.ok){
        formEl.querySelector('#err_p_conns').textContent = valid.msg;
        return;
      }

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
    });

    inputs.pointFormRoot.innerHTML = '';
    inputs.pointFormRoot.appendChild(clone);
    inputs.pointFormRoot.classList.remove('hidden');
    inputs.pointFormRoot.setAttribute('aria-hidden','false');
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
      const empty = document.createElement('div');
      empty.className = 'card';
      empty.textContent = 'Nenhum ponto adicionado';
      inputs.pointsList.appendChild(empty);
      return;
    }

    for(const p of state.client.points){
      const clone = pointItemTemplate.content.cloneNode(true);
      const item = clone.querySelector('.point-item');
      item.dataset.id = p.id;
      item.querySelector('.point-server').textContent = state.serversMeta.find(s=>s.id===p.serverId)?.name || p.serverId;
      item.querySelector('.point-app').textContent = state.appsMeta.find(a=>a.id===p.appId)?.name || p.appId;
      item.querySelector('.point-conns').textContent = `Conexões: ${p.conns}`;
      item.querySelector('.point-user').textContent = `Usuário: ${p.user}`;
      item.querySelector('.point-pass').textContent = `Senha: ${p.pass ? '●●●●●' : ''}`;

      item.querySelector('.edit-point').addEventListener('click', ()=> openPointForm(p));
      item.querySelector('.remove-point').addEventListener('click', ()=> {
        if(!confirm('Remover ponto?')) return;
        state.client.points = state.client.points.filter(x=>x.id !== p.id);
        renderPointsList();
        updateQuotasView();
        updateSaveState();
      });

      inputs.pointsList.appendChild(clone);
    }
  }

  async function updateSaveState(){
    const nameV = V.validateName(state.client.name);
    const phoneV = V.validatePhoneRaw(state.client.phone);
    const screensV = V.validateScreens(state.client.screensPerServer);
    const dueV = V.validateDueDate(inputs.dueDate ? inputs.dueDate.value : null);
    const planSelected = !!state.client.planId;
    const server1Selected = !!state.client.server1Id;

    const sums = V.sumConns(state.client.points);
    const s1id = state.client.server1Id;
    const s2id = state.client.server2Id;
    const screens = state.client.screensPerServer || 1;

    let quotaExact = true;
    if(s1id){
      if((sums[s1id] || 0) !== screens) quotaExact = false;
    }
    if(s2id){
      if((sums[s2id] || 0) !== screens) quotaExact = false;
    } else {
      if(s1id && (sums[s1id] || 0) !== screens) quotaExact = false;
    }

    const localUnique = V.checkLocalUniqueAppUser(state.client.points);

    const enable = nameV.ok && phoneV.ok && screensV.ok && dueV.ok && planSelected && server1Selected && quotaExact && localUnique.ok;
    if(inputs.saveBtn) inputs.saveBtn.disabled = !enable;
  }

  async function onSaveClient(){
    const payload = {
      name: state.client.name.trim(),
      phone: V.normalizePhone(inputs.phone ? inputs.phone.value : ''),
      email: state.client.email ? state.client.email.trim() : null,
      planId: state.client.planId,
      dueDate: inputs.dueDate ? inputs.dueDate.value : null,
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
        closeModal();
      } else {
        throw new Error('Falha ao salvar');
      }
    }catch(err){
      alert('Erro ao salvar: ' + (err.message || String(err)));
      if(inputs.saveBtn) inputs.saveBtn.disabled = false;
    }
  }

  function closeModal(){
    const clientFormRoot = document.getElementById('clientFormRoot');
    if(clientFormRoot){
      clientFormRoot.classList.add('hidden');
      clientFormRoot.setAttribute('aria-hidden','true');
      clientFormRoot.innerHTML = '';
    }
    state = { client: createEmptyClient(), editingPointId: null, appsMeta: state.appsMeta, serversMeta: state.serversMeta, plansMeta: state.plansMeta };
  }

  // small handler for clicking step buttons
  function onStepClick(e){
    const step = e.currentTarget && e.currentTarget.dataset && e.currentTarget.dataset.step;
    if(step === '1') gotoStep1();
    if(step === '2') gotoStep2();
  }

  return { init };
})();

window.clientsView = ClientsView;
export default ClientsView;

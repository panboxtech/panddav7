// js/clients/clients-view.js
// View/controller para CRUD de clientes usando manipulação DOM segura (sem injeção)
import { listClients, createClient, updateClient, removeClient } from './clients-service.js';

const ClientsView = (function(){
  let tableBody, newBtn, searchInput, formRoot;
  let currentEditId = null;

  function bindElements(){
    tableBody = document.querySelector('#clientsTable tbody');
    newBtn = document.getElementById('newClientBtn');
    searchInput = document.getElementById('searchClients');
    formRoot = document.getElementById('clientFormRoot');
  }

  async function init(){
    bindElements();
    newBtn.addEventListener('click', onNew);
    searchInput.addEventListener('input', onSearch);
    await renderList();
  }

  async function renderList(query){
    const items = await listClients(query);
    // limpa tbody com método seguro
    while(tableBody.firstChild) tableBody.removeChild(tableBody.firstChild);

    if(items.length === 0){
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.setAttribute('colspan','4');
      td.textContent = 'Nenhum cliente encontrado';
      tr.appendChild(td);
      tableBody.appendChild(tr);
      return;
    }

    for(const i of items){
      const tr = document.createElement('tr');
      tr.dataset.id = i.id;

      const tdName = document.createElement('td');
      tdName.textContent = i.name || '';
      tr.appendChild(tdName);

      const tdPhone = document.createElement('td');
      tdPhone.textContent = i.phone || '';
      tr.appendChild(tdPhone);

      const tdUser = document.createElement('td');
      tdUser.textContent = i.user || '';
      tr.appendChild(tdUser);

      const tdActions = document.createElement('td');

      const editBtn = document.createElement('button');
      editBtn.className = 'icon-btn edit-btn';
      editBtn.type = 'button';
      editBtn.setAttribute('aria-label','Editar');
      editBtn.textContent = '✎';
      editBtn.addEventListener('click', ()=> onEdit(i.id));
      tdActions.appendChild(editBtn);

      const delBtn = document.createElement('button');
      delBtn.className = 'icon-btn del-btn';
      delBtn.type = 'button';
      delBtn.setAttribute('aria-label','Remover');
      delBtn.textContent = '🗑';
      delBtn.addEventListener('click', ()=> onDelete(i.id));
      tdActions.appendChild(delBtn);

      tr.appendChild(tdActions);
      tableBody.appendChild(tr);
    }
  }

  async function onNew(){
    currentEditId = null;
    await showForm();
  }

  async function onEdit(id){
    currentEditId = id;
    const all = await listClients();
    const item = all.find(x=>x.id === id);
    await showForm(item);
  }

  async function onDelete(id){
    const ok = confirm('Remover cliente?');
    if(!ok) return;
    await removeClient(id);
    await renderList(searchInput.value);
  }

  async function onSearch(e){
    await renderList(e.target.value);
  }

  // cria formulário a partir do template em views/client-form.html sem injeção de dados
  async function showForm(data = null){
    try{
      const res = await fetch('./views/client-form.html', {cache: 'no-store'});
      if(!res.ok) throw new Error(`Falha ao carregar template do formulário: ${res.status} ${res.statusText}`);
      const text = await res.text();
      const temp = document.createElement('div');
      temp.innerHTML = text;
      const tpl = temp.querySelector('#clientFormTemplate');
      if(!tpl) throw new Error('Template clientFormTemplate não encontrado em views/client-form.html');

      const clone = tpl.content.cloneNode(true);
      const formEl = clone.querySelector('.client-form');
      const title = formEl.querySelector('#formTitle');
      const fName = formEl.querySelector('#fieldName');
      const fPhone = formEl.querySelector('#fieldPhone');
      const fUser = formEl.querySelector('#fieldUser');
      const fPass = formEl.querySelector('#fieldPass');
      const saveBtn = formEl.querySelector('#saveClientBtn');
      const cancelBtn = formEl.querySelector('#cancelClientBtn');
      const msg = formEl.querySelector('#formMsg');

      if(data){
        title.textContent = 'Editar Cliente';
        fName.value = data.name || '';
        fPhone.value = data.phone || '';
        fUser.value = data.user || '';
      } else {
        title.textContent = 'Novo Cliente';
        fName.value = '';
        fPhone.value = '';
        fUser.value = '';
        fPass.value = '';
      }

      formRoot.innerHTML = '';
      formRoot.appendChild(clone);
      formRoot.classList.remove('hidden');
      formRoot.setAttribute('aria-hidden','false');

      cancelBtn.addEventListener('click', ()=> {
        formRoot.classList.add('hidden');
        formRoot.setAttribute('aria-hidden','true');
        formRoot.innerHTML = '';
      });

      saveBtn.addEventListener('click', async ()=>{
        msg.textContent = '';
        const payload = {
          name: fName.value.trim(),
          phone: fPhone.value.trim(),
          user: fUser.value.trim(),
          pass: fPass.value
        };
        if(!payload.name || !payload.user){
          msg.textContent = 'Nome e usuário obrigatórios';
          return;
        }
        try{
          if(data){
            await updateClient(data.id, payload);
          } else {
            await createClient(payload);
          }
          formRoot.classList.add('hidden');
          formRoot.setAttribute('aria-hidden','true');
          formRoot.innerHTML = '';
          await renderList(searchInput.value);
        }catch(err){
          msg.textContent = String(err);
        }
      });
    }catch(err){
      console.error(err);
      formRoot.innerHTML = `<div class="msg" style="color:var(--muted)">${String(err)}</div>`;
      formRoot.classList.remove('hidden');
    }
  }

  return { init };
})();

window.clientsView = ClientsView;
export default ClientsView;

// js/ui.js
// controla sidebar, overlay, mobile behavior, logout e carregamento seguro de views
// NÃO importar arquivos HTML com import; usar fetch('./views/....html').

document.addEventListener('DOMContentLoaded', ()=>{
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('overlay');
  const mobileBtn = document.getElementById('mobileMenuBtn');
  const toggleBtn = document.getElementById('toggleSidebar');
  const logoutBtn = document.getElementById('logoutBtn');
  const viewButtons = document.querySelectorAll('.menu-item');
  const viewRoot = document.getElementById('viewRoot');
  const viewTitle = document.getElementById('viewTitle');

  function openMobileSidebar(){ sidebar.classList.add('open'); overlay.classList.remove('hidden'); overlay.focus(); }
  function closeMobileSidebar(){ sidebar.classList.remove('open'); overlay.classList.add('hidden'); }
  function toggleDesktopSidebar(){
    const minimized = sidebar.classList.toggle('minimized');
    toggleBtn.setAttribute('aria-pressed', String(minimized));
  }

  mobileBtn?.addEventListener('click', openMobileSidebar);
  overlay?.addEventListener('click', closeMobileSidebar);
  toggleBtn?.addEventListener('click', toggleDesktopSidebar);
  logoutBtn?.addEventListener('click', ()=>{ localStorage.removeItem('mock_auth'); window.location.href='./index.html' });

  viewButtons.forEach(btn=>{
    btn.addEventListener('click', async ()=>{
      const view = btn.dataset.view;
      viewTitle.textContent = btn.textContent;
      await loadView(view);
      if(window.innerWidth < 880) closeMobileSidebar();
    });
  });

  async function loadView(name){
    try{
      if(name === 'clients'){
        const res = await fetch('./views/clients-list.html', {cache: 'no-store'});
        if(!res.ok) throw new Error(`Falha ao carregar view clients: ${res.status} ${res.statusText}`);
        const text = await res.text();
        const temp = document.createElement('div');
        temp.innerHTML = text;
        viewRoot.innerHTML = '';
        Array.from(temp.childNodes).forEach(node => viewRoot.appendChild(node));
        // chama init da view se disponível globalmente
        if(window.clientsView && typeof window.clientsView.init === 'function'){
          try{ await window.clientsView.init(); }catch(err){ console.error('Erro inicializando clientsView:', err); }
        }
      } else {
        console.warn('View não registrada:', name);
      }
    }catch(err){
      console.error(err);
      viewRoot.innerHTML = `<div class="card"><strong>Erro</strong><div style="margin-top:.5rem;color:var(--muted)">${String(err)}</div></div>`;
    }
  }

  // carregar view padrão
  loadView('clients');
});

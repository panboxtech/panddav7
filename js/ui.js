// controla sidebar, overlay, mobile behavior, logout e carregamento seguro de views
import '../views/clients-list.html';

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
  logoutBtn?.addEventListener('click', ()=>{ localStorage.removeItem('mock_auth'); window.location.href='index.html' });

  viewButtons.forEach(btn=>{
    btn.addEventListener('click', async ()=>{
      const view = btn.dataset.view;
      viewTitle.textContent = btn.textContent;
      await loadView(view);
      if(window.innerWidth < 880) closeMobileSidebar();
    });
  });

  async function loadView(name){
    // carrega a view estática (arquivo HTML com estrutura e template)
    // fetch apenas do arquivo controlado para acessar templates estáticos
    if(name === 'clients'){
      const res = await fetch('views/clients-list.html');
      const text = await res.text();
      // criar container temporário para inserir a estrutura estática de view
      const temp = document.createElement('div');
      temp.innerHTML = text;
      // limpa viewRoot e anexa nodes (estrutura conhecida estática)
      viewRoot.innerHTML = '';
      Array.from(temp.childNodes).forEach(node => viewRoot.appendChild(node));
      // inicializa view (clients-view exporta init automaticamente)
      if(window.clientsView && typeof window.clientsView.init === 'function'){
        window.clientsView.init();
      }
    }
  }

  // carregar view padrão
  loadView('clients');
});

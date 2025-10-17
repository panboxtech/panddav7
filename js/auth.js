import { SupabaseConfig } from './supabase-config.js';

document.addEventListener('DOMContentLoaded', ()=>{
  const form = document.getElementById('loginForm');
  const msg = document.getElementById('loginMessage');

  form.addEventListener('submit', async (e)=>{
    e.preventDefault();
    msg.textContent = '';
    const user = document.getElementById('loginUser').value.trim();
    const pass = document.getElementById('loginPass').value;
    if(!user || !pass){ msg.textContent = 'Preencha usuário e senha'; return; }

    // Provisório: mock auth para protótipo local
    localStorage.setItem('mock_auth', JSON.stringify({user, loggedAt: Date.now()}));
    window.location.href = 'dashboard.html';
  });

  // Se desejar proteger a rota do dashboard no futuro, aqui checa Supabase token
});

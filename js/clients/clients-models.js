// js/clients/clients-models.js
// modelos e valores default usados no formulário

export function createEmptyClient(){
  return {
    id: null,
    name: '',
    phone: '',
    email: '',
    planId: null,
    dueDate: null,
    screensPerServer: 1,
    server1Id: null,
    server2Id: null, // opcional
    points: [] // lista de ponto temporária antes de persistir
  };
}

export function createEmptyPoint(){
  return {
    id: null,
    serverId: null,
    appId: null,
    conns: 1,
    user: '',
    pass: ''
  };
}

// Referências da UI
const screenLogin = document.getElementById('screen-login');
const screenPainel = document.getElementById('screen-painel');
const loginForm = document.getElementById('login-form');
const incidentForm = document.getElementById('incident-form');
const searchForm = document.getElementById('search-form');
const supabaseStatus = document.getElementById('supabase-status');
const resultsList = document.getElementById('results-list');
const resultCount = document.getElementById('result-count');
const formFeedback = document.getElementById('form-feedback');
const logoutButton = document.getElementById('logout-button');

// Tema
const themeToggle = document.getElementById('toggle-theme');
let currentTheme = localStorage.getItem('incnoc_theme') || 'escuro';

// Modal de Configurações (apenas tema, se quiser manter)
const settingsButton = document.getElementById('open-settings');
const settingsModal = document.getElementById('settings-modal');
const settingsBackdrop = document.getElementById('settings-backdrop');
const settingsClose = document.getElementById('close-settings');

// 🔗 Configuração fixa do Supabase (TROQUE pelos dados do seu projeto)
const SUPABASE_URL = "https://nlrupvqyszeugbaqqsne.supabase.co";   // TODO: cole aqui a Project URL
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5scnVwdnF5c3pldWdiYXFxc25lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyODUyMDUsImV4cCI6MjA4MDg2MTIwNX0.zoM8coc0msD6g8DVEH9tahjf1zRMw6tYNv6Ygl17eAI";                 // TODO: cole aqui a anon public key

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

let currentUser = '';

/* UTILIDADES BÁSICAS */

function showScreen(target) {
  const screens = { login: screenLogin, painel: screenPainel };
  Object.entries(screens).forEach(([name, el]) => {
    const active = name === target;
    el?.classList.toggle('screen--active', active);
    if (el) el.hidden = !active;
  });
}

function setStatus(text, ok = false) {
  if (!supabaseStatus) return;
  supabaseStatus.textContent = text;
  supabaseStatus.style.color = ok ? 'var(--accent)' : 'var(--muted)';
}

function block(event) {
  event.preventDefault();
  event.stopPropagation();
}

/* TEMA */

function updateTheme() {
  document.documentElement.dataset.theme = currentTheme === 'claro' ? 'claro' : '';
  if (themeToggle) {
    themeToggle.textContent = currentTheme === 'claro' ? 'Tema: Claro' : 'Tema: Escuro';
  }
  localStorage.setItem('incnoc_theme', currentTheme);
}

/* LOGIN COM SUPABASE AUTH */

async function handleLogin(event) {
  block(event);

  const formData = new FormData(loginForm);
  const email = formData.get('email');
  const senha = formData.get('senha');

  if (!email || !senha) {
    if (formFeedback) formFeedback.textContent = 'Preencha e-mail e senha.';
    return;
  }

  const { data, error } = await supabaseClient.auth.signInWithPassword({
    email,
    password: senha,
  });

  if (error) {
    if (formFeedback) {
      formFeedback.textContent = 'Falha no login: ' + error.message;
    }
    setStatus('Erro ao conectar / autenticar no Supabase');
    return;
  }

  // usuário autenticado com sucesso
  currentUser = email;
  if (formFeedback) formFeedback.textContent = '';
  setStatus(`Conectado como ${email}`, true);
  showScreen('painel');
}

/* LOGOUT */

async function handleLogout() {
  currentUser = '';
  await supabaseClient.auth.signOut();
  setStatus('Conectado ao Supabase. Faça login para usar o painel.');
  incidentForm?.reset();
  searchForm?.reset();
  resultsList.innerHTML = '';
  resultCount.textContent = 'Nenhuma busca realizada';
  if (formFeedback) formFeedback.textContent = '';
  showScreen('login');
}

/* UPLOAD DA EVIDÊNCIA */

async function toBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/* REGISTRO DE INCIDENTE */

async function handleIncidentSubmit(event) {
  block(event);

  const { data: authData } = await supabaseClient.auth.getUser();
  if (!authData?.user) {
    formFeedback.textContent = 'Sessão expirada ou usuário não autenticado. Faça login novamente.';
    showScreen('login');
    return;
  }

  const data = new FormData(incidentForm);
  const evidenciaFile = data.get('evidencia');
  let evidencia = null;

  if (evidenciaFile && evidenciaFile.size > 0) {
    if (evidenciaFile.size > 5 * 1024 * 1024) {
      formFeedback.textContent = 'A imagem deve ter no máximo 5MB para evitar erros.';
      return;
    }
    evidencia = await toBase64(evidenciaFile);
  } else {
    formFeedback.textContent = 'Envie ao menos uma imagem de evidência.';
    return;
  }

  const payload = {
    evidencia,
    empresa: data.get('empresa'),
    sistema: data.get('sistema'),
    parte: data.get('parte'),
    data: data.get('data'),
    hora: data.get('hora'),
    afetados: data.get('afetados'),
    impacto: data.get('impacto'),
    id_incidente: data.get('idIncidente'),
    detalhes: data.get('detalhes'),
    responsavel: currentUser || authData.user.email,
    palavras_chave: [data.get('empresa'), data.get('sistema'), data.get('parte'), data.get('detalhes')]
      .filter(Boolean)
      .join(', '),
    criado_em: new Date().toISOString()
  };

  const { error } = await supabaseClient.from('incidentes').insert([payload]);

  if (error) {
    if (error.message && error.message.toLowerCase().includes('row level security')) {
      formFeedback.textContent = 'Você está autenticado, mas não tem permissão para registrar incidentes. Verifique se seu e-mail está cadastrado no NOC.';
    } else {
      formFeedback.textContent = `Erro ao salvar: ${error.message}`;
    }
    return;
  }

  incidentForm.reset();
  formFeedback.textContent = 'Incidente salvo com sucesso!';
}

/* BUSCA NO HISTÓRICO */

async function handleSearch(event) {
  block(event);
  const term = document.getElementById('search-term').value.trim();

  const { data: authData } = await supabaseClient.auth.getUser();
  if (!authData?.user) {
    resultCount.textContent = 'Sessão expirada. Faça login novamente.';
    resultsList.innerHTML = '';
    showScreen('login');
    return;
  }

  let query = supabaseClient
    .from('incidentes')
    .select('*')
    .order('criado_em', { ascending: false });

  if (term) {
    query = query.ilike('palavras_chave', `%${term}%`);
  }

  const { data, error } = await query;

  if (error) {
    if (error.message && error.message.toLowerCase().includes('row level security')) {
      resultCount.textContent =
        'Você está autenticado, mas não tem permissão para ver o histórico. Verifique se seu e-mail está cadastrado no NOC.';
    } else {
      resultCount.textContent = `Erro na busca: ${error.message}`;
    }
    resultsList.innerHTML = '';
    return;
  }

  renderResults(data || []);
}

function renderResults(items) {
  resultsList.innerHTML = '';
  if (!items.length) {
    resultCount.textContent = 'Nenhum incidente encontrado.';
    return;
  }

  resultCount.textContent = `${items.length} incidente(s) encontrado(s)`;
  items.forEach((item) => {
    const li = document.createElement('li');
    li.className = 'result-card';
    const evidenciaHtml = item.evidencia
      ? `
        <div class="result-image">
          <img src="${item.evidencia}" alt="Evidência do incidente ${item.id_incidente || ''}" loading="lazy" />
        </div>`
      : '';
    li.innerHTML = `
      <h4>${item.id_incidente || 'Sem ID'} - ${item.sistema || 'Sistema'}</h4>
      <p>${item.detalhes || 'Sem descrição'}</p>
      ${evidenciaHtml}
      <div class="result-meta">
        <span>Empresa: ${item.empresa || '-'}</span>
        <span>Data: ${item.data || '-'}</span>
        <span>Hora: ${item.hora || '-'}</span>
        <span>Afetados: ${item.afetados ?? '-'}</span>
      </div>
    `;
    resultsList.appendChild(li);
  });
}

/* MODAL DE CONFIGURAÇÕES (apenas tema, se estiver usando) */

function openSettings() {
  if (!settingsModal || !settingsBackdrop) return;
  settingsModal.hidden = false;
  settingsBackdrop.hidden = false;
}

function closeSettings() {
  if (!settingsModal || !settingsBackdrop) return;
  settingsModal.hidden = true;
  settingsBackdrop.hidden = true;
}

/* EVENTOS */

logoutButton?.addEventListener('click', handleLogout);
loginForm?.addEventListener('submit', handleLogin);
incidentForm?.addEventListener('submit', handleIncidentSubmit);
searchForm?.addEventListener('submit', handleSearch);

themeToggle?.addEventListener('click', () => {
  currentTheme = currentTheme === 'claro' ? 'escuro' : 'claro';
  updateTheme();
});

settingsButton?.addEventListener('click', openSettings);
settingsClose?.addEventListener('click', closeSettings);
settingsBackdrop?.addEventListener('click', closeSettings);

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && settingsModal && !settingsModal.hidden) {
    closeSettings();
  }
});

/* INICIALIZAÇÃO */

updateTheme();
setStatus('Conectado ao Supabase. Faça login para usar o painel.', true);
showScreen('login');

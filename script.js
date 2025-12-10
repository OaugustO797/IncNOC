const screenLogin = document.getElementById('screen-login');
const screenPainel = document.getElementById('screen-painel');
const loginForm = document.getElementById('login-form');
const incidentForm = document.getElementById('incident-form');
const searchForm = document.getElementById('search-form');
const supabaseForm = document.getElementById('supabase-form');
const supabaseStatus = document.getElementById('supabase-status');
const resultsList = document.getElementById('results-list');
const resultCount = document.getElementById('result-count');
const formFeedback = document.getElementById('form-feedback');
const themeToggle = document.getElementById('toggle-theme');
const logoutButton = document.getElementById('logout-button');
const supabaseUrlInput = document.getElementById('supabase-url');
const supabaseKeyInput = document.getElementById('supabase-key');

// elementos do modal de configurações
const settingsButton = document.getElementById('open-settings');
const settingsModal = document.getElementById('settings-modal');
const settingsBackdrop = document.getElementById('settings-backdrop');
const settingsClose = document.getElementById('close-settings');

let supabaseClient = null;
let currentUser = '';
let currentTheme = localStorage.getItem('incnoc_theme') || 'escuro';

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

function updateTheme() {
  document.documentElement.dataset.theme = currentTheme === 'claro' ? 'claro' : '';
  if (themeToggle) {
    themeToggle.textContent = currentTheme === 'claro' ? 'Tema: Claro' : 'Tema: Escuro';
  }
  localStorage.setItem('incnoc_theme', currentTheme);
}

function loadSupabaseConfig() {
  if (!supabaseUrlInput || !supabaseKeyInput) return;
  const savedUrl = localStorage.getItem('incnoc_supabase_url');
  const savedKey = localStorage.getItem('incnoc_supabase_key');
  if (savedUrl) supabaseUrlInput.value = savedUrl;
  if (savedKey) supabaseKeyInput.value = savedKey;
}

function initSupabase() {
  const url = supabaseUrlInput?.value.trim();
  const key = supabaseKeyInput?.value.trim();

  localStorage.setItem('incnoc_supabase_url', url || '');
  localStorage.setItem('incnoc_supabase_key', key || '');

  if (!url || !key) {
    supabaseClient = null;
    setStatus('Supabase não configurado');
    return;
  }

  supabaseClient = window.supabase.createClient(url, key);
  setStatus('Conectado ao Supabase. Use o formulário para salvar ou buscar.', true);
}

function block(event) {
  event.preventDefault();
  event.stopPropagation();
}

async function handleLogin(event) {
  block(event);
  const formData = new FormData(loginForm);
  currentUser = formData.get('email');
  showScreen('painel');
  initSupabase();
}

async function toBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function handleIncidentSubmit(event) {
  block(event);
  if (!supabaseClient) {
    formFeedback.textContent = 'Configure o Supabase antes de salvar.';
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
    responsavel: currentUser,
    palavras_chave: [data.get('empresa'), data.get('sistema'), data.get('parte'), data.get('detalhes')]
      .filter(Boolean)
      .join(', '),
    criado_em: new Date().toISOString()
  };

  const { error } = await supabaseClient.from('incidentes').insert([payload]);
  if (error) {
    formFeedback.textContent = `Erro ao salvar: ${error.message}`;
    return;
  }

  incidentForm.reset();
  formFeedback.textContent = 'Incidente salvo com sucesso!';
}

async function handleSearch(event) {
  block(event);
  const term = document.getElementById('search-term').value.trim();

  if (!supabaseClient) {
    resultCount.textContent = 'Configure o Supabase para usar a busca.';
    resultsList.innerHTML = '';
    return;
  }

  let query = supabaseClient.from('incidentes').select('*').order('criado_em', { ascending: false });
  if (term) query = query.ilike('palavras_chave', `%${term}%`);

  const { data, error } = await query;
  if (error) {
    resultCount.textContent = `Erro na busca: ${error.message}`;
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
    li.innerHTML = `
      <h4>${item.id_incidente || 'Sem ID'} - ${item.sistema || 'Sistema'}</h4>
      <p>${item.detalhes || 'Sem descrição'}</p>
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

// --------- EVENTOS GERAIS ---------

logoutButton?.addEventListener('click', () => {
  currentUser = '';
  supabaseClient = null;
  setStatus('Supabase não configurado');
  incidentForm?.reset();
  searchForm?.reset();
  resultsList.innerHTML = '';
  resultCount.textContent = 'Nenhuma busca realizada';
  if (formFeedback) formFeedback.textContent = '';
  showScreen('login');
});

loginForm?.addEventListener('submit', handleLogin);
incidentForm?.addEventListener('submit', handleIncidentSubmit);
searchForm?.addEventListener('submit', handleSearch);

supabaseForm?.addEventListener('submit', (event) => {
  block(event);
  initSupabase();
});

// alternar tema
themeToggle?.addEventListener('click', () => {
  currentTheme = currentTheme === 'claro' ? 'escuro' : 'claro';
  updateTheme();
});

// abrir/fechar modal de configurações
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

settingsButton?.addEventListener('click', openSettings);
settingsClose?.addEventListener('click', closeSettings);
settingsBackdrop?.addEventListener('click', closeSettings);

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && settingsModal && !settingsModal.hidden) {
    closeSettings();
  }
});

// inicialização
loadSupabaseConfig();
updateTheme();
showScreen('login');

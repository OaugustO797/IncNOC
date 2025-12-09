const app = document.getElementById('app');
const loginForm = document.getElementById('login-form');
const incidentForm = document.getElementById('incident-form');
const searchForm = document.getElementById('search-form');
const supabaseForm = document.getElementById('supabase-form');
const supabaseStatus = document.getElementById('supabase-status');
const resultsList = document.getElementById('results-list');
const resultCount = document.getElementById('result-count');
const formFeedback = document.getElementById('form-feedback');
const themeToggle = document.getElementById('toggle-theme');

let supabaseClient = null;
let currentUser = '';
let currentTheme = 'escuro';

function setStatus(text, ok = false) {
  supabaseStatus.textContent = text;
  supabaseStatus.style.color = ok ? 'var(--accent)' : 'var(--muted)';
}

function updateTheme() {
  document.documentElement.dataset.theme = currentTheme === 'claro' ? 'claro' : '';
  themeToggle.textContent = currentTheme === 'claro' ? 'Tema: Claro' : 'Tema: Escuro';
}

themeToggle.addEventListener('click', () => {
  currentTheme = currentTheme === 'claro' ? 'escuro' : 'claro';
  updateTheme();
});

function initSupabase() {
  const url = document.getElementById('supabase-url').value.trim();
  const key = document.getElementById('supabase-key').value.trim();

  if (!url || !key) {
    supabaseClient = null;
    setStatus('Supabase não configurado');
    return;
  }

  supabaseClient = window.supabase.createClient(url, key);
  setStatus('Conectado ao Supabase. Use o formulário para salvar ou buscar.', true);
}

async function handleLogin(event) {
  event.preventDefault();
  const formData = new FormData(loginForm);
  currentUser = formData.get('email');
  app.hidden = false;
  document.querySelector('.hero').style.display = 'none';
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
  event.preventDefault();
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
  }

  const payload = {
    evidencia,
    empresa: data.get('empresa'),
    sistema: data.get('sistema'),
    parte: data.get('parte'),
    data: data.get('data'),
    hora: data.get('hora'),
    afetados: data.get('afetados') ? Number(data.get('afetados')) : null,
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
  event.preventDefault();
  const term = document.getElementById('search-term').value.trim();

  if (!supabaseClient) {
    resultCount.textContent = 'Configure o Supabase para usar a busca.';
    resultsList.innerHTML = '';
    return;
  }

  let query = supabaseClient.from('incidentes').select('*').order('criado_em', { ascending: false });

  if (term) {
    query = query.ilike('palavras_chave', `%${term}%`);
  }

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
      <h4>${item.id_incidente || 'Sem ID'} — ${item.sistema || 'Sistema'}</h4>
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

loginForm.addEventListener('submit', handleLogin);
incidentForm.addEventListener('submit', handleIncidentSubmit);
searchForm.addEventListener('submit', handleSearch);
supabaseForm.addEventListener('submit', (event) => {
  event.preventDefault();
  initSupabase();
});

updateTheme();

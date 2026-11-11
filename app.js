'use strict';
/* =====================================================================
   APP AÇÕES SOCIAIS — área do voluntário + núcleo do app
   ===================================================================== */
const CFG = window.APP_CONFIG || {};
const NAO_CONFIGURADO = !CFG.SUPABASE_URL || CFG.SUPABASE_URL.includes('SEU-PROJETO') ||
  !CFG.SUPABASE_ANON_KEY || CFG.SUPABASE_ANON_KEY.includes('COLE-AQUI');
const sb = NAO_CONFIGURADO ? null : window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
});
const S = { session: null, profile: null, config: null, unread: 0, channel: null, recovery: false, lastUid: undefined, started: false, tabAcoes: 'andamento' };
const A = window.A = {};

/* ---------------------------- UTILITÁRIOS ---------------------------- */
const $ = (s, el = document) => el.querySelector(s);
const h = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = v => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
A.money = money;
const parseD = v => new Date(typeof v === 'string' && v.length === 10 ? v + 'T12:00:00' : v);
const dt = v => v ? parseD(v).toLocaleDateString('pt-BR') : '—';
const dth = v => v ? new Date(v).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
const hora = v => v ? new Date(v).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '';
const onlyDigits = s => String(s || '').replace(/\D/g, '');
const isAdmin = () => S.profile?.role === 'admin' && S.profile?.ativo;
const isStaff = () => ['admin', 'responsavel'].includes(S.profile?.role) && S.profile?.ativo;
const baseUrl = () => location.origin + location.pathname;
const app = () => document.getElementById('app');
const nowISO = () => new Date().toISOString();

window.fmtTel = function (v) {
  const d = onlyDigits(v).slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
};
const waLink = (tel, msg = '') => {
  let d = onlyDigits(tel); if (!d) return '#';
  if (d.length <= 11) d = '55' + d;
  return `https://wa.me/${d}${msg ? '?text=' + encodeURIComponent(msg) : ''}`;
};
const fotoUrl = p => p ? sb.storage.from('fotos').getPublicUrl(p).data.publicUrl : '';
const bgStyle = p => p ? `style="background-image:url('${h(fotoUrl(p))}')"` : '';
function toLocalInput(v) { if (!v) return ''; const d = new Date(v); return new Date(d - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); }
const fromLocalInput = v => v ? new Date(v).toISOString() : null;
const fd = form => { const o = {}; new FormData(form).forEach((v, k) => { o[k] = typeof v === 'string' ? v.trim() : v; }); return o; };
const linhas = t => String(t || '').split('\n').map(s => s.trim()).filter(Boolean);
const primeiroNome = n => String(n || '').trim().split(/\s+/)[0] || '';

function toast(msg, err = false) {
  const el = document.createElement('div');
  el.className = 'toast' + (err ? ' err' : '');
  el.textContent = msg;
  $('#toast').appendChild(el);
  setTimeout(() => el.remove(), err ? 5500 : 3000);
}
const ERROS = [
  ['Invalid login credentials', 'E-mail ou senha incorretos.'],
  ['User already registered', 'Este e-mail já está cadastrado. Faça login ou recupere a senha.'],
  ['Email not confirmed', 'Confirme seu e-mail antes de entrar (veja a caixa de entrada e o spam).'],
  ['Password should be at least', 'A senha precisa ter pelo menos 6 caracteres.'],
  ['rate limit', 'Muitas tentativas seguidas. Aguarde alguns minutos e tente de novo.'],
  ['Failed to fetch', 'Sem conexão com a internet. Tente novamente.'],
  ['should be different', 'A nova senha precisa ser diferente da anterior.'],
  ['duplicate key', 'Esse registro já existe.'],
  ['row-level security', 'Você não tem permissão para isso.'],
  ['Unable to validate email', 'E-mail inválido.'],
  ['mime type', 'Tipo de arquivo não permitido. Envie foto (JPG/PNG) ou PDF.'],
  ['exceeded the maximum', 'Arquivo muito grande.'],
];
function erroMsg(e) {
  const m = e?.message || String(e);
  const f = ERROS.find(([k]) => m.toLowerCase().includes(k.toLowerCase()));
  return f ? f[1] : m;
}
async function q(promise, okMsg) {
  const res = await promise;
  if (res.error) { res.error.__shown = true; toast(erroMsg(res.error), true); throw res.error; }
  if (okMsg) toast(okMsg);
  return res.data;
}
async function fetchAll(build) {
  let all = [], from = 0; const size = 1000;
  for (;;) {
    const data = await q(build().range(from, from + size - 1));
    all = all.concat(data || []);
    if (!data || data.length < size) break;
    from += size;
  }
  return all;
}
function busy(btn, on) {
  if (!btn || btn.tagName === 'FORM' || btn.tagName === 'INPUT' || btn.tagName === 'SELECT') return;
  if (on) { btn.dataset.t = btn.innerHTML; btn.disabled = true; btn.innerHTML = 'Aguarde…'; }
  else { btn.disabled = false; if (btn.dataset.t) btn.innerHTML = btn.dataset.t; }
}
/* envolve uma ação de botão/form: trava o botão e mostra erros */
const act = fn => async function (...args) {
  const ev = args[0];
  let btn = null;
  if (ev && typeof ev.preventDefault === 'function') {
    if (ev.type === 'submit') ev.preventDefault();
    btn = ev.submitter || ev.currentTarget;
  }
  busy(btn, true);
  try { await fn.apply(this, args); }
  catch (err) { console.error(err); if (!err?.__shown) toast(erroMsg(err), true); }
  finally { busy(btn, false); }
};
window.act = act;

function modal(title, body, wide = false) {
  $('#modal').innerHTML = `<div class="modal-bg" onclick="if(event.target===this)A.closeModal()">
    <div class="modal${wide ? ' wide' : ''}"><div class="modal-head"><h3>${h(title)}</h3>
    <button class="icon-btn" onclick="A.closeModal()">✕</button></div>
    <div class="modal-body">${body}<div class="sp"></div></div></div></div>`;
}
A.closeModal = () => { $('#modal').innerHTML = ''; };

function baixar(nome, conteudo, tipo = 'application/json') {
  const blob = conteudo instanceof Blob ? conteudo : new Blob([conteudo], { type: tipo });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = nome;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
async function copiar(txt) {
  try { await navigator.clipboard.writeText(txt); }
  catch { const t = document.createElement('textarea'); t.value = txt; document.body.appendChild(t); t.select(); document.execCommand('copy'); t.remove(); }
  toast('Copiado!');
}
A.copiarEl = sel => copiar($(sel).textContent.trim());

/* Exportações (Excel / PDF) */
function exportXLSX(nomeArq, abas) {
  const wb = XLSX.utils.book_new();
  Object.entries(abas).forEach(([nome, rows]) => {
    const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ Info: 'Sem registros' }]);
    XLSX.utils.book_append_sheet(wb, ws, nome.slice(0, 31));
  });
  XLSX.writeFile(wb, nomeArq + '.xlsx');
}
function exportPDF(titulo, rows, nomeArq) {
  const { jsPDF } = window.jspdf;
  const cols = rows.length ? Object.keys(rows[0]) : ['Info'];
  const doc = new jsPDF({ orientation: cols.length > 6 ? 'landscape' : 'portrait' });
  doc.setFontSize(14); doc.text(titulo, 14, 15);
  doc.setFontSize(9); doc.text(`${S.config?.nome_grupo || ''} — gerado em ${new Date().toLocaleString('pt-BR')}`, 14, 21);
  doc.autoTable({ head: [cols], body: rows.length ? rows.map(r => cols.map(c => String(r[c] ?? ''))) : [['Sem registros']], startY: 26, styles: { fontSize: 8 }, headStyles: { fillColor: [255, 79, 154] } });
  doc.save(nomeArq + '.pdf');
}
window.exportXLSX = exportXLSX; window.exportPDF = exportPDF;

/* Compressão de imagem antes do envio */
async function comprimirImagem(file, max = 1600, qual = 0.8) {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return file;
  const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = URL.createObjectURL(file); });
  const esc = Math.min(1, max / Math.max(img.width, img.height));
  const c = document.createElement('canvas'); c.width = Math.round(img.width * esc); c.height = Math.round(img.height * esc);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', qual));
  URL.revokeObjectURL(img.src);
  return blob ? new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' }) : file;
}
window.comprimirImagem = comprimirImagem;

/* ------------------------------ PIX (BR Code) ------------------------------ */
function pixF(id, val) { const v = String(val); return id + String(v.length).padStart(2, '0') + v; }
function crc16(str) {
  let crc = 0xFFFF;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) { crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) : (crc << 1); crc &= 0xFFFF; }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}
const semAcento = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9 ]/g, '').toUpperCase().trim();
function normalizarChave(tipo, chave) {
  chave = String(chave || '').trim();
  if (tipo === 'cpf' || tipo === 'cnpj') return onlyDigits(chave);
  if (tipo === 'telefone') { const d = onlyDigits(chave); return '+' + (d.startsWith('55') && d.length > 11 ? d : '55' + d); }
  return chave.toLowerCase();
}
function pixPayload({ tipo, chave, nome, cidade, valor, txid }) {
  const mai = pixF('00', 'br.gov.bcb.pix') + pixF('01', normalizarChave(tipo, chave));
  const tx = (String(txid || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 25)) || '***';
  let p = pixF('00', '01') + pixF('26', mai) + pixF('52', '0000') + pixF('53', '986') +
    (Number(valor) > 0 ? pixF('54', Number(valor).toFixed(2)) : '') + pixF('58', 'BR') +
    pixF('59', semAcento(nome).slice(0, 25) || 'RECEBEDOR') + pixF('60', semAcento(cidade).slice(0, 15) || 'SAO PAULO') +
    pixF('62', pixF('05', tx)) + '6304';
  return p + crc16(p);
}
window.pixPayload = pixPayload;

/* ------------------------------ RÓTULOS ------------------------------ */
const PED = { pendente: ['Aguardando pagamento', 'b-warn'], em_analise: ['Comprovante em análise', 'b-info'], aprovado: ['Pago', 'b-ok'], recusado: ['Recusado', 'b-err'] };
const AFI = { disponivel: ['Disponível', 'b-ok'], reservado: ['Reservado', 'b-warn'], apadrinhado: ['Apadrinhado', 'b-pink'], recebido: ['Presente recebido', 'b-info'], entregue: ['Entregue', 'b-gray'] };
const ACAO = { futura: ['Próxima', 'b-info'], andamento: ['Em andamento', 'b-pink'], realizada: ['Realizada', 'b-ok'] };
const ROLE = { admin: ['Administrador', 'b-pink'], responsavel: ['Responsável', 'b-info'], voluntario: ['Voluntário', 'b-gray'] };
const INSC = { confirmado: ['Confirmado', 'b-info'], presente: ['Presente', 'b-ok'], faltou: ['Faltou', 'b-err'] };
const DOA = { prometido: ['Prometido', 'b-warn'], recebido: ['Recebido', 'b-ok'] };
const CAMPOS = { idade: 'Idade', tamanho_roupa: 'Roupa', tamanho_calcado: 'Calçado', observacoes: 'Observações' };
const badge = (map, k) => { const [t, c] = map[k] || [k, 'b-gray']; return `<span class="badge ${c}">${h(t)}</span>`; };
Object.assign(window, { $, h, q, sb, S, money, dt, dth, hora, fd, toast, modal, baixar, copiar, isAdmin, isStaff, badge, PED, AFI, ACAO, ROLE, INSC, DOA, CAMPOS, waLink, fotoUrl, bgStyle, toLocalInput, fromLocalInput, linhas, fetchAll, nowISO, onlyDigits, baseUrl });

function afiDados(x, a) {
  const partes = [];
  (a?.campos_afilhado || []).forEach(c => {
    const v = x[c]; if (v !== null && v !== undefined && v !== '') partes.push(`<span class="muted">${h(CAMPOS[c] || c)}:</span> ${h(c === 'idade' ? v + ' anos' : v)}`);
  });
  (a?.campos_extras || []).forEach(c => { const v = x.extras?.[c]; if (v) partes.push(`<span class="muted">${h(c)}:</span> ${h(v)}`); });
  return partes.join(' · ');
}
window.afiDados = afiDados;

/* ------------------------------ NÚCLEO ------------------------------ */
async function loadConfig() {
  const { data } = await sb.from('config').select('*').eq('id', 1).maybeSingle();
  S.config = data || { nome_grupo: 'Ações Sociais', tamanhos: ['P', 'M', 'G'], valor_camiseta: 35, loja_aberta: false };
  document.title = S.config.nome_grupo;
}
async function loadProfile() {
  const { data } = await sb.from('profiles').select('*').eq('id', S.session.user.id).maybeSingle();
  S.profile = data;
}
window.loadConfig = loadConfig; window.loadProfile = loadProfile;

async function refreshUnread() {
  if (!S.profile) return;
  const { count } = await sb.from('notificacoes').select('id', { count: 'exact', head: true }).eq('user_id', S.profile.id).eq('lida', false);
  S.unread = count || 0;
  const bell = $('#bell');
  if (bell) bell.innerHTML = '🔔' + (S.unread ? `<span class="dot">${S.unread > 99 ? '99+' : S.unread}</span>` : '');
}

function shell(active) {
  const nav = [['inicio', '🏠', 'Início'], ['camisetas', '👕', 'Camisetas'], ['acoes', '🩷', 'Ações'], ['meus', '🎁', 'Minhas'], ['perfil', '👤', 'Perfil']];
  app().innerHTML = `<div class="top"><div class="brand">${h(S.config?.nome_grupo || 'Ações Sociais')}</div>
    ${isStaff() ? `<a class="icon-btn" href="#/admin" title="Painel administrativo">⚙️</a>` : ''}
    <a class="icon-btn" id="bell" href="#/notificacoes">🔔</a></div>
    <div class="wrap" id="main"></div>
    <nav class="nav">${nav.map(([r, i, t]) => `<a href="#/${r}" class="${active === r ? 'on' : ''}"><span>${i}</span>${t}</a>`).join('')}</nav>`;
}
function main(html) { const m = $('#main'); if (m) m.innerHTML = html; }
window.main = main;
const loadingHTML = '<div class="loading"><div class="spin"></div>Carregando…</div>';

async function router() {
  if (S.channel) { sb.removeChannel(S.channel); S.channel = null; }
  A.closeModal();
  let parts = (location.hash.replace(/^#\/?/, '') || 'inicio').split('/');
  if (/access_token|error|type=/.test(parts[0])) parts = ['inicio'];
  const [r, id, sub] = parts;
  if (S.recovery) return viewNovaSenha();
  if (r === 'publico') return viewPublico(id, sub);
  if (!S.session) return viewAuth(r === 'cadastro' ? 'cadastro' : r === 'recuperar' ? 'recuperar' : 'login');
  if (!S.profile || S.profile.id !== S.session.user.id) await loadProfile();
  if (!S.profile) return viewMensagem('Não encontramos seu perfil', 'Saia e entre novamente. Se o problema continuar, fale com a organização.', true);
  if (!S.profile.ativo) return viewMensagem('Acesso suspenso', 'Seu acesso foi desativado pela organização. Fale com um administrador.', true);
  const routes = {
    inicio: viewInicio, camisetas: viewCamisetas, acoes: viewAcoes, acao: viewAcao, meus: viewMeus,
    perfil: viewPerfil, notificacoes: viewNotificacoes, transparencia: () => viewTransparencia(false),
    admin: (a, b) => window.Admin.route(a, b)
  };
  const fn = routes[r] || viewInicio;
  const ativo = { acao: 'acoes' }[r] || r;
  shell(ativo); main(loadingHTML); refreshUnread();
  window.scrollTo(0, 0);
  try { await fn(id, sub); }
  catch (e) { console.error(e); main(`<div class="empty">Não foi possível carregar.<br><small>${h(erroMsg(e))}</small><div class="sp"></div><button class="btn sec" onclick="A.reload()">Tentar de novo</button></div>`); }
}
A.reload = () => router();
window.router = router;

function viewMensagem(titulo, texto, comSair) {
  app().innerHTML = `<div class="auth"><div class="box center"><div class="logo">🩷</div><h2>${h(titulo)}</h2>
  <p class="muted">${h(texto)}</p>${comSair ? '<button class="btn sec" onclick="A.sair()">Sair</button>' : ''}</div></div>`;
}

function viewSetup() {
  app().innerHTML = `<div class="auth"><div class="box"><div class="logo">⚙️</div><h2 class="center">Falta configurar</h2>
  <div class="card"><p>Abra o arquivo <b>config.js</b> e preencha <b>SUPABASE_URL</b> e <b>SUPABASE_ANON_KEY</b> com os dados do seu projeto Supabase
  (Project Settings → API). Veja o passo a passo no <b>LEIA-ME</b>.</p></div></div></div>`;
}

/* ------------------------------ AUTENTICAÇÃO ------------------------------ */
function viewAuth(modo) {
  const g = h(S.config?.nome_grupo || 'Ações Sociais');
  let sub = '', form = '';
  if (modo === 'login') {
    sub = 'Entre para participar das nossas ações';
    form = `<form onsubmit="A.login(event)">
      <label>E-mail</label><input name="email" type="email" autocomplete="email" required>
      <label>Senha</label><input name="senha" type="password" autocomplete="current-password" required>
      <div class="sp"></div><button class="btn block">Entrar</button></form>
      <div class="sp"></div><div class="row between"><a href="#/cadastro">Criar minha conta</a><a href="#/recuperar">Esqueci a senha</a></div>`;
  } else if (modo === 'cadastro') {
    sub = 'Crie sua conta de voluntário(a)';
    form = `<form onsubmit="A.cadastrar(event)">
      <label>Nome completo</label><input name="nome" autocomplete="name" required>
      <label>Telefone (WhatsApp)</label><input name="telefone" inputmode="tel" placeholder="(11) 99999-9999" oninput="this.value=fmtTel(this.value)" required>
      <label>E-mail</label><input name="email" type="email" autocomplete="email" required>
      <label>Senha (mín. 6 caracteres)</label><input name="senha" type="password" autocomplete="new-password" minlength="6" required>
      <label>Repita a senha</label><input name="senha2" type="password" autocomplete="new-password" minlength="6" required>
      <label class="check"><input type="checkbox" name="aceite" required> Li e concordo com a <a href="javascript:A.politica()">política de privacidade</a> e autorizo o uso dos meus dados para a organização das ações.</label>
      <div class="sp"></div><button class="btn block">Criar conta</button></form>
      <div class="sp"></div><p class="center"><a href="#/login">Já tenho conta</a></p>`;
  } else {
    sub = 'Recuperar acesso';
    form = `<form onsubmit="A.recuperar(event)">
      <p class="muted">Informe o e-mail cadastrado. Enviaremos um link para você criar uma nova senha.</p>
      <label>E-mail</label><input name="email" type="email" required>
      <div class="sp"></div><button class="btn block">Enviar link</button></form>
      <div class="sp"></div><p class="center"><a href="#/login">Voltar ao login</a></p>`;
  }
  app().innerHTML = `<div class="auth"><div class="box"><div class="logo">🩷</div><h1 class="center">${g}</h1>
    <p class="center muted">${sub}</p><div class="card" id="authcard">${form}</div>
    <p class="center small"><a href="#/publico/transparencia">Conheça os resultados das nossas ações</a></p></div></div>`;
}

A.login = act(async e => {
  const f = fd(e.target);
  await q(sb.auth.signInWithPassword({ email: f.email.toLowerCase(), password: f.senha }));
});

A.cadastrar = act(async e => {
  const f = fd(e.target);
  if (f.nome.split(/\s+/).length < 2) return toast('Informe seu nome completo.', true);
  if (onlyDigits(f.telefone).length < 10) return toast('Telefone inválido. Use DDD + número.', true);
  if (f.senha !== f.senha2) return toast('As senhas não conferem.', true);
  const data = await q(sb.auth.signUp({
    email: f.email.toLowerCase(), password: f.senha,
    options: { data: { nome: f.nome, telefone: f.telefone, aceite_lgpd: 'true' }, emailRedirectTo: baseUrl() }
  }));
  if (!data.session) {
    $('#authcard').innerHTML = `<div class="center"><div class="logo">📧</div><h3>Confirme seu e-mail</h3>
      <p class="muted">Enviamos um link para <b>${h(f.email)}</b>. Abra o e-mail (veja também o spam) e clique no link para ativar sua conta.</p>
      <a class="btn sec" href="#/login">Ir para o login</a></div>`;
  }
});

A.recuperar = act(async e => {
  const f = fd(e.target);
  await q(sb.auth.resetPasswordForEmail(f.email.toLowerCase(), { redirectTo: baseUrl() }));
  $('#authcard').innerHTML = `<div class="center"><div class="logo">📧</div><h3>Verifique seu e-mail</h3>
    <p class="muted">Se o e-mail estiver cadastrado, você receberá um link para criar uma nova senha.</p>
    <a class="btn sec" href="#/login">Voltar</a></div>`;
});

function viewNovaSenha() {
  app().innerHTML = `<div class="auth"><div class="box"><div class="logo">🔐</div><h2 class="center">Criar nova senha</h2>
  <div class="card"><form onsubmit="A.salvarNovaSenha(event)">
    <label>Nova senha</label><input name="senha" type="password" minlength="6" autocomplete="new-password" required>
    <label>Repita a nova senha</label><input name="senha2" type="password" minlength="6" autocomplete="new-password" required>
    <div class="sp"></div><button class="btn block">Salvar nova senha</button></form></div></div></div>`;
}
A.salvarNovaSenha = act(async e => {
  const f = fd(e.target);
  if (f.senha !== f.senha2) return toast('As senhas não conferem.', true);
  await q(sb.auth.updateUser({ password: f.senha }), 'Senha alterada com sucesso!');
  S.recovery = false;
  history.replaceState(null, '', baseUrl() + '#/inicio');
  router();
});

A.sair = async () => {
  await sb.auth.signOut();
  S.profile = null; S.session = null;
  location.hash = '#/login';
  router();
};

A.politica = () => modal('Política de privacidade', `
  <p><b>Quais dados coletamos:</b> nome, telefone, e-mail, pedidos de camiseta, comprovantes de pagamento, participação em ações e apadrinhamentos.</p>
  <p><b>Para que usamos:</b> exclusivamente para organizar as ações sociais, a venda das camisetas, o contato com voluntários e a entrega dos presentes.</p>
  <p><b>Quem tem acesso:</b> você vê apenas os seus dados. Somente administradores e responsáveis pelas ações acessam os dados da equipe. Comprovantes ficam em armazenamento privado.</p>
  <p><b>Crianças e pessoas vulneráveis:</b> cadastramos apenas o mínimo necessário (primeiro nome ou código, idade e tamanhos). Fotos só são publicadas com autorização dos responsáveis.</p>
  <p><b>Seus direitos (LGPD):</b> a qualquer momento você pode consultar, corrigir, baixar ou excluir seus dados pela tela <b>Perfil</b>.</p>
  <p><b>Não vendemos nem compartilhamos</b> seus dados com terceiros.</p>`);

/* ------------------------------ INÍCIO ------------------------------ */
async function viewInicio() {
  const uid = S.profile.id;
  const [acoes, pedidos, afs, notifs] = await Promise.all([
    q(sb.from('acoes').select('id,titulo,status,data_inicio,prazo,local,capa_path,visivel').eq('visivel', true).neq('status', 'realizada').order('data_inicio', { ascending: true, nullsFirst: false })),
    q(sb.from('pedidos_camiseta').select('*').eq('user_id', uid).order('created_at', { ascending: false })),
    q(sb.from('afilhados').select('id,identificacao,status,acao_id,acoes(titulo,prazo)').eq('padrinho_id', uid).in('status', ['reservado', 'apadrinhado'])),
    q(sb.from('notificacoes').select('*').eq('user_id', uid).eq('lida', false).order('created_at', { ascending: false }).limit(3)),
  ]);
  const c = S.config;
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const em7 = new Date(hoje); em7.setDate(em7.getDate() + 7);
  const prazos = acoes.filter(a => a.prazo && parseD(a.prazo) >= hoje && parseD(a.prazo) <= em7);

  let camiseta = '';
  const pend = pedidos.find(p => p.status === 'pendente' || p.status === 'recusado');
  if (pend) camiseta = `<div class="card hl"><div class="row between"><h3>👕 Sua camiseta</h3>${badge(PED, pend.status)}</div>
      <p class="muted">Pedido ${h(pend.codigo)} · ${money(pend.valor_total)}. Falta pagar e enviar o comprovante.</p>
      <button class="btn block" onclick="A.pagar(event,'${pend.id}')">Pagar com Pix</button></div>`;
  else if (pedidos.length) {
    const p = pedidos[0];
    camiseta = `<div class="card"><div class="row between"><h3>👕 Sua camiseta</h3>${badge(PED, p.status)}</div>
      <p class="muted">Pedido ${h(p.codigo)} · ${p.quantidade}× ${h(p.tamanho)} ${p.entregue ? '· <span class="badge b-ok">Entregue</span>' : ''}</p>
      <a href="#/camisetas">Ver meus pedidos</a></div>`;
  } else if (c.loja_aberta) camiseta = `<div class="card hl"><h3>👕 Garanta sua camiseta!</h3>
      <p class="muted">Camiseta oficial do grupo por <b>${money(c.valor_camiseta)}</b>. Pagamento rápido via Pix.</p>
      <a class="btn block" href="#/camisetas">Comprar agora</a></div>`;

  main(`
    <h1>Olá, ${h(primeiroNome(S.profile.nome))}! 🩷</h1><p class="muted">Que bom ter você com a gente.</p>
    ${notifs.length ? `<div class="card"><div class="row between"><h3>🔔 Novidades</h3><a href="#/notificacoes">Ver todas</a></div>
      ${notifs.map(n => `<div class="sp"></div><b>${h(n.titulo)}</b><div class="small muted">${h(n.mensagem || '')}</div>`).join('')}</div>` : ''}
    ${afs.length ? `<div class="card hl"><h3>🎁 Presentes a providenciar</h3>
      ${afs.map(x => `<div class="sp"></div><a href="#/acao/${x.acao_id}"><b>${h(x.identificacao)}</b></a> — ${h(x.acoes?.titulo || '')}
        ${x.acoes?.prazo ? `<span class="small muted">· prazo ${dt(x.acoes.prazo)}</span>` : ''} ${badge(AFI, x.status)}`).join('')}</div>` : ''}
    ${camiseta}
    ${prazos.length ? `<div class="card"><h3>⏳ Prazos próximos</h3>${prazos.map(a => `<div class="sp"></div><a href="#/acao/${a.id}"><b>${h(a.titulo)}</b></a> <span class="badge b-warn">até ${dt(a.prazo)}</span>`).join('')}</div>` : ''}
    <div class="row between"><h2>Próximas ações</h2><a href="#/acoes">Ver todas</a></div><div class="sp"></div>
    ${acoes.length ? acoes.slice(0, 4).map(acaoCard).join('') : '<div class="empty">Nenhuma ação aberta no momento.</div>'}
    <a class="btn sec block" href="#/transparencia">📊 Resultados e transparência</a>`);
}

/* ------------------------------ CAMISETAS ------------------------------ */
async function viewCamisetas() {
  const c = S.config;
  const pedidos = await q(sb.from('pedidos_camiseta').select('*').eq('user_id', S.profile.id).order('created_at', { ascending: false }));
  const form = c.loja_aberta ? `<div class="card hl"><h2>Comprar camiseta</h2>
    <p class="muted">Valor: <b>${money(c.valor_camiseta)}</b> cada · pagamento via Pix</p>
    <form onsubmit="A.comprar(event)">
      <label>Nome completo</label><input name="nome" value="${h(S.profile.nome)}" required>
      <label>Telefone (WhatsApp)</label><input name="telefone" inputmode="tel" value="${h(S.profile.telefone)}" oninput="this.value=fmtTel(this.value)" required>
      <div class="grid g2"><div><label>Tamanho</label><select name="tamanho" required><option value="">Escolha</option>
        ${(c.tamanhos || []).map(t => `<option>${h(t)}</option>`).join('')}</select></div>
      <div><label>Quantidade</label><input name="quantidade" type="number" min="1" max="10" value="1" required
        oninput="document.getElementById('tot').textContent=A.money((parseInt(this.value)||0)*${Number(c.valor_camiseta)})"></div></div>
      <p>Total: <b id="tot" style="color:var(--pink);font-size:22px">${money(c.valor_camiseta)}</b></p>
      <button class="btn block">Fazer pedido e pagar com Pix</button></form></div>`
    : `<div class="card"><h3>Vendas encerradas</h3><p class="muted">No momento as vendas de camisetas estão fechadas.</p></div>`;
  main(`<h1>👕 Camisetas</h1><div class="sp"></div>${form}
    <h2>Meus pedidos</h2><div class="sp"></div>
    ${pedidos.length ? pedidos.map(pedidoItem).join('') : '<div class="empty">Você ainda não fez nenhum pedido.</div>'}`);
}
function pedidoItem(p) {
  const podePagar = p.status === 'pendente' || p.status === 'recusado';
  return `<div class="item"><div class="row between"><span class="t">Pedido ${h(p.codigo)}</span>${badge(PED, p.status)}</div>
    <div class="muted">${p.quantidade}× tamanho <b>${h(p.tamanho)}</b> · ${money(p.valor_total)} · ${dt(p.created_at)}</div>
    ${p.entregue ? `<div class="sp"></div><span class="badge b-ok">✔ Entregue ${dt(p.entregue_em)}</span>` : ''}
    ${p.status === 'recusado' && p.motivo_recusa ? `<p class="small" style="color:var(--err)">Motivo da recusa: ${h(p.motivo_recusa)}</p>` : ''}
    ${p.status === 'em_analise' ? `<p class="small muted">Recebemos seu comprovante. A equipe vai conferir em breve.</p>` : ''}
    <div class="sp"></div><div class="row">
      ${podePagar ? `<button class="btn sm" onclick="A.pagar(event,'${p.id}')">${p.status === 'recusado' ? 'Reenviar comprovante' : 'Pagar / enviar comprovante'}</button>` : ''}
      ${p.comprovante_path ? `<button class="btn sm sec" onclick="A.verMeuComprovante(event,'${p.id}')">Ver comprovante</button>` : ''}
      ${p.status === 'pendente' && !p.comprovante_path ? `<button class="btn sm ghost" onclick="A.cancelarPedido(event,'${p.id}')">Cancelar</button>` : ''}
    </div></div>`;
}
A.comprar = act(async e => {
  const f = fd(e.target);
  const qtd = parseInt(f.quantidade);
  if (!qtd || qtd < 1) return toast('Quantidade inválida.', true);
  const p = await q(sb.from('pedidos_camiseta').insert({
    user_id: S.profile.id, nome: f.nome, telefone: f.telefone, tamanho: f.tamanho, quantidade: qtd
  }).select().single(), 'Pedido criado! Agora é só pagar.');
  await viewCamisetas();
  await A.pagar(null, p.id);
});
A.pagar = act(async (e, id) => {
  const p = await q(sb.from('pedidos_camiseta').select('*').eq('id', id).single());
  const c = S.config;
  if (!c.pix_chave) return modal('Pagamento', '<p>A chave Pix ainda não foi configurada pela organização. Tente novamente mais tarde.</p>');
  const payload = pixPayload({ tipo: c.pix_tipo, chave: c.pix_chave, nome: c.pix_nome, cidade: c.pix_cidade, valor: p.valor_total, txid: p.codigo });
  modal('Pagar com Pix', `
    <p class="center">Pedido <b>${h(p.codigo)}</b> · ${p.quantidade}× ${h(p.tamanho)}</p>
    <h1 class="center" style="color:var(--pink);font-size:44px">${money(p.valor_total)}</h1>
    <div class="qr" id="qrbox"></div>
    <p class="center small muted">Recebedor: <b>${h(c.pix_nome)}</b></p>
    <label>Pix copia e cola</label><div class="copy" id="pixcode">${h(payload)}</div><div class="sp"></div>
    <button class="btn sec block" onclick="A.copiarEl('#pixcode')">📋 Copiar código Pix</button>
    <hr><h3>Enviar comprovante</h3>
    <p class="small muted">${h(c.instrucoes_camiseta || '')}</p>
    <input type="file" id="compfile" accept="image/*,application/pdf"><div class="sp"></div>
    <button class="btn block" onclick="A.enviarComprovante(event,'${p.id}')">Enviar comprovante</button>`);
  try { new QRCode($('#qrbox'), { text: payload, width: 220, height: 220, correctLevel: QRCode.CorrectLevel.M }); }
  catch { $('#qrbox').outerHTML = '<p class="center muted">Use o código copia e cola abaixo.</p>'; }
});
A.enviarComprovante = act(async (e, id) => {
  const f0 = $('#compfile')?.files?.[0];
  if (!f0) return toast('Escolha a foto ou o PDF do comprovante.', true);
  const f = await comprimirImagem(f0);
  if (f.size > 5 * 1024 * 1024) return toast('Arquivo muito grande (máximo 5 MB).', true);
  const ext = (f.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
  const path = `${S.profile.id}/${id}-${Date.now()}.${ext}`;
  await q(sb.storage.from('comprovantes').upload(path, f, { contentType: f.type || 'application/octet-stream', upsert: false }));
  await q(sb.rpc('enviar_comprovante', { p_pedido: id, p_path: path }), 'Comprovante enviado! A equipe vai conferir.');
  A.closeModal(); viewCamisetas();
});
async function mostrarArquivo(bucket, path, titulo = 'Comprovante', extra = '') {
  const d = await q(sb.storage.from(bucket).createSignedUrl(path, 600));
  const url = d.signedUrl;
  const ehPdf = /\.pdf$/i.test(path);
  modal(titulo, `${ehPdf ? `<p>Arquivo em PDF.</p>` : `<img src="${h(url)}" style="width:100%;border-radius:12px">`}
    <div class="sp"></div><a class="btn sec block" href="${h(url)}" target="_blank" rel="noopener">Abrir em nova aba</a>${extra}`);
}
window.mostrarArquivo = mostrarArquivo;
A.verMeuComprovante = act(async (e, id) => {
  const p = await q(sb.from('pedidos_camiseta').select('comprovante_path').eq('id', id).single());
  await mostrarArquivo('comprovantes', p.comprovante_path);
});
A.cancelarPedido = act(async (e, id) => {
  if (!confirm('Cancelar este pedido?')) return;
  await q(sb.from('pedidos_camiseta').delete().eq('id', id), 'Pedido cancelado.');
  viewCamisetas();
});

/* ------------------------------ AÇÕES ------------------------------ */
function acaoCard(a) {
  const quando = a.data_inicio ? `📅 ${dt(a.data_inicio)} ${hora(a.data_inicio)}` : '';
  return `<a class="acao-card" href="#/acao/${a.id}"><div class="cover" ${bgStyle(a.capa_path)}>${a.capa_path ? '' : '🩷'}</div>
    <div class="body"><div class="row between"><b style="font-size:19px">${h(a.titulo)}</b>${badge(ACAO, a.status)}</div>
    <div class="small muted">${quando}${a.local ? ' · 📍 ' + h(a.local) : ''}</div>
    ${a.prazo && a.status !== 'realizada' ? `<div class="small" style="color:var(--warn)">Prazo: ${dt(a.prazo)}</div>` : ''}
    ${!a.visivel ? '<span class="badge b-err">Oculta — só admins veem</span>' : ''}</div></a>`;
}
window.acaoCard = acaoCard;

async function viewAcoes() {
  S._acoes = await q(sb.from('acoes').select('*').order('data_inicio', { ascending: true, nullsFirst: false }));
  renderAcoes();
}
function renderAcoes() {
  const t = S.tabAcoes;
  let lista = S._acoes.filter(a => a.status === t);
  if (t === 'realizada') lista = lista.reverse();
  const tabs = [['andamento', 'Em andamento'], ['futura', 'Próximas'], ['realizada', 'Realizadas']];
  main(`<h1>🩷 Ações sociais</h1><div class="sp"></div>
    <div class="tabs">${tabs.map(([k, l]) => `<div class="tab ${t === k ? 'on' : ''}" onclick="A.tabAcoes('${k}')">${l} (${S._acoes.filter(a => a.status === k).length})</div>`).join('')}</div>
    ${lista.length ? lista.map(acaoCard).join('') : '<div class="empty">Nenhuma ação nesta lista.</div>'}`);
}
A.tabAcoes = t => { S.tabAcoes = t; renderAcoes(); };

function acaoDetalhe(a, fotos, resumo, ctx) {
  const publico = !ctx;
  const itens = linhas(a.itens_necessarios);
  const vagasTxt = a.vagas ? `${resumo?.inscritos || 0} de ${a.vagas} vagas preenchidas` : `${resumo?.inscritos || 0} voluntário(s) confirmado(s)`;
  const lotado = a.vagas && (resumo?.inscritos || 0) >= a.vagas;
  const prazoVencido = a.prazo && parseD(a.prazo) < new Date(new Date().setHours(0, 0, 0, 0));
  let botoes = '';
  if (publico) botoes = `<a class="btn block" href="#/login">Entrar para participar</a>`;
  else if (a.status !== 'realizada') {
    if (ctx.insc) botoes = `<div class="card" style="border-color:var(--ok)"><b style="color:var(--ok)">✔ Você está inscrito(a) nesta ação</b>
        ${ctx.insc.tarefa ? `<div class="small">Sua tarefa: <b>${h(ctx.insc.tarefa)}</b></div>` : ''}
        <div class="sp"></div><button class="btn sm sec" onclick="A.cancelarParticipacao(event,'${a.id}')">Cancelar minha participação</button></div>`;
    else if (lotado) botoes = `<div class="card"><b>Vagas esgotadas</b></div>`;
    else if (prazoVencido) botoes = `<div class="card"><b>Prazo de inscrição encerrado</b></div>`;
    else botoes = `<button class="btn block" onclick="A.participar(event,'${a.id}')">🤝 Quero participar como voluntário(a)</button>`;
  }
  return `
    <div class="cover-lg" ${bgStyle(a.capa_path)}>${a.capa_path ? '' : '🩷'}</div>
    <div class="row">${badge(ACAO, a.status)}${!a.visivel ? '<span class="badge b-err">Oculta — só admins</span>' : ''}</div>
    <div class="sp"></div><h1>${h(a.titulo)}</h1>
    <div class="card">
      ${a.data_inicio ? `<div class="info-line"><span>📅</span><span>${dth(a.data_inicio)}${a.data_fim ? ' até ' + (dt(a.data_fim) === dt(a.data_inicio) ? hora(a.data_fim) : dth(a.data_fim)) : ''}</span></div>` : ''}
      ${a.local ? `<div class="info-line"><span>📍</span><span>${h(a.local)}</span></div>` : ''}
      ${a.ponto_encontro ? `<div class="info-line"><span>🚩</span><span>Encontro: ${h(a.ponto_encontro)}</span></div>` : ''}
      ${a.prazo ? `<div class="info-line"><span>⏳</span><span>Prazo para participar/doar: <b>${dt(a.prazo)}</b></span></div>` : ''}
      ${a.beneficiados ? `<div class="info-line"><span>💗</span><span>${a.beneficiados} pessoa(s) beneficiada(s)</span></div>` : ''}
      <div class="info-line"><span>🤝</span><span>${vagasTxt}</span></div>
    </div>
    ${a.descricao ? `<p class="prewrap">${h(a.descricao)}</p>` : ''}
    ${botoes}<div class="sp"></div>
    <div class="row"><button class="btn sec sm" onclick="A.compartilhar('${a.id}')">📤 Compartilhar</button>
    ${!publico && a.status !== 'realizada' ? `<button class="btn sec sm" onclick="A.doar('${a.id}')">📦 Quero doar</button>` : ''}</div>
    <div class="sp"></div>
    ${itens.length ? `<div class="card"><h3>📦 Itens necessários</h3><ul>${itens.map(i => `<li>${h(i)}</li>`).join('')}</ul></div>` : ''}
    ${a.como_participar ? `<div class="card"><h3>🙋 Como participar</h3><p class="prewrap">${h(a.como_participar)}</p></div>` : ''}
    ${a.tarefas && !publico ? `<div class="card"><h3>📋 Tarefas da equipe</h3><p class="prewrap">${h(a.tarefas)}</p></div>` : ''}
    ${a.resultado ? `<div class="card hl"><h3>🏆 Resultado</h3><p class="prewrap">${h(a.resultado)}</p></div>` : ''}
    ${ctx?.doacoes?.length ? `<div class="card"><h3>Minhas doações</h3>${ctx.doacoes.map(d => `<div>${h(d.quantidade)}× ${h(d.item)} ${badge(DOA, d.status)}</div>`).join('')}</div>` : ''}
    ${a.tem_apadrinhamento ? (publico ? `<div class="card hl"><h3>🎁 Apadrinhamento</h3><p>${resumo?.disponiveis || 0} pessoa(s) ainda aguardando padrinho/madrinha. Entre no app para apadrinhar!</p></div>` : `<div id="afi-sec">${afiSec(a, ctx.afs, resumo)}</div>`) : ''}
    ${fotos.length ? `<h3>📸 Fotos</h3><div class="sp"></div><div class="gallery">${fotos.map(f => `<img src="${h(fotoUrl(f.path))}" loading="lazy" onclick="A.verFoto('${h(fotoUrl(f.path))}')">`).join('')}</div>` : ''}`;
}

function afiSec(a, afs, resumo) {
  const uid = S.profile.id;
  const meus = afs.filter(x => x.padrinho_id === uid);
  const disp = afs.filter(x => x.status === 'disponivel');
  const total = afs.length, feitos = total - disp.length;
  const pct = total ? Math.round(feitos / total * 100) : 0;
  let lista = '';
  if (!a.apadrinhamento_aberto) lista = `<div class="empty">${feitos && !disp.length ? 'Apadrinhamento encerrado — todos foram contemplados! 🩷' : 'O apadrinhamento desta campanha não está aberto no momento.'}</div>`;
  else if (!disp.length) lista = `<div class="empty">🎉 Todas as pessoas já foram apadrinhadas! Obrigado!</div>`;
  else if (a.max_por_padrinho && meus.length >= a.max_por_padrinho) lista = `<div class="empty">Você já atingiu o limite de ${a.max_por_padrinho} apadrinhamento(s) nesta campanha. Obrigado! 🩷</div>`;
  else lista = `<h3>Escolha quem você quer apadrinhar</h3><p class="small muted">${disp.length} disponível(is)</p>
    ${disp.map(x => `<div class="item"><div class="row between"><span class="t">${h(x.identificacao)}</span>
      <button class="btn sm" onclick="A.escolher(event,'${x.id}','${a.id}')">Apadrinhar</button></div>
      <div class="small">${afiDados(x, a)}</div></div>`).join('')}`;
  return `<div class="card hl"><h2>🎁 Apadrinhamento</h2>
    <div class="row between small"><span>${feitos} de ${total} apadrinhados</span><span>${pct}%</span></div>
    <div class="progress"><div style="width:${pct}%"></div></div>
    ${a.orientacoes_apadrinhamento ? `<div class="sp"></div><p class="prewrap small">${h(a.orientacoes_apadrinhamento)}</p>` : ''}</div>
    ${meus.length ? `<div class="card" style="border-color:var(--pink)"><h3>Meus apadrinhados</h3>
      ${meus.map(x => `<div class="item"><div class="row between"><span class="t">${h(x.identificacao)}</span>${badge(AFI, x.status)}</div>
        <div class="small">${afiDados(x, a)}</div>
        ${x.presente_comprado ? '<div class="small" style="color:var(--ok)">✔ Presente comprado</div>' : ''}
        <div class="sp"></div><div class="row">
        ${x.status === 'reservado' ? `<button class="btn sm ok" onclick="A.comprei(event,'${x.id}','${a.id}')">✔ Já comprei o presente</button>` : ''}
        ${['reservado', 'apadrinhado'].includes(x.status) ? `<button class="btn sm ghost" onclick="A.desistir(event,'${x.id}','${a.id}')">Desistir</button>` : ''}
        </div></div>`).join('')}</div>` : ''}
    ${lista}`;
}

async function viewAcao(id) {
  const uid = S.profile.id;
  const a = await q(sb.from('acoes').select('*').eq('id', id).maybeSingle());
  if (!a) return main('<div class="empty">Ação não encontrada.</div>');
  const [fotos, resumo, insc, doacoes, afs] = await Promise.all([
    q(sb.from('acao_fotos').select('*').eq('acao_id', id).order('created_at')),
    q(sb.rpc('acao_resumo', { p_acao: id })),
    q(sb.from('inscricoes').select('*').eq('acao_id', id).eq('user_id', uid).maybeSingle()),
    q(sb.from('doacoes').select('*').eq('acao_id', id).eq('user_id', uid)),
    a.tem_apadrinhamento ? q(sb.from('afilhados').select('*').eq('acao_id', id).order('identificacao')) : Promise.resolve([]),
  ]);
  S._acao = a;
  main(`<a href="#/acoes" class="muted">← Voltar</a><div class="sp"></div>` + acaoDetalhe(a, fotos, resumo, { insc, doacoes, afs }) +
    (isStaff() ? `<div class="sp"></div><a class="btn sec block" href="#/admin/acao/${a.id}">⚙️ Gerenciar esta ação</a>` : ''));
  if (a.tem_apadrinhamento) {
    let tmr;
    S.channel = sb.channel('afi-' + id)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'afilhados', filter: 'acao_id=eq.' + id },
        () => { clearTimeout(tmr); tmr = setTimeout(() => A.recarregarAfi(id), 400); })
      .subscribe();
  }
}
A.recarregarAfi = async id => {
  const el = $('#afi-sec'); if (!el || !S._acao || S._acao.id !== id) return;
  const afs = await q(sb.from('afilhados').select('*').eq('acao_id', id).order('identificacao'));
  const r = await q(sb.rpc('acao_resumo', { p_acao: id }));
  el.innerHTML = afiSec(S._acao, afs, r);
};
A.escolher = act(async (e, afId, acaoId) => {
  if (!confirm('Confirmar o apadrinhamento? Você ficará responsável pelo presente dessa pessoa.')) return;
  try { await q(sb.rpc('apadrinhar', { p_afilhado: afId }), 'Apadrinhamento confirmado! Obrigado 🩷'); }
  finally { await A.recarregarAfi(acaoId); }
});
A.comprei = act(async (e, afId, acaoId) => {
  await q(sb.rpc('confirmar_compra', { p_afilhado: afId }), 'Obrigado! Registramos a compra do presente.');
  await A.recarregarAfi(acaoId);
});
A.desistir = act(async (e, afId, acaoId) => {
  if (!confirm('Tem certeza que deseja desistir? A pessoa voltará a ficar disponível para outro padrinho.')) return;
  await q(sb.rpc('desistir_apadrinhamento', { p_afilhado: afId }), 'Apadrinhamento cancelado.');
  await A.recarregarAfi(acaoId);
});
A.participar = act(async (e, id) => {
  await q(sb.rpc('inscrever_acao', { p_acao: id }), 'Inscrição confirmada! 🤝');
  viewAcao(id);
});
A.cancelarParticipacao = act(async (e, id) => {
  if (!confirm('Cancelar sua participação nesta ação?')) return;
  await q(sb.rpc('cancelar_inscricao', { p_acao: id }), 'Participação cancelada.');
  viewAcao(id);
});
A.compartilhar = async id => {
  const a = S._acao && S._acao.id === id ? S._acao : null;
  const url = baseUrl() + '#/publico/acao/' + id;
  const texto = `${a ? a.titulo + ' — ' : ''}Participe com a gente! 🩷`;
  if (navigator.share) { try { await navigator.share({ title: a?.titulo || 'Ação social', text: texto, url }); return; } catch (e) { if (e.name === 'AbortError') return; } }
  modal('Compartilhar', `<div class="copy" id="shareurl">${h(url)}</div><div class="sp"></div>
    <button class="btn sec block" onclick="A.copiarEl('#shareurl')">📋 Copiar link</button><div class="sp"></div>
    <a class="btn block" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(texto + ' ' + url)}">Enviar no WhatsApp</a>`);
};
A.verFoto = url => modal('Foto', `<img src="${h(url)}" style="width:100%;border-radius:12px">`);
A.doar = id => modal('Quero doar', `<form onsubmit="A.salvarDoacao(event,'${id}')">
  <label>O que você vai doar?</label><input name="item" placeholder="Ex.: Pacote de fraldas G" required>
  <label>Quantidade</label><input name="quantidade" type="number" min="1" step="1" value="1" required>
  <label>Observação (opcional)</label><input name="observacao" placeholder="Ex.: entrego no sábado">
  <div class="sp"></div><button class="btn block">Registrar doação</button></form>`);
A.salvarDoacao = act(async (e, id) => {
  const f = fd(e.target);
  await q(sb.from('doacoes').insert({ acao_id: id, user_id: S.profile.id, doador_nome: S.profile.nome, item: f.item, quantidade: Number(f.quantidade) || 1, observacao: f.observacao || null }),
    'Doação registrada! Obrigado 🩷');
  A.closeModal(); viewAcao(id);
});

/* ------------------------------ PÚBLICO (sem login) ------------------------------ */
async function viewPublico(tipo, id) {
  app().innerHTML = `<div class="top"><div class="brand">${h(S.config?.nome_grupo || 'Ações Sociais')}</div>
    <a class="btn sm" href="#/${S.session ? 'inicio' : 'login'}">${S.session ? 'Abrir app' : 'Entrar'}</a></div>
    <div class="wrap" id="main">${loadingHTML}</div>`;
  try {
    if (tipo === 'acao') {
      const a = await q(sb.from('acoes').select('*').eq('id', id).maybeSingle());
      if (!a) return main('<div class="empty">Ação não encontrada ou ainda não publicada.</div>');
      const [fotos, resumo] = await Promise.all([q(sb.from('acao_fotos').select('*').eq('acao_id', id)), q(sb.rpc('acao_resumo', { p_acao: id }))]);
      S._acao = a;
      main(acaoDetalhe(a, fotos, resumo, null));
    } else await viewTransparencia(true);
  } catch (e) { main(`<div class="empty">Não foi possível carregar.</div>`); }
}

/* ------------------------------ MINHAS ------------------------------ */
async function viewMeus() {
  const uid = S.profile.id;
  const [afs, insc, doa] = await Promise.all([
    q(sb.from('afilhados').select('*,acoes(id,titulo,status,prazo,campos_afilhado,campos_extras)').eq('padrinho_id', uid).order('created_at', { ascending: false })),
    q(sb.from('inscricoes').select('*,acoes(id,titulo,status,data_inicio,local)').eq('user_id', uid).order('created_at', { ascending: false })),
    q(sb.from('doacoes').select('*,acoes(id,titulo)').eq('user_id', uid).order('created_at', { ascending: false })),
  ]);
  main(`<h1>🎁 Minha participação</h1><div class="sp"></div>
    <div class="grid g3"><div class="stat"><b>${insc.length}</b><small>Ações</small></div>
    <div class="stat"><b>${afs.length}</b><small>Apadrinhados</small></div><div class="stat"><b>${doa.length}</b><small>Doações</small></div></div>
    <div class="sp"></div><h2>Apadrinhamentos</h2><div class="sp"></div>
    ${afs.length ? afs.map(x => `<div class="item"><div class="row between"><span class="t">${h(x.identificacao)}</span>${badge(AFI, x.status)}</div>
      <div class="small">${afiDados(x, x.acoes)}</div>
      <div class="small muted">Campanha: <a href="#/acao/${x.acao_id}">${h(x.acoes?.titulo || '')}</a>${x.acoes?.prazo ? ' · prazo ' + dt(x.acoes.prazo) : ''}</div></div>`).join('') : '<div class="empty">Nenhum apadrinhamento ainda.</div>'}
    <h2>Ações que participei</h2><div class="sp"></div>
    ${insc.length ? insc.map(i => `<div class="item"><div class="row between"><a class="t" href="#/acao/${i.acao_id}">${h(i.acoes?.titulo || '')}</a>${badge(INSC, i.status)}</div>
      <div class="small muted">${i.acoes?.data_inicio ? dth(i.acoes.data_inicio) : ''} ${i.acoes?.local ? '· ' + h(i.acoes.local) : ''}</div>
      ${i.tarefa ? `<div class="small">Tarefa: <b>${h(i.tarefa)}</b></div>` : ''}</div>`).join('') : '<div class="empty">Você ainda não se inscreveu em nenhuma ação.</div>'}
    <h2>Minhas doações</h2><div class="sp"></div>
    ${doa.length ? doa.map(d => `<div class="item"><div class="row between"><span>${h(d.quantidade)}× <b>${h(d.item)}</b></span>${badge(DOA, d.status)}</div>
      <div class="small muted">${h(d.acoes?.titulo || '')} · ${dt(d.created_at)}</div></div>`).join('') : '<div class="empty">Nenhuma doação registrada.</div>'}`);
}

/* ------------------------------ NOTIFICAÇÕES ------------------------------ */
async function viewNotificacoes() {
  const ns = await q(sb.from('notificacoes').select('*').eq('user_id', S.profile.id).order('created_at', { ascending: false }).limit(100));
  main(`<div class="row between"><h1>🔔 Notificações</h1>${ns.length ? `<button class="btn sm ghost" onclick="A.limparNotif(event)">Limpar lidas</button>` : ''}</div><div class="sp"></div>
    ${ns.length ? ns.map(n => `<div class="item notif ${n.lida ? 'lida' : ''}" ${n.link ? `onclick="location.hash='${h(n.link)}'" style="cursor:pointer"` : ''}>
      <b>${h(n.titulo)}</b><div class="small">${h(n.mensagem || '')}</div><div class="small muted">${dth(n.created_at)}</div></div>`).join('')
      : '<div class="empty">Nenhuma notificação.</div>'}`);
  if (ns.some(n => !n.lida)) {
    await sb.from('notificacoes').update({ lida: true }).eq('user_id', S.profile.id).eq('lida', false);
    refreshUnread();
  }
}
A.limparNotif = act(async () => {
  await q(sb.from('notificacoes').delete().eq('user_id', S.profile.id).eq('lida', true), 'Notificações lidas removidas.');
  viewNotificacoes();
});

/* ------------------------------ TRANSPARÊNCIA ------------------------------ */
async function viewTransparencia(publico) {
  const e = await q(sb.rpc('estatisticas_publicas'));
  const realizadas = (e.lista || []).filter(a => a.status === 'realizada');
  main(`<h1>📊 Transparência</h1><p class="muted">Resultados das nossas ações sociais.</p>
    <div class="grid g2"><div class="stat"><b>${e.acoes_realizadas}</b><small>Ações realizadas</small></div>
    <div class="stat"><b>${e.beneficiados}</b><small>Pessoas beneficiadas</small></div>
    <div class="stat"><b>${e.voluntarios}</b><small>Voluntários</small></div>
    <div class="stat"><b>${e.presentes}</b><small>Presentes arrecadados</small></div></div>
    <div class="sp"></div><div class="stat"><b>${Number(e.doacoes).toLocaleString('pt-BR')}</b><small>Itens doados recebidos</small></div>
    <div class="sp"></div><h2>Histórico de ações</h2><div class="sp"></div>
    ${realizadas.length ? realizadas.map(a => `<div class="item"><div class="row between"><a class="t" href="#/${publico ? 'publico/acao' : 'acao'}/${a.id}">${h(a.titulo)}</a><span class="small muted">${dt(a.data_inicio)}</span></div>
      <div class="row small"><span>💗 ${a.beneficiados} beneficiados</span><span>🤝 ${a.voluntarios} voluntários</span><span>🎁 ${a.presentes} presentes</span><span>📦 ${Number(a.doacoes)} itens</span></div>
      ${a.resultado ? `<p class="small prewrap muted">${h(a.resultado)}</p>` : ''}</div>`).join('') : '<div class="empty">Ainda não há ações concluídas.</div>'}`);
}

/* ------------------------------ PERFIL ------------------------------ */
async function viewPerfil() {
  const p = S.profile;
  main(`<h1>👤 Meu perfil</h1><div class="sp"></div>
    <div class="card"><div class="row between"><b>${h(p.email || S.session.user.email)}</b>${badge(ROLE, p.role)}</div>
    <form onsubmit="A.salvarPerfil(event)">
      <label>Nome completo</label><input name="nome" value="${h(p.nome)}" required>
      <label>Telefone (WhatsApp)</label><input name="telefone" value="${h(p.telefone)}" oninput="this.value=fmtTel(this.value)" required>
      <div class="sp"></div><button class="btn block">Salvar dados</button></form></div>
    <div class="card"><h3>Alterar senha</h3><form onsubmit="A.alterarSenha(event)">
      <label>Nova senha</label><input name="senha" type="password" minlength="6" autocomplete="new-password" required>
      <label>Repita a nova senha</label><input name="senha2" type="password" minlength="6" autocomplete="new-password" required>
      <div class="sp"></div><button class="btn sec block">Alterar senha</button></form></div>
    <div class="card"><h3>Privacidade (LGPD)</h3>
      <div class="grid"><button class="btn sec" onclick="A.politica()">Política de privacidade</button>
      <button class="btn sec" onclick="A.meusDados(event)">⬇️ Baixar meus dados</button>
      <button class="btn err" onclick="A.excluirConta(event)">Excluir minha conta</button></div></div>
    <button class="btn sec block" onclick="A.sair()">Sair do app</button>
    <p class="center small muted">Para instalar: no navegador do celular, toque em “Adicionar à tela inicial”.</p>`);
}
A.salvarPerfil = act(async e => {
  const f = fd(e.target);
  if (onlyDigits(f.telefone).length < 10) return toast('Telefone inválido.', true);
  await q(sb.from('profiles').update({ nome: f.nome, telefone: f.telefone }).eq('id', S.profile.id), 'Dados atualizados!');
  await loadProfile();
});
A.alterarSenha = act(async e => {
  const f = fd(e.target);
  if (f.senha !== f.senha2) return toast('As senhas não conferem.', true);
  await q(sb.auth.updateUser({ password: f.senha }), 'Senha alterada!');
  e.target.reset();
});
A.meusDados = act(async () => {
  const d = await q(sb.rpc('meus_dados'));
  baixar('meus-dados.json', JSON.stringify(d, null, 2));
});
A.excluirConta = act(async () => {
  if (!confirm('Excluir sua conta apaga seu acesso e seus dados pessoais. Essa ação não pode ser desfeita. Continuar?')) return;
  const t = prompt('Para confirmar, digite EXCLUIR');
  if ((t || '').trim().toUpperCase() !== 'EXCLUIR') return toast('Exclusão cancelada.');
  await q(sb.rpc('excluir_minha_conta'));
  toast('Conta excluída.');
  await sb.auth.signOut().catch(() => {});
  S.profile = null; S.session = null; location.hash = '#/login'; router();
});

/* ------------------------------ INICIALIZAÇÃO ------------------------------ */
async function init() {
  if (NAO_CONFIGURADO) return viewSetup();
  if (/type=recovery/.test(location.hash)) S.recovery = true;
  sb.auth.onAuthStateChange((event, session) => {
    S.session = session;
    if (event === 'PASSWORD_RECOVERY') { S.recovery = true; if (S.started) setTimeout(router, 0); return; }
    const uid = session?.user?.id || null;
    if (uid !== S.lastUid) {
      S.lastUid = uid; S.profile = null;
      if (S.started) setTimeout(() => {
        const h0 = location.hash || '#';
        if (uid && /^#\/?(login|cadastro|recuperar)?$/.test(h0)) location.hash = '#/inicio'; // hashchange chama o router
        else router();
      }, 0);
    }
  });
  const { data } = await sb.auth.getSession();
  S.session = data.session; S.lastUid = S.session?.user?.id || null;
  await loadConfig();
  S.started = true;
  window.addEventListener('hashchange', router);
  router();
}
init();

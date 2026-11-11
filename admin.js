'use strict';
/* =====================================================================
   APP AÇÕES SOCIAIS — PAINEL ADMINISTRATIVO
   (administradores e responsáveis pelas ações)
   ===================================================================== */
(function () {
  const Admin = window.Admin = {};
  const st = { fPed: { status: '', entrega: '', busca: '' }, peds: [], tab: 'apadrinhamento', fPres: 'todos', fUser: '', acao: null, afs: [], users: [] };

  const head = (titulo, voltar = '#/admin', extra = '') =>
    `<a href="${voltar}" class="muted">← Voltar</a><div class="sp"></div>
     <div class="row between"><h1>${titulo}</h1><div class="row">${extra}</div></div><div class="sp"></div>`;
  const soAdmin = () => { if (!isAdmin()) { main('<div class="empty">Somente administradores acessam esta área.</div>'); return false; } return true; };
  const sim = b => b ? 'Sim' : 'Não';
  const reloadAdmin = () => router();

  Admin.route = async (sec, id) => {
    if (!isStaff()) return main('<div class="empty">Acesso restrito à equipe.</div>');
    const rotas = { camisetas, acoes: acoesLista, acao: () => acaoGerenciar(id), usuarios, usuario: () => usuario(id), avisos, config: configTela, log, backup };
    const fn = rotas[sec] || painel;
    await fn();
  };

  /* =============================== PAINEL =============================== */
  async function painel() {
    const [ped, afs, acoes, doa, usersRes] = await Promise.all([
      fetchAll(() => sb.from('pedidos_camiseta').select('status,quantidade,valor_total,entregue')),
      fetchAll(() => sb.from('afilhados').select('status')),
      q(sb.from('acoes').select('id,status,visivel')),
      fetchAll(() => sb.from('doacoes').select('status,quantidade')),
      sb.from('profiles').select('id', { count: 'exact', head: true }),
    ]);
    const pagos = ped.filter(p => p.status === 'aprovado');
    const soma = (arr, k) => arr.reduce((s, x) => s + Number(x[k] || 0), 0);
    const cont = (arr, st0) => arr.filter(x => x.status === st0).length;
    const menu = [
      ['#/admin/camisetas', '👕', 'Camisetas', 'Pedidos, comprovantes, entregas'],
      ['#/admin/acoes', '🩷', 'Ações e campanhas', 'Criar, publicar, apadrinhamento, kits'],
      ['#/admin/usuarios', '🤝', 'Voluntários', 'Cadastros, contatos, histórico'],
      ['#/admin/avisos', '🔔', 'Enviar aviso', 'Notificar voluntários'],
    ];
    if (isAdmin()) menu.push(
      ['#/admin/config', '⚙️', 'Configurações', 'Pix, valor, tamanhos, nome'],
      ['#/admin/log', '📜', 'Registro de alterações', 'Quem mudou o quê'],
      ['#/admin/backup', '💾', 'Backup', 'Baixar cópia de todos os dados']);
    main(`<h1>⚙️ Painel administrativo</h1><p class="muted">${h(S.profile.nome)} · ${badge(ROLE, S.profile.role)}</p>
      ${!S.config.pix_chave && isAdmin() ? `<div class="card" style="border-color:var(--warn)"><b style="color:var(--warn)">⚠️ Configure a chave Pix</b><p class="small">Sem ela os voluntários não conseguem pagar a camiseta. <a href="#/admin/config">Configurar agora</a></p></div>` : ''}
      <h3>👕 Camisetas</h3><div class="sp"></div>
      <div class="grid g4">
        <div class="stat"><b>${money(soma(pagos, 'valor_total'))}</b><small>Arrecadado</small></div>
        <div class="stat"><b>${soma(pagos, 'quantidade')}</b><small>Camisetas pagas</small></div>
        <a class="stat" href="#/admin/camisetas" style="text-decoration:none"><b>${cont(ped, 'em_analise')}</b><small>Comprovantes p/ conferir</small></a>
        <div class="stat"><b>${cont(ped, 'pendente') + cont(ped, 'recusado')}</b><small>Pendentes</small></div>
        <div class="stat"><b>${ped.filter(p => p.entregue).length}</b><small>Pedidos entregues</small></div>
        <div class="stat"><b>${ped.length}</b><small>Pedidos no total</small></div>
      </div><div class="sp"></div>
      <h3>🎁 Apadrinhamento</h3><div class="sp"></div>
      <div class="grid g4">${Object.keys(AFI).map(k => `<div class="stat"><b>${cont(afs, k)}</b><small>${AFI[k][0]}</small></div>`).join('')}</div><div class="sp"></div>
      <h3>📊 Geral</h3><div class="sp"></div>
      <div class="grid g4">
        <div class="stat"><b>${usersRes.count || 0}</b><small>Usuários</small></div>
        <div class="stat"><b>${acoes.filter(a => a.status !== 'realizada').length}</b><small>Ações ativas</small></div>
        <div class="stat"><b>${acoes.filter(a => !a.visivel).length}</b><small>Ações ocultas</small></div>
        <div class="stat"><b>${soma(doa.filter(d => d.status === 'recebido'), 'quantidade')}</b><small>Itens doados recebidos</small></div>
      </div><div class="sp"></div>
      <div class="grid g2 admin-grid">${menu.map(([l, i, t, d]) => `<a href="${l}"><span>${i}</span><b>${t}</b><small class="muted">${d}</small></a>`).join('')}</div>`);
  }

  /* =============================== CAMISETAS =============================== */
  async function camisetas() {
    st.peds = await fetchAll(() => sb.from('pedidos_camiseta').select('*').order('created_at', { ascending: false }));
    const f = st.fPed;
    main(head('👕 Camisetas', '#/admin', `<button class="btn sm" onclick="Admin.novoPedido()">+ Pedido manual</button>`) + `
      <div id="ped-resumo"></div>
      <div class="card"><div class="grid g3">
        <div><label>Pagamento</label><select onchange="Admin.filtroPed('status',this.value)">
          <option value="">Todos</option>${Object.entries(PED).map(([k, v]) => `<option value="${k}" ${f.status === k ? 'selected' : ''}>${v[0]}</option>`).join('')}</select></div>
        <div><label>Entrega</label><select onchange="Admin.filtroPed('entrega',this.value)">
          <option value="">Todas</option><option value="sim" ${f.entrega === 'sim' ? 'selected' : ''}>Entregues</option><option value="nao" ${f.entrega === 'nao' ? 'selected' : ''}>Não entregues</option></select></div>
        <div><label>Buscar</label><input placeholder="Nome, telefone ou código" value="${h(f.busca)}" oninput="Admin.filtroPed('busca',this.value)"></div>
      </div><div class="sp"></div>
      <div class="row"><button class="btn sm sec" onclick="Admin.exportPed('xlsx')">⬇️ Excel</button><button class="btn sm sec" onclick="Admin.exportPed('pdf')">⬇️ PDF</button>
      <button class="btn sm sec" onclick="Admin.exportPed('tam')">⬇️ Resumo por tamanho</button></div></div>
      <div id="ped-list"></div>`);
    renderPeds();
  }
  function pedsFiltrados() {
    const f = st.fPed, b = f.busca.toLowerCase(), bd = onlyDigits(f.busca);
    return st.peds.filter(p =>
      (!f.status || p.status === f.status) &&
      (!f.entrega || (f.entrega === 'sim' ? p.entregue : !p.entregue)) &&
      (!b || p.nome.toLowerCase().includes(b) || p.codigo.toLowerCase().includes(b) || (bd && onlyDigits(p.telefone).includes(bd))));
  }
  function resumoTamanhos() {
    const tams = [...new Set([...(S.config.tamanhos || []), ...st.peds.map(p => p.tamanho)])];
    return tams.map(t => {
      const ps = st.peds.filter(p => p.tamanho === t);
      const s = arr => arr.reduce((a, p) => a + p.quantidade, 0);
      return { Tamanho: t, 'Pedidas': s(ps), 'Pagas': s(ps.filter(p => p.status === 'aprovado')), 'Pendentes': s(ps.filter(p => p.status !== 'aprovado')), 'Entregues': s(ps.filter(p => p.entregue)) };
    }).filter(r => r.Pedidas > 0 || (S.config.tamanhos || []).includes(r.Tamanho));
  }
  function renderPeds() {
    const lista = pedsFiltrados();
    const rt = resumoTamanhos();
    const tot = k => rt.reduce((a, r) => a + r[k], 0);
    $('#ped-resumo').innerHTML = `<div class="card"><h3>Tamanhos e quantidades</h3><div class="sp"></div><div class="tbl-wrap"><table>
      <tr><th>Tamanho</th><th>Pedidas</th><th>Pagas</th><th>Pendentes</th><th>Entregues</th></tr>
      ${rt.map(r => `<tr><td><b>${h(r.Tamanho)}</b></td><td>${r.Pedidas}</td><td style="color:var(--ok)">${r.Pagas}</td><td style="color:var(--warn)">${r.Pendentes}</td><td>${r.Entregues}</td></tr>`).join('')}
      <tr><th>Total</th><th>${tot('Pedidas')}</th><th>${tot('Pagas')}</th><th>${tot('Pendentes')}</th><th>${tot('Entregues')}</th></tr></table></div></div>`;
    $('#ped-list').innerHTML = `<p class="muted small">${lista.length} pedido(s)</p>` + (lista.length ? lista.map(p => `
      <div class="item"><div class="row between"><span class="t">${h(p.nome)}</span>${badge(PED, p.status)}</div>
      <div class="small muted">Pedido ${h(p.codigo)} · ${dth(p.created_at)} ${p.user_id ? '' : '· <span class="badge b-gray">manual</span>'}</div>
      <div><b>${p.quantidade}× ${h(p.tamanho)}</b> · ${money(p.valor_total)} ${p.pago_manual ? '<span class="badge b-info">pago manual</span>' : ''}
        ${p.entregue ? `<span class="badge b-ok">entregue ${dt(p.entregue_em)}</span>` : '<span class="badge b-gray">não entregue</span>'}</div>
      ${p.telefone ? `<div class="small"><a href="${waLink(p.telefone, `Olá ${p.nome.split(' ')[0]}! Sobre seu pedido de camiseta ${p.codigo}...`)}" target="_blank" rel="noopener">📱 ${h(p.telefone)}</a></div>` : ''}
      ${p.motivo_recusa ? `<div class="small" style="color:var(--err)">Recusa: ${h(p.motivo_recusa)}</div>` : ''}
      ${p.observacao ? `<div class="small muted">Obs.: ${h(p.observacao)}</div>` : ''}
      <div class="sp"></div><div class="row">
        ${p.comprovante_path ? `<button class="btn sm sec" onclick="Admin.verComp(event,'${p.id}')">🧾 Comprovante</button>` : ''}
        ${p.status === 'em_analise' ? `<button class="btn sm ok" onclick="Admin.aprovar(event,'${p.id}')">Aprovar</button><button class="btn sm err" onclick="Admin.recusar(event,'${p.id}')">Recusar</button>` : ''}
        ${p.status !== 'aprovado' ? `<button class="btn sm sec" onclick="Admin.pagoManual(event,'${p.id}')">Marcar pago</button>` : `<button class="btn sm ghost" onclick="Admin.desfazerPag(event,'${p.id}')">Desfazer pagamento</button>`}
        <button class="btn sm ${p.entregue ? 'ghost' : 'sec'}" onclick="Admin.entregar(event,'${p.id}',${!p.entregue})">${p.entregue ? 'Desfazer entrega' : '📦 Marcar entregue'}</button>
        <button class="btn sm ghost" onclick="Admin.editarPedido('${p.id}')">Editar</button>
        ${isAdmin() ? `<button class="btn sm ghost" onclick="Admin.excluirPedido(event,'${p.id}')">Excluir</button>` : ''}
      </div></div>`).join('') : '<div class="empty">Nenhum pedido encontrado.</div>');
  }
  Admin.filtroPed = (k, v) => { st.fPed[k] = v; renderPeds(); };
  async function attPed(id, patch, msg) {
    await q(sb.from('pedidos_camiseta').update(patch).eq('id', id), msg);
    const novo = await q(sb.from('pedidos_camiseta').select('*').eq('id', id).single());
    st.peds = st.peds.map(p => p.id === id ? novo : p);
    A.closeModal();
    renderPeds();
  }
  Admin.verComp = act(async (e, id) => {
    const p = st.peds.find(x => x.id === id);
    await mostrarArquivo('comprovantes', p.comprovante_path, `Comprovante · ${p.nome}`,
      `<p class="center">${p.quantidade}× ${h(p.tamanho)} · <b>${money(p.valor_total)}</b> · enviado ${dth(p.enviado_em)}</p>
       ${p.status !== 'aprovado' ? `<div class="grid g2"><button class="btn ok" onclick="Admin.aprovar(event,'${p.id}')">Aprovar</button>
       <button class="btn err" onclick="Admin.recusar(event,'${p.id}')">Recusar</button></div>` : ''}`);
  });
  Admin.aprovar = act(async (e, id) => attPed(id, { status: 'aprovado', aprovado_por: S.profile.id, aprovado_em: nowISO(), motivo_recusa: null }, 'Pagamento aprovado!'));
  Admin.recusar = act(async (e, id) => {
    const m = prompt('Motivo da recusa (o voluntário verá esta mensagem):', 'Comprovante ilegível ou valor diferente');
    if (m === null) return;
    await attPed(id, { status: 'recusado', motivo_recusa: m || 'não informado' }, 'Comprovante recusado.');
  });
  Admin.pagoManual = act(async (e, id) => {
    if (!confirm('Marcar este pedido como PAGO manualmente (ex.: pagou em dinheiro)?')) return;
    await attPed(id, { status: 'aprovado', pago_manual: true, aprovado_por: S.profile.id, aprovado_em: nowISO(), motivo_recusa: null }, 'Pedido marcado como pago.');
  });
  Admin.desfazerPag = act(async (e, id) => {
    if (!confirm('Voltar este pedido para "aguardando pagamento"?')) return;
    const p = st.peds.find(x => x.id === id);
    await attPed(id, { status: p.comprovante_path ? 'em_analise' : 'pendente', pago_manual: false, aprovado_em: null, aprovado_por: null }, 'Pagamento desfeito.');
  });
  Admin.entregar = act(async (e, id, v) => attPed(id, { entregue: v, entregue_em: v ? nowISO() : null }, v ? 'Entrega registrada!' : 'Entrega desfeita.'));
  Admin.excluirPedido = act(async (e, id) => {
    if (!confirm('Excluir este pedido definitivamente?')) return;
    await q(sb.from('pedidos_camiseta').delete().eq('id', id), 'Pedido excluído.');
    st.peds = st.peds.filter(p => p.id !== id); renderPeds();
  });
  const formPedido = p => `
    <label>Nome completo</label><input name="nome" value="${h(p?.nome)}" required>
    <label>Telefone</label><input name="telefone" value="${h(p?.telefone)}" oninput="this.value=fmtTel(this.value)">
    <div class="grid g2"><div><label>Tamanho</label><select name="tamanho" required>
      ${[...new Set([...(S.config.tamanhos || []), ...(p ? [p.tamanho] : [])])].map(t => `<option ${p?.tamanho === t ? 'selected' : ''}>${h(t)}</option>`).join('')}</select></div>
    <div><label>Quantidade</label><input name="quantidade" type="number" min="1" max="20" value="${p?.quantidade || 1}" required></div></div>
    <label>Observação</label><input name="observacao" value="${h(p?.observacao)}">`;
  Admin.novoPedido = () => modal('Novo pedido manual', `<form onsubmit="Admin.salvarNovoPedido(event)">${formPedido(null)}
    <label class="check"><input type="checkbox" name="pago" checked> Já está pago (dinheiro/Pix conferido)</label>
    <div class="sp"></div><button class="btn block">Salvar pedido</button></form>`);
  Admin.salvarNovoPedido = act(async e => {
    const f = fd(e.target);
    const pago = !!f.pago;
    const novo = await q(sb.from('pedidos_camiseta').insert({
      user_id: null, nome: f.nome, telefone: f.telefone || '', tamanho: f.tamanho, quantidade: parseInt(f.quantidade) || 1,
      observacao: f.observacao || null, status: pago ? 'aprovado' : 'pendente', pago_manual: pago,
      aprovado_por: pago ? S.profile.id : null, aprovado_em: pago ? nowISO() : null
    }).select().single(), 'Pedido criado!');
    st.peds.unshift(novo); A.closeModal(); renderPeds();
  });
  Admin.editarPedido = id => {
    const p = st.peds.find(x => x.id === id);
    modal('Editar pedido ' + p.codigo, `<form onsubmit="Admin.salvarPedido(event,'${id}')">${formPedido(p)}
      <div class="sp"></div><button class="btn block">Salvar</button></form>`);
  };
  Admin.salvarPedido = act(async (e, id) => {
    const f = fd(e.target);
    await attPed(id, { nome: f.nome, telefone: f.telefone || '', tamanho: f.tamanho, quantidade: parseInt(f.quantidade) || 1, observacao: f.observacao || null }, 'Pedido atualizado!');
  });
  Admin.exportPed = tipo => {
    if (tipo === 'tam') return exportXLSX('camisetas-por-tamanho', { Tamanhos: resumoTamanhos() });
    const rows = pedsFiltrados().map(p => ({
      'Código': p.codigo, 'Nome': p.nome, 'Telefone': p.telefone, 'Tamanho': p.tamanho, 'Qtd': p.quantidade,
      'Valor': Number(p.valor_total).toFixed(2).replace('.', ','), 'Pagamento': PED[p.status][0], 'Pago manual': sim(p.pago_manual),
      'Entregue': sim(p.entregue), 'Data pedido': dt(p.created_at)
    }));
    if (tipo === 'xlsx') exportXLSX('pedidos-camisetas', { Pedidos: rows, Tamanhos: resumoTamanhos() });
    else exportPDF('Pedidos de camisetas', rows, 'pedidos-camisetas');
  };

  /* =============================== AÇÕES =============================== */
  async function acoesLista() {
    const acoes = await q(sb.from('acoes').select('*').order('created_at', { ascending: false }));
    main(head('🩷 Ações e campanhas', '#/admin', `<button class="btn sm" onclick="Admin.formAcao()">+ Nova ação</button>`) +
      (acoes.length ? acoes.map(a => `<div class="item"><div class="row between"><span class="t">${h(a.titulo)}</span>
        <div class="row">${badge(ACAO, a.status)}${a.visivel ? '<span class="badge b-ok">Publicada</span>' : '<span class="badge b-err">Oculta</span>'}</div></div>
        <div class="small muted">${a.data_inicio ? dth(a.data_inicio) : 'Sem data'}${a.local ? ' · ' + h(a.local) : ''}${a.tem_apadrinhamento ? ' · 🎁 apadrinhamento ' + (a.apadrinhamento_aberto ? 'aberto' : 'fechado') : ''}</div>
        <div class="sp"></div><a class="btn sm" href="#/admin/acao/${a.id}">Gerenciar</a></div>`).join('')
        : '<div class="empty">Nenhuma ação cadastrada. Clique em “+ Nova ação”.</div>'));
  }

  Admin.formAcao = async (id) => {
    let a = {};
    if (id) a = await q(sb.from('acoes').select('*').eq('id', id).single());
    modal(id ? 'Editar ação' : 'Nova ação', `<form onsubmit="Admin.salvarAcao(event,'${id || ''}')">
      <label>Nome da ação *</label><input name="titulo" value="${h(a.titulo)}" required>
      <label>Descrição</label><textarea name="descricao">${h(a.descricao)}</textarea>
      <div class="grid g2">
        <div><label>Situação</label><select name="status">${Object.entries(ACAO).map(([k, v]) => `<option value="${k}" ${(a.status || 'futura') === k ? 'selected' : ''}>${v[0]}</option>`).join('')}</select></div>
        <div><label>Vagas p/ voluntários</label><input name="vagas" type="number" min="1" value="${a.vagas ?? ''}" placeholder="Sem limite"></div>
        <div><label>Início (data e hora)</label><input name="data_inicio" type="datetime-local" value="${toLocalInput(a.data_inicio)}"></div>
        <div><label>Término</label><input name="data_fim" type="datetime-local" value="${toLocalInput(a.data_fim)}"></div>
        <div><label>Prazo p/ participar/doar</label><input name="prazo" type="date" value="${h(a.prazo || '')}"></div>
        <div><label>Pessoas beneficiadas</label><input name="beneficiados" type="number" min="0" value="${a.beneficiados ?? 0}"></div>
      </div>
      <label>Local</label><input name="local" value="${h(a.local)}">
      <label>Ponto de encontro dos voluntários</label><input name="ponto_encontro" value="${h(a.ponto_encontro)}">
      <label>Itens necessários (um por linha)</label><textarea name="itens_necessarios" placeholder="Leite em pó&#10;Fraldas G&#10;Brinquedos novos">${h(a.itens_necessarios)}</textarea>
      <label>Como participar</label><textarea name="como_participar">${h(a.como_participar)}</textarea>
      <label>Tarefas da equipe (visível para logados)</label><textarea name="tarefas">${h(a.tarefas)}</textarea>
      <label>Resultado da campanha (transparência)</label><textarea name="resultado" placeholder="Ex.: Entregamos 120 kits e 80 brinquedos...">${h(a.resultado)}</textarea>
      <label>Foto de capa</label><input type="file" name="capa" accept="image/*">
      ${a.capa_path ? `<p class="small muted">Já tem capa. Envie outra para trocar.</p>` : ''}
      <label class="check"><input type="checkbox" name="tem_apadrinhamento" ${a.tem_apadrinhamento ? 'checked' : ''}> Esta ação tem apadrinhamento</label>
      <label class="check"><input type="checkbox" name="visivel" ${a.visivel ? 'checked' : ''}> Publicada (visível para todos). Desmarcado = só administradores veem.</label>
      <div class="sp"></div><button class="btn block">Salvar ação</button></form>`, true);
  };
  Admin.salvarAcao = act(async (e, id) => {
    const form = e.target, f = fd(form);
    const novoId = id || crypto.randomUUID();
    const payload = {
      titulo: f.titulo, descricao: f.descricao || null, status: f.status, vagas: f.vagas ? parseInt(f.vagas) : null,
      data_inicio: fromLocalInput(f.data_inicio), data_fim: fromLocalInput(f.data_fim), prazo: f.prazo || null,
      beneficiados: parseInt(f.beneficiados) || 0, local: f.local || null, ponto_encontro: f.ponto_encontro || null,
      itens_necessarios: f.itens_necessarios || null, como_participar: f.como_participar || null, tarefas: f.tarefas || null,
      resultado: f.resultado || null, tem_apadrinhamento: !!f.tem_apadrinhamento, visivel: !!f.visivel
    };
    const arq = form.capa.files[0];
    if (arq) {
      const img = await comprimirImagem(arq);
      const path = `acoes/${novoId}/capa-${Date.now()}.jpg`;
      await q(sb.storage.from('fotos').upload(path, img, { contentType: img.type || 'image/jpeg' }));
      payload.capa_path = path;
    }
    if (id) await q(sb.from('acoes').update(payload).eq('id', id), 'Ação atualizada!');
    else await q(sb.from('acoes').insert({ id: novoId, ...payload }), 'Ação criada!');
    A.closeModal();
    if (id) reloadAdmin(); else location.hash = '#/admin/acao/' + novoId;
  });

  async function acaoGerenciar(id) {
    const a = await q(sb.from('acoes').select('*').eq('id', id).maybeSingle());
    if (!a) return main('<div class="empty">Ação não encontrada.</div>');
    st.acao = a;
    const tabs = [['apadrinhamento', '🎁 Apadrinhamento'], ['presentes', '📦 Presentes e kits'], ['voluntarios', '🤝 Voluntários'], ['doacoes', '💗 Doações'], ['fotos', '📸 Fotos']];
    main(head(h(a.titulo), '#/admin/acoes') + `
      <div class="row">${badge(ACAO, a.status)}${a.visivel ? '<span class="badge b-ok">Publicada</span>' : '<span class="badge b-err">Oculta — só admins veem</span>'}</div>
      <div class="sp"></div><div class="row">
        <button class="btn sm" onclick="Admin.formAcao('${a.id}')">✏️ Editar dados</button>
        <button class="btn sm ${a.visivel ? 'sec' : 'ok'}" onclick="Admin.toggleVisivel(event)">${a.visivel ? '🙈 Ocultar' : '🚀 Publicar / lançar'}</button>
        <a class="btn sm sec" href="#/acao/${a.id}">👁️ Ver como voluntário</a>
        <button class="btn sm sec" onclick="Admin.relatorioAcao(event)">⬇️ Relatório</button>
        ${isAdmin() ? `<button class="btn sm ghost" onclick="Admin.excluirAcao(event)">Excluir</button>` : ''}
      </div><div class="sp"></div>
      <div id="acao-nums"></div>
      <div class="tabs">${tabs.map(([k, l]) => `<div class="tab ${st.tab === k ? 'on' : ''}" onclick="Admin.tab('${k}')">${l}</div>`).join('')}</div>
      <div id="tab-body">${'<div class="loading"><div class="spin"></div></div>'}</div>`);
    numerosAcao();
    await renderTab();
  }
  async function numerosAcao() {
    const r = await q(sb.rpc('acao_resumo', { p_acao: st.acao.id }));
    const el = $('#acao-nums'); if (!el || !r) return;
    el.innerHTML = `<div class="grid g4"><div class="stat"><b>${r.inscritos}${st.acao.vagas ? '/' + st.acao.vagas : ''}</b><small>Voluntários</small></div>
      <div class="stat"><b>${r.afilhados - r.disponiveis}/${r.afilhados}</b><small>Apadrinhados</small></div>
      <div class="stat"><b>${r.entregues}</b><small>Presentes entregues</small></div>
      <div class="stat"><b>${Number(r.doacoes_recebidas)}</b><small>Itens doados</small></div></div><div class="sp"></div>`;
  }
  Admin.tab = async k => {
    st.tab = k;
    document.querySelectorAll('.tabs .tab').forEach(t => t.classList.toggle('on', t.getAttribute('onclick').includes(`'${k}'`)));
    $('#tab-body').innerHTML = '<div class="loading"><div class="spin"></div></div>';
    await renderTab();
  };
  async function renderTab() {
    try {
      const fn = { apadrinhamento: tabApadrinhamento, presentes: tabPresentes, voluntarios: tabVoluntarios, doacoes: tabDoacoes, fotos: tabFotos }[st.tab];
      await fn();
    } catch (e) { $('#tab-body').innerHTML = `<div class="empty">Erro ao carregar.</div>`; }
  }
  const refreshTab = async () => { await renderTab(); numerosAcao(); };

  Admin.toggleVisivel = act(async () => {
    const v = !st.acao.visivel;
    if (v && !confirm('Publicar esta ação? Todos os voluntários serão avisados.')) return;
    await q(sb.from('acoes').update({ visivel: v }).eq('id', st.acao.id), v ? 'Ação publicada!' : 'Ação ocultada.');
    reloadAdmin();
  });
  Admin.excluirAcao = act(async () => {
    if (!confirm('Excluir esta ação com TODOS os apadrinhados, inscrições, doações e fotos? Não tem volta.')) return;
    if ((prompt('Digite EXCLUIR para confirmar') || '').toUpperCase() !== 'EXCLUIR') return;
    await q(sb.from('acoes').delete().eq('id', st.acao.id), 'Ação excluída.');
    location.hash = '#/admin/acoes';
  });

  /* ---------- Aba: Apadrinhamento ---------- */
  async function carregarAfs() {
    st.afs = await fetchAll(() => sb.from('afilhados').select('*,padrinho:profiles(nome,telefone)').eq('acao_id', st.acao.id).order('identificacao'));
  }
  async function tabApadrinhamento() {
    const a = st.acao;
    await carregarAfs();
    const afs = st.afs;
    const cont = k => afs.filter(x => x.status === k).length;
    $('#tab-body').innerHTML = `
      <div class="card"><h3>Configuração do apadrinhamento</h3>
      <form onsubmit="Admin.salvarConfigAfi(event)">
        <label class="check"><input type="checkbox" name="tem_apadrinhamento" ${a.tem_apadrinhamento ? 'checked' : ''}> Esta ação tem apadrinhamento</label>
        <label class="check"><input type="checkbox" name="apadrinhamento_aberto" ${a.apadrinhamento_aberto ? 'checked' : ''}> Apadrinhamento ABERTO (voluntários podem escolher)</label>
        <label>Máximo de apadrinhados por pessoa</label><input name="max_por_padrinho" type="number" min="1" value="${a.max_por_padrinho ?? ''}" placeholder="Sem limite">
        <label>Orientações e itens do presente</label><textarea name="orientacoes_apadrinhamento" placeholder="Ex.: Presente até R$ 80, roupa nova + calçado + brinquedo. Entregar embalado e identificado até 15/12.">${h(a.orientacoes_apadrinhamento)}</textarea>
        <label>Campos exibidos de cada pessoa</label>
        ${Object.entries(CAMPOS).map(([k, l]) => `<label class="check"><input type="checkbox" name="campo_${k}" ${(a.campos_afilhado || []).includes(k) ? 'checked' : ''}> ${l}</label>`).join('')}
        <label>Campos extras (separados por vírgula)</label><input name="campos_extras" value="${h((a.campos_extras || []).join(', '))}" placeholder="Ex.: Brinquedo preferido, Cor favorita">
        <div class="sp"></div><button class="btn block">Salvar configuração</button></form></div>
      <div class="card"><div class="row between"><h3>Pessoas (${afs.length})</h3><div class="row">
        <button class="btn sm" onclick="Admin.formAfilhado()">+ Cadastrar</button>
        <button class="btn sm sec" onclick="Admin.loteAfilhados()">+ Vários de uma vez</button></div></div>
        <div class="sp"></div><div class="row small">${Object.keys(AFI).map(k => `${badge(AFI, k)} ${cont(k)}`).join(' ')}</div>
        <div class="sp"></div>
        ${a.apadrinhamento_aberto ? `<button class="btn sm warn" onclick="Admin.abrirFechar(event,false)">🔒 Encerrar apadrinhamento</button>`
          : `<button class="btn sm ok" onclick="Admin.abrirFechar(event,true)">🔓 Abrir apadrinhamento</button>`}
        ${a.apadrinhamento_aberto && afs.length && !cont('disponivel') ? '<p style="color:var(--ok)">✔ Todas as pessoas foram contempladas. Você já pode encerrar.</p>' : ''}
        <p class="small muted">🔒 Proteção de dados: cadastre apenas primeiro nome + inicial (ou um código), idade e tamanhos. Não cadastre sobrenome, endereço ou documentos de crianças.</p></div>
      ${afs.length ? afs.map(x => `<div class="item"><div class="row between"><span class="t">${h(x.identificacao)}</span>${badge(AFI, x.status)}</div>
        <div class="small">${afiDados(x, a)}</div>
        ${x.padrinho ? `<div class="small">Padrinho/madrinha: <b>${h(x.padrinho.nome)}</b> <a href="${waLink(x.padrinho.telefone)}" target="_blank" rel="noopener">📱 ${h(x.padrinho.telefone)}</a></div>` : ''}
        <div class="sp"></div><div class="row">
          <button class="btn sm sec" onclick="Admin.formAfilhado('${x.id}')">Editar / corrigir</button>
          ${x.status !== 'disponivel' ? `<button class="btn sm ghost" onclick="Admin.setAfi(event,'${x.id}','cancelar')">Cancelar apadrinhamento</button>` : ''}
          <button class="btn sm ghost" onclick="Admin.excluirAfilhado(event,'${x.id}')">Excluir</button></div></div>`).join('')
        : '<div class="empty">Nenhuma pessoa cadastrada ainda.</div>'}`;
  }
  Admin.salvarConfigAfi = act(async e => {
    const f = fd(e.target);
    const campos = Object.keys(CAMPOS).filter(k => f['campo_' + k]);
    const patch = {
      tem_apadrinhamento: !!f.tem_apadrinhamento, apadrinhamento_aberto: !!f.apadrinhamento_aberto,
      max_por_padrinho: f.max_por_padrinho ? parseInt(f.max_por_padrinho) : null,
      orientacoes_apadrinhamento: f.orientacoes_apadrinhamento || null, campos_afilhado: campos,
      campos_extras: (f.campos_extras || '').split(',').map(s => s.trim()).filter(Boolean)
    };
    await q(sb.from('acoes').update(patch).eq('id', st.acao.id), 'Configuração salva!');
    Object.assign(st.acao, patch);
    refreshTab();
  });
  Admin.abrirFechar = act(async (e, v) => {
    if (!v && !confirm('Encerrar o apadrinhamento? Ninguém mais poderá escolher.')) return;
    await q(sb.from('acoes').update({ apadrinhamento_aberto: v, ...(v ? { tem_apadrinhamento: true } : {}) }).eq('id', st.acao.id), v ? 'Apadrinhamento aberto!' : 'Apadrinhamento encerrado.');
    st.acao.apadrinhamento_aberto = v; if (v) st.acao.tem_apadrinhamento = true;
    refreshTab();
  });
  async function carregarUsuarios() {
    if (!st.users.length) st.users = await fetchAll(() => sb.from('profiles').select('id,nome,telefone,email,role,ativo').order('nome'));
    return st.users;
  }
  Admin.formAfilhado = async id => {
    const a = st.acao, x = id ? st.afs.find(z => z.id === id) : {};
    const users = id ? await carregarUsuarios() : [];
    modal(id ? 'Editar pessoa' : 'Cadastrar pessoa', `<form onsubmit="Admin.salvarAfilhado(event,'${id || ''}')">
      <label>Identificação * (primeiro nome + inicial ou código)</label><input name="identificacao" value="${h(x.identificacao)}" required>
      <div class="grid g2">
        <div><label>Idade</label><input name="idade" type="number" min="0" max="120" value="${x.idade ?? ''}"></div>
        <div><label>Tamanho de roupa</label><input name="tamanho_roupa" value="${h(x.tamanho_roupa)}"></div>
        <div><label>Calçado</label><input name="tamanho_calcado" value="${h(x.tamanho_calcado)}"></div>
      </div>
      <label>Observações</label><input name="observacoes" value="${h(x.observacoes)}">
      ${(a.campos_extras || []).map((c, i) => `<label>${h(c)}</label><input name="extra_${i}" value="${h(x.extras?.[c])}">`).join('')}
      ${id ? `<hr><h3>Correção do apadrinhamento</h3>
        <label>Status</label><select name="status">${Object.entries(AFI).map(([k, v]) => `<option value="${k}" ${x.status === k ? 'selected' : ''}>${v[0]}</option>`).join('')}</select>
        <label>Padrinho/madrinha</label><select name="padrinho_id"><option value="">— Nenhum —</option>
          ${users.map(u => `<option value="${u.id}" ${x.padrinho_id === u.id ? 'selected' : ''}>${h(u.nome)} ${u.telefone ? '· ' + h(u.telefone) : ''}</option>`).join('')}</select>
        <label class="check"><input type="checkbox" name="presente_comprado" ${x.presente_comprado ? 'checked' : ''}> Presente comprado</label>
        <label class="check"><input type="checkbox" name="kit_conferido" ${x.kit_conferido ? 'checked' : ''}> Kit conferido e montado</label>` : ''}
      <div class="sp"></div><button class="btn block">Salvar</button></form>`);
  };
  Admin.salvarAfilhado = act(async (e, id) => {
    const f = fd(e.target), a = st.acao;
    const extras = {}; (a.campos_extras || []).forEach((c, i) => { if (f['extra_' + i]) extras[c] = f['extra_' + i]; });
    const p = {
      identificacao: f.identificacao, idade: f.idade ? parseInt(f.idade) : null, tamanho_roupa: f.tamanho_roupa || null,
      tamanho_calcado: f.tamanho_calcado || null, observacoes: f.observacoes || null, extras
    };
    if (id) {
      const atual = st.afs.find(z => z.id === id);
      p.status = f.status; p.padrinho_id = f.padrinho_id || null;
      p.presente_comprado = !!f.presente_comprado; p.kit_conferido = !!f.kit_conferido;
      if (p.status === 'disponivel') { p.padrinho_id = null; p.presente_comprado = false; p.kit_conferido = false; p.reservado_em = null; p.comprado_em = null; p.recebido_em = null; p.entregue_em = null; }
      else if (!p.padrinho_id && p.status !== 'disponivel') return toast('Escolha o padrinho/madrinha ou volte o status para Disponível.', true);
      if (p.status !== 'disponivel' && !atual.reservado_em) p.reservado_em = nowISO();
      if (p.status === 'recebido' && !atual.recebido_em) p.recebido_em = nowISO();
      if (p.status === 'entregue' && !atual.entregue_em) p.entregue_em = nowISO();
      if (p.presente_comprado && !atual.comprado_em) p.comprado_em = nowISO();
      await q(sb.from('afilhados').update(p).eq('id', id), 'Registro atualizado!');
    } else await q(sb.from('afilhados').insert({ acao_id: a.id, ...p }), 'Pessoa cadastrada!');
    A.closeModal(); refreshTab();
  });
  Admin.loteAfilhados = () => modal('Cadastrar várias pessoas', `<form onsubmit="Admin.salvarLote(event)">
    <p class="small muted">Uma pessoa por linha, campos separados por ponto e vírgula:<br><b>Identificação; idade; tamanho de roupa; calçado; observações</b></p>
    <textarea name="lote" style="min-height:220px" placeholder="Ana S.; 6; 8; 28; gosta de bonecas&#10;Pedro L.; 9; 10; 32&#10;Criança 03; 4; 4; 24" required></textarea>
    <div class="sp"></div><button class="btn block">Cadastrar todos</button></form>`);
  Admin.salvarLote = act(async e => {
    const rows = linhas(fd(e.target).lote).map(l => {
      const [identificacao, idade, roupa, calcado, obs] = l.split(';').map(s => (s || '').trim());
      return { acao_id: st.acao.id, identificacao, idade: parseInt(idade) || null, tamanho_roupa: roupa || null, tamanho_calcado: calcado || null, observacoes: obs || null };
    }).filter(r => r.identificacao);
    if (!rows.length) return toast('Nenhuma linha válida.', true);
    await q(sb.from('afilhados').insert(rows), `${rows.length} pessoa(s) cadastrada(s)!`);
    A.closeModal(); refreshTab();
  });
  Admin.excluirAfilhado = act(async (e, id) => {
    if (!confirm('Excluir esta pessoa da campanha?')) return;
    await q(sb.from('afilhados').delete().eq('id', id), 'Excluído.');
    refreshTab();
  });
  Admin.setAfi = act(async (e, id, acao) => {
    const x = st.afs.find(z => z.id === id); let p;
    if (acao === 'cancelar') {
      if (!confirm(`Cancelar o apadrinhamento de ${x.identificacao}? A pessoa volta a ficar disponível.`)) return;
      p = { status: 'disponivel', padrinho_id: null, reservado_em: null, presente_comprado: false, comprado_em: null, recebido_em: null, kit_conferido: false, entregue_em: null };
    } else if (acao === 'comprado') p = { presente_comprado: true, comprado_em: nowISO(), status: x.status === 'reservado' ? 'apadrinhado' : x.status };
    else if (acao === 'recebido') p = { status: 'recebido', recebido_em: nowISO(), presente_comprado: true, comprado_em: x.comprado_em || nowISO() };
    else if (acao === 'kit') p = { kit_conferido: !x.kit_conferido };
    else if (acao === 'entregue') p = { status: 'entregue', entregue_em: nowISO() };
    else if (acao === 'desfazer_entrega') p = { status: 'recebido', entregue_em: null };
    await q(sb.from('afilhados').update(p).eq('id', id), 'Atualizado!');
    refreshTab();
  });

  /* ---------- Aba: Presentes e kits ---------- */
  const FILTROS_PRES = {
    todos: ['Todos', () => true],
    compra: ['Aguardando compra', x => x.status === 'reservado' && !x.presente_comprado],
    receber: ['A receber', x => ['reservado', 'apadrinhado'].includes(x.status)],
    kit: ['Kit a conferir', x => x.status === 'recebido' && !x.kit_conferido],
    entregar: ['A entregar', x => x.status === 'recebido'],
    entregues: ['Entregues', x => x.status === 'entregue'],
    sem: ['Sem padrinho', x => x.status === 'disponivel'],
  };
  async function tabPresentes() {
    await carregarAfs();
    const afs = st.afs, a = st.acao;
    const [, fn] = FILTROS_PRES[st.fPres];
    const lista = afs.filter(fn);
    $('#tab-body').innerHTML = `
      <div class="tabs">${Object.entries(FILTROS_PRES).map(([k, [l, f]]) => `<div class="tab ${st.fPres === k ? 'on' : ''}" onclick="Admin.fPres('${k}')">${l} (${afs.filter(f).length})</div>`).join('')}</div>
      <div class="row"><button class="btn sm sec" onclick="Admin.exportPres('xlsx')">⬇️ Lista de entrega (Excel)</button><button class="btn sm sec" onclick="Admin.exportPres('pdf')">⬇️ PDF</button></div><div class="sp"></div>
      ${lista.length ? lista.map(x => `<div class="item"><div class="row between"><span class="t">${h(x.identificacao)}</span>${badge(AFI, x.status)}</div>
        <div class="small">${afiDados(x, a)}</div>
        <div class="small">Responsável: <b>${x.padrinho ? h(x.padrinho.nome) : '—'}</b> ${x.padrinho?.telefone ? `<a href="${waLink(x.padrinho.telefone, `Olá! Lembrete sobre o presente de ${x.identificacao} (${a.titulo}).`)}" target="_blank" rel="noopener">📱 lembrar</a>` : ''}</div>
        <div class="row small">
          <span>${x.presente_comprado ? '✅' : '⬜'} Comprado</span><span>${x.recebido_em ? '✅' : '⬜'} Recebido</span>
          <span>${x.kit_conferido ? '✅' : '⬜'} Kit conferido</span><span>${x.entregue_em ? '✅' : '⬜'} Entregue</span></div>
        ${x.status !== 'disponivel' ? `<div class="sp"></div><div class="row">
          ${!x.presente_comprado ? `<button class="btn sm sec" onclick="Admin.setAfi(event,'${x.id}','comprado')">Comprado</button>` : ''}
          ${['reservado', 'apadrinhado'].includes(x.status) ? `<button class="btn sm" onclick="Admin.setAfi(event,'${x.id}','recebido')">📥 Recebido pela equipe</button>` : ''}
          ${['recebido', 'entregue'].includes(x.status) ? `<button class="btn sm ${x.kit_conferido ? 'ghost' : 'sec'}" onclick="Admin.setAfi(event,'${x.id}','kit')">${x.kit_conferido ? 'Desmarcar kit' : '🧺 Kit conferido'}</button>` : ''}
          ${x.status === 'recebido' ? `<button class="btn sm ok" onclick="Admin.setAfi(event,'${x.id}','entregue')">🎁 Entregue</button>` : ''}
          ${x.status === 'entregue' ? `<button class="btn sm ghost" onclick="Admin.setAfi(event,'${x.id}','desfazer_entrega')">Desfazer entrega</button>` : ''}
        </div>` : ''}</div>`).join('') : '<div class="empty">Nada nesta lista. 🎉</div>'}`;
  }
  Admin.fPres = k => { st.fPres = k; tabPresentes(); };
  const rowsAfs = lista => lista.map(x => ({
    'Identificação': x.identificacao, 'Idade': x.idade ?? '', 'Roupa': x.tamanho_roupa || '', 'Calçado': x.tamanho_calcado || '',
    'Obs.': x.observacoes || '', 'Status': AFI[x.status][0], 'Responsável': x.padrinho?.nome || '', 'Telefone': x.padrinho?.telefone || '',
    'Comprado': sim(x.presente_comprado), 'Recebido': x.recebido_em ? dt(x.recebido_em) : '', 'Kit': sim(x.kit_conferido), 'Entregue': x.entregue_em ? dt(x.entregue_em) : ''
  }));
  Admin.exportPres = tipo => {
    const lista = st.afs.filter(FILTROS_PRES[st.fPres][1]);
    const nome = 'presentes-' + st.acao.titulo.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 30);
    if (tipo === 'xlsx') exportXLSX(nome, { Presentes: rowsAfs(lista) });
    else exportPDF(`Presentes — ${st.acao.titulo} (${FILTROS_PRES[st.fPres][0]})`, rowsAfs(lista), nome);
  };

  /* ---------- Aba: Voluntários ---------- */
  async function tabVoluntarios() {
    const a = st.acao;
    const insc = await fetchAll(() => sb.from('inscricoes').select('*,profiles(nome,telefone,email)').eq('acao_id', a.id).order('created_at'));
    st.insc = insc;
    $('#tab-body').innerHTML = `
      <div class="card"><div class="row between"><h3>Confirmados: ${insc.length}${a.vagas ? ' de ' + a.vagas + ' vagas' : ''}</h3>
        <button class="btn sm" onclick="Admin.addVoluntario()">+ Adicionar</button></div>
        <div class="small muted">${a.data_inicio ? '📅 ' + dth(a.data_inicio) : ''} ${a.ponto_encontro ? '· 🚩 ' + h(a.ponto_encontro) : ''}</div>
        <div class="sp"></div><div class="row"><button class="btn sm sec" onclick="Admin.exportVol('xlsx')">⬇️ Excel</button><button class="btn sm sec" onclick="Admin.exportVol('pdf')">⬇️ PDF</button>
        <a class="btn sm sec" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(`📋 Voluntários confirmados — ${a.titulo}\n` + insc.map((i, n) => `${n + 1}. ${i.profiles?.nome || ''}${i.tarefa ? ' — ' + i.tarefa : ''}`).join('\n'))}">📤 Enviar lista no WhatsApp</a></div></div>
      ${insc.length ? insc.map(i => `<div class="item"><div class="row between"><span class="t">${h(i.profiles?.nome)}</span>
        <select style="width:auto;padding:6px 10px" onchange="Admin.attInsc(event,'${i.id}',{status:this.value})">
          ${Object.entries(INSC).map(([k, v]) => `<option value="${k}" ${i.status === k ? 'selected' : ''}>${v[0]}</option>`).join('')}</select></div>
        <div class="small"><a href="${waLink(i.profiles?.telefone)}" target="_blank" rel="noopener">📱 ${h(i.profiles?.telefone)}</a> · ${h(i.profiles?.email || '')}</div>
        <label>Tarefa</label><div class="row"><input style="flex:1" value="${h(i.tarefa)}" placeholder="Ex.: recepção, montagem dos kits" onchange="Admin.attInsc(event,'${i.id}',{tarefa:this.value||null})">
        <button class="btn sm ghost" onclick="Admin.removerInsc(event,'${i.id}')">Remover</button></div></div>`).join('')
        : '<div class="empty">Nenhum voluntário inscrito ainda.</div>'}`;
  }
  Admin.attInsc = act(async (e, id, patch) => { await q(sb.from('inscricoes').update(patch).eq('id', id), 'Salvo!'); });
  Admin.removerInsc = act(async (e, id) => {
    if (!confirm('Remover este voluntário da ação?')) return;
    await q(sb.from('inscricoes').delete().eq('id', id), 'Removido.'); refreshTab();
  });
  Admin.addVoluntario = async () => {
    const users = await carregarUsuarios();
    const ja = new Set((st.insc || []).map(i => i.user_id));
    const livres = users.filter(u => u.ativo && !ja.has(u.id));
    modal('Adicionar voluntário', `<form onsubmit="Admin.salvarAddVol(event)">
      <label>Voluntário</label><select name="user_id" required><option value="">Escolha</option>
      ${livres.map(u => `<option value="${u.id}">${h(u.nome)} ${u.telefone ? '· ' + h(u.telefone) : ''}</option>`).join('')}</select>
      <label>Tarefa (opcional)</label><input name="tarefa">
      <div class="sp"></div><button class="btn block">Adicionar</button></form>`);
  };
  Admin.salvarAddVol = act(async e => {
    const f = fd(e.target);
    await q(sb.from('inscricoes').insert({ acao_id: st.acao.id, user_id: f.user_id, tarefa: f.tarefa || null }), 'Voluntário adicionado!');
    A.closeModal(); refreshTab();
  });
  Admin.exportVol = tipo => {
    const rows = (st.insc || []).map(i => ({ 'Nome': i.profiles?.nome || '', 'Telefone': i.profiles?.telefone || '', 'E-mail': i.profiles?.email || '', 'Tarefa': i.tarefa || '', 'Situação': INSC[i.status][0], 'Inscrito em': dt(i.created_at) }));
    if (tipo === 'xlsx') exportXLSX('voluntarios-acao', { Voluntarios: rows });
    else exportPDF('Voluntários — ' + st.acao.titulo, rows, 'voluntarios-acao');
  };

  /* ---------- Aba: Doações ---------- */
  async function tabDoacoes() {
    const doa = await fetchAll(() => sb.from('doacoes').select('*').eq('acao_id', st.acao.id).order('created_at', { ascending: false }));
    st.doa = doa;
    const porItem = {};
    doa.forEach(d => { const k = d.item.trim().toLowerCase(); porItem[k] = porItem[k] || { item: d.item, prometido: 0, recebido: 0 }; porItem[k][d.status] += Number(d.quantidade); });
    const itens = linhas(st.acao.itens_necessarios);
    $('#tab-body').innerHTML = `
      <div class="card"><div class="row between"><h3>Doações (${doa.length})</h3><button class="btn sm" onclick="Admin.formDoacao()">+ Registrar doação</button></div>
      ${itens.length ? `<p class="small muted">Itens pedidos: ${itens.map(h).join(' · ')}</p>` : ''}
      ${Object.keys(porItem).length ? `<div class="tbl-wrap"><table><tr><th>Item</th><th>Prometido</th><th>Recebido</th></tr>
        ${Object.values(porItem).map(r => `<tr><td>${h(r.item)}</td><td>${r.prometido}</td><td style="color:var(--ok)">${r.recebido}</td></tr>`).join('')}</table></div>` : ''}
      <div class="sp"></div><div class="row"><button class="btn sm sec" onclick="Admin.exportDoa('xlsx')">⬇️ Excel</button><button class="btn sm sec" onclick="Admin.exportDoa('pdf')">⬇️ PDF</button></div></div>
      ${doa.length ? doa.map(d => `<div class="item"><div class="row between"><span><b>${h(d.quantidade)}× ${h(d.item)}</b></span>${badge(DOA, d.status)}</div>
        <div class="small muted">${h(d.doador_nome || 'Anônimo')} · ${dt(d.created_at)} ${d.observacao ? '· ' + h(d.observacao) : ''}</div>
        <div class="sp"></div><div class="row">
        ${d.status === 'prometido' ? `<button class="btn sm ok" onclick="Admin.attDoa(event,'${d.id}',true)">📥 Recebido</button>` : `<button class="btn sm ghost" onclick="Admin.attDoa(event,'${d.id}',false)">Voltar p/ prometido</button>`}
        <button class="btn sm ghost" onclick="Admin.excluirDoa(event,'${d.id}')">Excluir</button></div></div>`).join('') : '<div class="empty">Nenhuma doação registrada.</div>'}`;
  }
  Admin.formDoacao = () => modal('Registrar doação', `<form onsubmit="Admin.salvarDoa(event)">
    <label>Doador(a)</label><input name="doador_nome" placeholder="Nome ou 'Anônimo'">
    <label>Item *</label><input name="item" required>
    <label>Quantidade</label><input name="quantidade" type="number" min="0" step="0.01" value="1">
    <label>Observação</label><input name="observacao">
    <label class="check"><input type="checkbox" name="recebido" checked> Já foi recebido pela equipe</label>
    <div class="sp"></div><button class="btn block">Salvar</button></form>`);
  Admin.salvarDoa = act(async e => {
    const f = fd(e.target);
    await q(sb.from('doacoes').insert({ acao_id: st.acao.id, doador_nome: f.doador_nome || 'Anônimo', item: f.item, quantidade: Number(f.quantidade) || 1, observacao: f.observacao || null, status: f.recebido ? 'recebido' : 'prometido', recebido_em: f.recebido ? nowISO() : null }), 'Doação registrada!');
    A.closeModal(); refreshTab();
  });
  Admin.attDoa = act(async (e, id, rec) => { await q(sb.from('doacoes').update({ status: rec ? 'recebido' : 'prometido', recebido_em: rec ? nowISO() : null }).eq('id', id), 'Atualizado!'); refreshTab(); });
  Admin.excluirDoa = act(async (e, id) => { if (!confirm('Excluir esta doação?')) return; await q(sb.from('doacoes').delete().eq('id', id), 'Excluída.'); refreshTab(); });
  Admin.exportDoa = tipo => {
    const rows = (st.doa || []).map(d => ({ 'Doador': d.doador_nome || '', 'Item': d.item, 'Qtd': d.quantidade, 'Status': DOA[d.status][0], 'Obs.': d.observacao || '', 'Data': dt(d.created_at) }));
    if (tipo === 'xlsx') exportXLSX('doacoes', { Doacoes: rows }); else exportPDF('Doações — ' + st.acao.titulo, rows, 'doacoes');
  };

  /* ---------- Aba: Fotos ---------- */
  async function tabFotos() {
    const fotos = await q(sb.from('acao_fotos').select('*').eq('acao_id', st.acao.id).order('created_at'));
    $('#tab-body').innerHTML = `<div class="card"><h3>Enviar fotos</h3>
      <p class="small" style="color:var(--warn)">⚠️ Fotos de crianças e pessoas vulneráveis só com autorização dos responsáveis. Prefira fotos sem rostos identificáveis.</p>
      <input type="file" id="fotosin" accept="image/*" multiple><div class="sp"></div>
      <button class="btn block" onclick="Admin.enviarFotos(event)">Enviar fotos</button></div>
      ${fotos.length ? `<div class="gallery">${fotos.map(f => `<div><img src="${h(fotoUrl(f.path))}" loading="lazy">
        <div class="row" style="gap:4px"><button class="btn sm ghost" onclick="Admin.capa(event,'${h(f.path)}')">Capa</button>
        <button class="btn sm ghost" onclick="Admin.excluirFoto(event,'${f.id}','${h(f.path)}')">🗑️</button></div></div>`).join('')}</div>`
        : '<div class="empty">Nenhuma foto ainda.</div>'}`;
  }
  Admin.enviarFotos = act(async () => {
    const files = [...($('#fotosin').files || [])];
    if (!files.length) return toast('Escolha as fotos.', true);
    let n = 0;
    for (const f0 of files) {
      const f = await comprimirImagem(f0);
      const path = `acoes/${st.acao.id}/${Date.now()}-${n}.jpg`;
      await q(sb.storage.from('fotos').upload(path, f, { contentType: f.type || 'image/jpeg' }));
      await q(sb.from('acao_fotos').insert({ acao_id: st.acao.id, path }));
      n++;
    }
    toast(`${n} foto(s) enviada(s)!`); refreshTab();
  });
  Admin.capa = act(async (e, path) => { await q(sb.from('acoes').update({ capa_path: path }).eq('id', st.acao.id), 'Capa atualizada!'); st.acao.capa_path = path; });
  Admin.excluirFoto = act(async (e, id, path) => {
    if (!confirm('Excluir esta foto?')) return;
    await q(sb.from('acao_fotos').delete().eq('id', id));
    await sb.storage.from('fotos').remove([path]);
    if (st.acao.capa_path === path) await sb.from('acoes').update({ capa_path: null }).eq('id', st.acao.id);
    toast('Foto excluída.'); refreshTab();
  });

  /* ---------- Relatório completo da ação ---------- */
  Admin.relatorioAcao = act(async () => {
    const id = st.acao.id;
    const [afs, insc, doa] = await Promise.all([
      fetchAll(() => sb.from('afilhados').select('*,padrinho:profiles(nome,telefone)').eq('acao_id', id).order('identificacao')),
      fetchAll(() => sb.from('inscricoes').select('*,profiles(nome,telefone,email)').eq('acao_id', id)),
      fetchAll(() => sb.from('doacoes').select('*').eq('acao_id', id)),
    ]);
    const a = st.acao;
    exportXLSX('relatorio-' + a.titulo.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 30), {
      'Resumo': [{ 'Ação': a.titulo, 'Situação': ACAO[a.status][0], 'Data': dth(a.data_inicio), 'Local': a.local || '', 'Beneficiados': a.beneficiados,
        'Voluntários': insc.length, 'Apadrinhados': afs.filter(x => x.status !== 'disponivel').length, 'Presentes entregues': afs.filter(x => x.status === 'entregue').length,
        'Itens doados recebidos': doa.filter(d => d.status === 'recebido').reduce((s, d) => s + Number(d.quantidade), 0), 'Resultado': a.resultado || '' }],
      'Apadrinhamento': rowsAfs(afs),
      'Voluntarios': insc.map(i => ({ 'Nome': i.profiles?.nome || '', 'Telefone': i.profiles?.telefone || '', 'Tarefa': i.tarefa || '', 'Situação': INSC[i.status][0] })),
      'Doacoes': doa.map(d => ({ 'Doador': d.doador_nome || '', 'Item': d.item, 'Qtd': d.quantidade, 'Status': DOA[d.status][0] })),
    });
  });

  /* =============================== USUÁRIOS / VOLUNTÁRIOS =============================== */
  async function usuarios() {
    st.users = await fetchAll(() => sb.from('profiles').select('*').order('nome'));
    main(head('🤝 Voluntários e usuários', '#/admin', `<button class="btn sm sec" onclick="Admin.exportUsers()">⬇️ Excel</button>`) + `
      <div class="card"><label>Buscar</label><input placeholder="Nome, telefone ou e-mail" value="${h(st.fUser)}" oninput="Admin.fUser(this.value)">
      ${isAdmin() ? '<p class="small muted">Papéis: <b>Administrador</b> acessa tudo · <b>Responsável</b> gerencia ações, apadrinhamento, presentes e camisetas · <b>Voluntário</b> usa o app.</p>' : ''}</div>
      <div id="user-list"></div>`);
    renderUsers();
    try { await urlsFotos(st.users.map(u => u.foto_path).filter(Boolean)); renderUsers(); } catch {}
  }
  function renderUsers() {
    const b = st.fUser.toLowerCase(), bd = onlyDigits(st.fUser);
    const lista = st.users.filter(u => !b || u.nome.toLowerCase().includes(b) || (u.email || '').toLowerCase().includes(b) || (bd && onlyDigits(u.telefone).includes(bd)));
    $('#user-list').innerHTML = `<p class="small muted">${lista.length} pessoa(s)</p>` + lista.map(u => `
      <a class="item" style="display:block;text-decoration:none;color:inherit" href="#/admin/usuario/${u.id}">
      <div class="row" style="flex-wrap:nowrap;align-items:center">${avatarHTML(u.foto_path, u.nome, 48)}
      <div style="flex:1;min-width:0"><div class="row between"><span class="t">${h(u.nome || '(sem nome)')}</span><div class="row">${badge(ROLE, u.role)}${u.ativo ? '' : '<span class="badge b-err">Inativo</span>'}</div></div>
      <div class="small muted">${h(u.telefone)} · ${h(u.email || '')} · desde ${dt(u.created_at)}</div></div></div></a>`).join('');
  }
  Admin.fUser = v => { st.fUser = v; renderUsers(); };
  Admin.exportUsers = () => exportXLSX('voluntarios', {
    Voluntarios: st.users.map(u => ({ 'Nome': u.nome, 'Telefone': u.telefone, 'E-mail': u.email || '', 'Papel': ROLE[u.role][0], 'Ativo': sim(u.ativo), 'Cadastro': dt(u.created_at), 'Aceite LGPD': u.aceite_lgpd_em ? dt(u.aceite_lgpd_em) : '' }))
  });

  async function usuario(id) {
    const u = await q(sb.from('profiles').select('*').eq('id', id).maybeSingle());
    if (!u) return main('<div class="empty">Usuário não encontrado.</div>');
    const [insc, afs, peds, doa] = await Promise.all([
      q(sb.from('inscricoes').select('*,acoes(id,titulo,data_inicio)').eq('user_id', id).order('created_at', { ascending: false })),
      q(sb.from('afilhados').select('*,acoes(id,titulo)').eq('padrinho_id', id)),
      q(sb.from('pedidos_camiseta').select('*').eq('user_id', id)),
      q(sb.from('doacoes').select('*,acoes(titulo)').eq('user_id', id)),
    ]);
    const eu = u.id === S.profile.id;
    if (u.foto_path) { try { await urlsFotos([u.foto_path]); } catch {} }
    main(head(h(u.nome || '(sem nome)'), '#/admin/usuarios') + `
      <div class="card"><div class="foto-perfil">${avatarHTML(u.foto_path, u.nome, 110)}</div><div class="sp"></div><div class="row">${badge(ROLE, u.role)}${u.ativo ? '<span class="badge b-ok">Ativo</span>' : '<span class="badge b-err">Inativo</span>'}</div>
        <div class="sp"></div><div>📱 <a href="${waLink(u.telefone)}" target="_blank" rel="noopener">${h(u.telefone)}</a></div>
        <div>✉️ ${h(u.email || '')}</div><div class="small muted">Cadastro: ${dt(u.created_at)} · Aceite LGPD: ${u.aceite_lgpd_em ? dt(u.aceite_lgpd_em) : '—'}</div>
        ${isAdmin() ? `<hr><form onsubmit="Admin.salvarUser(event,'${u.id}')">
          <label>Nome</label><input name="nome" value="${h(u.nome)}" required>
          <label>Telefone</label><input name="telefone" value="${h(u.telefone)}" oninput="this.value=fmtTel(this.value)">
          <label>Papel / permissão</label><select name="role">${Object.entries(ROLE).map(([k, v]) => `<option value="${k}" ${u.role === k ? 'selected' : ''}>${v[0]}</option>`).join('')}</select>
          <label class="check"><input type="checkbox" name="ativo" ${u.ativo ? 'checked' : ''}> Acesso ativo</label>
          <div class="sp"></div><button class="btn block">Salvar alterações</button></form>
          ${!eu ? `<div class="sp"></div><button class="btn err sm" onclick="Admin.excluirUser(event,'${u.id}')">Excluir usuário (LGPD)</button>` : ''}` : ''}</div>
      <div class="grid g4"><div class="stat"><b>${insc.length}</b><small>Ações</small></div><div class="stat"><b>${insc.filter(i => i.status === 'presente').length}</b><small>Presenças</small></div>
        <div class="stat"><b>${afs.length}</b><small>Apadrinhou</small></div><div class="stat"><b>${peds.length}</b><small>Pedidos camiseta</small></div></div>
      <div class="sp"></div><h3>Histórico de participação</h3><div class="sp"></div>
      ${insc.length ? insc.map(i => `<div class="item"><div class="row between"><a href="#/admin/acao/${i.acao_id}">${h(i.acoes?.titulo)}</a>${badge(INSC, i.status)}</div>
        <div class="small muted">${i.acoes?.data_inicio ? dth(i.acoes.data_inicio) : ''} ${i.tarefa ? '· Tarefa: ' + h(i.tarefa) : ''}</div></div>`).join('') : '<div class="empty">Sem participações.</div>'}
      <h3>Apadrinhamentos</h3><div class="sp"></div>
      ${afs.length ? afs.map(x => `<div class="item"><div class="row between"><span>${h(x.identificacao)} — ${h(x.acoes?.titulo)}</span>${badge(AFI, x.status)}</div></div>`).join('') : '<div class="empty">Nenhum.</div>'}
      <h3>Camisetas</h3><div class="sp"></div>
      ${peds.length ? peds.map(p => `<div class="item"><div class="row between"><span>${p.quantidade}× ${h(p.tamanho)} · ${money(p.valor_total)}</span>${badge(PED, p.status)}</div></div>`).join('') : '<div class="empty">Nenhum pedido.</div>'}
      <h3>Doações</h3><div class="sp"></div>
      ${doa.length ? doa.map(d => `<div class="item">${h(d.quantidade)}× ${h(d.item)} — ${h(d.acoes?.titulo)} ${badge(DOA, d.status)}</div>`).join('') : '<div class="empty">Nenhuma.</div>'}`);
  }
  Admin.salvarUser = act(async (e, id) => {
    const f = fd(e.target);
    await q(sb.from('profiles').update({ nome: f.nome, telefone: f.telefone || '', role: f.role, ativo: !!f.ativo }).eq('id', id), 'Usuário atualizado!');
    st.users = [];
    if (id === S.profile.id) await loadProfile();
    reloadAdmin();
  });
  Admin.excluirUser = act(async (e, id) => {
    if (!confirm('Excluir este usuário? O acesso é apagado e os dados pessoais são removidos/anonimizados.')) return;
    if ((prompt('Digite EXCLUIR para confirmar') || '').toUpperCase() !== 'EXCLUIR') return;
    try { await apagarFotos(id); } catch {}
    await q(sb.rpc('admin_excluir_usuario', { p_user: id }), 'Usuário excluído.');
    st.users = []; location.hash = '#/admin/usuarios';
  });

  /* =============================== AVISOS =============================== */
  async function avisos() {
    const acoes = await q(sb.from('acoes').select('id,titulo').neq('status', 'realizada').order('created_at', { ascending: false }));
    main(head('🔔 Enviar aviso') + `<div class="card"><form onsubmit="Admin.enviarAviso(event)">
      <label>Para quem?</label><select name="acao"><option value="">Todos os voluntários ativos</option>
        ${acoes.map(a => `<option value="${a.id}">Participantes e padrinhos de: ${h(a.titulo)}</option>`).join('')}</select>
      <label>Título</label><input name="titulo" required placeholder="Ex.: Lembrete: entrega dos presentes sábado">
      <label>Mensagem</label><textarea name="mensagem" required></textarea>
      <div class="sp"></div><button class="btn block">Enviar aviso no app</button></form>
      <div class="sp"></div><button class="btn sec block" onclick="Admin.avisoWhats()">📤 Copiar para grupo do WhatsApp</button></div>
      <p class="small muted">O aviso aparece no sino 🔔 de cada voluntário. Para alcançar quem não abre o app, use também o botão do WhatsApp.</p>`);
  }
  Admin.enviarAviso = act(async e => {
    const f = fd(e.target);
    if (!confirm('Enviar este aviso?')) return;
    const n = await q(sb.rpc('notificar', { p_titulo: f.titulo, p_mensagem: f.mensagem, p_acao: f.acao || null }));
    toast(`Aviso enviado${typeof n === 'number' && !f.acao ? ` para ${n} pessoa(s)` : ''}!`);
    e.target.reset();
  });
  Admin.avisoWhats = () => {
    const form = document.querySelector('#main form'); const f = fd(form);
    if (!f.titulo && !f.mensagem) return toast('Escreva o título e a mensagem primeiro.', true);
    window.open('https://wa.me/?text=' + encodeURIComponent(`*${f.titulo}*\n\n${f.mensagem}\n\n${baseUrl()}`), '_blank');
  };

  /* =============================== CONFIGURAÇÕES =============================== */
  async function configTela() {
    if (!soAdmin()) return;
    await loadConfig();
    const c = S.config;
    main(head('⚙️ Configurações') + `<form onsubmit="Admin.salvarConfig(event)">
      <div class="card"><h3>Grupo</h3>
        <label>Nome do grupo / ONG</label><input name="nome_grupo" value="${h(c.nome_grupo)}" required>
        <label>WhatsApp de contato</label><input name="whatsapp_contato" value="${h(c.whatsapp_contato)}" oninput="this.value=fmtTel(this.value)"></div>
      <div class="card"><h3>Pix (recebedor das camisetas)</h3>
        <label>Tipo de chave</label><select name="pix_tipo">${[['cpf', 'CPF'], ['cnpj', 'CNPJ'], ['telefone', 'Celular'], ['email', 'E-mail'], ['aleatoria', 'Chave aleatória']].map(([k, l]) => `<option value="${k}" ${c.pix_tipo === k ? 'selected' : ''}>${l}</option>`).join('')}</select>
        <label>Chave Pix</label><input name="pix_chave" value="${h(c.pix_chave)}" placeholder="Exatamente como cadastrada no banco">
        <label>Nome do recebedor (como aparece no banco)</label><input name="pix_nome" value="${h(c.pix_nome)}" maxlength="25">
        <label>Cidade do recebedor</label><input name="pix_cidade" value="${h(c.pix_cidade)}" maxlength="15">
        <p class="small muted">Depois de salvar, use “Testar Pix” e pague R$ 0,01 com seu celular para confirmar que o QR Code cai na conta certa.</p>
        <button type="button" class="btn sm sec" onclick="Admin.testarPix()">🧪 Testar Pix (R$ 0,01)</button></div>
      <div class="card"><h3>Camisetas</h3>
        <label>Valor da camiseta (R$)</label><input name="valor_camiseta" type="number" step="0.01" min="0" value="${Number(c.valor_camiseta).toFixed(2)}" required>
        <label>Tamanhos (separados por vírgula)</label><input name="tamanhos" value="${h((c.tamanhos || []).join(', '))}" required>
        <label>Instruções após o pagamento</label><textarea name="instrucoes_camiseta">${h(c.instrucoes_camiseta)}</textarea>
        <label class="check"><input type="checkbox" name="loja_aberta" ${c.loja_aberta ? 'checked' : ''}> Vendas de camisetas abertas</label></div>
      <button class="btn block">Salvar configurações</button></form>`);
  }
  Admin.salvarConfig = act(async e => {
    const f = fd(e.target);
    const tamanhos = f.tamanhos.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
    if (!tamanhos.length) return toast('Informe ao menos um tamanho.', true);
    await q(sb.from('config').update({
      nome_grupo: f.nome_grupo, whatsapp_contato: f.whatsapp_contato || '', pix_tipo: f.pix_tipo, pix_chave: f.pix_chave,
      pix_nome: f.pix_nome, pix_cidade: f.pix_cidade || 'SAO PAULO', valor_camiseta: Number(f.valor_camiseta), tamanhos,
      instrucoes_camiseta: f.instrucoes_camiseta || '', loja_aberta: !!f.loja_aberta, updated_at: nowISO()
    }).eq('id', 1), 'Configurações salvas!');
    await loadConfig();
    document.querySelector('.top .brand').textContent = S.config.nome_grupo;
  });
  Admin.testarPix = () => {
    const f = fd(document.querySelector('#main form'));
    if (!f.pix_chave) return toast('Preencha a chave Pix.', true);
    const payload = pixPayload({ tipo: f.pix_tipo, chave: f.pix_chave, nome: f.pix_nome, cidade: f.pix_cidade, valor: 0.01, txid: 'TESTE' });
    modal('Teste do Pix', `<p class="center">Pague <b>R$ 0,01</b> e confira se o nome do recebedor está correto no app do banco.</p>
      <div class="qr" id="qrtest"></div><div class="copy" id="pixtest">${h(payload)}</div><div class="sp"></div>
      <button class="btn sec block" onclick="A.copiarEl('#pixtest')">📋 Copiar código</button>`);
    new QRCode($('#qrtest'), { text: payload, width: 220, height: 220, correctLevel: QRCode.CorrectLevel.M });
  };

  /* =============================== REGISTRO DE ALTERAÇÕES =============================== */
  const NOMES_TAB = { profiles: 'Usuários', config: 'Configurações', pedidos_camiseta: 'Camisetas', acoes: 'Ações', afilhados: 'Apadrinhamento', inscricoes: 'Inscrições', doacoes: 'Doações' };
  const OPS = { INSERT: ['Criou', 'b-ok'], UPDATE: ['Alterou', 'b-info'], DELETE: ['Excluiu', 'b-err'] };
  async function log() {
    if (!soAdmin()) return;
    const logs = await q(sb.from('audit_log').select('*').order('created_at', { ascending: false }).limit(300));
    const ignorar = new Set(['updated_at']);
    const desc = l => {
      const r = l.depois || l.antes || {};
      const nome = r.titulo || r.identificacao || r.nome || r.item || r.codigo || '';
      let mud = '';
      if (l.operacao === 'UPDATE' && l.antes && l.depois) {
        const ks = Object.keys(l.depois).filter(k => !ignorar.has(k) && JSON.stringify(l.antes[k]) !== JSON.stringify(l.depois[k]));
        mud = ks.slice(0, 6).map(k => `<div class="small"><b>${h(k)}</b>: <span class="muted">${h(String(l.antes[k] ?? '—').slice(0, 60))}</span> → ${h(String(l.depois[k] ?? '—').slice(0, 60))}</div>`).join('');
      }
      return { nome, mud };
    };
    main(head('📜 Registro de alterações', '#/admin', `<button class="btn sm sec" onclick="Admin.exportLog()">⬇️ Excel</button>`) +
      `<p class="small muted">Últimas 300 alterações.</p>` +
      (logs.length ? logs.map(l => { const d = desc(l); return `<div class="item">
        <div class="row between"><span>${badge(OPS, l.operacao)} <b>${h(NOMES_TAB[l.tabela] || l.tabela)}</b> ${h(d.nome)}</span><span class="small muted">${dth(l.created_at)}</span></div>
        <div class="small muted">por ${h(l.user_nome || (l.user_id ? 'usuário' : 'sistema'))}</div>${d.mud}</div>`; }).join('') : '<div class="empty">Nada registrado ainda.</div>'));
    st.logs = logs;
  }
  Admin.exportLog = () => exportXLSX('registro-alteracoes', {
    Log: (st.logs || []).map(l => ({ 'Data': dth(l.created_at), 'Quem': l.user_nome || '', 'Tabela': NOMES_TAB[l.tabela] || l.tabela, 'Operação': OPS[l.operacao]?.[0] || l.operacao, 'Registro': l.registro_id, 'Antes': JSON.stringify(l.antes || {}).slice(0, 32000), 'Depois': JSON.stringify(l.depois || {}).slice(0, 32000) }))
  });

  /* =============================== BACKUP =============================== */
  const TABELAS = ['config', 'profiles', 'pedidos_camiseta', 'acoes', 'acao_fotos', 'afilhados', 'inscricoes', 'doacoes', 'audit_log'];
  async function backup() {
    if (!soAdmin()) return;
    main(head('💾 Backup') + `<div class="card"><p>Baixe uma cópia completa de todos os dados do app. Recomendado: <b>toda semana</b> e sempre antes/depois de uma grande campanha. Guarde em local seguro (ex.: Google Drive privado) — o arquivo contém dados pessoais.</p>
      <div class="grid"><button class="btn" onclick="Admin.baixarBackup(event,'xlsx')">⬇️ Backup em Excel</button>
      <button class="btn sec" onclick="Admin.baixarBackup(event,'json')">⬇️ Backup completo (JSON)</button></div>
      <p class="small muted">Comprovantes e fotos ficam guardados no armazenamento do Supabase e não entram neste arquivo.</p></div>`);
  }
  Admin.baixarBackup = act(async (e, tipo) => {
    const dados = {};
    for (const t of TABELAS) dados[t] = await fetchAll(() => sb.from(t).select('*'));
    const data = new Date().toISOString().slice(0, 10);
    if (tipo === 'json') baixar(`backup-${data}.json`, JSON.stringify({ gerado_em: nowISO(), dados }, null, 2));
    else {
      const abas = {};
      for (const [t, rows] of Object.entries(dados)) abas[t] = rows.map(r => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v !== null && typeof v === 'object' ? JSON.stringify(v) : v])));
      exportXLSX(`backup-${data}`, abas);
    }
    toast('Backup gerado!');
  });
})();

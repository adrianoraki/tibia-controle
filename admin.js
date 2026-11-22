// TibiaHub — painel administrativo (só aparece para contas master)
(() => {
  const A = { usuarios: [], codigos: [], gerados: [] };
  const dt = (d) => (d ? new Date(d).toLocaleDateString('pt-BR') : '—');

  async function carregar() {
    const [u, c] = await Promise.all([sb.rpc('admin_listar_usuarios'), sb.from('codigos_acesso').select('*').order('criado_em', { ascending: false })]);
    if (u.error) return erro(u.error);
    A.usuarios = u.data || []; A.codigos = c.data || [];
    render();
  }

  function tabelaUsuarios(lista, vip) {
    if (!lista.length) return `<div class="bloqueio">Nenhum usuário ${vip ? 'VIP' : 'Free'}.</div>`;
    return `<div class="tabela-wrap"><table><tr><th>Nome</th><th>E-mail</th><th>Personagem</th><th>Mundo</th><th class="num">Hunts</th><th>Cadastro</th><th>Último login</th><th>${vip ? 'VIP até' : ''}</th><th>Ação</th></tr>` +
      lista.map((u) => `<tr><td>${esc(u.primeiro_nome || '—')}${u.admin ? ' <span class="selo selo-adm">Master</span>' : ''}</td><td class="muted">${esc(u.email)}</td>` +
        `<td>${esc(u.personagem || '—')}${u.verificado ? ' <span class="selo-verif">✔</span>' : ''}${u.level ? ` <small class="muted">lvl ${u.level}</small>` : ''}</td><td class="muted">${esc(u.mundo || '—')}</td>` +
        `<td class="num">${u.hunts}</td><td>${dt(u.criado_em)}</td><td>${dt(u.ultimo_login)}</td><td>${vip ? (u.premium_ate ? dt(u.premium_ate) : 'sem vencimento') : ''}</td>` +
        `<td>${u.admin ? '' : `<select class="adm-acao" data-id="${u.id}" data-email="${esc(u.email)}"><option value="">Escolher...</option><option value="3">+ 3 meses VIP</option><option value="6">+ 6 meses VIP</option><option value="12">+ 12 meses VIP</option>${vip ? '<option value="0">Voltar para Free</option>' : ''}</select>`}</td></tr>`).join('') +
      '</table></div>';
  }

  function render() {
    const vip = A.usuarios.filter((u) => u.vip), free = A.usuarios.filter((u) => !u.vip);
    const emailDe = new Map(A.usuarios.map((u) => [u.id, u.email]));
    const livres = A.codigos.filter((c) => !c.usado_por);
    $('#adm-resumo').innerHTML = kpi('Usuários cadastrados', A.usuarios.length) + kpi('VIP', `<span class="pos">${vip.length}</span>`, 'ouro') + kpi('Free', free.length) +
      kpi('Novos nos últimos 7 dias', A.usuarios.filter((u) => new Date(u.criado_em) > Date.now() - 7 * 864e5).length) + kpi('Códigos disponíveis', livres.length);
    $('#adm-vip').innerHTML = tabelaUsuarios(vip, true);
    $('#adm-free').innerHTML = tabelaUsuarios(free, false);
    $('#adm-gerados').innerHTML = A.gerados.length ? `<div class="gerados"><b>Códigos gerados agora:</b> ${A.gerados.map((c) => `<span class="codigo">${esc(c)}</span>`).join(' ')} <button class="btn sec mini" type="button" id="adm-copiar">Copiar todos</button></div>` : '';
    $('#adm-codigos').innerHTML = A.codigos.length ? `<div class="tabela-wrap"><table><tr><th>Código</th><th>Plano</th><th>Criado em</th><th>Observação</th><th>Situação</th><th></th></tr>` +
      A.codigos.map((c) => `<tr><td><span class="codigo">${esc(c.codigo)}</span></td><td>${c.meses} meses</td><td>${dt(c.criado_em)}</td><td class="muted">${esc(c.observacao || '')}</td>` +
        `<td>${c.usado_por ? `<span class="muted">usado por ${esc(emailDe.get(c.usado_por) || 'conta excluída')} em ${dt(c.usado_em)}</span>` : '<span class="pos">disponível</span>'}</td>` +
        `<td>${c.usado_por ? '' : `<button class="del" data-cod="${esc(c.codigo)}" title="Apagar código">✕</button>`}</td></tr>`).join('') + '</table></div>'
      : '<div class="bloqueio">Nenhum código criado ainda.</div>';
  }

  document.addEventListener('change', async (e) => {
    const s = e.target.closest('.adm-acao'); if (!s || s.value === '') return;
    const meses = +s.value, txt = meses ? `dar +${meses} meses de VIP para ${s.dataset.email}` : `voltar ${s.dataset.email} para o plano Free`;
    if (!await confirmar('Alterar plano', `Confirmar: ${txt}?`, { ok: meses ? 'Dar VIP' : 'Voltar para Free', tipo: meses ? '' : 'perigo' })) { s.value = ''; return; }
    const { error } = await sb.rpc('admin_definir_plano', { p_user: s.dataset.id, p_meses: meses });
    if (error) return erro(error);
    toast('Plano atualizado!'); carregar();
  });
  $('#adm-form').onsubmit = async (e) => {
    e.preventDefault(); const f = e.target;
    const { data, error } = await sb.rpc('admin_gerar_codigos', { p_meses: +f.meses.value, p_qtd: +f.qtd.value || 1, p_obs: f.obs.value.trim() || null });
    if (error) return erro(error);
    A.gerados = data || []; f.obs.value = ''; toast(`${A.gerados.length} código(s) gerado(s)!`); carregar();
  };
  $('#pag-admin').addEventListener('click', async (e) => {
    if (e.target.id === 'adm-copiar') { try { await navigator.clipboard.writeText(A.gerados.join('\n')); toast('Códigos copiados!'); } catch { toast(A.gerados.join(' ')); } return; }
    const cod = e.target.closest('[data-cod]')?.dataset.cod; if (!cod) return;
    if (!await confirmar('Apagar código', `Apagar o código ${cod}? Ele deixa de funcionar.`, { tipo: 'perigo', ok: 'Apagar' })) return;
    const { error } = await sb.from('codigos_acesso').delete().eq('codigo', cod);
    if (error) return erro(error); carregar();
  });
  // carrega quando a página Admin é aberta
  $('#menu [data-pag=admin]').addEventListener('click', () => { if (S.perfil?.admin) carregar(); });
})();

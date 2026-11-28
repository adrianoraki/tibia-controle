// TibiaHub — Minha guild: membros, quem está online e ranking de level, com dados públicos do Tibia.com via TibiaData.
// Todo texto vindo da API passa por esc(). Nada é gravado no servidor: só o nome da guild escolhida fica neste aparelho.
(() => {
  const G = { nome: null, dados: null, carregando: false, erro: '', filtro: 'online', busca: '', timer: null };
  const CH = 'tc_guild';
  const VOC = { 'Elite Knight': 'EK', Knight: 'EK', 'Royal Paladin': 'RP', Paladin: 'RP', 'Master Sorcerer': 'MS', Sorcerer: 'MS', 'Elder Druid': 'ED', Druid: 'ED', 'Exalted Monk': 'EM', Monk: 'EM', None: '—' };
  const COR = { EK: '#e11d48', RP: '#d97706', MS: '#7c3aed', ED: '#059669', EM: '#0891b2', '—': '#64748b' };
  const sigla = (v) => VOC[v] || '—';
  const linkChar = (n) => `https://www.tibia.com/community/?subtopic=characters&name=${encodeURIComponent(n)}`;
  const lerNome = () => { try { return localStorage.getItem(CH) || ''; } catch { return ''; } };
  const gravarNome = (n) => { try { if (n) localStorage.setItem(CH, n); else localStorage.removeItem(CH); } catch { /* ok */ } };

  async function descobrir() { // guild do personagem do perfil
    const p = S.perfil; if (!p?.personagem) return '';
    try { const j = await tdFetch('/character/' + encodeURIComponent(p.personagem)); return j?.character?.character?.guild?.name || ''; } catch { return ''; }
  }
  async function carregar(forcar) {
    if (G.carregando) return; G.carregando = true; G.erro = ''; render();
    try {
      if (!G.nome) G.nome = lerNome() || await descobrir();
      if (!G.nome) { G.dados = null; return; }
      const j = await tdFetch('/guild/' + encodeURIComponent(G.nome), 10000), g = j?.guild;
      if (!g || !g.name) { G.erro = `Não achei a guild "${G.nome}" no Tibia.com. Confira o nome.`; G.dados = null; return; }
      G.dados = { ...g, lido: Date.now() }; G.nome = g.name; gravarNome(g.name);
    } catch { G.erro = 'O Tibia.com (TibiaData) não respondeu agora. Tente de novo em alguns minutos.'; }
    finally { G.carregando = false; render(); if (forcar) toast('Guild atualizada.'); }
  }

  function render() {
    const el = $('#guild-app'); if (!el) return;
    const busca = `<form class="gd-busca" data-gd-form><label>Guild<input name="g" maxlength="40" placeholder="nome da guild" value="${esc(G.nome || '')}" autocomplete="off"></label><button class="btn">Ver guild</button>${G.dados ? '<button type="button" class="btn sec mini-btn" data-gd-atualizar>↻ Atualizar</button>' : ''}</form>`;
    if (G.carregando && !G.dados) { el.innerHTML = `<div class="card">${busca}<div class="bloqueio">Buscando a guild no Tibia.com…</div></div>`; return; }
    if (!G.dados) { el.innerHTML = `<div class="card">${busca}<div class="bloqueio">${G.erro ? esc(G.erro) : '🛡️ Seu personagem não está em uma guild, ou ainda não colocamos o nome dele. Digite o nome de qualquer guild para acompanhar.'}</div></div>`; return; }
    const g = G.dados, ms = Array.isArray(g.members) ? g.members : [], on = ms.filter((m) => m.status === 'online');
    const lvlMed = ms.length ? Math.round(ms.reduce((t, m) => t + (m.level || 0), 0) / ms.length) : 0;
    const porVoc = {}; for (const m of ms) { const s = sigla(m.vocation); porVoc[s] = (porVoc[s] || 0) + 1; }
    const onVoc = {}; for (const m of on) { const s = sigla(m.vocation); onVoc[s] = (onVoc[s] || 0) + 1; }
    const q = G.busca.toLowerCase();
    let lista = G.filtro === 'online' ? on : ms; if (q) lista = lista.filter((m) => String(m.name).toLowerCase().includes(q));
    lista = [...lista].sort((a, b) => (b.level || 0) - (a.level || 0));
    const pag = typeof paginar === 'function' ? paginar('gd-tab', lista, 20, render) : lista;
    const meu = String(S.perfil?.personagem || '').toLowerCase();
    el.innerHTML = `<div class="card gd-topo">${busca}
      <div class="gd-id">${g.logo_url && /^https:\/\/static\.tibia\.com\//.test(g.logo_url) ? `<img src="${esc(g.logo_url)}" alt="" width="64" height="64">` : '<span class="gd-logo">🛡️</span>'}
        <div><h3>${esc(g.name)}</h3><p class="muted">${esc(g.world || '')}${g.founded ? ` · fundada em ${esc(new Date(g.founded + 'T12:00Z').toLocaleDateString('pt-BR'))}` : ''} · <a href="https://www.tibia.com/community/?subtopic=guilds&page=view&GuildName=${encodeURIComponent(g.name)}" target="_blank" rel="noopener noreferrer">ver no Tibia.com</a></p></div></div>
      <div class="grid gd-kpis">${kpi('Membros', fmt(ms.length))}${kpi('Online agora', `<span class="pos">${fmt(on.length)}</span>`)}${kpi('Level médio', fmt(lvlMed))}${kpi('Maior level', fmt(Math.max(0, ...ms.map((m) => m.level || 0))))}</div>
      <div class="gd-vocs">${Object.entries(porVoc).sort((a, b) => b[1] - a[1]).map(([s, n]) => `<span class="gd-voc" style="--c:${COR[s] || '#64748b'}"><b>${esc(s)}</b> ${fmt(n)}${onVoc[s] ? ` <small class="pos">· ${fmt(onVoc[s])} on</small>` : ''}</span>`).join('')}</div>
      <p class="dica">Lido ${new Date(g.lido).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} · atualiza sozinho a cada 3 minutos com esta página aberta.</p></div>
    <div class="card"><div class="cm-cab"><div class="cm-abas" role="tablist">${[['online', `🟢 Online (${on.length})`], ['todos', `👥 Todos (${ms.length})`]].map(([id, n]) => `<button type="button" role="tab" aria-selected="${G.filtro === id}" class="chip ${G.filtro === id ? 'ativo' : ''}" data-gd-filtro="${id}">${n}</button>`).join('')}</div>
      <input class="gd-filtro-nome" data-gd-busca maxlength="30" placeholder="buscar membro" value="${esc(G.busca)}" aria-label="Buscar membro"></div>
      ${lista.length ? `<div class="tabela-wrap"><table id="gd-tab" class="cm-tab"><tr><th>#</th><th>Personagem</th><th>Voc.</th><th class="num">Level</th><th>Cargo</th><th></th></tr>
        ${pag.map((m) => { const s = sigla(m.vocation), pos = lista.indexOf(m) + 1; return `<tr class="${String(m.name).toLowerCase() === meu ? 'gd-eu' : ''}"><td class="muted">${pos}</td><td><a href="${linkChar(m.name)}" target="_blank" rel="noopener noreferrer"><b>${esc(m.name)}</b></a>${m.title ? ` <small class="muted">(${esc(m.title)})</small>` : ''}</td>
          <td><span class="gd-voc mini" style="--c:${COR[s] || '#64748b'}">${esc(s)}</span></td><td class="num"><b>${fmt(m.level || 0)}</b></td><td class="muted">${esc(m.rank || '')}</td><td>${m.status === 'online' ? '<span class="pos" title="Online">●</span>' : ''}</td></tr>`; }).join('')}</table></div>`
        : `<div class="bloqueio">${G.filtro === 'online' ? 'Ninguém da guild online agora.' : 'Nenhum membro encontrado.'}</div>`}</div>
    <p class="dica">Dados públicos do <a href="https://www.tibia.com" target="_blank" rel="noopener noreferrer">www.tibia.com</a> (CipSoft) via TibiaData. O nome da guild fica só neste aparelho.</p>`;
  }

  const ligarTimer = () => { clearInterval(G.timer); G.timer = setInterval(() => { if (!$('#pag-guild')?.classList.contains('hidden') && !document.hidden && G.nome) carregar(); }, 180000); };
  document.addEventListener('click', (e) => {
    if (e.target.closest('#menu [data-pag=guild]')) { if (!G.dados && !G.carregando) carregar(); else render(); ligarTimer(); return; }
    if (e.target.closest('#guild-app [data-gd-atualizar]')) { carregar(true); return; }
    const f = e.target.closest('#guild-app [data-gd-filtro]'); if (f) { G.filtro = f.dataset.gdFiltro === 'todos' ? 'todos' : 'online'; if (typeof PG !== 'undefined') PG['gd-tab'] = 1; render(); }
  });
  document.addEventListener('submit', (e) => {
    const f = e.target.closest('#guild-app [data-gd-form]'); if (!f) return; e.preventDefault();
    const n = String(f.g.value || '').trim().replace(/\s+/g, ' ').slice(0, 40);
    if (!/^[A-Za-z0-9 '\-.]{2,40}$/.test(n)) { toast('Digite o nome da guild (letras, números e espaço).'); return; }
    G.nome = n; G.dados = null; gravarNome(n); carregar();
  });
  let tb = null;
  document.addEventListener('input', (e) => {
    const b = e.target.closest('#guild-app [data-gd-busca]'); if (!b) return;
    clearTimeout(tb); tb = setTimeout(() => { G.busca = b.value.slice(0, 30); if (typeof PG !== 'undefined') PG['gd-tab'] = 1; render(); const i = $('#guild-app [data-gd-busca]'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }, 200);
  });
})();

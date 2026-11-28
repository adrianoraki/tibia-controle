// TibiaHub — Minha guild: membros, quem está online e ranking de level, com dados públicos do Tibia.com via TibiaData.
// Todo texto vindo da API passa por esc(). Nada é gravado no servidor: só o nome da guild escolhida fica neste aparelho.
(() => {
  const G = { nome: null, dados: null, carregando: false, erro: '', filtro: 'online', busca: '', timer: null, aba: 'guild', vip: null, vipDados: {}, vipOn: {}, vipCarregando: false, vipLido: 0 };
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


  // ---------- Lista VIP: amigos e rivais (dados públicos do Tibia.com via TibiaData; os nomes ficam só neste aparelho) ----------
  const CHV = 'tc_vip', CHL = 'tc_vip_lv', NOME_OK = /^[A-Za-z][A-Za-z '\-.]{1,28}[A-Za-z.]$/;
  const lerJ = (k, d) => { try { return JSON.parse(localStorage.getItem(k) || '') || d; } catch { return d; } };
  const gravarJ = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ok */ } };
  const vipLista = () => (G.vip || (G.vip = lerJ(CHV, []).filter((n) => typeof n === 'string' && NOME_OK.test(n)).slice(0, 30)));
  async function carregarVip() {
    const nomes = vipLista(); if (!nomes.length || G.vipCarregando) { render(); return; }
    G.vipCarregando = true; render();
    const fila = [...nomes], mundos = new Set();
    const um = async () => { while (fila.length) { const n = fila.shift();
      try { const j = await tdFetch('/character/' + encodeURIComponent(n)), c = j?.character?.character;
        G.vipDados[n] = c ? { nome: c.name, level: c.level, voc: c.vocation, mundo: c.world, login: c.last_login, mortes: (j.character.deaths || []).slice(0, 5) } : { erro: 'não existe' };
        if (c?.world) mundos.add(c.world);
      } catch { G.vipDados[n] = G.vipDados[n] || { erro: 'sem resposta' }; } } };
    await Promise.all([um(), um(), um()]);
    for (const w of mundos) { try { const j = await tdFetch('/world/' + encodeURIComponent(w)); G.vipOn[w] = new Set((j?.world?.online_players || []).map((p) => String(p.name).toLowerCase())); } catch { /* sem online */ } }
    // levels: guarda o level de cada dia para mostrar quem upou
    const hist = lerJ(CHL, {}), hoje = hojeISO();
    for (const n of nomes) { const d = G.vipDados[n]; if (!d?.level) continue; const h = hist[n] || {};
      if (h.dia !== hoje) { hist[n] = { dia: hoje, lv: d.level, antes: h.lv ?? null, antesDia: h.dia ?? null }; } else if (d.level !== h.lv) { hist[n] = { ...h, lv: d.level }; } }
    gravarJ(CHL, hist); G.vipLido = Date.now(); G.vipCarregando = false; render();
  }
  function abaVip() {
    const nomes = vipLista(), hist = lerJ(CHL, {}), hojeIso = hojeISO();
    const linhas = nomes.map((n) => {
      const d = G.vipDados[n]; if (!d) return `<tr><td><b>${esc(n)}</b></td><td colspan="5" class="muted">${G.vipCarregando ? 'buscando…' : '—'}</td><td><button type="button" class="del" data-vip-tirar="${esc(n)}" aria-label="Tirar ${esc(n)}">✕</button></td></tr>`;
      if (d.erro) return `<tr><td><b>${esc(n)}</b></td><td colspan="5" class="muted">${esc(d.erro)}</td><td><button type="button" class="del" data-vip-tirar="${esc(n)}" aria-label="Tirar ${esc(n)}">✕</button></td></tr>`;
      const on = G.vipOn[d.mundo]?.has(String(d.nome).toLowerCase()), h = hist[n], s = sigla(d.voc);
      const subiu = h && h.antes != null && d.level > h.antes ? `<span class="pos">▲ +${fmt(d.level - h.antes)}</span>` : h && h.antes != null && d.level < h.antes ? `<span class="neg">▼ ${fmt(d.level - h.antes)}</span>` : '';
      const mHoje = (d.mortes || []).filter((m) => String(m.time || '').slice(0, 10) >= hojeIso);
      const ultM = (d.mortes || [])[0];
      const morte = mHoje.length ? `<span class="neg" title="${esc(ultM.reason || '')}">💀 ${mHoje.length}x hoje</span>` : ultM ? `<small class="muted" title="${esc(ultM.reason || '')}">última: ${esc(new Date(ultM.time).toLocaleDateString('pt-BR'))}</small>` : '<small class="muted">nenhuma recente</small>';
      return `<tr><td><a href="${linkChar(d.nome)}" target="_blank" rel="noopener noreferrer"><b>${esc(d.nome)}</b></a></td><td><span class="gd-voc mini" style="--c:${COR[s] || '#64748b'}">${esc(s)}</span></td>
        <td class="num"><b>${fmt(d.level)}</b> ${subiu}</td><td>${on ? '<span class="pos">● online</span>' : '<span class="muted">offline</span>'}</td><td class="muted">${esc(d.mundo || '')}</td><td>${morte}</td>
        <td><button type="button" class="del" data-vip-tirar="${esc(n)}" aria-label="Tirar ${esc(n)} da lista">✕</button></td></tr>`;
    }).join('');
    const nOn = nomes.filter((n) => { const d = G.vipDados[n]; return d?.mundo && G.vipOn[d.mundo]?.has(String(d.nome).toLowerCase()); }).length;
    return `<div class="card"><form class="gd-busca" data-vip-form><label>Adicionar personagem<input name="n" maxlength="30" placeholder="nome do amigo ou rival" autocomplete="off"></label><button class="btn">+ Adicionar</button>${nomes.length ? '<button type="button" class="btn sec mini-btn" data-vip-atualizar>↻ Atualizar</button>' : ''}</form>
      ${nomes.length ? `<p class="muted">${fmt(nOn)} de ${fmt(nomes.length)} online agora${G.vipLido ? ` · lido ${new Date(G.vipLido).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : ''} · ▲ mostra quantos levels subiu desde o último dia em que você abriu a lista.</p>
        <div class="tabela-wrap"><table class="cm-tab"><tr><th>Personagem</th><th>Voc.</th><th class="num">Level</th><th>Status</th><th>Mundo</th><th>Mortes</th><th></th></tr>${linhas}</table></div>`
        : '<div class="bloqueio">⭐ Adicione amigos e rivais (até 30) para ver quem está online, quem upou e quem morreu hoje.</div>'}</div>
      <p class="dica">Dados públicos do <a href="https://www.tibia.com" target="_blank" rel="noopener noreferrer">www.tibia.com</a> (CipSoft) via TibiaData. A lista fica só neste aparelho.</p>`;
  }
  function render() {
    const el = $('#guild-app'); if (!el) return;
    const abas = `<div class="cm-abas" role="tablist">${[['guild', '🛡️ Guild'], ['vip', `⭐ Lista VIP (${vipLista().length})`]].map(([id, n]) => `<button type="button" role="tab" aria-selected="${G.aba === id}" class="chip ${G.aba === id ? 'ativo' : ''}" data-gd-aba="${id}">${n}</button>`).join('')}</div>`;
    if (G.aba === 'vip') { el.innerHTML = abas + abaVip(); return; }
    const busca = `<form class="gd-busca" data-gd-form><label>Guild<input name="g" maxlength="40" placeholder="nome da guild" value="${esc(G.nome || '')}" autocomplete="off"></label><button class="btn">Ver guild</button>${G.dados ? '<button type="button" class="btn sec mini-btn" data-gd-atualizar>↻ Atualizar</button>' : ''}</form>`;
    if (G.carregando && !G.dados) { el.innerHTML = abas + `<div class="card">${busca}<div class="bloqueio">Buscando a guild no Tibia.com…</div></div>`; return; }
    if (!G.dados) { el.innerHTML = abas + `<div class="card">${busca}<div class="bloqueio">${G.erro ? esc(G.erro) : '🛡️ Seu personagem não está em uma guild, ou ainda não colocamos o nome dele. Digite o nome de qualquer guild para acompanhar.'}</div></div>`; return; }
    const g = G.dados, ms = Array.isArray(g.members) ? g.members : [], on = ms.filter((m) => m.status === 'online');
    const lvlMed = ms.length ? Math.round(ms.reduce((t, m) => t + (m.level || 0), 0) / ms.length) : 0;
    const porVoc = {}; for (const m of ms) { const s = sigla(m.vocation); porVoc[s] = (porVoc[s] || 0) + 1; }
    const onVoc = {}; for (const m of on) { const s = sigla(m.vocation); onVoc[s] = (onVoc[s] || 0) + 1; }
    const q = G.busca.toLowerCase();
    let lista = G.filtro === 'online' ? on : ms; if (q) lista = lista.filter((m) => String(m.name).toLowerCase().includes(q));
    lista = [...lista].sort((a, b) => (b.level || 0) - (a.level || 0));
    const pag = typeof paginar === 'function' ? paginar('gd-tab', lista, 20, render) : lista;
    const meu = String(S.perfil?.personagem || '').toLowerCase();
    el.innerHTML = abas + `<div class="card gd-topo">${busca}
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

  const ligarTimer = () => { clearInterval(G.timer); G.timer = setInterval(() => { if (!$('#pag-guild')?.classList.contains('hidden') && !document.hidden) { if (G.aba === 'vip') carregarVip(); else if (G.nome) carregar(); } }, 180000); };
  document.addEventListener('click', (e) => {
    if (e.target.closest('#menu [data-pag=guild]')) { if (!G.dados && !G.carregando) carregar(); else render(); ligarTimer(); return; }
    if (e.target.closest('#guild-app [data-gd-atualizar]')) { carregar(true); return; }
    const ab = e.target.closest('#guild-app [data-gd-aba]'); if (ab) { G.aba = ab.dataset.gdAba === 'vip' ? 'vip' : 'guild'; if (G.aba === 'vip' && !G.vipLido) carregarVip(); else render(); return; }
    if (e.target.closest('#guild-app [data-vip-atualizar]')) { carregarVip(); return; }
    const tv = e.target.closest('#guild-app [data-vip-tirar]'); if (tv) { G.vip = vipLista().filter((n) => n !== tv.dataset.vipTirar); gravarJ(CHV, G.vip); delete G.vipDados[tv.dataset.vipTirar]; render(); return; }
    const f = e.target.closest('#guild-app [data-gd-filtro]'); if (f) { G.filtro = f.dataset.gdFiltro === 'todos' ? 'todos' : 'online'; if (typeof PG !== 'undefined') PG['gd-tab'] = 1; render(); }
  });
  document.addEventListener('submit', (e) => {
    const fv = e.target.closest('#guild-app [data-vip-form]');
    if (fv) { e.preventDefault(); const n = String(fv.n.value || '').trim().replace(/\s+/g, ' ').slice(0, 30);
      if (!NOME_OK.test(n)) { toast('Digite o nome do personagem (letras e espaço).'); return; }
      const l = vipLista(); if (l.some((x) => x.toLowerCase() === n.toLowerCase())) { toast('Esse personagem já está na lista.'); return; }
      if (l.length >= 30) { toast('A lista tem no máximo 30 personagens.'); return; }
      l.push(n); gravarJ(CHV, l); carregarVip(); return; }
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

// TibiaHub — NPCs: todos os NPCs com cidade, função e posição exata (TibiaWiki, CC BY-SA), o que cada um compra e vende
// e quantos itens do SEU inventário ele compra. Clicar abre o mapa (TibiaMaps.io, MIT) no lugar do NPC. Texto externo passa por esc().
(() => {
  const N = { lista: null, carregando: false, busca: '', cidade: '', so: 'meus', sel: null, aba: 'compra', vende: new Map(), pag: 1 };
  const POR_PAG = 24;

  async function carregar() {
    if (N.carregando) return; N.carregando = true; render();
    const out = [];
    for (let de = 0; de < 4000; de += 1000) {
      const { data, error } = await sb.from('npcs').select('nome,cidade,funcao,x,y,z').order('nome').range(de, de + 999);
      if (error) { N.carregando = false; return erro(error); }
      out.push(...(data || [])); if (!data || data.length < 1000) break;
    }
    // um cartão por NPC, com todos os lugares onde ele aparece (ex.: Rashid em 7 cidades)
    const por = new Map();
    for (const n of (typeof soRashidHoje === 'function' ? soRashidHoje(out) : out)) { const k = n.nome; const c = por.get(k) || { nome: k, funcao: n.funcao, lugares: [] }; c.lugares.push(n); if (!c.funcao && n.funcao) c.funcao = n.funcao; por.set(k, c); }
    N.lista = [...por.values()]; N.carregando = false;
    if (!S.invResumo && typeof carregarInvResumo === 'function') await carregarInvResumo();
    render();
  }

  // o que cada NPC compra (lista do Vender NPC) e quanto ele paga
  let compraCache = null;
  function compras() {
    if (compraCache && compraCache.n === (S.itens || []).length) return compraCache.m;
    const m = new Map(), add = (npc, item, preco) => { const l = m.get(npc) || new Map(); if (!l.has(item) || l.get(item) < preco) l.set(item, preco); m.set(npc, l); };
    for (const r of S.itens || []) {
      add(r.npc, r.item, r.preco);
      for (const parte of String(r.npcs || '').replace(/\|.*$/s, '').split(',').filter((x) => /^[A-Z][A-Za-z' .()-]*(:\s*\d+)?$/.test(x.trim()))) { const x = parte.trim().match(/^(.+?)(?::\s*(\d+))?$/); if (x && x[1]) add(x[1].trim(), r.item, x[2] ? +x[2] : r.preco); }
    }
    compraCache = { n: (S.itens || []).length, m }; return m;
  }
  function meus(npc) {
    const l = compras().get(npc); if (!l || !S.invResumo?.length) return { n: 0, v: 0, itens: [] };
    const itens = []; for (const x of S.invResumo) { const p = l.get(x.item) ?? [...l].find(([k]) => k.toLowerCase() === String(x.item).toLowerCase())?.[1]; if (p) itens.push({ item: x.item, qtd: x.qtd, preco: p, v: p * x.qtd }); }
    return { n: itens.reduce((t, i) => t + i.qtd, 0), t: itens.length, v: itens.reduce((t, i) => t + i.v, 0), itens: itens.sort((a, b) => b.v - a.v) };
  }

  // imagem animada do NPC na TibiaWiki (o mesmo arquivo que a wiki usa no quadro do NPC); sem imagem, mostra um ícone
  const foto = (nome, tam = '') => (typeof imgAnimada === 'function' && typeof urlItemWiki === 'function' ? imgAnimada(urlItemWiki(nome), '', nome, `npc-sprite ${tam}`, '🧑') : '🧑');
  function cartao(c) {
    const mi = meus(c.nome), cid = [...new Set(c.lugares.map((l) => l.cidade).filter(Boolean))];
    return `<button type="button" class="npc-card ${N.sel === c.nome ? 'ativo' : ''}" data-npc-sel="${esc(c.nome)}">
      <span class="npc-cab">${foto(c.nome)}<span class="npc-txt"><span class="npc-nome">${esc(c.nome)}</span><small class="muted">${esc(c.funcao || 'NPC')}${cid.length ? ` · ${esc(cid.length > 2 ? `${cid.slice(0, 2).join(', ')} +${cid.length - 2}` : cid.join(', '))}` : ''}</small></span></span>
      ${mi.n ? `<span class="npc-meus">🎒 ${fmt(mi.n)} ite${mi.n > 1 ? 'ns' : 'm'} seu${mi.n > 1 ? 's' : ''}${mi.t > 1 ? ` (${fmt(mi.t)} tipos)` : ''} · ${fmtC(mi.v)}</span>` : compras().has(c.nome) ? `<small class="muted">compra ${fmt(compras().get(c.nome).size)} itens</small>` : ''}</button>`;
  }

  async function detalhe() {
    const c = N.lista?.find((x) => x.nome === N.sel); if (!c) return '';
    if (!N.vende.has(c.nome)) { N.vende.set(c.nome, null); sb.rpc('npc_vende', { p_npc: c.nome }).then(({ data }) => { N.vende.set(c.nome, data || []); render(); }); }
    const compra = [...(compras().get(c.nome) || new Map())].sort((a, b) => b[1] - a[1]), vende = N.vende.get(c.nome), mi = meus(c.nome);
    const tem = new Map((S.invResumo || []).map((x) => [String(x.item).toLowerCase(), x.qtd]));
    const linha = (item, preco, extra = '') => { const q = tem.get(String(item).toLowerCase()); return `<li class="${q ? 'tenho' : ''}"><span class="item-nome">${imgDoItem(item)}${esc(item)}</span><b>${preco ? fmt(preco) : '—'}</b>${q ? `<small class="pos">você tem ${fmt(q)}</small>` : extra}</li>`; };
    const lista = N.aba === 'compra' ? (compra.length ? compra.map(([i, p]) => linha(i, p)).join('') : '<li class="muted">Este NPC não compra itens (ou ainda não está na lista).</li>')
      : vende == null ? '<li class="muted">Carregando o que ele vende…</li>' : vende.length ? vende.map((x) => linha(x.item, x.preco, x.tipo ? `<small class="muted">${esc(x.tipo)}</small>` : '')).join('') : '<li class="muted">Este NPC não vende itens (ou a lista ainda está chegando da TibiaWiki).</li>';
    return `<aside class="card npc-det" aria-label="${esc(c.nome)}">
      <div class="npc-det-cab"><div class="npc-det-id">${foto(c.nome, 'grande')}<h3>${esc(c.nome)}</h3></div><button type="button" class="del" data-npc-fechar aria-label="Fechar">✕</button></div>
      <p class="muted">${esc(c.funcao || 'NPC')}</p>
      ${c.nome === 'Rashid' && typeof rashidHoje === 'function' ? `<p class="muted npc-rashid">🧳 Hoje o Rashid está em <b>${esc(rashidHoje())}</b>. Ele muda de cidade todo dia no server save.</p>` : ''}
      <div class="npc-lugares">${c.lugares.map((l, k) => `<button type="button" class="btn sec mini-btn" data-npc-mapa="${k}">📍 ${esc(l.cidade || 'Ver no mapa')} <small class="muted">${l.x}, ${l.y}, ${l.z}</small></button>`).join('')}</div>
      ${mi.n ? `<div class="npc-meus-box"><b>🎒 Ele compra ${fmt(mi.n)} ite${mi.n > 1 ? 'ns' : 'm'} do seu inventário${mi.t > 1 ? ` (${fmt(mi.t)} tipos)` : ''}: ${fmt(mi.v)} gp</b><button type="button" class="link" data-npc-inv>ver no inventário</button></div>` : ''}
      <div class="cm-abas" role="tablist"><button type="button" role="tab" class="chip ${N.aba === 'compra' ? 'ativo' : ''}" aria-selected="${N.aba === 'compra'}" data-npc-aba="compra">💰 Compra (${fmt(compra.length)})</button><button type="button" role="tab" class="chip ${N.aba === 'vende' ? 'ativo' : ''}" aria-selected="${N.aba === 'vende'}" data-npc-aba="vende">🛒 Vende${vende ? ` (${fmt(vende.length)})` : ''}</button></div>
      <ul class="npc-itens">${lista}</ul>
      <p class="dica">Preços e listas: TibiaWiki (CC BY-SA). ${N.aba === 'compra' ? 'Preço que ele paga.' : 'Preço que ele cobra.'}</p></aside>`;
  }

  async function render() {
    const el = $('#npcs-app'); if (!el) return;
    if (!N.lista) { el.innerHTML = '<div class="card"><div class="bloqueio">Carregando NPCs…</div></div>'; if (!N.carregando) carregar(); return; }
    const q = N.busca.toLowerCase(), cidades = [...new Set(N.lista.flatMap((c) => c.lugares.map((l) => l.cidade)).filter(Boolean))].sort();
    let lista = N.lista.filter((c) => (!q || c.nome.toLowerCase().includes(q) || String(c.funcao || '').toLowerCase().includes(q)) && (!N.cidade || c.lugares.some((l) => l.cidade === N.cidade)));
    if (N.so === 'meus') lista = lista.filter((c) => meus(c.nome).n);
    else if (N.so === 'compram') lista = lista.filter((c) => compras().has(c.nome));
    lista.sort((a, b) => (N.so === 'meus' ? meus(b.nome).v - meus(a.nome).v : 0) || a.nome.localeCompare(b.nome));
    const paginas = Math.max(1, Math.ceil(lista.length / POR_PAG)); N.pag = Math.min(Math.max(1, N.pag), paginas);
    const pag = lista.slice((N.pag - 1) * POR_PAG, N.pag * POR_PAG);
    const semInv = N.so === 'meus' && !S.invResumo?.length;
    el.innerHTML = `<div class="card npc-topo"><div class="npc-filtros">
        <input type="search" data-npc-busca placeholder="Buscar NPC ou função (ex: Rashid, banker)…" value="${esc(N.busca)}" maxlength="40" aria-label="Buscar NPC">
        <select data-npc-cidade aria-label="Cidade"><option value="">Todas as cidades</option>${cidades.map((c) => `<option ${c === N.cidade ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></div>
        <div class="cm-abas" role="tablist">${[['meus', '🎒 Compram meus itens'], ['compram', '💰 Todos que compram'], ['todos', '🧑 Todos os NPCs']].map(([k, t]) => `<button type="button" role="tab" class="chip ${N.so === k ? 'ativo' : ''}" aria-selected="${N.so === k}" data-npc-so="${k}">${t}</button>`).join('')}</div></div>
      <div class="npc-grid ${N.sel ? 'com-det' : ''}"><div>
        ${pag.length ? `<div class="npc-cards">${pag.map(cartao).join('')}</div>` : `<div class="card"><div class="bloqueio">${semInv ? 'Seu inventário está vazio: salve hunts pelo leitor do Hunt Analyzer para ver quais NPCs compram o seu loot.' : 'Nenhum NPC encontrado.'}</div></div>`}
        ${paginas > 1 ? `<nav class="paginacao" aria-label="Páginas"><button type="button" data-npc-pag="${N.pag - 1}" ${N.pag <= 1 ? 'disabled' : ''} aria-label="Página anterior">‹</button><span class="pg-reticencias">${N.pag} de ${paginas}</span><button type="button" data-npc-pag="${N.pag + 1}" ${N.pag >= paginas ? 'disabled' : ''} aria-label="Próxima página">›</button><span class="pg-info">${fmt(lista.length)} NPCs</span></nav>` : ''}
      </div>${N.sel ? await detalhe() : ''}</div>
      <p class="dica">NPCs, posições e listas de compra e venda: <a href="https://tibia.fandom.com" target="_blank" rel="noopener noreferrer">TibiaWiki</a> (CC BY-SA). Mapa: TibiaMaps.io (MIT).</p>`;
  }

  document.addEventListener('click', (e) => {
    if (e.target.closest('#menu [data-pag=npcs]')) { render(); return; }
    const box = e.target.closest('#npcs-app'); if (!box) return;
    const s = e.target.closest('[data-npc-sel]'); if (s) { N.sel = s.dataset.npcSel; N.aba = 'compra'; render().then(() => $('#npcs-app .npc-det')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })); return; }
    if (e.target.closest('[data-npc-fechar]')) { N.sel = null; render(); return; }
    const so = e.target.closest('[data-npc-so]'); if (so) { N.so = so.dataset.npcSo; N.pag = 1; render(); return; }
    const ab = e.target.closest('[data-npc-aba]'); if (ab) { N.aba = ab.dataset.npcAba === 'vende' ? 'vende' : 'compra'; render(); return; }
    const pg = e.target.closest('[data-npc-pag]'); if (pg && !pg.disabled) { N.pag = +pg.dataset.npcPag || 1; render(); return; }
    const mp = e.target.closest('[data-npc-mapa]'); if (mp) { const c = N.lista.find((x) => x.nome === N.sel), l = c?.lugares[+mp.dataset.npcMapa]; if (l && window.abrirMapaNpc) window.abrirMapaNpc(l); return; }
    if (e.target.closest('[data-npc-inv]') && window.inventarioPorNpc) window.inventarioPorNpc(N.sel);
  });
  document.addEventListener('change', (e) => { const c = e.target.closest?.('#npcs-app [data-npc-cidade]'); if (c) { N.cidade = String(c.value).slice(0, 60); N.pag = 1; render(); } });
  let tb = null;
  document.addEventListener('input', (e) => {
    const b = e.target.closest?.('#npcs-app [data-npc-busca]'); if (!b) return;
    clearTimeout(tb); tb = setTimeout(async () => { N.busca = b.value.slice(0, 40); N.pag = 1; if (N.busca && N.so === 'meus') N.so = 'todos'; await render(); const i = $('#npcs-app [data-npc-busca]'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }, 250);
  });
  window.addEventListener('inventario-mudou', () => { if (N.lista) setTimeout(render, 600); });
})();

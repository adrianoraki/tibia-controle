// TibiaHub — Ferramentas: imbuements por item, calculadora de imbuements, divisão de loot da party e timers do dia.
// Preços digitados ficam só neste navegador (localStorage). Todo texto de fora passa por esc().
(() => {
  const F = { aba: 'poritem', imbs: null, sel: null, party: null, timers: null, itens: null, cat: 'capacete', voc: '', busca: '', soComEspaco: true, item: null, limite: 48 };
  // taxas cobradas no shrine (desde o fim da chance de falha todo imbuement é 100%); ficam editáveis
  const TAXA = { Basic: 7500, Intricate: 60000, Powerful: 250000 }, TOKENS = { Basic: 2, Intricate: 4, Powerful: 6 }, HORAS = 20;
  const ler = (k, padrao) => { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? padrao; } catch { return padrao; } };
  const gravar = (k, v) => {
    try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ok */ }
    // VIP: guarda também na conta, para abrir igual em qualquer aparelho
    if (k === 'tc_imb_precos' || k === 'tc_imb_conf' || k === 'tc_imb_favs') salvarNaConta('imbuements', { precos: ler('tc_imb_precos', {}), conf: ler('tc_imb_conf', {}), favs: ler('tc_imb_favs', []) });
    else if (k === 'tc_party') salvarNaConta('party', v);
    else if (k === 'tc_timers') salvarNaConta('timers', v);
  };
  // ao abrir: o que está guardado na conta (VIP) vale mais que o deste navegador
  let puxouConta = false;
  function puxarDaConta() {
    if (puxouConta || !premium() || !S.dadosConta) return; puxouConta = true;
    const d = S.dadosConta, obj = (x) => x && typeof x === 'object' && !Array.isArray(x);
    try {
      if (obj(d.imbuements)) { if (obj(d.imbuements.precos)) localStorage.setItem('tc_imb_precos', JSON.stringify(d.imbuements.precos)); if (obj(d.imbuements.conf)) localStorage.setItem('tc_imb_conf', JSON.stringify(d.imbuements.conf)); if (Array.isArray(d.imbuements.favs)) localStorage.setItem('tc_imb_favs', JSON.stringify(d.imbuements.favs.filter((x) => typeof x === 'string').slice(0, 72))); }
      if (obj(d.party) && Array.isArray(d.party.jogadores)) { localStorage.setItem('tc_party', JSON.stringify(d.party)); F.party = null; }
      if (Array.isArray(d.timers)) { localStorage.setItem('tc_timers', JSON.stringify(d.timers.filter((t) => t && typeof t.nome === 'string' && Number.isFinite(t.fim)).slice(0, 50))); F.timers = null; }
    } catch { /* ok */ }
  }
  const precos = () => ler('tc_imb_precos', {});
  const favs = () => { const f = ler('tc_imb_favs', []); return Array.isArray(f) ? f.filter((x) => typeof x === 'string') : []; };

  // custo de um imbuement com os preços que o jogador anotou (o mais barato entre materiais e Gold Tokens, mais a taxa do shrine)
  // usado pelo Oráculo IA ("Custo do seu set"). Devolve { total, porHora, via } ou null se faltar preço.
  window.custoImbTH = (im) => {
    if (!im || !TAXA[im.nivel]) return null;
    const p = precos(), conf = ler('tc_imb_conf', {}), taxa = conf['taxa_' + im.nivel] ?? TAXA[im.nivel], token = conf.token ?? null;
    const mats = Array.isArray(im.materiais) ? im.materiais : [], falta = !mats.length || mats.some((m) => p[m.item] == null);
    const totMat = falta ? null : mats.reduce((t, m) => t + p[m.item] * m.qtd, 0), totTok = token != null ? token * TOKENS[im.nivel] : null;
    const base = totMat == null ? totTok : totTok == null ? totMat : Math.min(totMat, totTok); if (base == null) return null;
    return { total: base + taxa, porHora: (base + taxa) / HORAS, via: totTok != null && base === totTok ? 'tokens' : 'materiais' };
  };
  async function carregarImbs() {
    const { data, error } = await sb.from('imbuements').select('nome,tipo,nivel,categoria,efeito,slots,materiais').order('tipo').order('nome');
    if (error) return erro(error);
    F.imbs = data || []; F.sel = F.sel || F.imbs.find((i) => i.nome === 'Powerful Strike')?.nome || F.imbs[0]?.nome || null; render();
  }

  // ---------- imbuements ----------
  function abaImbuements() {
    if (!F.imbs) { carregarImbs(); return '<div class="bloqueio">Carregando imbuements…</div>'; }
    if (!F.imbs.length) return '<div class="bloqueio">A lista de imbuements da TibiaWiki ainda está chegando. Volte em alguns minutos.</div>';
    const tipos = [...new Set(F.imbs.map((i) => i.tipo))];
    const im = F.imbs.find((i) => i.nome === F.sel) || F.imbs[0], p = precos(), conf = ler('tc_imb_conf', {});
    const taxa = conf['taxa_' + im.nivel] ?? TAXA[im.nivel], token = conf.token ?? null;
    const mats = (im.materiais || []).map((m) => ({ ...m, preco: p[m.item] ?? null }));
    const faltaPreco = mats.some((m) => m.preco == null);
    const totMat = mats.reduce((t, m) => t + (m.preco || 0) * m.qtd, 0), totTok = token != null ? token * TOKENS[im.nivel] : null;
    const melhor = token != null && !faltaPreco ? (totTok < totMat ? 'token' : 'mat') : null;
    const custo = (melhor === 'token' ? totTok : totMat) + taxa;
    return `<div class="fr-grid"><div class="fr-col">
        <div class="fr-imb-sel"><label class="fr-campo">Imbuement<select data-fr="imb">${favs().length ? `<optgroup label="⭐ Favoritos">${favs().filter((n) => F.imbs.some((i) => i.nome === n)).map((n) => `<option value="${esc(n)}">⭐ ${esc(n)}</option>`).join('')}</optgroup>` : ''}${tipos.map((t) => `<optgroup label="${esc(t)}">${F.imbs.filter((i) => i.tipo === t).map((i) => `<option value="${esc(i.nome)}" ${i.nome === im.nome ? 'selected' : ''}>${esc(i.nome)}</option>`).join('')}</optgroup>`).join('')}</select></label><button type="button" class="fr-estrela ${favs().includes(im.nome) ? 'on' : ''}" data-fr-fav="${esc(im.nome)}" title="${favs().includes(im.nome) ? 'Tirar dos favoritos' : 'Favoritar'}" aria-pressed="${favs().includes(im.nome)}" aria-label="Favoritar ${esc(im.nome)}">${favs().includes(im.nome) ? '★' : '☆'}</button></div>
        <div class="fr-info"><b>${esc(im.nome)}</b><span class="muted">${esc(im.categoria || '')}${im.efeito ? ' · ' + esc(im.efeito) : ''}</span>${im.slots ? `<small class="muted">Serve em: ${esc(im.slots)}</small>` : ''}</div>
        <table class="fr-tab"><tr><th>Material</th><th class="num">Qtd</th><th class="num">Preço no Market (un.)</th><th class="num">Total</th></tr>
          ${mats.map((m) => `<tr><td>${esc(m.item)}</td><td class="num">${fmt(m.qtd)}</td><td class="num"><input class="qtd" data-fr-preco="${esc(m.item)}" data-gold data-sem-dica placeholder="ex: 2.5k" value="${m.preco != null ? fmt(m.preco) : ''}"></td><td class="num">${m.preco != null ? fmt(m.preco * m.qtd) : '—'}</td></tr>`).join('')}
          <tr class="fr-soma"><td colspan="3">Materiais</td><td class="num"><b>${faltaPreco ? '—' : fmt(totMat)}</b></td></tr></table>
        <div class="fr-linha"><label class="fr-campo">Gold Token (preço no Market)<input data-fr="token" data-gold data-sem-dica placeholder="ex: 40k" value="${token != null ? fmt(token) : ''}"></label>
          <label class="fr-campo">Taxa do shrine (${esc(im.nivel)})<input data-fr="taxa" data-gold data-sem-dica value="${fmt(taxa)}"></label></div>
      </div>
      <div class="fr-col fr-resumo">
        <div class="fr-opcao ${melhor === 'mat' ? 'melhor' : ''}"><span>Com materiais</span><b>${faltaPreco ? 'preencha os preços' : fmt(totMat + taxa)}</b>${melhor === 'mat' ? '<em>mais barato</em>' : ''}</div>
        <div class="fr-opcao ${melhor === 'token' ? 'melhor' : ''}"><span>Com ${TOKENS[im.nivel]} Gold Tokens</span><b>${totTok != null ? fmt(totTok + taxa) : 'informe o preço do token'}</b>${melhor === 'token' ? '<em>mais barato</em>' : ''}</div>
        ${!faltaPreco || totTok != null ? `<div class="fr-total"><span>Custo por hora de hunt</span><b>${fmt(custo / HORAS)} gp/h</b><small class="muted">o imbuement dura ${HORAS} horas de uso</small></div>` : ''}
        <p class="dica">A taxa do shrine vem preenchida com o valor atual (Basic 7.500 · Intricate 60.000 · Powerful 250.000) e pode ser corrigida. Os preços que você digitar ficam salvos e valem para todos os imbuements que usam o mesmo material. Lista de imbuements e materiais: TibiaWiki (CC BY-SA).</p>
      </div></div>`;
  }

  // ---------- favoritos: os imbuements marcados com a estrela, com o custo pelos preços que você anotou ----------
  function abaFavoritos() {
    if (!F.imbs) { carregarImbs(); return '<div class="bloqueio">Carregando imbuements…</div>'; }
    const lista = favs().map((n) => F.imbs.find((i) => i.nome === n)).filter(Boolean);
    if (!lista.length) return '<div class="bloqueio">Nenhum favorito ainda. Na aba 🛡️ Imbuements por item ou na ✨ Calculadora, clique na estrela ☆ para guardar aqui.</div>';
    const p = precos(), conf = ler('tc_imb_conf', {});
    return `<div class="fr-fav-grade">${lista.map((im) => {
      const mats = (im.materiais || []), falta = mats.some((m) => p[m.item] == null), taxa = conf['taxa_' + im.nivel] ?? TAXA[im.nivel];
      const totMat = mats.reduce((t, m) => t + (p[m.item] || 0) * m.qtd, 0), tok = conf.token != null ? conf.token * TOKENS[im.nivel] : null;
      const custo = falta ? tok : tok != null ? Math.min(totMat, tok) : totMat;
      return `<div class="fr-fav-card"><div class="fr-fav-cab"><b>${esc(im.nome)}</b><button type="button" class="fr-estrela on mini" data-fr-fav="${esc(im.nome)}" title="Tirar dos favoritos" aria-label="Tirar ${esc(im.nome)} dos favoritos">★</button></div>` +
        `<small class="muted">${esc(im.categoria || '')}${im.efeito ? ' · ' + esc(im.efeito) : ''}</small>` +
        `<small>${mats.map((m) => `${fmt(m.qtd)}× ${esc(m.item)}`).join(' · ')}</small>` +
        `<div class="fr-fav-pe"><span>${custo != null ? `<b>${fmt(custo + taxa)}</b> gp · ${fmt((custo + taxa) / HORAS)}/h` : '<span class="muted">preencha os preços</span>'}</span><button type="button" class="btn sec mini-btn" data-fr-fav-ir="${esc(im.nome)}">Abrir</button></div></div>`;
    }).join('')}</div><p class="dica">O custo usa os preços que você anotou na aba Imbuements (o mais barato entre materiais e Gold Tokens, com a taxa do shrine).</p>`;
  }


  // ---------- imbuements por item: escolhe o equipamento e vê o que dá para colocar nele ----------
  const CATS = [
    ['capacete', 'Capacetes', 'Helmets', '⛑️'], ['armadura', 'Armaduras', 'Armors', '🥋'], ['escudo', 'Escudos', 'Shields', '🛡️'],
    ['spellbook', 'Spellbooks', 'Spellbooks', '📘'], ['botas', 'Botas', 'Boots', '👢'], ['espada', 'Espadas', 'Sword Weapons', '🗡️'],
    ['machado', 'Machados', 'Axe Weapons', '🪓'], ['clava', 'Clavas', 'Club Weapons', '🔨'], ['distancia', 'Distância', 'Distance Weapons', '🏹'],
    ['wand', 'Wands', 'Wands', '🪄'], ['rod', 'Rods', 'Rods', '🌿'], ['punhos', 'Punhos', 'Fist Fighting Weapons', '👊'], ['mochila', 'Mochilas', 'Containers', '🎒'],
  ];
  const CHAVE = { capacete: 'helmets', armadura: 'armors', escudo: 'shields', spellbook: 'spellbooks', botas: 'boots', espada: 'swords', machado: 'axes', clava: 'clubs', wand: 'wands', rod: 'rods', punhos: 'fists', mochila: 'containers' };
  const VOCS = [['', 'Todas'], ['knight', 'Knight'], ['paladin', 'Paladin'], ['sorcerer', 'Sorcerer'], ['druid', 'Druid'], ['monk', 'Monk']];
  const PT = {
    Chop: ['Machado', (v) => `+${v} axe fighting`], Bash: ['Clava', (v) => `+${v} club fighting`], Slash: ['Espada', (v) => `+${v} sword fighting`],
    Punch: ['Punhos', (v) => `+${v} fist fighting`], Precision: ['Distância', (v) => `+${v} distance fighting`], Epiphany: ['Magic level', (v) => `+${v} magic level`],
    Blockade: ['Escudo', (v) => `+${v} shielding`], Featherweight: ['Capacidade', (v) => `+${v} de capacidade`], Strike: ['Crítico', (v) => `+${v} de dano crítico`],
    Vampirism: ['Roubo de vida', (v) => `rouba ${v} de vida`], Void: ['Roubo de mana', (v) => `rouba ${v} de mana`], Vibrancy: ['Anti-paralisia', (v) => `${v} de chance de anular paralyze`],
    Swiftness: ['Velocidade', (v) => `+${v} de speed`],
    'Lich Shroud': ['Proteção death', (v) => `-${v} de dano death`], 'Snake Skin': ['Proteção earth', (v) => `-${v} de dano earth`], 'Cloud Fabric': ['Proteção energy', (v) => `-${v} de dano energy`],
    'Dragon Hide': ['Proteção fire', (v) => `-${v} de dano fire`], 'Demon Presence': ['Proteção holy', (v) => `-${v} de dano holy`], 'Quara Scale': ['Proteção ice', (v) => `-${v} de dano ice`],
    Reap: ['Dano death', (v) => `${v} do dano vira death`], Venom: ['Dano earth', (v) => `${v} do dano vira earth`], Electrify: ['Dano energy', (v) => `${v} do dano vira energy`],
    Scorch: ['Dano fire', (v) => `${v} do dano vira fire`], Frost: ['Dano ice', (v) => `${v} do dano vira ice`],
  };
  const COR = { Proteção: '#0ea5e9', Dano: '#ef4444', Roubo: '#a855f7' };
  const corDe = (pt) => COR[Object.keys(COR).find((k) => pt.startsWith(k))] || '#d4a94a';
  const valorDe = (ef) => String(ef || '').split(':')[1]?.split('·')[0]?.trim() || '';
  const NIVEIS = ['Basic', 'Intricate', 'Powerful'];

  async function carregarItens() {
    const tipos = CATS.map((c) => c[2]);
    const { data, error } = await sb.from('itens_equip').select('nome,tipo,level,vocacoes,armor,atributos,imbue_slots').in('tipo', tipos).order('nome').limit(3000);
    if (error) return erro(error);
    F.itens = (data || []).map((i) => ({ ...i, cat: CATS.find((c) => c[2] === i.tipo)?.[0] })); render();
  }
  function chaveDoItem(i) {
    if (i.cat !== 'distancia') return CHAVE[i.cat];
    return /crossbow/i.test(i.nome) ? 'crossbows' : /bow\b/i.test(i.nome) ? 'bows' : null;
  }
  // imbuements que cabem no item (a lista "Serve em" da TibiaWiki, com o caso dos capacetes de mage)
  function compativeis(i) {
    const k = chaveDoItem(i); if (!k || !F.imbs) return [];
    const voc = String(i.vocacoes || '').toLowerCase();
    return F.imbs.filter((im) => String(im.slots || '').split(',').some((t) => {
      const m = t.trim().toLowerCase().match(/^([a-z ]+?)\s*(?:\(([a-z]+)\))?$/); if (!m || m[1] !== k) return false;
      return !m[2] || voc.includes(m[2]);
    }));
  }
  const pontos = (n) => n == null ? '<span class="fr-esp muted" title="Ainda conferindo">…</span>' : `<span class="fr-esp" title="${n} ${n === 1 ? 'espaço' : 'espaços'} de imbuement">${[0, 1, 2].map((x) => `<i class="${x < n ? 'on' : ''}"></i>`).join('')}</span>`;

  function abaPorItem() {
    if (!F.imbs) { carregarImbs(); return '<div class="bloqueio">Carregando imbuements…</div>'; }
    if (!F.itens) { carregarItens(); return '<div class="bloqueio">Carregando equipamentos…</div>'; }
    const q = F.busca.trim().toLowerCase(), conferindo = F.itens.some((i) => i.imbue_slots == null);
    let lista = F.itens.filter((i) => (q ? i.nome.toLowerCase().includes(q) : i.cat === F.cat));
    if (F.voc) lista = lista.filter((i) => !i.vocacoes || i.vocacoes.toLowerCase().includes(F.voc));
    if (F.soComEspaco) lista = lista.filter((i) => i.imbue_slots == null || i.imbue_slots > 0);
    lista.sort((a, b) => (b.imbue_slots || 0) - (a.imbue_slots || 0) || (b.level || 0) - (a.level || 0) || a.nome.localeCompare(b.nome));
    const it = F.itens.find((i) => i.nome === F.item) || lista[0] || null;
    const vis = lista.slice(0, F.limite);
    return `<div class="fr-pi">
      <div class="fr-pi-cats" role="tablist">${CATS.map(([k, t, , ico]) => `<button type="button" data-fr-cat="${k}" class="${!q && F.cat === k ? 'ativo' : ''}"><span>${ico}</span>${t}</button>`).join('')}</div>
      <div class="fr-pi-filtros"><input type="search" data-fr="busca" placeholder="Buscar qualquer item (ex.: falcon, soulshell)…" value="${esc(F.busca)}" maxlength="40">
        <div class="fr-pi-vocs">${VOCS.map(([v, t]) => `<button type="button" class="chip ${F.voc === v ? 'ativo' : ''}" data-fr-voc="${v}">${t}</button>`).join('')}</div>
        <label class="fr-pi-chk"><input type="checkbox" data-fr="espaco" ${F.soComEspaco ? 'checked' : ''}> Só itens com espaço de imbuement</label></div>
      ${conferindo ? '<p class="dica">Estamos conferindo quantos espaços de imbuement cada item tem. Os itens ainda não conferidos aparecem com … no lugar dos espaços.</p>' : ''}
      <div class="fr-pi-grid">
        <div class="fr-pi-lista">${vis.length ? vis.map((i) => `<button type="button" class="fr-pi-item ${it && i.nome === it.nome ? 'ativo' : ''}" data-fr-item="${esc(i.nome)}">${imgDoItem(i.nome)}<span class="fr-pi-nome">${esc(i.nome)}<small>${i.level ? `lvl ${fmt(i.level)}` : 'sem level'}${i.vocacoes ? ` · ${esc(i.vocacoes)}` : ''}</small></span>${pontos(i.imbue_slots)}</button>`).join('') : '<div class="bloqueio">Nenhum item encontrado.</div>'}
          ${lista.length > vis.length ? `<button type="button" class="btn btn-sec fr-pi-mais" data-fr-mais>Mostrar mais (${fmt(lista.length - vis.length)})</button>` : ''}</div>
        <div class="fr-pi-det">${it ? detalheItem(it) : ''}</div>
      </div></div>`;
  }
  function detalheItem(i) {
    const comp = compativeis(i), grupos = new Map();
    for (const im of comp) { if (!grupos.has(im.tipo)) grupos.set(im.tipo, []); grupos.get(im.tipo).push(im); }
    const cards = [...grupos.entries()].map(([tipo, ims]) => {
      const pt = PT[tipo] || [tipo, (v) => v], pw = ims.find((x) => x.nivel === 'Powerful') || ims.at(-1), fav = favs().includes(pw.nome);
      return `<div class="fr-pi-imb" style="--c:${corDe(pt[0])}"><div class="fr-pi-imb-cab"><b>${esc(tipo)}</b><span class="fr-pi-tag">${esc(pt[0])}</span>
          <button type="button" class="fr-estrela mini ${fav ? 'on' : ''}" data-fr-fav="${esc(pw.nome)}" title="${fav ? 'Tirar dos favoritos' : 'Favoritar o Powerful'}" aria-label="Favoritar ${esc(pw.nome)}">${fav ? '★' : '☆'}</button></div>
        <div class="fr-pi-niveis">${NIVEIS.map((n) => { const x = ims.find((y) => y.nivel === n); return x ? `<button type="button" class="fr-pi-nv" data-fr-fav-ir="${esc(x.nome)}" title="Calcular o custo do ${esc(x.nome)}"><small>${n}</small><b>${esc(pt[1](valorDe(x.efeito)))}</b></button>` : ''; }).join('')}</div></div>`;
    }).join('');
    const esp = i.imbue_slots;
    return `<div class="fr-pi-topo">${imgDoItem(i.nome, 'grande')}<div><h3>${esc(i.nome)}</h3>
        <small class="muted">${esc(i.tipo)}${i.level ? ` · level ${fmt(i.level)}` : ''}${i.vocacoes ? ` · ${esc(i.vocacoes)}` : ''}${i.armor ? ` · arm/def ${fmt(i.armor)}` : ''}</small>
        ${i.atributos ? `<small>${esc(i.atributos)}</small>` : ''}
        <div class="fr-pi-esp">${pontos(esp)}<span>${esp == null ? 'conferindo espaços…' : esp ? `${esp} ${esp === 1 ? 'espaço' : 'espaços'} de imbuement` : 'sem espaço de imbuement'}</span></div></div></div>
      ${esp === 0 ? '<p class="muted">Este item não aceita imbuements.</p>' : comp.length ? `<div class="fr-pi-imbs">${cards}</div><p class="dica">Clique num nível para calcular o custo com materiais ou Gold Tokens. Cada espaço recebe um imbuement diferente.</p>` : '<p class="muted">Nenhum imbuement serve neste tipo de item.</p>'}`;
  }

  // ---------- divisão de loot ----------

  // lê o texto do Party Hunt Analyser (Copy to clipboard): nome do jogador numa linha, depois "Loot:" e "Supplies:" com recuo
  function lerPartyTexto(txt) {
    const linhas = String(txt || '').replace(/\r/g, '').split('\n').slice(0, 400), out = [];
    let atual = null, cab = true;
    const numero = (v) => { const n = parseInt(String(v).replace(/[^\d-]/g, ''), 10); return Number.isFinite(n) ? n : null; };
    for (const bruta of linhas) {
      const l = bruta.trim(); if (!l) continue;
      const kv = l.match(/^(Loot|Supplies|Balance|Damage|Healing)\s*:\s*(-?[\d,.]+)/i);
      if (kv) { if (atual) { if (/loot/i.test(kv[1])) atual.loot = numero(kv[2]); else if (/supplies/i.test(kv[1])) atual.gasto = numero(kv[2]); } continue; }
      if (/^(Session data|Session|Loot Type)\s*:/i.test(l)) continue;
      if (/^\s/.test(bruta) && atual) continue;
      const nome = l.replace(/\s*\(Leader\)\s*$/i, '').trim();
      if (/^[A-Za-z][A-Za-z '\-.]{1,29}$/.test(nome)) { cab = false; atual = { nome, loot: null, gasto: null }; out.push(atual); }
    }
    return cab ? [] : out.filter((j) => j.loot != null || j.gasto != null).slice(0, 10);
  }
  function abaParty() {
    const pt = F.party || (F.party = ler('tc_party', { jogadores: [{ nome: '', loot: null, gasto: null }, { nome: '', loot: null, gasto: null }] }));
    const js = pt.jogadores, total = js.reduce((t, j) => t + (j.loot || 0) - (j.gasto || 0), 0), n = js.length, parte = n ? total / n : 0;
    // cada um deve terminar com: o que gastou + a parte do lucro. Saldo = (loot - gasto) - parte
    const saldos = js.map((j, i) => ({ i, nome: j.nome || `Jogador ${i + 1}`, s: Math.round((j.loot || 0) - (j.gasto || 0) - parte) }));
    const dev = saldos.filter((x) => x.s > 0).map((x) => ({ ...x })), rec = saldos.filter((x) => x.s < 0).map((x) => ({ ...x, s: -x.s })), tr = [];
    dev.sort((a, b) => b.s - a.s); rec.sort((a, b) => b.s - a.s);
    for (const d of dev) for (const r of rec) { if (!d.s) break; const v = Math.min(d.s, r.s); if (v > 0) { tr.push({ de: d.nome, para: r.nome, v }); d.s -= v; r.s -= v; } }
    return `<details class="fr-colar" ${js.some((j) => j.loot != null) ? '' : 'open'}><summary>📋 Colar o Party Hunt Analyser do jogo</summary>
      <p class="muted">No jogo, abra o <b>Party Hunt Analyser</b> e clique em <b>Copy to clipboard</b>. Cole aqui e o site preenche os jogadores sozinho. O texto é lido só no seu aparelho.</p>
      <textarea data-fr-party-txt rows="5" maxlength="20000" placeholder="Session data: From ...&#10;Loot Type: Leader&#10;Jogador (Leader)&#10;    Loot: 1,200,000&#10;    Supplies: 300,000"></textarea>
      <button type="button" class="btn mini-btn" data-fr-party-ler>Ler e dividir</button></details>
    <div class="fr-grid"><div class="fr-col"><p class="muted">Digite quanto de loot cada um está segurando e quanto gastou de supplies (Party Hunt Analyser). O site divide o lucro em partes iguais e diz quem transfere para quem.</p>
      <div class="fr-rolar"><table class="fr-tab"><tr><th>Jogador</th><th class="num">Loot com ele</th><th class="num">Supplies gastos</th><th class="num">Fica com</th><th></th></tr>
      ${js.map((j, i) => `<tr><td><input data-fr-party="nome" data-i="${i}" maxlength="30" placeholder="Jogador ${i + 1}" value="${esc(j.nome || '')}"></td>
        <td class="num"><input class="qtd" data-fr-party="loot" data-i="${i}" data-gold data-sem-dica placeholder="0" value="${j.loot != null ? fmt(j.loot) : ''}"></td>
        <td class="num"><input class="qtd" data-fr-party="gasto" data-i="${i}" data-gold data-sem-dica placeholder="0" value="${j.gasto != null ? fmt(j.gasto) : ''}"></td>
        <td class="num"><b>${fmt((j.gasto || 0) + parte)}</b></td><td>${n > 2 ? `<button class="del" type="button" data-fr-party-del="${i}" title="Tirar jogador">✕</button>` : ''}</td></tr>`).join('')}</table></div>
      <div class="fr-linha">${n < 10 ? '<button type="button" class="btn sec mini-btn" data-fr-party-add>+ Jogador</button>' : ''}<button type="button" class="btn sec mini-btn" data-fr-party-limpar>Limpar</button></div></div>
      <div class="fr-col fr-resumo"><div class="fr-total"><span>Lucro da party</span><b class="${cls(total)}">${fmt(total)}</b><small class="muted">${n} jogadores · ${fmt(parte)} para cada</small></div>
        <div class="mp-sub">Transferências</div>${tr.length ? tr.map((t) => `<div class="fr-transf"><span><b>${esc(t.de)}</b> → <b>${esc(t.para)}</b></span><b>${fmt(t.v)}</b><code>transfer ${t.v} to ${esc(t.para)}</code></div>`).join('') : '<p class="muted">Ninguém precisa transferir nada.</p>'}
        ${tr.length ? '<button type="button" class="btn sec mini-btn" data-fr-party-copiar>📋 Copiar resumo para o chat da party</button>' : ''}
        <p class="dica">O comando "transfer" é para falar com o banqueiro (NPC do banco) depois de "hi" e "transfer".</p></div></div>`;
  }

  // ---------- timers ----------
  function proximoSS() {
    // server save: 10h em Berlim (CET/CEST)
    const agora = new Date(), berlim = new Date(agora.toLocaleString('en-US', { timeZone: 'Europe/Berlin' })), dif = agora - berlim;
    const alvo = new Date(berlim); alvo.setHours(10, 0, 0, 0); if (alvo <= berlim) alvo.setDate(alvo.getDate() + 1);
    return new Date(alvo.getTime() + dif);
  }
  const dur = (ms) => { if (ms <= 0) return 'agora'; const s = Math.floor(ms / 1000), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60; return `${h ? h + 'h ' : ''}${String(m).padStart(2, '0')}m ${String(x).padStart(2, '0')}s`; };
  function abaTimers() {
    const ts = F.timers || (F.timers = ler('tc_timers', []));
    const ss = proximoSS();
    return `<div class="fr-grid"><div class="fr-col">
        <div class="fr-relogio"><span>Próximo server save</span><b data-fr-conta="${ss.getTime()}">${dur(ss - Date.now())}</b><small class="muted">${ss.toLocaleString('pt-BR', { weekday: 'long', hour: '2-digit', minute: '2-digit' })} (no seu horário) · troca criatura e boss do dia, Rashid e loot das Bounty Tasks</small></div>
        <div class="mp-sub">Meus timers</div>
        ${ts.length ? ts.map((t, i) => `<div class="fr-timer ${t.fim <= Date.now() ? 'pronto' : ''}"><span>${esc(t.nome)}</span><b data-fr-conta="${t.fim}">${dur(t.fim - Date.now())}</b><button class="del" type="button" data-fr-timer-del="${i}" title="Apagar">✕</button></div>`).join('') : '<p class="muted">Nenhum timer. Crie um abaixo (ex.: cooldown de boss, Prey, quest diária).</p>'}
        <form class="fr-linha" id="fr-timer-form"><input name="nome" maxlength="40" placeholder="Nome (ex.: Ferumbras' Ascendant)" required><input name="h" type="number" min="0" max="999" placeholder="horas" aria-label="Horas"><input name="m" type="number" min="0" max="59" placeholder="min" aria-label="Minutos"><button class="btn mini-btn">+ Timer</button></form>
        <div class="fr-linha">${['Boss diário|20', 'Boss de 2 dias|44', 'Boss semanal|164'].map((x) => { const [n, h] = x.split('|'); return `<button type="button" class="chip" data-fr-timer-rapido="${h}" data-nome="${n}">${n} (${h}h)</button>`; }).join('')}</div>
      </div><div class="fr-col fr-resumo"><p class="dica">Os timers ficam salvos e continuam contando mesmo com o site fechado. ${'Notification' in window ? '<button type="button" class="link" data-fr-notif>Avisar no navegador quando um timer acabar</button>' : ''}</p></div></div>`;
  }

  function render() {
    const el = $('#ferramentas-app'); if (!el) return;
    puxarDaConta();
    const nf = favs().length, abas = [['poritem', '🛡️ Imbuements por item'], ['imbuements', '✨ Calculadora'], ['favoritos', `⭐ Favoritos${nf ? ` (${nf})` : ''}`], ['party', '👥 Divisão de loot'], ['timers', '⏱️ Timers']];
    el.innerHTML = `<div class="card"><div class="fr-abas" role="tablist">${abas.map(([k, t]) => `<button type="button" role="tab" data-fr-aba="${k}" class="${F.aba === k ? 'ativo' : ''}" aria-selected="${F.aba === k}">${t}</button>`).join('')}</div>` +
      `<div class="fr-corpo">${F.aba === 'poritem' ? abaPorItem() : F.aba === 'imbuements' ? abaImbuements() : F.aba === 'favoritos' ? abaFavoritos() : F.aba === 'party' ? abaParty() : abaTimers()}</div>` +
      `<p class="dica fr-onde">${premium() ? '☁️ Salvo na sua conta: abre igual no celular e no computador.' : '💾 Salvo só neste navegador. Para apoiadores, fica guardado na conta e abre em qualquer aparelho.'}</p></div>`;
  }

  // relógios e aviso de timer acabado
  let avisados = new Set();
  setInterval(() => {
    $$('#ferramentas-app [data-fr-conta]').forEach((b) => { b.textContent = dur(+b.dataset.frConta - Date.now()); });
    for (const t of F.timers || ler('tc_timers', [])) if (t.fim <= Date.now() && t.fim > Date.now() - 60e3 && !avisados.has(t.fim)) {
      avisados.add(t.fim); toast(`⏱️ Timer acabou: ${t.nome}`);
      try { if (window.Notification && Notification.permission === 'granted') new Notification('TibiaHub', { body: `Timer acabou: ${t.nome}`, icon: '/icone-192.png' }); } catch { /* ok */ }
    }
  }, 1000);

  // ---------- eventos ----------
  document.addEventListener('click', (e) => {
    if (e.target.closest('#menu [data-pag=ferramentas]')) { render(); return; }
    const app = $('#ferramentas-app'); if (!app || !app.contains(e.target)) return;
    const fv = e.target.closest('[data-fr-fav]');
    if (fv) { const n = fv.dataset.frFav, l = favs(); gravar('tc_imb_favs', l.includes(n) ? l.filter((x) => x !== n) : [...l, n].slice(0, 72)); render(); return; }
    const fi = e.target.closest('[data-fr-fav-ir]'); if (fi) { F.sel = fi.dataset.frFavIr; F.aba = 'imbuements'; render(); return; }
    const ct = e.target.closest('[data-fr-cat]'); if (ct) { F.cat = ct.dataset.frCat; F.busca = ''; F.item = null; F.limite = 48; render(); return; }
    const vc = e.target.closest('[data-fr-voc]'); if (vc) { F.voc = vc.dataset.frVoc; F.item = null; F.limite = 48; render(); return; }
    const pi = e.target.closest('[data-fr-item]'); if (pi) { F.item = pi.dataset.frItem; render(); if (innerWidth < 820) $('#ferramentas-app .fr-pi-det')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
    if (e.target.closest('[data-fr-mais]')) { F.limite += 48; render(); return; }
    const a = e.target.closest('[data-fr-aba]'); if (a) { F.aba = a.dataset.frAba; render(); return; }
    if (e.target.closest('[data-fr-party-ler]')) {
      const js = lerPartyTexto($('[data-fr-party-txt]')?.value);
      if (js.length < 2) { toast('Não achei os jogadores no texto. Copie de novo pelo botão "Copy to clipboard" do Party Hunt Analyser.'); return; }
      F.party = { jogadores: js }; gravar('tc_party', F.party); render(); toast(`${js.length} jogadores lidos: veja quem transfere para quem.`); return;
    }
    if (e.target.closest('[data-fr-party-copiar]')) {
      const txt = [...document.querySelectorAll('.fr-transf')].map((d) => d.querySelector('code')?.textContent.replace(/^transfer (\d+) to (.+)$/, (_, v, n) => `${d.querySelector('span b')?.textContent || ''} → ${n}: ${Number(v).toLocaleString('pt-BR')} gp`)).filter(Boolean).join(' | ');
      navigator.clipboard?.writeText(`Divisão da party (TibiaHub): ${txt}`.slice(0, 500)).then(() => toast('Resumo copiado. Cole no chat da party.'), () => toast('Não deu para copiar.'));
      return;
    }
    if (e.target.closest('[data-fr-party-add]')) { F.party.jogadores.push({ nome: '', loot: null, gasto: null }); gravar('tc_party', F.party); render(); return; }
    const d = e.target.closest('[data-fr-party-del]'); if (d) { F.party.jogadores.splice(+d.dataset.frPartyDel, 1); gravar('tc_party', F.party); render(); return; }
    if (e.target.closest('[data-fr-party-limpar]')) { F.party = { jogadores: [{ nome: '', loot: null, gasto: null }, { nome: '', loot: null, gasto: null }] }; gravar('tc_party', F.party); render(); return; }
    const td = e.target.closest('[data-fr-timer-del]'); if (td) { F.timers.splice(+td.dataset.frTimerDel, 1); gravar('tc_timers', F.timers); render(); return; }
    const tr = e.target.closest('[data-fr-timer-rapido]'); if (tr) { F.timers.push({ nome: tr.dataset.nome, fim: Date.now() + +tr.dataset.frTimerRapido * 3600e3 }); gravar('tc_timers', F.timers); render(); return; }
    if (e.target.closest('[data-fr-notif]')) { try { Notification.requestPermission().then((r) => toast(r === 'granted' ? 'Avisos ligados.' : 'Avisos não autorizados pelo navegador.')); } catch { /* ok */ } }
  });
  document.addEventListener('change', (e) => {
    const app = $('#ferramentas-app'); if (!app || !app.contains(e.target)) return;
    const t = e.target;
    if (t.dataset.fr === 'imb') { F.sel = t.value; render(); return; }
    if (t.dataset.fr === 'espaco') { F.soComEspaco = t.checked; F.limite = 48; render(); return; }
    if (t.dataset.frPreco) { const p = precos(), v = gold(t.value); if (v == null || v < 0) delete p[t.dataset.frPreco]; else p[t.dataset.frPreco] = v; gravar('tc_imb_precos', p); render(); return; }
    if (t.dataset.fr === 'token' || t.dataset.fr === 'taxa') {
      const c = ler('tc_imb_conf', {}), v = gold(t.value), im = F.imbs.find((i) => i.nome === F.sel);
      const k = t.dataset.fr === 'token' ? 'token' : 'taxa_' + im?.nivel;
      if (v == null || v < 0) delete c[k]; else c[k] = v; gravar('tc_imb_conf', c); render(); return;
    }
    if (t.dataset.frParty) { const j = F.party.jogadores[+t.dataset.i]; if (!j) return; if (t.dataset.frParty === 'nome') j.nome = t.value.trim().slice(0, 30); else { const v = gold(t.value); j[t.dataset.frParty] = v == null || v < 0 ? null : v; } gravar('tc_party', F.party); render(); }
  });
  let tBusca;
  document.addEventListener('input', (e) => {
    if (e.target.dataset?.fr !== 'busca' || !$('#ferramentas-app')?.contains(e.target)) return;
    clearTimeout(tBusca); tBusca = setTimeout(() => {
      F.busca = e.target.value.slice(0, 40); F.item = null; F.limite = 48; render();
      const b = $('#ferramentas-app [data-fr="busca"]'); if (b) { b.focus(); b.setSelectionRange(b.value.length, b.value.length); }
    }, 250);
  });
  document.addEventListener('submit', (e) => {
    if (e.target.id !== 'fr-timer-form') return; e.preventDefault();
    const f = e.target, h = Math.max(0, Math.min(999, +f.h.value || 0)), m = Math.max(0, Math.min(59, +f.m.value || 0));
    if (!h && !m) return toast('Informe horas ou minutos.');
    F.timers.push({ nome: f.nome.value.trim().slice(0, 40) || 'Timer', fim: Date.now() + (h * 60 + m) * 60e3 }); gravar('tc_timers', F.timers); render();
  });
})();

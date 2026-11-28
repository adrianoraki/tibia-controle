// TibiaHub — Magias por classe: o que você já usa, o que vem nos próximos levels e as runas que pode fazer.
// Dados: TibiaWiki (CC BY-SA), importados pelo servidor. Todo texto de fora passa por esc().
(() => {
  const M = { rdAba: 'roda', lista: null, voc: null, level: null, busca: '', grupo: 'todas', aba: 'magias', sit: 'solo', modo: 'auto', extras: 0, manual: null };
  const VOCS = [['knight', 'Knight', '🛡️'], ['paladin', 'Paladin', '🏹'], ['sorcerer', 'Sorcerer', '🔥'], ['druid', 'Druid', '🌿'], ['monk', 'Monk', '👊']];
  const GRUPOS = [['todas', 'Todas'], ['ataque', '⚔️ Ataque'], ['cura', '💚 Cura'], ['suporte', '✨ Suporte'], ['runa', '🔮 Runas']];
  const ELEM = { Fire: ['fogo', '#f97316'], Ice: ['gelo', '#38bdf8'], Energy: ['energia', '#a855f7'], Earth: ['terra', '#22c55e'], Death: ['morte', '#64748b'], Holy: ['sagrado', '#eab308'], Physical: ['físico', '#ef4444'] };
  const grupoDe = (m) => (m.tipo === 'Rune' ? 'runa' : m.subclasse === 'Attack' ? 'ataque' : m.subclasse === 'Healing' ? 'cura' : 'suporte');
  const vocDoPerfil = () => { const v = String(S.perfil?.vocacao || '').toLowerCase(); return VOCS.find(([k]) => v.includes(k))?.[0] || null; };
  const ler = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
  const gravar = (k, v) => { try { localStorage.setItem(k, v); } catch { /* ok */ } };
  const seg = (s) => (s == null ? '' : s >= 3600 ? `${Math.round(s / 60)} min` : s >= 60 ? `${Math.round(s / 60)} min` : `${s}s`);

  async function carregar() {
    $('#magias-app').innerHTML = '<div class="card"><div class="bloqueio">Carregando magias…</div></div>';
    const { data, error } = await sb.from('magias').select('nome,palavras,level,mana,vocacoes,tipo,subclasse,elemento,premium,cooldown,efeito,efeito_pt,base_poder,runa_qtd,alma,promocao,roda').order('level').order('nome').limit(1000);
    if (error) { $('#magias-app').innerHTML = '<div class="card"><div class="bloqueio">Não deu para carregar as magias agora.</div></div>'; return; }
    M.lista = data || []; render();
  }

  function cartao(m, lvl) {
    const g = grupoDe(m), el = ELEM[m.elemento], falta = (m.level || 0) - lvl;
    const tags = [
      m.premium ? '<span class="mg-tag">Premium</span>' : '<span class="mg-tag livre">Free</span>',
      m.promocao ? '<span class="mg-tag">Promoção</span>' : '',
      m.roda ? '<span class="mg-tag roda" title="Vem da Wheel of Destiny">Wheel</span>' : '',
      el ? `<span class="mg-tag" style="--c:${el[1]}">${el[0]}</span>` : '',
    ].join('');
    return `<div class="mg-card mg-${g} ${falta > 0 ? 'futura' : ''}">
      <div class="mg-topo"><span class="mg-nome">${imgDoItem(m.nome, 'mg-ico grande')}<b>${esc(m.nome)}</b></span><span class="mg-lvl">${falta > 0 ? `lvl ${fmt(m.level)} · faltam ${fmt(falta)}` : `lvl ${fmt(m.level || 0)}`}</span></div>
      ${m.palavras ? `<button type="button" class="mg-palavras" data-mg-copiar="${esc(m.palavras)}" title="Copiar as palavras">${esc(m.palavras)}<span aria-hidden="true">⧉</span></button>` : ''}
      <div class="mg-info">${m.mana > 0 ? `<span>💧 ${fmt(m.mana)} mana</span>` : ''}${m.cooldown ? `<span>⏱️ ${seg(m.cooldown)}</span>` : ''}${m.tipo === 'Rune' && m.runa_qtd ? `<span>🔮 faz ${fmt(m.runa_qtd)} runa${m.runa_qtd > 1 ? 's' : ''}${m.alma ? ` · ${fmt(m.alma)} soul` : ''}</span>` : ''}</div>
      ${m.efeito_pt || m.efeito ? `<p class="mg-efeito">${esc(m.efeito_pt || m.efeito)}</p>` : ''}
      <div class="mg-tags">${tags}</div></div>`;
  }

  const SITS = [['solo', '🗡️ Hunt solo'], ['time', '👥 Hunt em time'], ['boss', '💀 Boss']];
  const porNome = () => M._nomes || (M._nomes = new Map(M.lista.map((m) => [m.nome, m])));
  const escolher = (opcoes, lvl) => opcoes.map((n) => porNome().get(n)).find((m) => m && (m.vocacoes || []).includes(M.voc) && (m.level || 0) <= lvl) || null;
  // ícone da magia: a TibiaWiki guarda como "<Nome da magia>.gif" (mesmo esquema dos itens)
  const icone = (m, cls = '') => imgDoItem(m.nome, 'mg-ico ' + cls);
  const chip = (m) => `<button type="button" class="cb-chip" data-mg-info="${esc(m.nome)}" aria-label="${esc(m.nome)}, level ${fmt(m.level || 0)}: ver o que faz">${icone(m)}<span><b>${esc(m.palavras || m.nome)}</b><small>${esc(m.nome)}</small></span></button>`;
  function linhaCombo(c, lvl) {
    const seq = []; for (const p of c.passos) { const m = escolher(p, lvl); if (m && seq.at(-1) !== m) seq.push(m); }
    const lista = (arr) => (arr || []).map((p) => escolher(p, lvl)).filter(Boolean);
    return { seq, cura: lista(c.cura), emerg: lista(c.emergencia), extra: lista(c.extra), postura: c.postura ? escolher([c.postura], lvl) : null };
  }
  function abaCombos(lvl) {
    const c = COMBOS[M.voc]?.[M.sit]; if (!c) return '';
    const faixas = Array.from({ length: 10 }, (_, i) => (i + 1) * 50), atual = Math.min(500, Math.max(50, Math.floor(lvl / 50) * 50));
    // faixas seguidas com o mesmo combo viram uma só (ex.: lvl 100–250)
    const sig = (r) => [r.postura?.nome, ...r.seq.map((m) => m.nome), '|', ...r.cura.map((m) => m.nome), '|', ...r.emerg.map((m) => m.nome), '|', ...r.extra.map((m) => m.nome)].join(',');
    const grupos = [];
    for (const f of faixas) { const r = linhaCombo(c, f), g = grupos.at(-1); if (g && g.sig === sig(r)) g.ate = f; else grupos.push({ de: f, ate: f, r, sig: sig(r) }); }
    return `<div class="mg-grupos">${SITS.map(([k, t]) => `<button type="button" class="chip ${M.sit === k ? 'ativo' : ''}" data-mg-sit="${k}">${t}</button>`).join('')}</div>
      <p class="cb-ideia">${esc(c.ideia)}</p>
      <div class="cb-lista">${grupos.map(({ de, ate, r }) => {
        const meu = atual >= de && atual <= ate, rot = de === ate ? (de === 500 ? '500+' : de) : `${de}–${ate === 500 ? '500+' : ate}`;
        return `<div class="cb-faixa ${meu ? 'meu' : ''}"><div class="cb-lvl">lvl ${rot}${meu ? '<small>você</small>' : ''}</div><div class="cb-corpo">
          ${r.postura ? `<div class="cb-linha"><span class="cb-rot">Postura</span>${chip(r.postura)}</div>` : ''}
          ${r.extra.length ? `<div class="cb-linha"><span class="cb-rot">Antes</span>${r.extra.map(chip).join('')}</div>` : ''}
          <div class="cb-linha"><span class="cb-rot">Combo</span>${r.seq.length ? r.seq.map(chip).join('<span class="cb-seta" aria-hidden="true">→</span>') + '<span class="cb-seta" aria-hidden="true">↺</span>' : '<span class="muted">nenhuma magia de ataque ainda</span>'}</div>
          ${r.cura.length ? `<div class="cb-linha"><span class="cb-rot">Cura</span>${r.cura.map(chip).join('')}</div>` : ''}
          ${r.emerg.length ? `<div class="cb-linha"><span class="cb-rot">Aperto</span>${r.emerg.map(chip).join('')}</div>` : ''}
        </div></div>`;
      }).join('')}</div>
      <p class="dica">Combos sugeridos pelo TibiaHub a partir das magias que cada level libera (a lista se atualiza com a TibiaWiki). Repita o combo enquanto as recargas voltam; use potion e cura sempre que precisar. Passe o mouse (ou toque) numa magia para ver o que ela faz e copiar as palavras.</p>`;
  }

  // ---------- Roda do Destino ----------
  const ESTAGIOS = [250, 500, 1000], BONUS = [0, 4, 9, 20];
  const perksDe = (v) => ['Gift of Life', RODA[v].avatar, ...Object.keys(RODA[v].perks)];
  const estagio = (p) => (p >= 1000 ? 3 : p >= 500 ? 2 : p >= 250 ? 1 : 0);
  function recomendada(v, sit, pts) {
    const pri = RODA.prioridade[v][sit], a = Object.fromEntries(perksDe(v).map((n) => [n, 0]));
    const passos = [[0, 250], [0, 500], [1, 250], [1, 500], [2, 250], [0, 1000], [2, 500], [3, 250], [1, 1000], [3, 500], [2, 1000], [3, 1000]];
    let resto = pts;
    for (const [i, alvo] of passos) { const n = pri[i], falta = alvo - a[n]; if (falta <= 0) continue; if (falta > resto) break; a[n] = alvo; resto -= falta; }
    // o que sobra vai para o domínio principal (fatias de fora e melhorias de magia), até 1.000 por domínio
    for (const n of pri) { const d = Math.min(resto, 1000 - a[n]); a[n] += d; resto -= d; if (!resto) break; }
    return a;
  }
  // ---------- Desenho da roda (igual ao planejador oficial do tibia.com) ----------
  // Dados e imagens: RODA_OF (roda.js). Grade 6x6; domínios na ordem TL ↖, TR ↗, BL ↙, BR ↘.
  const RQ = ['TL', 'TR', 'BL', 'BR'], RC = 261;
  const COR_LEVE = ['#46b21c31', '#ae143431', '#198d4031', '#841d9e31'], COR_FORTE = ['#94c4126b', '#ef1a386b', '#18cd8f6b', '#e618da6b'];
  const ROT = [0, 90, 270, 180]; // rotação das peças de canto por domínio
  const ORDEM_LOCAL = [0, 1, 3, 4, 2, 6, 5, 7, 8]; // ordem de encher dentro do domínio (do centro para fora)
  const quartoDe = (i) => RQ.indexOf(RODA_OF.ids[i].slice(1, 3));
  const idxDe = (q, n) => RODA_OF.ids.indexOf(`Q${RQ[q]}${n}`);
  const CENTRO = RQ.map((_, q) => idxDe(q, 0));
  const domNomes = (v) => RODA_OF.cantos[v].map((g) => RODA_OF.grandes[g][0]);
  const raioIn = (r) => r * 52 + 1, raioOut = (r) => raioIn(r) + 50;
  const pt = (r, g, cx = RC, cy = RC) => { const t = (g * Math.PI) / 180; return `${(cx + r * Math.cos(t)).toFixed(1)} ${(cy + r * Math.sin(t)).toFixed(1)}`; };
  const fatia = (r1, r2, g1, g2) => (r1 <= 1
    ? `M${RC} ${RC} L${pt(r2, g1)} A${r2} ${r2} 0 0 1 ${pt(r2, g2)} Z`
    : `M${pt(r1, g1)} L${pt(r2, g1)} A${r2} ${r2} 0 0 1 ${pt(r2, g2)} L${pt(r1, g2)} A${r1} ${r1} 0 0 0 ${pt(r1, g1)} Z`);
  const vizinhos = (i) => { const l = Math.floor(i / 6), c = i % 6; return [[l - 1, c], [l + 1, c], [l, c - 1], [l, c + 1]].filter(([a, b]) => a >= 0 && a < 6 && b >= 0 && b < 6).map(([a, b]) => a * 6 + b); };
  const liberada = (t, i) => CENTRO.includes(i) || vizinhos(i).some((j) => t[j] >= RODA_OF.max[j]);
  function fatiasDe(v, a) { // pontos por domínio → pontos por fatia
    const t = new Array(36).fill(0);
    domNomes(v).forEach((n, q) => { let resto = a[n] || 0; for (const k of ORDEM_LOCAL) { const i = idxDe(q, k), d = Math.min(resto, RODA_OF.max[i]); t[i] = d; resto -= d; if (!resto) break; } });
    return t;
  }
  const somaDom = (v, t) => Object.fromEntries(domNomes(v).map((n, q) => [n, t.reduce((s, x, i) => s + (quartoDe(i) === q ? x : 0), 0)]));
  function limparSoltas(t) { // fatia sem vizinha cheia perde os pontos (igual ao jogo)
    let mudou = true;
    while (mudou) { mudou = false; t.forEach((x, i) => { if (x > 0 && !liberada(t, i)) { t[i] = 0; mudou = true; } }); }
  }
  const progresso = (p) => (p >= 1000 ? 1 : p >= 500 ? (p - 500) / 500 : p >= 250 ? (p - 250) / 250 : p / 250);
  const ROMANO = ['', 'I', 'II', 'III'];
  const LARG = { 'icons-skillwheel-mediumperks.png': 1470, 'icons-skillwheel-smallperks.png': 80, 'icons-skillwheel-largeperks.png': 544 };
  const icone2 = (arq, idx, tam, x, y) => `<svg x="${x}" y="${y}" width="${tam}" height="${tam}" style="width:${tam}px;height:${tam}px" viewBox="${idx * tam} 0 ${tam} ${tam}"><image href="${RODA_OF.img}${arq}" width="${LARG[arq]}" height="${tam}"/></svg>`;
  const DED = ['vida', 'mana', 'vida e mana', 'capacidade', 'mitigação'];
  function dedTxt(v, s, pts) {
    const d = RODA_OF.ded[v];
    if (s === 4) return `+${(pts * 0.075).toFixed(2).replace('.', ',')}% de mitigação`;
    if (s === 2) return `+${fmt(pts * d[2])} de vida e +${fmt(pts * d[3])} de mana`;
    return `+${fmt(pts * (s === 0 ? d[0] : s === 1 ? d[1] : d[4]))} de ${DED[s]}`;
  }
  function convTxt(c, id, val) {
    const m = RODA_OF.medios[id]; if (!m) return '';
    if (c === 'S') return `+${val} de ${m[0]}`;
    if (c === 'L') return `+${(val / 100).toFixed(2).replace('.', ',')}% de ${m[0]}`;
    if (c === 'A') return `${m[0]} melhorada — I: ${m[2]} · II: ${m[3]}`;
    return m[0];
  }
  function rodaSVG(v, t, a) {
    const manual = M.modo === 'manual', tiles = RODA_OF.voc[v], front = v === 'sorcerer' ? 'sorc' : v;
    let fills = '', icones = '', alvos = '', cantos = '';
    RODA_OF.geo.forEach(([r, g1, g2], i) => {
      const q = quartoDe(i), max = RODA_OF.max[i], pct = t[i] / max, livre = liberada(t, i);
      const r1 = raioIn(r), r2 = raioOut(r);
      if (pct > 0) fills += `<path d="${fatia(r1, r1 + pct * (r2 - r1), g1, g2)}" fill="${COR_FORTE[q]}"/>`;
      if (livre) fills += `<path d="${fatia(r1, r2, g1, g2)}" fill="${COR_LEVE[q]}"/>`;
      const meio = (((g1 + g2) / 2) * Math.PI) / 180, rm = (r1 + r2) / 2 + (r === 0 ? 2 : 0);
      const x = Math.round(Math.cos(meio) * rm + RC - 15), y = Math.round(Math.sin(meio) * rm + RC - 15);
      const [s, , id] = tiles[i];
      icones += icone2('icons-skillwheel-mediumperks.png', id, 30, x, y) + icone2('icons-skillwheel-smallperks.png', s, 16, x - 3, y + 17);
      const nome = RODA_OF.medios[id]?.[0] || '';
      alvos += `<path fill="transparent" class="rd-alvo${M.sel === i ? ' sel' : ''}${livre ? '' : ' trancada'}" d="${fatia(r1, r2, g1, g2)}" data-rd-t="${i}" tabindex="0" role="button" aria-label="${esc(`${nome}: ${fmt(t[i])} de ${max} pontos`)}"><title>${esc(`${nome} · ${fmt(t[i])}/${max}`)}</title></path>`;
    });
    domNomes(v).forEach((n, q) => {
      const p = a[n] || 0, e = estagio(p), j = [180, 270, 90, 0][q], tr = q === 1 || q === 2 ? ' matrix(0 1 1 0 0 0)' : '';
      const N = Math.round(Math.cos(((j + 45) * Math.PI) / 180) * 311) + RC, J = Math.round(Math.sin(((j + 45) * Math.PI) / 180) * 311) + RC;
      const pr = progresso(p), ang = 360 * pr - 90;
      cantos += `<g transform="rotate(${ROT[q]} ${RC} ${RC})${tr}"><image href="${RODA_OF.img}backdrop_skillwheel_largebonus_socketdisabled.png" width="118" height="85"/></g>
        <g class="rd-luz"><circle cx="${N}" cy="${J}" r="25" fill="${COR_LEVE[q]}"/>${pr >= 1 ? `<circle cx="${N}" cy="${J}" r="25" fill="${COR_FORTE[q]}"/>` : pr > 0 ? `<path d="M${N} ${J} L${pt(25, -90, N, J)} A25 25 0 ${pr > 0.5 ? 1 : 0} 1 ${pt(25, ang, N, J)} Z" fill="${COR_FORTE[q]}"/>` : ''}
        <path d="${fatia(270, 285, j + 40, j + 50)}" fill="${COR_FORTE[q]}"/></g>
        <g transform="rotate(${ROT[q]} ${RC} ${RC})" opacity=".4"><image href="${RODA_OF.img}backdrop_skillwheel_largebonus_light.png" width="118" height="85"/></g>
        <g transform="rotate(${ROT[q]} ${RC} ${RC})${tr}"><image href="${RODA_OF.img}backdrop_skillwheel_largebonus_front${e}.png" width="178" height="178"/></g>
        ${icone2('icons-skillwheel-largeperks.png', RODA_OF.cantos[v][q], 34, N - 17, J - 17)}
        <circle fill="transparent" class="rd-alvo canto${M.sel === `c${q}` ? ' sel' : ''}" cx="${N}" cy="${J}" r="25" data-rd-c="${q}" tabindex="0" role="button" aria-label="${esc(`${n}: ${e ? `estágio ${e}` : 'bloqueada'}, ${fmt(p)} pontos`)}"><title>${esc(`${n} · ${e ? `estágio ${e}` : 'bloqueada'} · ${fmt(p)} pontos`)}</title></circle>`;
    });
    return `<svg class="rd-svg${manual ? ' manual' : ''}" viewBox="0 0 522 522" role="img" aria-label="Roda do Destino">
      <image href="${RODA_OF.img}backdrop_skillwheel.png" width="522" height="522"/>
      <g class="rd-luz">${fills}</g>
      <image href="${RODA_OF.img}backdrop_skillwheel_front_${front}.png" width="522" height="522"/>
      ${icones}${cantos}${alvos}</svg>`;
  }
  function infoSel(v, t, a) {
    const manual = M.modo === 'manual';
    if (typeof M.sel === 'string') {
      const q = +M.sel.slice(1), n = domNomes(v)[q], g = RODA_OF.grandes[RODA_OF.cantos[v][q]], p = a[n] || 0, e = estagio(p), alvo = ESTAGIOS.find((x) => x > p);
      return `<div class="rd-info-cab">${icone2('icons-skillwheel-largeperks.png', RODA_OF.cantos[v][q], 34, 0, 0).replace('<svg ', '<svg class="rd-info-ico" ')}<div><small>Revelation Perk</small><b>${esc(n)}</b></div></div>
        <p class="rd-info-est">${e ? `Estágio ${ROMANO[e]} ativo` : 'Bloqueada'} · ${fmt(p)} pontos no domínio${alvo ? ` · faltam ${fmt(alvo - p)} para o estágio ${ROMANO[ESTAGIOS.indexOf(alvo) + 1]}` : ''}</p>
        <p>${esc(g[1])}</p><p class="muted">Cada estágio também dá +4 / +9 / +20 de dano e cura.</p>`;
    }
    if (typeof M.sel !== 'number') return `<p class="muted">${manual ? 'Toque numa fatia para ver o que ela dá. A fatia acende quando uma vizinha está cheia; aí é só tocar de novo (ou no botão) para encher.' : 'Toque numa fatia ou num canto para ver o que ele dá.'}</p>`;
    const i = M.sel, [s, c, id, val] = RODA_OF.voc[v][i], max = RODA_OF.max[i], m = RODA_OF.medios[id] || ['', ''], livre = liberada(t, i);
    const aug = c === 'A' ? `<ul class="rd-aug"><li><b>I</b> ${esc(m[2])}</li><li><b>II</b> ${esc(m[3])}</li></ul><p class="muted">Cada melhoria aparece 2 vezes na roda: a 1ª fatia cheia dá o I, a 2ª dá o II.</p>` : '';
    return `<div class="rd-info-cab">${icone2('icons-skillwheel-mediumperks.png', id, 30, 0, 0).replace('<svg ', '<svg class="rd-info-ico" ')}<div><small>Fatia de ${max} pontos · ${fmt(t[i])}/${max}</small><b>${esc(c === 'A' ? `${m[0]} melhorada` : m[0])}</b></div></div>
      <p><span class="rd-rot">Dedicação</span> ${esc(dedTxt(v, s, 1))} por ponto · agora ${esc(dedTxt(v, s, t[i]))} (cheia: ${esc(dedTxt(v, s, max))})</p>
      <p><span class="rd-rot">Convicção</span> ${t[i] >= max ? '✅ ativa' : '🔒 ativa com a fatia cheia'}: ${esc(c === 'L' || c === 'S' ? convTxt(c, id, val) : m[0])}${m[1] ? ` — ${esc(m[1])}` : ''}</p>${aug}
      ${manual ? `<div class="rd-info-bts">${t[i] >= max ? '<button type="button" class="btn" data-rd-acao="esvaziar">Esvaziar fatia</button>' : livre ? `<button type="button" class="btn primario" data-rd-acao="encher">Encher fatia</button>` : '<span class="muted">🔒 Encha uma fatia vizinha primeiro.</span>'}</div>` : ''}`;
  }
  function resumoRoda(v, t, a) {
    const d = RODA_OF.ded[v]; let vida = 0, mana = 0, cap = 0, mit = 0;
    const conv = new Map();
    RODA_OF.voc[v].forEach(([s, c, id, val], i) => {
      const p = t[i];
      if (s === 0) vida += p * d[0]; else if (s === 1) mana += p * d[1]; else if (s === 2) { vida += p * d[2]; mana += p * d[3]; } else if (s === 3) cap += p * d[4]; else mit += p * 0.075;
      if (p < RODA_OF.max[i]) return;
      const k = c === 'V' ? 'V' + id : id, x = conv.get(k) || { c, id, n: 0, val: 0 }; x.n++; x.val += val; conv.set(k, x);
    });
    const linhas = [...conv.values()].sort((x, y) => 'USLAV'.indexOf(x.c) - 'USLAV'.indexOf(y.c)).map(({ c, id, n, val }) => {
      const m = RODA_OF.medios[id];
      const txt = c === 'S' ? `+${val}` : c === 'L' ? `+${(val / 100).toFixed(2).replace('.', ',')}%` : c === 'A' || c === 'V' ? ROMANO[Math.min(3, n)] || n : '✓';
      return `<li><span>${esc(c === 'A' ? `${m[0]} melhorada` : m[0])}</span><b>${txt}</b></li>`;
    }).join('');
    const rev = domNomes(v).map((n) => { const e = estagio(a[n] || 0); return `<li><span>${esc(n)}</span><b>${e ? `Estágio ${ROMANO[e]}` : '🔒'}</b></li>`; }).join('');
    return `<div class="rd-resumo-g">
      <div><h4>Dedicação</h4><ul><li><span>Vida</span><b>+${fmt(vida)}</b></li><li><span>Mana</span><b>+${fmt(mana)}</b></li><li><span>Capacidade</span><b>+${fmt(cap)}</b></li><li><span>Mitigação</span><b>${mit.toFixed(2).replace('.', ',')}%</b></li></ul></div>
      <div><h4>Convicção</h4><ul>${linhas || '<li class="muted">Nenhuma fatia cheia ainda.</li>'}</ul></div>
      <div><h4>Revelação</h4><ul>${rev}</ul></div></div>`;
  }

  function abaRoda(lvl) {
    const v = M.voc, pts = Math.max(0, lvl - 50) + M.extras, nomes = domNomes(v);
    const auto = recomendada(v, M.sit, pts);
    if (!M.manual || M.manual._voc !== v || M.modo === 'auto') M.manual = { _voc: v, t: fatiasDe(v, auto) };
    const t = M.modo === 'auto' ? fatiasDe(v, auto) : M.manual.t;
    const a = somaDom(v, t);
    const usados = t.reduce((s, x) => s + x, 0), bonus = nomes.reduce((s, n) => s + BONUS[estagio(a[n])], 0);
    const prox = (() => { for (let l = lvl + 1; l <= lvl + 600; l++) { const r = recomendada(v, M.sit, Math.max(0, l - 50) + M.extras); const d = nomes.find((n) => estagio(r[n]) > estagio(auto[n])); if (d) return [l, d, estagio(r[d])]; } return null; })();
    const subAbas = `<div class="rd-subabas" role="tablist"><button type="button" role="tab" aria-selected="${M.rdAba === 'roda'}" class="${M.rdAba === 'roda' ? 'ativo' : ''}" data-rd-aba="roda">☸️ Roda</button><button type="button" role="tab" aria-selected="${M.rdAba === 'analista'}" class="${M.rdAba === 'analista' ? 'ativo' : ''}" data-rd-aba="analista">🔮 Oráculo IA</button></div>`;
    const sitsHtml = `<div class="mg-grupos">${SITS.map(([k, tt]) => `<button type="button" class="chip ${M.sit === k ? 'ativo' : ''}" data-mg-sit="${k}">${tt}</button>`).join('')}</div>`;
    if (M.rdAba === 'analista' && window.ANALISTA) {
      const c = linhaCombo(COMBOS[v][M.sit], lvl), vistos = new Set();
      const magiasCombo = [c.postura, ...c.extra, ...c.seq, ...c.cura, ...c.emerg].filter((m) => m && !vistos.has(m.nome) && vistos.add(m.nome));
      return subAbas + sitsHtml + `<p class="muted an-modo">Analisando a build ${M.modo === 'manual' ? 'que você montou (Manual)' : 'recomendada'} para o level ${fmt(lvl)}${M.extras ? ` com ${fmt(M.extras)} pontos extras` : ''}.</p>` +
        ANALISTA.html({ v, lvl, sit: M.sit, manual: M.modo === 'manual', t, a, nomes, total: pts, prox, BONUS, estagio, recomendada, fatiasDe, liberada, magiasCombo });
    }
    return subAbas + sitsHtml + `
      <div class="rd-topo">
        <label class="mg-lvl-campo">Pontos extras<input type="number" min="0" max="179" inputmode="numeric" data-mg="extras" value="${M.extras}" title="Promotion Scrolls, quest do Monk, Hunting Task Shop e mods de gema"></label>
        <div class="rd-modo" role="tablist"><button type="button" class="${M.modo === 'auto' ? 'ativo' : ''}" data-mg-modo="auto">⭐ Recomendada</button><button type="button" class="${M.modo === 'manual' ? 'ativo' : ''}" data-mg-modo="manual">✋ Manual</button>${M.modo === 'manual' ? '<button type="button" data-rd-acao="zerar">↺ Zerar</button>' : ''}</div>
      </div>
      <div class="mg-resumo">
        <div><span>Pontos no level ${fmt(lvl)}</span><b>${fmt(pts)}</b><small class="muted">1 por level acima do 50${M.extras ? ` + ${fmt(M.extras)} extras` : ''}</small></div>
        <div><span>Usados</span><b class="${usados > pts ? 'neg' : ''}">${fmt(usados)} / ${fmt(pts)}</b><small class="muted">${usados > pts ? 'passou do total: tire pontos' : `${fmt(pts - usados)} livres`}</small></div>
        <div><span>Bônus de dano e cura</span><b class="pos">+${bonus}</b><small class="muted">+4 / +9 / +20 por perk nos estágios 1 / 2 / 3</small></div>
      </div>
      ${pts < 250 ? '<div class="bloqueio">Ainda não dá para liberar uma Revelation Perk (precisa de 250 pontos num domínio, level 300). Até lá, gaste os pontos nas fatias do centro: vida e mana e as melhorias das magias que você mais usa.</div>' : ''}
      <div class="rd-mesa"><div class="rd-roda">${rodaSVG(v, t, a)}</div>
        <aside class="rd-lado"><div class="rd-info">${infoSel(v, t, a)}</div>${resumoRoda(v, t, a)}</aside></div>
      ${M.modo === 'auto' && prox ? `<p class="rd-prox">🎯 Próximo marco: no <b>level ${fmt(prox[0])}</b> esta build libera <b>${esc(prox[1])}</b> no estágio ${prox[2]}.</p>` : ''}
      <div class="rd-grade">${nomes.map((n, q) => {
        const p = a[n], e = estagio(p), alvo = ESTAGIOS.find((x) => x > p);
        return `<div class="rd-card e${e}"><div class="rd-cab">${icone2('icons-skillwheel-largeperks.png', RODA_OF.cantos[v][q], 34, 0, 0).replace('<svg ', '<svg class="rd-info-ico" ')}<b>${esc(n)}</b><span class="rd-est">${e ? `Estágio ${e}` : 'bloqueado'}</span></div>
          <div class="rd-barra" aria-hidden="true"><i style="width:${Math.min(100, p / 10)}%"></i>${ESTAGIOS.map((x) => `<s style="left:${x / 10}%"></s>`).join('')}</div>
          <div class="rd-pts">${M.modo === 'manual' ? `<input type="range" min="0" max="1000" step="25" value="${p}" data-mg-pts="${esc(n)}" aria-label="Pontos em ${esc(n)}">` : ''}<span><b>${fmt(p)}</b> pontos${alvo ? ` · faltam ${fmt(alvo - p)} para o estágio ${ESTAGIOS.indexOf(alvo) + 1}` : ' · máximo'}</span></div>
          <p>${esc(RODA_OF.grandes[RODA_OF.cantos[v][q]][1])}</p></div>`;
      }).join('')}</div>
      <p class="dica">Como funciona: cada domínio tem 9 fatias e 1.000 pontos; a fatia só recebe pontos quando encosta numa fatia cheia (as 4 do centro já começam liberadas). A Revelation Perk do canto liga com 250, melhora com 500 e chega ao máximo com 1.000 pontos no domínio. A build recomendada é uma sugestão do TibiaHub. Roda, imagens e valores: planejador oficial em <a href="https://www.tibia.com/community/?subtopic=wheelofdestinyplanner" target="_blank" rel="noopener">www.tibia.com</a> (CipSoft), regras de novembro/2026 — revisamos quando sair o Winter Update.</p>`;
  }

  function render() {
    const el = $('#magias-app'); if (!el || !M.lista) return;
    if (popDe) fecharPop();
    if (!M.voc) M.voc = ler('tc_mg_voc') || vocDoPerfil() || 'knight';
    if (M.level == null) M.level = +ler('tc_mg_lvl') || S.perfil?.level || 1;
    const lvl = M.level, q = M.busca.trim().toLowerCase();
    let lista = M.lista.filter((m) => (m.vocacoes || []).includes(M.voc));
    if (M.grupo !== 'todas') lista = lista.filter((m) => grupoDe(m) === M.grupo);
    if (q) lista = lista.filter((m) => m.nome.toLowerCase().includes(q) || String(m.palavras || '').toLowerCase().includes(q));
    const ja = lista.filter((m) => (m.level || 0) <= lvl), prox = lista.filter((m) => (m.level || 0) > lvl).sort((a, b) => a.level - b.level);
    const proxima = prox[0], total = M.lista.filter((m) => (m.vocacoes || []).includes(M.voc)).length;
    const meu = vocDoPerfil();
    const ABAS = [['magias', '✨ Magias'], ['combos', '⚔️ Combos'], ['roda', '☸️ Roda do Destino']];
    const topo = `<div class="fr-abas mg-abas" role="tablist">${ABAS.map(([k, t]) => `<button type="button" role="tab" aria-selected="${M.aba === k}" class="${M.aba === k ? 'ativo' : ''}" data-mg-aba="${k}">${t}</button>`).join('')}</div>
      <div class="mg-vocs" role="tablist">${VOCS.map(([k, t, i]) => `<button type="button" role="tab" aria-selected="${M.voc === k}" class="${M.voc === k ? 'ativo' : ''}" data-mg-voc="${k}"><span>${i}</span>${t}${meu === k ? ' <small>(você)</small>' : ''}</button>`).join('')}</div>`;
    const campoLvl = `<label class="mg-lvl-campo">Seu level<input type="number" min="1" max="4999" inputmode="numeric" data-mg="level" value="${lvl}"></label>${S.perfil?.level && S.perfil.level !== lvl ? `<button type="button" class="link" data-mg-meu-lvl>usar o meu (${fmt(S.perfil.level)})</button>` : ''}`;
    if (M.aba !== 'magias') { el.innerHTML = `<div class="card">${topo}<div class="mg-filtros">${campoLvl}</div>${M.aba === 'combos' ? abaCombos(lvl) : abaRoda(lvl)}</div>`; return; }
    el.innerHTML = `<div class="card">${topo.split('<div class="mg-vocs"')[0]}
      <div class="mg-vocs" role="tablist">${VOCS.map(([k, t, i]) => `<button type="button" role="tab" aria-selected="${M.voc === k}" class="${M.voc === k ? 'ativo' : ''}" data-mg-voc="${k}"><span>${i}</span>${t}${meu === k ? ' <small>(você)</small>' : ''}</button>`).join('')}</div>
      <div class="mg-filtros">
        <label class="mg-lvl-campo">Seu level<input type="number" min="1" max="4999" inputmode="numeric" data-mg="level" value="${lvl}"></label>
        ${S.perfil?.level && S.perfil.level !== lvl ? `<button type="button" class="link" data-mg-meu-lvl>usar o meu (${fmt(S.perfil.level)})</button>` : ''}
        <input type="search" data-mg="busca" placeholder="Buscar magia ou palavras (ex.: exura, mas vis)…" value="${esc(M.busca)}" maxlength="40">
        <div class="mg-grupos">${GRUPOS.map(([k, t]) => `<button type="button" class="chip ${M.grupo === k ? 'ativo' : ''}" data-mg-grupo="${k}">${t}</button>`).join('')}</div>
      </div>
      <div class="mg-resumo">
        <div><span>Você já pode usar</span><b>${fmt(ja.length)}</b><small class="muted">de ${fmt(total)} magias de ${esc(VOCS.find((v) => v[0] === M.voc)[1])}</small></div>
        <div><span>Próxima magia</span>${proxima ? `<b>${esc(proxima.nome)}</b><small class="muted">no level ${fmt(proxima.level)} · faltam ${fmt(proxima.level - lvl)} levels</small>` : '<b>Nenhuma</b><small class="muted">você já tem todas</small>'}</div>
      </div>
      ${prox.length ? `<h3 class="mg-tit">Próximas magias</h3><div class="mg-grade">${prox.slice(0, 12).map((m) => cartao(m, lvl)).join('')}</div>${prox.length > 12 ? `<p class="muted">E mais ${fmt(prox.length - 12)} até o level ${fmt(prox.at(-1).level)}.</p>` : ''}` : ''}
      <h3 class="mg-tit">Já disponíveis no level ${fmt(lvl)}</h3>
      ${ja.length ? `<div class="mg-grade">${[...ja].sort((a, b) => b.level - a.level).map((m) => cartao(m, lvl)).join('')}</div>` : '<div class="bloqueio">Nenhuma magia nesse filtro.</div>'}
      <p class="dica">Clique nas palavras para copiar. Magias com "Wheel" vêm da Wheel of Destiny; "Promoção" precisa da promoção da vocação. Dados: TibiaWiki (CC BY-SA).</p></div>`;
  }

  const totalPts = () => Math.max(0, (M.level || 1) - 50) + M.extras;
  function mexerFatia(i, acao) { // acao: 'encher' | 'esvaziar' | undefined (alterna)
    if (M.modo !== 'manual' || !M.manual) return;
    const t = M.manual.t, max = RODA_OF.max[i];
    if (!acao) acao = t[i] >= max ? 'esvaziar' : 'encher';
    if (acao === 'esvaziar') { t[i] = 0; limparSoltas(t); render(); return; }
    if (!liberada(t, i)) { toast('Essa fatia ainda está trancada: encha uma fatia vizinha primeiro.'); return; }
    const livres = totalPts() - t.reduce((s, x) => s + x, 0) + t[i];
    if (livres <= t[i]) { toast('Sem pontos livres: suba de level, some pontos extras ou esvazie outra fatia.'); return; }
    if (livres < max) toast(`Só deu para colocar ${fmt(livres)} de ${max} pontos nessa fatia.`);
    t[i] = Math.min(max, livres); render();
  }
  function domPorSlider(n, quer) {
    const v = M.voc, q = domNomes(v).indexOf(n), t = M.manual.t; if (q < 0) return;
    const outros = t.reduce((s, x, i) => s + (quartoDe(i) === q ? 0 : x), 0);
    let resto = Math.max(0, Math.min(1000, quer, totalPts() - outros));
    for (const k of ORDEM_LOCAL) { const i = idxDe(q, k), d = Math.min(resto, RODA_OF.max[i]); t[i] = d; resto -= d; }
    limparSoltas(t);
  }

  // ---------- Cartão da magia (passar o mouse ou tocar) ----------
  const pop = document.createElement('div');
  pop.className = 'mg-pop'; pop.id = 'mg-pop'; pop.setAttribute('role', 'dialog'); pop.setAttribute('aria-label', 'Detalhes da magia'); pop.hidden = true;
  document.body.appendChild(pop);
  const TIPO = { ataque: '⚔️ Ataque', cura: '💚 Cura', suporte: '✨ Suporte', runa: '🔮 Runa' };
  let popDe = null, popFixo = false, tFechar;
  const temHover = matchMedia('(hover: hover) and (pointer: fine)').matches;
  function htmlPop(m) {
    const el = ELEM[m.elemento], falta = (m.level || 0) - (M.level || 1);
    const info = [
      `<span>📈 level ${fmt(m.level || 0)}${falta > 0 ? ` <em>(faltam ${fmt(falta)})</em>` : ''}</span>`,
      m.mana > 0 ? `<span>💧 ${fmt(m.mana)} mana</span>` : '',
      m.cooldown ? `<span>⏱️ ${seg(m.cooldown)}</span>` : '',
      m.tipo === 'Rune' && m.runa_qtd ? `<span>🔮 faz ${fmt(m.runa_qtd)}${m.alma ? ` · ${fmt(m.alma)} soul` : ''}</span>` : '',
    ].join('');
    const tags = [m.premium ? 'Premium' : 'Free', m.promocao ? 'Promoção' : '', m.roda ? 'Wheel of Destiny' : ''].filter(Boolean).map((t) => `<span class="mg-tag">${t}</span>`).join('');
    return `<div class="mg-pop-cab">${icone(m, 'grande')}<div><b>${esc(m.nome)}</b><small>${TIPO[grupoDe(m)]}${el ? ` · <i style="--c:${el[1]}">${el[0]}</i>` : ''}</small></div></div>
      <p>${esc(m.efeito_pt || m.efeito || 'Sem descrição ainda.')}</p>
      <div class="mg-info">${info}</div><div class="mg-tags">${tags}</div>
      ${m.palavras ? `<button type="button" class="mg-palavras" data-mg-copiar="${esc(m.palavras)}">${esc(m.palavras)}<span aria-hidden="true">⧉ copiar</span></button>` : ''}`;
  }
  function posicionar() {
    if (!popDe) return;
    const r = popDe.getBoundingClientRect(), w = pop.offsetWidth, h = pop.offsetHeight;
    const x = Math.min(Math.max(8, r.left + r.width / 2 - w / 2), innerWidth - w - 8);
    let y = r.bottom + 8; if (y + h > innerHeight - 8) y = Math.max(8, r.top - h - 8);
    pop.style.left = `${x}px`; pop.style.top = `${y}px`;
  }
  function abrirPop(alvo, fixo) {
    const m = M.lista && porNome().get(alvo.dataset.mgInfo); if (!m) return;
    clearTimeout(tFechar);
    if (popDe !== alvo) { pop.innerHTML = htmlPop(m); popDe?.setAttribute('aria-expanded', 'false'); }
    popDe = alvo; popFixo = fixo || popFixo; alvo.setAttribute('aria-expanded', 'true');
    pop.hidden = false; posicionar();
  }
  function fecharPop() { clearTimeout(tFechar); pop.hidden = true; popDe?.setAttribute('aria-expanded', 'false'); popDe = null; popFixo = false; }
  document.addEventListener('click', (e) => {
    const c = e.target.closest('#mg-pop [data-mg-copiar]');
    if (c) { const t = c.dataset.mgCopiar; navigator.clipboard?.writeText(t).then(() => toast(`Copiado: ${t}`), () => toast('Não deu para copiar.')); return; }
    if (e.target.closest('#mg-pop')) return;
    const i = e.target.closest('#magias-app [data-mg-info]');
    if (i) { if (popDe === i && popFixo) fecharPop(); else abrirPop(i, true); return; }
    if (!pop.hidden) fecharPop();
  });
  if (temHover) {
    document.addEventListener('mouseover', (e) => {
      const i = e.target.closest('#magias-app [data-mg-info]');
      if (i) { if (!popFixo || popDe === i) abrirPop(i, false); return; }
      if (e.target.closest('#mg-pop')) clearTimeout(tFechar);
    });
    document.addEventListener('mouseout', (e) => {
      if (popFixo || !popDe) return;
      const para = e.relatedTarget;
      if (para && (para.closest?.('#mg-pop') || para.closest?.('[data-mg-info]') === popDe)) return;
      if (e.target.closest('#mg-pop') || e.target.closest('[data-mg-info]') === popDe) { clearTimeout(tFechar); tFechar = setTimeout(fecharPop, 180); }
    });
  }
  document.addEventListener('focusin', (e) => { const i = e.target.closest?.('#magias-app [data-mg-info]'); if (i) abrirPop(i, false); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !pop.hidden) { const de = popDe; fecharPop(); de?.focus(); return; }
    const ft = e.target.closest?.('#magias-app [data-rd-t], #magias-app [data-rd-c]'); if (ft && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); ft.dispatchEvent(new MouseEvent('click', { bubbles: true })); }
  });
  addEventListener('scroll', () => { if (!pop.hidden) (popFixo ? posicionar() : fecharPop()); }, { passive: true, capture: true });
  addEventListener('resize', () => { if (!pop.hidden) posicionar(); });

  let tMg; document.addEventListener('mg-render', () => { clearTimeout(tMg); tMg = setTimeout(() => { if (M.lista && $('#magias-app')) render(); }, 0); });
  let tBusca;
  document.addEventListener('click', (e) => {
    if (e.target.closest('#menu [data-pag=magias]')) { if (!M.lista) carregar(); else render(); return; }
    const app = $('#magias-app'); if (!app || !app.contains(e.target)) return;
    const v = e.target.closest('[data-mg-voc]'); if (v) { M.voc = v.dataset.mgVoc; M.sel = null; gravar('tc_mg_voc', M.voc); render(); return; }
    const g = e.target.closest('[data-mg-grupo]'); if (g) { M.grupo = g.dataset.mgGrupo; render(); return; }
    const ab = e.target.closest('[data-mg-aba]'); if (ab) { M.aba = ab.dataset.mgAba; render(); return; }
    const st = e.target.closest('[data-mg-sit]'); if (st) { M.sit = st.dataset.mgSit; M.manual = null; render(); return; }
    const md = e.target.closest('[data-mg-modo]'); if (md) { M.modo = md.dataset.mgModo; render(); return; }
    if (e.target.closest('[data-mg-meu-lvl]')) { M.level = S.perfil.level; gravar('tc_mg_lvl', ''); render(); return; }
    const ft = e.target.closest('[data-rd-t]');
    if (ft) { const i = +ft.dataset.rdT; const ja = M.sel === i; M.sel = i; if (M.modo === 'manual' && (ja || !matchMedia('(hover: none)').matches)) mexerFatia(i); else render(); return; }
    const ra2 = e.target.closest('[data-rd-aba]'); if (ra2) { M.rdAba = ra2.dataset.rdAba; render(); return; }
    const ir = e.target.closest('[data-an-ir]'); if (ir) { M.rdAba = 'roda'; M.sel = +ir.dataset.anIr; render(); $('#magias-app .rd-svg')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
    const cn = e.target.closest('[data-rd-c]'); if (cn) { M.sel = 'c' + cn.dataset.rdC; render(); return; }
    const ra = e.target.closest('[data-rd-acao]');
    if (ra) { const ac = ra.dataset.rdAcao; if (ac === 'zerar') { if (M.manual) { M.manual.t = new Array(36).fill(0); M.sel = null; } render(); } else if (typeof M.sel === 'number') mexerFatia(M.sel, ac); return; }
    const c = e.target.closest('[data-mg-copiar]');
    if (c) { const t = c.dataset.mgCopiar; navigator.clipboard?.writeText(t).then(() => toast(`Copiado: ${t}`), () => toast('Não deu para copiar.')); }
  });
  document.addEventListener('change', (e) => {
    if (!$('#magias-app')?.contains(e.target)) return;
    if (e.target.dataset?.mg === 'extras') { M.extras = Math.max(0, Math.min(179, parseInt(e.target.value, 10) || 0)); render(); return; }
    if (e.target.dataset?.mgPts && M.manual) { domPorSlider(e.target.dataset.mgPts, +e.target.value || 0); render(); return; }
    if (e.target.dataset?.mg !== 'level') return;
    const n = Math.max(1, Math.min(4999, parseInt(e.target.value, 10) || 1)); M.level = n; gravar('tc_mg_lvl', String(n)); render();
  });
  document.addEventListener('input', (e) => {
    if (e.target.dataset?.mg !== 'busca' || !$('#magias-app')?.contains(e.target)) return;
    clearTimeout(tBusca); tBusca = setTimeout(() => {
      M.busca = e.target.value.slice(0, 40); render();
      const b = $('#magias-app [data-mg="busca"]'); if (b) { b.focus(); b.setSelectionRange(b.value.length, b.value.length); }
    }, 250);
  });
})();

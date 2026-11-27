// TibiaHub — Magias por classe: o que você já usa, o que vem nos próximos levels e as runas que pode fazer.
// Dados: TibiaWiki (CC BY-SA), importados pelo servidor. Todo texto de fora passa por esc().
(() => {
  const M = { lista: null, voc: null, level: null, busca: '', grupo: 'todas', aba: 'magias', sit: 'solo', modo: 'auto', extras: 0, manual: null };
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
    const { data, error } = await sb.from('magias').select('nome,palavras,level,mana,vocacoes,tipo,subclasse,elemento,premium,cooldown,efeito,efeito_pt,runa_qtd,alma,promocao,roda').order('level').order('nome').limit(1000);
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
  const descPerk = (v, n) => (n === 'Gift of Life' ? RODA.comum[n] : n === RODA[v].avatar ? RODA.avatarTxt : RODA[v].perks[n]);
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
  // Desenho da roda: 4 domínios × 9 fatias (50 + 2×75 + 3×100 + 150 + 150 + 200 = 1.000 pontos), enchendo do centro para fora.
  // Regras de nov/2026 — revisar quando sair o Winter Update (a CipSoft pode mexer na roda).
  const RD_QUAD = [180, 270, 0, 90]; // ↖ ↗ ↘ ↙ (graus, sentido horário a partir da direita)
  const RD_COR = ['#4d8a33', '#b23a36', '#8a3aa0', '#2f78ad'];
  const RD_RAIO = [[42, 84], [87, 129], [132, 174], [177, 219]];
  const RD_FATIAS = [[0, 0, 1, 50], [1, 0, 2, 75], [1, 1, 2, 75], [2, 1, 3, 100], [2, 0, 3, 100], [2, 2, 3, 100], [3, 0, 3, 150], [3, 2, 3, 150], [3, 1, 3, 200]];
  const pto = (r, g) => { const t = (g * Math.PI) / 180; return `${(r * Math.cos(t)).toFixed(1)} ${(r * Math.sin(t)).toFixed(1)}`; };
  const setor = (r1, r2, g1, g2) => `M${pto(r1, g1)} L${pto(r2, g1)} A${r2} ${r2} 0 0 1 ${pto(r2, g2)} L${pto(r1, g2)} A${r1} ${r1} 0 0 0 ${pto(r1, g1)} Z`;
  const ROMANO = ['', 'I', 'II', 'III'];
  function rodaSVG(v, nomes, a, pts, usados) {
    const manual = M.modo === 'manual';
    let fatias = '', cantos = '';
    nomes.forEach((n, d) => {
      let acum = 0;
      for (const [anel, pos, qtd, custo] of RD_FATIAS) {
        const [r1, r2] = RD_RAIO[anel], g1 = RD_QUAD[d] + (pos * 90) / qtd, g2 = RD_QUAD[d] + ((pos + 1) * 90) / qtd;
        const cheio = Math.max(0, Math.min(1, (a[n] - acum) / custo)), ate = acum + custo;
        const dica = `${n} · fatia de ${custo} pontos · ${Math.round(cheio * custo)}/${custo}${manual ? (cheio >= 1 ? ' · clique para esvaziar' : ' · clique para encher') : ''}`;
        fatias += `<g class="rd-fatia${manual ? ' clicavel' : ''}" ${manual ? `data-rd-dom="${esc(n)}" data-rd-de="${acum}" data-rd-ate="${ate}" tabindex="0" role="button" aria-label="${esc(dica)}"` : ''}><title>${esc(dica)}</title>
          <path class="rd-vazia" d="${setor(r1, r2, g1, g2)}"/><path class="rd-tinta" d="${setor(r1, r2, g1, g2)}" fill="${RD_COR[d]}"/>${cheio > 0 ? `<path d="${setor(r1, r2, g1, g1 + (g2 - g1) * cheio)}" fill="${RD_COR[d]}" class="rd-cheia${cheio < 1 ? ' parcial' : ''}"/>` : ''}</g>`;
        acum = ate;
      }
      const e = estagio(a[n]), sx = d === 1 || d === 2 ? 1 : -1, sy = d >= 2 ? 1 : -1, cx = sx * 205, cy = sy * 205;
      cantos += `<g class="rd-gema e${e}"><title>${esc(n)} · ${e ? `estágio ${e}` : 'bloqueada'} · ${fmt(a[n])} pontos</title>
        <circle cx="${cx}" cy="${cy}" r="25" fill="${e ? RD_COR[d] : 'var(--card2)'}"/>
        <text x="${cx}" y="${cy + 5}" text-anchor="middle" class="rd-gema-n">${e ? ROMANO[e] : '🔒'}</text>
        <text x="${cx - sx * 27}" y="${cy + sy * 42 + (sy > 0 ? 4 : 0)}" text-anchor="${sx > 0 ? 'end' : 'start'}" class="rd-gema-t">${esc(n)}</text></g>`;
    });
    return `<div class="rd-roda"><svg viewBox="-260 -262 520 524" role="img" aria-label="Roda do Destino: ${nomes.map((n) => `${esc(n)} ${fmt(a[n])} pontos`).join(', ')}">
      <circle r="224" class="rd-aro"/>${fatias}
      <circle r="39" class="rd-centro"/><text y="-2" text-anchor="middle" class="rd-centro-n">${fmt(usados)}</text><text y="15" text-anchor="middle" class="rd-centro-t">de ${fmt(pts)}</text>
      ${cantos}</svg>
      <p class="muted rd-legenda">${manual ? 'Clique numa fatia para encher até ela (ou esvaziar). A roda enche do centro para fora, como no jogo.' : 'Cada domínio enche do centro para fora: 50 → 75 → 100 → 150/200 pontos por fatia. A gema no canto mostra o estágio da Revelation Perk.'}</p></div>`;
  }

  function abaRoda(lvl) {
    const v = M.voc, pts = Math.max(0, lvl - 50) + M.extras, nomes = perksDe(v);
    const auto = recomendada(v, M.sit, pts);
    if (M.modo === 'auto' || !M.manual || M.manual._voc !== v) M.manual = { ...auto, _voc: v };
    const a = M.modo === 'auto' ? auto : M.manual;
    const usados = nomes.reduce((t, n) => t + a[n], 0), bonus = nomes.reduce((t, n) => t + BONUS[estagio(a[n])], 0);
    const prox = (() => { for (let l = lvl + 1; l <= lvl + 600; l++) { const r = recomendada(v, M.sit, Math.max(0, l - 50) + M.extras); const d = nomes.find((n) => estagio(r[n]) > estagio(auto[n])); if (d) return [l, d, estagio(r[d])]; } return null; })();
    return `<div class="mg-grupos">${SITS.map(([k, t]) => `<button type="button" class="chip ${M.sit === k ? 'ativo' : ''}" data-mg-sit="${k}">${t}</button>`).join('')}</div>
      <div class="rd-topo">
        <label class="mg-lvl-campo">Pontos extras<input type="number" min="0" max="179" inputmode="numeric" data-mg="extras" value="${M.extras}" title="Promotion Scrolls, quest do Monk, Hunting Task Shop e mods de gema"></label>
        <div class="rd-modo" role="tablist"><button type="button" class="${M.modo === 'auto' ? 'ativo' : ''}" data-mg-modo="auto">⭐ Recomendada</button><button type="button" class="${M.modo === 'manual' ? 'ativo' : ''}" data-mg-modo="manual">✋ Manual</button></div>
      </div>
      <div class="mg-resumo">
        <div><span>Pontos no level ${fmt(lvl)}</span><b>${fmt(pts)}</b><small class="muted">1 por level acima do 50${M.extras ? ` + ${fmt(M.extras)} extras` : ''}</small></div>
        <div><span>Usados</span><b class="${usados > pts ? 'neg' : ''}">${fmt(usados)} / ${fmt(pts)}</b><small class="muted">${usados > pts ? 'passou do total: tire pontos' : `${fmt(pts - usados)} livres`}</small></div>
        <div><span>Bônus de dano e cura</span><b class="pos">+${bonus}</b><small class="muted">+4 / +9 / +20 por perk nos estágios 1 / 2 / 3</small></div>
      </div>
      ${rodaSVG(v, nomes, a, pts, usados)}
      ${pts < 250 ? '<div class="bloqueio">Ainda não dá para liberar uma Revelation Perk (precisa de 250 pontos num domínio, level 300). Até lá, gaste os pontos nas fatias do centro: vida e mana, resistências e as melhorias das magias que você mais usa.</div>' : ''}
      <div class="rd-grade">${nomes.map((n) => {
        const p = a[n], e = estagio(p), alvo = ESTAGIOS.find((x) => x > p);
        return `<div class="rd-card e${e}"><div class="rd-cab"><b>${esc(n)}</b><span class="rd-est">${e ? `Estágio ${e}` : 'bloqueado'}</span></div>
          <div class="rd-barra" aria-hidden="true"><i style="width:${Math.min(100, p / 10)}%"></i>${ESTAGIOS.map((x) => `<s style="left:${x / 10}%"></s>`).join('')}</div>
          <div class="rd-pts">${M.modo === 'manual' ? `<input type="range" min="0" max="1000" step="25" value="${p}" data-mg-pts="${esc(n)}" aria-label="Pontos em ${esc(n)}">` : ''}<span><b>${fmt(p)}</b> pontos${alvo ? ` · faltam ${fmt(alvo - p)} para o estágio ${ESTAGIOS.indexOf(alvo) + 1}` : ' · máximo'}</span></div>
          <p>${esc(descPerk(v, n))}</p></div>`;
      }).join('')}</div>
      ${M.modo === 'auto' && prox ? `<p class="rd-prox">🎯 Próximo marco: no <b>level ${fmt(prox[0])}</b> esta build libera <b>${esc(prox[1])}</b> no estágio ${prox[2]}.</p>` : ''}
      <h3 class="mg-tit">Melhorias de magia na roda (${esc(VOCS.find((x) => x[0] === v)[1])})</h3>
      <div class="tabela-wrap"><table class="rd-tab"><tr><th>Magia</th><th>1ª fatia completa</th><th>2ª fatia completa</th></tr>${RODA.conv[v].map(([m, i, ii]) => `<tr><td>${porNome().get(m) ? `<button type="button" class="rd-mg" data-mg-info="${esc(m)}">${icone(porNome().get(m))}<b>${esc(m)}</b></button>` : `<b>${esc(m)}</b>`}</td><td>${esc(i)}</td><td>${esc(ii)}</td></tr>`).join('')}</table></div>
      <div class="rd-passivas">${RODA.passivas[v].map(([n, t]) => `<div><b>${esc(n)}</b><span>${esc(t)}</span></div>`).join('')}</div>
      <p class="dica">Como funciona: cada domínio da roda tem 1.000 pontos e uma Revelation Perk; ela liga com 250, melhora com 500 e chega ao máximo com 1.000 pontos no domínio. As melhores melhorias de magia ficam na borda e pedem 575 pontos num caminho (level 625+). A build recomendada é uma sugestão do TibiaHub pela ordem de prioridade de cada jeito de jogar; para conferir cada fatia com os ícones do jogo, use o planejador oficial em tibia.com. Regras de novembro/2026 (TibiaWiki, CC BY-SA): a roda pode mudar no Winter Update e o TibiaHub revisa assim que sair.</p>`;
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

  function mexerFatia(ft) {
    const n = ft.dataset.rdDom, de = +ft.dataset.rdDe, ate = +ft.dataset.rdAte;
    if (!(n in M.manual)) return;
    const total = Math.max(0, (M.level || 1) - 50) + M.extras;
    const outros = Object.entries(M.manual).filter(([k]) => k !== n && k !== '_voc').reduce((t, [, x]) => t + x, 0);
    const quer = M.manual[n] >= ate ? de : ate, novo = Math.min(quer, total - outros);
    if (novo < quer) toast(`Faltam pontos: só dá para colocar ${fmt(Math.max(0, total - outros))} em ${n}.`);
    M.manual[n] = Math.max(0, novo); render();
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
    const ft = e.target.closest?.('[data-rd-dom]'); if (ft && (e.key === 'Enter' || e.key === ' ') && M.manual) { e.preventDefault(); mexerFatia(ft); }
  });
  addEventListener('scroll', () => { if (!pop.hidden) (popFixo ? posicionar() : fecharPop()); }, { passive: true, capture: true });
  addEventListener('resize', () => { if (!pop.hidden) posicionar(); });

  let tBusca;
  document.addEventListener('click', (e) => {
    if (e.target.closest('#menu [data-pag=magias]')) { if (!M.lista) carregar(); else render(); return; }
    const app = $('#magias-app'); if (!app || !app.contains(e.target)) return;
    const v = e.target.closest('[data-mg-voc]'); if (v) { M.voc = v.dataset.mgVoc; gravar('tc_mg_voc', M.voc); render(); return; }
    const g = e.target.closest('[data-mg-grupo]'); if (g) { M.grupo = g.dataset.mgGrupo; render(); return; }
    const ab = e.target.closest('[data-mg-aba]'); if (ab) { M.aba = ab.dataset.mgAba; render(); return; }
    const st = e.target.closest('[data-mg-sit]'); if (st) { M.sit = st.dataset.mgSit; M.manual = null; render(); return; }
    const md = e.target.closest('[data-mg-modo]'); if (md) { M.modo = md.dataset.mgModo; render(); return; }
    if (e.target.closest('[data-mg-meu-lvl]')) { M.level = S.perfil.level; gravar('tc_mg_lvl', ''); render(); return; }
    const ft = e.target.closest('[data-rd-dom]'); if (ft && M.manual) { mexerFatia(ft); return; }
    const c = e.target.closest('[data-mg-copiar]');
    if (c) { const t = c.dataset.mgCopiar; navigator.clipboard?.writeText(t).then(() => toast(`Copiado: ${t}`), () => toast('Não deu para copiar.')); }
  });
  document.addEventListener('change', (e) => {
    if (!$('#magias-app')?.contains(e.target)) return;
    if (e.target.dataset?.mg === 'extras') { M.extras = Math.max(0, Math.min(179, parseInt(e.target.value, 10) || 0)); render(); return; }
    if (e.target.dataset?.mgPts && M.manual) {
      const n = e.target.dataset.mgPts, total = Math.max(0, (M.level || 1) - 50) + M.extras;
      const outros = Object.entries(M.manual).filter(([k]) => k !== n && k !== '_voc').reduce((t, [, v]) => t + v, 0);
      M.manual[n] = Math.max(0, Math.min(1000, +e.target.value || 0, total - outros)); render(); return;
    }
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

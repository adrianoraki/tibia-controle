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
    const { data, error } = await sb.from('magias').select('nome,palavras,level,mana,vocacoes,tipo,subclasse,elemento,premium,cooldown,efeito,runa_qtd,alma,promocao,roda').order('level').order('nome').limit(1000);
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
      ${m.efeito ? `<p class="mg-efeito">${esc(m.efeito)}</p>` : ''}
      <div class="mg-tags">${tags}</div></div>`;
  }

  const SITS = [['solo', '🗡️ Hunt solo'], ['time', '👥 Hunt em time'], ['boss', '💀 Boss']];
  const porNome = () => M._nomes || (M._nomes = new Map(M.lista.map((m) => [m.nome, m])));
  const escolher = (opcoes, lvl) => opcoes.map((n) => porNome().get(n)).find((m) => m && (m.vocacoes || []).includes(M.voc) && (m.level || 0) <= lvl) || null;
  // ícone da magia: a TibiaWiki guarda como "<Nome da magia>.gif" (mesmo esquema dos itens)
  const icone = (m, cls = '') => imgDoItem(m.nome, 'mg-ico ' + cls);
  const chip = (m) => `<button type="button" class="cb-chip" data-mg-copiar="${esc(m.palavras || m.nome)}" title="${esc(m.nome)} · lvl ${fmt(m.level || 0)} · clique para copiar">${icone(m)}<span><b>${esc(m.palavras || m.nome)}</b><small>${esc(m.nome)}</small></span></button>`;
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
      <p class="dica">Combos sugeridos pelo TibiaHub a partir das magias que cada level libera (a lista se atualiza com a TibiaWiki). Repita o combo enquanto as recargas voltam; use potion e cura sempre que precisar. Clique numa magia para copiar as palavras.</p>`;
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
      <div class="tabela-wrap"><table class="rd-tab"><tr><th>Magia</th><th>1ª fatia completa</th><th>2ª fatia completa</th></tr>${RODA.conv[v].map(([m, i, ii]) => `<tr><td><b>${esc(m)}</b></td><td>${esc(i)}</td><td>${esc(ii)}</td></tr>`).join('')}</table></div>
      <div class="rd-passivas">${RODA.passivas[v].map(([n, t]) => `<div><b>${esc(n)}</b><span>${esc(t)}</span></div>`).join('')}</div>
      <p class="dica">Como funciona: cada domínio da roda tem 1.000 pontos e uma Revelation Perk; ela liga com 250, melhora com 500 e chega ao máximo com 1.000 pontos no domínio. As melhores melhorias de magia ficam na borda e pedem 575 pontos num caminho (level 625+). A build recomendada é uma sugestão do TibiaHub pela ordem de prioridade de cada jeito de jogar; para montar fatia por fatia, use o planejador oficial em tibia.com. Regras: TibiaWiki (CC BY-SA).</p>`;
  }

  function render() {
    const el = $('#magias-app'); if (!el || !M.lista) return;
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

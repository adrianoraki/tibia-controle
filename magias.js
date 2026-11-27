// TibiaHub — Magias por classe: o que você já usa, o que vem nos próximos levels e as runas que pode fazer.
// Dados: TibiaWiki (CC BY-SA), importados pelo servidor. Todo texto de fora passa por esc().
(() => {
  const M = { lista: null, voc: null, level: null, busca: '', grupo: 'todas' };
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
      <div class="mg-topo"><b>${esc(m.nome)}</b><span class="mg-lvl">${falta > 0 ? `lvl ${fmt(m.level)} · faltam ${fmt(falta)}` : `lvl ${fmt(m.level || 0)}`}</span></div>
      ${m.palavras ? `<button type="button" class="mg-palavras" data-mg-copiar="${esc(m.palavras)}" title="Copiar as palavras">${esc(m.palavras)}<span aria-hidden="true">⧉</span></button>` : ''}
      <div class="mg-info">${m.mana > 0 ? `<span>💧 ${fmt(m.mana)} mana</span>` : ''}${m.cooldown ? `<span>⏱️ ${seg(m.cooldown)}</span>` : ''}${m.tipo === 'Rune' && m.runa_qtd ? `<span>🔮 faz ${fmt(m.runa_qtd)} runa${m.runa_qtd > 1 ? 's' : ''}${m.alma ? ` · ${fmt(m.alma)} soul` : ''}</span>` : ''}</div>
      ${m.efeito ? `<p class="mg-efeito">${esc(m.efeito)}</p>` : ''}
      <div class="mg-tags">${tags}</div></div>`;
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
    el.innerHTML = `<div class="card">
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
    if (e.target.closest('[data-mg-meu-lvl]')) { M.level = S.perfil.level; gravar('tc_mg_lvl', ''); render(); return; }
    const c = e.target.closest('[data-mg-copiar]');
    if (c) { const t = c.dataset.mgCopiar; navigator.clipboard?.writeText(t).then(() => toast(`Copiado: ${t}`), () => toast('Não deu para copiar.')); }
  });
  document.addEventListener('change', (e) => {
    if (e.target.dataset?.mg !== 'level' || !$('#magias-app')?.contains(e.target)) return;
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

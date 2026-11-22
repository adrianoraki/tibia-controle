// TibiaHub — Desempenho: resultado de cada dia (hunts + Market − gastos), comparação semanal entre o profit
// anotado nas hunts e o que de fato entrou vendendo ao NPC, e métricas por semana e por mês.
(() => {
  let periodo = 'semana';
  try { if (localStorage.getItem('tc_desemp') === 'mes') periodo = 'mes'; } catch { /* ok */ }
  const somaDia = (iso, n) => { const d = new Date(iso + 'T12:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  const diaLocal = (ts) => { const d = new Date(ts); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };
  const segunda = (iso) => { const d = new Date(iso + 'T12:00Z'); return somaDia(iso, -((d.getUTCDay() + 6) % 7)); };
  const dm = (iso) => `${iso.slice(8)}/${iso.slice(5, 7)}`;
  const DIAS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
  const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const pct = (a, b) => (b ? Math.round(((a - b) / Math.abs(b)) * 100) : null);

  // tudo que aconteceu em cada dia
  function porDia() {
    const m = new Map(), d = (k) => m.get(k) || m.set(k, { hunts: 0, nHunts: 0, minutos: 0, npc: 0, market: 0, gastos: 0 }).get(k);
    for (const h of S.hunts || []) { const x = d(h.data); x.hunts += h.profit; x.nHunts++; x.minutos += h.duracao_min || 0; }
    for (const v of S.vendasNpc || []) d(diaLocal(v.criado_em)).npc += v.valor;
    for (const c of S.compras || []) { const r = calcCompra(c); if (r.realizado) d((c.vendido_em ? diaLocal(c.vendido_em) : (c.created_at || '').slice(0, 10)) || hojeISO()).market += r.realizado; }
    for (const g of S.gastos || []) d(g.data).gastos += g.valor;
    for (const x of m.values()) x.resultado = x.hunts + x.market - x.gastos;
    return m;
  }
  const vazio = { hunts: 0, nHunts: 0, minutos: 0, npc: 0, market: 0, gastos: 0, resultado: 0 };
  function somar(m, de, ate) {
    const t = { ...vazio, dias: 0, positivos: 0, negativos: 0 };
    for (let k = de; k <= ate; k = somaDia(k, 1)) {
      const x = m.get(k); if (!x) continue;
      for (const c of Object.keys(vazio)) t[c] += x[c];
      if (x.nHunts || x.gastos || x.market) { t.dias++; if (x.resultado > 0) t.positivos++; else if (x.resultado < 0) t.negativos++; }
    }
    return t;
  }

  // ---------- gráfico do resultado diário (zero no meio: verde para cima, vermelho para baixo) ----------
  function graficoDias(m, de, ate, meta) {
    const dias = []; for (let k = de; k <= ate; k = somaDia(k, 1)) dias.push({ dia: k, ...(m.get(k) || vazio) });
    const W = largura(), H = 230, L = 58, R = 10, T = 14, B = 28, n = dias.length, bw = (W - L - R) / n;
    const maxPos = Math.max(...dias.map((x) => x.resultado), meta || 0, 1), minNeg = Math.min(...dias.map((x) => x.resultado), 0), temNeg = minNeg < 0;
    const topo = maxPos, base = temNeg ? Math.min(minNeg, -maxPos * 0.15) : 0, y = (v) => T + (H - T - B) * (1 - (v - base) / (topo - base)), max = maxPos;
    const pos = corTema('--verde'), neg = corTema('--verm'), ouro = corTema('--ouro'), grade = corTema('--grade'), eixo = corTema('--muted');
    let s = `<svg viewBox="0 0 ${W} ${H}" width="100%" class="ds-svg" role="img" aria-label="Resultado de cada dia">`;
    for (const v of temNeg ? [base, 0, max / 2, max] : [0, max / 3, (2 * max) / 3, max])
      s += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="${grade}" ${v === 0 ? `stroke-width="1.5" stroke="${eixo}" stroke-opacity=".6"` : ''}/><text x="${L - 6}" y="${y(v) + 4}" fill="${eixo}" font-size="11" text-anchor="end">${fmtC(v)}</text>`;
    if (meta) s += `<line x1="${L}" x2="${W - R}" y1="${y(meta)}" y2="${y(meta)}" stroke="${ouro}" stroke-dasharray="5 4" stroke-width="1.5"/><text x="${L + 6}" y="${y(meta) - 5}" fill="${ouro}" font-size="11">meta ${fmtC(meta)}</text>`;
    dias.forEach((x, i) => {
      const cx = L + i * bw, w = Math.max(4, Math.min(34, bw * 0.62)), bx = cx + (bw - w) / 2, v = x.resultado;
      if (v) {
        const y0 = y(0), y1 = y(v), h = Math.max(2, Math.abs(y1 - y0)), r = Math.min(4, w / 2, h);
        s += v > 0 ? `<path d="M${bx},${y0}v${-(h - r)}a${r},${r} 0 0 1 ${r},${-r}h${w - 2 * r}a${r},${r} 0 0 1 ${r},${r}v${h - r}z" fill="${pos}" ${meta && v < meta ? 'fill-opacity=".55"' : ''}/>`
          : `<path d="M${bx},${y0}v${h - r}a${r},${r} 0 0 0 ${r},${r}h${w - 2 * r}a${r},${r} 0 0 0 ${r},${-r}v${-(h - r)}z" fill="${neg}"/>`;
      }
      s += `<rect class="ds-hit" data-i="${i}" x="${cx}" y="${T}" width="${bw}" height="${H - T - B}" fill="transparent"/>`;
      if (n <= 10 || i % 5 === 0 || i === n - 1) s += `<text x="${cx + bw / 2}" y="${H - 9}" fill="${eixo}" font-size="11" text-anchor="middle">${n <= 10 && bw >= 70 ? DIAS[new Date(x.dia + 'T12:00Z').getUTCDay()] + ' ' : ''}${dm(x.dia)}</text>`;
    });
    $('#card-desempenho')._dias = dias;
    return s + '</svg>';
  }

  // ---------- hunts × vendido ao NPC, semana a semana ----------
  function graficoSemanas(semanas) {
    const W = largura(), H = 200, L = 58, R = 10, T = 12, B = 28, n = semanas.length, gw = (W - L - R) / n;
    const max = Math.max(...semanas.flatMap((s) => [s.hunts, s.npc]), 1), y = (v) => T + (H - T - B) * (1 - Math.max(0, v) / max);
    const ouro = corTema('--ouro'), verde = corTema('--verde'), grade = corTema('--grade'), eixo = corTema('--muted');
    let s = `<svg viewBox="0 0 ${W} ${H}" width="100%" class="ds-svg" role="img" aria-label="Profit das hunts e vendido ao NPC por semana">`;
    for (let i = 0; i <= 3; i++) { const v = (max * i) / 3; s += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="${grade}"/><text x="${L - 6}" y="${y(v) + 4}" fill="${eixo}" font-size="11" text-anchor="end">${fmtC(v)}</text>`; }
    semanas.forEach((w, i) => {
      const gx = L + i * gw, bw = Math.min(26, gw * 0.32), x1 = gx + gw / 2 - bw - 1, x2 = gx + gw / 2 + 1;
      for (const [x, v, c] of [[x1, w.hunts, ouro], [x2, w.npc, verde]]) if (v > 0) { const h = Math.max(2, y(0) - y(v)), r = Math.min(4, h); s += `<path d="M${x},${y(0)}v${-(h - r)}a${r},${r} 0 0 1 ${r},${-r}h${bw - 2 * r}a${r},${r} 0 0 1 ${r},${r}v${h - r}z" fill="${c}"/>`; }
      s += `<rect class="ds-hit-s" data-i="${i}" x="${gx}" y="${T}" width="${gw}" height="${H - T - B}" fill="transparent"/><text x="${gx + gw / 2}" y="${H - 9}" fill="${eixo}" font-size="11" text-anchor="middle">${dm(w.de)}</text>`;
    });
    $('#card-desempenho')._semanas = semanas;
    return s + '</svg>';
  }

  const largura = () => Math.max(380, ($('#card-desempenho')?.clientWidth || 800) - 40);
  const delta = (a, b) => { const p = pct(a, b); return p == null ? '' : `<small class="${p >= 0 ? 'pos' : 'neg'}"> ${p >= 0 ? '▲' : '▼'} ${Math.abs(p)}%</small>`; };

  function render() {
    const el = $('#card-desempenho'); if (!el || !S.perfil) return;
    const m = porDia(), hoje = hojeISO(), meta = S.perfil.meta_diaria || 0;
    let de, ate = hoje, deAnt, ateAnt, nome;
    if (periodo === 'semana') { de = segunda(hoje); deAnt = somaDia(de, -7); ateAnt = somaDia(de, -1); nome = 'esta semana'; ate = somaDia(de, 6); }
    else { de = hoje.slice(0, 8) + '01'; const fim = new Date(Date.UTC(+hoje.slice(0, 4), +hoje.slice(5, 7), 0)).toISOString().slice(0, 10); ate = fim;
      const ant = new Date(Date.UTC(+hoje.slice(0, 4), +hoje.slice(5, 7) - 2, 1)).toISOString().slice(0, 10); deAnt = ant; ateAnt = somaDia(de, -1); nome = 'este mês'; }
    // compara o período atual até hoje com o mesmo trecho do período anterior
    const corridos = Math.round((new Date(hoje + 'T12:00Z') - new Date(de + 'T12:00Z')) / 864e5);
    const a = somar(m, de, hoje), b = somar(m, deAnt, [somaDia(deAnt, corridos), ateAnt].sort()[0]);
    const vendaPct = a.hunts > 0 ? Math.round((a.npc / a.hunts) * 100) : null;
    let melhor = null; for (let k = de; k <= hoje; k = somaDia(k, 1)) { const x = m.get(k); if (x && x.resultado && (!melhor || x.resultado > melhor.v)) melhor = { k, v: x.resultado }; }

    // 8 semanas e 6 meses
    const semanas = []; for (let k = 7; k >= 0; k--) { const s0 = somaDia(segunda(hoje), -7 * k); semanas.push({ de: s0, ...somar(m, s0, somaDia(s0, 6)) }); }
    const meses = []; for (let k = 5; k >= 0; k--) { const d = new Date(Date.UTC(+hoje.slice(0, 4), +hoje.slice(5, 7) - 1 - k, 1)), d0 = d.toISOString().slice(0, 10), d1 = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).toISOString().slice(0, 10); meses.push({ de: d0, nome: `${MESES[d.getUTCMonth()]}/${String(d.getUTCFullYear()).slice(2)}`, ...somar(m, d0, d1) }); }
    const metaSem = S.perfil.meta_semanal || 0, metaMes = S.perfil.meta_mensal || 0;
    const linhaTab = (r, rot, metaP) => `<tr><td>${rot}</td><td class="num">${r.nHunts || '—'}</td><td class="num ${cls(r.hunts)}">${fmt(r.hunts)}</td><td class="num">${r.npc ? fmt(r.npc) : '—'}</td><td class="num">${r.market ? fmt(r.market) : '—'}</td><td class="num">${r.gastos ? `<span class="neg">−${fmt(r.gastos)}</span>` : '—'}</td>` +
      `<td class="num ${cls(r.resultado)}"><b>${fmt(r.resultado)}</b></td><td class="num">${r.positivos}<span class="muted">/${r.dias}</span></td><td class="num">${metaP ? metaDif(r.resultado - metaP) : '<span class="muted">—</span>'}</td></tr>`;
    const cab = '<tr><th>Período</th><th class="num">Hunts</th><th class="num">Profit hunts</th><th class="num">Vendido NPC</th><th class="num">Lucro Market</th><th class="num">Gastos</th><th class="num">Resultado</th><th class="num" title="Dias com resultado positivo / dias com movimento">Dias +</th><th class="num">vs meta</th></tr>';

    el.innerHTML = `<div class="card-topo"><h2>Desempenho</h2><div class="seg" role="group" aria-label="Período">` +
        `<button type="button" data-ds="semana" class="${periodo === 'semana' ? 'ativo' : ''}" aria-pressed="${periodo === 'semana'}">Semana</button>` +
        `<button type="button" data-ds="mes" class="${periodo === 'mes' ? 'ativo' : ''}" aria-pressed="${periodo === 'mes'}">Mês</button></div></div>` +
      `<div class="grid linha-kpis ds-kpis">` +
        kpi(`Resultado ${nome}`, `<span class="${cls(a.resultado)}">${fmt(a.resultado)}</span>${delta(a.resultado, b.resultado)}`, 'ouro') +
        kpi('Profit das hunts', `${fmt(a.hunts)}${delta(a.hunts, b.hunts)}`) +
        kpi(`Vendido ao NPC${vendaPct != null ? ` · ${vendaPct}% do profit` : ''}`, fmt(a.npc)) +
        kpi('Gastos extras', a.gastos ? `<span class="neg">−${fmt(a.gastos)}</span>` : '0') +
        kpi('Dias positivos', a.dias ? `${a.positivos}<small class="muted"> de ${a.dias}${a.negativos ? ` · ${a.negativos} no vermelho` : ''}</small>` : '—') +
        kpi('Melhor dia', melhor ? `${fmtC(melhor.v)}<small class="muted"> ${dm(melhor.k)}</small>` : '—') + `</div>` +
      `<p class="dica ds-comp">Comparando com o mesmo trecho ${periodo === 'semana' ? 'da semana passada' : 'do mês passado'} (até o ${corridos + 1}º dia). Resultado do dia = profit das hunts + lucro do Market − gastos extras.</p>` +
      `<div class="ds-graf"><b class="ds-sub">Resultado de cada dia</b>${graficoDias(m, de, ate, meta)}<div class="ds-leg"><span><i style="background:var(--verde)"></i>dia positivo${meta ? ' (forte: bateu a meta)' : ''}</span><span><i style="background:var(--verm)"></i>dia no vermelho</span>${meta ? '<span><i class="tracejado"></i>meta diária</span>' : ''}</div><div class="ds-tip hidden"></div></div>` +
      `<div class="ds-graf"><b class="ds-sub">Profit das hunts × vendido ao NPC, por semana</b>${graficoSemanas(semanas)}<div class="ds-leg"><span><i style="background:var(--ouro)"></i>profit anotado nas hunts</span><span><i style="background:var(--verde)"></i>vendido ao NPC (entrou no banco)</span></div><div class="ds-tip hidden"></div></div>` +
      `<details class="ds-tabela" open><summary>Semana a semana</summary><div class="tabela-wrap"><table>${cab}${semanas.slice().reverse().map((w) => linhaTab(w, `${dm(w.de)} a ${dm(somaDia(w.de, 6))}${w.de === segunda(hoje) ? ' <small class="muted">(atual)</small>' : ''}`, metaSem)).join('')}</table></div></details>` +
      `<details class="ds-tabela"><summary>Mês a mês</summary><div class="tabela-wrap"><table>${cab}${meses.slice().reverse().map((x) => linhaTab(x, x.nome, metaMes)).join('')}</table></div></details>`;
  }

  // dicas ao passar o mouse
  document.addEventListener('mousemove', (e) => {
    const card = $('#card-desempenho'); if (!card) return;
    const hit = e.target.closest?.('.ds-hit, .ds-hit-s');
    card.querySelectorAll('.ds-tip').forEach((t) => { if (!hit || !t.parentElement.contains(hit)) t.classList.add('hidden'); });
    if (!hit || !card.contains(hit)) return;
    const box = hit.closest('.ds-graf'), tip = $('.ds-tip', box), r = box.getBoundingClientRect();
    if (hit.classList.contains('ds-hit')) {
      const x = card._dias?.[+hit.dataset.i]; if (!x) return;
      tip.innerHTML = `<b>${DIAS[new Date(x.dia + 'T12:00Z').getUTCDay()]} ${fmtData(x.dia)}</b><span class="${cls(x.resultado)}">${x.resultado ? fmt(x.resultado) : 'sem movimento'}</span>` +
        (x.nHunts ? `<small>Hunts (${x.nHunts}): ${fmt(x.hunts)}</small>` : '') + (x.market ? `<small>Market: +${fmt(x.market)}</small>` : '') +
        (x.gastos ? `<small class="neg">Gastos: −${fmt(x.gastos)}</small>` : '') + (x.npc ? `<small class="pos">Vendido ao NPC: ${fmt(x.npc)}</small>` : '');
    } else {
      const w = card._semanas?.[+hit.dataset.i]; if (!w) return;
      tip.innerHTML = `<b>${dm(w.de)} a ${dm(somaDia(w.de, 6))}</b><small>Profit hunts: ${fmt(w.hunts)}</small><small class="pos">Vendido ao NPC: ${fmt(w.npc)}</small>` +
        (w.hunts > 0 ? `<small class="muted">${Math.round((w.npc / w.hunts) * 100)}% do profit já virou ouro</small>` : '');
    }
    tip.classList.remove('hidden');
    tip.style.left = Math.min(r.width - 190, Math.max(0, e.clientX - r.left + 14)) + 'px'; tip.style.top = Math.max(0, e.clientY - r.top - 80) + 'px';
  });
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-ds]'); if (!b) return;
    periodo = b.dataset.ds === 'mes' ? 'mes' : 'semana'; try { localStorage.setItem('tc_desemp', periodo); } catch { /* ok */ } render();
  });

  let rz; window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(render, 200); });
  window.renderDesempenho = render;
  const painelOriginal = window.renderPainel;
  window.renderPainel = function () { painelOriginal(); render(); };
  if (S.perfil) render();
})();

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
    const m = new Map(), d = (k) => m.get(k) || m.set(k, { hunts: 0, nHunts: 0, minutos: 0, npc: 0, market: 0, gastos: 0, loot: 0, supplies: 0 }).get(k);
    for (const h of S.hunts || []) { const x = d(h.data); x.hunts += h.profit; x.loot += h.loot || 0; x.supplies += h.gasto || 0; x.nHunts++; x.minutos += h.duracao_min || 0; }
    for (const v of S.vendasNpc || []) d(diaLocal(v.criado_em)).npc += v.valor;
    for (const c of S.compras || []) { const r = calcCompra(c); if (r.realizado) d((c.vendido_em ? diaLocal(c.vendido_em) : (c.created_at || '').slice(0, 10)) || hojeISO()).market += r.realizado; }
    for (const g of S.gastos || []) d(g.data).gastos += g.valor;
    for (const x of m.values()) x.resultado = x.hunts + x.market - x.gastos;
    return m;
  }
  const vazio = { hunts: 0, nHunts: 0, minutos: 0, npc: 0, market: 0, gastos: 0, resultado: 0, loot: 0, supplies: 0 };
  function somar(m, de, ate) {
    const t = { ...vazio, dias: 0, positivos: 0, negativos: 0, diasHunt: 0 };
    for (let k = de; k <= ate; k = somaDia(k, 1)) {
      const x = m.get(k); if (!x) continue;
      for (const c of Object.keys(vazio)) t[c] += x[c];
      if (x.nHunts) t.diasHunt++;
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
  const delta = (a, b) => { if (!premium()) return ''; const p = pct(a, b); return p == null ? '' : `<small class="${p >= 0 ? 'pos' : 'neg'}"> ${p >= 0 ? '▲' : '▼'} ${Math.abs(p)}%</small>`; };

  const ABERTOS = new Set();   // períodos abertos na tabela (semana ou mês)
  const fimMes = (d0) => new Date(Date.UTC(+d0.slice(0, 4), +d0.slice(5, 7), 0)).toISOString().slice(0, 10);
  document.addEventListener('click', (e) => {
    const b = e.target.closest('#card-desempenho [data-ds-abrir]'); if (!b) return;
    const k = String(b.dataset.dsAbrir).slice(0, 21); if (ABERTOS.has(k)) ABERTOS.delete(k); else ABERTOS.add(k);
    render(); document.querySelector(`#card-desempenho [data-ds-abrir="${k}"]`)?.focus();
  });
  function render() {
    const el = $('#card-desempenho'); if (!el || !S.perfil) return;
    const vip = premium(); if (!vip) periodo = 'semana';   // grátis: só a semana atual, sem comparação nem histórico
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
    // vs meta igual ao saldo da meta diária: profit das hunts − meta diária × dias com hunt (dia sem jogar não conta como falta)
    const md = metasDe(S.perfil).dia;
    const vsMeta = (r) => { if (!md) return '<span class="muted">defina</span>'; if (!r.diasHunt) return '<span class="muted">—</span>'; const alvo = md * r.diasHunt, d = r.hunts - alvo;
      return `<span title="Meta: ${fmt(md)} × ${r.diasHunt} dia${r.diasHunt > 1 ? 's' : ''} com hunt = ${fmt(alvo)}">${Math.abs(d) < 1000 ? '<span class="pos">em dia</span>' : d > 0 ? `<span class="pos">sobra ${fmtC(d)}</span>` : `<span class="neg">falta ${fmtC(-d)}</span>`}<small class="muted"> · ${r.diasHunt}d</small></span>`; };
    // detalhe de um período: cada dia com o profit e se bateu a meta (mesma regra do saldo: só dias com hunt contam)
    const detalhe = (de0, ate0, soMov) => {
      // 1ª passada: quem cobriu quem (a falta de um dia é paga pela sobra de dias antes ou depois, na ordem)
      const lista = []; for (let k = de0; k <= ate0 && k <= hoje; k = somaDia(k, 1)) { const x = m.get(k) || vazio; if (soMov && !x.nHunts && !x.market && !x.gastos) continue; lista.push([k, x]); }
      const nota = new Map(), add = (k, t) => (nota.get(k) || nota.set(k, []).get(k)).push(t);
      if (md) {
        const creditos = [], dividas = [];
        for (const [k, x] of lista) {
          if (!x.nHunts) continue; const d = x.hunts - md;
          if (d < -999) {
            let falta = -d; const de = [];
            while (falta > 0 && creditos.length) { const c = creditos[0], v = Math.min(falta, c.v); c.v -= v; falta -= v; de.push([c.k, v]); add(c.k, `<span class="pos">usou ${fmtC(v)} para cobrir ${dm(k)}</span>`); if (c.v <= 0) creditos.shift(); }
            if (de.length) add(k, `<span class="pos">✓ ${fmtC(-d - falta)} coberto pela sobra de ${de.map(([kk]) => dm(kk)).join(', ')}</span>`);
            if (falta > 0) dividas.push({ k, v: falta, total: falta });
          } else if (d > 999) {
            let sobra = d;
            while (sobra > 0 && dividas.length) { const q = dividas[0], v = Math.min(sobra, q.v); q.v -= v; sobra -= v; add(k, `<span class="pos">cobriu ${fmtC(v)} que faltou em ${dm(q.k)}</span>`); add(q.k, `<span class="pos">✓ ${fmtC(v)} coberto em ${dm(k)}</span>`); if (q.v <= 0) dividas.shift(); }
            if (sobra > 0) creditos.push({ k, v: sobra });
          }
        }
        for (const q of dividas) if (q.v > 0) add(q.k, `<span class="neg">ainda falta ${fmtC(q.v)}</span>`);
        for (const c of creditos) if (c.v > 0) add(c.k, `<span class="muted">sobram ${fmtC(c.v)} de saldo</span>`);
      }
      const dias = []; let saldo = 0, bateu = 0, jogou = 0, tot = 0, melhor = null, pior = null;
      for (const [k, x] of lista) {
        const dia = `${DIAS[new Date(k + 'T12:00Z').getUTCDay()]} ${dm(k)}${k === hoje ? ' <small class="ds-hoje">hoje</small>' : ''}`;
        if (!x.nHunts) { dias.push(`<div class="ds-dia vazio"><div class="ds-dia-cab"><b>${dia}</b></div><span class="ds-dia-v muted">—</span><small class="muted">sem hunt · não conta para a meta</small></div>`); continue; }
        jogou++; tot += x.hunts;
        if (!melhor || x.hunts > melhor.v) melhor = { k, v: x.hunts }; if (!pior || x.hunts < pior.v) pior = { k, v: x.hunts };
        const d = md ? x.hunts - md : null; if (d != null) { saldo += d; if (d >= -999) bateu++; }
        const coberto = d != null && d < -999 && !(nota.get(k) || []).some((t) => t.includes('ainda falta'));
        const pill = d == null ? '' : Math.abs(d) < 1000 ? '<span class="ds-pill ok">✓ bateu</span>' : d > 0 ? `<span class="ds-pill ok">sobrou ${fmtC(d)}</span>` : `<span class="ds-pill nao">faltou ${fmtC(-d)}</span>`;
        const larg = md ? Math.max(4, Math.min(100, (x.hunts / md) * 100)) : 0;
        dias.push(`<div class="ds-dia ${d == null ? '' : d >= -999 ? 'ok' : coberto ? 'coberto' : 'nao'}"><div class="ds-dia-cab"><b>${dia}</b>${pill}</div>
          <span class="ds-dia-v ${cls(x.hunts)}">${fmtC(x.hunts)}</span>
          ${md ? `<div class="ds-dia-barra" title="${Math.round((x.hunts / md) * 100)}% da meta de ${fmtC(md)}"><i style="width:${larg}%"></i></div>` : ''}
          ${(nota.get(k) || []).map((t) => `<small class="ds-nota">${t}</small>`).join('')}
          <small class="muted">${x.nHunts} hunt${x.nHunts > 1 ? 's' : ''}${x.loot ? ` · loot ${fmtC(x.loot)}` : ''}${x.supplies ? ` · supplies ${fmtC(x.supplies)}` : ''}${x.npc ? ` · NPC ${fmtC(x.npc)}` : ''}</small>
          ${md ? `<small class="ds-saldo-ac ${saldo >= 0 ? 'pos' : 'neg'}">saldo até aqui ${saldo >= 0 ? '+' : '−'}${fmtC(Math.abs(saldo))}</small>` : ''}</div>`);
      }
      if (!dias.length) return '<p class="muted">Nenhum dia com movimento nesse período.</p>';
      const alvo = md * jogou, topo = !jogou ? '' : `<div class="ds-det-resumo">
        ${md ? `<div class="ds-det-saldo ${saldo >= -999 ? 'pos' : 'neg'}"><small>Saldo da meta no período</small><b>${Math.abs(saldo) < 1000 ? 'em dia' : `${saldo > 0 ? 'sobra +' : 'falta −'}${fmtC(Math.abs(saldo))}`}</b><small class="muted">${fmtC(tot)} de ${fmtC(alvo)} (${fmtC(md)} × ${jogou} dia${jogou > 1 ? 's' : ''})</small></div>` : '<div class="ds-det-saldo"><small>Defina a meta diária para ver o saldo</small></div>'}
        <div><small class="muted">Bateu a meta</small><b>${md ? `${bateu} de ${jogou} dias` : '—'}</b></div>
        <div><small class="muted">Média por dia jogado</small><b>${fmtC(Math.round(tot / jogou))}</b></div>
        <div><small class="muted">Melhor dia</small><b class="pos">${fmtC(melhor.v)} <small class="muted">${dm(melhor.k)}</small></b></div>
        ${jogou > 1 ? `<div><small class="muted">Pior dia</small><b class="${cls(pior.v)}">${fmtC(pior.v)} <small class="muted">${dm(pior.k)}</small></b></div>` : ''}</div>`;
      return topo + `<div class="ds-dias">${dias.join('')}</div>`;
    };
    const linhaTab = (r, rot, de0, ate0, soMov) => { const ch = `${de0}:${ate0}`, ab = ABERTOS.has(ch);
      return `<tr class="ds-lin ${ab ? 'aberta' : ''}"><td><button type="button" class="ds-abrir" data-ds-abrir="${ch}" aria-expanded="${ab}">${ab ? '▾' : '▸'} ${rot}</button></td><td class="num">${r.nHunts || '—'}</td><td class="num">${r.loot ? fmt(r.loot) : '—'}</td><td class="num">${r.supplies + r.gastos ? `<span class="neg" title="Supplies das hunts: ${fmt(r.supplies)}${r.gastos ? ` · gastos extras: ${fmt(r.gastos)}` : ''}">−${fmt(r.supplies + r.gastos)}</span>` : '—'}</td><td class="num ${cls(r.market)}">${r.market ? fmt(r.market) : '—'}</td><td class="num">${r.npc ? fmt(r.npc) : '—'}</td>` +
      `<td class="num ${cls(r.resultado)}"><b>${fmt(r.resultado)}</b></td><td class="num">${r.positivos}<span class="muted">/${r.dias}</span></td><td class="num">${vsMeta(r)}</td></tr>${ab ? `<tr class="ds-det"><td colspan="9">${detalhe(de0, ate0, soMov)}</td></tr>` : ''}`; };
    const cab = '<tr><th>Período</th><th class="num">Hunts</th><th class="num" title="Loot anotado nas hunts">Loot</th><th class="num" title="Supplies das hunts + gastos extras">Gastos</th><th class="num" title="Lucro do que você comprou no Market e vendeu no NPC, no dia em que marcou a venda">Lucro Market</th><th class="num" title="O que entrou no banco vendendo ao NPC (já está dentro do loot)">Vendido NPC</th><th class="num" title="Loot − gastos + lucro do Market">Resultado</th><th class="num" title="Dias com resultado positivo / dias com movimento">Dias +</th><th class="num" title="Profit das hunts menos a meta diária vezes os dias com hunt (igual ao saldo das Metas)">Meta (saldo)</th></tr>';

    el.innerHTML = `<div class="card-topo"><h2>Desempenho</h2><div class="seg" role="group" aria-label="Período">` +
        `<button type="button" data-ds="semana" class="${periodo === 'semana' ? 'ativo' : ''}" aria-pressed="${periodo === 'semana'}">Semana</button>` +
        `<button type="button" data-ds="mes" class="${periodo === 'mes' ? 'ativo' : ''}" aria-pressed="${periodo === 'mes'}"${vip ? '' : ' title="Para apoiadores"'}>Mês${vip ? '' : ' 🔒'}</button></div></div>` +
      `<div class="grid linha-kpis ds-kpis">` +
        kpi(`Resultado ${nome}`, `<span class="${cls(a.resultado)}">${fmt(a.resultado)}</span>${delta(a.resultado, b.resultado)}`, 'ouro') +
        (a.loot ? kpi('Loot', `${fmt(a.loot)}${delta(a.loot, b.loot)}`) : '') +
        kpi(`Vendido ao NPC${vendaPct != null ? ` · ${vendaPct}% do profit` : ''}`, fmt(a.npc)) +
        (a.supplies + a.gastos ? kpi('Gastos', `<span class="neg">−${fmt(a.supplies + a.gastos)}</span><small class="muted"> supplies${a.gastos ? ' + extras' : ''}</small>`) : '') + (a.market ? kpi('Lucro Market', `<span class="${cls(a.market)}">${fmt(a.market)}</span>`) : '') +
        kpi('Dias positivos', a.dias ? `${a.positivos}<small class="muted"> de ${a.dias}${a.negativos ? ` · ${a.negativos} no vermelho` : ''}</small>` : '—') +
        kpi('Melhor dia', melhor ? `${fmtC(melhor.v)}<small class="muted"> ${dm(melhor.k)}</small>` : '—') + `</div>` +
      (vip ? '' : '<p class="dica ds-comp">Para apoiadores: comparação com a semana e o mês anteriores, gráfico das últimas 8 semanas e tabelas de até 6 meses.</p>') +
      (!vip ? '' : `<p class="dica ds-comp">Comparando com o mesmo trecho ${periodo === 'semana' ? 'da semana passada' : 'do mês passado'} (até o ${corridos + 1}º dia). Resultado do dia = loot − gastos (supplies das hunts + gastos extras) + lucro do Market, contado no dia em que você marcou a venda.</p>`) +
      `<div class="ds-graf"><b class="ds-sub">Resultado de cada dia</b>${graficoDias(m, de, ate, meta)}<div class="ds-leg"><span><i style="background:var(--verde)"></i>dia positivo${meta ? ' (forte: bateu a meta)' : ''}</span><span><i style="background:var(--verm)"></i>dia no vermelho</span>${meta ? '<span><i class="tracejado"></i>meta diária</span>' : ''}</div><div class="ds-tip hidden"></div></div>` +
      (!vip ? bloqueado('Gráfico das últimas 8 semanas (profit das hunts × vendido ao NPC) e tabelas semana a semana e mês a mês. Para apoiadores do TibiaHub.') :
      `<div class="ds-graf"><b class="ds-sub">Profit das hunts × vendido ao NPC, por semana</b>${graficoSemanas(semanas)}<div class="ds-leg"><span><i style="background:var(--ouro)"></i>profit anotado nas hunts</span><span><i style="background:var(--verde)"></i>vendido ao NPC (entrou no banco)</span></div><div class="ds-tip hidden"></div></div>` +
      `<details class="ds-tabela" open><summary>Semana a semana</summary><div class="tabela-wrap"><table>${cab}${semanas.slice().reverse().map((w) => linhaTab(w, `${dm(w.de)} a ${dm(somaDia(w.de, 6))}${w.de === segunda(hoje) ? ' <small class="muted">(atual)</small>' : ''}`, w.de, somaDia(w.de, 6), false)).join('')}</table></div></details>` +
      `<details class="ds-tabela" ${meses.some((x) => ABERTOS.has(`${x.de}:${fimMes(x.de)}`)) ? 'open' : ''}><summary>Mês a mês</summary><div class="tabela-wrap"><table>${cab}${meses.slice().reverse().map((x) => linhaTab(x, x.nome, x.de, fimMes(x.de), true)).join('')}</table></div></details>`);
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
    if (b.dataset.ds === 'mes' && !premium()) { toast('A visão do mês é para apoiadores.'); return; }
    periodo = b.dataset.ds === 'mes' ? 'mes' : 'semana'; try { localStorage.setItem('tc_desemp', periodo); } catch { /* ok */ } render();
  });

  let rz; window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(render, 200); });
  window.renderDesempenho = render;
  const painelOriginal = window.renderPainel;
  window.renderPainel = function () { painelOriginal(); render(); };
  if (S.perfil) render();
})();

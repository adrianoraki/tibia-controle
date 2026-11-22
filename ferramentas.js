// TibiaHub — Ferramentas: calculadora de imbuements, divisão de loot da party e timers do dia.
// Preços digitados ficam só neste navegador (localStorage). Todo texto de fora passa por esc().
(() => {
  const F = { aba: 'imbuements', imbs: null, sel: null, party: null, timers: null };
  // taxas cobradas no shrine (desde o fim da chance de falha todo imbuement é 100%); ficam editáveis
  const TAXA = { Basic: 7500, Intricate: 60000, Powerful: 250000 }, TOKENS = { Basic: 2, Intricate: 4, Powerful: 6 }, HORAS = 20;
  const ler = (k, padrao) => { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? padrao; } catch { return padrao; } };
  const gravar = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ok */ } };
  const precos = () => ler('tc_imb_precos', {});

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
        <label class="fr-campo">Imbuement<select data-fr="imb">${tipos.map((t) => `<optgroup label="${esc(t)}">${F.imbs.filter((i) => i.tipo === t).map((i) => `<option value="${esc(i.nome)}" ${i.nome === im.nome ? 'selected' : ''}>${esc(i.nome)}</option>`).join('')}</optgroup>`).join('')}</select></label>
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
        <p class="dica">A taxa do shrine vem preenchida com o valor atual (Basic 7.500 · Intricate 60.000 · Powerful 250.000) e pode ser corrigida. Os preços que você digitar ficam salvos neste navegador e valem para todos os imbuements que usam o mesmo material. Lista de imbuements e materiais: TibiaWiki (CC BY-SA).</p>
      </div></div>`;
  }

  // ---------- divisão de loot ----------
  function abaParty() {
    const pt = F.party || (F.party = ler('tc_party', { jogadores: [{ nome: '', loot: null, gasto: null }, { nome: '', loot: null, gasto: null }] }));
    const js = pt.jogadores, total = js.reduce((t, j) => t + (j.loot || 0) - (j.gasto || 0), 0), n = js.length, parte = n ? total / n : 0;
    // cada um deve terminar com: o que gastou + a parte do lucro. Saldo = (loot - gasto) - parte
    const saldos = js.map((j, i) => ({ i, nome: j.nome || `Jogador ${i + 1}`, s: Math.round((j.loot || 0) - (j.gasto || 0) - parte) }));
    const dev = saldos.filter((x) => x.s > 0).map((x) => ({ ...x })), rec = saldos.filter((x) => x.s < 0).map((x) => ({ ...x, s: -x.s })), tr = [];
    dev.sort((a, b) => b.s - a.s); rec.sort((a, b) => b.s - a.s);
    for (const d of dev) for (const r of rec) { if (!d.s) break; const v = Math.min(d.s, r.s); if (v > 0) { tr.push({ de: d.nome, para: r.nome, v }); d.s -= v; r.s -= v; } }
    return `<div class="fr-grid"><div class="fr-col"><p class="muted">Digite quanto de loot cada um está segurando e quanto gastou de supplies (Party Hunt Analyser). O site divide o lucro em partes iguais e diz quem transfere para quem.</p>
      <div class="fr-rolar"><table class="fr-tab"><tr><th>Jogador</th><th class="num">Loot com ele</th><th class="num">Supplies gastos</th><th class="num">Fica com</th><th></th></tr>
      ${js.map((j, i) => `<tr><td><input data-fr-party="nome" data-i="${i}" maxlength="30" placeholder="Jogador ${i + 1}" value="${esc(j.nome || '')}"></td>
        <td class="num"><input class="qtd" data-fr-party="loot" data-i="${i}" data-gold data-sem-dica placeholder="0" value="${j.loot != null ? fmt(j.loot) : ''}"></td>
        <td class="num"><input class="qtd" data-fr-party="gasto" data-i="${i}" data-gold data-sem-dica placeholder="0" value="${j.gasto != null ? fmt(j.gasto) : ''}"></td>
        <td class="num"><b>${fmt((j.gasto || 0) + parte)}</b></td><td>${n > 2 ? `<button class="del" type="button" data-fr-party-del="${i}" title="Tirar jogador">✕</button>` : ''}</td></tr>`).join('')}</table></div>
      <div class="fr-linha">${n < 10 ? '<button type="button" class="btn sec mini-btn" data-fr-party-add>+ Jogador</button>' : ''}<button type="button" class="btn sec mini-btn" data-fr-party-limpar>Limpar</button></div></div>
      <div class="fr-col fr-resumo"><div class="fr-total"><span>Lucro da party</span><b class="${cls(total)}">${fmt(total)}</b><small class="muted">${n} jogadores · ${fmt(parte)} para cada</small></div>
        <div class="mp-sub">Transferências</div>${tr.length ? tr.map((t) => `<div class="fr-transf"><span><b>${esc(t.de)}</b> → <b>${esc(t.para)}</b></span><b>${fmt(t.v)}</b><code>transfer ${t.v} to ${esc(t.para)}</code></div>`).join('') : '<p class="muted">Ninguém precisa transferir nada.</p>'}
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
      </div><div class="fr-col fr-resumo"><p class="dica">Os timers ficam salvos neste navegador e continuam contando mesmo com o site fechado. ${'Notification' in window ? '<button type="button" class="link" data-fr-notif>Avisar no navegador quando um timer acabar</button>' : ''}</p></div></div>`;
  }

  function render() {
    const el = $('#ferramentas-app'); if (!el) return;
    const abas = [['imbuements', '✨ Imbuements'], ['party', '👥 Divisão de loot'], ['timers', '⏱️ Timers']];
    el.innerHTML = `<div class="card"><div class="fr-abas" role="tablist">${abas.map(([k, t]) => `<button type="button" role="tab" data-fr-aba="${k}" class="${F.aba === k ? 'ativo' : ''}" aria-selected="${F.aba === k}">${t}</button>`).join('')}</div>` +
      `<div class="fr-corpo">${F.aba === 'imbuements' ? abaImbuements() : F.aba === 'party' ? abaParty() : abaTimers()}</div></div>`;
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
    const a = e.target.closest('[data-fr-aba]'); if (a) { F.aba = a.dataset.frAba; render(); return; }
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
    if (t.dataset.frPreco) { const p = precos(), v = gold(t.value); if (v == null || v < 0) delete p[t.dataset.frPreco]; else p[t.dataset.frPreco] = v; gravar('tc_imb_precos', p); render(); return; }
    if (t.dataset.fr === 'token' || t.dataset.fr === 'taxa') {
      const c = ler('tc_imb_conf', {}), v = gold(t.value), im = F.imbs.find((i) => i.nome === F.sel);
      const k = t.dataset.fr === 'token' ? 'token' : 'taxa_' + im?.nivel;
      if (v == null || v < 0) delete c[k]; else c[k] = v; gravar('tc_imb_conf', c); render(); return;
    }
    if (t.dataset.frParty) { const j = F.party.jogadores[+t.dataset.i]; if (!j) return; if (t.dataset.frParty === 'nome') j.nome = t.value.trim().slice(0, 30); else { const v = gold(t.value); j[t.dataset.frParty] = v == null || v < 0 ? null : v; } gravar('tc_party', F.party); render(); }
  });
  document.addEventListener('submit', (e) => {
    if (e.target.id !== 'fr-timer-form') return; e.preventDefault();
    const f = e.target, h = Math.max(0, Math.min(999, +f.h.value || 0)), m = Math.max(0, Math.min(59, +f.m.value || 0));
    if (!h && !m) return toast('Informe horas ou minutos.');
    F.timers.push({ nome: f.nome.value.trim().slice(0, 40) || 'Timer', fim: Date.now() + (h * 60 + m) * 60e3 }); gravar('tc_timers', F.timers); render();
  });
})();

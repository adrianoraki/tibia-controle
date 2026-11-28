// TibiaHub — Próximos passos (guia para quem está começando, no Painel) e previsão de gold (usada nas Metas).
// Tudo calculado no navegador com os dados que o jogador já tem no site. Texto externo passa por esc().
(() => {
  const CHAVE = 'tc_passos_ok';
  const lerOk = () => { try { return new Set(JSON.parse(localStorage.getItem(CHAVE) || '[]')); } catch { return new Set(); } };
  const salvarOk = (s) => { try { localStorage.setItem(CHAVE, JSON.stringify([...s].slice(-40))); } catch { /* ok */ } };
  const diasAtras = (n) => { const d = new Date(hojeISO() + 'T12:00'); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };

  // ritmo dos últimos 30 dias: lucro por hunt, por hora e hunts por semana
  function ritmo() {
    const desde = diasAtras(30), hs = (S.hunts || []).filter((h) => h.data >= desde);
    if (hs.length < 2) return null;
    const lucro = hs.reduce((t, h) => t + (h.profit || 0), 0), min = hs.reduce((t, h) => t + (h.duracao_min || 0), 0);
    const dias = new Set(hs.map((h) => h.data)).size, primeiro = hs.reduce((m, h) => (h.data < m ? h.data : m), hojeISO());
    const semanas = Math.max(1, (new Date(hojeISO()) - new Date(primeiro)) / 6048e5);
    return { porHunt: lucro / hs.length, porHora: min ? (lucro * 60) / min : null, huntsSemana: hs.length / semanas, porDia: lucro / Math.max(1, (new Date(hojeISO()) - new Date(primeiro)) / 864e5 + 1), hunts: hs.length, dias };
  }
  // "No seu ritmo você junta isso em ~N hunts (~D dias)"
  window.previsaoGold = function (falta) {
    if (!(falta > 0)) return '';
    const r = ritmo();
    if (!r) return ' Registre algumas hunts para eu prever em quanto tempo você junta esse gold.';
    if (r.porHunt <= 0) return ' Nos últimos 30 dias suas hunts deram prejuízo em média, então ainda não dá para prever quando você junta esse gold.';
    const hunts = Math.ceil(falta / r.porHunt), dias = Math.ceil(falta / Math.max(1, r.porDia)), horas = r.porHora > 0 ? Math.ceil(falta / r.porHora) : null;
    const quando = new Date(hojeISO() + 'T12:00'); quando.setDate(quando.getDate() + dias);
    return ` 📅 No seu ritmo dos últimos 30 dias (${fmtC(Math.round(r.porHunt))} de lucro por hunt), você junta isso em <b>~${fmt(hunts)} hunt${hunts > 1 ? 's' : ''}</b>${horas ? ` (~${fmt(horas)} h de hunt)` : ''}, por volta de <b>${quando.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}</b>.`;
  };

  // lista de passos: [id, ícone, texto, botão [rótulo, página]]
  function passos() {
    const p = S.perfil || {}, out = [], lvl = p.level || 0, an = p.analista || {}, voc = String(p.vocacao || '').toLowerCase();
    const vk = ['knight', 'paladin', 'sorcerer', 'druid', 'monk'].find((v) => voc.includes(v));
    if (!p.personagem) out.push(['char', '🧙', 'Coloque o nome do seu personagem para o site buscar level, vocação e mundo sozinho.', ['Abrir conta', 'conta']]);
    if (!(S.hunts || []).length) out.push(['hunt1', '🗡️', 'Registre sua primeira hunt. O jeito mais rápido é colar o Hunt Analyzer do jogo: o site lê loot, XP e onde vender cada item.', ['Registrar hunt', 'hunts']]);
    else if ((S.hunts || []).length < 5) out.push(['hunt5', '📈', `Você tem ${S.hunts.length} hunt${S.hunts.length > 1 ? 's' : ''} registrada${S.hunts.length > 1 ? 's' : ''}. Com 5 ou mais, o painel mostra seu lucro por hora e o ritmo para as suas metas.`, ['Ver hunts', 'hunts']]);
    if (!p.meta_diaria) out.push(['meta', '🎯', 'Defina uma meta de lucro por dia: o painel mostra se você bateu e quanto falta.', ['Definir meta', 'metas']]);
    if (lvl && lvl < 51) out.push(['roda51', '☸️', `A Roda do Destino libera no level 51 (com Premium). Faltam ${fmt(51 - lvl)} levels: até lá, foque em skill e numa hunt segura para o seu level.`, ['Ver hunts da comunidade', 'comunidade']]);
    else if (vk && !(an.set && an.set[vk] && Object.keys(an.set[vk]).length)) out.push(['oraculo', '🔮', 'Monte o seu set no Oráculo IA: ele calcula o dano das suas magias, sugere imbuements, a roda e as gemas para o seu level.', ['Abrir Oráculo IA', 'magias']]);
    if (vk && an.set && an.set[vk] && !(an.set[vk].arma && (an.set[vk].arma.m || []).length)) out.push(['imb', '✨', 'Sua arma está sem imbuement. Para quem está começando, Vampirism (vida) e Void (mana) na arma economizam muita potion.', ['Ver no Oráculo IA', 'magias']]);
    if (!(S.loot && S.loot.size) && (S.hunts || []).length) out.push(['inv', '🎒', 'Use o Inventário para guardar o loot das hunts e vender no NPC certo sem esquecer nada.', ['Abrir inventário', 'inventario']]);
    if (!p.compartilhar) out.push(['comu', '🤝', 'Ajude a comunidade: compartilhe seus dados anônimos e veja quais hunts estão rendendo para o seu level.', ['Ver Comunidade', 'comunidade']]);
    return out;
  }

  window.renderPassos = function () {
    const el = document.getElementById('passos-app'); if (!el || !S.perfil) return;
    const ok = lerOk(), lista = passos().filter(([id]) => !ok.has(id)), mostra = lista.slice(0, 3);
    if (!mostra.length) { el.innerHTML = ''; return; }
    el.innerHTML = `<section class="card passos" aria-label="Próximos passos"><div class="passos-cab"><h3>🧭 Seus próximos passos</h3><small class="muted">${lista.length > 3 ? `mais ${lista.length - 3} depois destes` : 'feitos para o seu personagem'}</small></div>
      <ol class="passos-lista">${mostra.map(([id, ico, txt, [rot, pag]]) => `<li><span class="passos-ico" aria-hidden="true">${ico}</span><p>${txt}</p>
        <div class="passos-acoes"><button type="button" class="btn mini-btn" data-ir="${esc(pag)}">${esc(rot)}</button><button type="button" class="link" data-passo-ok="${esc(id)}" aria-label="Dispensar esta dica">Já fiz / esconder</button></div></li>`).join('')}</ol></section>`;
  };
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-passo-ok]'); if (!b) return;
    const ok = lerOk(); ok.add(String(b.dataset.passoOk).slice(0, 20)); salvarOk(ok); window.renderPassos();
  });
  // se os dados chegaram antes deste arquivo carregar
  if (typeof S !== 'undefined' && S.perfil) window.renderPassos();
  window.addEventListener('load', () => { if (typeof S !== 'undefined' && S.perfil) window.renderPassos(); });
})();

// ---------- Rotina do dia: checklist que zera no server save (10h de Berlim) ----------
(() => {
  const CH = 'tc_rotina';
  const diaTibia = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(new Date(Date.now() - 10 * 3600e3));
  const ler = () => { try { const d = JSON.parse(localStorage.getItem(CH) || '{}'); return d && typeof d === 'object' ? d : {}; } catch { return {}; } };
  const gravar = (d) => { try { localStorage.setItem(CH, JSON.stringify(d)); } catch { /* ok */ } };
  const PADRAO = [['diaria', '🎁 Pegar a recompensa diária'], ['task', '📜 Fazer a task do dia (Task Board)'], ['boss', '💀 Bosses liberados no Boss Tracker', 'bosses']];
  function itens() {
    const d = ler(), ocultos = new Set(Array.isArray(d.ocultos) ? d.ocultos : []), out = [];
    const md = S.perfil?.meta_diaria || 0, hoje = hojeISO(), pHoje = (S.hunts || []).filter((h) => h.data === hoje).reduce((a, h) => a + h.profit, 0);
    if (md) out.push({ id: 'meta', txt: `🎯 Meta do dia: ${fmtC(pHoje)} de ${fmtC(md)}`, auto: pHoje >= md, ir: 'hunts' });
    const boost = S.hojeDados?.criatura; if (boost) out.push({ id: 'boost', txt: `🐾 Criatura em boost: ${boost}`, ir: 'mapa' });
    if (typeof rashidHoje === 'function') { const det = typeof rashidMeu === 'function' ? rashidMeu() : ''; const n = /(\d+) ite/.exec(det || '');
      out.push({ id: 'rashid', txt: `🧳 Rashid em ${rashidHoje()}${n ? `: vender ${n[1]} ite${+n[1] > 1 ? 'ns' : 'm'} do inventário` : ''}`, ir: n ? 'inventario' : null }); }
    for (const [id, txt, ir] of PADRAO) out.push({ id, txt, ir });
    for (const x of Array.isArray(d.meus) ? d.meus.slice(0, 15) : []) if (x && typeof x.txt === 'string') out.push({ id: 'm' + x.id, txt: x.txt, meu: true });
    return out.filter((x) => !ocultos.has(x.id));
  }
  window.renderRotina = function () {
    const el = document.getElementById('rotina-app'); if (!el || !S.perfil) return;
    const d = ler(), dia = diaTibia(), feitos = new Set(d.dia === dia && Array.isArray(d.feitos) ? d.feitos : []), lista = itens();
    const ok = lista.filter((x) => x.auto || feitos.has(x.id)).length;
    el.innerHTML = `<section class="card rotina" aria-label="Rotina do dia"><div class="passos-cab"><h3>📋 Rotina de hoje <small class="muted">${ok}/${lista.length}</small></h3><small class="muted">zera no server save</small></div>
      <div class="barra rotina-barra"><div class="${ok === lista.length ? 'ok' : ''}" style="width:${lista.length ? (ok / lista.length) * 100 : 0}%"></div></div>
      <ul class="rotina-lista">${lista.map((x) => { const f = x.auto || feitos.has(x.id); return `<li class="${f ? 'feito' : ''}">
        <label><input type="checkbox" data-rot-ok="${esc(x.id)}" ${f ? 'checked' : ''} ${x.auto ? 'disabled title="Marca sozinho"' : ''}><span>${esc(x.txt)}</span></label>
        ${x.ir ? `<button type="button" class="link" data-ir="${esc(x.ir)}">abrir</button>` : ''}<button type="button" class="rotina-x" data-rot-tirar="${esc(x.id)}" aria-label="Tirar da rotina" title="Tirar da rotina">✕</button></li>`; }).join('')}</ul>
      <form class="rotina-add" data-rot-form><input name="t" maxlength="60" placeholder="+ adicionar tarefa sua (ex: Lady Tenebris)" aria-label="Nova tarefa"><button class="btn mini-btn">Adicionar</button>${(d.ocultos || []).length ? '<button type="button" class="link" data-rot-repor>repor as tarefas padrão</button>' : ''}</form></section>`;
  };
  document.addEventListener('change', (e) => {
    const c = e.target.closest?.('#rotina-app [data-rot-ok]'); if (!c) return;
    const d = ler(), dia = diaTibia(); if (d.dia !== dia) { d.dia = dia; d.feitos = []; }
    const id = String(c.dataset.rotOk).slice(0, 20), f = new Set(d.feitos || []); if (c.checked) f.add(id); else f.delete(id); d.feitos = [...f]; gravar(d); window.renderRotina();
  });
  document.addEventListener('click', (e) => {
    const t = e.target.closest?.('#rotina-app [data-rot-tirar]');
    if (t) { const d = ler(), id = String(t.dataset.rotTirar).slice(0, 20);
      if (id.startsWith('m')) d.meus = (d.meus || []).filter((x) => 'm' + x.id !== id); else d.ocultos = [...new Set([...(d.ocultos || []), id])];
      gravar(d); window.renderRotina(); return; }
    if (e.target.closest?.('#rotina-app [data-rot-repor]')) { const d = ler(); d.ocultos = []; gravar(d); window.renderRotina(); }
  });
  document.addEventListener('submit', (e) => {
    const f = e.target.closest?.('#rotina-app [data-rot-form]'); if (!f) return; e.preventDefault();
    const txt = String(f.t.value || '').trim().replace(/\s+/g, ' ').slice(0, 60); if (!txt) return;
    const d = ler(); d.meus = Array.isArray(d.meus) ? d.meus : []; if (d.meus.length >= 15) { toast('A rotina aceita até 15 tarefas suas.'); return; }
    d.meus.push({ id: Date.now().toString(36), txt }); gravar(d); window.renderRotina();
  });
  if (typeof S !== 'undefined' && S.perfil) window.renderRotina();
})();

// ---------- Resumo da semana para compartilhar (guild, Discord, WhatsApp) ----------
(() => {
  let qual = 'passada';
  const somaDia = (iso, n) => { const d = new Date(iso + 'T12:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  const segunda = (iso) => somaDia(iso, -((new Date(iso + 'T12:00Z').getUTCDay() + 6) % 7));
  const dm = (iso) => `${iso.slice(8)}/${iso.slice(5, 7)}`;
  function dados() {
    const s0 = qual === 'atual' ? segunda(hojeISO()) : somaDia(segunda(hojeISO()), -7), s1 = somaDia(s0, 6);
    const hs = (S.hunts || []).filter((h) => h.data >= s0 && h.data <= s1), md = S.perfil?.meta_diaria || 0;
    const lucro = hs.reduce((a, h) => a + h.profit, 0), xp = hs.reduce((a, h) => a + (h.xp || 0), 0), min = hs.reduce((a, h) => a + (h.duracao_min || 0), 0);
    const dias = new Set(hs.map((h) => h.data)).size, melhor = hs.reduce((m, h) => (!m || h.profit > m.profit ? h : m), null);
    const fotos = (S.xpFotos || []).filter((f) => f.level && f.data >= s0 && f.data <= somaDia(s1, 1)), lvA = fotos[0]?.level, lvB = fotos.at(-1)?.level;
    return { s0, s1, n: hs.length, lucro, xp, min, dias, melhor, saldo: md ? lucro - md * dias : null, levels: lvA && lvB ? lvB - lvA : null, lvB };
  }
  function texto(d) {
    const p = S.perfil || {}, l = [`📊 Semana ${dm(d.s0)} a ${dm(d.s1)} — ${p.personagem || 'meu personagem'}${p.level ? ` (level ${p.level})` : ''}`];
    l.push(`💰 Lucro: ${fmtC(d.lucro)} em ${d.n} hunt${d.n === 1 ? '' : 's'} (${d.dias} dia${d.dias === 1 ? '' : 's'})`);
    if (d.min) l.push(`⏱️ ${Math.round(d.min / 60)}h de hunt · ${fmtC(Math.round((d.lucro * 60) / d.min))}/h`);
    if (d.xp) l.push(`⚡ XP: ${fmtC(d.xp)}${d.levels ? ` · +${d.levels} level${d.levels > 1 ? 's' : ''}` : ''}`);
    if (d.melhor) l.push(`🏆 Melhor hunt: ${d.melhor.local} (${fmtC(d.melhor.profit)})`);
    if (d.saldo != null && d.dias) l.push(`🎯 Meta: ${Math.abs(d.saldo) < 1000 ? 'em dia' : d.saldo > 0 ? `sobrou ${fmtC(d.saldo)}` : `faltou ${fmtC(-d.saldo)}`}`);
    l.push('Feito com o TibiaHub'); return l.join('\n');
  }
  window.renderSemana = function () {
    const el = document.getElementById('semana-app'); if (!el || !S.perfil) return;
    const d = dados();
    el.innerHTML = `<section class="card semana"><div class="passos-cab"><h3>📣 Resumo da semana</h3>
      <div class="seg" role="group" aria-label="Qual semana"><button type="button" data-sem-q="passada" class="${qual === 'passada' ? 'ativo' : ''}" aria-pressed="${qual === 'passada'}">Semana passada</button><button type="button" data-sem-q="atual" class="${qual === 'atual' ? 'ativo' : ''}" aria-pressed="${qual === 'atual'}">Esta semana</button></div></div>
      ${d.n ? `<div class="semana-grid">
        <div><small class="muted">Lucro</small><b class="${cls(d.lucro)}">${fmtC(d.lucro)}</b><small class="muted">${d.n} hunts · ${d.dias} dias</small></div>
        <div><small class="muted">Por hora</small><b>${d.min ? `${fmtC(Math.round((d.lucro * 60) / d.min))}/h` : '—'}</b><small class="muted">${d.min ? `${Math.round(d.min / 60)}h de hunt` : ''}</small></div>
        <div><small class="muted">XP</small><b>${d.xp ? fmtC(d.xp) : '—'}</b><small class="muted">${d.levels ? `+${d.levels} level${d.levels > 1 ? 's' : ''}` : ''}</small></div>
        <div><small class="muted">Melhor hunt</small><b>${d.melhor ? fmtC(d.melhor.profit) : '—'}</b><small class="muted">${d.melhor ? esc(d.melhor.local) : ''}</small></div>
        <div><small class="muted">Meta</small><b class="${d.saldo == null ? '' : d.saldo >= -999 ? 'pos' : 'neg'}">${d.saldo == null ? '—' : Math.abs(d.saldo) < 1000 ? 'em dia' : d.saldo > 0 ? `+${fmtC(d.saldo)}` : `−${fmtC(-d.saldo)}`}</b><small class="muted">${d.saldo == null ? 'defina a meta' : 'sobra/falta'}</small></div></div>
        <pre class="semana-txt" aria-label="Texto para compartilhar">${esc(texto(d))}</pre>
        <button type="button" class="btn mini-btn" data-sem-copiar>📋 Copiar para mandar na guild</button>`
        : `<div class="bloqueio">Nenhuma hunt ${qual === 'atual' ? 'nesta semana' : 'na semana passada'} (${dm(d.s0)} a ${dm(d.s1)}).</div>`}</section>`;
  };
  document.addEventListener('click', (e) => {
    const q = e.target.closest?.('#semana-app [data-sem-q]'); if (q) { qual = q.dataset.semQ === 'atual' ? 'atual' : 'passada'; window.renderSemana(); return; }
    if (e.target.closest?.('#semana-app [data-sem-copiar]')) navigator.clipboard?.writeText(texto(dados()).slice(0, 1500)).then(() => toast('Resumo copiado. Cole no chat da guild, Discord ou WhatsApp.'), () => toast('Não deu para copiar.'));
  });
  if (typeof S !== 'undefined' && S.perfil) window.renderSemana();
})();

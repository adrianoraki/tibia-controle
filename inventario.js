// TibiaHub — Meu inventário: o que você tem guardado. Entra sozinho pelo loot das hunts (leitor do Hunt Analyzer)
// e pelas compras confirmadas no Market; sai sozinho quando você vende no NPC pelo site. O servidor faz as contas;
// o navegador só lê e pede ajustes. Todo texto de fora passa por esc().
(() => {
  const I = { lista: null, mov: null, busca: '', ordem: 'valor', marc: new Set() };
  const ORIGEM = { hunt: ['⚔️', 'Hunt'], market: ['🛒', 'Market'], npc: ['💰', 'Venda no NPC'], ajuste: ['✎', 'Ajuste'] };

  async function carregar() {
    const el = $('#inventario-app'); if (!el) return;
    if (!I.lista) el.innerHTML = '<div class="card"><div class="bloqueio">Carregando inventário…</div></div>';
    const [a, b] = await Promise.all([
      sb.from('inventario').select('item,qtd,preco_market,atualizado_em').gt('qtd', 0).order('item').limit(3000),
      sb.from('inventario_mov').select('item,delta,origem,criado_em').order('criado_em', { ascending: false }).limit(12),
    ]);
    if (a.error) { el.innerHTML = '<div class="card"><div class="bloqueio">Não deu para carregar o inventário agora.</div></div>'; return; }
    I.lista = a.data || []; I.mov = b.data || []; render();
  }

  const POR_PAG = { depot: 48, lista: 15 };
  const ler = (k, d) => { try { return localStorage.getItem(k) || d; } catch { return d; } };
  I.vis = ler('tc_inv_vis', 'depot');
  // moldura por valor da unidade (igual aos destaques de loot do jogo)
  const tier = (v) => (v >= 1e6 ? 'ouro' : v >= 1e5 ? 'roxo' : v >= 1e4 ? 'azul' : v >= 1e3 ? 'verde' : 'cinza');
  const curto = (n) => (n >= 1e6 ? `${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1).replace('.', ',')}kk` : n >= 1e4 ? `${Math.round(n / 1e3)}k` : String(n));

  function barraMarc(linhas, vis) {
    const sel = linhas.filter((i) => I.marc.has(i.item) && i.npc);
    const comNpc = vis.filter((i) => i.npc).length;
    if (!sel.length) return comNpc ? `<div class="inv-marc vazia"><span class="muted">Marque os itens que você vendeu no NPC para dar baixa de uma vez.</span><button type="button" class="link" data-inv-marcar-tudo>Marcar todos com NPC (${fmt(comNpc)})</button></div>` : '';
    const total = sel.reduce((t, i) => t + i.valor, 0);
    return `<div class="inv-marc"><span><b>${fmt(sel.length)}</b> marcado${sel.length > 1 ? 's' : ''} · <b class="pos">+${fmt(total)} gp</b> no NPC</span>
      <span class="inv-marc-bts"><button type="button" class="link" data-inv-marcar-tudo>Marcar todos (${fmt(comNpc)})</button><button type="button" class="link" data-inv-desmarcar>Limpar</button><button type="button" class="btn-ok btn-ok-txt" data-inv-vender-marc>💰 Vendi no NPC</button></span></div>`;
  }

  function render() {
    const el = $('#inventario-app'); if (!el || !I.lista) return;
    const q = I.busca.trim().toLowerCase();
    // preço de Market: o que você definiu, a última compra ou o preço guardado no Vender NPC
    const pm = new Map();
    for (const c of [...(S.compras || [])].reverse()) if (c.preco_unit > 0) pm.set(String(c.item).toLowerCase(), c.preco_unit);
    for (const it of S.itens || []) { const l = S.loot?.get(it.id); if (l?.pm > 0 && !pm.has(it.item.toLowerCase())) pm.set(it.item.toLowerCase(), l.pm); }
    const linhas = I.lista.map((i) => { const p = melhorPreco(i.item), m = i.preco_market || pm.get(i.item.toLowerCase()) || null; return { ...i, npc: p, valor: p ? p.preco * i.qtd : 0, mkt: m, manual: !!i.preco_market, valorMkt: m ? m * i.qtd : 0, un: Math.max(m || 0, p?.preco || 0) }; });
    const vis = linhas.filter((i) => !q || i.item.toLowerCase().includes(q))
      .sort((a, b) => (I.ordem === 'nome' ? a.item.localeCompare(b.item) : I.ordem === 'qtd' ? b.qtd - a.qtd : I.ordem === 'un' ? b.un - a.un : (b.valorMkt || b.valor) - (a.valorMkt || a.valor) || a.item.localeCompare(b.item)));
    const totUn = linhas.reduce((t, i) => t + i.qtd, 0), totVal = linhas.reduce((t, i) => t + i.valor, 0), semNpc = linhas.filter((i) => !i.npc).length;
    const totMkt = linhas.reduce((t, i) => t + (i.valorMkt || i.valor), 0), banco = S.perfil?.banco || 0;
    const tam = POR_PAG[I.vis] || 48, paginas = Math.max(1, Math.ceil(vis.length / tam));
    I.pag = Math.min(Math.max(1, I.pag || 1), paginas);
    const pag = vis.slice((I.pag - 1) * tam, I.pag * tam);
    const sel = linhas.find((i) => i.item === I.sel) || null;
    const pager = paginas > 1 ? `<div class="inv-pags" role="tablist" aria-label="Páginas">
      <button type="button" data-inv-pag="${I.pag - 1}" ${I.pag <= 1 ? 'disabled' : ''} aria-label="Página anterior">‹</button>
      ${Array.from({ length: paginas }, (_, k) => `<button type="button" role="tab" aria-selected="${I.pag === k + 1}" class="${I.pag === k + 1 ? 'ativo' : ''}" data-inv-pag="${k + 1}">${k + 1}</button>`).join('')}
      <button type="button" data-inv-pag="${I.pag + 1}" ${I.pag >= paginas ? 'disabled' : ''} aria-label="Próxima página">›</button></div>` : '';
    const depot = `<div class="inv-depot" role="listbox" aria-label="Itens, página ${I.pag} de ${paginas}">
      ${pag.map((i) => `<button type="button" role="option" aria-selected="${I.sel === i.item}" class="dp-slot t-${tier(i.un)}${I.sel === i.item ? ' sel' : ''}" data-inv-sel="${esc(i.item)}" title="${esc(`${i.item} · ${fmt(i.qtd)} un.${i.un ? ` · ${fmt(i.un)} gp cada` : ''}`)}">${imgDoItem(i.item, 'dp-img')}${i.qtd > 1 ? `<span class="inv-qtd">${curto(i.qtd)}</span>` : ''}</button>`).join('')}
      ${Array.from({ length: paginas > 1 && I.pag === paginas ? Math.min(12, tam - pag.length) : Math.max(0, Math.min(tam - pag.length, 24 - pag.length)) }, () => '<span class="dp-slot vazio" aria-hidden="true"></span>').join('')}</div>`;
    const lista = `<div class="tabela-wrap"><table class="inv-tab"><tr><th class="inv-ck"><input type="checkbox" data-inv-marcar-pag aria-label="Marcar os itens desta página que têm NPC" ${pag.some((i) => i.npc) && pag.filter((i) => i.npc).every((i) => I.marc.has(i.item)) ? 'checked' : ''}></th><th>Item</th><th class="num">Qtd</th><th>NPC (un.)</th><th class="num">Total NPC</th><th class="num">Market (un.)</th><th class="num">Total Market</th><th></th></tr>
        ${pag.map((i) => `<tr class="${I.marc.has(i.item) ? 'marcada' : ''}"><td class="inv-ck">${i.npc ? `<input type="checkbox" data-inv-marcar="${esc(i.item)}" aria-label="Marcar ${esc(i.item)}" ${I.marc.has(i.item) ? 'checked' : ''}>` : ''}</td><td><span class="item-nome">${imgDoItem(i.item)}${esc(i.item)}</span></td><td class="num"><b>${fmt(i.qtd)}</b></td>
          <td class="muted inv-npc" title="${i.npc ? esc(`${i.npc.npc} · ${fmt(i.npc.preco)} gp`) : 'Nenhum NPC compra: venda no Market'}">${i.npc ? `${fmt(i.npc.preco)} <small>${esc(i.npc.npc.replace(/\s*\(.*\)$/, ''))}</small>` : 'Market'}</td>
          <td class="num ${i.valor ? 'pos' : 'muted'}">${i.valor ? fmt(i.valor) : '—'}</td>
          <td class="num"><button type="button" class="inv-mkt${i.manual ? ' manual' : ''}" data-inv-mkt="${esc(i.item)}" title="Clique para editar o preço de Market">${i.mkt ? fmt(i.mkt) : 'definir'}<span aria-hidden="true">✎</span></button></td><td class="num ${i.valorMkt > i.valor ? 'pos' : ''}">${i.valorMkt ? fmt(i.valorMkt) : '—'}</td>
          <td class="inv-acoes">${i.npc ? `<button class="btn-ok btn-ok-txt" type="button" data-inv-vender="${esc(i.item)}" title="Vendi tudo no NPC: o valor entra no banco">💰</button>` : ''}<button class="btn-editar" type="button" data-inv-editar="${esc(i.item)}" title="Corrigir a quantidade">✎</button></td></tr>`).join('')}</table></div>`;
    const detalhe = sel ? `<div class="inv-det">
        <div class="inv-det-cab"><span class="dp-slot t-${tier(sel.un)} grande">${imgDoItem(sel.item, 'dp-img')}</span><div><b>${esc(sel.item)}</b><small class="muted">${fmt(sel.qtd)} unidade${sel.qtd > 1 ? 's' : ''}</small></div><button type="button" class="inv-det-x" data-inv-sel="" aria-label="Fechar">✕</button></div>
        <div class="inv-det-num">
          <div><span>Melhor NPC</span><b>${sel.npc ? `${fmt(sel.npc.preco)} gp` : '—'}</b><small class="muted">${sel.npc ? esc(sel.npc.npc) : 'nenhum NPC compra'}</small></div>
          <div><span>Total no NPC</span><b class="${sel.valor ? 'pos' : ''}">${sel.valor ? `${fmt(sel.valor)} gp` : '—'}</b></div>
          <div><span>Market (un.)</span><button type="button" class="inv-mkt${sel.manual ? ' manual' : ''}" data-inv-mkt="${esc(sel.item)}">${sel.mkt ? `${fmt(sel.mkt)} gp` : 'definir'}<span aria-hidden="true">✎</span></button></div>
          <div><span>Total no Market</span><b class="${sel.valorMkt > sel.valor ? 'pos' : ''}">${sel.valorMkt ? `${fmt(sel.valorMkt)} gp` : '—'}</b></div>
        </div>
        <div class="inv-det-bts">${sel.npc ? `<button class="btn-ok btn-ok-txt" type="button" data-inv-vender="${esc(sel.item)}">💰 Vendi tudo no NPC</button>` : ''}<button class="btn" type="button" data-inv-editar="${esc(sel.item)}">✎ Corrigir quantidade</button></div>
      </div>` : `<p class="muted inv-det-vazio">Toque num item do depot para ver o valor, editar o preço de Market ou marcar como vendido.</p>`;
    el.innerHTML = `<div class="inv-grid"><div class="card inv-card">
      <div class="card-topo"><h2>Meu inventário</h2><span class="muted">${fmt(linhas.length)} itens · ${fmt(totUn)} unidades</span></div>
      <div class="inv-kpis">
        <div><span>Vale no NPC</span><b class="pos">${fmt(totVal)}</b><small class="muted">${semNpc ? `${fmt(semNpc)} sem NPC` : 'tudo tem NPC'}</small></div>
        <div><span>Banco</span><b>${fmt(banco)}</b><small class="muted">${moedas(banco)}</small></div>
        <div class="inv-total"><span>Patrimônio</span><b>${fmt(banco + totMkt)}</b><small class="muted">banco + itens (Market; sem preço, NPC)${S.perfil?.preco_tc ? emTC(banco + totMkt) : ''}</small></div>
      </div>
      <div class="inv-filtros"><input type="search" data-inv="busca" placeholder="Buscar item…" value="${esc(I.busca)}" maxlength="40">
        <select data-inv="ordem" aria-label="Ordenar">${[['valor', 'Mais valioso (total)'], ['un', 'Mais caro (unidade)'], ['qtd', 'Mais unidades'], ['nome', 'Nome']].map(([k, t]) => `<option value="${k}" ${I.ordem === k ? 'selected' : ''}>${t}</option>`).join('')}</select>
        <div class="inv-vis" role="tablist" aria-label="Visualização"><button type="button" role="tab" aria-selected="${I.vis === 'depot'}" class="${I.vis === 'depot' ? 'ativo' : ''}" data-inv-vis="depot" title="Depot">▦ Depot</button><button type="button" role="tab" aria-selected="${I.vis === 'lista'}" class="${I.vis === 'lista' ? 'ativo' : ''}" data-inv-vis="lista" title="Lista">☰ Lista</button></div></div>
      ${vis.length ? `${I.vis === 'depot' ? depot + pager + detalhe : `<div class="inv-lista">${barraMarc(linhas, vis)}<div class="inv-lista-topo"><span class="muted">${fmt((I.pag - 1) * tam + 1)}–${fmt(Math.min(I.pag * tam, vis.length))} de ${fmt(vis.length)}</span>${pager}</div>${lista}${pager}</div>`}` : `<div class="bloqueio">${q ? 'Nenhum item com esse nome.' : 'Seu inventário está vazio. Ele se enche sozinho quando você salva uma hunt pelo leitor do Hunt Analyzer (página Hunts) ou confirma uma compra no Market.'}</div>`}
      <form class="inv-add linha-form" id="inv-add"><label class="largo">Adicionar item<input name="item" list="lista-itens" maxlength="60" placeholder="ex: Terra Boots" required></label><label>Quantidade<input name="qtd" inputmode="numeric" maxlength="9" placeholder="ex: 10" required></label><button class="btn">Adicionar</button></form>
    </div>
    <div class="card inv-hist"><div class="card-topo"><h2>Últimos movimentos</h2></div>
      ${I.mov.length ? I.mov.map((m) => { const [ico, t] = ORIGEM[m.origem] || ['•', m.origem]; return `<div class="inv-mov"><span class="inv-ico" aria-hidden="true">${ico}</span><span class="inv-mov-txt">${esc(m.item)}<small class="muted">${esc(t)} · ${new Date(m.criado_em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</small></span><b class="${m.delta > 0 ? 'pos' : 'neg'}">${m.delta > 0 ? '+' : ''}${fmt(m.delta)}</b></div>`; }).join('') : '<p class="muted">Nada ainda.</p>'}
      <p class="dica">Entra: loot das hunts do leitor do Hunt Analyzer e compras confirmadas no Market. Sai: vendas no NPC pelo site.</p></div></div>`;
  }

  async function ajustar(item, qtd) {
    const { error } = await sb.rpc('inventario_ajustar', { p_item: item, p_qtd: qtd });
    if (error) return erro(error);
    carregar();
  }

  let tBusca;
  document.addEventListener('click', async (e) => {
    if (e.target.closest('#menu [data-pag=inventario]')) { carregar(); return; }
    const app = $('#inventario-app'); if (!app || !app.contains(e.target)) return;
    if (e.target.closest('[data-inv-marcar-tudo]')) { const q = I.busca.trim().toLowerCase(); I.lista.filter((i) => (!q || i.item.toLowerCase().includes(q)) && melhorPreco(i.item)).forEach((i) => I.marc.add(i.item)); render(); return; }
    if (e.target.closest('[data-inv-desmarcar]')) { I.marc.clear(); render(); return; }
    const vm = e.target.closest('[data-inv-vender-marc]');
    if (vm) {
      const sel = I.lista.filter((i) => I.marc.has(i.item)).map((i) => ({ i, p: melhorPreco(i.item) })).filter((x) => x.p);
      if (!sel.length) return;
      const total = sel.reduce((t, x) => t + x.p.preco * x.i.qtd, 0);
      if (!await confirmar(`Vendeu ${fmt(sel.length)} ite${sel.length > 1 ? 'ns' : 'm'} no NPC?`, `${sel.slice(0, 8).map((x) => `${fmt(x.i.qtd)}× ${x.i.item} (${x.p.npc})`).join('\n')}${sel.length > 8 ? `\n… e mais ${fmt(sel.length - 8)}` : ''}\n\nEntra no seu banco: ${fmt(total)} gp.`, { ok: '💰 Vendi tudo' })) return;
      vm.disabled = true; vm.textContent = '⏳ Vendendo…';
      let recebido = 0, ok = 0;
      for (const { i, p } of sel) {
        qtdNpc.set(p.id, i.qtd);
        try {
          const r = await venderNpc(p.id, null, { semConfirmar: true, silencioso: true });
          if (typeof r === 'number') { recebido += r; ok++; I.marc.delete(i.item); }
        } catch { /* segue com os outros; o que falhou continua marcado */ }
      }
      toast(ok ? `+${fmt(recebido)} gp no banco (${fmt(ok)} ite${ok > 1 ? 'ns' : 'm'} vendido${ok > 1 ? 's' : ''} no NPC)${ok < sel.length ? ` · ${fmt(sel.length - ok)} não deu: continuam marcados` : ''}` : 'Não deu para registrar a venda agora.');
      window.dispatchEvent(new Event('inventario-mudou'));
      carregar(); return;
    }
    const sl = e.target.closest('[data-inv-sel]'); if (sl) { I.sel = sl.dataset.invSel === I.sel ? null : sl.dataset.invSel || null; render(); return; }
    const pg = e.target.closest('[data-inv-pag]'); if (pg && !pg.disabled) { I.pag = +pg.dataset.invPag; render(); $('#inventario-app .inv-filtros')?.scrollIntoView({ block: 'nearest' }); return; }
    const vs = e.target.closest('[data-inv-vis]'); if (vs) { I.vis = vs.dataset.invVis; I.pag = 1; try { localStorage.setItem('tc_inv_vis', I.vis); } catch { /* ok */ } render(); return; }
    const ed = e.target.closest('[data-inv-editar]');
    if (ed) {
      const it = I.lista.find((i) => i.item === ed.dataset.invEditar); if (!it) return;
      const r = await dialogo({ titulo: it.item, texto: 'Quantas unidades você tem de verdade? Use 0 para tirar do inventário.', ok: 'Salvar',
        campo: { valor: String(it.qtd), placeholder: 'ex: 10' }, validar: (v) => (/^\d{1,9}$/.test(String(v).replace(/\D/g, '')) ? '' : 'Digite um número.') });
      if (r == null) return; return ajustar(it.item, Math.min(1e8, parseInt(String(r).replace(/\D/g, ''), 10) || 0));
    }
    const mk = e.target.closest('[data-inv-mkt]');
    if (mk) {
      const it = I.lista.find((i) => i.item === mk.dataset.invMkt); if (!it) return;
      const r = await dialogo({ titulo: `Preço de Market · ${it.item}`, texto: 'Quanto vale 1 unidade no Market? Aceita 15k, 1,5kk… Deixe vazio para voltar ao preço automático (sua última compra).', ok: 'Salvar',
        campo: { valor: it.preco_market ? String(it.preco_market) : '', placeholder: 'ex: 15k' }, validar: (v) => (!String(v).trim() || (gold(v) > 0 && gold(v) <= 1e11) ? '' : 'Digite um preço válido.') });
      if (r == null) return;
      const novo = String(r).trim() ? gold(r) : null;
      const { error } = await sb.rpc('inventario_preco', { p_item: it.item, p_preco: novo });
      if (error) return erro(error);
      it.preco_market = novo; render(); toast(novo ? `Market: ${fmt(novo)} gp por unidade` : 'Voltou ao preço automático'); return;
    }
    const vd = e.target.closest('[data-inv-vender]');
    if (vd) {
      const it = I.lista.find((i) => i.item === vd.dataset.invVender), p = it && melhorPreco(it.item); if (!p) return;
      qtdNpc.set(p.id, it.qtd); await venderNpc(p.id, vd); carregar();
    }
  });
  document.addEventListener('submit', async (e) => {
    if (e.target.id !== 'inv-add') return; e.preventDefault();
    const f = e.target, nome = f.item.value.trim().slice(0, 60), q = parseInt(String(f.qtd.value).replace(/\D/g, ''), 10) || 0;
    if (!nome || q < 1) return toast('Digite o item e a quantidade.');
    const atual = I.lista.find((i) => i.item.toLowerCase() === nome.toLowerCase().replace(/^(a|an|the) /, ''))?.qtd || 0;
    await ajustar(nome, Math.min(1e8, atual + q)); toast(`+${fmt(q)} ${nome} no inventário`);
  });
  document.addEventListener('change', (e) => {
    if (!$('#inventario-app')?.contains(e.target)) return;
    const mk = e.target.dataset?.invMarcar;
    if (mk != null) { if (e.target.checked) I.marc.add(mk); else I.marc.delete(mk); render(); return; }
    if (e.target.matches?.('[data-inv-marcar-pag]')) {
      const q = I.busca.trim().toLowerCase(), tr = [...document.querySelectorAll('#inventario-app [data-inv-marcar]')].map((x) => x.dataset.invMarcar);
      tr.forEach((n) => (e.target.checked ? I.marc.add(n) : I.marc.delete(n))); render(); return;
    }
    if (e.target.dataset?.inv !== 'ordem') return;
    I.ordem = e.target.value; I.pag = 1; render();
  });
  document.addEventListener('input', (e) => {
    if (e.target.dataset?.inv !== 'busca' || !$('#inventario-app')?.contains(e.target)) return;
    clearTimeout(tBusca); tBusca = setTimeout(() => {
      I.busca = e.target.value.slice(0, 40); I.pag = 1; render();
      const b = $('#inventario-app [data-inv="busca"]'); if (b) { b.focus(); b.setSelectionRange(b.value.length, b.value.length); }
    }, 250);
  });
  // compra no Market, venda no NPC ou hunt salva: se a página estiver aberta, atualiza
  window.addEventListener('inventario-mudou', () => { if (I.lista && !$('#pag-inventario')?.classList.contains('hidden')) carregar(); else I.lista = null; });
})();

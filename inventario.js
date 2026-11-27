// TibiaHub — Meu inventário: o que você tem guardado. Entra sozinho pelo loot das hunts (leitor do Hunt Analyzer)
// e pelas compras confirmadas no Market; sai sozinho quando você vende no NPC pelo site. O servidor faz as contas;
// o navegador só lê e pede ajustes. Todo texto de fora passa por esc().
(() => {
  const I = { lista: null, mov: null, busca: '', ordem: 'valor' };
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

  function render() {
    const el = $('#inventario-app'); if (!el || !I.lista) return;
    const q = I.busca.trim().toLowerCase();
    // preço de Market que você já anotou no site: última compra do item ou o preço guardado no Vender NPC
    const pm = new Map();
    for (const c of [...(S.compras || [])].reverse()) if (c.preco_unit > 0) pm.set(String(c.item).toLowerCase(), c.preco_unit);
    for (const it of S.itens || []) { const l = S.loot?.get(it.id); if (l?.pm > 0 && !pm.has(it.item.toLowerCase())) pm.set(it.item.toLowerCase(), l.pm); }
    const linhas = I.lista.map((i) => { const p = melhorPreco(i.item), m = i.preco_market || pm.get(i.item.toLowerCase()) || null; return { ...i, npc: p, valor: p ? p.preco * i.qtd : 0, mkt: m, manual: !!i.preco_market, valorMkt: m ? m * i.qtd : 0 }; });
    const vis = linhas.filter((i) => !q || i.item.toLowerCase().includes(q))
      .sort((a, b) => (I.ordem === 'nome' ? a.item.localeCompare(b.item) : I.ordem === 'qtd' ? b.qtd - a.qtd : b.valor - a.valor || a.item.localeCompare(b.item)));
    const totUn = linhas.reduce((t, i) => t + i.qtd, 0), totVal = linhas.reduce((t, i) => t + i.valor, 0), semNpc = linhas.filter((i) => !i.npc).length;
    const totMkt = linhas.reduce((t, i) => t + (i.valorMkt || i.valor), 0), banco = S.perfil?.banco || 0;
    el.innerHTML = `<div class="inv-grid"><div class="card">
      <div class="card-topo"><h2>Meu inventário</h2><span class="muted">${fmt(linhas.length)} itens</span></div>
      <div class="inv-kpis">
        <div><span>Itens diferentes</span><b>${fmt(linhas.length)}</b></div>
        <div><span>Unidades</span><b>${fmt(totUn)}</b></div>
        <div><span>Vale no NPC</span><b class="pos">${fmt(totVal)} gp</b><small class="muted">${semNpc ? `${fmt(semNpc)} sem NPC que compre` : 'tudo tem NPC'}</small></div>
        <div><span>Saldo no banco</span><b>${fmt(banco)} gp</b><small class="muted">${moedas(banco)}</small></div>
        <div class="inv-total"><span>Patrimônio (banco + itens)</span><b>${fmt(banco + totMkt)} gp</b><small class="muted">itens pelo preço de Market (o seu ou o da última compra); sem preço, pelo NPC${S.perfil?.preco_tc ? emTC(banco + totMkt) : ''}</small></div>
      </div>
      <div class="inv-filtros"><input type="search" data-inv="busca" placeholder="Buscar item…" value="${esc(I.busca)}" maxlength="40">
        <select data-inv="ordem" aria-label="Ordenar">${[['valor', 'Mais valioso'], ['qtd', 'Mais unidades'], ['nome', 'Nome']].map(([k, t]) => `<option value="${k}" ${I.ordem === k ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
      ${vis.length ? `<div class="tabela-wrap"><table class="inv-tab"><tr><th>Item</th><th class="num">Qtd</th><th>Melhor NPC</th><th class="num">Total no NPC</th><th class="num">Market (un.)</th><th class="num">Total no Market</th><th></th></tr>
        ${vis.slice(0, 400).map((i) => `<tr><td><span class="item-nome">${imgDoItem(i.item)}${esc(i.item)}</span></td><td class="num"><b>${fmt(i.qtd)}</b></td>
          <td class="muted">${i.npc ? `${esc(i.npc.npc)} · ${fmt(i.npc.preco)} gp` : '<span title="Nenhum NPC compra: venda no Market">Market</span>'}</td>
          <td class="num ${i.valor ? 'pos' : 'muted'}">${i.valor ? fmt(i.valor) : '—'}</td>
          <td class="num"><button type="button" class="inv-mkt${i.manual ? ' manual' : ''}" data-inv-mkt="${esc(i.item)}" title="${i.manual ? 'Preço que você definiu' : i.mkt ? 'Preço da sua última compra ou do Vender NPC' : 'Definir o preço de Market'} — clique para editar">${i.mkt ? fmt(i.mkt) : 'definir'}<span aria-hidden="true">✎</span></button></td><td class="num ${i.valorMkt > i.valor ? 'pos' : ''}">${i.valorMkt ? fmt(i.valorMkt) : '—'}</td>
          <td class="inv-acoes">${i.npc ? `<button class="btn-ok btn-ok-txt" type="button" data-inv-vender="${esc(i.item)}" title="Vendi tudo no NPC: o valor entra no banco">💰 Vendi</button>` : ''}<button class="btn-editar" type="button" data-inv-editar="${esc(i.item)}" title="Corrigir a quantidade">✎</button></td></tr>`).join('')}</table></div>`
        : `<div class="bloqueio">${q ? 'Nenhum item com esse nome.' : 'Seu inventário está vazio. Ele se enche sozinho quando você salva uma hunt pelo leitor do Hunt Analyzer (página Hunts) ou confirma uma compra no Market.'}</div>`}
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
    if (e.target.dataset?.inv !== 'ordem' || !$('#inventario-app')?.contains(e.target)) return;
    I.ordem = e.target.value; render();
  });
  document.addEventListener('input', (e) => {
    if (e.target.dataset?.inv !== 'busca' || !$('#inventario-app')?.contains(e.target)) return;
    clearTimeout(tBusca); tBusca = setTimeout(() => {
      I.busca = e.target.value.slice(0, 40); render();
      const b = $('#inventario-app [data-inv="busca"]'); if (b) { b.focus(); b.setSelectionRange(b.value.length, b.value.length); }
    }, 250);
  });
  // compra no Market, venda no NPC ou hunt salva: se a página estiver aberta, atualiza
  window.addEventListener('inventario-mudou', () => { if (I.lista && !$('#pag-inventario')?.classList.contains('hidden')) carregar(); else I.lista = null; });
})();

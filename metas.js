// TibiaControle — Metas: sets de equipamento (como o inventário do Tibia) e outros objetivos, com preço do Market
(() => {
  const SLOTS = [
    { id: 'amuleto', nome: 'Amuleto', area: 'amu' }, { id: 'capacete', nome: 'Capacete', area: 'cap' }, { id: 'mochila', nome: 'Mochila', area: 'moc' },
    { id: 'arma', nome: 'Arma', area: 'arm' }, { id: 'armadura', nome: 'Armadura', area: 'adu' }, { id: 'escudo', nome: 'Escudo / Livro / Aljava', area: 'esc' },
    { id: 'anel', nome: 'Anel', area: 'ane' }, { id: 'calca', nome: 'Calça', area: 'cal' }, { id: 'municao', nome: 'Munição', area: 'mun' },
    { id: 'botas', nome: 'Botas', area: 'bot' },
  ];
  const nomeSlot = (id) => SLOTS.find((s) => s.id === id)?.nome || 'Outro objetivo';
  const ICONES = { amuleto: '📿', capacete: '⛑️', mochila: '🎒', arma: '⚔️', armadura: '🛡️', escudo: '🔰', anel: '💍', calca: '👖', municao: '🏹', botas: '🥾', extra: '⭐' };
  const imgItem = (id) => (Number.isInteger(id) && id > 0 ? `https://static.tibia.com/images/charactertrade/objects/${id}.gif` : '');
  const M = { sets: [], itens: [], atual: null, carregado: false, catalogo: new Map() };
  try { M.atual = +localStorage.getItem('tc_meta_set') || null; } catch { /* ok */ }

  // ---------- dados ----------
  async function carregar() {
    const [s, i] = await Promise.all([
      sb.from('metas_sets').select('*').order('criado_em'),
      sb.from('metas_itens').select('*').order('criado_em'),
    ]);
    if (s.error || i.error) return erro(s.error || i.error);
    M.sets = s.data; M.itens = i.data; M.carregado = true;
    if (!M.sets.some((x) => x.id === M.atual)) M.atual = M.sets[0]?.id || null;
    render();
  }
  async function catalogo(grupo) {
    if (M.catalogo.has(grupo)) return M.catalogo.get(grupo);
    const { data, error } = await sb.from('itens_equip').select('nome,itemid,level,vocacoes,armor,atributos,npc_valor').eq('grupo', grupo).order('nome').limit(1000);
    if (error) { erro(error); return []; }
    if (data.length) M.catalogo.set(grupo, data);
    return data;
  }
  const itensDoSet = (id) => M.itens.filter((x) => x.set_id === id);

  // ---------- tela ----------
  function render() {
    const el = $('#metas-app'); if (!el) return;
    if (!M.carregado) { el.innerHTML = '<div class="card bloqueio">Carregando suas metas...</div>'; return; }
    const chips = M.sets.map((s) => `<button type="button" class="chip ${s.id === M.atual ? 'ativo' : ''}" data-meta-set="${s.id}">${esc(s.nome)}</button>`).join('');
    const topo = `<div class="metas-topo"><div class="chips">${chips}<button type="button" class="chip chip-novo" data-meta-acao="novo">+ Novo set</button></div></div>`;
    if (!M.atual) {
      el.innerHTML = topo + `<div class="card metas-vazio"><div class="metas-vazio-ico">🎯</div><h2>Monte sua primeira meta</h2><p class="muted">Crie um set (por exemplo "Set Knight 400") e escolha cada peça clicando nos slots, como no inventário do jogo. Digite o preço do Market e o site mostra quanto falta e quanto o seu banco já cobre.</p><button class="btn" type="button" data-meta-acao="novo">Criar meu primeiro set</button></div>`;
      return;
    }
    const set = M.sets.find((s) => s.id === M.atual), itens = itensDoSet(set.id), porSlot = new Map(itens.filter((x) => x.slot !== 'extra').map((x) => [x.slot, x]));
    const extras = itens.filter((x) => x.slot === 'extra');
    const total = itens.reduce((t, x) => t + (x.preco || 0), 0), tenho = itens.filter((x) => x.obtido).reduce((t, x) => t + (x.preco || 0), 0), falta = total - tenho;
    const banco = S.perfil?.banco || 0, cobre = falta > 0 ? Math.min(100, (banco / falta) * 100) : 100, pctTenho = total ? (tenho / total) * 100 : 0;
    const semPreco = itens.filter((x) => x.preco == null && !x.obtido).length;

    const slot = (s) => {
      const it = porSlot.get(s.id), src = it ? imgItem(it.itemid) : '';
      return `<button type="button" class="inv-slot ${it ? 'cheio' : ''} ${it?.obtido ? 'obtido' : ''}" style="grid-area:${s.area}" data-meta-slot="${s.id}" title="${esc(it ? it.item_nome : s.nome)}">` +
        (it ? (src ? `<img class="item-img" src="${src}" alt="" width="32" height="32" loading="lazy" data-ico="${ICONES[s.id]}">` : `<span class="inv-ico">${ICONES[s.id]}</span>`) : `<span class="inv-ico vazio">${ICONES[s.id]}</span>`) +
        (it?.obtido ? '<span class="inv-ok" aria-label="já tenho">✓</span>' : '') + `</button>`;
    };
    const linha = (it) => `<div class="meta-linha ${it.obtido ? 'obtido' : ''}">` +
      `<span class="meta-thumb">${imgItem(it.itemid) ? `<img class="item-img" src="${imgItem(it.itemid)}" alt="" width="32" height="32" loading="lazy" data-ico="${ICONES[it.slot]}">` : ICONES[it.slot]}</span>` +
      `<span class="meta-nome"><b>${esc(it.item_nome)}</b><small class="muted">${esc(nomeSlot(it.slot))}</small></span>` +
      `<span class="meta-preco">${it.preco != null ? fmt(it.preco) + ' gp' : '<span class="muted">sem preço</span>'}</span>` +
      `<button type="button" class="meta-check ${it.obtido ? 'on' : ''}" data-meta-obtido="${it.id}" title="${it.obtido ? 'Marcar como não tenho' : 'Marcar como já tenho'}" aria-pressed="${it.obtido}">✓</button>` +
      `<button type="button" class="btn-editar" data-meta-editar="${it.id}">✎</button></div>`;

    el.innerHTML = topo + `<div class="metas-grid">` +
      `<div class="card inv-card"><div class="card-topo"><h2>${esc(set.nome)}</h2><span class="metas-acoes"><button type="button" class="btn-editar" data-meta-acao="renomear">Renomear</button> <button type="button" class="btn-editar perigo-txt" data-meta-acao="apagar">Apagar set</button></span></div>` +
        `<div class="inventario">${SLOTS.map(slot).join('')}</div><p class="dica" style="text-align:center">Clique em um slot para escolher a peça.</p></div>` +
      `<div class="metas-col">` +
        `<div class="card"><div class="card-topo"><h2>Quanto falta</h2>${falta > 0 ? `<b class="graf-hero">${fmt(falta)} gp<small class="muted" style="font-size:13px;font-weight:500">${emTC(falta)}</small></b>` : total ? '<b class="graf-hero pos">Set completo! 🎉</b>' : ''}</div>` +
          `<div class="grid linha-kpis">${kpi('Valor do set', fmt(total))}${kpi('Já tenho', `<span class="pos">${fmt(tenho)}</span>`)}${kpi('Falta comprar', `<span class="${falta > 0 ? 'neg' : 'pos'}">${fmt(falta)}</span>`)}${kpi('Seu banco', fmt(banco), 'ouro')}</div>` +
          `<div class="meta"><div class="topo-meta"><span>Progresso do set</span><span class="muted">${Math.round(pctTenho)}%</span></div><div class="barra"><div class="${pctTenho >= 100 ? 'ok' : ''}" style="width:${pctTenho}%"></div></div></div>` +
          `<div class="meta"><div class="topo-meta"><span>Seu banco cobre o que falta</span><span class="muted">${falta > 0 ? Math.round(cobre) + '%' : '—'}</span></div><div class="barra"><div class="${cobre >= 100 ? 'ok' : ''}" style="width:${falta > 0 ? cobre : 0}%"></div></div></div>` +
          `<p class="dica">${falta <= 0 ? '' : banco >= falta ? '✅ Seu banco já dá para comprar tudo o que falta.' : `Faltam <b>${fmt(falta - banco)} gp</b> além do que você tem no banco.`}${semPreco ? ` ${semPreco} item(ns) sem preço não entram na conta.` : ''}</p></div>` +
        `<div class="card"><div class="card-topo"><h2>Peças do set</h2><span class="muted">${itens.filter((x) => x.slot !== 'extra').length}/10 slots</span></div>` +
          `${itens.filter((x) => x.slot !== 'extra').map(linha).join('') || '<div class="bloqueio">Nenhuma peça escolhida ainda.</div>'}</div>` +
        `<div class="card"><div class="card-topo"><h2>Outros objetivos</h2><button type="button" class="btn sec mini-btn" style="margin-top:0" data-meta-acao="extra">+ Adicionar</button></div>` +
          `${extras.map(linha).join('') || '<p class="muted" style="margin:0">Qualquer outra coisa que você quer juntar gold para: imbuements, casa, uma mount, charms...</p>'}</div>` +
      `</div></div>`;
  }

  // ---------- caixa de escolha de item ----------
  const caixa = document.createElement('div');
  caixa.className = 'dlg hidden picker'; caixa.setAttribute('role', 'dialog'); caixa.setAttribute('aria-modal', 'true');
  document.body.appendChild(caixa);
  let ctx = null; // { slot, item?, escolhido? }
  const fecharCaixa = () => { caixa.classList.add('hidden'); ctx = null; };
  caixa.addEventListener('mousedown', (e) => { if (e.target === caixa) fecharCaixa(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !caixa.classList.contains('hidden')) fecharCaixa(); });

  async function abrirLista(slotId) {
    const atual = itensDoSet(M.atual).find((x) => x.slot === slotId);
    ctx = { slot: slotId, item: atual };
    caixa.innerHTML = `<div class="dlg-caixa picker-caixa"><div class="picker-topo"><h3>${ICONES[slotId]} ${esc(nomeSlot(slotId))}</h3><button type="button" class="modal-fechar" data-pk="fechar" aria-label="Fechar">✕</button></div>` +
      `<input class="picker-busca" placeholder="Buscar pelo nome (em inglês)..." autocomplete="off" maxlength="60">` +
      `<div class="picker-lista"><div class="bloqueio">Carregando itens...</div></div>` +
      (atual ? `<div class="picker-rodape"><span class="muted">No set: <b>${esc(atual.item_nome)}</b></span><button type="button" class="btn-editar" data-pk="editar-atual">Editar preço</button></div>` : '') + `</div>`;
    caixa.classList.remove('hidden');
    const busca = $('.picker-busca', caixa); setTimeout(() => busca.focus(), 30);
    const lista = await catalogo(slotId);
    const desenhar = () => {
      const q = busca.value.trim().toLowerCase(), f = lista.filter((i) => !q || i.nome.toLowerCase().includes(q)).slice(0, 300);
      const livre = q ? `<button type="button" class="picker-item livre" data-pk="livre"><span class="pi-img">✎</span><span><b>Usar "${esc(busca.value.trim())}"</b><small class="muted">item que não está na lista</small></span></button>` : '';
      $('.picker-lista', caixa).innerHTML = (lista.length ? '' : `<p class="muted picker-aviso">O catálogo de itens da TibiaWiki ainda está sendo importado (termina em algumas horas). Enquanto isso, digite o nome do item acima.</p>`) +
        f.map((i) => `<button type="button" class="picker-item" data-pk="item" data-nome="${esc(i.nome)}">` +
          `<span class="pi-img">${imgItem(i.itemid) ? `<img class="item-img" src="${imgItem(i.itemid)}" alt="" width="32" height="32" loading="lazy" data-ico="${ICONES[slotId]}">` : ICONES[slotId]}</span>` +
          `<span><b>${esc(i.nome)}</b><small class="muted">${[i.level ? 'lvl ' + i.level : '', i.vocacoes && !/^none$/i.test(i.vocacoes) ? esc(i.vocacoes) : '', i.armor ? 'arm ' + i.armor : ''].filter(Boolean).join(' · ') || '&nbsp;'}</small></span></button>`).join('') +
        livre + (lista.length && !f.length && !q ? '<div class="bloqueio">Nenhum item.</div>' : '');
    };
    busca.oninput = desenhar; desenhar();
    caixa.onclick = (e) => {
      const b = e.target.closest('[data-pk]'); if (!b) return;
      if (b.dataset.pk === 'fechar') return fecharCaixa();
      if (b.dataset.pk === 'editar-atual') return abrirDetalhe({ slot: slotId, item: atual });
      if (b.dataset.pk === 'livre') return abrirDetalhe({ slot: slotId, item: atual, escolhido: { nome: busca.value.trim().slice(0, 80), itemid: null } });
      const i = lista.find((x) => x.nome === b.dataset.nome); if (i) abrirDetalhe({ slot: slotId, item: atual, escolhido: i });
    };
  }

  // passo 2: preço do Market, já tenho, salvar/remover
  function abrirDetalhe(c) {
    ctx = c;
    const extra = c.slot === 'extra', it = c.item, nome = c.escolhido?.nome ?? it?.item_nome ?? '', itemid = c.escolhido ? c.escolhido.itemid : it?.itemid;
    const npc = c.escolhido?.npc_valor, trocando = !!(it && c.escolhido && c.escolhido.nome !== it.item_nome);
    caixa.innerHTML = `<form class="dlg-caixa picker-caixa picker-det" novalidate><div class="picker-topo"><h3>${extra ? (it ? 'Editar objetivo' : 'Novo objetivo') : esc(nomeSlot(c.slot))}</h3><button type="button" class="modal-fechar" data-pk="fechar" aria-label="Fechar">✕</button></div>` +
      `<div class="det-item"><span class="pi-img grande">${imgItem(itemid) ? `<img class="item-img" src="${imgItem(itemid)}" alt="" width="32" height="32" data-ico="${ICONES[c.slot]}">` : ICONES[c.slot]}</span>` +
      (extra ? `<label class="det-nome">Objetivo<input name="nome" required maxlength="60" placeholder="ex: Imbuements do mês" value="${esc(nome)}"></label>` : `<div><b class="det-titulo">${esc(nome)}</b>${npc ? `<small class="muted">NPC paga ${fmt(npc)} gp</small>` : ''}</div>`) + `</div>` +
      `<label>Preço no Market<input name="preco" data-gold placeholder="ex: 2.5kk ou 2.500.000" value="${it?.preco != null && (!c.escolhido || c.escolhido.nome === it.item_nome) ? fmt(it.preco) : ''}"></label>` +
      (trocando ? `<p class="muted" style="margin:10px 0 0">Vai substituir <b>${esc(it.item_nome)}</b> neste slot.</p>` : '') +
      `<label class="check det-check"><input type="checkbox" name="obtido" ${it?.obtido && !trocando ? 'checked' : ''}> <span>Já tenho este item</span></label>` +
      `<div class="dlg-botoes">${it ? '<button type="button" class="btn sec perigo" data-pk="remover">Remover</button>' : (extra ? '' : '<button type="button" class="btn sec" data-pk="voltar">Voltar</button>')}<button type="submit" class="btn btn-salvar-meta">✓ Salvar</button></div></form>`;
    caixa.classList.remove('hidden');
    const f = $('form', caixa);
    setTimeout(() => (extra && !nome ? f.nome : f.preco).focus(), 30);
    caixa.onclick = async (e) => {
      const b = e.target.closest('[data-pk]'); if (!b) return;
      if (b.dataset.pk === 'fechar') return fecharCaixa();
      if (b.dataset.pk === 'voltar') return abrirLista(c.slot);
      if (b.dataset.pk === 'remover') {
        if (!await confirmar('Remover do set?', `${it.item_nome} sai desta meta.`, { tipo: 'perigo', ok: 'Remover' })) return;
        const { error } = await sb.from('metas_itens').delete().eq('id', it.id); if (error) return erro(error);
        M.itens = M.itens.filter((x) => x.id !== it.id); fecharCaixa(); render(); toast('Removido.');
      }
    };
    f.onsubmit = async (e) => {
      e.preventDefault();
      const preco = f.preco.value.trim() ? gold(f.preco.value) : null;
      if (f.preco.value.trim() && (preco == null || preco < 0)) return toast('Preço não reconhecido.');
      const linhaNova = { preco, obtido: f.obtido.checked, item_nome: extra ? f.nome.value.trim().slice(0, 60) : nome, itemid: Number.isInteger(itemid) ? itemid : null };
      if (!linhaNova.item_nome) return toast('Dê um nome ao objetivo.');
      const btn = $('.btn-salvar-meta', caixa); btn.disabled = true;
      const r = it ? await sb.from('metas_itens').update(linhaNova).eq('id', it.id).select().single()
        : await sb.from('metas_itens').insert({ ...linhaNova, set_id: M.atual, slot: c.slot }).select().single();
      btn.disabled = false;
      if (r.error) return erro(r.error);
      M.itens = M.itens.filter((x) => x.id !== r.data.id).concat(r.data); fecharCaixa(); render(); toast('Meta salva!');
    };
  }

  // ---------- ações ----------
  document.addEventListener('click', async (e) => {
    const t = e.target.closest('[data-meta-set],[data-meta-acao],[data-meta-slot],[data-meta-obtido],[data-meta-editar]'); if (!t || !t.closest('#metas-app')) return;
    if (t.dataset.metaSet) { M.atual = +t.dataset.metaSet; try { localStorage.setItem('tc_meta_set', M.atual); } catch { /* ok */ } return render(); }
    if (t.dataset.metaSlot) return abrirLista(t.dataset.metaSlot);
    if (t.dataset.metaEditar) { const it = M.itens.find((x) => x.id === +t.dataset.metaEditar); return it && abrirDetalhe({ slot: it.slot, item: it }); }
    if (t.dataset.metaObtido) {
      const it = M.itens.find((x) => x.id === +t.dataset.metaObtido); if (!it) return;
      const { data, error } = await sb.from('metas_itens').update({ obtido: !it.obtido }).eq('id', it.id).select().single(); if (error) return erro(error);
      Object.assign(it, data); render(); return;
    }
    const a = t.dataset.metaAcao;
    if (a === 'extra') return abrirDetalhe({ slot: 'extra' });
    if (a === 'novo' || a === 'renomear') {
      const set = M.sets.find((s) => s.id === M.atual);
      const nome = await dialogo({ titulo: a === 'novo' ? 'Novo set' : 'Renomear set', texto: a === 'novo' ? 'Dê um nome para a sua meta. Ex: Set Knight 400, Set de Soul War...' : '', ok: 'Salvar',
        campo: { valor: a === 'renomear' ? set?.nome : '', placeholder: 'ex: Set Knight 400' }, validar: (v) => (!v.trim() ? 'Digite um nome.' : v.trim().length > 60 ? 'Use até 60 caracteres.' : '') });
      if (!nome) return;
      const r = a === 'novo' ? await sb.from('metas_sets').insert({ nome: nome.trim() }).select().single() : await sb.from('metas_sets').update({ nome: nome.trim() }).eq('id', M.atual).select().single();
      if (r.error) return erro(r.error);
      M.sets = M.sets.filter((s) => s.id !== r.data.id).concat(r.data).sort((x, y) => (x.criado_em > y.criado_em ? 1 : -1));
      M.atual = r.data.id; try { localStorage.setItem('tc_meta_set', M.atual); } catch { /* ok */ }
      render(); if (a === 'novo') toast('Set criado! Clique nos slots para escolher as peças.');
    }
    if (a === 'apagar') {
      const set = M.sets.find((s) => s.id === M.atual);
      if (!await confirmar('Apagar este set?', `"${set.nome}" e todas as peças e objetivos dele serão apagados.`, { tipo: 'perigo', ok: 'Apagar set' })) return;
      const { error } = await sb.from('metas_sets').delete().eq('id', set.id); if (error) return erro(error);
      M.sets = M.sets.filter((s) => s.id !== set.id); M.itens = M.itens.filter((x) => x.set_id !== set.id); M.atual = M.sets[0]?.id || null; render();
    }
  });

  // imagem do item que não carregar vira o ícone do slot
  document.addEventListener('error', (e) => {
    const i = e.target; if (!(i instanceof HTMLImageElement) || !i.classList.contains('item-img')) return;
    i.replaceWith(Object.assign(document.createElement('span'), { className: 'inv-ico', textContent: i.dataset.ico || '•' }));
  }, true);

  // carrega quando a página Metas é aberta; o painel de banco muda o "quanto o banco cobre"
  document.addEventListener('click', (e) => { if (e.target.closest('#menu [data-pag=metas]')) { if (!M.carregado) { render(); carregar(); } else render(); } });
  const persOriginal = window.renderPersonagem;
  window.renderPersonagem = function () { persOriginal(); if (M.carregado && !$('#pag-metas').classList.contains('hidden')) render(); };
})();

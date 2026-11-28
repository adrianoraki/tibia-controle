// TibiaHub — barra lateral: recolher no computador, abrir/fechar no celular, título da página no topo
(() => {
  const lat = document.getElementById('lateral'), veu = document.getElementById('lat-veu'), hamb = document.getElementById('btn-hamb');
  const tit = document.getElementById('topo-tit'), corpo = document.getElementById('tela-app');
  if (!lat) return;
  try { if (localStorage.getItem('tc_lateral') === 'recolhida') corpo.classList.add('lat-recolhida'); } catch { /* sem storage */ }

  const abrir = (sim) => {
    lat.classList.toggle('aberta', sim); veu.hidden = !sim; hamb.setAttribute('aria-expanded', String(sim));
    document.body.classList.toggle('sem-rolagem', sim);
    if (sim) lat.querySelector('#menu button.ativo, #menu button')?.focus();
  };
  hamb.addEventListener('click', () => abrir(!lat.classList.contains('aberta')));
  veu.addEventListener('click', () => abrir(false));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && lat.classList.contains('aberta')) { abrir(false); hamb.focus(); } });

  document.getElementById('lat-recolher').addEventListener('click', () => {
    const r = corpo.classList.toggle('lat-recolhida');
    try { localStorage.setItem('tc_lateral', r ? 'recolhida' : 'aberta'); } catch { /* ok */ }
  });

  // título do topo acompanha a página aberta
  const atualizar = () => { const b = lat.querySelector('#menu button.ativo'); tit.textContent = b?.querySelector('span')?.textContent || 'Painel'; };
  lat.querySelector('#menu').addEventListener('click', (e) => { if (e.target.closest('button')) { setTimeout(atualizar, 0); abrir(false); } });
  new MutationObserver(atualizar).observe(lat.querySelector('#menu'), { subtree: true, attributes: true, attributeFilter: ['class'] });
  atualizar();


  // grupos do menu que abrem e fecham com um clique no título (a escolha fica neste aparelho)
  (() => {
    const menu = lat.querySelector('#menu'), CH = 'tc_menu_grupos';
    let fechados = new Set(); try { fechados = new Set(JSON.parse(localStorage.getItem(CH) || '[]')); } catch { /* ok */ }
    let grupo = null;
    for (const el of [...menu.children]) {
      if (el.classList.contains('nav-grupo')) {
        grupo = el.textContent.trim();
        const b = document.createElement('button'); b.type = 'button'; b.className = 'nav-grupo nav-grupo-btn'; b.dataset.grupo = grupo;
        b.innerHTML = `<span>${grupo}</span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>`;
        el.replaceWith(b); continue;
      }
      if (grupo && el.matches('button[data-pag]')) el.dataset.grupoDe = grupo;
    }
    const aplicar = () => {
      const ativo = menu.querySelector('button[data-pag].ativo')?.dataset.grupoDe;
      menu.querySelectorAll('.nav-grupo-btn').forEach((b) => {
        const g = b.dataset.grupo, fechado = fechados.has(g) && g !== ativo;
        b.setAttribute('aria-expanded', String(!fechado)); b.classList.toggle('fechado', fechado);
        const itens = [...menu.querySelectorAll(`button[data-grupo-de="${CSS.escape(g)}"]`)];
        itens.forEach((i) => i.classList.toggle('nav-escondido', fechado));
        const n = itens.filter((i) => !i.classList.contains('hidden') && !i.classList.contains('nav-oculto')).length;
        b.querySelector('span').textContent = fechado ? `${g} · ${n}` : g;
      });
    };
    menu.addEventListener('click', (e) => {
      const b = e.target.closest('.nav-grupo-btn'); if (!b) return;
      e.stopPropagation();
      const g = b.dataset.grupo; if (fechados.has(g)) fechados.delete(g); else fechados.add(g);
      try { localStorage.setItem(CH, JSON.stringify([...fechados])); } catch { /* ok */ }
      aplicar();
    }, true);
    new MutationObserver(aplicar).observe(menu, { subtree: true, attributes: true, attributeFilter: ['class'] });
    aplicar();
  })();

  // celular: barra de baixo com as páginas mais usadas + botão que abre o menu completo
  const BAIXO = [['painel', 'Painel'], ['hunts', 'Hunts'], ['inventario', 'Inventário'], ['magias', 'Magias']];
  const nb = document.createElement('nav'); nb.className = 'nav-baixo'; nb.setAttribute('aria-label', 'Atalhos');
  nb.innerHTML = BAIXO.map(([p, n]) => { const b = lat.querySelector(`#menu [data-pag="${p}"] svg`); return `<button type="button" data-baixo="${p}">${b ? b.outerHTML : ''}<span>${n}</span></button>`; }).join('') +
    '<button type="button" data-baixo="menu" aria-label="Abrir o menu completo"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"/></svg><span>Menu</span></button>';
  corpo.appendChild(nb);
  nb.addEventListener('click', (e) => {
    const b = e.target.closest('[data-baixo]'); if (!b) return;
    if (b.dataset.baixo === 'menu') return abrir(true);
    lat.querySelector(`#menu [data-pag="${b.dataset.baixo}"]`)?.click(); window.scrollTo({ top: 0 });
  });
  const marcar = () => { const at = lat.querySelector('#menu button.ativo')?.dataset.pag; nb.querySelectorAll('[data-baixo]').forEach((b) => { const sim = b.dataset.baixo === at; b.classList.toggle('ativo', sim); if (sim) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); }); };
  new MutationObserver(marcar).observe(lat.querySelector('#menu'), { subtree: true, attributes: true, attributeFilter: ['class'] });
  marcar();
})();

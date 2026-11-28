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

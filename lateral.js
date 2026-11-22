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
})();

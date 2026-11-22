// TibiaControle — aplica o tema salvo antes de desenhar a página (evita piscar)
(function () {
  var t = 'azul';
  try { t = localStorage.getItem('tc_tema') || 'azul'; } catch (e) { /* sem armazenamento */ }
  if (['azul', 'noite', 'dourado'].indexOf(t) < 0) t = 'azul';
  document.documentElement.setAttribute('data-tema', t);
})();
// cor do tema atual (para os gráficos em SVG)
window.corTema = function (v) { return getComputedStyle(document.documentElement).getPropertyValue(v).trim(); };

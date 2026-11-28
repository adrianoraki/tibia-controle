// TibiaHub — aplica o tema salvo antes de desenhar a página (evita piscar)
(function () {
  var t = 'azul';
  try { t = localStorage.getItem('tc_tema') || 'azul'; } catch (e) { /* sem armazenamento */ }
  if (['azul', 'noite', 'dourado', 'medieval', 'moderno'].indexOf(t) < 0) t = 'azul';
  document.documentElement.setAttribute('data-tema', t);
})();
// cor do tema atual (para os gráficos em SVG)
window.corTema = function (v) { return getComputedStyle(document.documentElement).getPropertyValue(v).trim(); };

// aviso no console do navegador: golpistas pedem para colar código aqui e roubar a conta (self-XSS)
(function () {
  try {
    var c = window.console; if (!c || !c.log) return;
    c.log('%cPARE!', 'color:#dc2626;font-size:44px;font-weight:800;-webkit-text-stroke:1px #000');
    c.log('%cEsta área é só para desenvolvedores. Se alguém pediu para você copiar e colar algo aqui, é GOLPE: a pessoa quer entrar na sua conta do TibiaHub.', 'font-size:16px;font-weight:600');
    c.log('%cO TibiaHub nunca pede sua senha nem pede para colar código. Feche esta janela.', 'font-size:14px');
  } catch (e) { /* ok */ }
})();


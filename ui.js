// TibiaControle — caixas de confirmação e de digitação no visual do site (substituem confirm/prompt do navegador)
(() => {
  const el = document.createElement('div');
  el.className = 'dlg hidden'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true');
  el.innerHTML = '<form class="dlg-caixa" novalidate><div class="dlg-ico" aria-hidden="true"></div><h3 class="dlg-tit"></h3><p class="dlg-txt"></p>' +
    '<input class="dlg-campo hidden" autocomplete="off"><small class="dlg-dica"></small>' +
    '<div class="dlg-botoes"><button type="button" class="btn sec dlg-nao">Cancelar</button><button type="submit" class="btn dlg-sim">OK</button></div></form>';
  document.body.appendChild(el);
  const $ = (s) => el.querySelector(s), form = $('form'), campo = $('.dlg-campo');
  let fim = null, validar = null;

  function fechar(v) { el.classList.add('hidden'); document.removeEventListener('keydown', esc, true); const f = fim; fim = null; f?.(v); }
  function esc(e) { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); fechar(null); } }
  $('.dlg-nao').onclick = () => fechar(null);
  el.addEventListener('mousedown', (e) => { if (e.target === el) fechar(null); });
  form.onsubmit = (e) => {
    e.preventDefault();
    if (campo.classList.contains('hidden')) return fechar(true);
    const erro = validar?.(campo.value);
    if (erro) { $('.dlg-dica').textContent = erro; $('.dlg-dica').classList.add('erro'); campo.focus(); return; }
    fechar(campo.value);
  };

  // dialogo({ titulo, texto, ok, cancelar, tipo: 'perigo'|'ok', campo: { valor, placeholder, tipo, gold }, validar })
  // devolve: true (confirmou), o texto digitado, ou null (cancelou)
  window.dialogo = (o = {}) => new Promise((res) => {
    if (fim) fim(null);
    fim = res; validar = o.validar || null;
    el.dataset.tipo = o.tipo || '';
    $('.dlg-ico').textContent = o.tipo === 'perigo' ? '!' : o.campo ? '✎' : '?';
    $('.dlg-tit').textContent = o.titulo || 'Confirmar';
    $('.dlg-txt').textContent = o.texto || '';
    $('.dlg-sim').textContent = o.ok || 'Confirmar';
    $('.dlg-nao').textContent = o.cancelar || 'Cancelar';
    $('.dlg-sim').classList.toggle('perigo-btn', o.tipo === 'perigo');
    const d = $('.dlg-dica'); d.textContent = ''; d.classList.remove('erro');
    el.querySelectorAll('.gold-dica').forEach((x) => x.remove());
    campo.classList.toggle('hidden', !o.campo);
    if (o.campo) {
      campo.type = o.campo.tipo || 'text'; campo.value = o.campo.valor ?? ''; campo.placeholder = o.campo.placeholder || '';
      campo.toggleAttribute('data-gold', !!o.campo.gold);
    }
    el.classList.remove('hidden');
    document.addEventListener('keydown', esc, true);
    setTimeout(() => (o.campo ? (campo.focus(), campo.select()) : $('.dlg-sim').focus()), 30);
  });
  window.confirmar = (titulo, texto, o = {}) => dialogo({ titulo, texto, ...o });
})();

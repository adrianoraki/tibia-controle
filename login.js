// TibiaControle — detalhes visuais da tela de login
document.getElementById('ver-senha').onclick = function () {
  var i = document.querySelector('#form-auth [name=senha]'); var v = i.type === 'password';
  i.type = v ? 'text' : 'password'; this.setAttribute('aria-label', v ? 'Esconder senha' : 'Mostrar senha'); this.classList.toggle('on', v);
};
document.querySelectorAll('.tab-auth').forEach(function (b) {
  b.addEventListener('click', function () {
    var cad = b.dataset.modo === 'cadastrar';
    document.getElementById('auth-titulo').textContent = cad ? 'Crie sua conta' : 'Bem-vindo de volta';
    document.getElementById('auth-desc').textContent = cad ? 'Leva menos de um minuto.' : 'Entre para ver seu painel.';
    document.getElementById('btn-esqueci').classList.toggle('hidden', cad);
    document.querySelector('#form-auth [name=senha]').autocomplete = cad ? 'new-password' : 'current-password';
    document.querySelector('#form-auth [name=senha]').placeholder = cad ? 'mínimo 8 caracteres' : 'sua senha';
  });
});

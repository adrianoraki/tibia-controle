// TibiaHub — verificação de dono do personagem (código no comentário do Tibia.com)
(() => {
  const css = document.createElement('style');
  css.textContent = `.verif{background:var(--card2);border:1px solid var(--borda);border-radius:12px;padding:16px;margin:0 0 16px}.verif:empty{display:none}
.verif h3{margin:0 0 8px;font-size:15px}.passos{padding-left:20px;line-height:1.9;margin:0 0 12px}.passos a{color:var(--ouro)}
.codigo{font-family:ui-monospace,Consolas,monospace;background:#15130f;border:1px dashed var(--ouro);color:var(--ouro);padding:2px 8px;border-radius:6px;font-weight:700;letter-spacing:1px}
.btn.mini{padding:3px 10px;font-size:12px;margin:0 0 0 6px}
.selo-verif{font-size:12px;font-weight:600;color:var(--verde);background:rgba(108,192,112,.12);border:1px solid rgba(108,192,112,.35);border-radius:20px;padding:2px 8px;vertical-align:middle}`;
  document.head.appendChild(css);
  const box = document.createElement('div'); box.id = 'verificacao'; box.className = 'verif';
  document.getElementById('form-perfil').after(box);

  function renderVerificacao() {
    const p = S.perfil;
    if (!p?.personagem) { box.innerHTML = ''; return; }
    if (p.verificado) {
      box.innerHTML = `<h3>✔ Personagem verificado</h3><p class="muted">${esc(p.personagem)} foi confirmado como seu${p.verificado_em ? ' em ' + new Date(p.verificado_em).toLocaleDateString('pt-BR') : ''}. Você já pode tirar o código do comentário no Tibia.com.</p>`;
      return;
    }
    box.innerHTML = `<h3>Verificar que ${esc(p.personagem)} é seu</h3>` + (p.codigo_verificacao
      ? `<ol class="passos">
          <li>Copie o código: <span class="codigo">${esc(p.codigo_verificacao)}</span> <button class="btn sec mini" type="button" data-acao="copiar">Copiar</button></li>
          <li>Entre no <a href="https://www.tibia.com/account/" target="_blank" rel="noopener">Tibia.com</a> → <i>Manage Account</i> → <i>Edit</i> no personagem e cole o código no campo <i>Comment</i>.</li>
          <li>Salve e clique em verificar. Depois de verificado, você pode apagar o código.</li>
        </ol><button class="btn" type="button" data-acao="verificar">Verificar agora</button>`
      : `<p class="muted">Prove que o personagem é seu colocando um código no comentário dele no Tibia.com. Assim ninguém consegue usar seu personagem em outra conta.</p><button class="btn" type="button" data-acao="gerar">Gerar código de verificação</button>`);
  }

  // estende as funções de desenho do app.js
  const contaOriginal = window.renderConta, persOriginal = window.renderPersonagem;
  window.renderConta = function () { contaOriginal(); renderVerificacao(); };
  window.renderPersonagem = function () {
    persOriginal();
    if (S.perfil?.verificado) $('#card-char .char-nome')?.insertAdjacentHTML('beforeend', ' <span class="selo-verif" title="Personagem verificado">✔ verificado</span>');
  };

  box.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-acao]'); if (!btn) return;
    const acao = btn.dataset.acao;
    if (acao === 'copiar') { try { await navigator.clipboard.writeText(S.perfil.codigo_verificacao); toast('Código copiado!'); } catch { toast(S.perfil.codigo_verificacao); } return; }
    btn.disabled = true;
    try {
      if (acao === 'gerar') {
        const { data, error } = await sb.rpc('gerar_codigo_verificacao'); if (error) throw error;
        S.perfil.codigo_verificacao = data;
      } else {
        btn.textContent = 'Verificando...';
        const { data, error } = await sb.functions.invoke('verificar-personagem', { method: 'POST' });
        if (error) throw error;
        if (!data?.ok) toast(data?.erro || 'Não foi possível verificar.');
        else {
          const r = await sb.from('profiles').select('*').eq('id', S.user.id).single();
          if (!r.error) S.perfil = r.data;
          renderPersonagem(); toast('Personagem verificado! ✔');
        }
      }
    } catch (err) { erro(err); }
    renderVerificacao();
  });
})();

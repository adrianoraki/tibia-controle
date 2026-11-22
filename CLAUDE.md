# TibiaHub — regras do projeto

## Toda atualização publicada tem versão e novidade (obrigatório)
Sempre que uma mudança for publicada no site (Vercel), no MESMO commit:
1. Acrescente uma entrada **no topo** de `novidades.json` com a versão nova:
   `{ "versao": "X.Y.Z", "data": "<ISO com fuso -03:00>", "tipo": "novo|melhoria|correcao|aviso", "titulo": "...", "texto": "..." }`
2. Versão (semver): **X** muda grande/incompatível · **Y** funcionalidade nova · **Z** correção ou ajuste pequeno.
3. Escreva título e texto para o jogador (português do Brasil, sem termos técnicos).

O site lê a versão atual da primeira entrada de `novidades.json` (rodapé e cartão da conta) e mostra o aviso
"Nova versão disponível" para quem está com o site aberto. Por isso novidade e site são publicados juntos — nunca separados.

## Segurança (não negociável)
- Todo texto vindo do usuário ou de APIs passa por `esc()` antes de ir para `innerHTML`.
- Nada de `onclick=`/`<script>` inline: a Content-Security-Policy (vercel.json) bloqueia.
- Tabelas novas: RLS ligado, `revoke all ... from anon`, políticas por `auth.uid()`, limites de tamanho (`check`).
- Funções SECURITY DEFINER com `set search_path = ''` e checagem de dono/admin dentro da função.

## Stack
HTML/CSS/JS puro (sem build) · Supabase (projeto shqwskfijvfndaocaqdv) · Vercel (projeto tibia-controle, publica a partir do GitHub `main`).

## Pendências (combinadas com o Luis)
- **Mais de um personagem na mesma conta (VIP)**: mexe em hunts, XP e coleta automática; fazer numa etapa separada.
- **Preços do VIP aprovados** (mostrar e ligar o Pix só depois da resposta da CipSoft sobre plano pago no programa de fansites):
  Mensal R$ 9,90 · Trimestral R$ 24,90 · Anual R$ 79,90. Pagamento previsto: Pix via Mercado Pago (conta do Luis).
- **Programa de fansites**: e-mail enviado a fansites@tibia.com em 22/11/2026; aguardando resposta (plano pago + permissão para hospedar imagens).
- **Domínio tibiahub.com.br**: quando o Luis registrar, ligar na Vercel.
- **Sobras no Supabase**: bucket vazio "imagens" e Edge Function "copiar-imagens" (apagar pelo painel se a CipSoft não liberar as imagens).

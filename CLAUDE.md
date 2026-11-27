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
- Nunca dar TRUNCATE/REFERENCES/TRIGGER para anon/authenticated (TRUNCATE ignora RLS). Tabela só de leitura: só SELECT.
- Dados de outros jogadores (ex.: avisos do Yasir) saem por função que não devolve user_id.
- Yasir em tempo real: gatilho tg_yasir_avisar manda só {} no canal privado `yasir:<mundo>` (realtime.send); política em realtime.messages só deixa logados ESCUTAR (sem insert). O site rebusca por yasir_hoje().
- Online do site: tabelas site_online/site_recorde sem acesso direto; o site chama ping_online() a cada minuto e recebe só {online, recorde, recorde_em}.
- O aviso "PARE!" do console fica em tema.js; tokens de e-mail são tirados do endereço em app.js (onAuthStateChange).
- Pendente no painel do Supabase (Auth > Senhas): ligar a proteção contra senhas vazadas (HaveIBeenPwned), se o plano permitir.

## Stack
HTML/CSS/JS puro (sem build) · Supabase (projeto shqwskfijvfndaocaqdv) · Vercel (projeto tibia-controle, publica a partir do GitHub `main`).

## Dados importados
- Magias: Edge Function `importar-magias` (tibiawiki.dev/api/spells?expand=true) → tabela `magias`; cron `magias-semanal` (quarta 11:35 UTC) via disparar_func.
- Inventário do personagem: não existe API (tibia.com não publica inventário/depot; só o Char Bazaar mostra itens de personagens à venda). Não ler arquivos/memória do client (regras da CipSoft/BattlEye).

## Pendências (combinadas com o Luis)
- **Mais de um personagem na mesma conta (VIP)**: mexe em hunts, XP e coleta automática; fazer numa etapa separada.
- **Plano Apoiador (antigo VIP)**: preços aprovados Mensal R$ 9,90 · Trimestral R$ 24,90 · Anual R$ 79,90; Pix via Mercado Pago (conta do Luis) ainda a ligar.
  Regra da CipSoft (resposta de 23/11/2026): pode haver recursos pagos para cobrir custos, desde que a maior parte seja grátis,
  não se cobre pelo conteúdo do jogo e o foco não seja lucro. Por isso: **conteúdo do jogo é sempre grátis** (mapa, Boss Tracker,
  locais de caça, NPCs, fichas, eventos, notícias); o Apoiador só ganha ferramentas pessoais do jogador.
- **Programa de fansites**: recusado em 23/11/2026 por ser recente, ter muita ajuda de IA e pouco conteúdo original. Pode tentar no futuro,
  com tempo de site, comunidade própria e conteúdo original do Luis.
- **Imagens do tibia.com**: CipSoft liberou usar imagens e textos do jogo/site citando www.tibia.com (feito no rodapé e no Quem somos);
  o download automático segue bloqueado pelo Cloudflare — se for copiar, usar o kit de fãs ou baixar pelo navegador do Luis.
- **Domínio tibiahub.com.br**: quando o Luis registrar, ligar na Vercel.
- **Sobras no Supabase**: bucket vazio "imagens" e Edge Function "copiar-imagens" (apagar pelo painel se a CipSoft não liberar as imagens).

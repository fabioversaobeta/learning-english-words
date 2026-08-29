# English Learning App

Aplicação para aprender inglês enquanto estuda outros assuntos: você cria uma conta, informa um
tópico, a Claude API gera um texto em inglês sobre ele, você seleciona as palavras que não
conhece e recebe a definição (em inglês) e a tradução PT-BR de cada uma.

## Autenticação

- É preciso criar uma conta (e-mail + senha) para usar qualquer funcionalidade além da Home.
  Senhas são armazenadas com `bcrypt` (nunca em texto puro); a sessão é um cookie `httpOnly`
  referenciando uma tabela `sessions` no banco (pode ser revogada no logout).
- Login errado repetidas vezes trava temporariamente aquele e-mail (5 tentativas / 15 min, com
  bloqueio progressivo). A mensagem de erro é sempre genérica ("e-mail ou senha inválidos"), sem
  indicar se o e-mail existe.
- **Fora de escopo por enquanto** (próximos passos, se fizerem sentido no futuro): verificação de
  e-mail no cadastro e fluxo de "esqueci minha senha" por e-mail — nenhum dos dois está
  implementado hoje porque exigiriam configurar um provedor de envio de e-mail.
- Limite de 1 tópico novo por dia (dia calendário UTC) por usuário, aplicado no backend.

## Stack

- Frontend: React + TypeScript + Vite
- Backend: Node.js + Express + TypeScript
- Banco: PostgreSQL (local via Docker; Supabase em produção)
- LLM: Claude API (`@anthropic-ai/sdk`)

## Rodando localmente com Docker

1. Copie o `.env.example` para `.env` na raiz e preencha sua chave:

   ```bash
   cp .env.example .env
   ```

2. Suba os containers:

   ```bash
   docker compose up --build
   ```

3. Acesse:
   - Frontend: http://localhost:3000
   - Backend: http://localhost:3001/health

O banco Postgres roda migrations automaticamente na primeira subida (script em
`backend/src/db/migrations`).

## Rodando sem Docker

Backend:

```bash
cd backend
npm install
cp .env.example .env   # ajuste DATABASE_URL e ANTHROPIC_API_KEY
npm run dev
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

## Fluxo da aplicação

1. Você cria uma conta ou faz login.
2. Você informa título e descrição de um assunto (limite: 1 novo tópico por dia).
3. O backend chama a Claude API e retorna um texto em inglês sobre o assunto.
4. Você clica nas palavras que não conhece; elas aparecem numa lista lateral, de onde
   podem ser removidas.
5. Ao confirmar, o backend pede à Claude a definição (em inglês) e a tradução PT-BR de
   cada palavra, sempre no mesmo formato, e tudo é salvo no banco, vinculado à sua conta.

## Flashcards

A aba **Flashcards** revisa as palavras que você já marcou, com repetição espaçada leve:

- Cada palavra em `words_learned` tem um `retention_level` (0 = não sei / nova, 1 = tenho
  dúvida, 2–5 = confiança crescente) e um `next_review_at` que agenda a próxima aparição.
- O card mostra só a palavra (frente); "Revelar tradução" (ou clique no card) exibe a
  definição e a tradução (verso). Há um botão de áudio para ouvir a pronúncia (Web Speech API).
- Avaliação: 🟢 **Aprendi** sobe o nível e adia a revisão; 🟡 **Tenho dúvida** fixa o nível
  intermediário (volta em ~1 dia); 🔴 **Não sei** zera o nível e reinsere a palavra no fim
  do deck da sessão atual, além de deixá-la vencida para a próxima sessão.
- A fila (`GET /api/flashcards/queue`) traz só os cards vencidos, um por palavra distinta,
  filtrados pelo idioma de tradução selecionado. Palavras novas entram vencidas, então basta
  voltar aqui de tempos em tempos conforme você adiciona mais assuntos.

## Deploy (planejado)

- Frontend → Vercel
- Backend → Railway/Render
- Banco → Supabase (Postgres gerenciado)

### Same-origin via rewrites da Vercel

Como o frontend (Vercel) e o backend (Railway/Render) ficam em domínios diferentes, e o cookie
de sessão precisa se comportar como same-origin (mais simples e robusto que cookie
`SameSite=None` cross-site), o deploy usa `rewrites` da Vercel: `frontend/vercel.json` expõe
`/api/*` como proxy para o backend, então o navegador só enxerga o domínio `*.vercel.app`.

Antes de deployar:

1. Suba o backend no Railway/Render e pegue a URL pública dele.
2. Edite `frontend/vercel.json` e troque `__BACKEND_URL__` pela URL real do backend (sem
   `https://` duplicado).
3. Configure a env var `VITE_API_URL=""` (string vazia) no projeto da Vercel, para que o
   frontend chame `/api/...` relativo (que passa pelo rewrite) em vez de uma URL absoluta.
4. No backend, configure `NODE_ENV=production` e `FRONTEND_ORIGIN` com a URL da Vercel (usada
   apenas como fallback de CORS; com o rewrite, as chamadas do navegador já chegam como
   same-origin e nem dependem de CORS).

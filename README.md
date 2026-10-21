# Experimento de IHC

Aplicação local de pesquisa sobre a percepção de controle em tarefas com três níveis de autonomia. O agente é simulado por regras determinísticas em TypeScript; nenhuma API de IA é chamada.

## Requisitos e configuração

- Node.js 25.1 ou compatível com Next.js 16.4.
- PostgreSQL acessível localmente.
- `DATABASE_URL` definida no `.env` (o arquivo não deve ser versionado).

O Prisma ORM 7 usa `prisma7.config.ts`, o schema em `prisma/schema.prisma` e o client gerado em `app/generated/prisma`. A conexão do app usa `@prisma/adapter-pg` e `pg`, exclusivamente no servidor.

## Executar localmente

```bash
npm install
npx prisma generate
npx prisma migrate deploy
npm run dev
```

Abra <http://localhost:3000>. O participante confirma o consentimento, recebe um código aleatório e realiza as três condições em ordem aleatória. Uma sessão de acesso aleatória é mantida em cookie HttpOnly; o banco guarda apenas seu hash. Não informe dados pessoais reais.

## Verificações

```bash
npm run lint
npx tsc --noEmit --incremental false
npm test
npm run build
```

## Estrutura

- `app/experiment-app.tsx`: consentimento, agenda, interação e questionário.
- `app/api/`: rotas para criação/recuperação de participante, ações e respostas.
- `lib/experiment.ts`: tarefa fixa e regras determinísticas de autonomia.
- `lib/participant.ts`: cookie de acesso e resolução do participante no servidor.
- `lib/prisma.ts`: instância reutilizável do Prisma Client.
- `prisma/schema.prisma` e `prisma/migrations/`: persistência PostgreSQL.

As condições usam a mesma agenda e as mesmas três ações. Baixa autonomia pede aprovação para cada ação; média autonomia executa ações rotineiras e pede decisão para resolver o conflito; alta autonomia executa o plano e permite interromper a sequência. Rejeitar uma ação registra a decisão e permite seguir ao questionário.

## Limitações antes de coleta externa

O abandono é registrado quando o participante usa o botão "Encerrar participação"; fechar a página sem usar o botão deixa a sessão como incompleta. Este MVP não inclui área administrativa ou exportação de dados, autenticação de pesquisador ou teste piloto. O texto de consentimento é uma base e deve ser revisado com a orientação e a instituição; a aplicação não afirma aprovação ética. Use o guia de Quick Tunnel abaixo somente para desenvolvimento e testes controlados; não o trate como hospedagem de produção ou aprovação ética.

## Cloudflare Quick Tunnel no Windows

O Quick Tunnel publica temporariamente o servidor Next.js local por HTTPS, sem domínio próprio. Veja também o [guia oficial da Cloudflare para Quick Tunnels](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/do-more-with-tunnels/trycloudflare/). O PostgreSQL continua neste computador e o túnel deve apontar somente para `127.0.0.1:3000`; nunca encaminhe a porta `5432`. A URL `trycloudflare.com` é aleatória, muda ao reiniciar o túnel e não tem garantia de disponibilidade. Quick Tunnels são para desenvolvimento/testes, têm limite de 200 requisições simultâneas e não suportam SSE.

### Pré-requisitos

- Node.js e dependências instaladas (`npm install`).
- PostgreSQL 18 instalado e iniciado como serviço `postgresql-x64-18`.
- `DATABASE_URL` no `.env` apontando para `localhost` ou `127.0.0.1`; o `.env` não deve ser compartilhado nem versionado.
- `cloudflared` para Windows. Se o comando não for reconhecido, baixe e instale o MSI Windows x64 pela [página oficial de downloads da Cloudflare](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/downloads/). Depois feche e reabra o PowerShell e confira com `cloudflared --version`.

### Garantir que o PostgreSQL aceite apenas conexões locais

O arquivo `C:\Program Files\PostgreSQL\18\data\postgresql.conf` foi ajustado para `listen_addresses = 'localhost'`. O serviço em execução não pôde ser reiniciado sem permissão administrativa; até o reinício, o processo ainda pode aparecer escutando em todas as interfaces, embora o `pg_hba.conf` atual aceite somente `127.0.0.1/32` e `::1/128`.

Em um PowerShell aberto como Administrador, reinicie o serviço:

```powershell
Restart-Service postgresql-x64-18
Get-Service postgresql-x64-18
netstat -ano | findstr :5432
```

O resultado esperado para `5432` contém listeners em `127.0.0.1:5432` e/ou `[::1]:5432`, nunca `0.0.0.0:5432` nem `[::]:5432`. O serviço do PostgreSQL inicia automaticamente no Windows; se estiver parado, use `Start-Service postgresql-x64-18` no PowerShell como Administrador. Não crie regra de firewall ou encaminhamento do roteador para a porta do banco.

### Iniciar o app e o túnel

Use dois terminais PowerShell na pasta do projeto.

**Terminal 1 — app local:**

```powershell
npm run dev
```

O Next.js escuta somente em `127.0.0.1:3000`. Abra `http://127.0.0.1:3000` e confirme que a tela inicial carrega antes de continuar. O script `npm run tunnel` verifica se o app está escutando apenas no loopback antes de iniciar o túnel.

**Terminal 2 — túnel:**

```powershell
npm run tunnel
```

Mantenha os dois terminais abertos. Copie a URL `https://<nome-aleatorio>.trycloudflare.com` que o `cloudflared` imprimir; não use um endereço inventado nem o endereço `http://localhost:3000` fora do computador. Abra a URL pública em outro dispositivo, preferencialmente com o Wi-Fi desligado e dados móveis ativos. Uma resposta `401` de `/api/experiment` sem cookie é esperada e indica que a rota exige a sessão do participante.

Se o PowerShell disser que `cloudflared` não existe, instale o MSI pela página oficial acima, reabra o terminal e repita `cloudflared --version`. Se `npm run tunnel` disser que não há Next.js em `127.0.0.1:3000`, inicie o Terminal 1 primeiro. Se houver erro de origem do Next.js, confira `allowedDevOrigins` em `next.config.ts`; a configuração deste projeto permite apenas o padrão de subdomínio de Quick Tunnel e somente no servidor de desenvolvimento. O app usa rotas API autenticadas por cookie HttpOnly, não Server Actions.

### Encerrar e verificar

- Pressione `Ctrl+C` no Terminal 2 para encerrar o túnel; a URL temporária deixa de funcionar.
- Pressione `Ctrl+C` no Terminal 1 para encerrar o Next.js.
- Os dados continuam no PostgreSQL local. O teste `npm test` verifica persistência e isolamento usando uma transação revertida, sem deixar participantes de teste no banco. A primeira execução iniciada pelo navegador é registrada como participação oficial; não a use para um teste técnico sem autorização. Repetições iniciadas por **Iniciar novo teste** são marcadas como teste.
- Para inspecionar as respostas gravadas, execute `npx prisma studio` em um terceiro terminal local e confira `ExperimentalSession` e `QuestionnaireResponse`. Não encaminhe nem compartilhe a porta `5555` do Studio; ele tem acesso direto para editar o banco.
- As rotas de ações, sessões e questionários resolvem o participante pelo cookie HttpOnly e verificam que a sessão pertence a esse participante; não aceite IDs de outra participação como autorização.
- Para uma demonstração pública, qualquer pessoa com a URL do Quick Tunnel pode tentar acessar a aplicação. Compartilhe a URL apenas com o grupo previsto e não colete dados pessoais reais. A URL pode mudar quando o túnel reiniciar. A Cloudflare não garante disponibilidade para Quick Tunnels.
- Durante a coleta, o computador precisa permanecer ligado, conectado à internet e sem suspender; mantenha o serviço PostgreSQL, o Next.js e o `cloudflared` em execução. Ajuste **Configurações do Windows → Sistema → Energia → Tela e suspensão** para evitar suspensão enquanto conectado à tomada e restaure a configuração depois.

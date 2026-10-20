# Deploy no Netlify

O site é gerado pelo Astro a partir das pastas de `caderno/`. Os dados de cada pessoa (sessões, erros, redações, simulados, tarefas marcadas, grifos e anotações) ficam no **Netlify Blobs**, gravados pelas **Netlify Functions**. Uma **Edge Function** bloqueia todas as páginas para quem não fez login.

## 1. Variáveis de ambiente

Cadastre em **Project configuration → Environment variables → Add a variable**. Deixe *All scopes* e *Same value for all deploy contexts*. Não marque *Contains secret values*: com essa opção, a variável precisa de escopos específicos e pode não chegar às Edge Functions.

| Variável | Para que serve | Exemplo |
|---|---|---|
| `AUTH_SECRET` | Chave que assina os tokens de login. Use uma string aleatória longa (32 ou mais caracteres). Se for trocada, todos precisam entrar de novo. | gere com `openssl rand -base64 32` |
| `SENHA_<NOME>` | Uma variável por pessoa. O `<NOME>` vira o usuário do login, em minúsculas. | `SENHA_JULIA` → usuário `julia` |

Exemplo para duas pessoas:

```
AUTH_SECRET=Zr9...(aleatório)
SENHA_MARIA=uma-senha-forte
SENHA_JULIA=outra-senha-forte
```

- Os dados ficam separados por usuário. Uma pessoa não vê os registros da outra.
- Para tirar o acesso de alguém, apague a variável `SENHA_<NOME>`. Os tokens dessa pessoa deixam de valer na hora, e os dados dela continuam guardados.
- Depois de criar ou mudar uma variável, faça um novo deploy (**Deploys → Trigger deploy**) para as funções lerem o valor novo.

## 2. Deploy automático pelo GitHub

1. No Netlify: **Add new project → Import an existing project → GitHub** e escolha o seu repositório.
2. As configurações já vêm do `netlify.toml`:
   - Build command: `npm run build`
   - Publish directory: `dist`
   - Functions: `netlify/functions`; Edge Functions: `netlify/edge-functions`
   - Node 22
3. Escolha o branch de produção (`main`).
4. Cadastre as variáveis do passo 1 e faça o primeiro deploy.

A partir daí, cada `git push` no branch de produção gera um deploy novo. O Netlify Blobs não precisa de configuração e já vem ativo no site.

## 3. Usar no celular

- Abra o endereço do site e entre com seu usuário e senha. O login vale por 90 dias.
- **iPhone:** no Safari, Compartilhar → Adicionar à Tela de Início.
- **Android:** no Chrome, menu ⋮ → Instalar app.
- **Offline:** depois do primeiro acesso, todas as páginas ficam guardadas no aparelho. O que você registrar sem internet é salvo no aparelho e sobe sozinho quando a conexão voltar. O status aparece no menu (Mais → rodapé) ou na barra lateral no computador.

## 4. Backup

O botão **Exportar (.zip)** baixa todos os seus registros como `.md`, no formato dos `_modelo-*.md`:

- `04-sessoes/`, `05-caderno-de-erros/`, `06-redacao/` e `07-simulados/`
- `02-cronograma/cronograma.md` com as tarefas feitas marcadas como `[x]`
- `03-lei-seca/_marcacoes/<norma>.json`, com estados, grifos, anotações e quedas em prova (o texto da lei não é alterado)

## 5. Rodar localmente (opcional)

```bash
npm install
npm run dev            # só as páginas, sem login nem dados
npx netlify-cli serve  # site completo, com functions, edge e Blobs locais
```

Para o `netlify serve`, crie um arquivo `.env`, que fica fora do git:

```
AUTH_SECRET=qualquer-coisa-com-mais-de-16-caracteres
SENHA_TESTE=teste
```

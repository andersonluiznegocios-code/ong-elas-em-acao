# App Ações Sociais — Guia de instalação

App completo para a ONG: venda de camisetas com Pix, ações sociais, apadrinhamento, presentes, doações, voluntários, notificações, transparência e painel administrativo. Funciona no celular (pode ser instalado na tela inicial) e no computador.

**Custo: R$ 0** — Supabase (plano gratuito) + GitHub Pages (gratuito).

---

## Arquivos

| Arquivo | Para que serve |
|---|---|
| `schema.sql` | Cria o banco de dados, as permissões e a segurança. Roda **uma vez** no Supabase. |
| `config.js` | Onde você cola a URL e a chave do seu Supabase. |
| `index.html`, `app.js`, `admin.js` | O aplicativo. |
| `manifest.json`, `sw.js`, `icon-*.png` | Permitem instalar o app no celular. |

---

## Passo 1 — Criar o banco (Supabase)

1. Acesse **supabase.com** → *Start your project* → entre com o GitHub ou e-mail.
2. *New project*: nome `ong-elas-em-acao`, crie uma senha forte para o banco, região **South America (São Paulo)**.
3. Espere o projeto ficar pronto (~2 min).
4. Menu lateral → **SQL Editor** → *New query* → cole **todo** o conteúdo de `schema.sql` → **Run**.
   Deve aparecer *Success. No rows returned*.

## Passo 2 — Configurar login e e-mails

Em **Authentication → URL Configuration**:
- **Site URL**: o endereço onde o app vai ficar (ex.: `https://seuusuario.github.io/ong-app/`)
- **Redirect URLs**: adicione o mesmo endereço.

Em **Authentication → Sign In / Providers → Email**:
- Deixe *Confirm email* **ligado** (mais seguro) ou desligue se quiser que o voluntário entre direto após o cadastro.

**Importante — e-mails de recuperação de senha:** o e-mail gratuito do Supabase envia poucas mensagens por hora. Para uso real, configure um SMTP em **Authentication → Emails → SMTP Settings** (ex.: Brevo ou Resend, ambos têm plano grátis).

Opcional: em **Authentication → Emails → Templates**, traduza os e-mails para português.

## Passo 3 — Ligar o app ao banco

1. Supabase → **Project Settings → API** (ou *Data API*).
2. Copie a **Project URL** e a chave **anon / public**.
3. Abra `config.js` e cole nos lugares indicados.

> A chave *anon* pode ficar no app — a segurança é feita pelo banco (RLS). **Nunca** coloque a chave *service_role* no app.

## Passo 4 — Publicar (GitHub Pages)

1. github.com → *New repository* → nome `ong-app` → **Public** → Create.
2. *Add file → Upload files* → envie **todos** os arquivos desta pasta (menos `schema.sql` e este LEIA-ME, se preferir) → *Commit*.
3. *Settings → Pages* → Source: **Deploy from a branch** → Branch `main` / `root` → Save.
4. Em 1–2 minutos o app estará em `https://seuusuario.github.io/ong-app/`.

(Alternativa: arrastar a pasta em **app.netlify.com/drop**.)

## Passo 5 — Primeiro acesso

1. Abra o app e clique em **Criar minha conta**.
2. **A primeira pessoa a se cadastrar vira Administradora automaticamente.** Todos os seguintes entram como Voluntário.
3. Entre no ⚙️ **Painel → Configurações** e preencha:
   - Nome do grupo
   - **Chave Pix**, nome e cidade de quem recebe (a pessoa da confecção)
   - Valor (R$ 35,00) e tamanhos
4. Use **Testar Pix (R$ 0,01)** e pague pelo celular para conferir se cai na conta certa.
5. Em **Voluntários**, promova outras pessoas para *Responsável* ou *Administrador*.

## Instalar no celular

- **Android (Chrome):** abra o link → menu ⋮ → *Adicionar à tela inicial* / *Instalar app*.
- **iPhone (Safari):** abra o link → botão compartilhar → *Adicionar à Tela de Início*.

---

## Permissões

| | Voluntário | Responsável | Administrador |
|---|:-:|:-:|:-:|
| Comprar camiseta, apadrinhar, participar, doar | ✅ | ✅ | ✅ |
| Ver ações ocultas (antes do lançamento) | – | ✅ | ✅ |
| Conferir comprovantes, marcar pago/entregue | – | ✅ | ✅ |
| Criar/editar ações, apadrinhamento, presentes, doações | – | ✅ | ✅ |
| Ver lista de voluntários e histórico | – | ✅ | ✅ |
| Enviar avisos | – | ✅ | ✅ |
| Mudar permissões, excluir usuários/ações/pedidos | – | – | ✅ |
| Configurações (Pix, valor), registro de alterações, backup | – | – | ✅ |

## Segurança e LGPD (já incluídos)

- Senhas criptografadas pelo Supabase (nunca ficam visíveis).
- Cada voluntário só vê os próprios dados; a equipe vê o necessário.
- Comprovantes em armazenamento **privado** (links temporários de 10 min).
- Preço calculado no servidor — ninguém altera o valor pelo celular.
- Apadrinhamento à prova de clique simultâneo: se duas pessoas escolherem a mesma criança ao mesmo tempo, só uma consegue (testado).
- Registro de todas as alterações (quem, quando, o quê).
- Aceite da política de privacidade no cadastro; voluntário pode **baixar** e **excluir** seus dados no Perfil.
- Orientação no app para cadastrar crianças só com primeiro nome + inicial e publicar fotos apenas com autorização.

## Backup

O plano gratuito do Supabase **não faz backup automático**. Use ⚙️ Painel → **Backup** toda semana e guarde o arquivo em local seguro (contém dados pessoais).

## Notificações

As notificações aparecem no sino 🔔 dentro do app (cadastro, apadrinhamento, pagamento aprovado/recusado, entrega, lançamento e mudança de ações, avisos da equipe). Na tela inicial o voluntário vê os prazos dos próximos 7 dias. Para quem não abre o app, o painel tem botões de WhatsApp (lembrete individual e lista para o grupo).

## Problemas comuns

- **"Falta configurar"** → `config.js` não foi preenchido.
- **Não chega e-mail de confirmação/recuperação** → veja o spam; configure SMTP (Passo 2).
- **Link do e-mail abre página errada** → confira *Site URL* e *Redirect URLs*.
- **QR Code não aparece** → falta a chave Pix nas Configurações.
- **Promover alguém a admin pelo banco** (emergência): SQL Editor →
  `update profiles set role='admin', ativo=true where email='pessoa@email.com';`

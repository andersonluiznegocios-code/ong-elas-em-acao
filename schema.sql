-- =====================================================================
--  APP AÇÕES SOCIAIS — Banco de dados (Supabase / PostgreSQL)
--  Como usar: Supabase > SQL Editor > New query > cole TUDO > Run
--  Rode apenas UMA vez em um projeto novo.
-- =====================================================================

create extension if not exists pgcrypto;

-- =====================================================================
-- 1. TABELAS
-- =====================================================================

-- Perfis (1 por usuário do Auth)
create table public.profiles (
  id             uuid primary key references auth.users(id) on delete cascade,
  nome           text not null default '',
  telefone       text not null default '',
  email          text,
  role           text not null default 'voluntario'
                 check (role in ('admin','responsavel','voluntario')),
  ativo          boolean not null default true,
  aceite_lgpd_em timestamptz,
  created_at     timestamptz not null default now()
);

-- Configurações gerais (linha única)
create table public.config (
  id              int primary key default 1 check (id = 1),
  nome_grupo      text not null default 'Nosso Grupo Solidário',
  pix_tipo        text not null default 'aleatoria'
                  check (pix_tipo in ('cpf','cnpj','telefone','email','aleatoria')),
  pix_chave       text not null default '',
  pix_nome        text not null default '',
  pix_cidade      text not null default 'SAO PAULO',
  valor_camiseta  numeric(10,2) not null default 35.00,
  tamanhos        text[] not null default '{PP,P,M,G,GG,XG}',
  loja_aberta     boolean not null default true,
  instrucoes_camiseta text default 'Após pagar, envie o comprovante aqui no app. A confirmação aparece em até 48h.',
  whatsapp_contato text default '',
  updated_at      timestamptz not null default now()
);
insert into public.config (id) values (1);

-- Pedidos de camiseta
create table public.pedidos_camiseta (
  id               uuid primary key default gen_random_uuid(),
  codigo           text not null unique
                   default upper(substr(replace(gen_random_uuid()::text,'-',''),1,8)),
  user_id          uuid references public.profiles(id) on delete set null,
  nome             text not null,
  telefone         text not null,
  tamanho          text not null,
  quantidade       int  not null default 1,
  valor_unitario   numeric(10,2),
  valor_total      numeric(10,2),
  status           text not null default 'pendente'
                   check (status in ('pendente','em_analise','aprovado','recusado')),
  comprovante_path text,
  enviado_em       timestamptz,
  motivo_recusa    text,
  pago_manual      boolean not null default false,
  aprovado_por     uuid references public.profiles(id) on delete set null,
  aprovado_em      timestamptz,
  entregue         boolean not null default false,
  entregue_em      timestamptz,
  observacao       text,
  created_at       timestamptz not null default now()
);
create index on public.pedidos_camiseta(user_id);
create index on public.pedidos_camiseta(status);

-- Ações sociais / campanhas
create table public.acoes (
  id                          uuid primary key default gen_random_uuid(),
  titulo                      text not null,
  descricao                   text,
  local                       text,
  data_inicio                 timestamptz,
  data_fim                    timestamptz,
  prazo                       date,
  itens_necessarios           text,
  beneficiados                int not null default 0,
  como_participar             text,
  ponto_encontro              text,
  tarefas                     text,
  vagas                       int,
  capa_path                   text,
  status                      text not null default 'futura'
                              check (status in ('futura','andamento','realizada')),
  visivel                     boolean not null default false,
  tem_apadrinhamento          boolean not null default false,
  apadrinhamento_aberto       boolean not null default false,
  max_por_padrinho            int default 1,
  orientacoes_apadrinhamento  text,
  campos_afilhado             text[] not null default '{idade,tamanho_roupa,tamanho_calcado}',
  campos_extras               text[] not null default '{}',
  resultado                   text,
  created_by                  uuid default auth.uid(),
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);

create table public.acao_fotos (
  id         uuid primary key default gen_random_uuid(),
  acao_id    uuid not null references public.acoes(id) on delete cascade,
  path       text not null,
  legenda    text,
  created_at timestamptz not null default now()
);
create index on public.acao_fotos(acao_id);

-- Pessoas que podem ser apadrinhadas
create table public.afilhados (
  id                uuid primary key default gen_random_uuid(),
  acao_id           uuid not null references public.acoes(id) on delete cascade,
  identificacao     text not null,
  idade             int,
  tamanho_roupa     text,
  tamanho_calcado   text,
  observacoes       text,
  extras            jsonb not null default '{}',
  status            text not null default 'disponivel'
                    check (status in ('disponivel','reservado','apadrinhado','recebido','entregue')),
  padrinho_id       uuid references public.profiles(id) on delete set null,
  reservado_em      timestamptz,
  presente_comprado boolean not null default false,
  comprado_em       timestamptz,
  recebido_em       timestamptz,
  kit_conferido     boolean not null default false,
  entregue_em       timestamptz,
  created_at        timestamptz not null default now()
);
create index on public.afilhados(acao_id);
create index on public.afilhados(padrinho_id);

-- Inscrição de voluntários nas ações
create table public.inscricoes (
  id         uuid primary key default gen_random_uuid(),
  acao_id    uuid not null references public.acoes(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  status     text not null default 'confirmado'
             check (status in ('confirmado','presente','faltou')),
  tarefa     text,
  created_at timestamptz not null default now(),
  unique (acao_id, user_id)
);

-- Doações
create table public.doacoes (
  id          uuid primary key default gen_random_uuid(),
  acao_id     uuid not null references public.acoes(id) on delete cascade,
  user_id     uuid references public.profiles(id) on delete set null,
  doador_nome text,
  item        text not null,
  quantidade  numeric(10,2) not null default 1,
  status      text not null default 'prometido' check (status in ('prometido','recebido')),
  observacao  text,
  recebido_em timestamptz,
  created_at  timestamptz not null default now()
);
create index on public.doacoes(acao_id);

-- Notificações dentro do app
create table public.notificacoes (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  titulo     text not null,
  mensagem   text,
  link       text,
  lida       boolean not null default false,
  created_at timestamptz not null default now()
);
create index on public.notificacoes(user_id, lida);

-- Registro de alterações (auditoria)
create table public.audit_log (
  id          bigint generated always as identity primary key,
  user_id     uuid,
  user_nome   text,
  tabela      text,
  operacao    text,
  registro_id text,
  antes       jsonb,
  depois      jsonb,
  created_at  timestamptz not null default now()
);

-- =====================================================================
-- 2. FUNÇÕES AUXILIARES DE PERMISSÃO
-- =====================================================================
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin' and ativo);
$$;

create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid()
                 and role in ('admin','responsavel') and ativo);
$$;

-- Notifica todos os voluntários envolvidos numa ação (uso interno)
create or replace function public._notificar_acao(p_acao uuid, p_titulo text, p_msg text)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into notificacoes (user_id, titulo, mensagem, link)
  select distinct u, p_titulo, p_msg, '#/acao/' || p_acao
  from (
    select user_id as u from inscricoes where acao_id = p_acao
    union
    select padrinho_id from afilhados where acao_id = p_acao and padrinho_id is not null
  ) x where u is not null;
end $$;
revoke execute on function public._notificar_acao(uuid,text,text) from public, anon, authenticated;

-- =====================================================================
-- 3. TRIGGERS
-- =====================================================================

-- Cria o perfil quando alguém se cadastra. O PRIMEIRO cadastro vira admin.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_role text := 'voluntario';
begin
  if not exists (select 1 from profiles where role = 'admin') then
    v_role := 'admin';
  end if;
  insert into profiles (id, nome, telefone, email, role, aceite_lgpd_em)
  values (new.id,
          coalesce(new.raw_user_meta_data->>'nome', ''),
          coalesce(new.raw_user_meta_data->>'telefone', ''),
          new.email, v_role,
          case when new.raw_user_meta_data->>'aceite_lgpd' = 'true' then now() end);
  insert into notificacoes (user_id, titulo, mensagem, link)
  values (new.id, 'Cadastro confirmado 🩷',
          'Seja bem-vindo(a)! Agora você já pode comprar sua camiseta, participar das ações e apadrinhar.',
          '#/inicio');
  return new;
end $$;

create trigger on_auth_user_created
after insert on auth.users for each row execute function public.handle_new_user();

-- Impede que usuário comum mude o próprio papel; protege o último admin
create or replace function public.profiles_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    new.role  := old.role;
    new.ativo := old.ativo;
    new.email := old.email;
  end if;
  if old.role = 'admin' and (new.role <> 'admin' or not new.ativo)
     and (select count(*) from profiles where role = 'admin' and ativo and id <> old.id) = 0 then
    raise exception 'É preciso manter pelo menos um administrador ativo.';
  end if;
  return new;
end $$;
create trigger profiles_guard before update on public.profiles
for each row execute function public.profiles_guard();

-- Pedidos: valor calculado no servidor (ninguém altera preço pelo celular)
create or replace function public.pedidos_before() returns trigger
language plpgsql security definer set search_path = public as $$
declare c config;
begin
  select * into c from config where id = 1;
  if tg_op = 'INSERT' and not public.is_staff() then
    if not c.loja_aberta then
      raise exception 'As vendas de camisetas estão encerradas no momento.';
    end if;
    new.user_id := auth.uid();
    new.status := 'pendente';
    new.pago_manual := false;
    new.entregue := false;
    new.comprovante_path := null;
    new.valor_unitario := c.valor_camiseta;
  end if;
  if new.quantidade is null or new.quantidade < 1 or new.quantidade > 20 then
    raise exception 'Quantidade inválida.';
  end if;
  if tg_op = 'INSERT' and not (new.tamanho = any (c.tamanhos)) then
    raise exception 'Tamanho inválido.';
  end if;
  new.valor_unitario := coalesce(new.valor_unitario, c.valor_camiseta);
  new.valor_total := new.valor_unitario * new.quantidade;
  return new;
end $$;
create trigger pedidos_before before insert or update on public.pedidos_camiseta
for each row execute function public.pedidos_before();

-- Pedidos: avisa o voluntário quando o pagamento é aprovado/recusado
create or replace function public.pedidos_after() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.user_id is not null and new.status is distinct from old.status then
    if new.status = 'aprovado' then
      insert into notificacoes (user_id, titulo, mensagem, link)
      values (new.user_id, 'Pagamento confirmado ✅',
              'Seu pagamento da camiseta (pedido ' || new.codigo || ') foi aprovado. Obrigado!', '#/camisetas');
    elsif new.status = 'recusado' then
      insert into notificacoes (user_id, titulo, mensagem, link)
      values (new.user_id, 'Comprovante recusado',
              'O comprovante do pedido ' || new.codigo || ' foi recusado. Motivo: '
              || coalesce(new.motivo_recusa, 'não informado') || '. Envie novamente.', '#/camisetas');
    end if;
  end if;
  if new.user_id is not null and new.entregue and not old.entregue then
    insert into notificacoes (user_id, titulo, mensagem, link)
    values (new.user_id, 'Camiseta entregue 👕', 'Registramos a entrega da sua camiseta (pedido ' || new.codigo || ').', '#/camisetas');
  end if;
  return new;
end $$;
create trigger pedidos_after after update on public.pedidos_camiseta
for each row execute function public.pedidos_after();

-- Ações: avisos de lançamento e de mudança de data/local
create or replace function public.acoes_after() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.updated_at := now();
  if tg_op = 'UPDATE' then
    if new.visivel and not old.visivel then
      insert into notificacoes (user_id, titulo, mensagem, link)
      select id, 'Nova ação: ' || new.titulo, 'Uma nova ação foi lançada. Veja como participar!', '#/acao/' || new.id
      from profiles where ativo;
    elsif new.visivel and (new.data_inicio is distinct from old.data_inicio
                        or new.data_fim   is distinct from old.data_fim
                        or new.local      is distinct from old.local
                        or new.prazo      is distinct from old.prazo
                        or new.ponto_encontro is distinct from old.ponto_encontro) then
      perform public._notificar_acao(new.id, 'Alteração na ação: ' || new.titulo,
        'Data, horário, local ou prazo foram atualizados. Confira os detalhes.');
    end if;
  end if;
  return new;
end $$;
create trigger acoes_before before update on public.acoes
for each row execute function public.acoes_after();

-- Auditoria genérica
create or replace function public.audit_trigger() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_old jsonb; v_new jsonb;
begin
  if tg_op <> 'INSERT' then v_old := to_jsonb(old); end if;
  if tg_op <> 'DELETE' then v_new := to_jsonb(new); end if;
  insert into audit_log (user_id, user_nome, tabela, operacao, registro_id, antes, depois)
  values (auth.uid(), (select nome from profiles where id = auth.uid()),
          tg_table_name, tg_op, coalesce(v_new->>'id', v_old->>'id'), v_old, v_new);
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;

create trigger audit after update or delete on public.profiles         for each row execute function public.audit_trigger();
create trigger audit after update               on public.config           for each row execute function public.audit_trigger();
create trigger audit after insert or update or delete on public.pedidos_camiseta for each row execute function public.audit_trigger();
create trigger audit after insert or update or delete on public.acoes       for each row execute function public.audit_trigger();
create trigger audit after insert or update or delete on public.afilhados   for each row execute function public.audit_trigger();
create trigger audit after update or delete on public.inscricoes       for each row execute function public.audit_trigger();
create trigger audit after update or delete on public.doacoes          for each row execute function public.audit_trigger();

-- =====================================================================
-- 4. FUNÇÕES CHAMADAS PELO APP (RPC)
-- =====================================================================

-- APADRINHAR — atômico: duas pessoas nunca pegam o mesmo afilhado
create or replace function public.apadrinhar(p_afilhado uuid) returns public.afilhados
language plpgsql security definer set search_path = public as $$
declare v afilhados; a acoes; v_qtd int;
begin
  if auth.uid() is null then raise exception 'Faça login para apadrinhar.'; end if;
  select ac.* into a from acoes ac join afilhados af on af.acao_id = ac.id where af.id = p_afilhado;
  if a.id is null then raise exception 'Registro não encontrado.'; end if;
  if not a.visivel or not a.tem_apadrinhamento or not a.apadrinhamento_aberto then
    raise exception 'O apadrinhamento desta campanha não está aberto.';
  end if;
  -- evita que a mesma pessoa passe do limite clicando várias vezes
  perform pg_advisory_xact_lock(hashtext(auth.uid()::text || a.id::text));
  select count(*) into v_qtd from afilhados where acao_id = a.id and padrinho_id = auth.uid();
  if a.max_por_padrinho is not null and v_qtd >= a.max_por_padrinho then
    raise exception 'Você já atingiu o limite de % apadrinhamento(s) nesta campanha.', a.max_por_padrinho;
  end if;
  update afilhados
     set status = 'reservado', padrinho_id = auth.uid(), reservado_em = now()
   where id = p_afilhado and status = 'disponivel' and padrinho_id is null
  returning * into v;
  if v.id is null then
    raise exception 'Essa pessoa acabou de ser escolhida por outro padrinho. Escolha outra, por favor.';
  end if;
  insert into notificacoes (user_id, titulo, mensagem, link)
  values (auth.uid(), 'Apadrinhamento confirmado 🎁',
          'Você apadrinhou ' || v.identificacao || ' na campanha "' || a.titulo || '". Veja as orientações.',
          '#/acao/' || a.id);
  return v;
end $$;

-- Padrinho informa que já comprou o presente
create or replace function public.confirmar_compra(p_afilhado uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update afilhados set presente_comprado = true, comprado_em = now(), status = 'apadrinhado'
   where id = p_afilhado and padrinho_id = auth.uid() and status in ('reservado','apadrinhado');
  if not found then raise exception 'Não foi possível atualizar.'; end if;
end $$;

-- Padrinho desiste (só antes de entregar o presente à equipe)
create or replace function public.desistir_apadrinhamento(p_afilhado uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update afilhados set status = 'disponivel', padrinho_id = null, reservado_em = null,
                       presente_comprado = false, comprado_em = null
   where id = p_afilhado and padrinho_id = auth.uid() and status in ('reservado','apadrinhado');
  if not found then raise exception 'Não é mais possível desistir. Fale com a organização.'; end if;
end $$;

-- Voluntário envia comprovante de pagamento
create or replace function public.enviar_comprovante(p_pedido uuid, p_path text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_path is null or split_part(p_path, '/', 1) <> auth.uid()::text then
    raise exception 'Arquivo inválido.';
  end if;
  update pedidos_camiseta
     set comprovante_path = p_path, status = 'em_analise', enviado_em = now(), motivo_recusa = null
   where id = p_pedido and user_id = auth.uid() and status in ('pendente','recusado');
  if not found then raise exception 'Este pedido não aceita novo comprovante.'; end if;
end $$;

-- Inscrição em ação (respeita limite de vagas)
create or replace function public.inscrever_acao(p_acao uuid) returns void
language plpgsql security definer set search_path = public as $$
declare a acoes; v_total int;
begin
  if auth.uid() is null then raise exception 'Faça login.'; end if;
  select * into a from acoes where id = p_acao for update;
  if a.id is null or not a.visivel then raise exception 'Ação não encontrada.'; end if;
  if a.status = 'realizada' then raise exception 'Esta ação já foi realizada.'; end if;
  if a.prazo is not null and a.prazo < current_date then raise exception 'O prazo de inscrição terminou.'; end if;
  if exists (select 1 from inscricoes where acao_id = p_acao and user_id = auth.uid()) then
    raise exception 'Você já está inscrito(a) nesta ação.';
  end if;
  select count(*) into v_total from inscricoes where acao_id = p_acao;
  if a.vagas is not null and v_total >= a.vagas then raise exception 'As vagas para esta ação estão esgotadas.'; end if;
  insert into inscricoes (acao_id, user_id) values (p_acao, auth.uid());
  insert into notificacoes (user_id, titulo, mensagem, link)
  values (auth.uid(), 'Presença confirmada 🤝', 'Você está inscrito(a) em "' || a.titulo || '".', '#/acao/' || a.id);
end $$;

create or replace function public.cancelar_inscricao(p_acao uuid) returns void
language sql security definer set search_path = public as $$
  delete from inscricoes where acao_id = p_acao and user_id = auth.uid();
$$;

-- Números de uma ação (usado também na página pública)
create or replace function public.acao_resumo(p_acao uuid) returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
    'inscritos',      (select count(*) from inscricoes where acao_id = p_acao),
    'afilhados',      (select count(*) from afilhados  where acao_id = p_acao),
    'disponiveis',    (select count(*) from afilhados  where acao_id = p_acao and status = 'disponivel'),
    'entregues',      (select count(*) from afilhados  where acao_id = p_acao and status = 'entregue'),
    'doacoes_recebidas', (select coalesce(sum(quantidade),0) from doacoes where acao_id = p_acao and status = 'recebido')
  )
  where exists (select 1 from acoes where id = p_acao and (visivel or public.is_staff()));
$$;

-- Transparência: resultados de todas as ações visíveis
create or replace function public.estatisticas_publicas() returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
    'acoes_realizadas', (select count(*) from acoes where visivel and status = 'realizada'),
    'beneficiados',     (select coalesce(sum(beneficiados),0) from acoes where visivel),
    'voluntarios',      (select count(distinct i.user_id) from inscricoes i join acoes a on a.id = i.acao_id where a.visivel),
    'presentes',        (select count(*) from afilhados f join acoes a on a.id = f.acao_id where a.visivel and f.status in ('recebido','entregue')),
    'doacoes',          (select coalesce(sum(d.quantidade),0) from doacoes d join acoes a on a.id = d.acao_id where a.visivel and d.status = 'recebido'),
    'lista', coalesce((
      select json_agg(x order by x.data_inicio desc nulls last) from (
        select a.id, a.titulo, a.status, a.data_inicio, a.local, a.beneficiados, a.resultado, a.capa_path,
          (select count(*) from inscricoes i where i.acao_id = a.id) as voluntarios,
          (select count(*) from afilhados f where f.acao_id = a.id and f.status in ('recebido','entregue')) as presentes,
          (select coalesce(sum(d.quantidade),0) from doacoes d where d.acao_id = a.id and d.status = 'recebido') as doacoes
        from acoes a where a.visivel
      ) x), '[]'::json)
  );
$$;

-- Aviso para todos (ou para os participantes de uma ação)
create or replace function public.notificar(p_titulo text, p_mensagem text, p_acao uuid default null)
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if not public.is_staff() then raise exception 'Sem permissão.'; end if;
  if p_acao is null then
    insert into notificacoes (user_id, titulo, mensagem, link)
    select id, p_titulo, p_mensagem, '#/notificacoes' from profiles where ativo;
  else
    perform public._notificar_acao(p_acao, p_titulo, p_mensagem);
  end if;
  get diagnostics n = row_count;
  return n;
end $$;

-- LGPD: exportar os próprios dados
create or replace function public.meus_dados() returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
    'perfil',     (select row_to_json(p) from profiles p where id = auth.uid()),
    'pedidos',    coalesce((select json_agg(x) from pedidos_camiseta x where user_id = auth.uid()), '[]'),
    'inscricoes', coalesce((select json_agg(x) from inscricoes x where user_id = auth.uid()), '[]'),
    'apadrinhamentos', coalesce((select json_agg(x) from afilhados x where padrinho_id = auth.uid()), '[]'),
    'doacoes',    coalesce((select json_agg(x) from doacoes x where user_id = auth.uid()), '[]')
  );
$$;

-- LGPD: excluir a própria conta (anonimiza pedidos, libera apadrinhados não comprados)
create or replace function public.excluir_minha_conta() returns void
language plpgsql security definer set search_path = public, auth as $$
declare v uuid := auth.uid();
begin
  if v is null then raise exception 'Faça login.'; end if;
  if public.is_admin() and (select count(*) from profiles where role='admin' and ativo and id <> v) = 0 then
    raise exception 'Você é o único administrador. Promova outra pessoa antes de excluir sua conta.';
  end if;
  update afilhados set status = 'disponivel', padrinho_id = null, reservado_em = null,
                       presente_comprado = false, comprado_em = null
   where padrinho_id = v and status = 'reservado';
  update pedidos_camiseta set nome = 'Usuário removido', telefone = '' where user_id = v;
  delete from auth.users where id = v;
end $$;

-- Admin exclui um usuário
create or replace function public.admin_excluir_usuario(p_user uuid) returns void
language plpgsql security definer set search_path = public, auth as $$
begin
  if not public.is_admin() then raise exception 'Sem permissão.'; end if;
  if p_user = auth.uid() then raise exception 'Use a opção "Excluir minha conta" no seu perfil.'; end if;
  update afilhados set status = 'disponivel', padrinho_id = null, reservado_em = null,
                       presente_comprado = false, comprado_em = null
   where padrinho_id = p_user and status = 'reservado';
  update pedidos_camiseta set nome = 'Usuário removido', telefone = '' where user_id = p_user;
  delete from auth.users where id = p_user;
end $$;

-- =====================================================================
-- 5. SEGURANÇA — ROW LEVEL SECURITY
-- =====================================================================
alter table public.profiles         enable row level security;
alter table public.config           enable row level security;
alter table public.pedidos_camiseta enable row level security;
alter table public.acoes            enable row level security;
alter table public.acao_fotos       enable row level security;
alter table public.afilhados        enable row level security;
alter table public.inscricoes       enable row level security;
alter table public.doacoes          enable row level security;
alter table public.notificacoes     enable row level security;
alter table public.audit_log        enable row level security;

-- profiles
create policy profiles_sel on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_staff());
create policy profiles_upd on public.profiles for update to authenticated
  using (id = auth.uid() or public.is_admin()) with check (id = auth.uid() or public.is_admin());

-- config
create policy config_sel on public.config for select to anon, authenticated using (true);
create policy config_upd on public.config for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- pedidos
create policy ped_sel on public.pedidos_camiseta for select to authenticated
  using (user_id = auth.uid() or public.is_staff());
create policy ped_ins on public.pedidos_camiseta for insert to authenticated
  with check (user_id = auth.uid() or public.is_staff());
create policy ped_upd on public.pedidos_camiseta for update to authenticated
  using (public.is_staff()) with check (public.is_staff());
create policy ped_del on public.pedidos_camiseta for delete to authenticated
  using (public.is_admin() or (user_id = auth.uid() and status = 'pendente' and comprovante_path is null));

-- ações (visíveis podem ser vistas até sem login, para compartilhar)
create policy acoes_sel on public.acoes for select to anon, authenticated
  using (visivel or public.is_staff());
create policy acoes_ins on public.acoes for insert to authenticated with check (public.is_staff());
create policy acoes_upd on public.acoes for update to authenticated
  using (public.is_staff()) with check (public.is_staff());
create policy acoes_del on public.acoes for delete to authenticated using (public.is_admin());

-- fotos
create policy fotos_sel on public.acao_fotos for select to anon, authenticated
  using (public.is_staff() or exists (select 1 from acoes a where a.id = acao_id and a.visivel));
create policy fotos_all on public.acao_fotos for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

-- afilhados (somente logados veem; alterações de voluntário só via RPC)
create policy afi_sel on public.afilhados for select to authenticated
  using (public.is_staff() or exists (select 1 from acoes a where a.id = acao_id and a.visivel));
create policy afi_all on public.afilhados for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

-- inscrições
create policy ins_sel on public.inscricoes for select to authenticated
  using (user_id = auth.uid() or public.is_staff());
create policy ins_staff on public.inscricoes for all to authenticated
  using (public.is_staff()) with check (public.is_staff());
create policy ins_del_own on public.inscricoes for delete to authenticated
  using (user_id = auth.uid());

-- doações
create policy doa_sel on public.doacoes for select to authenticated
  using (user_id = auth.uid() or public.is_staff());
create policy doa_ins on public.doacoes for insert to authenticated
  with check (public.is_staff() or (user_id = auth.uid() and status = 'prometido'));
create policy doa_staff on public.doacoes for update to authenticated
  using (public.is_staff()) with check (public.is_staff());
create policy doa_del on public.doacoes for delete to authenticated using (public.is_staff());

-- notificações
create policy not_sel on public.notificacoes for select to authenticated using (user_id = auth.uid());
create policy not_upd on public.notificacoes for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy not_del on public.notificacoes for delete to authenticated using (user_id = auth.uid());
create policy not_ins on public.notificacoes for insert to authenticated with check (public.is_staff());

-- auditoria
create policy audit_sel on public.audit_log for select to authenticated using (public.is_admin());

-- =====================================================================
-- 6. ARMAZENAMENTO DE ARQUIVOS
-- =====================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('comprovantes', 'comprovantes', false, 5242880,
        array['image/jpeg','image/png','image/webp','image/heic','application/pdf'])
on conflict (id) do nothing;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fotos', 'fotos', true, 8388608, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

-- Comprovantes: privados. Cada um envia na própria pasta; equipe vê todos.
create policy "comp_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'comprovantes' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "comp_select" on storage.objects for select to authenticated
  using (bucket_id = 'comprovantes' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_staff()));
create policy "comp_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'comprovantes' and public.is_admin());

-- Fotos das ações: públicas para leitura, só a equipe envia
create policy "fotos_read"   on storage.objects for select using (bucket_id = 'fotos');
create policy "fotos_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'fotos' and public.is_staff());
create policy "fotos_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'fotos' and public.is_staff());

-- =====================================================================
-- 7. TEMPO REAL (lista de apadrinhamento atualiza sozinha)
-- =====================================================================
do $$ begin
  alter publication supabase_realtime add table public.afilhados;
exception when others then null;
end $$;

-- FIM ✔

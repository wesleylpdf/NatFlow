-- ============================================================
-- NatFlow - Schema do Banco de Dados (Supabase / PostgreSQL)
-- Execute este arquivo inteiro no SQL Editor do Supabase.
--
-- ANTES DE EXECUTAR: troque o e-mail e o nome na seção
-- "PRIMEIRO ADMINISTRADOR" (procure por SEU-EMAIL).
--
-- Se você já executou uma versão anterior deste schema, rode antes:
--   DROP VIEW IF EXISTS public.clientes_saldo;
--   DROP TABLE IF EXISTS public.historico, public.pagamentos, public.compras,
--     public.clientes, public.autorizados CASCADE;
-- ============================================================

-- ============================================
-- TABELA: autorizados
-- E-mails com permissão de acessar o app.
-- papel 'admin' gerencia a equipe; 'membro' cadastra e edita dados.
-- ============================================
CREATE TABLE IF NOT EXISTS public.autorizados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  nome TEXT NOT NULL CHECK (char_length(btrim(nome)) > 0),
  papel TEXT NOT NULL DEFAULT 'membro' CHECK (papel IN ('admin', 'membro')),
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  chave_pix TEXT,
  beneficiario_pix TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  criado_por TEXT,
  atualizado_por TEXT,
  atualizado_em TIMESTAMPTZ
);

-- ============================================
-- FUNÇÕES DE ACESSO
-- ============================================

-- E-mail do usuário logado (minúsculo)
CREATE OR REPLACE FUNCTION public.email_atual()
RETURNS TEXT
LANGUAGE SQL
STABLE
AS $$
  SELECT lower(coalesce(auth.jwt() ->> 'email', ''));
$$;

-- Usuário logado está autorizado e ativo?
CREATE OR REPLACE FUNCTION public.tem_acesso()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.autorizados
    WHERE email = public.email_atual() AND ativo
  );
$$;

-- Usuário logado é administrador ativo?
CREATE OR REPLACE FUNCTION public.eh_admin()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.autorizados
    WHERE email = public.email_atual() AND ativo AND papel = 'admin'
  );
$$;

-- Normaliza o e-mail dos autorizados (minúsculo, sem espaços)
CREATE OR REPLACE FUNCTION public.normalizar_email_autorizado()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.email := lower(btrim(NEW.email));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_normalizar_email ON public.autorizados;
CREATE TRIGGER trg_normalizar_email
  BEFORE INSERT OR UPDATE ON public.autorizados
  FOR EACH ROW EXECUTE FUNCTION public.normalizar_email_autorizado();

-- ============================================
-- AUTORIA: quem criou / quem editou por último
-- Preenchido pelo banco (o app não consegue falsificar).
-- ============================================
CREATE OR REPLACE FUNCTION public.definir_autoria()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_email TEXT := coalesce(nullif(public.email_atual(), ''), 'sistema');
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.criado_por := v_email;
    NEW.created_at := NOW();
    NEW.atualizado_por := NULL;
    NEW.atualizado_em := NULL;
  ELSE
    NEW.criado_por := OLD.criado_por;
    NEW.created_at := OLD.created_at;
    NEW.atualizado_por := v_email;
    NEW.atualizado_em := NOW();
  END IF;
  RETURN NEW;
END;
$$;

-- ============================================
-- TABELA: clientes
-- ============================================
CREATE TABLE IF NOT EXISTS public.clientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL CHECK (char_length(btrim(nome)) > 0),
  telefone TEXT NOT NULL DEFAULT '',
  data_promessa DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  criado_por TEXT,
  atualizado_por TEXT,
  atualizado_em TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_clientes_nome ON public.clientes(nome);

-- ============================================
-- TABELA: compras (SAÍDAS - produtos comprados pelo cliente)
-- ============================================
CREATE TABLE IF NOT EXISTS public.compras (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  produto TEXT NOT NULL CHECK (char_length(btrim(produto)) > 0),
  valor NUMERIC(12, 2) NOT NULL CHECK (valor > 0),
  data DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  criado_por TEXT,
  atualizado_por TEXT,
  atualizado_em TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_compras_cliente_data ON public.compras(cliente_id, data DESC);

-- ============================================
-- TABELA: pagamentos (ENTRADAS - valores pagos pelo cliente)
-- ============================================
CREATE TABLE IF NOT EXISTS public.pagamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  valor NUMERIC(12, 2) NOT NULL CHECK (valor > 0),
  data DATE NOT NULL DEFAULT CURRENT_DATE,
  descricao TEXT,
  forma_pagamento TEXT DEFAULT 'pix',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  criado_por TEXT,
  atualizado_por TEXT,
  atualizado_em TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_pagamentos_cliente_data ON public.pagamentos(cliente_id, data DESC);
CREATE INDEX IF NOT EXISTS idx_pagamentos_data ON public.pagamentos(data DESC);
CREATE INDEX IF NOT EXISTS idx_pagamentos_forma ON public.pagamentos(forma_pagamento);
CREATE INDEX IF NOT EXISTS idx_compras_data ON public.compras(data DESC);

-- ============================================
-- TABELA: acertos (Cronograma de pagamentos combinados / parcelamentos)
-- ============================================
CREATE TABLE IF NOT EXISTS public.acertos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  data DATE NOT NULL,
  valor NUMERIC(12, 2) NOT NULL CHECK (valor > 0),
  descricao TEXT,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'pago', 'cancelado')),
  pago_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  criado_por TEXT,
  atualizado_por TEXT,
  atualizado_em TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_acertos_cliente_data ON public.acertos(cliente_id, data ASC);
CREATE INDEX IF NOT EXISTS idx_acertos_status ON public.acertos(status);

-- Triggers de autoria
DROP TRIGGER IF EXISTS trg_autoria ON public.autorizados;
CREATE TRIGGER trg_autoria BEFORE INSERT OR UPDATE ON public.autorizados
  FOR EACH ROW EXECUTE FUNCTION public.definir_autoria();

DROP TRIGGER IF EXISTS trg_autoria ON public.clientes;
CREATE TRIGGER trg_autoria BEFORE INSERT OR UPDATE ON public.clientes
  FOR EACH ROW EXECUTE FUNCTION public.definir_autoria();

DROP TRIGGER IF EXISTS trg_autoria ON public.compras;
CREATE TRIGGER trg_autoria BEFORE INSERT OR UPDATE ON public.compras
  FOR EACH ROW EXECUTE FUNCTION public.definir_autoria();

DROP TRIGGER IF EXISTS trg_autoria ON public.pagamentos;
CREATE TRIGGER trg_autoria BEFORE INSERT OR UPDATE ON public.pagamentos
  FOR EACH ROW EXECUTE FUNCTION public.definir_autoria();

DROP TRIGGER IF EXISTS trg_autoria ON public.acertos;
CREATE TRIGGER trg_autoria BEFORE INSERT OR UPDATE ON public.acertos
  FOR EACH ROW EXECUTE FUNCTION public.definir_autoria();

-- ============================================
-- TABELA: historico (registro imutável de todas as alterações)
-- ============================================
CREATE TABLE IF NOT EXISTS public.historico (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tabela TEXT NOT NULL,
  acao TEXT NOT NULL CHECK (acao IN ('criou', 'editou', 'excluiu')),
  registro_id UUID NOT NULL,
  cliente_id UUID,           -- sem FK: o histórico permanece após excluir o cliente
  cliente_nome TEXT,
  usuario_email TEXT NOT NULL,
  usuario_nome TEXT,
  dados_antes JSONB,
  dados_depois JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_historico_data ON public.historico(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_historico_cliente ON public.historico(cliente_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_historico_usuario ON public.historico(usuario_email, created_at DESC);

CREATE OR REPLACE FUNCTION public.registrar_historico()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email TEXT := coalesce(nullif(public.email_atual(), ''), 'sistema');
  v_nome TEXT;
  v_acao TEXT;
  v_antes JSONB;
  v_depois JSONB;
  v_reg JSONB;
  v_cliente UUID;
  v_cliente_nome TEXT;
  v_ignorar TEXT[] := ARRAY['atualizado_por', 'atualizado_em'];
BEGIN
  SELECT nome INTO v_nome FROM public.autorizados WHERE email = v_email;

  IF TG_OP = 'INSERT' THEN
    v_acao := 'criou';
    v_depois := to_jsonb(NEW);
    v_reg := v_depois;
  ELSIF TG_OP = 'UPDATE' THEN
    v_antes := to_jsonb(OLD);
    v_depois := to_jsonb(NEW);
    -- Não registra "edições" que não mudaram nada
    IF (v_antes - v_ignorar) = (v_depois - v_ignorar) THEN
      RETURN NEW;
    END IF;
    v_acao := 'editou';
    v_reg := v_depois;
  ELSE
    v_acao := 'excluiu';
    v_antes := to_jsonb(OLD);
    v_reg := v_antes;
  END IF;

  v_cliente := CASE
    WHEN TG_TABLE_NAME = 'clientes' THEN (v_reg ->> 'id')::UUID
    WHEN TG_TABLE_NAME IN ('compras', 'pagamentos') THEN (v_reg ->> 'cliente_id')::UUID
    ELSE NULL
  END;

  IF TG_TABLE_NAME = 'clientes' THEN
    v_cliente_nome := v_reg ->> 'nome';
  ELSIF TG_TABLE_NAME IN ('compras', 'pagamentos') AND v_cliente IS NOT NULL THEN
    SELECT nome INTO v_cliente_nome FROM public.clientes WHERE id = v_cliente;
  END IF;

  INSERT INTO public.historico
    (tabela, acao, registro_id, cliente_id, cliente_nome, usuario_email, usuario_nome, dados_antes, dados_depois)
  VALUES
    (TG_TABLE_NAME, v_acao, (v_reg ->> 'id')::UUID, v_cliente, v_cliente_nome, v_email, v_nome, v_antes, v_depois);

  RETURN coalesce(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_historico ON public.autorizados;
CREATE TRIGGER trg_historico AFTER INSERT OR UPDATE OR DELETE ON public.autorizados
  FOR EACH ROW EXECUTE FUNCTION public.registrar_historico();

DROP TRIGGER IF EXISTS trg_historico ON public.clientes;
CREATE TRIGGER trg_historico AFTER INSERT OR UPDATE OR DELETE ON public.clientes
  FOR EACH ROW EXECUTE FUNCTION public.registrar_historico();

DROP TRIGGER IF EXISTS trg_historico ON public.compras;
CREATE TRIGGER trg_historico AFTER INSERT OR UPDATE OR DELETE ON public.compras
  FOR EACH ROW EXECUTE FUNCTION public.registrar_historico();

DROP TRIGGER IF EXISTS trg_historico ON public.pagamentos;
CREATE TRIGGER trg_historico AFTER INSERT OR UPDATE OR DELETE ON public.pagamentos
  FOR EACH ROW EXECUTE FUNCTION public.registrar_historico();

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- Todos os usuários autorizados compartilham os mesmos dados.
-- ============================================
ALTER TABLE public.autorizados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pagamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.historico ENABLE ROW LEVEL SECURITY;

-- autorizados: todos da equipe veem; só admin altera; ninguém altera/remove a si mesmo
DROP POLICY IF EXISTS "autorizados_select" ON public.autorizados;
CREATE POLICY "autorizados_select" ON public.autorizados
  FOR SELECT TO authenticated USING (public.tem_acesso());

DROP POLICY IF EXISTS "autorizados_insert" ON public.autorizados;
CREATE POLICY "autorizados_insert" ON public.autorizados
  FOR INSERT TO authenticated WITH CHECK (public.eh_admin());

DROP POLICY IF EXISTS "autorizados_update" ON public.autorizados;
CREATE POLICY "autorizados_update" ON public.autorizados
  FOR UPDATE TO authenticated
  USING (public.eh_admin() AND email <> public.email_atual())
  WITH CHECK (public.eh_admin() AND email <> public.email_atual());

-- Cada membro pode atualizar seus próprios dados (nome, chave_pix)
DROP POLICY IF EXISTS "autorizados_update_proprio" ON public.autorizados;
CREATE POLICY "autorizados_update_proprio" ON public.autorizados
  FOR UPDATE TO authenticated
  USING (email = public.email_atual())
  WITH CHECK (email = public.email_atual());


DROP POLICY IF EXISTS "autorizados_delete" ON public.autorizados;
CREATE POLICY "autorizados_delete" ON public.autorizados
  FOR DELETE TO authenticated
  USING (public.eh_admin() AND email <> public.email_atual());

-- dados do negócio: qualquer usuário autorizado e ativo
DROP POLICY IF EXISTS "clientes_equipe" ON public.clientes;
CREATE POLICY "clientes_equipe" ON public.clientes
  FOR ALL TO authenticated USING (public.tem_acesso()) WITH CHECK (public.tem_acesso());

DROP POLICY IF EXISTS "compras_equipe" ON public.compras;
CREATE POLICY "compras_equipe" ON public.compras
  FOR ALL TO authenticated USING (public.tem_acesso()) WITH CHECK (public.tem_acesso());

DROP POLICY IF EXISTS "pagamentos_equipe" ON public.pagamentos;
CREATE POLICY "pagamentos_equipe" ON public.pagamentos
  FOR ALL TO authenticated USING (public.tem_acesso()) WITH CHECK (public.tem_acesso());

DROP POLICY IF EXISTS "acertos_equipe" ON public.acertos;
CREATE POLICY "acertos_equipe" ON public.acertos
  FOR ALL TO authenticated USING (public.tem_acesso()) WITH CHECK (public.tem_acesso());

-- historico: somente leitura (gravado apenas pelos triggers)
DROP POLICY IF EXISTS "historico_select" ON public.historico;
CREATE POLICY "historico_select" ON public.historico
  FOR SELECT TO authenticated USING (public.tem_acesso());

-- ============================================
-- VIEW: clientes_saldo
-- Totais por cliente: saídas (compras), entradas (pagamentos) e saldo devedor.
-- security_invoker = true faz a view respeitar o RLS das tabelas.
-- ============================================
CREATE OR REPLACE VIEW public.clientes_saldo
WITH (security_invoker = true) AS
SELECT
  c.id,
  c.nome,
  c.telefone,
  c.data_promessa,
  c.created_at,
  c.criado_por,
  c.atualizado_por,
  c.atualizado_em,
  COALESCE(cp.total, 0)::NUMERIC(12, 2) AS total_compras,
  COALESCE(pg.total, 0)::NUMERIC(12, 2) AS total_pagamentos,
  (COALESCE(cp.total, 0) - COALESCE(pg.total, 0))::NUMERIC(12, 2) AS saldo_devedor,
  cp.ultima_data AS ultima_compra,
  pg.ultima_data AS ultimo_pagamento
FROM public.clientes c
LEFT JOIN (
  SELECT cliente_id, SUM(valor) AS total, MAX(data) AS ultima_data FROM public.compras GROUP BY cliente_id
) cp ON cp.cliente_id = c.id
LEFT JOIN (
  SELECT cliente_id, SUM(valor) AS total, MAX(data) AS ultima_data FROM public.pagamentos GROUP BY cliente_id
) pg ON pg.cliente_id = c.id;

GRANT SELECT ON public.clientes_saldo TO authenticated;

-- ============================================
-- BLOQUEIO DE CADASTRO
-- Só e-mails presentes (e ativos) em "autorizados" conseguem criar conta.
-- ============================================
CREATE OR REPLACE FUNCTION public.bloquear_cadastro_nao_autorizado()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.autorizados
    WHERE email = lower(NEW.email) AND ativo
  ) THEN
    RAISE EXCEPTION 'EMAIL_NAO_AUTORIZADO';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bloquear_cadastro ON auth.users;
CREATE TRIGGER trg_bloquear_cadastro
  BEFORE INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.bloquear_cadastro_nao_autorizado();

-- ============================================
-- PRIMEIRO ADMINISTRADOR
-- Troque pelo SEU e-mail e nome antes de executar.
-- Depois, cadastre a conta no app com este mesmo e-mail.
-- ============================================
INSERT INTO public.autorizados (email, nome, papel)
VALUES ('SEU-EMAIL@exemplo.com', 'Seu nome', 'admin')
ON CONFLICT (email) DO NOTHING;

-- ============================================
-- MIGRAÇÕES IDEMPOTENTES (se a base já existir)
-- ============================================
ALTER TABLE public.autorizados ADD COLUMN IF NOT EXISTS chave_pix TEXT;
ALTER TABLE public.autorizados ADD COLUMN IF NOT EXISTS beneficiario_pix TEXT;
ALTER TABLE public.pagamentos ADD COLUMN IF NOT EXISTS forma_pagamento TEXT;
ALTER TABLE public.historico ADD COLUMN IF NOT EXISTS cliente_nome TEXT;
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS data_promessa DATE;


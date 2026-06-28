export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      agente_prompts: {
        Row: {
          documento_modelo: string | null
          id: string
          prompt: string
          provedor: string
          tipo: string
          updated_at: string
        }
        Insert: {
          documento_modelo?: string | null
          id?: string
          prompt: string
          provedor?: string
          tipo: string
          updated_at?: string
        }
        Update: {
          documento_modelo?: string | null
          id?: string
          prompt?: string
          provedor?: string
          tipo?: string
          updated_at?: string
        }
        Relationships: []
      }
      atendimentos: {
        Row: {
          cliente_id: string
          cliente_oculto_proxima: string | null
          cliente_oculto_ultima: string | null
          created_at: string
          id: string
          link_controle: string | null
          periodicidade: Database["public"]["Enums"]["periodicidade_atendimento"]
          proxima_reuniao: string | null
          trimestre_okrs: string | null
          ultima_reuniao: string | null
          updated_at: string
        }
        Insert: {
          cliente_id: string
          cliente_oculto_proxima?: string | null
          cliente_oculto_ultima?: string | null
          created_at?: string
          id?: string
          link_controle?: string | null
          periodicidade?: Database["public"]["Enums"]["periodicidade_atendimento"]
          proxima_reuniao?: string | null
          trimestre_okrs?: string | null
          ultima_reuniao?: string | null
          updated_at?: string
        }
        Update: {
          cliente_id?: string
          cliente_oculto_proxima?: string | null
          cliente_oculto_ultima?: string | null
          created_at?: string
          id?: string
          link_controle?: string | null
          periodicidade?: Database["public"]["Enums"]["periodicidade_atendimento"]
          proxima_reuniao?: string | null
          trimestre_okrs?: string | null
          ultima_reuniao?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "atendimentos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      auditoria_status_cliente: {
        Row: {
          cliente_id: string
          contrato_id: string | null
          created_at: string
          etapa_anterior_id: string | null
          etapa_nova_id: string | null
          id: string
          metadata: Json | null
          origem: string
          projeto_id: string | null
          status_anterior: string | null
          status_novo: string | null
          user_id: string | null
        }
        Insert: {
          cliente_id: string
          contrato_id?: string | null
          created_at?: string
          etapa_anterior_id?: string | null
          etapa_nova_id?: string | null
          id?: string
          metadata?: Json | null
          origem: string
          projeto_id?: string | null
          status_anterior?: string | null
          status_novo?: string | null
          user_id?: string | null
        }
        Update: {
          cliente_id?: string
          contrato_id?: string | null
          created_at?: string
          etapa_anterior_id?: string | null
          etapa_nova_id?: string | null
          id?: string
          metadata?: Json | null
          origem?: string
          projeto_id?: string | null
          status_anterior?: string | null
          status_novo?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "auditoria_status_cliente_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auditoria_status_cliente_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "contratos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auditoria_status_cliente_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_templates: {
        Row: {
          created_at: string
          id: string
          ordem: number
          tipo_consultoria_id: string
          titulo: string
        }
        Insert: {
          created_at?: string
          id?: string
          ordem?: number
          tipo_consultoria_id: string
          titulo: string
        }
        Update: {
          created_at?: string
          id?: string
          ordem?: number
          tipo_consultoria_id?: string
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_templates_tipo_consultoria_id_fkey"
            columns: ["tipo_consultoria_id"]
            isOneToOne: false
            referencedRelation: "tipos_consultoria"
            referencedColumns: ["id"]
          },
        ]
      }
      cliente_aliases: {
        Row: {
          alias: string
          cliente_id: string
          created_at: string
          id: string
        }
        Insert: {
          alias: string
          cliente_id: string
          created_at?: string
          id?: string
        }
        Update: {
          alias?: string
          cliente_id?: string
          created_at?: string
          id?: string
        }
        Relationships: []
      }
      clientes: {
        Row: {
          cidade: string
          consultor_id: string | null
          created_at: string
          id: string
          nome: string
          pipedrive_deal_id: string | null
          status: Database["public"]["Enums"]["status_cliente"]
          uf: string
          updated_at: string
        }
        Insert: {
          cidade: string
          consultor_id?: string | null
          created_at?: string
          id?: string
          nome: string
          pipedrive_deal_id?: string | null
          status?: Database["public"]["Enums"]["status_cliente"]
          uf: string
          updated_at?: string
        }
        Update: {
          cidade?: string
          consultor_id?: string | null
          created_at?: string
          id?: string
          nome?: string
          pipedrive_deal_id?: string | null
          status?: Database["public"]["Enums"]["status_cliente"]
          uf?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clientes_consultor_id_fkey"
            columns: ["consultor_id"]
            isOneToOne: false
            referencedRelation: "consultores"
            referencedColumns: ["id"]
          },
        ]
      }
      consultor_google_tokens: {
        Row: {
          access_token: string
          ativo: boolean
          consultor_id: string
          created_at: string
          email_google: string
          escopo: string
          expires_at: string
          id: string
          pasta_meet_id: string | null
          pasta_meet_link: string | null
          pasta_meet_nome: string | null
          pasta_meet_owner_email: string | null
          refresh_token: string
          ultima_sincronizacao: string | null
          updated_at: string
        }
        Insert: {
          access_token: string
          ativo?: boolean
          consultor_id: string
          created_at?: string
          email_google: string
          escopo: string
          expires_at: string
          id?: string
          pasta_meet_id?: string | null
          pasta_meet_link?: string | null
          pasta_meet_nome?: string | null
          pasta_meet_owner_email?: string | null
          refresh_token: string
          ultima_sincronizacao?: string | null
          updated_at?: string
        }
        Update: {
          access_token?: string
          ativo?: boolean
          consultor_id?: string
          created_at?: string
          email_google?: string
          escopo?: string
          expires_at?: string
          id?: string
          pasta_meet_id?: string | null
          pasta_meet_link?: string | null
          pasta_meet_nome?: string | null
          pasta_meet_owner_email?: string | null
          refresh_token?: string
          ultima_sincronizacao?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      consultor_user: {
        Row: {
          consultor_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          consultor_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          consultor_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "consultor_user_consultor_id_fkey"
            columns: ["consultor_id"]
            isOneToOne: true
            referencedRelation: "consultores"
            referencedColumns: ["id"]
          },
        ]
      }
      consultores: {
        Row: {
          ativo: boolean
          created_at: string
          email: string | null
          id: string
          nome: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          email?: string | null
          id?: string
          nome: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          email?: string | null
          id?: string
          nome?: string
          updated_at?: string
        }
        Relationships: []
      }
      contratos: {
        Row: {
          ativo: boolean
          cliente_id: string
          created_at: string
          data_fim: string
          data_fim_pagamento: string | null
          data_inicio: string
          encerrado_em: string | null
          id: string
          link_contrato: string | null
          momento: string | null
          parcelas: number
          particularidades: string | null
          pausado: boolean
          prazo_meses: number
          remuneracao_mensal: number
          remuneracao_total: number
          tipo_consultoria_id: string | null
          tipo_consultoria_personalizado: string | null
          tipo_vencimento: Database["public"]["Enums"]["tipo_vencimento"]
        }
        Insert: {
          ativo?: boolean
          cliente_id: string
          created_at?: string
          data_fim: string
          data_fim_pagamento?: string | null
          data_inicio: string
          encerrado_em?: string | null
          id?: string
          link_contrato?: string | null
          momento?: string | null
          parcelas: number
          particularidades?: string | null
          pausado?: boolean
          prazo_meses: number
          remuneracao_mensal: number
          remuneracao_total: number
          tipo_consultoria_id?: string | null
          tipo_consultoria_personalizado?: string | null
          tipo_vencimento?: Database["public"]["Enums"]["tipo_vencimento"]
        }
        Update: {
          ativo?: boolean
          cliente_id?: string
          created_at?: string
          data_fim?: string
          data_fim_pagamento?: string | null
          data_inicio?: string
          encerrado_em?: string | null
          id?: string
          link_contrato?: string | null
          momento?: string | null
          parcelas?: number
          particularidades?: string | null
          pausado?: boolean
          prazo_meses?: number
          remuneracao_mensal?: number
          remuneracao_total?: number
          tipo_consultoria_id?: string | null
          tipo_consultoria_personalizado?: string | null
          tipo_vencimento?: Database["public"]["Enums"]["tipo_vencimento"]
        }
        Relationships: [
          {
            foreignKeyName: "contratos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contratos_tipo_consultoria_id_fkey"
            columns: ["tipo_consultoria_id"]
            isOneToOne: false
            referencedRelation: "tipos_consultoria"
            referencedColumns: ["id"]
          },
        ]
      }
      crms: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          nome: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome?: string
        }
        Relationships: []
      }
      encerramentos: {
        Row: {
          classificacao: Database["public"]["Enums"]["classificacao_encerramento"]
          cliente_id: string
          clientes_ativos_momento: number | null
          contrato_id: string
          created_at: string
          data_encerramento: string
          id: string
          justificativa: string | null
          mrr_perdido: number
        }
        Insert: {
          classificacao: Database["public"]["Enums"]["classificacao_encerramento"]
          cliente_id: string
          clientes_ativos_momento?: number | null
          contrato_id: string
          created_at?: string
          data_encerramento: string
          id?: string
          justificativa?: string | null
          mrr_perdido: number
        }
        Update: {
          classificacao?: Database["public"]["Enums"]["classificacao_encerramento"]
          cliente_id?: string
          clientes_ativos_momento?: number | null
          contrato_id?: string
          created_at?: string
          data_encerramento?: string
          id?: string
          justificativa?: string | null
          mrr_perdido?: number
        }
        Relationships: [
          {
            foreignKeyName: "encerramentos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "encerramentos_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "contratos"
            referencedColumns: ["id"]
          },
        ]
      }
      ferramentas_cliente: {
        Row: {
          cliente_id: string
          created_at: string
          crm_id: string | null
          id: string
          link_dashboard_marketing: string | null
          link_investimento_digital: string | null
          tem_conectalead: boolean | null
          updated_at: string
        }
        Insert: {
          cliente_id: string
          created_at?: string
          crm_id?: string | null
          id?: string
          link_dashboard_marketing?: string | null
          link_investimento_digital?: string | null
          tem_conectalead?: boolean | null
          updated_at?: string
        }
        Update: {
          cliente_id?: string
          created_at?: string
          crm_id?: string | null
          id?: string
          link_dashboard_marketing?: string | null
          link_investimento_digital?: string | null
          tem_conectalead?: boolean | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ferramentas_cliente_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ferramentas_cliente_crm_id_fkey"
            columns: ["crm_id"]
            isOneToOne: false
            referencedRelation: "crms"
            referencedColumns: ["id"]
          },
        ]
      }
      notion_documents: {
        Row: {
          content: string | null
          created_at: string
          data_source_id: string
          id: string
          last_edited_time: string | null
          notion_page_id: string
          title: string | null
          updated_at: string
          url: string | null
        }
        Insert: {
          content?: string | null
          created_at?: string
          data_source_id: string
          id?: string
          last_edited_time?: string | null
          notion_page_id: string
          title?: string | null
          updated_at?: string
          url?: string | null
        }
        Update: {
          content?: string | null
          created_at?: string
          data_source_id?: string
          id?: string
          last_edited_time?: string | null
          notion_page_id?: string
          title?: string | null
          updated_at?: string
          url?: string | null
        }
        Relationships: []
      }
      onboarding: {
        Row: {
          cliente_id: string
          contrato_id: string | null
          created_at: string
          data_imersao_1_fim: string | null
          data_imersao_1_inicio: string | null
          data_imersao_2: string | null
          data_imersao_3: string | null
          data_pre_onboarding: string | null
          etapa_atual: Database["public"]["Enums"]["etapa_onboarding"]
          id: string
          observacoes: string | null
          updated_at: string
        }
        Insert: {
          cliente_id: string
          contrato_id?: string | null
          created_at?: string
          data_imersao_1_fim?: string | null
          data_imersao_1_inicio?: string | null
          data_imersao_2?: string | null
          data_imersao_3?: string | null
          data_pre_onboarding?: string | null
          etapa_atual?: Database["public"]["Enums"]["etapa_onboarding"]
          id?: string
          observacoes?: string | null
          updated_at?: string
        }
        Update: {
          cliente_id?: string
          contrato_id?: string | null
          created_at?: string
          data_imersao_1_fim?: string | null
          data_imersao_1_inicio?: string | null
          data_imersao_2?: string | null
          data_imersao_3?: string | null
          data_pre_onboarding?: string | null
          etapa_atual?: Database["public"]["Enums"]["etapa_onboarding"]
          id?: string
          observacoes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "contratos"
            referencedColumns: ["id"]
          },
        ]
      }
      oraculo_conversas: {
        Row: {
          contexto_origem: Json | null
          created_at: string
          id: string
          titulo: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          contexto_origem?: Json | null
          created_at?: string
          id?: string
          titulo?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          contexto_origem?: Json | null
          created_at?: string
          id?: string
          titulo?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      oraculo_knowledge: {
        Row: {
          categoria: string | null
          chunk_index: number | null
          conteudo: string
          created_at: string
          embedding: string | null
          id: string
          last_edited_time: string | null
          notion_page_id: string | null
          source: string | null
          titulo: string
        }
        Insert: {
          categoria?: string | null
          chunk_index?: number | null
          conteudo: string
          created_at?: string
          embedding?: string | null
          id?: string
          last_edited_time?: string | null
          notion_page_id?: string | null
          source?: string | null
          titulo: string
        }
        Update: {
          categoria?: string | null
          chunk_index?: number | null
          conteudo?: string
          created_at?: string
          embedding?: string | null
          id?: string
          last_edited_time?: string | null
          notion_page_id?: string | null
          source?: string | null
          titulo?: string
        }
        Relationships: []
      }
      oraculo_mensagens: {
        Row: {
          content: string
          conversa_id: string
          created_at: string
          id: string
          role: string
        }
        Insert: {
          content: string
          conversa_id: string
          created_at?: string
          id?: string
          role: string
        }
        Update: {
          content?: string
          conversa_id?: string
          created_at?: string
          id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "oraculo_mensagens_conversa_id_fkey"
            columns: ["conversa_id"]
            isOneToOne: false
            referencedRelation: "oraculo_conversas"
            referencedColumns: ["id"]
          },
        ]
      }
      pausas_contrato: {
        Row: {
          cliente_id: string
          contrato_id: string
          created_at: string
          data_fim: string | null
          data_inicio: string
          dias_pausados: number | null
          id: string
          motivo: string | null
          prorrogacao_aplicada: boolean
          updated_at: string
        }
        Insert: {
          cliente_id: string
          contrato_id: string
          created_at?: string
          data_fim?: string | null
          data_inicio: string
          dias_pausados?: number | null
          id?: string
          motivo?: string | null
          prorrogacao_aplicada?: boolean
          updated_at?: string
        }
        Update: {
          cliente_id?: string
          contrato_id?: string
          created_at?: string
          data_fim?: string | null
          data_inicio?: string
          dias_pausados?: number | null
          id?: string
          motivo?: string | null
          prorrogacao_aplicada?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pausas_contrato_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pausas_contrato_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "contratos"
            referencedColumns: ["id"]
          },
        ]
      }
      projeto_checklist: {
        Row: {
          assigned_to: string | null
          concluido: boolean
          created_at: string
          due_date: string | null
          id: string
          ordem: number
          projeto_id: string
          start_date: string | null
          titulo: string
        }
        Insert: {
          assigned_to?: string | null
          concluido?: boolean
          created_at?: string
          due_date?: string | null
          id?: string
          ordem?: number
          projeto_id: string
          start_date?: string | null
          titulo: string
        }
        Update: {
          assigned_to?: string | null
          concluido?: boolean
          created_at?: string
          due_date?: string | null
          id?: string
          ordem?: number
          projeto_id?: string
          start_date?: string | null
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "projeto_checklist_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "consultores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projeto_checklist_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
        ]
      }
      projeto_checklist_responsaveis: {
        Row: {
          checklist_item_id: string
          consultor_id: string
          created_at: string
          id: string
        }
        Insert: {
          checklist_item_id: string
          consultor_id: string
          created_at?: string
          id?: string
        }
        Update: {
          checklist_item_id?: string
          consultor_id?: string
          created_at?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "projeto_checklist_responsaveis_checklist_item_id_fkey"
            columns: ["checklist_item_id"]
            isOneToOne: false
            referencedRelation: "projeto_checklist"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projeto_checklist_responsaveis_consultor_id_fkey"
            columns: ["consultor_id"]
            isOneToOne: false
            referencedRelation: "consultores"
            referencedColumns: ["id"]
          },
        ]
      }
      projeto_comentarios: {
        Row: {
          created_at: string
          id: string
          projeto_id: string
          texto: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          projeto_id: string
          texto: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          projeto_id?: string
          texto?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "projeto_comentarios_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
        ]
      }
      projeto_documentos: {
        Row: {
          conteudo: string
          created_at: string
          created_by: string | null
          id: string
          projeto_id: string
          tipo: string
        }
        Insert: {
          conteudo: string
          created_at?: string
          created_by?: string | null
          id?: string
          projeto_id: string
          tipo: string
        }
        Update: {
          conteudo?: string
          created_at?: string
          created_by?: string | null
          id?: string
          projeto_id?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "projeto_documentos_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
        ]
      }
      projeto_tag_vinculo: {
        Row: {
          created_at: string
          id: string
          projeto_id: string
          tag_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          projeto_id: string
          tag_id: string
        }
        Update: {
          created_at?: string
          id?: string
          projeto_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "projeto_tag_vinculo_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projeto_tag_vinculo_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "projeto_tags"
            referencedColumns: ["id"]
          },
        ]
      }
      projeto_tags: {
        Row: {
          cor: string
          created_at: string
          id: string
          nome: string
        }
        Insert: {
          cor?: string
          created_at?: string
          id?: string
          nome: string
        }
        Update: {
          cor?: string
          created_at?: string
          id?: string
          nome?: string
        }
        Relationships: []
      }
      projetos: {
        Row: {
          cliente_id: string
          consultor_id: string
          contrato_id: string | null
          created_at: string
          due_date: string | null
          due_date_start: string | null
          etapa_id: string
          id: string
          observacoes: string | null
          ordem_na_etapa: number
          tipo: string
          updated_at: string
        }
        Insert: {
          cliente_id: string
          consultor_id: string
          contrato_id?: string | null
          created_at?: string
          due_date?: string | null
          due_date_start?: string | null
          etapa_id: string
          id?: string
          observacoes?: string | null
          ordem_na_etapa?: number
          tipo?: string
          updated_at?: string
        }
        Update: {
          cliente_id?: string
          consultor_id?: string
          contrato_id?: string | null
          created_at?: string
          due_date?: string | null
          due_date_start?: string | null
          etapa_id?: string
          id?: string
          observacoes?: string | null
          ordem_na_etapa?: number
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projetos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projetos_consultor_id_fkey"
            columns: ["consultor_id"]
            isOneToOne: false
            referencedRelation: "consultores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projetos_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "contratos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projetos_etapa_id_fkey"
            columns: ["etapa_id"]
            isOneToOne: false
            referencedRelation: "projetos_etapas"
            referencedColumns: ["id"]
          },
        ]
      }
      projetos_etapas: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          nome: string
          ordem: number
          status_cliente: Database["public"]["Enums"]["status_cliente"] | null
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome: string
          ordem?: number
          status_cliente?: Database["public"]["Enums"]["status_cliente"] | null
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome?: string
          ordem?: number
          status_cliente?: Database["public"]["Enums"]["status_cliente"] | null
        }
        Relationships: []
      }
      questionarios: {
        Row: {
          cliente_id: string
          concluido_em: string | null
          created_at: string
          expira_em: string | null
          id: string
          iniciado_em: string | null
          progresso_pct: number
          respostas: Json
          status: string
          template_id: string
          token: string
          ultimo_salvamento_em: string | null
          updated_at: string
        }
        Insert: {
          cliente_id: string
          concluido_em?: string | null
          created_at?: string
          expira_em?: string | null
          id?: string
          iniciado_em?: string | null
          progresso_pct?: number
          respostas?: Json
          status?: string
          template_id: string
          token?: string
          ultimo_salvamento_em?: string | null
          updated_at?: string
        }
        Update: {
          cliente_id?: string
          concluido_em?: string | null
          created_at?: string
          expira_em?: string | null
          id?: string
          iniciado_em?: string | null
          progresso_pct?: number
          respostas?: Json
          status?: string
          template_id?: string
          token?: string
          ultimo_salvamento_em?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "questionarios_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questionarios_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "questionarios_template"
            referencedColumns: ["id"]
          },
        ]
      }
      questionarios_template: {
        Row: {
          ativo: boolean
          created_at: string
          estrutura: Json
          id: string
          nome: string
          updated_at: string
          versao: number
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          estrutura?: Json
          id?: string
          nome: string
          updated_at?: string
          versao?: number
        }
        Update: {
          ativo?: boolean
          created_at?: string
          estrutura?: Json
          id?: string
          nome?: string
          updated_at?: string
          versao?: number
        }
        Relationships: []
      }
      reunioes: {
        Row: {
          analise_cliente: Json | null
          analise_ia: Json | null
          cliente_id: string
          consultor_id: string
          created_at: string
          data_reuniao: string
          duracao_minutos: number | null
          google_meet_link: string | null
          id: string
          resumo_ia: string | null
          score_cliente: number | null
          score_ia: number | null
          status_analise: string
          transcricao: string | null
          updated_at: string
        }
        Insert: {
          analise_cliente?: Json | null
          analise_ia?: Json | null
          cliente_id: string
          consultor_id: string
          created_at?: string
          data_reuniao: string
          duracao_minutos?: number | null
          google_meet_link?: string | null
          id?: string
          resumo_ia?: string | null
          score_cliente?: number | null
          score_ia?: number | null
          status_analise?: string
          transcricao?: string | null
          updated_at?: string
        }
        Update: {
          analise_cliente?: Json | null
          analise_ia?: Json | null
          cliente_id?: string
          consultor_id?: string
          created_at?: string
          data_reuniao?: string
          duracao_minutos?: number | null
          google_meet_link?: string | null
          id?: string
          resumo_ia?: string | null
          score_cliente?: number | null
          score_ia?: number | null
          status_analise?: string
          transcricao?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reunioes_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reunioes_consultor_id_fkey"
            columns: ["consultor_id"]
            isOneToOne: false
            referencedRelation: "consultores"
            referencedColumns: ["id"]
          },
        ]
      }
      reunioes_importadas_log: {
        Row: {
          cliente_id: string | null
          consultor_id: string
          data_importacao: string
          erro: string | null
          google_file_id: string
          id: string
          nome_arquivo: string | null
          reuniao_id: string | null
          status: string
        }
        Insert: {
          cliente_id?: string | null
          consultor_id: string
          data_importacao?: string
          erro?: string | null
          google_file_id: string
          id?: string
          nome_arquivo?: string | null
          reuniao_id?: string | null
          status?: string
        }
        Update: {
          cliente_id?: string | null
          consultor_id?: string
          data_importacao?: string
          erro?: string | null
          google_file_id?: string
          id?: string
          nome_arquivo?: string | null
          reuniao_id?: string | null
          status?: string
        }
        Relationships: []
      }
      tipos_consultoria: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          nome: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome?: string
        }
        Relationships: []
      }
      todo_pessoal: {
        Row: {
          assigned_by: string | null
          concluido: boolean
          created_at: string
          due_date: string | null
          id: string
          ordem: number
          projeto_id: string | null
          titulo: string
          updated_at: string
          user_id: string
        }
        Insert: {
          assigned_by?: string | null
          concluido?: boolean
          created_at?: string
          due_date?: string | null
          id?: string
          ordem?: number
          projeto_id?: string | null
          titulo: string
          updated_at?: string
          user_id: string
        }
        Update: {
          assigned_by?: string | null
          concluido?: boolean
          created_at?: string
          due_date?: string | null
          id?: string
          ordem?: number
          projeto_id?: string | null
          titulo?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "todo_pessoal_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          force_password_change: boolean
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          force_password_change?: boolean
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          force_password_change?: boolean
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      viagens_contrato: {
        Row: {
          cliente_id: string
          contrato_id: string
          created_at: string
          data_viagem: string
          descricao: string | null
          id: string
          updated_at: string
          valor: number
        }
        Insert: {
          cliente_id: string
          contrato_id: string
          created_at?: string
          data_viagem: string
          descricao?: string | null
          id?: string
          updated_at?: string
          valor?: number
        }
        Update: {
          cliente_id?: string
          contrato_id?: string
          created_at?: string
          data_viagem?: string
          descricao?: string | null
          id?: string
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "viagens_contrato_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "viagens_contrato_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "contratos"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_logs: {
        Row: {
          cliente_id: string | null
          created_at: string
          erro: string | null
          id: string
          payload: Json
          processado: boolean
        }
        Insert: {
          cliente_id?: string | null
          created_at?: string
          erro?: string | null
          id?: string
          payload: Json
          processado?: boolean
        }
        Update: {
          cliente_id?: string | null
          created_at?: string
          erro?: string | null
          id?: string
          payload?: Json
          processado?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "webhook_logs_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      aplicar_baixa_contratos_pagos: { Args: never; Returns: undefined }
      buscar_conhecimento: {
        Args: { match_count?: number; query_embedding: string }
        Returns: {
          categoria: string
          conteudo: string
          id: string
          similarity: number
          titulo: string
        }[]
      }
      criar_cards_renovacao: { Args: never; Returns: number }
      get_consultor_id_for_user: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_authorized_user: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "director" | "consultor"
      classificacao_encerramento: "churn" | "fim_contrato"
      etapa_onboarding:
        | "pre_onboarding"
        | "imersao_1"
        | "imersao_2"
        | "imersao_3"
        | "concluido"
      periodicidade_atendimento: "semanal" | "quinzenal" | "mensal"
      status_cliente: "novo" | "ativo" | "aguardando_renovacao" | "encerrado"
      tipo_vencimento: "antecipado" | "postecipado"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "director", "consultor"],
      classificacao_encerramento: ["churn", "fim_contrato"],
      etapa_onboarding: [
        "pre_onboarding",
        "imersao_1",
        "imersao_2",
        "imersao_3",
        "concluido",
      ],
      periodicidade_atendimento: ["semanal", "quinzenal", "mensal"],
      status_cliente: ["novo", "ativo", "aguardando_renovacao", "encerrado"],
      tipo_vencimento: ["antecipado", "postecipado"],
    },
  },
} as const

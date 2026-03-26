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
          data_inicio: string
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
          tipo_vencimento: Database["public"]["Enums"]["tipo_vencimento"]
        }
        Insert: {
          ativo?: boolean
          cliente_id: string
          created_at?: string
          data_fim: string
          data_inicio: string
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
          tipo_vencimento?: Database["public"]["Enums"]["tipo_vencimento"]
        }
        Update: {
          ativo?: boolean
          cliente_id?: string
          created_at?: string
          data_fim?: string
          data_inicio?: string
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
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome: string
          ordem?: number
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome?: string
          ordem?: number
        }
        Relationships: []
      }
      reunioes: {
        Row: {
          analise_ia: Json | null
          cliente_id: string
          consultor_id: string
          created_at: string
          data_reuniao: string
          duracao_minutos: number | null
          google_meet_link: string | null
          id: string
          resumo_ia: string | null
          score_ia: number | null
          status_analise: string
          transcricao: string | null
          updated_at: string
        }
        Insert: {
          analise_ia?: Json | null
          cliente_id: string
          consultor_id: string
          created_at?: string
          data_reuniao: string
          duracao_minutos?: number | null
          google_meet_link?: string | null
          id?: string
          resumo_ia?: string | null
          score_ia?: number | null
          status_analise?: string
          transcricao?: string | null
          updated_at?: string
        }
        Update: {
          analise_ia?: Json | null
          cliente_id?: string
          consultor_id?: string
          created_at?: string
          data_reuniao?: string
          duracao_minutos?: number | null
          google_meet_link?: string | null
          id?: string
          resumo_ia?: string | null
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

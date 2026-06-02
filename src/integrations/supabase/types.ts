export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      caixa: {
        Row: {
          id: string
          aberto_por: string | null
          fechado_por: string | null
          valor_abertura: number
          valor_fechamento: number | null
          observacao_abertura: string | null
          observacao_fechamento: string | null
          aberto_em: string
          fechado_em: string | null
          status: string
        }
        Insert: {
          id?: string
          aberto_por?: string | null
          fechado_por?: string | null
          valor_abertura?: number
          valor_fechamento?: number | null
          observacao_abertura?: string | null
          observacao_fechamento?: string | null
          aberto_em?: string
          fechado_em?: string | null
          status?: string
        }
        Update: {
          id?: string
          aberto_por?: string | null
          fechado_por?: string | null
          valor_abertura?: number
          valor_fechamento?: number | null
          observacao_abertura?: string | null
          observacao_fechamento?: string | null
          aberto_em?: string
          fechado_em?: string | null
          status?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          category: string | null
          cost: number
          created_at: string
          created_by: string | null
          data_entrada: string | null
          endereco: string | null
          id: string
          lote: string | null
          name: string
          price: number
          sku: string | null
          subcategory: string | null
          updated_at: string
        }
        Insert: {
          category?: string | null
          cost?: number
          created_at?: string
          created_by?: string | null
          data_entrada?: string | null
          endereco?: string | null
          id?: string
          lote?: string | null
          name: string
          price?: number
          sku?: string | null
          subcategory?: string | null
          updated_at?: string
        }
        Update: {
          category?: string | null
          cost?: number
          created_at?: string
          created_by?: string | null
          data_entrada?: string | null
          endereco?: string | null
          id?: string
          lote?: string | null
          name?: string
          price?: number
          sku?: string | null
          subcategory?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          ativo: boolean
          cargo: string | null
          created_at: string
          full_name: string | null
          id: string
          modulos: string[]
          role: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          cargo?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          modulos?: string[]
          role?: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          cargo?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          modulos?: string[]
          role?: string
          updated_at?: string
        }
        Relationships: []
      }
      sale_items: {
        Row: {
          data_saida: string | null
          desconto: number
          id: string
          name: string
          price: number
          product_id: string | null
          quantity: number
          sale_id: string
          subtotal: number
        }
        Insert: {
          data_saida?: string | null
          desconto?: number
          id?: string
          name: string
          price: number
          product_id?: string | null
          quantity?: number
          sale_id: string
          subtotal: number
        }
        Update: {
          data_saida?: string | null
          desconto?: number
          id?: string
          name?: string
          price?: number
          product_id?: string | null
          quantity?: number
          sale_id?: string
          subtotal?: number
        }
        Relationships: [
          {
            foreignKeyName: "sale_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          amount_paid: number | null
          cancel_reason: string | null
          canceled_at: string | null
          canceled_by: string | null
          change_due: number
          created_at: string
          created_by: string | null
          desconto: number
          id: string
          payment_method: string
          receipt_number: number
          total: number
        }
        Insert: {
          amount_paid?: number | null
          cancel_reason?: string | null
          canceled_at?: string | null
          canceled_by?: string | null
          change_due?: number
          created_at?: string
          created_by?: string | null
          desconto?: number
          id?: string
          payment_method: string
          receipt_number?: number
          total?: number
        }
        Update: {
          amount_paid?: number | null
          cancel_reason?: string | null
          canceled_at?: string | null
          canceled_by?: string | null
          change_due?: number
          created_at?: string
          created_by?: string | null
          desconto?: number
          id?: string
          payment_method?: string
          receipt_number?: number
          total?: number
        }
        Relationships: []
      }
      plano_contas: {
        Row: {
          id: string
          tipo: "DESPESA" | "RECEITA"
          nome: string
          ativo: boolean
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          tipo: "DESPESA" | "RECEITA"
          nome: string
          ativo?: boolean
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          tipo?: "DESPESA" | "RECEITA"
          nome?: string
          ativo?: boolean
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      lancamento_financeiro: {
        Row: {
          id: string
          tipo: "DESPESA" | "RECEITA"
          descricao: string
          beneficiario: string | null
          valor: number
          dt_vencimento: string
          dt_pagamento: string | null
          numero_documento: string | null
          plano_contas_id: string
          status: "PENDENTE" | "PAGO" | "CANCELADO"
          recorrencia: "NAO" | "DIARIAMENTE" | "SEMANALMENTE" | "MENSALMENTE"
          numero_parcelas: number | null
          parcela_atual: number | null
          grupo_parcela_id: string | null
          lancamento_pai_id: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          tipo: "DESPESA" | "RECEITA"
          descricao: string
          beneficiario?: string | null
          valor: number
          dt_vencimento: string
          dt_pagamento?: string | null
          numero_documento?: string | null
          plano_contas_id: string
          status?: "PENDENTE" | "PAGO" | "CANCELADO"
          recorrencia?: "NAO" | "DIARIAMENTE" | "SEMANALMENTE" | "MENSALMENTE"
          numero_parcelas?: number | null
          parcela_atual?: number | null
          grupo_parcela_id?: string | null
          lancamento_pai_id?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          tipo?: "DESPESA" | "RECEITA"
          descricao?: string
          beneficiario?: string | null
          valor?: number
          dt_vencimento?: string
          dt_pagamento?: string | null
          numero_documento?: string | null
          plano_contas_id?: string
          status?: "PENDENTE" | "PAGO" | "CANCELADO"
          recorrencia?: "NAO" | "DIARIAMENTE" | "SEMANALMENTE" | "MENSALMENTE"
          numero_parcelas?: number | null
          parcela_atual?: number | null
          grupo_parcela_id?: string | null
          lancamento_pai_id?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lancamento_financeiro_plano_contas_id_fkey"
            columns: ["plano_contas_id"]
            isOneToOne: false
            referencedRelation: "plano_contas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lancamento_financeiro_lancamento_pai_id_fkey"
            columns: ["lancamento_pai_id"]
            isOneToOne: false
            referencedRelation: "lancamento_financeiro"
            referencedColumns: ["id"]
          },
        ]
      }
      anexo_financeiro: {
        Row: {
          id: string
          lancamento_id: string
          nome: string
          url: string
          storage_key: string
          tamanho: number
          dt_upload: string
        }
        Insert: {
          id?: string
          lancamento_id: string
          nome: string
          url: string
          storage_key: string
          tamanho: number
          dt_upload?: string
        }
        Update: {
          id?: string
          lancamento_id?: string
          nome?: string
          url?: string
          storage_key?: string
          tamanho?: number
          dt_upload?: string
        }
        Relationships: [
          {
            foreignKeyName: "anexo_financeiro_lancamento_id_fkey"
            columns: ["lancamento_id"]
            isOneToOne: false
            referencedRelation: "lancamento_financeiro"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
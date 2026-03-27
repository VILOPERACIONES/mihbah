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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      agent_skills: {
        Row: {
          created_at: string
          description: string
          enabled: boolean
          id: string
          model: string
          name: string
          provider_id: string | null
          system_prompt: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string
          enabled?: boolean
          id?: string
          model?: string
          name: string
          provider_id?: string | null
          system_prompt?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          enabled?: boolean
          id?: string
          model?: string
          name?: string
          provider_id?: string | null
          system_prompt?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_skills_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "llm_providers"
            referencedColumns: ["id"]
          },
        ]
      }
      conversaciones: {
        Row: {
          created_at: string
          empresa: string | null
          id: string
          mensajes: Json
          tokens: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          empresa?: string | null
          id?: string
          mensajes?: Json
          tokens?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          empresa?: string | null
          id?: string
          mensajes?: Json
          tokens?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      cuentas_pendientes: {
        Row: {
          created_at: string
          descripcion: string
          empresa: string
          fecha_emision: string
          fecha_pago: string | null
          fecha_vencimiento: string | null
          id: string
          monto: number
          pagado: boolean
          referencia: string | null
          tipo: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          descripcion?: string
          empresa: string
          fecha_emision?: string
          fecha_pago?: string | null
          fecha_vencimiento?: string | null
          id?: string
          monto: number
          pagado?: boolean
          referencia?: string | null
          tipo: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          descripcion?: string
          empresa?: string
          fecha_emision?: string
          fecha_pago?: string | null
          fecha_vencimiento?: string | null
          id?: string
          monto?: number
          pagado?: boolean
          referencia?: string | null
          tipo?: string
          updated_at?: string
        }
        Relationships: []
      }
      excel_uploads: {
        Row: {
          created_at: string
          errores_detalle: Json | null
          filas_error: number
          filas_importadas: number
          id: string
          nombre_archivo: string
          subido_por_id: string
          total_filas: number
        }
        Insert: {
          created_at?: string
          errores_detalle?: Json | null
          filas_error?: number
          filas_importadas?: number
          id?: string
          nombre_archivo: string
          subido_por_id: string
          total_filas?: number
        }
        Update: {
          created_at?: string
          errores_detalle?: Json | null
          filas_error?: number
          filas_importadas?: number
          id?: string
          nombre_archivo?: string
          subido_por_id?: string
          total_filas?: number
        }
        Relationships: []
      }
      llm_providers: {
        Row: {
          api_key_encrypted: string
          base_url: string
          created_at: string
          id: string
          is_default: boolean
          models: string[]
          name: string
          updated_at: string
        }
        Insert: {
          api_key_encrypted?: string
          base_url?: string
          created_at?: string
          id?: string
          is_default?: boolean
          models?: string[]
          name: string
          updated_at?: string
        }
        Update: {
          api_key_encrypted?: string
          base_url?: string
          created_at?: string
          id?: string
          is_default?: boolean
          models?: string[]
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      movimientos: {
        Row: {
          activo: boolean
          anio: number
          categoria: string | null
          comentario: string | null
          concepto: string
          created_at: string
          cuenta: string | null
          empresa: string
          fecha: string
          fuente: string
          grupo: string | null
          id: string
          mes: number
          monto: number
          nombre: string | null
          proyecto: string | null
          tipo: Database["public"]["Enums"]["tipo_mov"]
          updated_at: string
          upload_id: string | null
        }
        Insert: {
          activo?: boolean
          anio: number
          categoria?: string | null
          comentario?: string | null
          concepto: string
          created_at?: string
          cuenta?: string | null
          empresa: string
          fecha: string
          fuente?: string
          grupo?: string | null
          id?: string
          mes: number
          monto: number
          nombre?: string | null
          proyecto?: string | null
          tipo: Database["public"]["Enums"]["tipo_mov"]
          updated_at?: string
          upload_id?: string | null
        }
        Update: {
          activo?: boolean
          anio?: number
          categoria?: string | null
          comentario?: string | null
          concepto?: string
          created_at?: string
          cuenta?: string | null
          empresa?: string
          fecha?: string
          fuente?: string
          grupo?: string | null
          id?: string
          mes?: number
          monto?: number
          nombre?: string | null
          proyecto?: string | null
          tipo?: Database["public"]["Enums"]["tipo_mov"]
          updated_at?: string
          upload_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_movimientos_upload"
            columns: ["upload_id"]
            isOneToOne: false
            referencedRelation: "excel_uploads"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          activo: boolean
          created_at: string
          empresas: string[]
          id: string
          modulos_override: Json | null
          nombre: string
          updated_at: string
          user_id: string
        }
        Insert: {
          activo?: boolean
          created_at?: string
          empresas?: string[]
          id?: string
          modulos_override?: Json | null
          nombre?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          activo?: boolean
          created_at?: string
          empresas?: string[]
          id?: string
          modulos_override?: Json | null
          nombre?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      role_module_access: {
        Row: {
          allowed: boolean
          id: string
          module: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          allowed?: boolean
          id?: string
          module: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          allowed?: boolean
          id?: string
          module?: string
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_access_empresa: {
        Args: { _empresa: string; _user_id: string }
        Returns: boolean
      }
      get_available_periods: {
        Args: never
        Returns: {
          anio: number
          mes: number
        }[]
      }
      get_cuentas_pendientes_totales: {
        Args: { _empresa?: string }
        Returns: Json
      }
      get_cuentas_resumen: {
        Args: { _empresa?: string }
        Returns: {
          count: number
          cuenta: string
          saldo: number
        }[]
      }
      get_cxc_cxp_dashboard: { Args: { _empresa?: string }; Returns: Json }
      get_flujo_caja_mensual: {
        Args: { _anio_desde: number; _anio_hasta: number; _empresa?: string }
        Returns: {
          anio: number
          ingresos: number
          mes: number
          neto: number
          salidas: number
        }[]
      }
      get_flujo_mensual: {
        Args: { _anio_desde: number; _empresa?: string }
        Returns: {
          ingresos: number
          periodo: string
          salidas: number
        }[]
      }
      get_kpis_mes: {
        Args: { _anio: number; _empresa?: string; _mes: number }
        Returns: Json
      }
      get_latest_month: {
        Args: never
        Returns: {
          anio: number
          mes: number
        }[]
      }
      get_proyectos_resumen: {
        Args: { _empresa?: string }
        Returns: {
          empresa: string
          fecha_max: string
          fecha_min: string
          flujo: number
          proyecto: string
          registros: number
        }[]
      }
      get_top_categorias: {
        Args: {
          _anio: number
          _empresa?: string
          _limite?: number
          _mes: number
        }
        Returns: {
          categoria: string
          total: number
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "SUPER_ADMIN" | "ADMIN" | "VIEWER" | "SUPER_ADMIN_DEV"
      tipo_mov: "INGRESO" | "SALIDA" | "INTERNO" | "PRESTAMO"
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
      app_role: ["SUPER_ADMIN", "ADMIN", "VIEWER", "SUPER_ADMIN_DEV"],
      tipo_mov: ["INGRESO", "SALIDA", "INTERNO", "PRESTAMO"],
    },
  },
} as const

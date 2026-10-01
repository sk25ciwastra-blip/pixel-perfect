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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      activity_logs: {
        Row: {
          action: string
          created_at: string
          description: string
          entity_id: string | null
          entity_type: string
          id: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          description?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          description?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          user_id?: string | null
        }
        Relationships: []
      }
      employees: {
        Row: {
          active: boolean
          created_at: string
          employee_id: string
          id: string
          name: string
          position: Database["public"]["Enums"]["employee_position"]
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          employee_id: string
          id?: string
          name: string
          position: Database["public"]["Enums"]["employee_position"]
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          employee_id?: string
          id?: string
          name?: string
          position?: Database["public"]["Enums"]["employee_position"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      guests: {
        Row: {
          address: string
          created_at: string
          full_name: string
          id: string
          notes: string
          phone: string
          updated_at: string
        }
        Insert: {
          address: string
          created_at?: string
          full_name: string
          id?: string
          notes?: string
          phone: string
          updated_at?: string
        }
        Update: {
          address?: string
          created_at?: string
          full_name?: string
          id?: string
          notes?: string
          phone?: string
          updated_at?: string
        }
        Relationships: []
      }
      package_price_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          id: string
          new_price: number
          old_price: number
          package_id: string
          reason: string
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          id?: string
          new_price: number
          old_price: number
          package_id: string
          reason?: string
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          id?: string
          new_price?: number
          old_price?: number
          package_id?: string
          reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "package_price_history_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "packages"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          created_by: string
          id: string
          kind: Database["public"]["Enums"]["payment_kind"]
          method: Database["public"]["Enums"]["payment_method"]
          note: string
          transaction_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string
          id?: string
          kind?: Database["public"]["Enums"]["payment_kind"]
          method: Database["public"]["Enums"]["payment_method"]
          note?: string
          transaction_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string
          id?: string
          kind?: Database["public"]["Enums"]["payment_kind"]
          method?: Database["public"]["Enums"]["payment_method"]
          note?: string
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      refunds: {
        Row: {
          amount: number
          created_at: string
          created_by: string
          id: string
          payment_id: string | null
          reason: string
          transaction_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string
          id?: string
          payment_id?: string | null
          reason: string
          transaction_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string
          id?: string
          payment_id?: string | null
          reason?: string
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "refunds_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refunds_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      packages: {
        Row: {
          active: boolean
          created_at: string
          description: string
          duration_minutes: number
          id: string
          name: string
          price: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string
          duration_minutes: number
          id?: string
          name: string
          price: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string
          duration_minutes?: number
          id?: string
          name?: string
          price?: number
          updated_at?: string
        }
        Relationships: []
      }
      room_types: {
        Row: {
          active: boolean
          created_at: string
          description: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      rooms: {
        Row: {
          active: boolean
          base_price: number
          created_at: string
          id: string
          notes: string
          room_number: string
          room_type_id: string
          status: Database["public"]["Enums"]["room_status"]
          updated_at: string
        }
        Insert: {
          active?: boolean
          base_price?: number
          created_at?: string
          id?: string
          notes?: string
          room_number: string
          room_type_id: string
          status?: Database["public"]["Enums"]["room_status"]
          updated_at?: string
        }
        Update: {
          active?: boolean
          base_price?: number
          created_at?: string
          id?: string
          notes?: string
          room_number?: string
          room_type_id?: string
          status?: Database["public"]["Enums"]["room_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rooms_room_type_id_fkey"
            columns: ["room_type_id"]
            isOneToOne: false
            referencedRelation: "room_types"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          checked_in_at: string | null
          checked_out_at: string | null
          created_at: string
          created_by: string
          guest_id: string
          id: string
          package_id: string | null
          price_snapshot: number | null
          room_id: string
          scheduled_end_at: string | null
          status: Database["public"]["Enums"]["transaction_status"]
          transaction_number: string
          updated_at: string
        }
        Insert: {
          checked_in_at?: string | null
          checked_out_at?: string | null
          created_at?: string
          created_by?: string
          guest_id: string
          id?: string
          package_id?: string | null
          price_snapshot?: number | null
          room_id: string
          scheduled_end_at?: string | null
          status?: Database["public"]["Enums"]["transaction_status"]
          transaction_number?: string
          updated_at?: string
        }
        Update: {
          checked_in_at?: string | null
          checked_out_at?: string | null
          created_at?: string
          created_by?: string
          guest_id?: string
          id?: string
          package_id?: string | null
          price_snapshot?: number | null
          room_id?: string
          scheduled_end_at?: string | null
          status?: Database["public"]["Enums"]["transaction_status"]
          transaction_number?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_guest_id_fkey"
            columns: ["guest_id"]
            isOneToOne: false
            referencedRelation: "guests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
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
      advance_room_cleaning: { Args: { _room_id: string }; Returns: undefined }
      can_operate: { Args: { _user_id: string }; Returns: boolean }
      change_package_price: {
        Args: { _new_price: number; _package_id: string; _reason: string }
        Returns: undefined
      }
      create_checkin: {
        Args: {
          _guest_id: string
          _package_id: string
          _payment_method: Database["public"]["Enums"]["payment_method"]
          _room_id: string
        }
        Returns: string
      }
      record_refund: {
        Args: { _amount: number; _reason: string; _transaction_id: string }
        Returns: undefined
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_receptionist: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "owner" | "employee"
      employee_position: "receptionist" | "housekeeping"
      payment_kind: "dp" | "pelunasan" | "extend" | "overtime" | "lainnya"
      payment_method: "cash" | "qris" | "transfer"
      room_status: "ready" | "occupied" | "dirty" | "cleaning"
      transaction_status: "booking" | "check_in" | "check_out" | "cancelled"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["owner", "employee"],
      employee_position: ["receptionist", "housekeeping"],
      payment_kind: ["dp", "pelunasan", "extend", "overtime", "lainnya"],
      payment_method: ["cash", "qris", "transfer"],
      room_status: ["ready", "occupied", "dirty", "cleaning"],
      transaction_status: ["booking", "check_in", "check_out", "cancelled"],
    },
  },
} as const

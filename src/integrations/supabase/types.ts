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
          price_type: string
          reason: string
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          id?: string
          new_price: number
          old_price: number
          package_id: string
          price_type: string
          reason?: string
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          id?: string
          new_price?: number
          old_price?: number
          package_id?: string
          price_type?: string
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
      packages: {
        Row: {
          active: boolean
          checkin_end_time: string | null
          checkin_start_time: string | null
          checkout_time: string | null
          created_at: string
          description: string
          duration_minutes: number
          id: string
          name: string
          price: number
          slot_start_time: string | null
          time_mode: string | null
          updated_at: string
          weekday_price: number
          weekend_price: number
        }
        Insert: {
          active?: boolean
          checkin_end_time?: string | null
          checkin_start_time?: string | null
          checkout_time?: string | null
          created_at?: string
          description?: string
          duration_minutes: number
          id?: string
          name: string
          price: number
          slot_start_time?: string | null
          time_mode?: string | null
          updated_at?: string
          weekday_price: number
          weekend_price: number
        }
        Update: {
          active?: boolean
          checkin_end_time?: string | null
          checkin_start_time?: string | null
          checkout_time?: string | null
          created_at?: string
          description?: string
          duration_minutes?: number
          id?: string
          name?: string
          price?: number
          slot_start_time?: string | null
          time_mode?: string | null
          updated_at?: string
          weekday_price?: number
          weekend_price?: number
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          id: string
          kind: string
          method: string
          recorded_by: string
          transaction_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          kind: string
          method: string
          recorded_by?: string
          transaction_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          kind?: string
          method?: string
          recorded_by?: string
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
          checked_out_at: string | null
          created_at: string
          created_by: string
          day_mode: string | null
          ends_at: string | null
          guest_id: string
          id: string
          package_id: string | null
          price_snapshot: number | null
          room_id: string
          started_at: string | null
          status: Database["public"]["Enums"]["transaction_status"]
          transaction_number: string
          updated_at: string
        }
        Insert: {
          checked_out_at?: string | null
          created_at?: string
          created_by?: string
          day_mode?: string | null
          ends_at?: string | null
          guest_id: string
          id?: string
          package_id?: string | null
          price_snapshot?: number | null
          room_id: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["transaction_status"]
          transaction_number?: string
          updated_at?: string
        }
        Update: {
          checked_out_at?: string | null
          created_at?: string
          created_by?: string
          day_mode?: string | null
          ends_at?: string | null
          guest_id?: string
          id?: string
          package_id?: string | null
          price_snapshot?: number | null
          room_id?: string
          started_at?: string | null
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
      apply_official_package_timing: {
        Args: { _package_id: string; _package_name: string }
        Returns: undefined
      }
      calculate_package_stay_times: {
        Args: { _package_id: string; _started_at?: string }
        Returns: {
          ends_at: string
          started_at: string
        }[]
      }
      can_frontdesk: { Args: { _user_id: string }; Returns: boolean }
      can_housekeeping: { Args: { _user_id: string }; Returns: boolean }
      can_operate: { Args: { _user_id: string }; Returns: boolean }
      can_view_finance: { Args: { _user_id: string }; Returns: boolean }
      can_view_operations: { Args: { _user_id: string }; Returns: boolean }
      change_package_prices: {
        Args: {
          _package_id: string
          _reason: string
          _weekday_price: number
          _weekend_price: number
        }
        Returns: undefined
      }
      check_in_booking: { Args: { _transaction_id: string }; Returns: string }
      check_out_transaction: {
        Args: { _transaction_id: string }
        Returns: string
      }
      create_official_package: {
        Args: {
          _active: boolean
          _description: string
          _name: string
          _weekday_price: number
          _weekend_price: number
        }
        Returns: string
      }
      create_reservation: {
        Args: {
          _address: string
          _amount: number
          _day_mode: string
          _method: string
          _mode: string
          _name: string
          _package_id: string
          _phone: string
          _room_id: string
        }
        Returns: string
      }
      has_employee_position: {
        Args: {
          _positions: Database["public"]["Enums"]["employee_position"][]
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_receptionist: { Args: { _user_id: string }; Returns: boolean }
      override_room_ready: { Args: { _room_id: string }; Returns: undefined }
      update_package: {
        Args: {
          _active: boolean
          _description: string
          _duration_minutes: number
          _name: string
          _package_id: string
          _reason: string
          _weekday_price: number
          _weekend_price: number
        }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "owner" | "employee"
      employee_position:
        | "receptionist"
        | "housekeeping"
        | "supervisor"
        | "inspector"
        | "investor"
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
      employee_position: [
        "receptionist",
        "housekeeping",
        "supervisor",
        "inspector",
        "investor",
      ],
      room_status: ["ready", "occupied", "dirty", "cleaning"],
      transaction_status: ["booking", "check_in", "check_out", "cancelled"],
    },
  },
} as const

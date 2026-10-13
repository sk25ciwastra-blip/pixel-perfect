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
      housekeeping_history: {
        Row: {
          action: string
          created_at: string
          from_status: Database["public"]["Enums"]["room_status"]
          id: string
          job_number: string | null
          note: string
          performed_by: string
          performed_by_name: string
          room_id: string
          to_status: Database["public"]["Enums"]["room_status"]
          transaction_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          from_status: Database["public"]["Enums"]["room_status"]
          id?: string
          job_number?: string | null
          note?: string
          performed_by: string
          performed_by_name: string
          room_id: string
          to_status: Database["public"]["Enums"]["room_status"]
          transaction_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          from_status?: Database["public"]["Enums"]["room_status"]
          id?: string
          job_number?: string | null
          note?: string
          performed_by?: string
          performed_by_name?: string
          room_id?: string
          to_status?: Database["public"]["Enums"]["room_status"]
          transaction_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "housekeeping_history_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "housekeeping_history_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      housekeeping_checklists: {
        Row: {
          ashtray_ok: boolean
          ashtray_reason: string
          created_at: string
          exhaust_fan_ok: boolean
          exhaust_fan_reason: string
          fan_ok: boolean
          fan_reason: string
          housekeeping_history_id: string
          id: string
          issue_note: string
          mineral_water_ok: boolean
          mineral_water_reason: string
          performed_by: string
          performed_by_name: string
          result: string
          room_id: string
          towel_ok: boolean
          towel_reason: string
          transaction_id: string | null
          tissue_ok: boolean
          tissue_reason: string
          tv_remote_ok: boolean
          tv_remote_reason: string
        }
        Insert: {
          ashtray_ok: boolean
          ashtray_reason?: string
          created_at?: string
          exhaust_fan_ok: boolean
          exhaust_fan_reason?: string
          fan_ok: boolean
          fan_reason?: string
          housekeeping_history_id: string
          id?: string
          issue_note?: string
          mineral_water_ok: boolean
          mineral_water_reason?: string
          performed_by: string
          performed_by_name: string
          result: string
          room_id: string
          towel_ok: boolean
          towel_reason?: string
          transaction_id?: string | null
          tissue_ok: boolean
          tissue_reason?: string
          tv_remote_ok: boolean
          tv_remote_reason?: string
        }
        Update: {
          ashtray_ok?: boolean
          ashtray_reason?: string
          created_at?: string
          exhaust_fan_ok?: boolean
          exhaust_fan_reason?: string
          fan_ok?: boolean
          fan_reason?: string
          housekeeping_history_id?: string
          id?: string
          issue_note?: string
          mineral_water_ok?: boolean
          mineral_water_reason?: string
          performed_by?: string
          performed_by_name?: string
          result?: string
          room_id?: string
          towel_ok?: boolean
          towel_reason?: string
          transaction_id?: string | null
          tissue_ok?: boolean
          tissue_reason?: string
          tv_remote_ok?: boolean
          tv_remote_reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "housekeeping_checklists_housekeeping_history_id_fkey"
            columns: ["housekeeping_history_id"]
            isOneToOne: false
            referencedRelation: "housekeeping_history"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "housekeeping_checklists_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "housekeeping_checklists_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      housekeeping_maintenance: {
        Row: {
          created_at: string
          id: string
          location_code: string
          note: string
          operational_date: string
          performed_at: string
          performed_by: string
          performed_by_name: string
          recorded_by: string
          recorded_by_name: string
          room_id: string | null
          work_type: string
        }
        Insert: {
          created_at?: string
          id?: string
          location_code: string
          note?: string
          operational_date?: string
          performed_at?: string
          performed_by: string
          performed_by_name: string
          recorded_by: string
          recorded_by_name: string
          room_id?: string | null
          work_type: string
        }
        Update: {
          created_at?: string
          id?: string
          location_code?: string
          note?: string
          operational_date?: string
          performed_at?: string
          performed_by?: string
          performed_by_name?: string
          recorded_by?: string
          recorded_by_name?: string
          room_id?: string | null
          work_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "housekeeping_maintenance_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_bank_accounts: {
        Row: {
          id: string
          bank_name: string
          account_name: string
          account_number: string
          logo_key: string
          active: boolean
          created_by: string
          created_at: string
        }
        Insert: {
          id?: string
          bank_name: string
          account_name: string
          account_number: string
          logo_key?: string
          active?: boolean
          created_by: string
          created_at?: string
        }
        Update: {
          id?: string
          bank_name?: string
          account_name?: string
          account_number?: string
          logo_key?: string
          active?: boolean
          created_by?: string
          created_at?: string
        }
        Relationships: []
      }
      finance_cash_sessions: {
        Row: {
          id: string
          opened_by: string
          operational_date: string
          opened_at: string
          opening_cash: number
          opening_source_session_id: string | null
          status: string
          closed_at: string | null
          closed_by: string | null
          closing_reason: string
          closing_snapshot: unknown
          created_at: string
        }
        Insert: {
          id?: string
          opened_by: string
          operational_date?: string
          opened_at?: string
          opening_cash?: number
          opening_source_session_id?: string | null
          status?: string
          closed_at?: string | null
          closed_by?: string | null
          closing_reason?: string
          closing_snapshot?: unknown
          created_at?: string
        }
        Update: {
          id?: string
          opened_by?: string
          operational_date?: string
          opened_at?: string
          opening_cash?: number
          opening_source_session_id?: string | null
          status?: string
          closed_at?: string | null
          closed_by?: string | null
          closing_reason?: string
          closing_snapshot?: unknown
          created_at?: string
        }
        Relationships: []
      }
      finance_commission_configs: {
        Row: {
          id: string
          mode: string
          rate: number
          per_room_amount: number
          rounding_rule: string
          effective_from: string
          created_by: string
          created_at: string
        }
        Insert: {
          id?: string
          mode: string
          rate?: number
          per_room_amount?: number
          rounding_rule?: string
          effective_from?: string
          created_by: string
          created_at?: string
        }
        Update: {
          id?: string
          mode?: string
          rate?: number
          per_room_amount?: number
          rounding_rule?: string
          effective_from?: string
          created_by?: string
          created_at?: string
        }
        Relationships: []
      }
      finance_deposits: {
        Row: {
          id: string
          idempotency_key: string
          session_id: string
          method: string
          amount: number
          bank_account_id: string | null
          proof_ref: string
          status: string
          submitted_by: string
          confirmed_by: string | null
          confirmed_at: string | null
          decision_reason: string
          created_at: string
        }
        Insert: {
          id?: string
          idempotency_key: string
          session_id: string
          method: string
          amount: number
          bank_account_id?: string | null
          proof_ref?: string
          status?: string
          submitted_by: string
          confirmed_by?: string | null
          confirmed_at?: string | null
          decision_reason?: string
          created_at?: string
        }
        Update: {
          id?: string
          idempotency_key?: string
          session_id?: string
          method?: string
          amount?: number
          bank_account_id?: string | null
          proof_ref?: string
          status?: string
          submitted_by?: string
          confirmed_by?: string | null
          confirmed_at?: string | null
          decision_reason?: string
          created_at?: string
        }
        Relationships: []
      }
      finance_expenses: {
        Row: {
          id: string
          idempotency_key: string
          session_id: string
          amount: number
          method: string
          category: string
          note: string
          recorded_by: string
          created_at: string
        }
        Insert: {
          id?: string
          idempotency_key: string
          session_id: string
          amount: number
          method: string
          category: string
          note?: string
          recorded_by: string
          created_at?: string
        }
        Update: {
          id?: string
          idempotency_key?: string
          session_id?: string
          amount?: number
          method?: string
          category?: string
          note?: string
          recorded_by?: string
          created_at?: string
        }
        Relationships: []
      }
      finance_drawer_handoffs: {
        Row: {
          id: string
          allocation_id: string
          source_session_id: string
          recipient_user_id: string
          expected_amount: number
          actual_amount: number | null
          difference: number | null
          status: string
          reason: string
          created_by: string
          confirmed_by: string | null
          confirmed_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          allocation_id: string
          source_session_id: string
          recipient_user_id: string
          expected_amount: number
          actual_amount?: number | null
          difference?: number | null
          status?: string
          reason?: string
          created_by: string
          confirmed_by?: string | null
          confirmed_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          allocation_id?: string
          source_session_id?: string
          recipient_user_id?: string
          expected_amount?: number
          actual_amount?: number | null
          difference?: number | null
          status?: string
          reason?: string
          created_by?: string
          confirmed_by?: string | null
          confirmed_at?: string | null
          created_at?: string
        }
        Relationships: []
      }
      finance_refunds: {
        Row: {
          id: string
          idempotency_key: string
          transaction_id: string
          amount: number
          refund_method: string
          source_type: string
          source_session_id: string | null
          reason: string
          original_payment_total: number
          commission_adjustment: number
          created_by: string
          created_at: string
        }
        Insert: {
          id?: string
          idempotency_key: string
          transaction_id: string
          amount: number
          refund_method: string
          source_type: string
          source_session_id?: string | null
          reason: string
          original_payment_total: number
          commission_adjustment?: number
          created_by: string
          created_at?: string
        }
        Update: {
          id?: string
          idempotency_key?: string
          transaction_id?: string
          amount?: number
          refund_method?: string
          source_type?: string
          source_session_id?: string | null
          reason?: string
          original_payment_total?: number
          commission_adjustment?: number
          created_by?: string
          created_at?: string
        }
        Relationships: []
      }
      finance_session_allocations: {
        Row: {
          id: string
          session_id: string
          allocation_type: string
          method: string
          amount: number
          recipient_user_id: string | null
          created_by: string
          created_at: string
        }
        Insert: {
          id?: string
          session_id: string
          allocation_type: string
          method: string
          amount: number
          recipient_user_id?: string | null
          created_by: string
          created_at?: string
        }
        Update: {
          id?: string
          session_id?: string
          allocation_type?: string
          method?: string
          amount?: number
          recipient_user_id?: string | null
          created_by?: string
          created_at?: string
        }
        Relationships: []
      }
      finance_settings: {
        Row: {
          id: boolean
          minimum_dp_mode: string
          minimum_dp_value: number
          updated_by: string | null
          updated_at: string
        }
        Insert: {
          id?: boolean
          minimum_dp_mode?: string
          minimum_dp_value?: number
          updated_by?: string | null
          updated_at?: string
        }
        Update: {
          id?: boolean
          minimum_dp_mode?: string
          minimum_dp_value?: number
          updated_by?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      finance_charge_events: {
        Row: {
          id: string
          idempotency_key: string
          transaction_id: string
          kind: string
          amount: number
          processed_by: string
          commission_mode: string
          commission_rate: number
          commission_per_room_amount: number
          commission_rounding: string
          commission_recipient: string | null
          created_at: string
        }
        Insert: {
          id?: string
          idempotency_key: string
          transaction_id: string
          kind: string
          amount: number
          processed_by: string
          commission_mode: string
          commission_rate?: number
          commission_per_room_amount?: number
          commission_rounding?: string
          commission_recipient?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          idempotency_key?: string
          transaction_id?: string
          kind?: string
          amount?: number
          processed_by?: string
          commission_mode?: string
          commission_rate?: number
          commission_per_room_amount?: number
          commission_rounding?: string
          commission_recipient?: string | null
          created_at?: string
        }
        Relationships: []
      }
      finance_refund_allocations: {
        Row: {
          id: string
          refund_id: string
          payment_id: string
          refunded_amount: number
          original_commission: number
          adjusted_commission: number
          commission_delta: number
          created_at: string
        }
        Insert: {
          id?: string
          refund_id: string
          payment_id: string
          refunded_amount: number
          original_commission?: number
          adjusted_commission?: number
          commission_delta?: number
          created_at?: string
        }
        Update: {
          id?: string
          refund_id?: string
          payment_id?: string
          refunded_amount?: number
          original_commission?: number
          adjusted_commission?: number
          commission_delta?: number
          created_at?: string
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
          created_at: string
          description: string
          duration_minutes: number
          id: string
          name: string
          price: number
          weekday_price: number
          weekend_price: number
          time_mode: string | null
          slot_start_time: string | null
          checkin_start_time: string | null
          checkin_end_time: string | null
          checkout_time: string | null
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
          weekday_price: number
          weekend_price: number
          time_mode?: string | null
          slot_start_time?: string | null
          checkin_start_time?: string | null
          checkin_end_time?: string | null
          checkout_time?: string | null
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
          weekday_price?: number
          weekend_price?: number
          time_mode?: string | null
          slot_start_time?: string | null
          checkin_start_time?: string | null
          checkin_end_time?: string | null
          checkout_time?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      package_room_type_prices: {
        Row: {
          created_at: string
          id: string
          package_id: string
          pricing_group: string
          updated_at: string
          weekday_price: number
          weekend_price: number
        }
        Insert: {
          created_at?: string
          id?: string
          package_id: string
          pricing_group: string
          updated_at?: string
          weekday_price: number
          weekend_price: number
        }
        Update: {
          created_at?: string
          id?: string
          package_id?: string
          pricing_group?: string
          updated_at?: string
          weekday_price?: number
          weekend_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "package_room_type_prices_package_id_fkey"
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
          cash_session_id: string | null
          charge_event_id: string | null
          created_at: string
          id: string
          idempotency_key: string | null
          kind: string
          commission_amount: number | null
          commission_mode: string | null
          commission_per_room_amount: number | null
          commission_rate: number | null
          commission_recipient: string | null
          commission_rounding: string | null
          method: string
          recorded_by: string
          transaction_id: string
        }
        Insert: {
          amount: number
          cash_session_id?: string | null
          charge_event_id?: string | null
          created_at?: string
          id?: string
          idempotency_key?: string | null
          kind: string
          commission_amount?: number | null
          commission_mode?: string | null
          commission_per_room_amount?: number | null
          commission_rate?: number | null
          commission_recipient?: string | null
          commission_rounding?: string | null
          method: string
          recorded_by?: string
          transaction_id: string
        }
        Update: {
          amount?: number
          cash_session_id?: string | null
          charge_event_id?: string | null
          created_at?: string
          id?: string
          idempotency_key?: string | null
          kind?: string
          commission_amount?: number | null
          commission_mode?: string | null
          commission_per_room_amount?: number | null
          commission_rate?: number | null
          commission_recipient?: string | null
          commission_rounding?: string | null
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
          pricing_group: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string
          id?: string
          name: string
          pricing_group?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string
          id?: string
          name?: string
          pricing_group?: string | null
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
          commission_mode_snapshot: string | null
          commission_per_room_amount_snapshot: number | null
          commission_rate_snapshot: number | null
          commission_rounding_snapshot: string | null
          created_at: string
          created_by: string
          day_mode: string | null
          ends_at: string | null
          guest_id: string
          id: string
          minimum_dp_amount_snapshot: number | null
          minimum_dp_mode_snapshot: string | null
          minimum_dp_value_snapshot: number | null
          package_id: string | null
          price_snapshot: number | null
          room_id: string
          scheduled_check_in: string | null
          scheduled_check_out: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["transaction_status"]
          transaction_number: string
          updated_at: string
        }
        Insert: {
          checked_out_at?: string | null
          commission_mode_snapshot?: string | null
          commission_per_room_amount_snapshot?: number | null
          commission_rate_snapshot?: number | null
          commission_rounding_snapshot?: string | null
          created_at?: string
          created_by?: string
          day_mode?: string | null
          ends_at?: string | null
          guest_id: string
          id?: string
          minimum_dp_amount_snapshot?: number | null
          minimum_dp_mode_snapshot?: string | null
          minimum_dp_value_snapshot?: number | null
          package_id?: string | null
          price_snapshot?: number | null
          room_id: string
          scheduled_check_in?: string | null
          scheduled_check_out?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["transaction_status"]
          transaction_number?: string
          updated_at?: string
        }
        Update: {
          checked_out_at?: string | null
          commission_mode_snapshot?: string | null
          commission_per_room_amount_snapshot?: number | null
          commission_rate_snapshot?: number | null
          commission_rounding_snapshot?: string | null
          created_at?: string
          created_by?: string
          day_mode?: string | null
          ends_at?: string | null
          guest_id?: string
          id?: string
          minimum_dp_amount_snapshot?: number | null
          minimum_dp_mode_snapshot?: string | null
          minimum_dp_value_snapshot?: number | null
          package_id?: string | null
          price_snapshot?: number | null
          room_id?: string
          scheduled_check_in?: string | null
          scheduled_check_out?: string | null
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
      advance_room_cleaning: {
        Args: { _room_id: string; _note?: string }
        Returns: undefined
      }
      can_operate: { Args: { _user_id: string }; Returns: boolean }
      change_package_prices: {
        Args: {
          _package_id: string
          _weekday_price: number
          _weekend_price: number
          _reason: string
        }
        Returns: undefined
      }
      create_official_package: {
        Args: {
          _name: string
          _description: string
          _active: boolean
          _weekday_price: number
          _weekend_price: number
        }
        Returns: string
      }
      update_package: {
        Args: {
          _package_id: string
          _name: string
          _duration_minutes: number
          _description: string
          _active: boolean
          _weekday_price: number
          _weekend_price: number
          _reason: string
        }
        Returns: undefined
      }
      check_in_booking: {
        Args: { _transaction_id: string }
        Returns: string
      }
      calculate_scheduled_booking_times: {
        Args: {
          _package_id: string
          _scheduled_check_in: string
        }
        Returns: {
          scheduled_check_in: string
          scheduled_check_out: string
        }[]
      }
      check_out_transaction: {
        Args: { _transaction_id: string }
        Returns: string
      }
      get_operational_day_mode: {
        Args: { _calendar_date: string }
        Returns: string
      }
      override_room_ready: {
        Args: { _room_id: string; _note?: string }
        Returns: undefined
      }
      complete_housekeeping_checklist: {
        Args: {
          _ashtray_ok: boolean
          _checklist_id: string
          _exhaust_fan_ok: boolean
          _fan_ok: boolean
          _issue_note?: string
          _mineral_water_ok: boolean
          _room_id: string
          _tissue_ok: boolean
          _towel_ok: boolean
          _tv_remote_ok: boolean
        }
        Returns: string
      }
      record_housekeeping_maintenance: {
        Args: {
          _location_code: string
          _maintenance_id: string
          _note?: string
          _performed_by?: string | null
          _room_id?: string | null
          _work_type: string
        }
        Returns: string
      }
      record_transaction_payment: {
        Args: {
          _amount: number
          _idempotency_key: string
          _method: string
          _session_id?: string | null
          _transaction_id: string
        }
        Returns: string
      }
      open_finance_cash_session: {
        Args: { _opening_cash?: number }
        Returns: string
      }
      close_finance_cash_session: {
        Args: { _allocation: Json; _reason?: string; _session_id: string }
        Returns: Json
      }
      record_finance_expense: {
        Args: {
          _amount: number
          _category: string
          _idempotency_key: string
          _method: string
          _note?: string
          _session_id: string
        }
        Returns: string
      }
      create_finance_deposit: {
        Args: {
          _amount: number
          _bank_account_id?: string | null
          _idempotency_key: string
          _method: string
          _proof_ref?: string
          _session_id: string
        }
        Returns: string
      }
      decide_finance_deposit: {
        Args: { _deposit_id: string; _reason?: string; _status: string }
        Returns: undefined
      }
      confirm_finance_drawer_handover: {
        Args: { _actual_amount: number; _handoff_id: string; _reason?: string }
        Returns: undefined
      }
      set_finance_settings: {
        Args: { _minimum_dp_mode: string; _minimum_dp_value: number }
        Returns: undefined
      }
      set_finance_commission_config: {
        Args: { _mode: string; _per_room_amount: number; _rate: number }
        Returns: string
      }
      upsert_finance_bank_account: {
        Args: {
          _account_name: string
          _account_number: string
          _active: boolean
          _bank_name: string
          _id?: string | null
          _logo_key?: string
        }
        Returns: string
      }
      create_finance_refund: {
        Args: {
          _amount: number
          _idempotency_key: string
          _reason: string
          _refund_method: string
          _source_session_id?: string | null
          _source_type: string
          _transaction_id: string
        }
        Returns: string
      }
      get_finance_session_summary: {
        Args: { _session_id: string }
        Returns: Json
      }
      create_reservation: {
  Args: {
    _address: string
    _amount: number
    _day_mode: string
          _idempotency_key: string
    _method: string
    _mode: string
    _name: string
    _package_id: string
    _phone: string
    _room_id: string
    _scheduled_check_in?: string
          _session_id?: string | null
  }
  Returns: string
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
      employee_position: "receptionist" | "housekeeping" | "supervisor" | "inspector" | "investor"
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
      employee_position: ["receptionist", "housekeeping", "supervisor", "inspector", "investor"],
      room_status: ["ready", "occupied", "dirty", "cleaning"],
      transaction_status: ["booking", "check_in", "check_out", "cancelled"],
    },
  },
} as const

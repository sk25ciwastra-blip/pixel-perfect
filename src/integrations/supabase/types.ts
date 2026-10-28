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
    PostgrestVersion: "14.17"
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
      finance_bank_accounts: {
        Row: {
          account_name: string
          account_number: string
          active: boolean
          bank_name: string
          created_at: string
          created_by: string
          id: string
          logo_key: string
        }
        Insert: {
          account_name: string
          account_number: string
          active?: boolean
          bank_name: string
          created_at?: string
          created_by: string
          id?: string
          logo_key?: string
        }
        Update: {
          account_name?: string
          account_number?: string
          active?: boolean
          bank_name?: string
          created_at?: string
          created_by?: string
          id?: string
          logo_key?: string
        }
        Relationships: []
      }
      finance_cash_sessions: {
        Row: {
          closed_at: string | null
          closed_by: string | null
          closing_reason: string
          closing_snapshot: Json | null
          created_at: string
          id: string
          opened_at: string
          opened_by: string
          opening_cash: number
          opening_source_session_id: string | null
          operational_date: string
          status: string
        }
        Insert: {
          closed_at?: string | null
          closed_by?: string | null
          closing_reason?: string
          closing_snapshot?: Json | null
          created_at?: string
          id?: string
          opened_at?: string
          opened_by: string
          opening_cash?: number
          opening_source_session_id?: string | null
          operational_date?: string
          status?: string
        }
        Update: {
          closed_at?: string | null
          closed_by?: string | null
          closing_reason?: string
          closing_snapshot?: Json | null
          created_at?: string
          id?: string
          opened_at?: string
          opened_by?: string
          opening_cash?: number
          opening_source_session_id?: string | null
          operational_date?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "finance_cash_sessions_opening_source_session_id_fkey"
            columns: ["opening_source_session_id"]
            isOneToOne: false
            referencedRelation: "finance_cash_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_charge_events: {
        Row: {
          amount: number
          commission_mode: string
          commission_per_room_amount: number
          commission_rate: number
          commission_recipient: string | null
          commission_rounding: string
          created_at: string
          id: string
          idempotency_key: string
          kind: string
          processed_by: string
          transaction_id: string
        }
        Insert: {
          amount: number
          commission_mode: string
          commission_per_room_amount?: number
          commission_rate?: number
          commission_recipient?: string | null
          commission_rounding?: string
          created_at?: string
          id?: string
          idempotency_key: string
          kind: string
          processed_by: string
          transaction_id: string
        }
        Update: {
          amount?: number
          commission_mode?: string
          commission_per_room_amount?: number
          commission_rate?: number
          commission_recipient?: string | null
          commission_rounding?: string
          created_at?: string
          id?: string
          idempotency_key?: string
          kind?: string
          processed_by?: string
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "finance_charge_events_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_commission_configs: {
        Row: {
          created_at: string
          created_by: string
          effective_from: string
          id: string
          mode: string
          per_room_amount: number
          rate: number
          rounding_rule: string
        }
        Insert: {
          created_at?: string
          created_by: string
          effective_from?: string
          id?: string
          mode: string
          per_room_amount?: number
          rate?: number
          rounding_rule?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          effective_from?: string
          id?: string
          mode?: string
          per_room_amount?: number
          rate?: number
          rounding_rule?: string
        }
        Relationships: []
      }
      finance_deposits: {
        Row: {
          amount: number
          bank_account_id: string | null
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string
          decision_reason: string
          id: string
          idempotency_key: string
          method: string
          proof_ref: string
          session_id: string
          status: string
          submitted_by: string
        }
        Insert: {
          amount: number
          bank_account_id?: string | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          decision_reason?: string
          id?: string
          idempotency_key: string
          method: string
          proof_ref?: string
          session_id: string
          status?: string
          submitted_by: string
        }
        Update: {
          amount?: number
          bank_account_id?: string | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          decision_reason?: string
          id?: string
          idempotency_key?: string
          method?: string
          proof_ref?: string
          session_id?: string
          status?: string
          submitted_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "finance_deposits_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "finance_bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_deposits_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "finance_cash_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_drawer_handoffs: {
        Row: {
          actual_amount: number | null
          allocation_id: string
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string
          created_by: string
          difference: number | null
          expected_amount: number
          id: string
          reason: string
          recipient_user_id: string
          source_session_id: string
          status: string
        }
        Insert: {
          actual_amount?: number | null
          allocation_id: string
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          created_by: string
          difference?: number | null
          expected_amount: number
          id?: string
          reason?: string
          recipient_user_id: string
          source_session_id: string
          status?: string
        }
        Update: {
          actual_amount?: number | null
          allocation_id?: string
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          created_by?: string
          difference?: number | null
          expected_amount?: number
          id?: string
          reason?: string
          recipient_user_id?: string
          source_session_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "finance_drawer_handoffs_allocation_id_fkey"
            columns: ["allocation_id"]
            isOneToOne: true
            referencedRelation: "finance_session_allocations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_drawer_handoffs_source_session_id_fkey"
            columns: ["source_session_id"]
            isOneToOne: false
            referencedRelation: "finance_cash_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_expenses: {
        Row: {
          amount: number
          category: string
          created_at: string
          expense_number: string | null
          id: string
          idempotency_key: string
          method: string
          note: string
          recorded_by: string
          session_id: string
        }
        Insert: {
          amount: number
          category: string
          created_at?: string
          expense_number?: string | null
          id?: string
          idempotency_key: string
          method: string
          note?: string
          recorded_by: string
          session_id: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          expense_number?: string | null
          id?: string
          idempotency_key?: string
          method?: string
          note?: string
          recorded_by?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "finance_expenses_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "finance_cash_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_refund_allocations: {
        Row: {
          adjusted_commission: number
          commission_delta: number
          created_at: string
          id: string
          original_commission: number
          payment_id: string
          refund_id: string
          refunded_amount: number
        }
        Insert: {
          adjusted_commission?: number
          commission_delta?: number
          created_at?: string
          id?: string
          original_commission?: number
          payment_id: string
          refund_id: string
          refunded_amount: number
        }
        Update: {
          adjusted_commission?: number
          commission_delta?: number
          created_at?: string
          id?: string
          original_commission?: number
          payment_id?: string
          refund_id?: string
          refunded_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "finance_refund_allocations_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_refund_allocations_refund_id_fkey"
            columns: ["refund_id"]
            isOneToOne: false
            referencedRelation: "finance_refunds"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_refunds: {
        Row: {
          amount: number
          commission_adjustment: number
          created_at: string
          created_by: string
          id: string
          idempotency_key: string
          original_payment_total: number
          reason: string
          refund_method: string
          source_session_id: string | null
          source_type: string
          transaction_id: string
        }
        Insert: {
          amount: number
          commission_adjustment?: number
          created_at?: string
          created_by: string
          id?: string
          idempotency_key: string
          original_payment_total: number
          reason: string
          refund_method: string
          source_session_id?: string | null
          source_type: string
          transaction_id: string
        }
        Update: {
          amount?: number
          commission_adjustment?: number
          created_at?: string
          created_by?: string
          id?: string
          idempotency_key?: string
          original_payment_total?: number
          reason?: string
          refund_method?: string
          source_session_id?: string | null
          source_type?: string
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "finance_refunds_source_session_id_fkey"
            columns: ["source_session_id"]
            isOneToOne: false
            referencedRelation: "finance_cash_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_refunds_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_reservation_idempotency: {
        Row: {
          created_at: string
          created_by: string
          idempotency_key: string
          request_fingerprint: string
          transaction_id: string | null
          transaction_number: string | null
        }
        Insert: {
          created_at?: string
          created_by: string
          idempotency_key: string
          request_fingerprint: string
          transaction_id?: string | null
          transaction_number?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          idempotency_key?: string
          request_fingerprint?: string
          transaction_id?: string | null
          transaction_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "finance_reservation_idempotency_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_session_allocations: {
        Row: {
          allocation_type: string
          amount: number
          created_at: string
          created_by: string
          id: string
          method: string
          recipient_user_id: string | null
          session_id: string
        }
        Insert: {
          allocation_type: string
          amount: number
          created_at?: string
          created_by: string
          id?: string
          method: string
          recipient_user_id?: string | null
          session_id: string
        }
        Update: {
          allocation_type?: string
          amount?: number
          created_at?: string
          created_by?: string
          id?: string
          method?: string
          recipient_user_id?: string | null
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "finance_session_allocations_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "finance_cash_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_settings: {
        Row: {
          id: boolean
          minimum_dp_mode: string
          minimum_dp_value: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          id?: boolean
          minimum_dp_mode?: string
          minimum_dp_value?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          id?: boolean
          minimum_dp_mode?: string
          minimum_dp_value?: number
          updated_at?: string
          updated_by?: string | null
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
          tissue_ok: boolean
          tissue_reason: string
          towel_ok: boolean
          towel_reason: string
          transaction_id: string | null
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
          tissue_ok: boolean
          tissue_reason?: string
          towel_ok: boolean
          towel_reason?: string
          transaction_id?: string | null
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
          tissue_ok?: boolean
          tissue_reason?: string
          towel_ok?: boolean
          towel_reason?: string
          transaction_id?: string | null
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
      housekeeping_history: {
        Row: {
          action: string
          created_at: string
          from_status: Database["public"]["Enums"]["room_status"]
          id: string
          job_id: string | null
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
          job_id?: string | null
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
          job_id?: string | null
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
            foreignKeyName: "housekeeping_history_job_identity_fkey"
            columns: ["job_id", "job_number"]
            isOneToOne: false
            referencedRelation: "housekeeping_jobs"
            referencedColumns: ["id", "job_number"]
          },
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
      housekeeping_jobs: {
        Row: {
          created_at: string
          created_by: string
          created_by_name: string
          id: string
          job_number: string
          room_id: string
          transaction_id: string | null
        }
        Insert: {
          created_at?: string
          created_by: string
          created_by_name: string
          id?: string
          job_number?: string
          room_id: string
          transaction_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          created_by_name?: string
          id?: string
          job_number?: string
          room_id?: string
          transaction_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "housekeeping_jobs_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "housekeeping_jobs_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: true
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
      housekeeping_transaction_resolutions: {
        Row: {
          checkout_activity_log_id: string
          created_at: string
          evidence_ref: string
          id: string
          reason: string
          resolved_by: string
          room_id: string
          transaction_id: string
        }
        Insert: {
          checkout_activity_log_id: string
          created_at?: string
          evidence_ref: string
          id?: string
          reason: string
          resolved_by: string
          room_id: string
          transaction_id: string
        }
        Update: {
          checkout_activity_log_id?: string
          created_at?: string
          evidence_ref?: string
          id?: string
          reason?: string
          resolved_by?: string
          room_id?: string
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "housekeeping_transaction_resoluti_checkout_activity_log_id_fkey"
            columns: ["checkout_activity_log_id"]
            isOneToOne: false
            referencedRelation: "activity_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "housekeeping_transaction_resolutions_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "housekeeping_transaction_resolutions_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      operational_calendar: {
        Row: {
          calendar_date: string
          event_type: string | null
          holiday_name: string | null
          is_national_holiday: boolean
          override_reason: string | null
          owner_override: string | null
          source_name: string | null
          source_reference: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          calendar_date: string
          event_type?: string | null
          holiday_name?: string | null
          is_national_holiday?: boolean
          override_reason?: string | null
          owner_override?: string | null
          source_name?: string | null
          source_reference?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          calendar_date?: string
          event_type?: string | null
          holiday_name?: string | null
          is_national_holiday?: boolean
          override_reason?: string | null
          owner_override?: string | null
          source_name?: string | null
          source_reference?: string | null
          updated_at?: string
          updated_by?: string | null
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
          cash_session_id: string | null
          charge_event_id: string | null
          commission_amount: number | null
          commission_mode: string | null
          commission_per_room_amount: number | null
          commission_rate: number | null
          commission_recipient: string | null
          commission_rounding: string | null
          created_at: string
          id: string
          idempotency_key: string | null
          kind: string
          method: string
          recorded_by: string
          transaction_id: string
        }
        Insert: {
          amount: number
          cash_session_id?: string | null
          charge_event_id?: string | null
          commission_amount?: number | null
          commission_mode?: string | null
          commission_per_room_amount?: number | null
          commission_rate?: number | null
          commission_recipient?: string | null
          commission_rounding?: string | null
          created_at?: string
          id?: string
          idempotency_key?: string | null
          kind: string
          method: string
          recorded_by?: string
          transaction_id: string
        }
        Update: {
          amount?: number
          cash_session_id?: string | null
          charge_event_id?: string | null
          commission_amount?: number | null
          commission_mode?: string | null
          commission_per_room_amount?: number | null
          commission_rate?: number | null
          commission_recipient?: string | null
          commission_rounding?: string | null
          created_at?: string
          id?: string
          idempotency_key?: string | null
          kind?: string
          method?: string
          recorded_by?: string
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_cash_session_id_fkey"
            columns: ["cash_session_id"]
            isOneToOne: false
            referencedRelation: "finance_cash_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_charge_event_id_fkey"
            columns: ["charge_event_id"]
            isOneToOne: false
            referencedRelation: "finance_charge_events"
            referencedColumns: ["id"]
          },
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
          base_price_snapshot: number | null
          checked_out_at: string | null
          commission_mode_snapshot: string | null
          commission_per_room_amount_snapshot: number | null
          commission_rate_snapshot: number | null
          commission_rounding_snapshot: string | null
          created_at: string
          created_by: string
          day_mode: string | null
          ends_at: string | null
          extra_guest_charge: number
          extra_guest_count: number
          extra_guest_unit_price: number
          guest_count: number
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
          base_price_snapshot?: number | null
          checked_out_at?: string | null
          commission_mode_snapshot?: string | null
          commission_per_room_amount_snapshot?: number | null
          commission_rate_snapshot?: number | null
          commission_rounding_snapshot?: string | null
          created_at?: string
          created_by?: string
          day_mode?: string | null
          ends_at?: string | null
          extra_guest_charge?: number
          extra_guest_count?: number
          extra_guest_unit_price?: number
          guest_count?: number
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
          transaction_number: string
          updated_at?: string
        }
        Update: {
          base_price_snapshot?: number | null
          checked_out_at?: string | null
          commission_mode_snapshot?: string | null
          commission_per_room_amount_snapshot?: number | null
          commission_rate_snapshot?: number | null
          commission_rounding_snapshot?: string | null
          created_at?: string
          created_by?: string
          day_mode?: string | null
          ends_at?: string | null
          extra_guest_charge?: number
          extra_guest_count?: number
          extra_guest_unit_price?: number
          guest_count?: number
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
      receipt_template_versions: {
        Row: {
          id: string
          template_kind: string
          version: number
          preset: string
          language: string
          paper_width_mm: number
          blocks: Json
          header_config: Json
          footer_config: Json
          status: string
          created_by: string | null
          created_at: string
          published_at: string | null
        }
        Insert: {
          id?: string
          template_kind: string
          version: number
          preset: string
          language?: string
          paper_width_mm?: number
          blocks: Json
          header_config?: Json
          footer_config?: Json
          status?: string
          created_by?: string | null
          created_at?: string
          published_at?: string | null
        }
        Update: {
          id?: string
          template_kind?: string
          version?: number
          preset?: string
          language?: string
          paper_width_mm?: number
          blocks?: Json
          header_config?: Json
          footer_config?: Json
          status?: string
          created_by?: string | null
          created_at?: string
          published_at?: string | null
        }
        Relationships: []
      }
      payment_receipts: {
        Row: {
          id: string
          payment_id: string
          transaction_id: string
          receipt_kind: string
          template_version_id: string | null
          template_snapshot: Json
          receipt_snapshot: Json
          payment_amount: number
          total_paid_at_issue: number
          outstanding_at_issue: number
          payment_status_at_issue: string
          served_by: string
          issued_at: string
          schema_version: number
          snapshot_hash: string | null
        }
        Insert: {
          id?: string
          payment_id: string
          transaction_id: string
          receipt_kind: string
          template_version_id?: string | null
          template_snapshot: Json
          receipt_snapshot: Json
          payment_amount: number
          total_paid_at_issue: number
          outstanding_at_issue: number
          payment_status_at_issue: string
          served_by: string
          issued_at?: string
          schema_version?: number
          snapshot_hash?: string | null
        }
        Update: {
          id?: string
          payment_id?: string
          transaction_id?: string
          receipt_kind?: string
          template_version_id?: string | null
          template_snapshot?: Json
          receipt_snapshot?: Json
          payment_amount?: number
          total_paid_at_issue?: number
          outstanding_at_issue?: number
          payment_status_at_issue?: string
          served_by?: string
          issued_at?: string
          schema_version?: number
          snapshot_hash?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_receipts_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: true
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_receipts_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_receipts_template_version_id_fkey"
            columns: ["template_version_id"]
            isOneToOne: false
            referencedRelation: "receipt_template_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      receipt_print_requests: {
        Row: {
          id: string
          receipt_id: string
          print_no: number
          copy_label: string
          requested_by: string
          requested_at: string
          status: string
          idempotency_key: string
          printer_target: string | null
          physical_confirmed_at: string | null
          error_code: string | null
          error_message: string | null
        }
        Insert: {
          id?: string
          receipt_id: string
          print_no: number
          copy_label?: string
          requested_by: string
          requested_at?: string
          status?: string
          idempotency_key: string
          printer_target?: string | null
          physical_confirmed_at?: string | null
          error_code?: string | null
          error_message?: string | null
        }
        Update: {
          id?: string
          receipt_id?: string
          print_no?: number
          copy_label?: string
          requested_by?: string
          requested_at?: string
          status?: string
          idempotency_key?: string
          printer_target?: string | null
          physical_confirmed_at?: string | null
          error_code?: string | null
          error_message?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "receipt_print_requests_receipt_id_fkey"
            columns: ["receipt_id"]
            isOneToOne: false
            referencedRelation: "payment_receipts"
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
      advance_room_cleaning:
        | { Args: { _room_id: string }; Returns: undefined }
        | { Args: { _note: string; _room_id: string }; Returns: undefined }
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
      calculate_scheduled_booking_times: {
        Args: { _package_id: string; _scheduled_check_in: string }
        Returns: {
          scheduled_check_in: string
          scheduled_check_out: string
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
      close_finance_cash_session: {
        Args: { _allocation: Json; _reason?: string; _session_id: string }
        Returns: Json
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
      confirm_finance_drawer_handover: {
        Args: { _actual_amount: number; _handoff_id: string; _reason?: string }
        Returns: undefined
      }
      create_finance_deposit: {
        Args: {
          _amount: number
          _bank_account_id?: string
          _idempotency_key: string
          _method: string
          _proof_ref?: string
          _session_id: string
        }
        Returns: string
      }
      create_finance_refund: {
        Args: {
          _amount: number
          _idempotency_key: string
          _reason: string
          _refund_method: string
          _source_session_id: string
          _source_type: string
          _transaction_id: string
        }
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
      create_reservation:
        | {
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
              _scheduled_check_in: string
            }
            Returns: string
          }
        | {
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
              _scheduled_check_in: string
              _session_id: string
              _guest_count: number
            }
            Returns: string
          }
      create_training_reservation: {
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
          _session_id: string
          _guest_count: number
        }
        Returns: string
      }
        | {
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
              _scheduled_check_in: string
              _session_id: string
            }
            Returns: string
          }
      decide_finance_deposit: {
        Args: { _deposit_id: string; _reason?: string; _status: string }
        Returns: undefined
      }
      finance_commission_at: {
        Args: { _at: string }
        Returns: {
          mode: string
          per_room_amount: number
          rate: number
          rounding_rule: string
        }[]
      }
      finance_is_booking_operator: {
        Args: { _user_id: string }
        Returns: boolean
      }
      finance_is_owner_or_supervisor: {
        Args: { _user_id: string }
        Returns: boolean
      }
      get_finance_session_summary: {
        Args: { _session_id: string }
        Returns: Json
      }
      get_operational_day_mode: {
        Args: { _calendar_date: string }
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
      issue_payment_receipt: {
        Args: { _payment_id: string }
        Returns: string
      }
      next_expense_number: { Args: never; Returns: string }
      next_housekeeping_number: { Args: never; Returns: string }
      next_transaction_number: { Args: never; Returns: string }
      open_finance_cash_session: {
        Args: { _opening_cash?: number }
        Returns: string
      }
      override_room_ready:
        | { Args: { _room_id: string }; Returns: undefined }
        | { Args: { _note: string; _room_id: string }; Returns: undefined }
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
      record_housekeeping_maintenance: {
        Args: {
          _location_code: string
          _maintenance_id: string
          _note?: string
          _performed_by?: string
          _room_id: string
          _work_type: string
        }
        Returns: string
      }
      record_housekeeping_transaction_resolution: {
        Args: {
          _checkout_activity_log_id: string
          _evidence_ref: string
          _reason: string
          _room_id: string
          _transaction_id: string
        }
        Returns: string
      }
      record_transaction_payment:
        | {
            Args: { _amount: number; _method: string; _transaction_id: string }
            Returns: string
          }
      record_receipt_print_result: {
        Args: {
          _error_code?: string
          _error_message?: string
          _physical_confirmed?: boolean
          _print_request_id: string
          _status: string
        }
        Returns: undefined
      }
      request_receipt_print: {
        Args: { _idempotency_key: string; _receipt_id: string }
        Returns: Json
      }
        | {
            Args: {
              _amount: number
              _idempotency_key: string
              _method: string
              _transaction_id: string
            }
            Returns: string
          }
        | {
            Args: {
              _amount: number
              _idempotency_key: string
              _method: string
              _session_id: string
              _transaction_id: string
            }
            Returns: string
          }
      resolve_housekeeping_transaction: {
        Args: { _room_id: string }
        Returns: string
      }
      set_finance_commission_config: {
        Args: { _mode: string; _per_room_amount: number; _rate: number }
        Returns: string
      }
      set_finance_settings: {
        Args: { _minimum_dp_mode: string; _minimum_dp_value: number }
        Returns: undefined
      }
      save_receipt_template_version: {
        Args: {
          _blocks: Json
          _footer_config: Json
          _header_config: Json
          _preset: string
          _template_kind: string
        }
        Returns: string
      }
      activate_receipt_template_version: {
        Args: { _template_id: string }
        Returns: undefined
      }
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
      upsert_finance_bank_account: {
        Args: {
          _account_name: string
          _account_number: string
          _active: boolean
          _bank_name: string
          _id: string
          _logo_key: string
        }
        Returns: string
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

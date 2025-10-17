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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      categories: {
        Row: {
          created_at: string | null
          id: string
          name: string
          store_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          store_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          store_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "categories_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          created_at: string
          customer_email: string | null
          customer_name: string
          customer_phone: string
          delivery_address: string
          delivery_charge: number
          delivery_landmark: string | null
          delivery_latitude: number | null
          delivery_longitude: number | null
          delivery_pincode: string | null
          delivery_time: string | null
          id: string
          items: Json
          notes: string | null
          order_number: string
          payment_method: string
          status: string
          store_id: string
          subtotal: number
          total: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_email?: string | null
          customer_name: string
          customer_phone: string
          delivery_address: string
          delivery_charge?: number
          delivery_landmark?: string | null
          delivery_latitude?: number | null
          delivery_longitude?: number | null
          delivery_pincode?: string | null
          delivery_time?: string | null
          id?: string
          items?: Json
          notes?: string | null
          order_number: string
          payment_method?: string
          status?: string
          store_id: string
          subtotal?: number
          total?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_email?: string | null
          customer_name?: string
          customer_phone?: string
          delivery_address?: string
          delivery_charge?: number
          delivery_landmark?: string | null
          delivery_latitude?: number | null
          delivery_longitude?: number | null
          delivery_pincode?: string | null
          delivery_time?: string | null
          id?: string
          items?: Json
          notes?: string | null
          order_number?: string
          payment_method?: string
          status?: string
          store_id?: string
          subtotal?: number
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      stores: {
        Row: {
          created_at: string
          custom_domain: string | null
          description: string | null
          google_access_token: string | null
          google_refresh_token: string | null
          google_sheet_connected: boolean | null
          google_sheet_id: string | null
          google_sheet_url: string | null
          google_token_expiry: string | null
          hero_banner_url: string | null
          id: string
          is_active: boolean | null
          last_admin_visit: string | null
          last_sheet_sync: string | null
          logo_url: string | null
          name: string
          slug: string
          social_links: Json | null
          updated_at: string
          user_id: string
          whatsapp_number: string | null
        }
        Insert: {
          created_at?: string
          custom_domain?: string | null
          description?: string | null
          google_access_token?: string | null
          google_refresh_token?: string | null
          google_sheet_connected?: boolean | null
          google_sheet_id?: string | null
          google_sheet_url?: string | null
          google_token_expiry?: string | null
          hero_banner_url?: string | null
          id?: string
          is_active?: boolean | null
          last_admin_visit?: string | null
          last_sheet_sync?: string | null
          logo_url?: string | null
          name: string
          slug: string
          social_links?: Json | null
          updated_at?: string
          user_id: string
          whatsapp_number?: string | null
        }
        Update: {
          created_at?: string
          custom_domain?: string | null
          description?: string | null
          google_access_token?: string | null
          google_refresh_token?: string | null
          google_sheet_connected?: boolean | null
          google_sheet_id?: string | null
          google_sheet_url?: string | null
          google_token_expiry?: string | null
          hero_banner_url?: string | null
          id?: string
          is_active?: boolean | null
          last_admin_visit?: string | null
          last_sheet_sync?: string | null
          logo_url?: string | null
          name?: string
          slug?: string
          social_links?: Json | null
          updated_at?: string
          user_id?: string
          whatsapp_number?: string | null
        }
        Relationships: []
      }
      subscription_plans: {
        Row: {
          badge_color: string | null
          badge_text: string | null
          created_at: string
          description: string | null
          display_order: number | null
          enable_analytics: boolean | null
          enable_location_sharing: boolean | null
          features: Json | null
          id: string
          is_active: boolean | null
          is_popular: boolean | null
          max_products: number | null
          monthly_price: number
          name: string
          slug: string
          trial_days: number | null
          updated_at: string
          yearly_price: number | null
        }
        Insert: {
          badge_color?: string | null
          badge_text?: string | null
          created_at?: string
          description?: string | null
          display_order?: number | null
          enable_analytics?: boolean | null
          enable_location_sharing?: boolean | null
          features?: Json | null
          id?: string
          is_active?: boolean | null
          is_popular?: boolean | null
          max_products?: number | null
          monthly_price?: number
          name: string
          slug: string
          trial_days?: number | null
          updated_at?: string
          yearly_price?: number | null
        }
        Update: {
          badge_color?: string | null
          badge_text?: string | null
          created_at?: string
          description?: string | null
          display_order?: number | null
          enable_analytics?: boolean | null
          enable_location_sharing?: boolean | null
          features?: Json | null
          id?: string
          is_active?: boolean | null
          is_popular?: boolean | null
          max_products?: number | null
          monthly_price?: number
          name?: string
          slug?: string
          trial_days?: number | null
          updated_at?: string
          yearly_price?: number | null
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          billing_cycle: string
          cancelled_at: string | null
          created_at: string
          id: string
          next_billing_at: string | null
          payment_gateway: string | null
          plan_id: string
          started_at: string
          status: string
          trial_ends_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          billing_cycle?: string
          cancelled_at?: string | null
          created_at?: string
          id?: string
          next_billing_at?: string | null
          payment_gateway?: string | null
          plan_id: string
          started_at?: string
          status?: string
          trial_ends_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          billing_cycle?: string
          cancelled_at?: string | null
          created_at?: string
          id?: string
          next_billing_at?: string | null
          payment_gateway?: string | null
          plan_id?: string
          started_at?: string
          status?: string
          trial_ends_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      super_admins: {
        Row: {
          created_at: string
          email: string
          full_name: string
          id: string
          last_login_at: string | null
          password_hash: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name: string
          id?: string
          last_login_at?: string | null
          password_hash: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          last_login_at?: string | null
          password_hash?: string
          updated_at?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount: number
          created_at: string
          gst_amount: number | null
          id: string
          invoice_number: string | null
          payment_gateway: string
          payment_id: string | null
          payment_method: string | null
          refund_amount: number | null
          refund_reason: string | null
          refunded_at: string | null
          status: string
          subscription_id: string | null
          total_amount: number
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          gst_amount?: number | null
          id?: string
          invoice_number?: string | null
          payment_gateway: string
          payment_id?: string | null
          payment_method?: string | null
          refund_amount?: number | null
          refund_reason?: string | null
          refunded_at?: string | null
          status?: string
          subscription_id?: string | null
          total_amount: number
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          gst_amount?: number | null
          id?: string
          invoice_number?: string | null
          payment_gateway?: string
          payment_id?: string | null
          payment_method?: string | null
          refund_amount?: number | null
          refund_reason?: string | null
          refunded_at?: string | null
          status?: string
          subscription_id?: string | null
          total_amount?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
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

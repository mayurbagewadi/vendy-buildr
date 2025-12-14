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
          image_url: string | null
          name: string
          store_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          image_url?: string | null
          name: string
          store_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          image_url?: string | null
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
      helper_applications: {
        Row: {
          application_status: string
          approved_at: string | null
          approved_by_admin: string | null
          bank_account_name: string
          bank_account_number: string
          bank_ifsc_code: string
          bank_name: string
          created_at: string
          email: string
          full_name: string
          id: string
          phone: string
          recruited_by_helper_id: string | null
          rejection_reason: string | null
          user_id: string | null
          why_helper: string
        }
        Insert: {
          application_status?: string
          approved_at?: string | null
          approved_by_admin?: string | null
          bank_account_name: string
          bank_account_number: string
          bank_ifsc_code: string
          bank_name: string
          created_at?: string
          email: string
          full_name: string
          id?: string
          phone: string
          recruited_by_helper_id?: string | null
          rejection_reason?: string | null
          user_id?: string | null
          why_helper: string
        }
        Update: {
          application_status?: string
          approved_at?: string | null
          approved_by_admin?: string | null
          bank_account_name?: string
          bank_account_number?: string
          bank_ifsc_code?: string
          bank_name?: string
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          phone?: string
          recruited_by_helper_id?: string | null
          rejection_reason?: string | null
          user_id?: string | null
          why_helper?: string
        }
        Relationships: []
      }
      helpers: {
        Row: {
          application_id: string | null
          created_at: string
          direct_commission_rate: number | null
          email: string
          full_name: string
          helper_recruitment_link: string
          id: string
          network_commission_rate: number | null
          phone: string
          recruited_by_helper_id: string | null
          referral_code: string
          status: string
          store_referral_link: string
        }
        Insert: {
          application_id?: string | null
          created_at?: string
          direct_commission_rate?: number | null
          email: string
          full_name: string
          helper_recruitment_link: string
          id?: string
          network_commission_rate?: number | null
          phone: string
          recruited_by_helper_id?: string | null
          referral_code: string
          status?: string
          store_referral_link: string
        }
        Update: {
          application_id?: string | null
          created_at?: string
          direct_commission_rate?: number | null
          email?: string
          full_name?: string
          helper_recruitment_link?: string
          id?: string
          network_commission_rate?: number | null
          phone?: string
          recruited_by_helper_id?: string | null
          referral_code?: string
          status?: string
          store_referral_link?: string
        }
        Relationships: [
          {
            foreignKeyName: "helpers_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "helper_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "helpers_recruited_by_helper_id_fkey"
            columns: ["recruited_by_helper_id"]
            isOneToOne: false
            referencedRelation: "helpers"
            referencedColumns: ["id"]
          },
        ]
      }
      network_commissions: {
        Row: {
          commission_status: string | null
          created_at: string
          direct_commission_amount: number
          earning_helper_id: string
          id: string
          network_commission_amount: number
          payment_date: string | null
          payment_reference: string | null
          recruiting_helper_id: string
          store_referral_id: string
        }
        Insert: {
          commission_status?: string | null
          created_at?: string
          direct_commission_amount: number
          earning_helper_id: string
          id?: string
          network_commission_amount: number
          payment_date?: string | null
          payment_reference?: string | null
          recruiting_helper_id: string
          store_referral_id: string
        }
        Update: {
          commission_status?: string | null
          created_at?: string
          direct_commission_amount?: number
          earning_helper_id?: string
          id?: string
          network_commission_amount?: number
          payment_date?: string | null
          payment_reference?: string | null
          recruiting_helper_id?: string
          store_referral_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "network_commissions_earning_helper_id_fkey"
            columns: ["earning_helper_id"]
            isOneToOne: false
            referencedRelation: "helpers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "network_commissions_recruiting_helper_id_fkey"
            columns: ["recruiting_helper_id"]
            isOneToOne: false
            referencedRelation: "helpers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "network_commissions_store_referral_id_fkey"
            columns: ["store_referral_id"]
            isOneToOne: false
            referencedRelation: "store_referrals"
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
      platform_settings: {
        Row: {
          active_logs_cleanup_months: number | null
          auto_cleanup_active_logs: boolean | null
          auto_cleanup_inactive_logs: boolean | null
          auto_cleanup_orders: boolean | null
          created_at: string
          id: string
          inactive_logs_cleanup_months: number | null
          orders_cleanup_months: number | null
          platform_name: string | null
          razorpay_key_id: string | null
          razorpay_key_secret: string | null
          razorpay_test_mode: boolean | null
          sender_email: string | null
          sender_name: string | null
          updated_at: string
        }
        Insert: {
          active_logs_cleanup_months?: number | null
          auto_cleanup_active_logs?: boolean | null
          auto_cleanup_inactive_logs?: boolean | null
          auto_cleanup_orders?: boolean | null
          created_at?: string
          id?: string
          inactive_logs_cleanup_months?: number | null
          orders_cleanup_months?: number | null
          platform_name?: string | null
          razorpay_key_id?: string | null
          razorpay_key_secret?: string | null
          razorpay_test_mode?: boolean | null
          sender_email?: string | null
          sender_name?: string | null
          updated_at?: string
        }
        Update: {
          active_logs_cleanup_months?: number | null
          auto_cleanup_active_logs?: boolean | null
          auto_cleanup_inactive_logs?: boolean | null
          auto_cleanup_orders?: boolean | null
          created_at?: string
          id?: string
          inactive_logs_cleanup_months?: number | null
          orders_cleanup_months?: number | null
          platform_name?: string | null
          razorpay_key_id?: string | null
          razorpay_key_secret?: string | null
          razorpay_test_mode?: boolean | null
          sender_email?: string | null
          sender_name?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          base_price: number | null
          category: string | null
          created_at: string
          description: string | null
          id: string
          images: Json | null
          instagram_video_url: string | null
          name: string
          price_range: string | null
          sku: string | null
          slug: string | null
          status: string
          stock: number | null
          store_id: string
          updated_at: string
          variants: Json | null
          video_url: string | null
        }
        Insert: {
          base_price?: number | null
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          images?: Json | null
          instagram_video_url?: string | null
          name: string
          price_range?: string | null
          sku?: string | null
          slug?: string | null
          status?: string
          stock?: number | null
          store_id: string
          updated_at?: string
          variants?: Json | null
          video_url?: string | null
        }
        Update: {
          base_price?: number | null
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          images?: Json | null
          instagram_video_url?: string | null
          name?: string
          price_range?: string | null
          sku?: string | null
          slug?: string | null
          status?: string
          stock?: number | null
          store_id?: string
          updated_at?: string
          variants?: Json | null
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_store_id_fkey"
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
      reserved_subdomains: {
        Row: {
          subdomain: string
        }
        Insert: {
          subdomain: string
        }
        Update: {
          subdomain?: string
        }
        Relationships: []
      }
      sitemap_submissions: {
        Row: {
          created_at: string | null
          domain: string
          error_message: string | null
          id: string
          sitemap_url: string
          status: string | null
          store_id: string | null
          submitted_at: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          domain: string
          error_message?: string | null
          id?: string
          sitemap_url: string
          status?: string | null
          store_id?: string | null
          submitted_at?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          domain?: string
          error_message?: string | null
          id?: string
          sitemap_url?: string
          status?: string | null
          store_id?: string | null
          submitted_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sitemap_submissions_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_activity_logs: {
        Row: {
          created_at: string
          id: string
          last_admin_visit: string | null
          last_order_date: string | null
          reason: string
          status: string
          store_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_admin_visit?: string | null
          last_order_date?: string | null
          reason: string
          status: string
          store_id: string
        }
        Update: {
          created_at?: string
          id?: string
          last_admin_visit?: string | null
          last_order_date?: string | null
          reason?: string
          status?: string
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_activity_logs_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_referrals: {
        Row: {
          commission_amount: number | null
          commission_status: string | null
          helper_id: string
          id: string
          payment_date: string | null
          payment_reference: string | null
          purchase_date: string | null
          signup_date: string
          store_owner_email: string
          store_owner_name: string
          store_owner_phone: string
          subscription_amount: number | null
          subscription_plan: string | null
          subscription_purchased: boolean | null
          trial_end_date: string | null
          trial_start_date: string | null
          trial_status: string | null
        }
        Insert: {
          commission_amount?: number | null
          commission_status?: string | null
          helper_id: string
          id?: string
          payment_date?: string | null
          payment_reference?: string | null
          purchase_date?: string | null
          signup_date?: string
          store_owner_email: string
          store_owner_name: string
          store_owner_phone: string
          subscription_amount?: number | null
          subscription_plan?: string | null
          subscription_purchased?: boolean | null
          trial_end_date?: string | null
          trial_start_date?: string | null
          trial_status?: string | null
        }
        Update: {
          commission_amount?: number | null
          commission_status?: string | null
          helper_id?: string
          id?: string
          payment_date?: string | null
          payment_reference?: string | null
          purchase_date?: string | null
          signup_date?: string
          store_owner_email?: string
          store_owner_name?: string
          store_owner_phone?: string
          subscription_amount?: number | null
          subscription_plan?: string | null
          subscription_purchased?: boolean | null
          trial_end_date?: string | null
          trial_start_date?: string | null
          trial_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "store_referrals_helper_id_fkey"
            columns: ["helper_id"]
            isOneToOne: false
            referencedRelation: "helpers"
            referencedColumns: ["id"]
          },
        ]
      }
      stores: {
        Row: {
          address: string | null
          ai_voice_embed_code: string | null
          created_at: string
          custom_domain: string | null
          custom_domain_verification_token: string | null
          custom_domain_verified: boolean | null
          description: string | null
          force_location_sharing: boolean | null
          google_access_token: string | null
          google_refresh_token: string | null
          google_sheet_connected: boolean | null
          google_sheet_id: string | null
          google_sheet_url: string | null
          google_token_expiry: string | null
          hero_banner_url: string | null
          hero_banner_urls: string[] | null
          id: string
          is_active: boolean | null
          last_admin_visit: string | null
          last_sheet_sync: string | null
          logo_url: string | null
          name: string
          policies: Json | null
          slug: string
          social_links: Json | null
          subdomain: string | null
          updated_at: string
          user_id: string
          whatsapp_number: string | null
        }
        Insert: {
          address?: string | null
          ai_voice_embed_code?: string | null
          created_at?: string
          custom_domain?: string | null
          custom_domain_verification_token?: string | null
          custom_domain_verified?: boolean | null
          description?: string | null
          force_location_sharing?: boolean | null
          google_access_token?: string | null
          google_refresh_token?: string | null
          google_sheet_connected?: boolean | null
          google_sheet_id?: string | null
          google_sheet_url?: string | null
          google_token_expiry?: string | null
          hero_banner_url?: string | null
          hero_banner_urls?: string[] | null
          id?: string
          is_active?: boolean | null
          last_admin_visit?: string | null
          last_sheet_sync?: string | null
          logo_url?: string | null
          name: string
          policies?: Json | null
          slug: string
          social_links?: Json | null
          subdomain?: string | null
          updated_at?: string
          user_id: string
          whatsapp_number?: string | null
        }
        Update: {
          address?: string | null
          ai_voice_embed_code?: string | null
          created_at?: string
          custom_domain?: string | null
          custom_domain_verification_token?: string | null
          custom_domain_verified?: boolean | null
          description?: string | null
          force_location_sharing?: boolean | null
          google_access_token?: string | null
          google_refresh_token?: string | null
          google_sheet_connected?: boolean | null
          google_sheet_id?: string | null
          google_sheet_url?: string | null
          google_token_expiry?: string | null
          hero_banner_url?: string | null
          hero_banner_urls?: string[] | null
          id?: string
          is_active?: boolean | null
          last_admin_visit?: string | null
          last_sheet_sync?: string | null
          logo_url?: string | null
          name?: string
          policies?: Json | null
          slug?: string
          social_links?: Json | null
          subdomain?: string | null
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
          enable_ai_voice: boolean | null
          enable_analytics: boolean | null
          enable_custom_domain: boolean | null
          enable_location_sharing: boolean | null
          enable_order_emails: boolean | null
          features: Json | null
          id: string
          is_active: boolean | null
          is_default_plan: boolean | null
          is_popular: boolean | null
          max_products: number | null
          monthly_price: number
          name: string
          orders_view_limit: number | null
          slug: string
          trial_days: number | null
          updated_at: string
          website_orders_limit: number | null
          whatsapp_orders_limit: number | null
          yearly_price: number | null
        }
        Insert: {
          badge_color?: string | null
          badge_text?: string | null
          created_at?: string
          description?: string | null
          display_order?: number | null
          enable_ai_voice?: boolean | null
          enable_analytics?: boolean | null
          enable_custom_domain?: boolean | null
          enable_location_sharing?: boolean | null
          enable_order_emails?: boolean | null
          features?: Json | null
          id?: string
          is_active?: boolean | null
          is_default_plan?: boolean | null
          is_popular?: boolean | null
          max_products?: number | null
          monthly_price?: number
          name: string
          orders_view_limit?: number | null
          slug: string
          trial_days?: number | null
          updated_at?: string
          website_orders_limit?: number | null
          whatsapp_orders_limit?: number | null
          yearly_price?: number | null
        }
        Update: {
          badge_color?: string | null
          badge_text?: string | null
          created_at?: string
          description?: string | null
          display_order?: number | null
          enable_ai_voice?: boolean | null
          enable_analytics?: boolean | null
          enable_custom_domain?: boolean | null
          enable_location_sharing?: boolean | null
          enable_order_emails?: boolean | null
          features?: Json | null
          id?: string
          is_active?: boolean | null
          is_default_plan?: boolean | null
          is_popular?: boolean | null
          max_products?: number | null
          monthly_price?: number
          name?: string
          orders_view_limit?: number | null
          slug?: string
          trial_days?: number | null
          updated_at?: string
          website_orders_limit?: number | null
          whatsapp_orders_limit?: number | null
          yearly_price?: number | null
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          billing_cycle: string
          cancelled_at: string | null
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          id: string
          next_billing_at: string | null
          payment_gateway: string | null
          plan_id: string
          started_at: string
          status: string
          trial_ends_at: string | null
          updated_at: string
          user_id: string
          website_orders_used: number | null
          whatsapp_orders_used: number | null
        }
        Insert: {
          billing_cycle?: string
          cancelled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          next_billing_at?: string | null
          payment_gateway?: string | null
          plan_id: string
          started_at?: string
          status?: string
          trial_ends_at?: string | null
          updated_at?: string
          user_id: string
          website_orders_used?: number | null
          whatsapp_orders_used?: number | null
        }
        Update: {
          billing_cycle?: string
          cancelled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          next_billing_at?: string | null
          payment_gateway?: string | null
          plan_id?: string
          started_at?: string
          status?: string
          trial_ends_at?: string | null
          updated_at?: string
          user_id?: string
          website_orders_used?: number | null
          whatsapp_orders_used?: number | null
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
          razorpay_order_id: string | null
          razorpay_signature: string | null
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
          razorpay_order_id?: string | null
          razorpay_signature?: string | null
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
          razorpay_order_id?: string | null
          razorpay_signature?: string | null
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
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
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
      check_and_process_expired_subscriptions: {
        Args: never
        Returns: undefined
      }
      cleanup_old_pending_subscriptions: { Args: never; Returns: undefined }
      generate_referral_code: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      process_successful_payment: {
        Args: {
          payment_gateway_name: string
          payment_id?: string
          subscription_id: string
        }
        Returns: undefined
      }
      renew_subscription: {
        Args: { reset_counters?: boolean; subscription_id: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "super_admin" | "admin" | "user"
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
      app_role: ["super_admin", "admin", "user"],
    },
  },
} as const

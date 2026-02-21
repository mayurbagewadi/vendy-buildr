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
      ai_designer_history: {
        Row: {
          ai_css_overrides: string | null
          ai_response: Json
          applied: boolean | null
          created_at: string | null
          id: string
          prompt: string
          response_size_bytes: number | null
          store_id: string
          tokens_used: number
          user_id: string
        }
        Insert: {
          ai_css_overrides?: string | null
          ai_response: Json
          applied?: boolean | null
          created_at?: string | null
          id?: string
          prompt: string
          response_size_bytes?: number | null
          store_id: string
          tokens_used?: number
          user_id: string
        }
        Update: {
          ai_css_overrides?: string | null
          ai_response?: Json
          applied?: boolean | null
          created_at?: string | null
          id?: string
          prompt?: string
          response_size_bytes?: number | null
          store_id?: string
          tokens_used?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_designer_history_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_designer_metrics: {
        Row: {
          action: string
          created_at: string | null
          css_sanitized: boolean | null
          design_published: boolean | null
          error_type: string | null
          id: string
          latency_ms: number | null
          model_used: string | null
          prompt_length: number | null
          store_id: string
          success: boolean
          tokens_consumed: number | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          css_sanitized?: boolean | null
          design_published?: boolean | null
          error_type?: string | null
          id?: string
          latency_ms?: number | null
          model_used?: string | null
          prompt_length?: number | null
          store_id: string
          success?: boolean
          tokens_consumed?: number | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          css_sanitized?: boolean | null
          design_published?: boolean | null
          error_type?: string | null
          id?: string
          latency_ms?: number | null
          model_used?: string | null
          prompt_length?: number | null
          store_id?: string
          success?: boolean
          tokens_consumed?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_designer_metrics_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_history_archives: {
        Row: {
          archive_date: string
          archived_at: string | null
          created_at: string | null
          file_size_bytes: number | null
          google_drive_file_id: string
          google_drive_file_url: string | null
          id: string
          newest_record_date: string | null
          oldest_record_date: string | null
          record_count: number
        }
        Insert: {
          archive_date: string
          archived_at?: string | null
          created_at?: string | null
          file_size_bytes?: number | null
          google_drive_file_id: string
          google_drive_file_url?: string | null
          id?: string
          newest_record_date?: string | null
          oldest_record_date?: string | null
          record_count?: number
        }
        Update: {
          archive_date?: string
          archived_at?: string | null
          created_at?: string | null
          file_size_bytes?: number | null
          google_drive_file_id?: string
          google_drive_file_url?: string | null
          id?: string
          newest_record_date?: string | null
          oldest_record_date?: string | null
          record_count?: number
        }
        Relationships: []
      }
      ai_token_packages: {
        Row: {
          created_at: string | null
          description: string | null
          display_order: number | null
          id: string
          is_active: boolean | null
          name: string
          price: number
          tokens_included: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          name: string
          price: number
          tokens_included: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          name?: string
          price?: number
          tokens_included?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      ai_token_purchases: {
        Row: {
          amount_paid: number
          created_at: string | null
          expires_at: string | null
          id: string
          package_id: string | null
          payment_id: string | null
          purchased_at: string | null
          status: string | null
          store_id: string
          tokens_purchased: number
          tokens_remaining: number
          tokens_used: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          amount_paid: number
          created_at?: string | null
          expires_at?: string | null
          id?: string
          package_id?: string | null
          payment_id?: string | null
          purchased_at?: string | null
          status?: string | null
          store_id: string
          tokens_purchased: number
          tokens_remaining: number
          tokens_used?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          amount_paid?: number
          created_at?: string | null
          expires_at?: string | null
          id?: string
          package_id?: string | null
          payment_id?: string | null
          purchased_at?: string | null
          status?: string | null
          store_id?: string
          tokens_purchased?: number
          tokens_remaining?: number
          tokens_used?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_token_purchases_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "ai_token_packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_token_purchases_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_token_settings: {
        Row: {
          created_at: string | null
          id: string
          token_expiry_duration: number | null
          token_expiry_enabled: boolean | null
          token_expiry_unit: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          token_expiry_duration?: number | null
          token_expiry_enabled?: boolean | null
          token_expiry_unit?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          token_expiry_duration?: number | null
          token_expiry_enabled?: boolean | null
          token_expiry_unit?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      automatic_discounts: {
        Row: {
          created_at: string
          expiry_date: string
          id: string
          order_type: string
          rule_description: string | null
          rule_name: string
          rule_type: string
          start_date: string
          status: string
          store_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          expiry_date: string
          id?: string
          order_type?: string
          rule_description?: string | null
          rule_name: string
          rule_type: string
          start_date?: string
          status?: string
          store_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          expiry_date?: string
          id?: string
          order_type?: string
          rule_description?: string | null
          rule_name?: string
          rule_type?: string
          start_date?: string
          status?: string
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "automatic_discounts_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
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
      commission_audit: {
        Row: {
          action: string
          change_reason: string | null
          changed_by: string | null
          changed_by_email: string | null
          created_at: string
          id: string
          new_value: Json | null
          old_value: Json | null
          record_id: string | null
          settings_id: string | null
          table_name: string
        }
        Insert: {
          action: string
          change_reason?: string | null
          changed_by?: string | null
          changed_by_email?: string | null
          created_at?: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          record_id?: string | null
          settings_id?: string | null
          table_name: string
        }
        Update: {
          action?: string
          change_reason?: string | null
          changed_by?: string | null
          changed_by_email?: string | null
          created_at?: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          record_id?: string | null
          settings_id?: string | null
          table_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "commission_audit_settings_id_fkey"
            columns: ["settings_id"]
            isOneToOne: false
            referencedRelation: "commission_settings"
            referencedColumns: ["id"]
          },
        ]
      }
      commission_settings: {
        Row: {
          auto_approve_applications: boolean
          auto_generate_codes: boolean
          created_at: string
          created_by: string | null
          enable_multi_tier: boolean
          id: string
          is_active: boolean
          max_helpers_per_recruiter: number
          min_payout_threshold: number
          payment_day: string
          payment_schedule: string
          referral_code_prefix: string
          send_commission_notifications: boolean
          send_welcome_email: boolean
          version: number
        }
        Insert: {
          auto_approve_applications?: boolean
          auto_generate_codes?: boolean
          created_at?: string
          created_by?: string | null
          enable_multi_tier?: boolean
          id?: string
          is_active?: boolean
          max_helpers_per_recruiter?: number
          min_payout_threshold?: number
          payment_day?: string
          payment_schedule?: string
          referral_code_prefix?: string
          send_commission_notifications?: boolean
          send_welcome_email?: boolean
          version?: number
        }
        Update: {
          auto_approve_applications?: boolean
          auto_generate_codes?: boolean
          created_at?: string
          created_by?: string | null
          enable_multi_tier?: boolean
          id?: string
          is_active?: boolean
          max_helpers_per_recruiter?: number
          min_payout_threshold?: number
          payment_day?: string
          payment_schedule?: string
          referral_code_prefix?: string
          send_commission_notifications?: boolean
          send_welcome_email?: boolean
          version?: number
        }
        Relationships: []
      }
      coupon_categories: {
        Row: {
          category_id: string
          coupon_id: string
          created_at: string
          id: string
        }
        Insert: {
          category_id: string
          coupon_id: string
          created_at?: string
          id?: string
        }
        Update: {
          category_id?: string
          coupon_id?: string
          created_at?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "coupon_categories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupon_categories_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["id"]
          },
        ]
      }
      coupon_products: {
        Row: {
          coupon_id: string
          created_at: string
          id: string
          is_excluded: boolean
          product_id: string
        }
        Insert: {
          coupon_id: string
          created_at?: string
          id?: string
          is_excluded?: boolean
          product_id: string
        }
        Update: {
          coupon_id?: string
          created_at?: string
          id?: string
          is_excluded?: boolean
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "coupon_products_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupon_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      coupon_usage: {
        Row: {
          coupon_id: string
          customer_email: string | null
          customer_phone: string | null
          discount_applied: number
          id: string
          order_id: string
          used_at: string
        }
        Insert: {
          coupon_id: string
          customer_email?: string | null
          customer_phone?: string | null
          discount_applied: number
          id?: string
          order_id: string
          used_at?: string
        }
        Update: {
          coupon_id?: string
          customer_email?: string | null
          customer_phone?: string | null
          discount_applied?: number
          id?: string
          order_id?: string
          used_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "coupon_usage_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupon_usage_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      coupons: {
        Row: {
          applicable_to: string
          code: string
          created_at: string
          customer_type: string
          description: string | null
          discount_type: string
          discount_value: number
          expiry_date: string
          id: string
          is_first_order: boolean
          max_discount: number | null
          min_order_value: number | null
          order_type: string
          start_date: string
          status: string
          store_id: string
          updated_at: string
          usage_limit_per_customer: number | null
          usage_limit_total: number | null
        }
        Insert: {
          applicable_to: string
          code: string
          created_at?: string
          customer_type: string
          description?: string | null
          discount_type: string
          discount_value: number
          expiry_date: string
          id?: string
          is_first_order?: boolean
          max_discount?: number | null
          min_order_value?: number | null
          order_type: string
          start_date: string
          status?: string
          store_id: string
          updated_at?: string
          usage_limit_per_customer?: number | null
          usage_limit_total?: number | null
        }
        Update: {
          applicable_to?: string
          code?: string
          created_at?: string
          customer_type?: string
          description?: string | null
          discount_type?: string
          discount_value?: number
          expiry_date?: string
          id?: string
          is_first_order?: boolean
          max_discount?: number | null
          min_order_value?: number | null
          order_type?: string
          start_date?: string
          status?: string
          store_id?: string
          updated_at?: string
          usage_limit_per_customer?: number | null
          usage_limit_total?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "coupons_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      discount_rules: {
        Row: {
          created_at: string
          discount_id: string
          discount_type: string
          discount_value: number
          id: string
          rule_type: string
          rule_value: string | null
        }
        Insert: {
          created_at?: string
          discount_id: string
          discount_type: string
          discount_value: number
          id?: string
          rule_type: string
          rule_value?: string | null
        }
        Update: {
          created_at?: string
          discount_id?: string
          discount_type?: string
          discount_value?: number
          id?: string
          rule_type?: string
          rule_value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "discount_rules_discount_id_fkey"
            columns: ["discount_id"]
            isOneToOne: false
            referencedRelation: "automatic_discounts"
            referencedColumns: ["id"]
          },
        ]
      }
      discount_tiers: {
        Row: {
          created_at: string
          discount_id: string
          discount_type: string
          discount_value: number
          id: string
          min_order_value: number | null
          tier_order: number
        }
        Insert: {
          created_at?: string
          discount_id: string
          discount_type: string
          discount_value: number
          id?: string
          min_order_value?: number | null
          tier_order: number
        }
        Update: {
          created_at?: string
          discount_id?: string
          discount_type?: string
          discount_value?: number
          id?: string
          min_order_value?: number | null
          tier_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "discount_tiers_discount_id_fkey"
            columns: ["discount_id"]
            isOneToOne: false
            referencedRelation: "automatic_discounts"
            referencedColumns: ["id"]
          },
        ]
      }
      google_reviews_cache: {
        Row: {
          average_rating: number | null
          created_at: string | null
          google_place_id: string
          id: string
          last_fetched: string | null
          reviews: Json | null
          store_id: string
          total_reviews: number | null
          updated_at: string | null
        }
        Insert: {
          average_rating?: number | null
          created_at?: string | null
          google_place_id: string
          id?: string
          last_fetched?: string | null
          reviews?: Json | null
          store_id: string
          total_reviews?: number | null
          updated_at?: string | null
        }
        Update: {
          average_rating?: number | null
          created_at?: string | null
          google_place_id?: string
          id?: string
          last_fetched?: string | null
          reviews?: Json | null
          store_id?: string
          total_reviews?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "google_reviews_cache_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: true
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
      instagram_comments: {
        Row: {
          comment_id: string
          comment_text: string | null
          created_at: string | null
          from_id: string | null
          from_username: string | null
          id: string
          instagram_id: string
          media_id: string | null
          replied: boolean | null
        }
        Insert: {
          comment_id: string
          comment_text?: string | null
          created_at?: string | null
          from_id?: string | null
          from_username?: string | null
          id?: string
          instagram_id: string
          media_id?: string | null
          replied?: boolean | null
        }
        Update: {
          comment_id?: string
          comment_text?: string | null
          created_at?: string | null
          from_id?: string | null
          from_username?: string | null
          id?: string
          instagram_id?: string
          media_id?: string | null
          replied?: boolean | null
        }
        Relationships: []
      }
      instagram_messages: {
        Row: {
          created_at: string | null
          direction: string
          id: string
          instagram_id: string
          is_auto_reply: boolean | null
          message_id: string | null
          message_text: string | null
          recipient_id: string
          sender_id: string
          timestamp: string
        }
        Insert: {
          created_at?: string | null
          direction: string
          id?: string
          instagram_id: string
          is_auto_reply?: boolean | null
          message_id?: string | null
          message_text?: string | null
          recipient_id: string
          sender_id: string
          timestamp: string
        }
        Update: {
          created_at?: string | null
          direction?: string
          id?: string
          instagram_id?: string
          is_auto_reply?: boolean | null
          message_id?: string | null
          message_text?: string | null
          recipient_id?: string
          sender_id?: string
          timestamp?: string
        }
        Relationships: []
      }
      instagram_reels_cache: {
        Row: {
          caption: string | null
          created_at: string | null
          fetched_at: string | null
          id: string
          instagram_id: string
          media_id: string
          media_type: string
          media_url: string | null
          permalink: string
          store_id: string
          thumbnail_url: string | null
          timestamp: string | null
        }
        Insert: {
          caption?: string | null
          created_at?: string | null
          fetched_at?: string | null
          id?: string
          instagram_id: string
          media_id: string
          media_type: string
          media_url?: string | null
          permalink: string
          store_id: string
          thumbnail_url?: string | null
          timestamp?: string | null
        }
        Update: {
          caption?: string | null
          created_at?: string | null
          fetched_at?: string | null
          id?: string
          instagram_id?: string
          media_id?: string
          media_type?: string
          media_url?: string | null
          permalink?: string
          store_id?: string
          thumbnail_url?: string | null
          timestamp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "instagram_reels_cache_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_features: {
        Row: {
          created_at: string | null
          description: string | null
          icon: string
          id: string
          is_active: boolean | null
          is_free: boolean | null
          menu_order: number | null
          name: string
          price: number | null
          price_monthly: number | null
          price_onetime: number | null
          price_yearly: number | null
          pricing_model: string | null
          quota_monthly: number | null
          quota_onetime: number | null
          quota_period: string | null
          quota_yearly: number | null
          slug: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          icon?: string
          id?: string
          is_active?: boolean | null
          is_free?: boolean | null
          menu_order?: number | null
          name: string
          price?: number | null
          price_monthly?: number | null
          price_onetime?: number | null
          price_yearly?: number | null
          pricing_model?: string | null
          quota_monthly?: number | null
          quota_onetime?: number | null
          quota_period?: string | null
          quota_yearly?: number | null
          slug: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          icon?: string
          id?: string
          is_active?: boolean | null
          is_free?: boolean | null
          menu_order?: number | null
          name?: string
          price?: number | null
          price_monthly?: number | null
          price_onetime?: number | null
          price_yearly?: number | null
          pricing_model?: string | null
          quota_monthly?: number | null
          quota_onetime?: number | null
          quota_period?: string | null
          quota_yearly?: number | null
          slug?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      marketplace_purchases: {
        Row: {
          amount_paid: number
          auto_renew: boolean | null
          calls_used: number | null
          created_at: string | null
          expires_at: string | null
          feature_slug: string
          id: string
          last_reset: string | null
          payment_id: string | null
          pricing_type: string
          purchased_at: string | null
          quota_limit: number | null
          status: string | null
          store_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          amount_paid: number
          auto_renew?: boolean | null
          calls_used?: number | null
          created_at?: string | null
          expires_at?: string | null
          feature_slug: string
          id?: string
          last_reset?: string | null
          payment_id?: string | null
          pricing_type: string
          purchased_at?: string | null
          quota_limit?: number | null
          status?: string | null
          store_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          amount_paid?: number
          auto_renew?: boolean | null
          calls_used?: number | null
          created_at?: string | null
          expires_at?: string | null
          feature_slug?: string
          id?: string
          last_reset?: string | null
          payment_id?: string | null
          pricing_type?: string
          purchased_at?: string | null
          quota_limit?: number | null
          status?: string | null
          store_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_purchases_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      media_library: {
        Row: {
          created_at: string | null
          file_name: string
          file_size_mb: number
          file_type: string
          file_url: string
          id: string
          store_id: string
          uploaded_at: string | null
        }
        Insert: {
          created_at?: string | null
          file_name: string
          file_size_mb: number
          file_type: string
          file_url: string
          id?: string
          store_id: string
          uploaded_at?: string | null
        }
        Update: {
          created_at?: string | null
          file_name?: string
          file_size_mb?: number
          file_type?: string
          file_url?: string
          id?: string
          store_id?: string
          uploaded_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "media_library_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      network_commission: {
        Row: {
          commission_model: string
          created_at: string
          id: string
          onetime_type: string | null
          onetime_value: number | null
          recurring_duration: number | null
          recurring_type: string | null
          recurring_value: number | null
          settings_id: string
          subscription_type: string
        }
        Insert: {
          commission_model: string
          created_at?: string
          id?: string
          onetime_type?: string | null
          onetime_value?: number | null
          recurring_duration?: number | null
          recurring_type?: string | null
          recurring_value?: number | null
          settings_id: string
          subscription_type: string
        }
        Update: {
          commission_model?: string
          created_at?: string
          id?: string
          onetime_type?: string | null
          onetime_value?: number | null
          recurring_duration?: number | null
          recurring_type?: string | null
          recurring_value?: number | null
          settings_id?: string
          subscription_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "network_commission_settings_id_fkey"
            columns: ["settings_id"]
            isOneToOne: false
            referencedRelation: "commission_settings"
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
          automatic_discount_id: string | null
          awb_code: string | null
          coupon_code: string | null
          courier_name: string | null
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
          discount_amount: number | null
          gateway_order_id: string | null
          id: string
          items: Json
          notes: string | null
          order_number: string
          payment_gateway: string | null
          payment_id: string | null
          payment_method: string
          payment_response: Json | null
          payment_status: string | null
          shipping_status: string | null
          shiprocket_order_id: string | null
          shiprocket_shipment_id: string | null
          status: string
          store_id: string
          subtotal: number
          total: number
          tracking_url: string | null
          updated_at: string
        }
        Insert: {
          automatic_discount_id?: string | null
          awb_code?: string | null
          coupon_code?: string | null
          courier_name?: string | null
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
          discount_amount?: number | null
          gateway_order_id?: string | null
          id?: string
          items?: Json
          notes?: string | null
          order_number: string
          payment_gateway?: string | null
          payment_id?: string | null
          payment_method?: string
          payment_response?: Json | null
          payment_status?: string | null
          shipping_status?: string | null
          shiprocket_order_id?: string | null
          shiprocket_shipment_id?: string | null
          status?: string
          store_id: string
          subtotal?: number
          total?: number
          tracking_url?: string | null
          updated_at?: string
        }
        Update: {
          automatic_discount_id?: string | null
          awb_code?: string | null
          coupon_code?: string | null
          courier_name?: string | null
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
          discount_amount?: number | null
          gateway_order_id?: string | null
          id?: string
          items?: Json
          notes?: string | null
          order_number?: string
          payment_gateway?: string | null
          payment_id?: string | null
          payment_method?: string
          payment_response?: Json | null
          payment_status?: string | null
          shipping_status?: string | null
          shiprocket_order_id?: string | null
          shiprocket_shipment_id?: string | null
          status?: string
          store_id?: string
          subtotal?: number
          total?: number
          tracking_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_automatic_discount_id_fkey"
            columns: ["automatic_discount_id"]
            isOneToOne: false
            referencedRelation: "automatic_discounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_commission: {
        Row: {
          commission_model: string
          created_at: string
          enabled: boolean
          id: string
          onetime_type: string | null
          onetime_value: number | null
          plan_id: string
          recurring_duration: number | null
          recurring_type: string | null
          recurring_value: number | null
          settings_id: string
          subscription_type: string
        }
        Insert: {
          commission_model: string
          created_at?: string
          enabled?: boolean
          id?: string
          onetime_type?: string | null
          onetime_value?: number | null
          plan_id: string
          recurring_duration?: number | null
          recurring_type?: string | null
          recurring_value?: number | null
          settings_id: string
          subscription_type: string
        }
        Update: {
          commission_model?: string
          created_at?: string
          enabled?: boolean
          id?: string
          onetime_type?: string | null
          onetime_value?: number | null
          plan_id?: string
          recurring_duration?: number | null
          recurring_type?: string | null
          recurring_value?: number | null
          settings_id?: string
          subscription_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_commission_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_commission_settings_id_fkey"
            columns: ["settings_id"]
            isOneToOne: false
            referencedRelation: "commission_settings"
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
          google_drive_archive_folder_id: string | null
          google_drive_service_account_json: string | null
          id: string
          inactive_logs_cleanup_months: number | null
          openrouter_api_key: string | null
          openrouter_fallback_model: string | null
          openrouter_model: string | null
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
          google_drive_archive_folder_id?: string | null
          google_drive_service_account_json?: string | null
          id?: string
          inactive_logs_cleanup_months?: number | null
          openrouter_api_key?: string | null
          openrouter_fallback_model?: string | null
          openrouter_model?: string | null
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
          google_drive_archive_folder_id?: string | null
          google_drive_service_account_json?: string | null
          id?: string
          inactive_logs_cleanup_months?: number | null
          openrouter_api_key?: string | null
          openrouter_fallback_model?: string | null
          openrouter_model?: string | null
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
      store_design_state: {
        Row: {
          created_at: string | null
          current_design: Json | null
          last_applied_at: string | null
          store_id: string
          updated_at: string | null
          version: number | null
          version_history: Json | null
        }
        Insert: {
          created_at?: string | null
          current_design?: Json | null
          last_applied_at?: string | null
          store_id: string
          updated_at?: string | null
          version?: number | null
          version_history?: Json | null
        }
        Update: {
          created_at?: string | null
          current_design?: Json | null
          last_applied_at?: string | null
          store_id?: string
          updated_at?: string | null
          version?: number | null
          version_history?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "store_design_state_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: true
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
          store_id: string | null
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
          store_id?: string | null
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
          store_id?: string | null
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
          {
            foreignKeyName: "store_referrals_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      stores: {
        Row: {
          address: string | null
          ai_voice_embed_code: string | null
          alternate_names: string | null
          auto_reply_settings: Json | null
          business_email: string | null
          business_phone: string | null
          city: string | null
          comment_auto_reply_settings: Json | null
          country: string | null
          created_at: string
          custom_domain: string | null
          custom_domain_verification_token: string | null
          custom_domain_verified: boolean | null
          description: string | null
          enabled_features: string[] | null
          facebook_url: string | null
          force_location_sharing: boolean | null
          google_access_token: string | null
          google_maps_url: string | null
          google_place_id: string | null
          google_refresh_token: string | null
          google_reviews_calls_used: number | null
          google_reviews_display_type: string | null
          google_reviews_enabled: boolean | null
          google_reviews_last_reset: string | null
          google_sheet_connected: boolean | null
          google_sheet_created_at: string | null
          google_sheet_id: string | null
          google_sheet_url: string | null
          google_token_expiry: string | null
          hero_banner_url: string | null
          hero_banner_urls: string[] | null
          id: string
          instagram_access_token: string | null
          instagram_business_id: string | null
          instagram_connected: boolean | null
          instagram_reels_settings: Json | null
          instagram_token_expiry: string | null
          instagram_url: string | null
          instagram_username: string | null
          is_active: boolean | null
          last_admin_visit: string | null
          last_sheet_sync: string | null
          linkedin_url: string | null
          logo_url: string | null
          name: string
          opening_hours: string | null
          package_breadth: number | null
          package_height: number | null
          package_length: number | null
          package_weight: number | null
          payment_gateway_credentials: Json | null
          payment_mode: string | null
          policies: Json | null
          postal_code: string | null
          price_range: string | null
          seo_description: string | null
          shipping_popup_enabled: boolean | null
          shiprocket_email: string | null
          shiprocket_pickup_location: string | null
          shiprocket_token: string | null
          slug: string
          social_links: Json | null
          state: string | null
          storage_limit_mb: number | null
          storage_used_mb: number | null
          street_address: string | null
          subdomain: string | null
          twitter_url: string | null
          updated_at: string
          user_id: string
          whatsapp_number: string | null
          youtube_url: string | null
        }
        Insert: {
          address?: string | null
          ai_voice_embed_code?: string | null
          alternate_names?: string | null
          auto_reply_settings?: Json | null
          business_email?: string | null
          business_phone?: string | null
          city?: string | null
          comment_auto_reply_settings?: Json | null
          country?: string | null
          created_at?: string
          custom_domain?: string | null
          custom_domain_verification_token?: string | null
          custom_domain_verified?: boolean | null
          description?: string | null
          enabled_features?: string[] | null
          facebook_url?: string | null
          force_location_sharing?: boolean | null
          google_access_token?: string | null
          google_maps_url?: string | null
          google_place_id?: string | null
          google_refresh_token?: string | null
          google_reviews_calls_used?: number | null
          google_reviews_display_type?: string | null
          google_reviews_enabled?: boolean | null
          google_reviews_last_reset?: string | null
          google_sheet_connected?: boolean | null
          google_sheet_created_at?: string | null
          google_sheet_id?: string | null
          google_sheet_url?: string | null
          google_token_expiry?: string | null
          hero_banner_url?: string | null
          hero_banner_urls?: string[] | null
          id?: string
          instagram_access_token?: string | null
          instagram_business_id?: string | null
          instagram_connected?: boolean | null
          instagram_reels_settings?: Json | null
          instagram_token_expiry?: string | null
          instagram_url?: string | null
          instagram_username?: string | null
          is_active?: boolean | null
          last_admin_visit?: string | null
          last_sheet_sync?: string | null
          linkedin_url?: string | null
          logo_url?: string | null
          name: string
          opening_hours?: string | null
          package_breadth?: number | null
          package_height?: number | null
          package_length?: number | null
          package_weight?: number | null
          payment_gateway_credentials?: Json | null
          payment_mode?: string | null
          policies?: Json | null
          postal_code?: string | null
          price_range?: string | null
          seo_description?: string | null
          shipping_popup_enabled?: boolean | null
          shiprocket_email?: string | null
          shiprocket_pickup_location?: string | null
          shiprocket_token?: string | null
          slug: string
          social_links?: Json | null
          state?: string | null
          storage_limit_mb?: number | null
          storage_used_mb?: number | null
          street_address?: string | null
          subdomain?: string | null
          twitter_url?: string | null
          updated_at?: string
          user_id: string
          whatsapp_number?: string | null
          youtube_url?: string | null
        }
        Update: {
          address?: string | null
          ai_voice_embed_code?: string | null
          alternate_names?: string | null
          auto_reply_settings?: Json | null
          business_email?: string | null
          business_phone?: string | null
          city?: string | null
          comment_auto_reply_settings?: Json | null
          country?: string | null
          created_at?: string
          custom_domain?: string | null
          custom_domain_verification_token?: string | null
          custom_domain_verified?: boolean | null
          description?: string | null
          enabled_features?: string[] | null
          facebook_url?: string | null
          force_location_sharing?: boolean | null
          google_access_token?: string | null
          google_maps_url?: string | null
          google_place_id?: string | null
          google_refresh_token?: string | null
          google_reviews_calls_used?: number | null
          google_reviews_display_type?: string | null
          google_reviews_enabled?: boolean | null
          google_reviews_last_reset?: string | null
          google_sheet_connected?: boolean | null
          google_sheet_created_at?: string | null
          google_sheet_id?: string | null
          google_sheet_url?: string | null
          google_token_expiry?: string | null
          hero_banner_url?: string | null
          hero_banner_urls?: string[] | null
          id?: string
          instagram_access_token?: string | null
          instagram_business_id?: string | null
          instagram_connected?: boolean | null
          instagram_reels_settings?: Json | null
          instagram_token_expiry?: string | null
          instagram_url?: string | null
          instagram_username?: string | null
          is_active?: boolean | null
          last_admin_visit?: string | null
          last_sheet_sync?: string | null
          linkedin_url?: string | null
          logo_url?: string | null
          name?: string
          opening_hours?: string | null
          package_breadth?: number | null
          package_height?: number | null
          package_length?: number | null
          package_weight?: number | null
          payment_gateway_credentials?: Json | null
          payment_mode?: string | null
          policies?: Json | null
          postal_code?: string | null
          price_range?: string | null
          seo_description?: string | null
          shipping_popup_enabled?: boolean | null
          shiprocket_email?: string | null
          shiprocket_pickup_location?: string | null
          shiprocket_token?: string | null
          slug?: string
          social_links?: Json | null
          state?: string | null
          storage_limit_mb?: number | null
          storage_used_mb?: number | null
          street_address?: string | null
          subdomain?: string | null
          twitter_url?: string | null
          updated_at?: string
          user_id?: string
          whatsapp_number?: string | null
          youtube_url?: string | null
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
          google_reviews_calls_limit: number | null
          google_reviews_period: string | null
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
          google_reviews_calls_limit?: number | null
          google_reviews_period?: string | null
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
          google_reviews_calls_limit?: number | null
          google_reviews_period?: string | null
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
      approve_helper_application: {
        Args: { p_application_id: string }
        Returns: Json
      }
      archive_old_ai_history: { Args: never; Returns: Json }
      check_and_process_expired_subscriptions: {
        Args: never
        Returns: undefined
      }
      cleanup_old_pending_subscriptions: { Args: never; Returns: undefined }
      delete_old_ai_history: { Args: never; Returns: Json }
      generate_referral_code: { Args: never; Returns: string }
      get_active_commission_settings: { Args: never; Returns: Json }
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

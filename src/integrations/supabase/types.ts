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
      ab_tests: {
        Row: {
          conversions_a: number
          conversions_b: number
          created_at: string
          id: string
          is_active: boolean
          name: string
          scope: string
          variant_a: Json
          variant_b: Json
          views_a: number
          views_b: number
        }
        Insert: {
          conversions_a?: number
          conversions_b?: number
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          scope: string
          variant_a?: Json
          variant_b?: Json
          views_a?: number
          views_b?: number
        }
        Update: {
          conversions_a?: number
          conversions_b?: number
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          scope?: string
          variant_a?: Json
          variant_b?: Json
          views_a?: number
          views_b?: number
        }
        Relationships: []
      }
      abandoned_carts: {
        Row: {
          abandonment_reason: string | null
          contact_attempts: number
          contact_status: string
          converted: boolean
          created_at: string
          currency: string
          email: string | null
          first_seen_at: string
          id: string
          items: Json
          last_contacted_at: string | null
          phone: string | null
          reached_checkout: boolean
          recovered_order_id: string | null
          recovery_coupon_code: string | null
          recovery_token: string | null
          session_id: string
          source: string
          stage: string
          subtotal: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          abandonment_reason?: string | null
          contact_attempts?: number
          contact_status?: string
          converted?: boolean
          created_at?: string
          currency?: string
          email?: string | null
          first_seen_at?: string
          id?: string
          items?: Json
          last_contacted_at?: string | null
          phone?: string | null
          reached_checkout?: boolean
          recovered_order_id?: string | null
          recovery_coupon_code?: string | null
          recovery_token?: string | null
          session_id: string
          source?: string
          stage?: string
          subtotal?: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          abandonment_reason?: string | null
          contact_attempts?: number
          contact_status?: string
          converted?: boolean
          created_at?: string
          currency?: string
          email?: string | null
          first_seen_at?: string
          id?: string
          items?: Json
          last_contacted_at?: string | null
          phone?: string | null
          reached_checkout?: boolean
          recovered_order_id?: string | null
          recovery_coupon_code?: string | null
          recovery_token?: string | null
          session_id?: string
          source?: string
          stage?: string
          subtotal?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      account_deletion_requests: {
        Row: {
          cancelled_at: string | null
          completed_at: string | null
          id: string
          processed_by: string | null
          reason: string | null
          requested_at: string
          scheduled_for: string
          status: string
          user_id: string
        }
        Insert: {
          cancelled_at?: string | null
          completed_at?: string | null
          id?: string
          processed_by?: string | null
          reason?: string | null
          requested_at?: string
          scheduled_for?: string
          status?: string
          user_id: string
        }
        Update: {
          cancelled_at?: string | null
          completed_at?: string | null
          id?: string
          processed_by?: string | null
          reason?: string | null
          requested_at?: string
          scheduled_for?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      account_lockouts: {
        Row: {
          created_at: string
          email: string
          failed_count: number
          id: string
          locked_until: string
          reason: string | null
          released_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email: string
          failed_count?: number
          id?: string
          locked_until: string
          reason?: string | null
          released_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          failed_count?: number
          id?: string
          locked_until?: string
          reason?: string | null
          released_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      active_sessions: {
        Row: {
          created_at: string
          device_label: string | null
          id: string
          ip_address: string | null
          last_seen_at: string
          revoked_at: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          device_label?: string | null
          id?: string
          ip_address?: string | null
          last_seen_at?: string
          revoked_at?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          device_label?: string | null
          id?: string
          ip_address?: string | null
          last_seen_at?: string
          revoked_at?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      admin_help_articles: {
        Row: {
          body_ar: string
          body_en: string
          category: string
          created_at: string
          external_url: string | null
          id: string
          is_published: boolean
          sort_order: number
          title_ar: string
          title_en: string
          updated_at: string
          video_url: string | null
        }
        Insert: {
          body_ar?: string
          body_en?: string
          category?: string
          created_at?: string
          external_url?: string | null
          id?: string
          is_published?: boolean
          sort_order?: number
          title_ar: string
          title_en: string
          updated_at?: string
          video_url?: string | null
        }
        Update: {
          body_ar?: string
          body_en?: string
          category?: string
          created_at?: string
          external_url?: string | null
          id?: string
          is_published?: boolean
          sort_order?: number
          title_ar?: string
          title_en?: string
          updated_at?: string
          video_url?: string | null
        }
        Relationships: []
      }
      admin_notifications: {
        Row: {
          body: string | null
          created_at: string
          event_code: string
          id: string
          link: string | null
          metadata: Json
          read_by: Json
          related_entity: string | null
          related_entity_id: string | null
          severity: string
          title: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          event_code: string
          id?: string
          link?: string | null
          metadata?: Json
          read_by?: Json
          related_entity?: string | null
          related_entity_id?: string | null
          severity?: string
          title: string
        }
        Update: {
          body?: string | null
          created_at?: string
          event_code?: string
          id?: string
          link?: string | null
          metadata?: Json
          read_by?: Json
          related_entity?: string | null
          related_entity_id?: string | null
          severity?: string
          title?: string
        }
        Relationships: []
      }
      analytics_events: {
        Row: {
          created_at: string
          event_name: string
          id: string
          metadata: Json
          path: string | null
          referrer: string | null
          session_id: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event_name: string
          id?: string
          metadata?: Json
          path?: string | null
          referrer?: string | null
          session_id: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event_name?: string
          id?: string
          metadata?: Json
          path?: string | null
          referrer?: string | null
          session_id?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      announcement_messages: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          message_ar: string
          message_en: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          message_ar: string
          message_en: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          message_ar?: string
          message_en?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      api_keys: {
        Row: {
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          is_active: boolean
          key_hash: string
          key_prefix: string
          last_used_at: string | null
          name: string
          rate_limit_per_minute: number
          scopes: string[]
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          key_hash: string
          key_prefix: string
          last_used_at?: string | null
          name: string
          rate_limit_per_minute?: number
          scopes?: string[]
        }
        Update: {
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          key_hash?: string
          key_prefix?: string
          last_used_at?: string | null
          name?: string
          rate_limit_per_minute?: number
          scopes?: string[]
        }
        Relationships: []
      }
      api_request_logs: {
        Row: {
          api_key_id: string | null
          created_at: string
          duration_ms: number | null
          error: string | null
          id: string
          ip_address: string | null
          method: string
          path: string
          status_code: number
          user_agent: string | null
        }
        Insert: {
          api_key_id?: string | null
          created_at?: string
          duration_ms?: number | null
          error?: string | null
          id?: string
          ip_address?: string | null
          method: string
          path: string
          status_code: number
          user_agent?: string | null
        }
        Update: {
          api_key_id?: string | null
          created_at?: string
          duration_ms?: number | null
          error?: string | null
          id?: string
          ip_address?: string | null
          method?: string
          path?: string
          status_code?: number
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "api_request_logs_api_key_id_fkey"
            columns: ["api_key_id"]
            isOneToOne: false
            referencedRelation: "api_keys"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_email: string | null
          actor_id: string | null
          created_at: string
          entity: string | null
          entity_id: string | null
          id: string
          ip_address: string | null
          metadata: Json
          new_data: Json | null
          old_data: Json | null
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          entity?: string | null
          entity_id?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json
          new_data?: Json | null
          old_data?: Json | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          entity?: string | null
          entity_id?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json
          new_data?: Json | null
          old_data?: Json | null
          user_agent?: string | null
        }
        Relationships: []
      }
      backup_log: {
        Row: {
          created_at: string
          id: string
          location: string | null
          notes: string | null
          size_bytes: number | null
          status: string
          triggered_by: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          location?: string | null
          notes?: string | null
          size_bytes?: number | null
          status: string
          triggered_by?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          location?: string | null
          notes?: string | null
          size_bytes?: number | null
          status?: string
          triggered_by?: string | null
        }
        Relationships: []
      }
      bundles: {
        Row: {
          bundle_price: number | null
          created_at: string
          description: string | null
          discount_percent: number | null
          ends_at: string | null
          id: string
          is_active: boolean
          name: string
          product_ids: string[]
          starts_at: string | null
          updated_at: string
        }
        Insert: {
          bundle_price?: number | null
          created_at?: string
          description?: string | null
          discount_percent?: number | null
          ends_at?: string | null
          id?: string
          is_active?: boolean
          name: string
          product_ids?: string[]
          starts_at?: string | null
          updated_at?: string
        }
        Update: {
          bundle_price?: number | null
          created_at?: string
          description?: string | null
          discount_percent?: number | null
          ends_at?: string | null
          id?: string
          is_active?: boolean
          name?: string
          product_ids?: string[]
          starts_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      cart_recovery_attempts: {
        Row: {
          actor_email: string | null
          actor_id: string | null
          cart_id: string
          channel: string
          coupon_code: string | null
          created_at: string
          id: string
          message: string | null
          metadata: Json
          status: string
        }
        Insert: {
          actor_email?: string | null
          actor_id?: string | null
          cart_id: string
          channel: string
          coupon_code?: string | null
          created_at?: string
          id?: string
          message?: string | null
          metadata?: Json
          status?: string
        }
        Update: {
          actor_email?: string | null
          actor_id?: string | null
          cart_id?: string
          channel?: string
          coupon_code?: string | null
          created_at?: string
          id?: string
          message?: string | null
          metadata?: Json
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "cart_recovery_attempts_cart_id_fkey"
            columns: ["cart_id"]
            isOneToOne: false
            referencedRelation: "abandoned_carts"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          banner_link: string | null
          banner_url: string | null
          created_at: string
          description_ar: string | null
          description_en: string | null
          display_order: number
          display_rules: Json
          icon: string | null
          id: string
          image_alt: string | null
          image_url: string | null
          is_active: boolean
          meta_description: string | null
          meta_title: string | null
          name_ar: string
          name_en: string
          og_image: string | null
          parent_id: string | null
          slug: string
          updated_at: string
        }
        Insert: {
          banner_link?: string | null
          banner_url?: string | null
          created_at?: string
          description_ar?: string | null
          description_en?: string | null
          display_order?: number
          display_rules?: Json
          icon?: string | null
          id?: string
          image_alt?: string | null
          image_url?: string | null
          is_active?: boolean
          meta_description?: string | null
          meta_title?: string | null
          name_ar: string
          name_en: string
          og_image?: string | null
          parent_id?: string | null
          slug: string
          updated_at?: string
        }
        Update: {
          banner_link?: string | null
          banner_url?: string | null
          created_at?: string
          description_ar?: string | null
          description_en?: string | null
          display_order?: number
          display_rules?: Json
          icon?: string | null
          id?: string
          image_alt?: string | null
          image_url?: string | null
          is_active?: boolean
          meta_description?: string | null
          meta_title?: string | null
          name_ar?: string
          name_en?: string
          og_image?: string | null
          parent_id?: string | null
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      category_products: {
        Row: {
          category_id: string
          created_at: string
          display_order: number
          id: string
          is_pinned: boolean
          product_id: string
        }
        Insert: {
          category_id: string
          created_at?: string
          display_order?: number
          id?: string
          is_pinned?: boolean
          product_id: string
        }
        Update: {
          category_id?: string
          created_at?: string
          display_order?: number
          id?: string
          is_pinned?: boolean
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "category_products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "category_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_submissions: {
        Row: {
          created_at: string
          email: string
          id: string
          message: string
          name: string
          phone: string | null
          status: string
          subject: string | null
          ticket_id: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          message: string
          name: string
          phone?: string | null
          status?: string
          subject?: string | null
          ticket_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          message?: string
          name?: string
          phone?: string | null
          status?: string
          subject?: string | null
          ticket_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contact_submissions_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      content_pages: {
        Row: {
          body_ar: string
          body_en: string
          created_at: string
          id: string
          is_published: boolean
          meta_description_ar: string | null
          meta_description_en: string | null
          show_in_footer: boolean
          slug: string
          sort_order: number
          title_ar: string
          title_en: string
          updated_at: string
        }
        Insert: {
          body_ar?: string
          body_en?: string
          created_at?: string
          id?: string
          is_published?: boolean
          meta_description_ar?: string | null
          meta_description_en?: string | null
          show_in_footer?: boolean
          slug: string
          sort_order?: number
          title_ar: string
          title_en: string
          updated_at?: string
        }
        Update: {
          body_ar?: string
          body_en?: string
          created_at?: string
          id?: string
          is_published?: boolean
          meta_description_ar?: string | null
          meta_description_en?: string | null
          show_in_footer?: boolean
          slug?: string
          sort_order?: number
          title_ar?: string
          title_en?: string
          updated_at?: string
        }
        Relationships: []
      }
      cookie_consents: {
        Row: {
          analytics: boolean
          consent_version: string | null
          created_at: string
          id: string
          ip_address: string | null
          marketing: boolean
          necessary: boolean
          preferences: boolean
          user_agent: string | null
          user_id: string | null
          visitor_id: string | null
        }
        Insert: {
          analytics?: boolean
          consent_version?: string | null
          created_at?: string
          id?: string
          ip_address?: string | null
          marketing?: boolean
          necessary?: boolean
          preferences?: boolean
          user_agent?: string | null
          user_id?: string | null
          visitor_id?: string | null
        }
        Update: {
          analytics?: boolean
          consent_version?: string | null
          created_at?: string
          id?: string
          ip_address?: string | null
          marketing?: boolean
          necessary?: boolean
          preferences?: boolean
          user_agent?: string | null
          user_id?: string | null
          visitor_id?: string | null
        }
        Relationships: []
      }
      coupon_redemptions: {
        Row: {
          coupon_id: string
          created_at: string
          customer_email: string | null
          customer_phone: string | null
          discount_amount: number
          id: string
          order_id: string | null
          order_total: number
          user_id: string | null
        }
        Insert: {
          coupon_id: string
          created_at?: string
          customer_email?: string | null
          customer_phone?: string | null
          discount_amount?: number
          id?: string
          order_id?: string | null
          order_total?: number
          user_id?: string | null
        }
        Update: {
          coupon_id?: string
          created_at?: string
          customer_email?: string | null
          customer_phone?: string | null
          discount_amount?: number
          id?: string
          order_id?: string | null
          order_total?: number
          user_id?: string | null
        }
        Relationships: []
      }
      coupons: {
        Row: {
          allowed_cities: Json
          allowed_payment_methods: Json
          allowed_shipping_zones: Json
          allowed_user_ids: Json
          auto_apply: boolean
          bundle_config: Json
          bxgy_config: Json
          code: string
          created_at: string
          description: string | null
          discount_total: number
          discount_type: string
          discount_value: number
          excluded_product_ids: Json
          expires_at: string | null
          first_order_only: boolean
          id: string
          included_category_ids: Json
          included_product_ids: Json
          is_active: boolean
          max_uses: number | null
          min_subtotal: number | null
          name: string | null
          no_combine: boolean
          offer_type: string
          per_customer_limit: number | null
          priority: number
          revenue_total: number
          starts_at: string | null
          updated_at: string
          used_count: number
        }
        Insert: {
          allowed_cities?: Json
          allowed_payment_methods?: Json
          allowed_shipping_zones?: Json
          allowed_user_ids?: Json
          auto_apply?: boolean
          bundle_config?: Json
          bxgy_config?: Json
          code: string
          created_at?: string
          description?: string | null
          discount_total?: number
          discount_type?: string
          discount_value?: number
          excluded_product_ids?: Json
          expires_at?: string | null
          first_order_only?: boolean
          id?: string
          included_category_ids?: Json
          included_product_ids?: Json
          is_active?: boolean
          max_uses?: number | null
          min_subtotal?: number | null
          name?: string | null
          no_combine?: boolean
          offer_type?: string
          per_customer_limit?: number | null
          priority?: number
          revenue_total?: number
          starts_at?: string | null
          updated_at?: string
          used_count?: number
        }
        Update: {
          allowed_cities?: Json
          allowed_payment_methods?: Json
          allowed_shipping_zones?: Json
          allowed_user_ids?: Json
          auto_apply?: boolean
          bundle_config?: Json
          bxgy_config?: Json
          code?: string
          created_at?: string
          description?: string | null
          discount_total?: number
          discount_type?: string
          discount_value?: number
          excluded_product_ids?: Json
          expires_at?: string | null
          first_order_only?: boolean
          id?: string
          included_category_ids?: Json
          included_product_ids?: Json
          is_active?: boolean
          max_uses?: number | null
          min_subtotal?: number | null
          name?: string | null
          no_combine?: boolean
          offer_type?: string
          per_customer_limit?: number | null
          priority?: number
          revenue_total?: number
          starts_at?: string | null
          updated_at?: string
          used_count?: number
        }
        Relationships: []
      }
      customer_communications: {
        Row: {
          actor_email: string | null
          actor_id: string | null
          body: string | null
          channel: string
          created_at: string
          customer_user_id: string
          direction: string
          id: string
          metadata: Json
          subject: string | null
        }
        Insert: {
          actor_email?: string | null
          actor_id?: string | null
          body?: string | null
          channel: string
          created_at?: string
          customer_user_id: string
          direction?: string
          id?: string
          metadata?: Json
          subject?: string | null
        }
        Update: {
          actor_email?: string | null
          actor_id?: string | null
          body?: string | null
          channel?: string
          created_at?: string
          customer_user_id?: string
          direction?: string
          id?: string
          metadata?: Json
          subject?: string | null
        }
        Relationships: []
      }
      customer_consents: {
        Row: {
          consent_version: string | null
          created_at: string
          data_processing: boolean
          ip_address: string | null
          marketing_email: boolean
          marketing_push: boolean
          marketing_sms: boolean
          marketing_whatsapp: boolean
          source: string | null
          third_party_sharing: boolean
          transactional_email: boolean
          transactional_sms: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          consent_version?: string | null
          created_at?: string
          data_processing?: boolean
          ip_address?: string | null
          marketing_email?: boolean
          marketing_push?: boolean
          marketing_sms?: boolean
          marketing_whatsapp?: boolean
          source?: string | null
          third_party_sharing?: boolean
          transactional_email?: boolean
          transactional_sms?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          consent_version?: string | null
          created_at?: string
          data_processing?: boolean
          ip_address?: string | null
          marketing_email?: boolean
          marketing_push?: boolean
          marketing_sms?: boolean
          marketing_whatsapp?: boolean
          source?: string | null
          third_party_sharing?: boolean
          transactional_email?: boolean
          transactional_sms?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      data_export_requests: {
        Row: {
          completed_at: string | null
          download_url: string | null
          expires_at: string | null
          id: string
          notes: string | null
          requested_at: string
          status: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          download_url?: string | null
          expires_at?: string | null
          id?: string
          notes?: string | null
          requested_at?: string
          status?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          download_url?: string | null
          expires_at?: string | null
          id?: string
          notes?: string | null
          requested_at?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      error_logs: {
        Row: {
          category: string
          code: string
          context: Json
          created_at: string
          id: string
          ip_address: string | null
          message_admin: string
          message_customer: string | null
          order_id: string | null
          resolved: boolean
          resolved_at: string | null
          resolved_by: string | null
          severity: string
          suggested_action: string | null
          url: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          category?: string
          code: string
          context?: Json
          created_at?: string
          id?: string
          ip_address?: string | null
          message_admin: string
          message_customer?: string | null
          order_id?: string | null
          resolved?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          suggested_action?: string | null
          url?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          category?: string
          code?: string
          context?: Json
          created_at?: string
          id?: string
          ip_address?: string | null
          message_admin?: string
          message_customer?: string | null
          order_id?: string | null
          resolved?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          suggested_action?: string | null
          url?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      failed_login_attempts: {
        Row: {
          created_at: string
          email: string | null
          id: string
          ip_address: string | null
          metadata: Json
          reason: string | null
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json
          reason?: string | null
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json
          reason?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      faq_items: {
        Row: {
          answer_ar: string
          answer_en: string | null
          category: string
          created_at: string
          id: string
          is_enabled: boolean
          question_ar: string
          question_en: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          answer_ar: string
          answer_en?: string | null
          category?: string
          created_at?: string
          id?: string
          is_enabled?: boolean
          question_ar: string
          question_en?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          answer_ar?: string
          answer_en?: string | null
          category?: string
          created_at?: string
          id?: string
          is_enabled?: boolean
          question_ar?: string
          question_en?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      featured_categories: {
        Row: {
          created_at: string
          id: string
          image_url: string | null
          is_active: boolean
          label_ar: string
          label_en: string
          link_url: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          label_ar: string
          label_en: string
          link_url: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          label_ar?: string
          label_en?: string
          link_url?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      home_sections: {
        Row: {
          config: Json
          created_at: string
          data_source: string
          eyebrow_ar: string | null
          eyebrow_en: string | null
          id: string
          is_active: boolean
          kind: string
          position: number
          product_ids: string[]
          source_ref: string | null
          title_ar: string | null
          title_en: string | null
          updated_at: string
        }
        Insert: {
          config?: Json
          created_at?: string
          data_source?: string
          eyebrow_ar?: string | null
          eyebrow_en?: string | null
          id?: string
          is_active?: boolean
          kind: string
          position?: number
          product_ids?: string[]
          source_ref?: string | null
          title_ar?: string | null
          title_en?: string | null
          updated_at?: string
        }
        Update: {
          config?: Json
          created_at?: string
          data_source?: string
          eyebrow_ar?: string | null
          eyebrow_en?: string | null
          id?: string
          is_active?: boolean
          kind?: string
          position?: number
          product_ids?: string[]
          source_ref?: string | null
          title_ar?: string | null
          title_en?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      idempotency_keys: {
        Row: {
          created_at: string
          expires_at: string
          key: string
          result: Json | null
          scope: string
          status: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          expires_at?: string
          key: string
          result?: Json | null
          scope: string
          status?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          expires_at?: string
          key?: string
          result?: Json | null
          scope?: string
          status?: string
          user_id?: string | null
        }
        Relationships: []
      }
      integrations: {
        Row: {
          api_key: string | null
          api_secret: string | null
          category: string
          config: Json
          created_at: string
          display_name: string | null
          enabled: boolean
          id: string
          last_test_at: string | null
          last_test_message: string | null
          last_test_ok: boolean | null
          mode: string
          provider: string
          updated_at: string
          webhook_secret: string | null
          webhook_url: string | null
        }
        Insert: {
          api_key?: string | null
          api_secret?: string | null
          category: string
          config?: Json
          created_at?: string
          display_name?: string | null
          enabled?: boolean
          id?: string
          last_test_at?: string | null
          last_test_message?: string | null
          last_test_ok?: boolean | null
          mode?: string
          provider: string
          updated_at?: string
          webhook_secret?: string | null
          webhook_url?: string | null
        }
        Update: {
          api_key?: string | null
          api_secret?: string | null
          category?: string
          config?: Json
          created_at?: string
          display_name?: string | null
          enabled?: boolean
          id?: string
          last_test_at?: string | null
          last_test_message?: string | null
          last_test_ok?: boolean | null
          mode?: string
          provider?: string
          updated_at?: string
          webhook_secret?: string | null
          webhook_url?: string | null
        }
        Relationships: []
      }
      inventory_alerts: {
        Row: {
          created_at: string
          email: string | null
          id: string
          notified: boolean
          phone: string | null
          product_id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          notified?: boolean
          phone?: string | null
          product_id: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          notified?: boolean
          phone?: string | null
          product_id?: string
          user_id?: string | null
        }
        Relationships: []
      }
      invoice_counters: {
        Row: {
          last_number: number
          year: number
        }
        Insert: {
          last_number?: number
          year: number
        }
        Update: {
          last_number?: number
          year?: number
        }
        Relationships: []
      }
      invoices: {
        Row: {
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          created_at: string
          currency: string
          customer_email: string | null
          customer_name: string | null
          customer_phone: string | null
          customer_snapshot: Json
          customer_tax_number: string | null
          discount_total: number
          due_date: string | null
          email_sent_at: string | null
          email_sent_count: number
          id: string
          invoice_number: string
          invoice_type: string
          issued_at: string
          items: Json
          notes: string | null
          order_id: string | null
          order_number: string | null
          paid_at: string | null
          payment_method: string | null
          payment_status: string
          pdf_url: string | null
          related_invoice_id: string | null
          shipping_fee: number
          status: string
          store_snapshot: Json
          subtotal: number
          tax_inclusive: boolean
          tax_rate: number
          tax_total: number
          total: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string
          currency?: string
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          customer_snapshot?: Json
          customer_tax_number?: string | null
          discount_total?: number
          due_date?: string | null
          email_sent_at?: string | null
          email_sent_count?: number
          id?: string
          invoice_number: string
          invoice_type?: string
          issued_at?: string
          items?: Json
          notes?: string | null
          order_id?: string | null
          order_number?: string | null
          paid_at?: string | null
          payment_method?: string | null
          payment_status?: string
          pdf_url?: string | null
          related_invoice_id?: string | null
          shipping_fee?: number
          status?: string
          store_snapshot?: Json
          subtotal?: number
          tax_inclusive?: boolean
          tax_rate?: number
          tax_total?: number
          total?: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string
          currency?: string
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          customer_snapshot?: Json
          customer_tax_number?: string | null
          discount_total?: number
          due_date?: string | null
          email_sent_at?: string | null
          email_sent_count?: number
          id?: string
          invoice_number?: string
          invoice_type?: string
          issued_at?: string
          items?: Json
          notes?: string | null
          order_id?: string | null
          order_number?: string | null
          paid_at?: string | null
          payment_method?: string | null
          payment_status?: string
          pdf_url?: string | null
          related_invoice_id?: string | null
          shipping_fee?: number
          status?: string
          store_snapshot?: Json
          subtotal?: number
          tax_inclusive?: boolean
          tax_rate?: number
          tax_total?: number
          total?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      landing_pages: {
        Row: {
          coupon_code: string | null
          created_at: string
          cta_text: string | null
          cta_url: string | null
          description: string | null
          hero_image: string | null
          id: string
          is_active: boolean
          position: number
          product_ids: string[]
          show_as_collection: boolean
          slug: string
          sort_mode: string
          subtitle: string | null
          title: string
          updated_at: string
          utm_campaign: string | null
          views: number
        }
        Insert: {
          coupon_code?: string | null
          created_at?: string
          cta_text?: string | null
          cta_url?: string | null
          description?: string | null
          hero_image?: string | null
          id?: string
          is_active?: boolean
          position?: number
          product_ids?: string[]
          show_as_collection?: boolean
          slug: string
          sort_mode?: string
          subtitle?: string | null
          title: string
          updated_at?: string
          utm_campaign?: string | null
          views?: number
        }
        Update: {
          coupon_code?: string | null
          created_at?: string
          cta_text?: string | null
          cta_url?: string | null
          description?: string | null
          hero_image?: string | null
          id?: string
          is_active?: boolean
          position?: number
          product_ids?: string[]
          show_as_collection?: boolean
          slug?: string
          sort_mode?: string
          subtitle?: string | null
          title?: string
          updated_at?: string
          utm_campaign?: string | null
          views?: number
        }
        Relationships: []
      }
      loyalty_accounts: {
        Row: {
          balance: number
          lifetime_earned: number
          tier: string
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          lifetime_earned?: number
          tier?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          lifetime_earned?: number
          tier?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      loyalty_transactions: {
        Row: {
          created_at: string
          delta: number
          id: string
          metadata: Json
          reason: string
          related_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          delta: number
          id?: string
          metadata?: Json
          reason: string
          related_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          delta?: number
          id?: string
          metadata?: Json
          reason?: string
          related_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      marketing_campaigns: {
        Row: {
          banner_image_url: string | null
          banner_link_url: string | null
          campaign_type: string
          click_count: number
          conversion_count: number
          coupon_code: string | null
          created_at: string
          created_by: string | null
          description: string | null
          email_body: string | null
          email_subject: string | null
          ends_at: string | null
          id: string
          name: string
          open_count: number
          revenue_attributed: number
          sent_count: number
          starts_at: string | null
          status: string
          target_audience: string
          updated_at: string
        }
        Insert: {
          banner_image_url?: string | null
          banner_link_url?: string | null
          campaign_type?: string
          click_count?: number
          conversion_count?: number
          coupon_code?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          email_body?: string | null
          email_subject?: string | null
          ends_at?: string | null
          id?: string
          name: string
          open_count?: number
          revenue_attributed?: number
          sent_count?: number
          starts_at?: string | null
          status?: string
          target_audience?: string
          updated_at?: string
        }
        Update: {
          banner_image_url?: string | null
          banner_link_url?: string | null
          campaign_type?: string
          click_count?: number
          conversion_count?: number
          coupon_code?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          email_body?: string | null
          email_subject?: string | null
          ends_at?: string | null
          id?: string
          name?: string
          open_count?: number
          revenue_attributed?: number
          sent_count?: number
          starts_at?: string | null
          status?: string
          target_audience?: string
          updated_at?: string
        }
        Relationships: []
      }
      messaging_conversations: {
        Row: {
          assigned_to: string | null
          channel: string
          created_at: string
          customer_name: string | null
          customer_phone: string
          customer_user_id: string | null
          id: string
          last_message_at: string | null
          last_message_preview: string | null
          related_order_id: string | null
          status: string
          unread_count: number
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          channel: string
          created_at?: string
          customer_name?: string | null
          customer_phone: string
          customer_user_id?: string | null
          id?: string
          last_message_at?: string | null
          last_message_preview?: string | null
          related_order_id?: string | null
          status?: string
          unread_count?: number
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          channel?: string
          created_at?: string
          customer_name?: string | null
          customer_phone?: string
          customer_user_id?: string | null
          id?: string
          last_message_at?: string | null
          last_message_preview?: string | null
          related_order_id?: string | null
          status?: string
          unread_count?: number
          updated_at?: string
        }
        Relationships: []
      }
      messaging_costs_log: {
        Row: {
          channel: string
          created_at: string
          day: string
          id: string
          message_count: number
          provider_id: string | null
          total_cost: number
        }
        Insert: {
          channel: string
          created_at?: string
          day?: string
          id?: string
          message_count?: number
          provider_id?: string | null
          total_cost?: number
        }
        Update: {
          channel?: string
          created_at?: string
          day?: string
          id?: string
          message_count?: number
          provider_id?: string | null
          total_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "messaging_costs_log_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "messaging_providers"
            referencedColumns: ["id"]
          },
        ]
      }
      messaging_messages: {
        Row: {
          body: string
          channel: string
          conversation_id: string
          cost: number | null
          created_at: string
          delivered_at: string | null
          direction: string
          error_message: string | null
          failed_at: string | null
          id: string
          media_url: string | null
          metadata: Json | null
          provider_id: string | null
          provider_message_id: string | null
          related_entity: string | null
          related_entity_id: string | null
          related_order_id: string | null
          sent_by: string | null
          sent_by_email: string | null
          status: string
          template_key: string | null
        }
        Insert: {
          body: string
          channel: string
          conversation_id: string
          cost?: number | null
          created_at?: string
          delivered_at?: string | null
          direction: string
          error_message?: string | null
          failed_at?: string | null
          id?: string
          media_url?: string | null
          metadata?: Json | null
          provider_id?: string | null
          provider_message_id?: string | null
          related_entity?: string | null
          related_entity_id?: string | null
          related_order_id?: string | null
          sent_by?: string | null
          sent_by_email?: string | null
          status?: string
          template_key?: string | null
        }
        Update: {
          body?: string
          channel?: string
          conversation_id?: string
          cost?: number | null
          created_at?: string
          delivered_at?: string | null
          direction?: string
          error_message?: string | null
          failed_at?: string | null
          id?: string
          media_url?: string | null
          metadata?: Json | null
          provider_id?: string | null
          provider_message_id?: string | null
          related_entity?: string | null
          related_entity_id?: string | null
          related_order_id?: string | null
          sent_by?: string | null
          sent_by_email?: string | null
          status?: string
          template_key?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messaging_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "messaging_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messaging_messages_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "messaging_providers"
            referencedColumns: ["id"]
          },
        ]
      }
      messaging_providers: {
        Row: {
          channel: string
          config: Json
          cost_per_message: number | null
          created_at: string
          id: string
          is_enabled: boolean
          monthly_budget: number | null
          monthly_spend: number
          name: string
          priority: number
          provider_type: string
          spend_reset_at: string
          updated_at: string
        }
        Insert: {
          channel: string
          config?: Json
          cost_per_message?: number | null
          created_at?: string
          id?: string
          is_enabled?: boolean
          monthly_budget?: number | null
          monthly_spend?: number
          name: string
          priority?: number
          provider_type: string
          spend_reset_at?: string
          updated_at?: string
        }
        Update: {
          channel?: string
          config?: Json
          cost_per_message?: number | null
          created_at?: string
          id?: string
          is_enabled?: boolean
          monthly_budget?: number | null
          monthly_spend?: number
          name?: string
          priority?: number
          provider_type?: string
          spend_reset_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      messaging_quick_replies: {
        Row: {
          body: string
          channel: string | null
          created_at: string
          id: string
          is_enabled: boolean
          sort_order: number | null
          title: string
        }
        Insert: {
          body: string
          channel?: string | null
          created_at?: string
          id?: string
          is_enabled?: boolean
          sort_order?: number | null
          title: string
        }
        Update: {
          body?: string
          channel?: string | null
          created_at?: string
          id?: string
          is_enabled?: boolean
          sort_order?: number | null
          title?: string
        }
        Relationships: []
      }
      non_returnable_products: {
        Row: {
          created_at: string
          product_id: string
          reason: string | null
        }
        Insert: {
          created_at?: string
          product_id: string
          reason?: string | null
        }
        Update: {
          created_at?: string
          product_id?: string
          reason?: string | null
        }
        Relationships: []
      }
      notification_log: {
        Row: {
          attempts: number
          audience: string
          body_preview: string | null
          channel: string
          created_at: string
          error_message: string | null
          event_code: string
          failed_at: string | null
          id: string
          metadata: Json
          recipient_email: string | null
          recipient_phone: string | null
          recipient_user_id: string | null
          related_entity: string | null
          related_entity_id: string | null
          sent_at: string | null
          status: string
          subject: string | null
          template_key: string | null
          triggered_by: string | null
          triggered_by_email: string | null
        }
        Insert: {
          attempts?: number
          audience?: string
          body_preview?: string | null
          channel: string
          created_at?: string
          error_message?: string | null
          event_code: string
          failed_at?: string | null
          id?: string
          metadata?: Json
          recipient_email?: string | null
          recipient_phone?: string | null
          recipient_user_id?: string | null
          related_entity?: string | null
          related_entity_id?: string | null
          sent_at?: string | null
          status?: string
          subject?: string | null
          template_key?: string | null
          triggered_by?: string | null
          triggered_by_email?: string | null
        }
        Update: {
          attempts?: number
          audience?: string
          body_preview?: string | null
          channel?: string
          created_at?: string
          error_message?: string | null
          event_code?: string
          failed_at?: string | null
          id?: string
          metadata?: Json
          recipient_email?: string | null
          recipient_phone?: string | null
          recipient_user_id?: string | null
          related_entity?: string | null
          related_entity_id?: string | null
          sent_at?: string | null
          status?: string
          subject?: string | null
          template_key?: string | null
          triggered_by?: string | null
          triggered_by_email?: string | null
        }
        Relationships: []
      }
      notification_preferences: {
        Row: {
          created_at: string
          email_enabled: boolean
          id: string
          marketing_email: boolean
          marketing_sms: boolean
          marketing_whatsapp: boolean
          push_enabled: boolean
          sms_enabled: boolean
          updated_at: string
          user_id: string
          whatsapp_enabled: boolean
        }
        Insert: {
          created_at?: string
          email_enabled?: boolean
          id?: string
          marketing_email?: boolean
          marketing_sms?: boolean
          marketing_whatsapp?: boolean
          push_enabled?: boolean
          sms_enabled?: boolean
          updated_at?: string
          user_id: string
          whatsapp_enabled?: boolean
        }
        Update: {
          created_at?: string
          email_enabled?: boolean
          id?: string
          marketing_email?: boolean
          marketing_sms?: boolean
          marketing_whatsapp?: boolean
          push_enabled?: boolean
          sms_enabled?: boolean
          updated_at?: string
          user_id?: string
          whatsapp_enabled?: boolean
        }
        Relationships: []
      }
      notification_rules: {
        Row: {
          allow_resend: boolean
          audience: string
          channels: Json
          created_at: string
          delay_minutes: number
          description: string | null
          event_code: string
          id: string
          is_enabled: boolean
          max_retries: number
          trigger_mode: string
          updated_at: string
        }
        Insert: {
          allow_resend?: boolean
          audience?: string
          channels?: Json
          created_at?: string
          delay_minutes?: number
          description?: string | null
          event_code: string
          id?: string
          is_enabled?: boolean
          max_retries?: number
          trigger_mode?: string
          updated_at?: string
        }
        Update: {
          allow_resend?: boolean
          audience?: string
          channels?: Json
          created_at?: string
          delay_minutes?: number
          description?: string | null
          event_code?: string
          id?: string
          is_enabled?: boolean
          max_retries?: number
          trigger_mode?: string
          updated_at?: string
        }
        Relationships: []
      }
      notification_templates: {
        Row: {
          audience: string
          body: string
          body_html: string | null
          channel: string
          created_at: string
          description: string | null
          event_code: string
          id: string
          is_enabled: boolean
          language: string
          subject: string | null
          template_key: string
          updated_at: string
          variables: Json
        }
        Insert: {
          audience?: string
          body: string
          body_html?: string | null
          channel: string
          created_at?: string
          description?: string | null
          event_code: string
          id?: string
          is_enabled?: boolean
          language?: string
          subject?: string | null
          template_key: string
          updated_at?: string
          variables?: Json
        }
        Update: {
          audience?: string
          body?: string
          body_html?: string | null
          channel?: string
          created_at?: string
          description?: string | null
          event_code?: string
          id?: string
          is_enabled?: boolean
          language?: string
          subject?: string | null
          template_key?: string
          updated_at?: string
          variables?: Json
        }
        Relationships: []
      }
      order_items: {
        Row: {
          brand: string | null
          color: string | null
          created_at: string
          id: string
          image_url: string | null
          line_total: number
          order_id: string
          product_id: string | null
          product_name: string
          product_slug: string
          qty: number
          size: string | null
          unit_price: number
        }
        Insert: {
          brand?: string | null
          color?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          line_total: number
          order_id: string
          product_id?: string | null
          product_name: string
          product_slug: string
          qty: number
          size?: string | null
          unit_price: number
        }
        Update: {
          brand?: string | null
          color?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          line_total?: number
          order_id?: string
          product_id?: string | null
          product_name?: string
          product_slug?: string
          qty?: number
          size?: string | null
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          assigned_to: string | null
          auto_cancel_after_hours: number | null
          bank_transfer_proof_url: string | null
          bank_transfer_reference: string | null
          bank_transfer_reviewed_at: string | null
          captured_amount: number | null
          created_at: string
          created_by_admin: boolean
          currency: string
          customer_email: string
          customer_name: string
          customer_phone: string
          expires_at: string | null
          id: string
          idempotency_key: string | null
          internal_notes: Json
          invoice_number: string | null
          last_payment_attempt_at: string | null
          last_stage: string | null
          last_transaction_id: string | null
          notes: string | null
          order_number: string
          payment_attempts: number
          payment_failure_reason: string | null
          payment_gateway: string | null
          payment_link: string | null
          payment_link_sent_at: string | null
          payment_method: Database["public"]["Enums"]["payment_method"]
          payment_status: string
          refunded_amount: number | null
          shipping_address: Json
          shipping_carrier: string | null
          shipping_fee: number
          shipping_lat: number | null
          shipping_lng: number | null
          shipping_status: string
          source: string
          status: Database["public"]["Enums"]["order_status"]
          stock_released_at: string | null
          stock_reserved: boolean
          subtotal: number
          tax: number
          total: number
          tracking_number: string | null
          tracking_url: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          assigned_to?: string | null
          auto_cancel_after_hours?: number | null
          bank_transfer_proof_url?: string | null
          bank_transfer_reference?: string | null
          bank_transfer_reviewed_at?: string | null
          captured_amount?: number | null
          created_at?: string
          created_by_admin?: boolean
          currency?: string
          customer_email: string
          customer_name: string
          customer_phone: string
          expires_at?: string | null
          id?: string
          idempotency_key?: string | null
          internal_notes?: Json
          invoice_number?: string | null
          last_payment_attempt_at?: string | null
          last_stage?: string | null
          last_transaction_id?: string | null
          notes?: string | null
          order_number?: string
          payment_attempts?: number
          payment_failure_reason?: string | null
          payment_gateway?: string | null
          payment_link?: string | null
          payment_link_sent_at?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"]
          payment_status?: string
          refunded_amount?: number | null
          shipping_address?: Json
          shipping_carrier?: string | null
          shipping_fee?: number
          shipping_lat?: number | null
          shipping_lng?: number | null
          shipping_status?: string
          source?: string
          status?: Database["public"]["Enums"]["order_status"]
          stock_released_at?: string | null
          stock_reserved?: boolean
          subtotal?: number
          tax?: number
          total?: number
          tracking_number?: string | null
          tracking_url?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          assigned_to?: string | null
          auto_cancel_after_hours?: number | null
          bank_transfer_proof_url?: string | null
          bank_transfer_reference?: string | null
          bank_transfer_reviewed_at?: string | null
          captured_amount?: number | null
          created_at?: string
          created_by_admin?: boolean
          currency?: string
          customer_email?: string
          customer_name?: string
          customer_phone?: string
          expires_at?: string | null
          id?: string
          idempotency_key?: string | null
          internal_notes?: Json
          invoice_number?: string | null
          last_payment_attempt_at?: string | null
          last_stage?: string | null
          last_transaction_id?: string | null
          notes?: string | null
          order_number?: string
          payment_attempts?: number
          payment_failure_reason?: string | null
          payment_gateway?: string | null
          payment_link?: string | null
          payment_link_sent_at?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"]
          payment_status?: string
          refunded_amount?: number | null
          shipping_address?: Json
          shipping_carrier?: string | null
          shipping_fee?: number
          shipping_lat?: number | null
          shipping_lng?: number | null
          shipping_status?: string
          source?: string
          status?: Database["public"]["Enums"]["order_status"]
          stock_released_at?: string | null
          stock_reserved?: boolean
          subtotal?: number
          tax?: number
          total?: number
          tracking_number?: string | null
          tracking_url?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      password_history: {
        Row: {
          created_at: string
          id: string
          password_hash: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          password_hash: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          password_hash?: string
          user_id?: string
        }
        Relationships: []
      }
      payment_method_configs: {
        Row: {
          config: Json
          created_at: string
          display_name_ar: string
          display_name_en: string
          display_order: number
          gateway: string | null
          icon: string | null
          id: string
          is_enabled: boolean
          max_amount: number | null
          method_key: string
          min_amount: number | null
          updated_at: string
        }
        Insert: {
          config?: Json
          created_at?: string
          display_name_ar: string
          display_name_en: string
          display_order?: number
          gateway?: string | null
          icon?: string | null
          id?: string
          is_enabled?: boolean
          max_amount?: number | null
          method_key: string
          min_amount?: number | null
          updated_at?: string
        }
        Update: {
          config?: Json
          created_at?: string
          display_name_ar?: string
          display_name_en?: string
          display_order?: number
          gateway?: string | null
          icon?: string | null
          id?: string
          is_enabled?: boolean
          max_amount?: number | null
          method_key?: string
          min_amount?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      payment_refunds: {
        Row: {
          amount: number
          approved_by: string | null
          approved_by_email: string | null
          completed_at: string | null
          created_at: string
          currency: string
          error_message: string | null
          gateway_refund_id: string | null
          id: string
          is_partial: boolean
          metadata: Json
          order_id: string | null
          reason: string | null
          status: string
          transaction_id: string | null
        }
        Insert: {
          amount: number
          approved_by?: string | null
          approved_by_email?: string | null
          completed_at?: string | null
          created_at?: string
          currency?: string
          error_message?: string | null
          gateway_refund_id?: string | null
          id?: string
          is_partial?: boolean
          metadata?: Json
          order_id?: string | null
          reason?: string | null
          status?: string
          transaction_id?: string | null
        }
        Update: {
          amount?: number
          approved_by?: string | null
          approved_by_email?: string | null
          completed_at?: string | null
          created_at?: string
          currency?: string
          error_message?: string | null
          gateway_refund_id?: string | null
          id?: string
          is_partial?: boolean
          metadata?: Json
          order_id?: string | null
          reason?: string | null
          status?: string
          transaction_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_refunds_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_refunds_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "payment_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_transactions: {
        Row: {
          amount: number
          authorized_at: string | null
          captured_at: string | null
          card_brand: string | null
          card_last4: string | null
          created_at: string
          currency: string
          customer_email: string | null
          customer_name: string | null
          error_code: string | null
          error_message: string | null
          failed_at: string | null
          gateway: string
          gateway_fee: number | null
          gateway_method: string | null
          gateway_reference: string | null
          gateway_transaction_id: string | null
          id: string
          idempotency_key: string | null
          ip_address: string | null
          metadata: Json
          net_amount: number | null
          order_id: string | null
          order_number: string | null
          raw_response: Json | null
          status: string
          updated_at: string
          user_agent: string | null
          webhook_verified: boolean
        }
        Insert: {
          amount?: number
          authorized_at?: string | null
          captured_at?: string | null
          card_brand?: string | null
          card_last4?: string | null
          created_at?: string
          currency?: string
          customer_email?: string | null
          customer_name?: string | null
          error_code?: string | null
          error_message?: string | null
          failed_at?: string | null
          gateway: string
          gateway_fee?: number | null
          gateway_method?: string | null
          gateway_reference?: string | null
          gateway_transaction_id?: string | null
          id?: string
          idempotency_key?: string | null
          ip_address?: string | null
          metadata?: Json
          net_amount?: number | null
          order_id?: string | null
          order_number?: string | null
          raw_response?: Json | null
          status?: string
          updated_at?: string
          user_agent?: string | null
          webhook_verified?: boolean
        }
        Update: {
          amount?: number
          authorized_at?: string | null
          captured_at?: string | null
          card_brand?: string | null
          card_last4?: string | null
          created_at?: string
          currency?: string
          customer_email?: string | null
          customer_name?: string | null
          error_code?: string | null
          error_message?: string | null
          failed_at?: string | null
          gateway?: string
          gateway_fee?: number | null
          gateway_method?: string | null
          gateway_reference?: string | null
          gateway_transaction_id?: string | null
          id?: string
          idempotency_key?: string | null
          ip_address?: string | null
          metadata?: Json
          net_amount?: number | null
          order_id?: string | null
          order_number?: string | null
          raw_response?: Json | null
          status?: string
          updated_at?: string
          user_agent?: string | null
          webhook_verified?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "payment_transactions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_webhooks_log: {
        Row: {
          created_at: string
          event_type: string | null
          gateway: string
          id: string
          ip_address: string | null
          payload: Json
          processed: boolean
          processing_error: string | null
          related_transaction_id: string | null
          signature: string | null
          signature_valid: boolean
        }
        Insert: {
          created_at?: string
          event_type?: string | null
          gateway: string
          id?: string
          ip_address?: string | null
          payload?: Json
          processed?: boolean
          processing_error?: string | null
          related_transaction_id?: string | null
          signature?: string | null
          signature_valid?: boolean
        }
        Update: {
          created_at?: string
          event_type?: string | null
          gateway?: string
          id?: string
          ip_address?: string | null
          payload?: Json
          processed?: boolean
          processing_error?: string | null
          related_transaction_id?: string | null
          signature?: string | null
          signature_valid?: boolean
        }
        Relationships: []
      }
      perf_metrics: {
        Row: {
          connection: string | null
          created_at: string
          device: string | null
          id: string
          metric: string
          navigation_type: string | null
          page: string | null
          rating: string | null
          session_id: string | null
          user_id: string | null
          value: number
        }
        Insert: {
          connection?: string | null
          created_at?: string
          device?: string | null
          id?: string
          metric: string
          navigation_type?: string | null
          page?: string | null
          rating?: string | null
          session_id?: string | null
          user_id?: string | null
          value: number
        }
        Update: {
          connection?: string | null
          created_at?: string
          device?: string | null
          id?: string
          metric?: string
          navigation_type?: string | null
          page?: string | null
          rating?: string | null
          session_id?: string | null
          user_id?: string | null
          value?: number
        }
        Relationships: []
      }
      popular_picks: {
        Row: {
          created_at: string
          id: string
          image_url: string
          is_active: boolean
          label_ar: string
          label_en: string
          link_url: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          image_url: string
          is_active?: boolean
          label_ar: string
          label_en: string
          link_url: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string
          is_active?: boolean
          label_ar?: string
          label_en?: string
          link_url?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      product_offers: {
        Row: {
          config: Json
          created_at: string
          ends_at: string | null
          id: string
          is_active: boolean
          offer_type: string
          product_id: string
          starts_at: string | null
          updated_at: string
        }
        Insert: {
          config?: Json
          created_at?: string
          ends_at?: string | null
          id?: string
          is_active?: boolean
          offer_type: string
          product_id: string
          starts_at?: string | null
          updated_at?: string
        }
        Update: {
          config?: Json
          created_at?: string
          ends_at?: string | null
          id?: string
          is_active?: boolean
          offer_type?: string
          product_id?: string
          starts_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_offers_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_recommendations: {
        Row: {
          created_at: string
          id: string
          position: number
          product_id: string
          recommended_id: string
          type: string
        }
        Insert: {
          created_at?: string
          id?: string
          position?: number
          product_id: string
          recommended_id: string
          type?: string
        }
        Update: {
          created_at?: string
          id?: string
          position?: number
          product_id?: string
          recommended_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_recommendations_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_recommendations_recommended_id_fkey"
            columns: ["recommended_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_relations: {
        Row: {
          created_at: string
          display_order: number
          id: string
          product_id: string
          related_product_id: string
          relation_type: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          id?: string
          product_id: string
          related_product_id: string
          relation_type: string
        }
        Update: {
          created_at?: string
          display_order?: number
          id?: string
          product_id?: string
          related_product_id?: string
          relation_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_relations_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_relations_related_product_id_fkey"
            columns: ["related_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_shipping_restrictions: {
        Row: {
          city: string | null
          created_at: string
          id: string
          product_id: string | null
          reason: string | null
          zone_id: string | null
        }
        Insert: {
          city?: string | null
          created_at?: string
          id?: string
          product_id?: string | null
          reason?: string | null
          zone_id?: string | null
        }
        Update: {
          city?: string | null
          created_at?: string
          id?: string
          product_id?: string | null
          reason?: string | null
          zone_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_shipping_restrictions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_shipping_restrictions_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "shipping_zones"
            referencedColumns: ["id"]
          },
        ]
      }
      product_variants: {
        Row: {
          barcode: string | null
          color: string | null
          compare_at_price: number | null
          cost: number | null
          created_at: string
          flavor: string | null
          id: string
          image_url: string | null
          is_active: boolean
          material: string | null
          price: number | null
          product_id: string
          size: string | null
          sku: string | null
          stock: number
          updated_at: string
          volume: string | null
          weight: number | null
        }
        Insert: {
          barcode?: string | null
          color?: string | null
          compare_at_price?: number | null
          cost?: number | null
          created_at?: string
          flavor?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          material?: string | null
          price?: number | null
          product_id: string
          size?: string | null
          sku?: string | null
          stock?: number
          updated_at?: string
          volume?: string | null
          weight?: number | null
        }
        Update: {
          barcode?: string | null
          color?: string | null
          compare_at_price?: number | null
          cost?: number | null
          created_at?: string
          flavor?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          material?: string | null
          price?: number | null
          product_id?: string
          size?: string | null
          sku?: string | null
          stock?: number
          updated_at?: string
          volume?: string | null
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          allow_preorder: boolean
          attachments: Json | null
          barcode: string | null
          brand: string | null
          category_id: string | null
          colors: Json
          compare_at_price: number | null
          cost: number | null
          created_at: string
          currency: string
          deduct_on: string
          description_ar: string | null
          description_en: string | null
          dimensions: Json | null
          hide_when_out_of_stock: boolean
          id: string
          image_alt: string | null
          image_url: string | null
          images: Json
          is_active: boolean
          low_stock_threshold: number | null
          meta_description: string | null
          meta_title: string | null
          name_ar: string
          name_en: string
          og_image: string | null
          price: number
          product_type: string
          publish_at: string | null
          reserved_stock: number
          sale_ends_at: string | null
          sale_starts_at: string | null
          sales_count: number
          search_vector: unknown
          short_description_ar: string | null
          short_description_en: string | null
          sizes: Json
          sku: string | null
          slug: string
          status: string
          stock: number
          tax_rate: number | null
          updated_at: string
          video_url: string | null
          views_count: number
          weight: number | null
        }
        Insert: {
          allow_preorder?: boolean
          attachments?: Json | null
          barcode?: string | null
          brand?: string | null
          category_id?: string | null
          colors?: Json
          compare_at_price?: number | null
          cost?: number | null
          created_at?: string
          currency?: string
          deduct_on?: string
          description_ar?: string | null
          description_en?: string | null
          dimensions?: Json | null
          hide_when_out_of_stock?: boolean
          id?: string
          image_alt?: string | null
          image_url?: string | null
          images?: Json
          is_active?: boolean
          low_stock_threshold?: number | null
          meta_description?: string | null
          meta_title?: string | null
          name_ar: string
          name_en: string
          og_image?: string | null
          price: number
          product_type?: string
          publish_at?: string | null
          reserved_stock?: number
          sale_ends_at?: string | null
          sale_starts_at?: string | null
          sales_count?: number
          search_vector?: unknown
          short_description_ar?: string | null
          short_description_en?: string | null
          sizes?: Json
          sku?: string | null
          slug: string
          status?: string
          stock?: number
          tax_rate?: number | null
          updated_at?: string
          video_url?: string | null
          views_count?: number
          weight?: number | null
        }
        Update: {
          allow_preorder?: boolean
          attachments?: Json | null
          barcode?: string | null
          brand?: string | null
          category_id?: string | null
          colors?: Json
          compare_at_price?: number | null
          cost?: number | null
          created_at?: string
          currency?: string
          deduct_on?: string
          description_ar?: string | null
          description_en?: string | null
          dimensions?: Json | null
          hide_when_out_of_stock?: boolean
          id?: string
          image_alt?: string | null
          image_url?: string | null
          images?: Json
          is_active?: boolean
          low_stock_threshold?: number | null
          meta_description?: string | null
          meta_title?: string | null
          name_ar?: string
          name_en?: string
          og_image?: string | null
          price?: number
          product_type?: string
          publish_at?: string | null
          reserved_stock?: number
          sale_ends_at?: string | null
          sale_starts_at?: string | null
          sales_count?: number
          search_vector?: unknown
          short_description_ar?: string | null
          short_description_en?: string | null
          sizes?: Json
          sku?: string | null
          slug?: string
          status?: string
          stock?: number
          tax_rate?: number | null
          updated_at?: string
          video_url?: string | null
          views_count?: number
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          city: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          internal_notes: Json
          last_contact_at: string | null
          loyalty_points: number
          phone: string | null
          source: string
          status: string
          tag: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          city?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          internal_notes?: Json
          last_contact_at?: string | null
          loyalty_points?: number
          phone?: string | null
          source?: string
          status?: string
          tag?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          city?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          internal_notes?: Json
          last_contact_at?: string | null
          loyalty_points?: number
          phone?: string | null
          source?: string
          status?: string
          tag?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          is_active: boolean
          p256dh: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          is_active?: boolean
          p256dh: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          is_active?: boolean
          p256dh?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      referrals: {
        Row: {
          created_at: string
          id: string
          referral_code: string
          referred_email: string | null
          referred_user_id: string | null
          referrer_user_id: string
          related_order_id: string | null
          reward_amount: number | null
          reward_type: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          referral_code: string
          referred_email?: string | null
          referred_user_id?: string | null
          referrer_user_id: string
          related_order_id?: string | null
          reward_amount?: number | null
          reward_type?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          referral_code?: string
          referred_email?: string | null
          referred_user_id?: string | null
          referrer_user_id?: string
          related_order_id?: string | null
          reward_amount?: number | null
          reward_type?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      report_runs: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          recipients: Json
          report_key: string
          rows_count: number | null
          schedule_id: string | null
          status: string
          triggered_by: string | null
          triggered_by_email: string | null
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          recipients?: Json
          report_key: string
          rows_count?: number | null
          schedule_id?: string | null
          status?: string
          triggered_by?: string | null
          triggered_by_email?: string | null
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          recipients?: Json
          report_key?: string
          rows_count?: number | null
          schedule_id?: string | null
          status?: string
          triggered_by?: string | null
          triggered_by_email?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "report_runs_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "report_schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      report_schedules: {
        Row: {
          created_at: string
          created_by: string | null
          filters: Json
          frequency: string
          id: string
          is_enabled: boolean
          last_run_at: string | null
          name: string
          next_run_at: string | null
          recipients: Json
          report_key: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          filters?: Json
          frequency?: string
          id?: string
          is_enabled?: boolean
          last_run_at?: string | null
          name: string
          next_run_at?: string | null
          recipients?: Json
          report_key: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          filters?: Json
          frequency?: string
          id?: string
          is_enabled?: boolean
          last_run_at?: string | null
          name?: string
          next_run_at?: string | null
          recipients?: Json
          report_key?: string
          updated_at?: string
        }
        Relationships: []
      }
      return_items: {
        Row: {
          created_at: string
          id: string
          inspection_notes: string | null
          inspection_status: string | null
          order_item_id: string | null
          product_id: string | null
          product_name: string
          qty: number
          reason: string | null
          restock: boolean
          return_request_id: string
          unit_price: number
        }
        Insert: {
          created_at?: string
          id?: string
          inspection_notes?: string | null
          inspection_status?: string | null
          order_item_id?: string | null
          product_id?: string | null
          product_name: string
          qty?: number
          reason?: string | null
          restock?: boolean
          return_request_id: string
          unit_price?: number
        }
        Update: {
          created_at?: string
          id?: string
          inspection_notes?: string | null
          inspection_status?: string | null
          order_item_id?: string | null
          product_id?: string | null
          product_name?: string
          qty?: number
          reason?: string | null
          restock?: boolean
          return_request_id?: string
          unit_price?: number
        }
        Relationships: []
      }
      return_requests: {
        Row: {
          closed_at: string | null
          created_at: string
          customer_email: string
          customer_name: string | null
          customer_notes: string | null
          customer_phone: string | null
          decision_reason: string | null
          exchange_order_id: string | null
          id: string
          internal_notes: Json
          order_id: string
          order_number: string | null
          photos: Json
          reason: string
          reason_details: string | null
          refund_amount: number | null
          refund_method: string
          refunded_at: string | null
          return_number: string
          return_shipping_carrier: string | null
          return_tracking_number: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          reviewed_by_email: string | null
          shipping_fee_deducted: number | null
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          closed_at?: string | null
          created_at?: string
          customer_email: string
          customer_name?: string | null
          customer_notes?: string | null
          customer_phone?: string | null
          decision_reason?: string | null
          exchange_order_id?: string | null
          id?: string
          internal_notes?: Json
          order_id: string
          order_number?: string | null
          photos?: Json
          reason: string
          reason_details?: string | null
          refund_amount?: number | null
          refund_method?: string
          refunded_at?: string | null
          return_number?: string
          return_shipping_carrier?: string | null
          return_tracking_number?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewed_by_email?: string | null
          shipping_fee_deducted?: number | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          closed_at?: string | null
          created_at?: string
          customer_email?: string
          customer_name?: string | null
          customer_notes?: string | null
          customer_phone?: string | null
          decision_reason?: string | null
          exchange_order_id?: string | null
          id?: string
          internal_notes?: Json
          order_id?: string
          order_number?: string | null
          photos?: Json
          reason?: string
          reason_details?: string | null
          refund_amount?: number | null
          refund_method?: string
          refunded_at?: string | null
          return_number?: string
          return_shipping_carrier?: string | null
          return_tracking_number?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewed_by_email?: string | null
          shipping_fee_deducted?: number | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      return_settings: {
        Row: {
          deduct_shipping_fee: boolean
          id: string
          policy_text_ar: string | null
          policy_text_en: string | null
          reasons: Json
          refund_methods: Json
          return_window_days: number
          shipping_fee_amount: number
          updated_at: string
        }
        Insert: {
          deduct_shipping_fee?: boolean
          id?: string
          policy_text_ar?: string | null
          policy_text_en?: string | null
          reasons?: Json
          refund_methods?: Json
          return_window_days?: number
          shipping_fee_amount?: number
          updated_at?: string
        }
        Update: {
          deduct_shipping_fee?: boolean
          id?: string
          policy_text_ar?: string | null
          policy_text_en?: string | null
          reasons?: Json
          refund_methods?: Json
          return_window_days?: number
          shipping_fee_amount?: number
          updated_at?: string
        }
        Relationships: []
      }
      reviews: {
        Row: {
          body: string | null
          created_at: string
          customer_name: string | null
          helpful_count: number
          id: string
          images: Json
          order_id: string | null
          product_id: string
          rating: number
          status: string
          title: string | null
          updated_at: string
          user_id: string | null
          verified_purchase: boolean
        }
        Insert: {
          body?: string | null
          created_at?: string
          customer_name?: string | null
          helpful_count?: number
          id?: string
          images?: Json
          order_id?: string | null
          product_id: string
          rating: number
          status?: string
          title?: string | null
          updated_at?: string
          user_id?: string | null
          verified_purchase?: boolean
        }
        Update: {
          body?: string | null
          created_at?: string
          customer_name?: string | null
          helpful_count?: number
          id?: string
          images?: Json
          order_id?: string | null
          product_id?: string
          rating?: number
          status?: string
          title?: string | null
          updated_at?: string
          user_id?: string | null
          verified_purchase?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "reviews_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          created_at: string
          id: string
          permission: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          created_at?: string
          id?: string
          permission: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          created_at?: string
          id?: string
          permission?: string
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: []
      }
      search_logs: {
        Row: {
          clicked_product_id: string | null
          created_at: string
          id: string
          query: string
          results_count: number
          session_id: string | null
          user_id: string | null
        }
        Insert: {
          clicked_product_id?: string | null
          created_at?: string
          id?: string
          query: string
          results_count?: number
          session_id?: string | null
          user_id?: string | null
        }
        Update: {
          clicked_product_id?: string | null
          created_at?: string
          id?: string
          query?: string
          results_count?: number
          session_id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      search_synonyms: {
        Row: {
          created_at: string
          id: string
          synonym: string
          term: string
        }
        Insert: {
          created_at?: string
          id?: string
          synonym: string
          term: string
        }
        Update: {
          created_at?: string
          id?: string
          synonym?: string
          term?: string
        }
        Relationships: []
      }
      security_settings: {
        Row: {
          api_rate_limit_per_minute: number
          backup_enabled: boolean
          backup_frequency: string
          backup_retention_days: number
          enable_csrf_protection: boolean
          enable_xss_protection: boolean
          force_https: boolean
          id: boolean
          last_backup_at: string | null
          lockout_duration_minutes: number
          lockout_max_attempts: number
          lockout_window_minutes: number
          password_history_count: number
          password_max_age_days: number
          password_min_length: number
          password_require_lowercase: boolean
          password_require_number: boolean
          password_require_symbol: boolean
          password_require_uppercase: boolean
          require_2fa_for_admins: boolean
          require_2fa_for_managers: boolean
          session_absolute_timeout_hours: number
          session_idle_timeout_minutes: number
          session_single_device: boolean
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          api_rate_limit_per_minute?: number
          backup_enabled?: boolean
          backup_frequency?: string
          backup_retention_days?: number
          enable_csrf_protection?: boolean
          enable_xss_protection?: boolean
          force_https?: boolean
          id?: boolean
          last_backup_at?: string | null
          lockout_duration_minutes?: number
          lockout_max_attempts?: number
          lockout_window_minutes?: number
          password_history_count?: number
          password_max_age_days?: number
          password_min_length?: number
          password_require_lowercase?: boolean
          password_require_number?: boolean
          password_require_symbol?: boolean
          password_require_uppercase?: boolean
          require_2fa_for_admins?: boolean
          require_2fa_for_managers?: boolean
          session_absolute_timeout_hours?: number
          session_idle_timeout_minutes?: number
          session_single_device?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          api_rate_limit_per_minute?: number
          backup_enabled?: boolean
          backup_frequency?: string
          backup_retention_days?: number
          enable_csrf_protection?: boolean
          enable_xss_protection?: boolean
          force_https?: boolean
          id?: boolean
          last_backup_at?: string | null
          lockout_duration_minutes?: number
          lockout_max_attempts?: number
          lockout_window_minutes?: number
          password_history_count?: number
          password_max_age_days?: number
          password_min_length?: number
          password_require_lowercase?: boolean
          password_require_number?: boolean
          password_require_symbol?: boolean
          password_require_uppercase?: boolean
          require_2fa_for_admins?: boolean
          require_2fa_for_managers?: boolean
          session_absolute_timeout_hours?: number
          session_idle_timeout_minutes?: number
          session_single_device?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      shipment_tracking_events: {
        Row: {
          created_at: string
          description: string | null
          id: string
          location: string | null
          occurred_at: string
          raw: Json | null
          shipment_id: string
          source: string
          status: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          location?: string | null
          occurred_at?: string
          raw?: Json | null
          shipment_id: string
          source?: string
          status: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          location?: string | null
          occurred_at?: string
          raw?: Json | null
          shipment_id?: string
          source?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "shipment_tracking_events_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
        ]
      }
      shipments: {
        Row: {
          attempts: number
          awb_url: string | null
          carrier_code: string | null
          carrier_id: string | null
          city: string | null
          cod_amount: number | null
          country_code: string | null
          created_at: string
          created_by: string | null
          customer_email: string | null
          customer_name: string | null
          customer_phone: string | null
          declared_value: number | null
          delivered_at: string | null
          dimensions: Json | null
          estimated_delivery_at: string | null
          failure_reason: string | null
          id: string
          is_returned: boolean
          last_polled_at: string | null
          lat: number | null
          lng: number | null
          metadata: Json
          order_id: string | null
          order_number: string | null
          raw_response: Json | null
          return_reason: string | null
          shipped_at: string | null
          shipping_address: Json
          shipping_fee: number | null
          status: string
          tracking_number: string | null
          tracking_url: string | null
          updated_at: string
          weight_kg: number | null
          zone_id: string | null
        }
        Insert: {
          attempts?: number
          awb_url?: string | null
          carrier_code?: string | null
          carrier_id?: string | null
          city?: string | null
          cod_amount?: number | null
          country_code?: string | null
          created_at?: string
          created_by?: string | null
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          declared_value?: number | null
          delivered_at?: string | null
          dimensions?: Json | null
          estimated_delivery_at?: string | null
          failure_reason?: string | null
          id?: string
          is_returned?: boolean
          last_polled_at?: string | null
          lat?: number | null
          lng?: number | null
          metadata?: Json
          order_id?: string | null
          order_number?: string | null
          raw_response?: Json | null
          return_reason?: string | null
          shipped_at?: string | null
          shipping_address?: Json
          shipping_fee?: number | null
          status?: string
          tracking_number?: string | null
          tracking_url?: string | null
          updated_at?: string
          weight_kg?: number | null
          zone_id?: string | null
        }
        Update: {
          attempts?: number
          awb_url?: string | null
          carrier_code?: string | null
          carrier_id?: string | null
          city?: string | null
          cod_amount?: number | null
          country_code?: string | null
          created_at?: string
          created_by?: string | null
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          declared_value?: number | null
          delivered_at?: string | null
          dimensions?: Json | null
          estimated_delivery_at?: string | null
          failure_reason?: string | null
          id?: string
          is_returned?: boolean
          last_polled_at?: string | null
          lat?: number | null
          lng?: number | null
          metadata?: Json
          order_id?: string | null
          order_number?: string | null
          raw_response?: Json | null
          return_reason?: string | null
          shipped_at?: string | null
          shipping_address?: Json
          shipping_fee?: number | null
          status?: string
          tracking_number?: string | null
          tracking_url?: string | null
          updated_at?: string
          weight_kg?: number | null
          zone_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shipments_carrier_id_fkey"
            columns: ["carrier_id"]
            isOneToOne: false
            referencedRelation: "shipping_carriers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipments_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "shipping_zones"
            referencedColumns: ["id"]
          },
        ]
      }
      shipping_carriers: {
        Row: {
          api_credentials: Json
          api_endpoint: string | null
          carrier_type: string
          code: string
          created_at: string
          default_delivery_days_max: number | null
          default_delivery_days_min: number | null
          display_order: number
          id: string
          is_active: boolean
          logo_url: string | null
          name_ar: string
          name_en: string
          supports_cod: boolean
          supports_international: boolean
          supports_tracking: boolean
          supports_webhook: boolean
          updated_at: string
          webhook_secret_name: string | null
        }
        Insert: {
          api_credentials?: Json
          api_endpoint?: string | null
          carrier_type?: string
          code: string
          created_at?: string
          default_delivery_days_max?: number | null
          default_delivery_days_min?: number | null
          display_order?: number
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name_ar: string
          name_en: string
          supports_cod?: boolean
          supports_international?: boolean
          supports_tracking?: boolean
          supports_webhook?: boolean
          updated_at?: string
          webhook_secret_name?: string | null
        }
        Update: {
          api_credentials?: Json
          api_endpoint?: string | null
          carrier_type?: string
          code?: string
          created_at?: string
          default_delivery_days_max?: number | null
          default_delivery_days_min?: number | null
          display_order?: number
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name_ar?: string
          name_en?: string
          supports_cod?: boolean
          supports_international?: boolean
          supports_tracking?: boolean
          supports_webhook?: boolean
          updated_at?: string
          webhook_secret_name?: string | null
        }
        Relationships: []
      }
      shipping_rates: {
        Row: {
          base_fee: number
          carrier_id: string | null
          cod_extra_fee: number | null
          created_at: string
          free_shipping_threshold: number | null
          id: string
          is_active: boolean
          max_order_value: number | null
          max_weight_kg: number | null
          min_order_value: number | null
          min_weight_kg: number | null
          per_kg_fee: number | null
          priority: number
          rate_type: string
          zone_id: string | null
        }
        Insert: {
          base_fee?: number
          carrier_id?: string | null
          cod_extra_fee?: number | null
          created_at?: string
          free_shipping_threshold?: number | null
          id?: string
          is_active?: boolean
          max_order_value?: number | null
          max_weight_kg?: number | null
          min_order_value?: number | null
          min_weight_kg?: number | null
          per_kg_fee?: number | null
          priority?: number
          rate_type?: string
          zone_id?: string | null
        }
        Update: {
          base_fee?: number
          carrier_id?: string | null
          cod_extra_fee?: number | null
          created_at?: string
          free_shipping_threshold?: number | null
          id?: string
          is_active?: boolean
          max_order_value?: number | null
          max_weight_kg?: number | null
          min_order_value?: number | null
          min_weight_kg?: number | null
          per_kg_fee?: number | null
          priority?: number
          rate_type?: string
          zone_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shipping_rates_carrier_id_fkey"
            columns: ["carrier_id"]
            isOneToOne: false
            referencedRelation: "shipping_carriers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipping_rates_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "shipping_zones"
            referencedColumns: ["id"]
          },
        ]
      }
      shipping_webhooks_log: {
        Row: {
          carrier_code: string
          created_at: string
          event_type: string | null
          id: string
          ip_address: string | null
          payload: Json
          processed: boolean
          processing_error: string | null
          related_shipment_id: string | null
          signature: string | null
          signature_valid: boolean
        }
        Insert: {
          carrier_code: string
          created_at?: string
          event_type?: string | null
          id?: string
          ip_address?: string | null
          payload?: Json
          processed?: boolean
          processing_error?: string | null
          related_shipment_id?: string | null
          signature?: string | null
          signature_valid?: boolean
        }
        Update: {
          carrier_code?: string
          created_at?: string
          event_type?: string | null
          id?: string
          ip_address?: string | null
          payload?: Json
          processed?: boolean
          processing_error?: string | null
          related_shipment_id?: string | null
          signature?: string | null
          signature_valid?: boolean
        }
        Relationships: []
      }
      shipping_zones: {
        Row: {
          carrier_id: string | null
          cities: Json
          country_code: string
          created_at: string
          delivery_days_max: number | null
          delivery_days_min: number | null
          id: string
          is_active: boolean
          name_ar: string
          name_en: string
        }
        Insert: {
          carrier_id?: string | null
          cities?: Json
          country_code?: string
          created_at?: string
          delivery_days_max?: number | null
          delivery_days_min?: number | null
          id?: string
          is_active?: boolean
          name_ar: string
          name_en: string
        }
        Update: {
          carrier_id?: string | null
          cities?: Json
          country_code?: string
          created_at?: string
          delivery_days_max?: number | null
          delivery_days_min?: number | null
          id?: string
          is_active?: boolean
          name_ar?: string
          name_en?: string
        }
        Relationships: [
          {
            foreignKeyName: "shipping_zones_carrier_id_fkey"
            columns: ["carrier_id"]
            isOneToOne: false
            referencedRelation: "shipping_carriers"
            referencedColumns: ["id"]
          },
        ]
      }
      site_pages: {
        Row: {
          created_at: string
          id: string
          is_landing: boolean
          is_published: boolean
          layout: string
          meta_description: string | null
          slug: string
          title_ar: string
          title_en: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_landing?: boolean
          is_published?: boolean
          layout?: string
          meta_description?: string | null
          slug: string
          title_ar: string
          title_en?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_landing?: boolean
          is_published?: boolean
          layout?: string
          meta_description?: string | null
          slug?: string
          title_ar?: string
          title_en?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      site_revisions: {
        Row: {
          created_at: string
          created_by: string | null
          created_by_email: string | null
          entity_id: string
          entity_type: string
          id: string
          note: string | null
          snapshot: Json
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          created_by_email?: string | null
          entity_id: string
          entity_type: string
          id?: string
          note?: string | null
          snapshot: Json
        }
        Update: {
          created_at?: string
          created_by?: string | null
          created_by_email?: string | null
          entity_id?: string
          entity_type?: string
          id?: string
          note?: string | null
          snapshot?: Json
        }
        Relationships: []
      }
      site_sections: {
        Row: {
          config: Json
          created_at: string
          display_order: number
          ends_at: string | null
          id: string
          is_visible: boolean
          page_id: string
          section_type: string
          starts_at: string | null
          updated_at: string
        }
        Insert: {
          config?: Json
          created_at?: string
          display_order?: number
          ends_at?: string | null
          id?: string
          is_visible?: boolean
          page_id: string
          section_type: string
          starts_at?: string | null
          updated_at?: string
        }
        Update: {
          config?: Json
          created_at?: string
          display_order?: number
          ends_at?: string | null
          id?: string
          is_visible?: boolean
          page_id?: string
          section_type?: string
          starts_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "site_sections_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "site_pages"
            referencedColumns: ["id"]
          },
        ]
      }
      site_settings: {
        Row: {
          abandoned_cart_delay_minutes: number
          abandoned_cart_recovery_enabled: boolean
          announcement_bar: string | null
          auto_issue_on_payment: boolean
          backup_auto_enabled: boolean
          backup_email: string | null
          backup_frequency: string
          backup_last_run_at: string | null
          commercial_register: string | null
          company_legal_name: string | null
          currency_code: string | null
          currency_symbol: string | null
          default_language: string
          favicon_url: string | null
          first_order_coupon_code: string | null
          first_order_coupon_discount: number | null
          free_shipping_threshold: number | null
          guest_checkout_enabled: boolean
          hero_image_url: string | null
          hero_subtitle_ar: string | null
          hero_subtitle_en: string | null
          hero_title_ar: string | null
          hero_title_en: string | null
          id: number
          inventory_allow_backorder: boolean
          inventory_hide_when_out: boolean
          inventory_low_stock_threshold: number
          inventory_reserve_on_checkout: boolean
          invoice_footer_note: string | null
          invoice_logo_url: string | null
          invoice_prefix: string | null
          issue_tax_invoice: boolean
          logo_url: string | null
          loyalty_enabled: boolean
          loyalty_points_per_currency: number
          loyalty_redeem_rate: number
          loyalty_signup_bonus: number
          maintenance_allowed_ips: string[] | null
          maintenance_message: string | null
          maintenance_mode: boolean
          min_order_amount: number | null
          notify_admin_low_stock: boolean
          notify_admin_new_order: boolean
          notify_channel_email: boolean
          notify_channel_sms: boolean
          notify_channel_whatsapp: boolean
          notify_customer_order_status: boolean
          order_auto_confirm: boolean
          order_payment_timeout_minutes: number
          primary_color: string | null
          privacy_cookie_banner: boolean
          privacy_data_retention_days: number
          privacy_marketing_consent: boolean
          privacy_policy: string | null
          referral_enabled: boolean
          referral_referred_reward: number
          referral_referrer_reward: number
          return_policy: string | null
          seo_description: string | null
          seo_keywords: string | null
          seo_og_image: string | null
          seo_robots: string
          seo_title: string | null
          shipping_fee: number | null
          shipping_policy: string | null
          show_trust_badges: boolean
          social_facebook: string | null
          social_instagram: string | null
          social_snapchat: string | null
          social_tiktok: string | null
          social_twitter: string | null
          social_youtube: string | null
          store_address: string | null
          store_city: string | null
          store_country: string | null
          store_name: string
          store_phone: string | null
          support_email: string | null
          supported_languages: string[]
          tax_inclusive: boolean
          tax_label: string | null
          tax_number: string | null
          tax_rate: number | null
          terms_of_service: string | null
          trust_badges: Json
          updated_at: string
          upsell_enabled: boolean
          whatsapp_number: string | null
        }
        Insert: {
          abandoned_cart_delay_minutes?: number
          abandoned_cart_recovery_enabled?: boolean
          announcement_bar?: string | null
          auto_issue_on_payment?: boolean
          backup_auto_enabled?: boolean
          backup_email?: string | null
          backup_frequency?: string
          backup_last_run_at?: string | null
          commercial_register?: string | null
          company_legal_name?: string | null
          currency_code?: string | null
          currency_symbol?: string | null
          default_language?: string
          favicon_url?: string | null
          first_order_coupon_code?: string | null
          first_order_coupon_discount?: number | null
          free_shipping_threshold?: number | null
          guest_checkout_enabled?: boolean
          hero_image_url?: string | null
          hero_subtitle_ar?: string | null
          hero_subtitle_en?: string | null
          hero_title_ar?: string | null
          hero_title_en?: string | null
          id?: number
          inventory_allow_backorder?: boolean
          inventory_hide_when_out?: boolean
          inventory_low_stock_threshold?: number
          inventory_reserve_on_checkout?: boolean
          invoice_footer_note?: string | null
          invoice_logo_url?: string | null
          invoice_prefix?: string | null
          issue_tax_invoice?: boolean
          logo_url?: string | null
          loyalty_enabled?: boolean
          loyalty_points_per_currency?: number
          loyalty_redeem_rate?: number
          loyalty_signup_bonus?: number
          maintenance_allowed_ips?: string[] | null
          maintenance_message?: string | null
          maintenance_mode?: boolean
          min_order_amount?: number | null
          notify_admin_low_stock?: boolean
          notify_admin_new_order?: boolean
          notify_channel_email?: boolean
          notify_channel_sms?: boolean
          notify_channel_whatsapp?: boolean
          notify_customer_order_status?: boolean
          order_auto_confirm?: boolean
          order_payment_timeout_minutes?: number
          primary_color?: string | null
          privacy_cookie_banner?: boolean
          privacy_data_retention_days?: number
          privacy_marketing_consent?: boolean
          privacy_policy?: string | null
          referral_enabled?: boolean
          referral_referred_reward?: number
          referral_referrer_reward?: number
          return_policy?: string | null
          seo_description?: string | null
          seo_keywords?: string | null
          seo_og_image?: string | null
          seo_robots?: string
          seo_title?: string | null
          shipping_fee?: number | null
          shipping_policy?: string | null
          show_trust_badges?: boolean
          social_facebook?: string | null
          social_instagram?: string | null
          social_snapchat?: string | null
          social_tiktok?: string | null
          social_twitter?: string | null
          social_youtube?: string | null
          store_address?: string | null
          store_city?: string | null
          store_country?: string | null
          store_name?: string
          store_phone?: string | null
          support_email?: string | null
          supported_languages?: string[]
          tax_inclusive?: boolean
          tax_label?: string | null
          tax_number?: string | null
          tax_rate?: number | null
          terms_of_service?: string | null
          trust_badges?: Json
          updated_at?: string
          upsell_enabled?: boolean
          whatsapp_number?: string | null
        }
        Update: {
          abandoned_cart_delay_minutes?: number
          abandoned_cart_recovery_enabled?: boolean
          announcement_bar?: string | null
          auto_issue_on_payment?: boolean
          backup_auto_enabled?: boolean
          backup_email?: string | null
          backup_frequency?: string
          backup_last_run_at?: string | null
          commercial_register?: string | null
          company_legal_name?: string | null
          currency_code?: string | null
          currency_symbol?: string | null
          default_language?: string
          favicon_url?: string | null
          first_order_coupon_code?: string | null
          first_order_coupon_discount?: number | null
          free_shipping_threshold?: number | null
          guest_checkout_enabled?: boolean
          hero_image_url?: string | null
          hero_subtitle_ar?: string | null
          hero_subtitle_en?: string | null
          hero_title_ar?: string | null
          hero_title_en?: string | null
          id?: number
          inventory_allow_backorder?: boolean
          inventory_hide_when_out?: boolean
          inventory_low_stock_threshold?: number
          inventory_reserve_on_checkout?: boolean
          invoice_footer_note?: string | null
          invoice_logo_url?: string | null
          invoice_prefix?: string | null
          issue_tax_invoice?: boolean
          logo_url?: string | null
          loyalty_enabled?: boolean
          loyalty_points_per_currency?: number
          loyalty_redeem_rate?: number
          loyalty_signup_bonus?: number
          maintenance_allowed_ips?: string[] | null
          maintenance_message?: string | null
          maintenance_mode?: boolean
          min_order_amount?: number | null
          notify_admin_low_stock?: boolean
          notify_admin_new_order?: boolean
          notify_channel_email?: boolean
          notify_channel_sms?: boolean
          notify_channel_whatsapp?: boolean
          notify_customer_order_status?: boolean
          order_auto_confirm?: boolean
          order_payment_timeout_minutes?: number
          primary_color?: string | null
          privacy_cookie_banner?: boolean
          privacy_data_retention_days?: number
          privacy_marketing_consent?: boolean
          privacy_policy?: string | null
          referral_enabled?: boolean
          referral_referred_reward?: number
          referral_referrer_reward?: number
          return_policy?: string | null
          seo_description?: string | null
          seo_keywords?: string | null
          seo_og_image?: string | null
          seo_robots?: string
          seo_title?: string | null
          shipping_fee?: number | null
          shipping_policy?: string | null
          show_trust_badges?: boolean
          social_facebook?: string | null
          social_instagram?: string | null
          social_snapchat?: string | null
          social_tiktok?: string | null
          social_twitter?: string | null
          social_youtube?: string | null
          store_address?: string | null
          store_city?: string | null
          store_country?: string | null
          store_name?: string
          store_phone?: string | null
          support_email?: string | null
          supported_languages?: string[]
          tax_inclusive?: boolean
          tax_label?: string | null
          tax_number?: string | null
          tax_rate?: number | null
          terms_of_service?: string | null
          trust_badges?: Json
          updated_at?: string
          upsell_enabled?: boolean
          whatsapp_number?: string | null
        }
        Relationships: []
      }
      site_themes: {
        Row: {
          branding: Json
          colors: Json
          components: Json
          created_at: string
          created_by: string | null
          fonts: Json
          id: string
          is_active: boolean
          is_draft: boolean
          name: string
          tokens: Json
          updated_at: string
        }
        Insert: {
          branding?: Json
          colors?: Json
          components?: Json
          created_at?: string
          created_by?: string | null
          fonts?: Json
          id?: string
          is_active?: boolean
          is_draft?: boolean
          name: string
          tokens?: Json
          updated_at?: string
        }
        Update: {
          branding?: Json
          colors?: Json
          components?: Json
          created_at?: string
          created_by?: string | null
          fonts?: Json
          id?: string
          is_active?: boolean
          is_draft?: boolean
          name?: string
          tokens?: Json
          updated_at?: string
        }
        Relationships: []
      }
      sms_otp_codes: {
        Row: {
          attempts: number
          code_hash: string
          consumed_at: string | null
          created_at: string
          expires_at: string
          id: string
          max_attempts: number
          phone: string
          purpose: string
        }
        Insert: {
          attempts?: number
          code_hash: string
          consumed_at?: string | null
          created_at?: string
          expires_at: string
          id?: string
          max_attempts?: number
          phone: string
          purpose?: string
        }
        Update: {
          attempts?: number
          code_hash?: string
          consumed_at?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          max_attempts?: number
          phone?: string
          purpose?: string
        }
        Relationships: []
      }
      storefront_banners: {
        Row: {
          created_at: string
          cta_label_ar: string | null
          cta_label_en: string | null
          cta_url: string | null
          eyebrow_ar: string | null
          eyebrow_en: string | null
          id: string
          image_url: string
          is_active: boolean
          sort_order: number
          subtitle_ar: string | null
          subtitle_en: string | null
          title_ar: string | null
          title_en: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          cta_label_ar?: string | null
          cta_label_en?: string | null
          cta_url?: string | null
          eyebrow_ar?: string | null
          eyebrow_en?: string | null
          id?: string
          image_url: string
          is_active?: boolean
          sort_order?: number
          subtitle_ar?: string | null
          subtitle_en?: string | null
          title_ar?: string | null
          title_en?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          cta_label_ar?: string | null
          cta_label_en?: string | null
          cta_url?: string | null
          eyebrow_ar?: string | null
          eyebrow_en?: string | null
          id?: string
          image_url?: string
          is_active?: boolean
          sort_order?: number
          subtitle_ar?: string | null
          subtitle_en?: string | null
          title_ar?: string | null
          title_en?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      storefront_settings: {
        Row: {
          announcement_rotate_seconds: number
          banner_autoplay_seconds: number
          banner_display_mode: string
          footer_about_ar: string | null
          footer_about_en: string | null
          footer_address_ar: string | null
          footer_address_en: string | null
          footer_email: string | null
          footer_instagram: string | null
          footer_phone: string | null
          footer_tiktok: string | null
          footer_whatsapp: string | null
          id: boolean
          updated_at: string
        }
        Insert: {
          announcement_rotate_seconds?: number
          banner_autoplay_seconds?: number
          banner_display_mode?: string
          footer_about_ar?: string | null
          footer_about_en?: string | null
          footer_address_ar?: string | null
          footer_address_en?: string | null
          footer_email?: string | null
          footer_instagram?: string | null
          footer_phone?: string | null
          footer_tiktok?: string | null
          footer_whatsapp?: string | null
          id?: boolean
          updated_at?: string
        }
        Update: {
          announcement_rotate_seconds?: number
          banner_autoplay_seconds?: number
          banner_display_mode?: string
          footer_about_ar?: string | null
          footer_about_en?: string | null
          footer_address_ar?: string | null
          footer_address_en?: string | null
          footer_email?: string | null
          footer_instagram?: string | null
          footer_phone?: string | null
          footer_tiktok?: string | null
          footer_whatsapp?: string | null
          id?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      support_canned_replies: {
        Row: {
          body: string
          category: string | null
          created_at: string
          id: string
          is_enabled: boolean
          sort_order: number | null
          template_key: string | null
          title: string
        }
        Insert: {
          body: string
          category?: string | null
          created_at?: string
          id?: string
          is_enabled?: boolean
          sort_order?: number | null
          template_key?: string | null
          title: string
        }
        Update: {
          body?: string
          category?: string | null
          created_at?: string
          id?: string
          is_enabled?: boolean
          sort_order?: number | null
          template_key?: string | null
          title?: string
        }
        Relationships: []
      }
      support_ticket_messages: {
        Row: {
          attachments: Json
          author_email: string | null
          author_id: string | null
          author_name: string | null
          body: string
          created_at: string
          direction: string
          id: string
          is_internal_note: boolean
          ticket_id: string
        }
        Insert: {
          attachments?: Json
          author_email?: string | null
          author_id?: string | null
          author_name?: string | null
          body: string
          created_at?: string
          direction: string
          id?: string
          is_internal_note?: boolean
          ticket_id: string
        }
        Update: {
          attachments?: Json
          author_email?: string | null
          author_id?: string | null
          author_name?: string | null
          body?: string
          created_at?: string
          direction?: string
          id?: string
          is_internal_note?: boolean
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_ticket_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_ticket_ratings: {
        Row: {
          comment: string | null
          created_at: string
          customer_user_id: string | null
          id: string
          rating: number
          ticket_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          customer_user_id?: string | null
          id?: string
          rating: number
          ticket_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          customer_user_id?: string | null
          id?: string
          rating?: number
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_ticket_ratings_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: true
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          assigned_to: string | null
          category: string
          closed_at: string | null
          created_at: string
          customer_email: string
          customer_name: string | null
          customer_phone: string | null
          customer_user_id: string | null
          id: string
          last_reply_at: string | null
          last_reply_by: string | null
          priority: string
          related_order_id: string | null
          related_order_number: string | null
          source: string
          status: string
          subject: string
          ticket_number: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          category?: string
          closed_at?: string | null
          created_at?: string
          customer_email: string
          customer_name?: string | null
          customer_phone?: string | null
          customer_user_id?: string | null
          id?: string
          last_reply_at?: string | null
          last_reply_by?: string | null
          priority?: string
          related_order_id?: string | null
          related_order_number?: string | null
          source?: string
          status?: string
          subject: string
          ticket_number?: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          category?: string
          closed_at?: string | null
          created_at?: string
          customer_email?: string
          customer_name?: string | null
          customer_phone?: string | null
          customer_user_id?: string | null
          id?: string
          last_reply_at?: string | null
          last_reply_by?: string | null
          priority?: string
          related_order_id?: string | null
          related_order_number?: string | null
          source?: string
          status?: string
          subject?: string
          ticket_number?: string
          updated_at?: string
        }
        Relationships: []
      }
      unsubscribe_tokens: {
        Row: {
          channel: string
          created_at: string
          email: string | null
          token: string
          used_at: string | null
          user_id: string | null
        }
        Insert: {
          channel?: string
          created_at?: string
          email?: string | null
          token: string
          used_at?: string | null
          user_id?: string | null
        }
        Update: {
          channel?: string
          created_at?: string
          email?: string | null
          token?: string
          used_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      user_2fa: {
        Row: {
          backup_codes_hash: string[] | null
          created_at: string
          enabled: boolean
          enrolled_at: string | null
          last_used_at: string | null
          recovery_email: string | null
          secret_encrypted: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          backup_codes_hash?: string[] | null
          created_at?: string
          enabled?: boolean
          enrolled_at?: string | null
          last_used_at?: string | null
          recovery_email?: string | null
          secret_encrypted?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          backup_codes_hash?: string[] | null
          created_at?: string
          enabled?: boolean
          enrolled_at?: string | null
          last_used_at?: string | null
          recovery_email?: string | null
          secret_encrypted?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
          role?: Database["public"]["Enums"]["app_role"]
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
      webhook_deliveries: {
        Row: {
          attempt: number
          created_at: string
          delivered_at: string | null
          endpoint_id: string | null
          error_message: string | null
          event_id: string
          event_type: string
          http_status: number | null
          id: string
          max_attempts: number
          next_retry_at: string | null
          payload: Json
          response_body: string | null
          status: string
        }
        Insert: {
          attempt?: number
          created_at?: string
          delivered_at?: string | null
          endpoint_id?: string | null
          error_message?: string | null
          event_id: string
          event_type: string
          http_status?: number | null
          id?: string
          max_attempts?: number
          next_retry_at?: string | null
          payload: Json
          response_body?: string | null
          status?: string
        }
        Update: {
          attempt?: number
          created_at?: string
          delivered_at?: string | null
          endpoint_id?: string | null
          error_message?: string | null
          event_id?: string
          event_type?: string
          http_status?: number | null
          id?: string
          max_attempts?: number
          next_retry_at?: string | null
          payload?: Json
          response_body?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_deliveries_endpoint_id_fkey"
            columns: ["endpoint_id"]
            isOneToOne: false
            referencedRelation: "webhook_endpoints"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_endpoints: {
        Row: {
          created_at: string
          enabled: boolean
          events: string[]
          failure_count: number
          id: string
          last_delivery_at: string | null
          last_delivery_status: number | null
          name: string
          secret: string | null
          updated_at: string
          url: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          events?: string[]
          failure_count?: number
          id?: string
          last_delivery_at?: string | null
          last_delivery_status?: number | null
          name: string
          secret?: string | null
          updated_at?: string
          url: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          events?: string[]
          failure_count?: number
          id?: string
          last_delivery_at?: string | null
          last_delivery_status?: number | null
          name?: string
          secret?: string | null
          updated_at?: string
          url?: string
        }
        Relationships: []
      }
      webhook_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          payload: Json
          processed_at: string | null
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          payload: Json
          processed_at?: string | null
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          payload?: Json
          processed_at?: string | null
        }
        Relationships: []
      }
      wishlist_items: {
        Row: {
          created_at: string
          item_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          item_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          item_id?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      auto_cancel_expired_orders: { Args: never; Returns: number }
      check_account_lockout: {
        Args: { _email: string }
        Returns: {
          locked: boolean
          locked_until: string
          remaining_attempts: number
        }[]
      }
      emit_webhook_event: {
        Args: { _event_type: string; _payload: Json }
        Returns: string
      }
      get_profile_safe: {
        Args: { _user_id: string }
        Returns: {
          created_at: string
          email: string
          full_name: string
          masked: boolean
          phone: string
          user_id: string
        }[]
      }
      has_permission: {
        Args: { _permission: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_product_views: {
        Args: { _product_id: string }
        Returns: undefined
      }
      log_audit_event: {
        Args: {
          _action: string
          _entity?: string
          _entity_id?: string
          _ip?: string
          _metadata?: Json
          _new_data?: Json
          _old_data?: Json
          _ua?: string
        }
        Returns: string
      }
      mask_email: { Args: { _email: string }; Returns: string }
      mask_phone: { Args: { _phone: string }; Returns: string }
      next_invoice_number: { Args: { _prefix?: string }; Returns: string }
      notify_shipping_delays: {
        Args: {
          _intransit_threshold_days?: number
          _pending_threshold_hours?: number
        }
        Returns: {
          kind: string
          notified: number
        }[]
      }
      refresh_product_sales_counts: { Args: never; Returns: undefined }
      register_failed_login: { Args: { _email: string }; Returns: undefined }
      release_expired_order_stock: {
        Args: { _order_id: string }
        Returns: undefined
      }
      search_autocomplete: {
        Args: { _limit?: number; _q: string }
        Returns: {
          id: string
          image_url: string
          kind: string
          label_ar: string
          label_en: string
          price: number
          similarity: number
          slug: string
        }[]
      }
      search_spell_suggest: { Args: { _q: string }; Returns: string }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      unaccent: { Args: { "": string }; Returns: string }
    }
    Enums: {
      app_role:
        | "admin"
        | "staff"
        | "customer"
        | "manager"
        | "viewer"
        | "super_admin"
        | "store_manager"
        | "orders_manager"
        | "support"
        | "inventory_manager"
        | "marketing_manager"
        | "finance_manager"
        | "content_manager"
        | "developer"
      order_status:
        | "pending"
        | "paid"
        | "processing"
        | "shipped"
        | "delivered"
        | "cancelled"
        | "refunded"
        | "payment_failed"
        | "under_review"
        | "ready_to_ship"
        | "out_for_delivery"
        | "returned"
        | "partially_refunded"
        | "fraud"
        | "pending_customer"
      payment_method: "cod" | "card" | "apple_pay" | "bank_transfer"
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
      app_role: [
        "admin",
        "staff",
        "customer",
        "manager",
        "viewer",
        "super_admin",
        "store_manager",
        "orders_manager",
        "support",
        "inventory_manager",
        "marketing_manager",
        "finance_manager",
        "content_manager",
        "developer",
      ],
      order_status: [
        "pending",
        "paid",
        "processing",
        "shipped",
        "delivered",
        "cancelled",
        "refunded",
        "payment_failed",
        "under_review",
        "ready_to_ship",
        "out_for_delivery",
        "returned",
        "partially_refunded",
        "fraud",
        "pending_customer",
      ],
      payment_method: ["cod", "card", "apple_pay", "bank_transfer"],
    },
  },
} as const

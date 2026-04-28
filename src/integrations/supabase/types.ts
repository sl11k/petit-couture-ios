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
      abandoned_carts: {
        Row: {
          converted: boolean
          created_at: string
          currency: string
          email: string | null
          id: string
          items: Json
          phone: string | null
          reached_checkout: boolean
          session_id: string
          subtotal: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          converted?: boolean
          created_at?: string
          currency?: string
          email?: string | null
          id?: string
          items?: Json
          phone?: string | null
          reached_checkout?: boolean
          session_id: string
          subtotal?: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          converted?: boolean
          created_at?: string
          currency?: string
          email?: string | null
          id?: string
          items?: Json
          phone?: string | null
          reached_checkout?: boolean
          session_id?: string
          subtotal?: number
          updated_at?: string
          user_id?: string | null
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
      audit_logs: {
        Row: {
          action: string
          actor_email: string | null
          actor_id: string | null
          created_at: string
          entity: string | null
          entity_id: string | null
          id: string
          metadata: Json
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          entity?: string | null
          entity_id?: string | null
          id?: string
          metadata?: Json
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          entity?: string | null
          entity_id?: string | null
          id?: string
          metadata?: Json
        }
        Relationships: []
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
      coupons: {
        Row: {
          code: string
          created_at: string
          description: string | null
          discount_type: string
          discount_value: number
          expires_at: string | null
          id: string
          is_active: boolean
          max_uses: number | null
          min_subtotal: number | null
          starts_at: string | null
          updated_at: string
          used_count: number
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          discount_type?: string
          discount_value?: number
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_uses?: number | null
          min_subtotal?: number | null
          starts_at?: string | null
          updated_at?: string
          used_count?: number
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          discount_type?: string
          discount_value?: number
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_uses?: number | null
          min_subtotal?: number | null
          starts_at?: string | null
          updated_at?: string
          used_count?: number
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
          created_at: string
          created_by_admin: boolean
          currency: string
          customer_email: string
          customer_name: string
          customer_phone: string
          id: string
          idempotency_key: string | null
          internal_notes: Json
          invoice_number: string | null
          notes: string | null
          order_number: string
          payment_method: Database["public"]["Enums"]["payment_method"]
          payment_status: string
          shipping_address: Json
          shipping_carrier: string | null
          shipping_fee: number
          shipping_lat: number | null
          shipping_lng: number | null
          shipping_status: string
          source: string
          status: Database["public"]["Enums"]["order_status"]
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
          created_at?: string
          created_by_admin?: boolean
          currency?: string
          customer_email: string
          customer_name: string
          customer_phone: string
          id?: string
          idempotency_key?: string | null
          internal_notes?: Json
          invoice_number?: string | null
          notes?: string | null
          order_number?: string
          payment_method?: Database["public"]["Enums"]["payment_method"]
          payment_status?: string
          shipping_address?: Json
          shipping_carrier?: string | null
          shipping_fee?: number
          shipping_lat?: number | null
          shipping_lng?: number | null
          shipping_status?: string
          source?: string
          status?: Database["public"]["Enums"]["order_status"]
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
          created_at?: string
          created_by_admin?: boolean
          currency?: string
          customer_email?: string
          customer_name?: string
          customer_phone?: string
          id?: string
          idempotency_key?: string | null
          internal_notes?: Json
          invoice_number?: string | null
          notes?: string | null
          order_number?: string
          payment_method?: Database["public"]["Enums"]["payment_method"]
          payment_status?: string
          shipping_address?: Json
          shipping_carrier?: string | null
          shipping_fee?: number
          shipping_lat?: number | null
          shipping_lng?: number | null
          shipping_status?: string
          source?: string
          status?: Database["public"]["Enums"]["order_status"]
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
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      site_settings: {
        Row: {
          announcement_bar: string | null
          free_shipping_threshold: number | null
          hero_image_url: string | null
          hero_subtitle_ar: string | null
          hero_subtitle_en: string | null
          hero_title_ar: string | null
          hero_title_en: string | null
          id: number
          primary_color: string | null
          shipping_fee: number | null
          store_name: string
          support_email: string | null
          tax_rate: number | null
          updated_at: string
          whatsapp_number: string | null
        }
        Insert: {
          announcement_bar?: string | null
          free_shipping_threshold?: number | null
          hero_image_url?: string | null
          hero_subtitle_ar?: string | null
          hero_subtitle_en?: string | null
          hero_title_ar?: string | null
          hero_title_en?: string | null
          id?: number
          primary_color?: string | null
          shipping_fee?: number | null
          store_name?: string
          support_email?: string | null
          tax_rate?: number | null
          updated_at?: string
          whatsapp_number?: string | null
        }
        Update: {
          announcement_bar?: string | null
          free_shipping_threshold?: number | null
          hero_image_url?: string | null
          hero_subtitle_ar?: string | null
          hero_subtitle_en?: string | null
          hero_title_ar?: string | null
          hero_title_en?: string | null
          id?: number
          primary_color?: string | null
          shipping_fee?: number | null
          store_name?: string
          support_email?: string | null
          tax_rate?: number | null
          updated_at?: string
          whatsapp_number?: string | null
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      refresh_product_sales_counts: { Args: never; Returns: undefined }
    }
    Enums: {
      app_role: "admin" | "staff" | "customer" | "manager" | "viewer"
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
      app_role: ["admin", "staff", "customer", "manager", "viewer"],
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

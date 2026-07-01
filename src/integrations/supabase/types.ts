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
      admin_wallet_adjustments: {
        Row: {
          admin_id: string
          amount: number
          balance_type: string
          created_at: string
          id: string
          reason: string | null
          target_user_id: string
        }
        Insert: {
          admin_id: string
          amount: number
          balance_type: string
          created_at?: string
          id?: string
          reason?: string | null
          target_user_id: string
        }
        Update: {
          admin_id?: string
          amount?: number
          balance_type?: string
          created_at?: string
          id?: string
          reason?: string | null
          target_user_id?: string
        }
        Relationships: []
      }
      ai_prompt_logs: {
        Row: {
          cost_naira: number
          cost_usd: number
          created_at: string
          id: string
          meta: Json | null
          prompt: string
          provider_id: string | null
          response: string | null
          status: string
          user_id: string
        }
        Insert: {
          cost_naira?: number
          cost_usd?: number
          created_at?: string
          id?: string
          meta?: Json | null
          prompt: string
          provider_id?: string | null
          response?: string | null
          status?: string
          user_id: string
        }
        Update: {
          cost_naira?: number
          cost_usd?: number
          created_at?: string
          id?: string
          meta?: Json | null
          prompt?: string
          provider_id?: string | null
          response?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_prompt_logs_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "ai_providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_prompt_logs_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "ai_providers_public"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_providers: {
        Row: {
          api_key: string | null
          cost_per_prompt_usd: number
          created_at: string
          created_by: string | null
          endpoint: string
          id: string
          is_active: boolean
          is_default: boolean
          model: string
          name: string
          provider_type: string
          updated_at: string
        }
        Insert: {
          api_key?: string | null
          cost_per_prompt_usd?: number
          created_at?: string
          created_by?: string | null
          endpoint: string
          id?: string
          is_active?: boolean
          is_default?: boolean
          model: string
          name: string
          provider_type?: string
          updated_at?: string
        }
        Update: {
          api_key?: string | null
          cost_per_prompt_usd?: number
          created_at?: string
          created_by?: string | null
          endpoint?: string
          id?: string
          is_active?: boolean
          is_default?: boolean
          model?: string
          name?: string
          provider_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      app_config: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      collaboration_files: {
        Row: {
          created_at: string
          file_name: string
          file_size: number | null
          file_type: string | null
          file_url: string
          id: string
          project_id: string
          uploaded_by: string
          version: number | null
        }
        Insert: {
          created_at?: string
          file_name: string
          file_size?: number | null
          file_type?: string | null
          file_url: string
          id?: string
          project_id: string
          uploaded_by: string
          version?: number | null
        }
        Update: {
          created_at?: string
          file_name?: string
          file_size?: number | null
          file_type?: string | null
          file_url?: string
          id?: string
          project_id?: string
          uploaded_by?: string
          version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "collaboration_files_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "collaboration_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collaboration_files_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collaboration_files_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      collaboration_invites: {
        Row: {
          created_at: string
          id: string
          invited_by: string
          invited_user_id: string
          project_id: string
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          invited_by: string
          invited_user_id: string
          project_id: string
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          invited_by?: string
          invited_user_id?: string
          project_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "collaboration_invites_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collaboration_invites_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collaboration_invites_invited_user_id_fkey"
            columns: ["invited_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collaboration_invites_invited_user_id_fkey"
            columns: ["invited_user_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collaboration_invites_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "collaboration_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      collaboration_members: {
        Row: {
          id: string
          joined_at: string
          project_id: string
          role: string
          user_id: string
        }
        Insert: {
          id?: string
          joined_at?: string
          project_id: string
          role?: string
          user_id: string
        }
        Update: {
          id?: string
          joined_at?: string
          project_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "collaboration_members_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "collaboration_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collaboration_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collaboration_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      collaboration_messages: {
        Row: {
          created_at: string
          id: string
          message: string
          project_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          project_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          project_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "collaboration_messages_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "collaboration_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collaboration_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collaboration_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      collaboration_projects: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_public: boolean | null
          owner_id: string
          tempo: number | null
          time_signature: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_public?: boolean | null
          owner_id: string
          tempo?: number | null
          time_signature?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_public?: boolean | null
          owner_id?: string
          tempo?: number | null
          time_signature?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "collaboration_projects_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collaboration_projects_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      device_tokens: {
        Row: {
          created_at: string
          id: string
          platform: string
          token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          platform?: string
          token: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          platform?: string
          token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      dispute_messages: {
        Row: {
          audio_duration: number | null
          audio_url: string | null
          created_at: string
          dispute_id: string
          file_name: string | null
          file_size: number | null
          file_type: string | null
          file_url: string | null
          id: string
          image_url: string | null
          message: string | null
          sender_id: string
        }
        Insert: {
          audio_duration?: number | null
          audio_url?: string | null
          created_at?: string
          dispute_id: string
          file_name?: string | null
          file_size?: number | null
          file_type?: string | null
          file_url?: string | null
          id?: string
          image_url?: string | null
          message?: string | null
          sender_id: string
        }
        Update: {
          audio_duration?: number | null
          audio_url?: string | null
          created_at?: string
          dispute_id?: string
          file_name?: string | null
          file_size?: number | null
          file_type?: string | null
          file_url?: string | null
          id?: string
          image_url?: string | null
          message?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dispute_messages_dispute_id_fkey"
            columns: ["dispute_id"]
            isOneToOne: false
            referencedRelation: "order_disputes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dispute_messages_sender_fk"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dispute_messages_sender_fk"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      exchange_rates: {
        Row: {
          currency_pair: string
          id: string
          rate: number
          updated_at: string
        }
        Insert: {
          currency_pair?: string
          id?: string
          rate: number
          updated_at?: string
        }
        Update: {
          currency_pair?: string
          id?: string
          rate?: number
          updated_at?: string
        }
        Relationships: []
      }
      followers: {
        Row: {
          created_at: string
          follower_id: string
          following_id: string
          id: string
        }
        Insert: {
          created_at?: string
          follower_id: string
          following_id: string
          id?: string
        }
        Update: {
          created_at?: string
          follower_id?: string
          following_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "followers_follower_id_fkey"
            columns: ["follower_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "followers_follower_id_fkey"
            columns: ["follower_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "followers_following_id_fkey"
            columns: ["following_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "followers_following_id_fkey"
            columns: ["following_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      live_session_members: {
        Row: {
          cursor_position: Json | null
          id: string
          is_active: boolean | null
          last_seen_at: string
          project_id: string
          user_id: string
        }
        Insert: {
          cursor_position?: Json | null
          id?: string
          is_active?: boolean | null
          last_seen_at?: string
          project_id: string
          user_id: string
        }
        Update: {
          cursor_position?: Json | null
          id?: string
          is_active?: boolean | null
          last_seen_at?: string
          project_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "live_session_members_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "collaboration_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_session_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_session_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_items: {
        Row: {
          category: string | null
          created_at: string
          delivery_methods: string[]
          description: string | null
          file_url: string | null
          id: string
          image_url: string | null
          preview_audio_url: string | null
          price: number
          product_type: string
          seller_id: string
          title: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          delivery_methods?: string[]
          description?: string | null
          file_url?: string | null
          id?: string
          image_url?: string | null
          preview_audio_url?: string | null
          price: number
          product_type?: string
          seller_id: string
          title: string
        }
        Update: {
          category?: string | null
          created_at?: string
          delivery_methods?: string[]
          description?: string | null
          file_url?: string | null
          id?: string
          image_url?: string | null
          preview_audio_url?: string | null
          price?: number
          product_type?: string
          seller_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_items_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_items_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_orders: {
        Row: {
          amount_naira: number
          amount_usd: number
          buyer_address: string
          buyer_country: string
          buyer_email: string
          buyer_full_name: string
          buyer_id: string
          buyer_phone: string
          buyer_received_at: string | null
          completed_at: string | null
          created_at: string
          delivery_method: string
          id: string
          item_id: string
          rejected_at: string | null
          rejection_reason: string | null
          seller_approved_at: string | null
          seller_id: string
          status: string
          updated_at: string
        }
        Insert: {
          amount_naira: number
          amount_usd?: number
          buyer_address: string
          buyer_country: string
          buyer_email: string
          buyer_full_name: string
          buyer_id: string
          buyer_phone: string
          buyer_received_at?: string | null
          completed_at?: string | null
          created_at?: string
          delivery_method?: string
          id?: string
          item_id: string
          rejected_at?: string | null
          rejection_reason?: string | null
          seller_approved_at?: string | null
          seller_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          amount_naira?: number
          amount_usd?: number
          buyer_address?: string
          buyer_country?: string
          buyer_email?: string
          buyer_full_name?: string
          buyer_id?: string
          buyer_phone?: string
          buyer_received_at?: string | null
          completed_at?: string | null
          created_at?: string
          delivery_method?: string
          id?: string
          item_id?: string
          rejected_at?: string | null
          rejection_reason?: string | null
          seller_approved_at?: string | null
          seller_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_orders_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_orders_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_orders_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "marketplace_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_orders_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_orders_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          created_at: string
          id: string
          image_url: string | null
          message: string
          receiver_id: string
          sender_id: string
          voice_duration: number | null
          voice_url: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          image_url?: string | null
          message: string
          receiver_id: string
          sender_id: string
          voice_duration?: number | null
          voice_url?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string | null
          message?: string
          receiver_id?: string
          sender_id?: string
          voice_duration?: number | null
          voice_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_receiver_id_fkey"
            columns: ["receiver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_receiver_id_fkey"
            columns: ["receiver_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      music: {
        Row: {
          artist_name: string
          audio_url: string
          cover_image: string | null
          created_at: string
          id: string
          plays_count: number
          title: string
          user_id: string
        }
        Insert: {
          artist_name: string
          audio_url: string
          cover_image?: string | null
          created_at?: string
          id?: string
          plays_count?: number
          title: string
          user_id: string
        }
        Update: {
          artist_name?: string
          audio_url?: string
          cover_image?: string | null
          created_at?: string
          id?: string
          plays_count?: number
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "music_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "music_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          content: string | null
          created_at: string
          id: string
          is_read: boolean
          message: string
          title: string | null
          type: string
          user_id: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          message: string
          title?: string | null
          type: string
          user_id: string
        }
        Update: {
          content?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          title?: string | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      order_disputes: {
        Row: {
          created_at: string
          dispute_type: string
          id: string
          order_id: string
          reason: string
          reporter_id: string
          resolution_note: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: string
        }
        Insert: {
          created_at?: string
          dispute_type: string
          id?: string
          order_id: string
          reason: string
          reporter_id: string
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          dispute_type?: string
          id?: string
          order_id?: string
          reason?: string
          reporter_id?: string
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_disputes_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "marketplace_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_disputes_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_disputes_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_samples: {
        Row: {
          bpm: number
          category: string
          created_at: string
          created_by: string | null
          duration16ths: number
          file_path: string
          file_size: number | null
          id: string
          is_active: boolean
          mime_type: string | null
          music_key: string | null
          public_url: string
          title: string
        }
        Insert: {
          bpm?: number
          category?: string
          created_at?: string
          created_by?: string | null
          duration16ths?: number
          file_path: string
          file_size?: number | null
          id?: string
          is_active?: boolean
          mime_type?: string | null
          music_key?: string | null
          public_url: string
          title: string
        }
        Update: {
          bpm?: number
          category?: string
          created_at?: string
          created_by?: string | null
          duration16ths?: number
          file_path?: string
          file_size?: number | null
          id?: string
          is_active?: boolean
          mime_type?: string | null
          music_key?: string | null
          public_url?: string
          title?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          bio: string | null
          contact_info: string | null
          created_at: string
          email: string | null
          fcm_token: string | null
          followers_count: number
          following_count: number
          full_name: string | null
          id: string
          is_banned: boolean
          is_premium: boolean | null
          is_suspended: boolean
          is_verified: boolean | null
          profile_picture: string | null
          subscription_expires: string | null
          suspended_at: string | null
          suspension_reason: string | null
          updated_at: string | null
          username: string
          website_link: string | null
        }
        Insert: {
          bio?: string | null
          contact_info?: string | null
          created_at?: string
          email?: string | null
          fcm_token?: string | null
          followers_count?: number
          following_count?: number
          full_name?: string | null
          id: string
          is_banned?: boolean
          is_premium?: boolean | null
          is_suspended?: boolean
          is_verified?: boolean | null
          profile_picture?: string | null
          subscription_expires?: string | null
          suspended_at?: string | null
          suspension_reason?: string | null
          updated_at?: string | null
          username: string
          website_link?: string | null
        }
        Update: {
          bio?: string | null
          contact_info?: string | null
          created_at?: string
          email?: string | null
          fcm_token?: string | null
          followers_count?: number
          following_count?: number
          full_name?: string | null
          id?: string
          is_banned?: boolean
          is_premium?: boolean | null
          is_suspended?: boolean
          is_verified?: boolean | null
          profile_picture?: string | null
          subscription_expires?: string | null
          suspended_at?: string | null
          suspension_reason?: string | null
          updated_at?: string | null
          username?: string
          website_link?: string | null
        }
        Relationships: []
      }
      project_collaborators: {
        Row: {
          id: string
          joined_at: string
          project_id: string
          user_id: string
        }
        Insert: {
          id?: string
          joined_at?: string
          project_id: string
          user_id: string
        }
        Update: {
          id?: string
          joined_at?: string
          project_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_collaborators_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          project_id: string
          timestamp_position: number | null
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          project_id: string
          timestamp_position?: number | null
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          project_id?: string
          timestamp_position?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_comments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "collaboration_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      project_messages: {
        Row: {
          created_at: string
          id: string
          message: string
          project_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          project_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          project_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_messages_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_versions: {
        Row: {
          created_at: string
          created_by: string
          data_json: Json | null
          id: string
          notes: string | null
          project_id: string
          version_number: number
        }
        Insert: {
          created_at?: string
          created_by: string
          data_json?: Json | null
          id?: string
          notes?: string | null
          project_id: string
          version_number?: number
        }
        Update: {
          created_at?: string
          created_by?: string
          data_json?: Json | null
          id?: string
          notes?: string | null
          project_id?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "project_versions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_versions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_versions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "collaboration_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          collab_token: string | null
          created_at: string
          id: string
          name: string
          pinned: boolean
          project_data: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          collab_token?: string | null
          created_at?: string
          id?: string
          name?: string
          pinned?: boolean
          project_data?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          collab_token?: string | null
          created_at?: string
          id?: string
          name?: string
          pinned?: boolean
          project_data?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      promotions: {
        Row: {
          content_id: string
          content_type: string
          created_at: string
          expires_at: string
          id: string
          paid_from_wallet: boolean | null
          plan: string
          price_naira: number
          price_usd: number
          starts_at: string
          status: string
          user_id: string
        }
        Insert: {
          content_id: string
          content_type: string
          created_at?: string
          expires_at: string
          id?: string
          paid_from_wallet?: boolean | null
          plan: string
          price_naira: number
          price_usd?: number
          starts_at?: string
          status?: string
          user_id: string
        }
        Update: {
          content_id?: string
          content_type?: string
          created_at?: string
          expires_at?: string
          id?: string
          paid_from_wallet?: boolean | null
          plan?: string
          price_naira?: number
          price_usd?: number
          starts_at?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "promotions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promotions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      revenue_distributions: {
        Row: {
          admin_id: string
          created_at: string
          id: string
          recipients_count: number
          total_amount: number
          total_tk_distributed: number
        }
        Insert: {
          admin_id: string
          created_at?: string
          id?: string
          recipients_count?: number
          total_amount: number
          total_tk_distributed: number
        }
        Update: {
          admin_id?: string
          created_at?: string
          id?: string
          recipients_count?: number
          total_amount?: number
          total_tk_distributed?: number
        }
        Relationships: [
          {
            foreignKeyName: "revenue_distributions_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "revenue_distributions_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      songs: {
        Row: {
          audio_url: string | null
          bpm: number | null
          cover_url: string | null
          created_at: string
          description: string | null
          duration_seconds: number | null
          genre: string | null
          id: string
          music_key: string | null
          prompt: string
          score_json: Json | null
          status: string
          title: string
          updated_at: string
          user_id: string
          vocals_url: string | null
        }
        Insert: {
          audio_url?: string | null
          bpm?: number | null
          cover_url?: string | null
          created_at?: string
          description?: string | null
          duration_seconds?: number | null
          genre?: string | null
          id?: string
          music_key?: string | null
          prompt: string
          score_json?: Json | null
          status?: string
          title?: string
          updated_at?: string
          user_id: string
          vocals_url?: string | null
        }
        Update: {
          audio_url?: string | null
          bpm?: number | null
          cover_url?: string | null
          created_at?: string
          description?: string | null
          duration_seconds?: number | null
          genre?: string | null
          id?: string
          music_key?: string | null
          prompt?: string
          score_json?: Json | null
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
          vocals_url?: string | null
        }
        Relationships: []
      }
      studio_project_collaborators: {
        Row: {
          id: string
          joined_at: string
          project_id: string
          role: string
          user_id: string
        }
        Insert: {
          id?: string
          joined_at?: string
          project_id: string
          role?: string
          user_id: string
        }
        Update: {
          id?: string
          joined_at?: string
          project_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "studio_project_collaborators_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "studio_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      studio_project_messages: {
        Row: {
          created_at: string
          id: string
          message: string
          project_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          project_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          project_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "studio_project_messages_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "studio_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      studio_projects: {
        Row: {
          bpm: number
          cover_url: string | null
          created_at: string
          data: Json
          id: string
          is_collaborative: boolean
          is_published: boolean
          last_autosave_at: string | null
          music_key: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          bpm?: number
          cover_url?: string | null
          created_at?: string
          data?: Json
          id?: string
          is_collaborative?: boolean
          is_published?: boolean
          last_autosave_at?: string | null
          music_key?: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          bpm?: number
          cover_url?: string | null
          created_at?: string
          data?: Json
          id?: string
          is_collaborative?: boolean
          is_published?: boolean
          last_autosave_at?: string | null
          music_key?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          ads_free_until: string | null
          created_at: string
          id: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          ads_free_until?: string | null
          created_at?: string
          id?: string
          type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          ads_free_until?: string | null
          created_at?: string
          id?: string
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      tips: {
        Row: {
          amount: number
          created_at: string
          id: string
          method: string | null
          receiver_id: string
          sender_id: string
          status: string | null
          transaction_reference: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          method?: string | null
          receiver_id: string
          sender_id: string
          status?: string | null
          transaction_reference?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          method?: string | null
          receiver_id?: string
          sender_id?: string
          status?: string | null
          transaction_reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tips_receiver_id_fkey"
            columns: ["receiver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tips_receiver_id_fkey"
            columns: ["receiver_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tips_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tips_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      tk_earnings: {
        Row: {
          action_type: string
          content_id: string
          content_type: string
          created_at: string
          earned_amount: number
          id: string
          user_id: string
          viewer_id: string
        }
        Insert: {
          action_type: string
          content_id: string
          content_type: string
          created_at?: string
          earned_amount?: number
          id?: string
          user_id: string
          viewer_id: string
        }
        Update: {
          action_type?: string
          content_id?: string
          content_type?: string
          created_at?: string
          earned_amount?: number
          id?: string
          user_id?: string
          viewer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tk_earnings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tk_earnings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tk_earnings_viewer_id_fkey"
            columns: ["viewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tk_earnings_viewer_id_fkey"
            columns: ["viewer_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      track_locks: {
        Row: {
          id: string
          locked_at: string
          locked_by: string
          project_id: string
          track_index: number
        }
        Insert: {
          id?: string
          locked_at?: string
          locked_by: string
          project_id: string
          track_index: number
        }
        Update: {
          id?: string
          locked_at?: string
          locked_by?: string
          project_id?: string
          track_index?: number
        }
        Relationships: [
          {
            foreignKeyName: "track_locks_locked_by_fkey"
            columns: ["locked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "track_locks_locked_by_fkey"
            columns: ["locked_by"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "track_locks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "collaboration_projects"
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
      user_verifications: {
        Row: {
          admin_note: string | null
          created_at: string
          full_legal_name: string
          id: string
          id_card_type: string
          id_card_url: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          user_id: string
        }
        Insert: {
          admin_note?: string | null
          created_at?: string
          full_legal_name: string
          id?: string
          id_card_type?: string
          id_card_url: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          user_id: string
        }
        Update: {
          admin_note?: string | null
          created_at?: string
          full_legal_name?: string
          id?: string
          id_card_type?: string
          id_card_url?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_verifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_verifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      video_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          parent_id: string | null
          user_id: string
          video_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          parent_id?: string | null
          user_id: string
          video_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          parent_id?: string | null
          user_id?: string
          video_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "video_comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "video_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_comments_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "videos"
            referencedColumns: ["id"]
          },
        ]
      }
      video_favorites: {
        Row: {
          created_at: string
          id: string
          user_id: string
          video_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          user_id: string
          video_id: string
        }
        Update: {
          created_at?: string
          id?: string
          user_id?: string
          video_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "video_favorites_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_favorites_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_favorites_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "videos"
            referencedColumns: ["id"]
          },
        ]
      }
      video_likes: {
        Row: {
          created_at: string
          id: string
          user_id: string
          video_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          user_id: string
          video_id: string
        }
        Update: {
          created_at?: string
          id?: string
          user_id?: string
          video_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "video_likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_likes_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "videos"
            referencedColumns: ["id"]
          },
        ]
      }
      videos: {
        Row: {
          caption: string | null
          comments_count: number
          created_at: string
          id: string
          image_url: string | null
          likes_count: number
          media_type: string
          original_video_id: string | null
          sound_music_id: string | null
          sound_name: string | null
          sound_owner_id: string | null
          sound_url: string | null
          type: string | null
          user_id: string
          video_url: string
        }
        Insert: {
          caption?: string | null
          comments_count?: number
          created_at?: string
          id?: string
          image_url?: string | null
          likes_count?: number
          media_type?: string
          original_video_id?: string | null
          sound_music_id?: string | null
          sound_name?: string | null
          sound_owner_id?: string | null
          sound_url?: string | null
          type?: string | null
          user_id: string
          video_url: string
        }
        Update: {
          caption?: string | null
          comments_count?: number
          created_at?: string
          id?: string
          image_url?: string | null
          likes_count?: number
          media_type?: string
          original_video_id?: string | null
          sound_music_id?: string | null
          sound_name?: string | null
          sound_owner_id?: string | null
          sound_url?: string | null
          type?: string | null
          user_id?: string
          video_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "videos_sound_music_id_fkey"
            columns: ["sound_music_id"]
            isOneToOne: false
            referencedRelation: "music"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "videos_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "videos_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      wallet_funding_requests: {
        Row: {
          admin_note: string | null
          amount_naira: number
          approved_by: string | null
          created_at: string
          fee_naira: number | null
          fee_percentage: number | null
          id: string
          method: string
          phone_number: string | null
          receipt_url: string | null
          status: string
          transaction_reference: string
          user_id: string
        }
        Insert: {
          admin_note?: string | null
          amount_naira: number
          approved_by?: string | null
          created_at?: string
          fee_naira?: number | null
          fee_percentage?: number | null
          id?: string
          method: string
          phone_number?: string | null
          receipt_url?: string | null
          status?: string
          transaction_reference: string
          user_id: string
        }
        Update: {
          admin_note?: string | null
          amount_naira?: number
          approved_by?: string | null
          created_at?: string
          fee_naira?: number | null
          fee_percentage?: number | null
          id?: string
          method?: string
          phone_number?: string | null
          receipt_url?: string | null
          status?: string
          transaction_reference?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallet_funding_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallet_funding_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      wallet_transactions: {
        Row: {
          amount_naira: number
          amount_usd: number
          created_at: string
          description: string | null
          id: string
          meta: Json | null
          related_item: string | null
          related_user_id: string | null
          status: string
          type: string
          user_id: string
        }
        Insert: {
          amount_naira?: number
          amount_usd?: number
          created_at?: string
          description?: string | null
          id?: string
          meta?: Json | null
          related_item?: string | null
          related_user_id?: string | null
          status?: string
          type: string
          user_id: string
        }
        Update: {
          amount_naira?: number
          amount_usd?: number
          created_at?: string
          description?: string | null
          id?: string
          meta?: Json | null
          related_item?: string | null
          related_user_id?: string | null
          status?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallet_transactions_related_user_id_fkey"
            columns: ["related_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallet_transactions_related_user_id_fkey"
            columns: ["related_user_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallet_transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallet_transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      wallets: {
        Row: {
          balance_naira: number
          balance_usd: number
          tk_balance: number
          updated_at: string
          user_id: string
          withdrawable_balance: number
        }
        Insert: {
          balance_naira?: number
          balance_usd?: number
          tk_balance?: number
          updated_at?: string
          user_id: string
          withdrawable_balance?: number
        }
        Update: {
          balance_naira?: number
          balance_usd?: number
          tk_balance?: number
          updated_at?: string
          user_id?: string
          withdrawable_balance?: number
        }
        Relationships: [
          {
            foreignKeyName: "wallets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      withdrawal_requests: {
        Row: {
          account_name: string | null
          account_number: string | null
          admin_note: string | null
          amount: number
          bank_name: string | null
          country: string
          created_at: string
          full_account_details: string | null
          full_name: string
          grey_email: string | null
          grey_username: string | null
          id: string
          payment_method: string
          phone_number: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          user_id: string
          wallet_address: string | null
        }
        Insert: {
          account_name?: string | null
          account_number?: string | null
          admin_note?: string | null
          amount: number
          bank_name?: string | null
          country: string
          created_at?: string
          full_account_details?: string | null
          full_name: string
          grey_email?: string | null
          grey_username?: string | null
          id?: string
          payment_method: string
          phone_number?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          user_id: string
          wallet_address?: string | null
        }
        Update: {
          account_name?: string | null
          account_number?: string | null
          admin_note?: string | null
          amount?: number
          bank_name?: string | null
          country?: string
          created_at?: string
          full_account_details?: string | null
          full_name?: string
          grey_email?: string | null
          grey_username?: string | null
          id?: string
          payment_method?: string
          phone_number?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          user_id?: string
          wallet_address?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "withdrawal_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "withdrawal_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      withdrawals: {
        Row: {
          amount: number
          created_at: string
          details: Json
          email: string
          id: string
          method: string
          status: string | null
          tx_hash: string | null
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          details: Json
          email: string
          id: string
          method: string
          status?: string | null
          tx_hash?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          details?: Json
          email?: string
          id?: string
          method?: string
          status?: string | null
          tx_hash?: string | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      ai_providers_public: {
        Row: {
          cost_per_prompt_usd: number | null
          id: string | null
          is_active: boolean | null
          is_default: boolean | null
          model: string | null
          name: string | null
          provider_type: string | null
        }
        Insert: {
          cost_per_prompt_usd?: number | null
          id?: string | null
          is_active?: boolean | null
          is_default?: boolean | null
          model?: string | null
          name?: string | null
          provider_type?: string | null
        }
        Update: {
          cost_per_prompt_usd?: number | null
          id?: string | null
          is_active?: boolean | null
          is_default?: boolean | null
          model?: string | null
          name?: string | null
          provider_type?: string | null
        }
        Relationships: []
      }
      profiles_public: {
        Row: {
          bio: string | null
          contact_info: string | null
          created_at: string | null
          followers_count: number | null
          following_count: number | null
          full_name: string | null
          id: string | null
          is_premium: boolean | null
          is_verified: boolean | null
          profile_picture: string | null
          username: string | null
          website_link: string | null
        }
        Insert: {
          bio?: string | null
          contact_info?: string | null
          created_at?: string | null
          followers_count?: number | null
          following_count?: number | null
          full_name?: string | null
          id?: string | null
          is_premium?: boolean | null
          is_verified?: boolean | null
          profile_picture?: string | null
          username?: string | null
          website_link?: string | null
        }
        Update: {
          bio?: string | null
          contact_info?: string | null
          created_at?: string | null
          followers_count?: number | null
          following_count?: number | null
          full_name?: string | null
          id?: string | null
          is_premium?: boolean | null
          is_verified?: boolean | null
          profile_picture?: string | null
          username?: string | null
          website_link?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      admin_adjust_wallet: {
        Args: {
          p_amount: number
          p_balance_type: string
          p_reason?: string
          p_target_user_id: string
        }
        Returns: Json
      }
      admin_approve_verification: {
        Args: { p_verification_id: string }
        Returns: Json
      }
      admin_force_resolve_order: {
        Args: { p_decision: string; p_note?: string; p_order_id: string }
        Returns: Json
      }
      admin_reject_verification: {
        Args: { p_reason?: string; p_verification_id: string }
        Returns: Json
      }
      admin_resolve_dispute: {
        Args: { p_decision: string; p_dispute_id: string; p_note?: string }
        Returns: Json
      }
      admin_set_user_status: {
        Args: { p_reason?: string; p_status: string; p_target_user_id: string }
        Returns: Json
      }
      approve_wallet_funding: {
        Args: { p_admin_id: string; p_rate?: number; p_request_id: string }
        Returns: Json
      }
      buyer_confirm_received: { Args: { p_order_id: string }; Returns: Json }
      charge_ai_prompt: {
        Args: {
          p_cost_usd?: number
          p_prompt: string
          p_provider_id: string
          p_user_id: string
        }
        Returns: Json
      }
      convert_naira_to_usd: { Args: { naira_amount: number }; Returns: number }
      create_marketplace_order: {
        Args: {
          p_address: string
          p_amount: number
          p_country: string
          p_delivery_method?: string
          p_email: string
          p_full_name: string
          p_item_id: string
          p_phone: string
          p_seller_id: string
        }
        Returns: Json
      }
      distribute_revenue: {
        Args: { p_admin_id: string; p_total_amount: number }
        Returns: Json
      }
      get_my_profile: {
        Args: never
        Returns: {
          bio: string | null
          contact_info: string | null
          created_at: string
          email: string | null
          fcm_token: string | null
          followers_count: number
          following_count: number
          full_name: string | null
          id: string
          is_banned: boolean
          is_premium: boolean | null
          is_suspended: boolean
          is_verified: boolean | null
          profile_picture: string | null
          subscription_expires: string | null
          suspended_at: string | null
          suspension_reason: string | null
          updated_at: string | null
          username: string
          website_link: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_pending_topups_count: { Args: never; Returns: number }
      get_seller_trust_stats: { Args: { p_seller_id: string }; Returns: Json }
      get_top_tippers: {
        Args: { p_limit?: number }
        Returns: {
          total_tipped: number
          user_id: string
          username: string
        }[]
      }
      get_total_funded_wallets: { Args: never; Returns: number }
      get_total_marketplace_purchases: { Args: never; Returns: number }
      get_total_tips_count: { Args: never; Returns: number }
      get_total_wallet_funds: { Args: never; Returns: Json }
      get_wallet_trends: {
        Args: { p_range?: string }
        Returns: {
          day: string
          total_funded: number
          total_purchases: number
          total_tips: number
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_collab_member: {
        Args: { _project_id: string; _user_id: string }
        Returns: boolean
      }
      is_studio_collaborator: {
        Args: { _project_id: string; _user_id: string }
        Returns: boolean
      }
      join_project_by_token: { Args: { token_val: string }; Returns: string }
      open_dispute: {
        Args: { p_dispute_type: string; p_order_id: string; p_reason: string }
        Returns: Json
      }
      pay_tip_with_wallet: {
        Args: { p_amount: number; p_receiver_id: string; p_user_id: string }
        Returns: Json
      }
      purchase_ads_free: {
        Args: { p_cost_naira: number; p_days: number; p_user_id: string }
        Returns: Json
      }
      purchase_marketplace_with_wallet: {
        Args: {
          p_amount: number
          p_item_id: string
          p_seller_id: string
          p_user_id: string
        }
        Returns: Json
      }
      purchase_subscription_with_wallet: {
        Args: { p_amount: number; p_tier: string; p_user_id: string }
        Returns: Json
      }
      record_tk_earning: {
        Args: {
          p_action_type: string
          p_content_id: string
          p_content_owner_id: string
          p_content_type: string
          p_viewer_id: string
        }
        Returns: Json
      }
      reject_wallet_funding: {
        Args: { p_admin_id: string; p_reason?: string; p_request_id: string }
        Returns: Json
      }
      seller_approve_order: { Args: { p_order_id: string }; Returns: Json }
      seller_reject_order: {
        Args: { p_order_id: string; p_reason?: string }
        Returns: Json
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
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
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const

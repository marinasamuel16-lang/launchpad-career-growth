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
      action_steps: {
        Row: {
          completed: boolean
          content: string
          created_at: string
          id: string
          order_index: number
          user_id: string
          week_label: string
        }
        Insert: {
          completed?: boolean
          content: string
          created_at?: string
          id?: string
          order_index?: number
          user_id: string
          week_label: string
        }
        Update: {
          completed?: boolean
          content?: string
          created_at?: string
          id?: string
          order_index?: number
          user_id?: string
          week_label?: string
        }
        Relationships: []
      }
      coach_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          role: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      comments: {
        Row: {
          content: string
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      follows: {
        Row: {
          created_at: string
          follower_id: string
          following_id: string
        }
        Insert: {
          created_at?: string
          follower_id: string
          following_id: string
        }
        Update: {
          created_at?: string
          follower_id?: string
          following_id?: string
        }
        Relationships: []
      }
      milestone_tasks: {
        Row: {
          completed: boolean
          created_at: string
          id: string
          milestone_id: string
          order_index: number
          title: string
          user_id: string
        }
        Insert: {
          completed?: boolean
          created_at?: string
          id?: string
          milestone_id: string
          order_index?: number
          title: string
          user_id: string
        }
        Update: {
          completed?: boolean
          created_at?: string
          id?: string
          milestone_id?: string
          order_index?: number
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "milestone_tasks_milestone_id_fkey"
            columns: ["milestone_id"]
            isOneToOne: false
            referencedRelation: "milestones"
            referencedColumns: ["id"]
          },
        ]
      }
      milestones: {
        Row: {
          created_at: string
          description: string | null
          id: string
          order_index: number
          status: string
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          order_index?: number
          status?: string
          title: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          order_index?: number
          status?: string
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          actor_id: string | null
          created_at: string
          data: Json
          id: string
          post_id: string | null
          read_at: string | null
          type: string
          user_id: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          data?: Json
          id?: string
          post_id?: string | null
          read_at?: string | null
          type: string
          user_id: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          data?: Json
          id?: string
          post_id?: string | null
          read_at?: string | null
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      post_likes: {
        Row: {
          created_at: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_reposts: {
        Row: {
          created_at: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_reposts_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          content: string
          created_at: string
          id: string
          topic: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          topic: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          topic?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          career_goal: string | null
          created_at: string
          id: string
          industry: string | null
          last_active_on: string | null
          linkedin_url: string | null
          name: string | null
          role: string | null
          streak_days: number
          updated_at: string
          xp: number
          years_experience: number | null
        }
        Insert: {
          avatar_url?: string | null
          career_goal?: string | null
          created_at?: string
          id: string
          industry?: string | null
          last_active_on?: string | null
          linkedin_url?: string | null
          name?: string | null
          role?: string | null
          streak_days?: number
          updated_at?: string
          xp?: number
          years_experience?: number | null
        }
        Update: {
          avatar_url?: string | null
          career_goal?: string | null
          created_at?: string
          id?: string
          industry?: string | null
          last_active_on?: string | null
          linkedin_url?: string | null
          name?: string | null
          role?: string | null
          streak_days?: number
          updated_at?: string
          xp?: number
          years_experience?: number | null
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          created_at: string
          current_period_end: string | null
          id: string
          plan: string
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_period_end?: string | null
          id?: string
          plan?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_period_end?: string | null
          id?: string
          plan?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_action_completions: {
        Row: {
          action_id: string
          completed_at: string
          id: string
          reflection: string | null
          user_id: string
        }
        Insert: {
          action_id: string
          completed_at?: string
          id?: string
          reflection?: string | null
          user_id: string
        }
        Update: {
          action_id?: string
          completed_at?: string
          id?: string
          reflection?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_action_completions_action_id_fkey"
            columns: ["action_id"]
            isOneToOne: false
            referencedRelation: "weekly_actions"
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
      videos: {
        Row: {
          created_at: string
          description: string | null
          duration: string | null
          guest_name: string
          guest_role: string | null
          id: string
          is_featured: boolean
          thumbnail_url: string | null
          title: string
          topic: string
          youtube_url: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          duration?: string | null
          guest_name: string
          guest_role?: string | null
          id?: string
          is_featured?: boolean
          thumbnail_url?: string | null
          title: string
          topic: string
          youtube_url: string
        }
        Update: {
          created_at?: string
          description?: string | null
          duration?: string | null
          guest_name?: string
          guest_role?: string | null
          id?: string
          is_featured?: boolean
          thumbnail_url?: string | null
          title?: string
          topic?: string
          youtube_url?: string
        }
        Relationships: []
      }
      weekly_actions: {
        Row: {
          description: string | null
          difficulty: string
          id: string
          sort_order: number
          theme_id: string
          title: string
          xp_reward: number
        }
        Insert: {
          description?: string | null
          difficulty?: string
          id?: string
          sort_order?: number
          theme_id: string
          title: string
          xp_reward?: number
        }
        Update: {
          description?: string | null
          difficulty?: string
          id?: string
          sort_order?: number
          theme_id?: string
          title?: string
          xp_reward?: number
        }
        Relationships: [
          {
            foreignKeyName: "weekly_actions_theme_id_fkey"
            columns: ["theme_id"]
            isOneToOne: false
            referencedRelation: "weekly_themes"
            referencedColumns: ["id"]
          },
        ]
      }
      weekly_themes: {
        Row: {
          accent_color: string | null
          created_at: string
          episode_number: number | null
          episode_url: string | null
          guest_name: string | null
          id: string
          is_active: boolean
          key_advice: string[]
          published_at: string | null
          subtitle: string | null
          summary: string
          title: string
        }
        Insert: {
          accent_color?: string | null
          created_at?: string
          episode_number?: number | null
          episode_url?: string | null
          guest_name?: string | null
          id?: string
          is_active?: boolean
          key_advice?: string[]
          published_at?: string | null
          subtitle?: string | null
          summary?: string
          title: string
        }
        Update: {
          accent_color?: string | null
          created_at?: string
          episode_number?: number | null
          episode_url?: string | null
          guest_name?: string | null
          id?: string
          is_active?: boolean
          key_advice?: string[]
          published_at?: string | null
          subtitle?: string | null
          summary?: string
          title?: string
        }
        Relationships: []
      }
      xp_events: {
        Row: {
          amount: number
          created_at: string
          id: string
          kind: string
          reference_id: string | null
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          kind: string
          reference_id?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          kind?: string
          reference_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      action_completion_counts: {
        Args: { p_theme_id: string }
        Returns: {
          action_id: string
          completions: number
        }[]
      }
      admin_theme_stats: {
        Args: never
        Returns: {
          completions: number
          participants: number
          theme_id: string
        }[]
      }
      broadcast_active_theme: { Args: never; Returns: number }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      publish_theme: { Args: { p_theme_id: string }; Returns: undefined }
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
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const

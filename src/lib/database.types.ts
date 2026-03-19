export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      blog_posts: {
        Row: {
          author_id: string
          content_md: string | null
          created_at: string | null
          id: string
          is_draft: boolean | null
          links: Json | null
          slug: string
          team_id: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          author_id: string
          content_md?: string | null
          created_at?: string | null
          id?: string
          is_draft?: boolean | null
          links?: Json | null
          slug: string
          team_id?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          author_id?: string
          content_md?: string | null
          created_at?: string | null
          id?: string
          is_draft?: boolean | null
          links?: Json | null
          slug?: string
          team_id?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "blog_posts_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blog_posts_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      community_subjects: {
        Row: {
          id: string
          title: string
          body: string
          author_id: string
          tags: string[]
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title: string
          body: string
          author_id: string
          tags?: string[]
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          title?: string
          body?: string
          author_id?: string
          tags?: string[]
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_subjects_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      subject_comments: {
        Row: {
          id: string
          subject_id: string
          author_id: string
          body: string
          created_at: string
        }
        Insert: {
          id?: string
          subject_id: string
          author_id: string
          body: string
          created_at?: string
        }
        Update: {
          id?: string
          subject_id?: string
          author_id?: string
          body?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subject_comments_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "community_subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subject_comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      community_flags: {
        Row: {
          id: string
          target_type: string
          target_id: string
          reporter_id: string
          created_at: string
        }
        Insert: {
          id?: string
          target_type: string
          target_id: string
          reporter_id: string
          created_at?: string
        }
        Update: {
          id?: string
          target_type?: string
          target_id?: string
          reporter_id?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_flags_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      galleries: {
        Row: {
          active: boolean
          description: string | null
          edited_by: string | null
          edited_on: string
          id: string
        }
        Insert: {
          active?: boolean
          description?: string | null
          edited_by?: string | null
          edited_on?: string
          id?: string
        }
        Update: {
          active?: boolean
          description?: string | null
          edited_by?: string | null
          edited_on?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "galleries_edited_by_fkey"
            columns: ["edited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      gallery_images: {
        Row: {
          description: string | null
          edited_by: string | null
          edited_on: string
          gallery_id: string
          hidden: boolean
          id: string
          image_url: string
          link_to_url: string | null
          quote: string | null
          tags: string[]
        }
        Insert: {
          description?: string | null
          edited_by?: string | null
          edited_on?: string
          gallery_id: string
          hidden?: boolean
          id?: string
          image_url: string
          link_to_url?: string | null
          quote?: string | null
          tags?: string[]
        }
        Update: {
          description?: string | null
          edited_by?: string | null
          edited_on?: string
          gallery_id?: string
          hidden?: boolean
          id?: string
          image_url?: string
          link_to_url?: string | null
          quote?: string | null
          tags?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "gallery_images_edited_by_fkey"
            columns: ["edited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gallery_images_gallery_id_fkey"
            columns: ["gallery_id"]
            isOneToOne: false
            referencedRelation: "galleries"
            referencedColumns: ["id"]
          },
        ]
      }
      newsletter_subscribers: {
        Row: {
          created_at: string | null
          email: string
          id: string
          team_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          id?: string
          team_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: string
          team_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "newsletter_subscribers_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "newsletter_subscribers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          city: string | null
          country: string | null
          display_name: string | null
          id: string
          is_admin: boolean
          name: string | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          city?: string | null
          country?: string | null
          display_name?: string | null
          id: string
          name?: string | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          city?: string | null
          country?: string | null
          display_name?: string | null
          id?: string
          name?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      team_members: {
        Row: {
          created_at: string | null
          id: string
          invited_email: string | null
          role_id: string
          team_id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          invited_email?: string | null
          role_id: string
          team_id: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          invited_email?: string | null
          role_id?: string
          team_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "team_members_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "team_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      team_roles: {
        Row: {
          content_edit_level: Database["public"]["Enums"]["content_edit_level"]
          created_at: string | null
          description: string | null
          id: string
          name: string
          team_id: string
        }
        Insert: {
          content_edit_level?: Database["public"]["Enums"]["content_edit_level"]
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          team_id: string
        }
        Update: {
          content_edit_level?: Database["public"]["Enums"]["content_edit_level"]
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_roles_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          created_at: string | null
          created_by: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string | null
          created_by: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string | null
          created_by?: string
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "teams_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tour_participants: {
        Row: {
          id: string
          joined_at: string | null
          tour_id: string
          user_id: string
        }
        Insert: {
          id?: string
          joined_at?: string | null
          tour_id: string
          user_id: string
        }
        Update: {
          id?: string
          joined_at?: string | null
          tour_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tour_participants_tour_id_fkey"
            columns: ["tour_id"]
            isOneToOne: false
            referencedRelation: "tours"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tour_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tour_reviews: {
        Row: {
          approved: boolean
          comment: string | null
          created_at: string | null
          id: string
          rating: number
          tour_id: string
          user_id: string
        }
        Insert: {
          approved?: boolean
          comment?: string | null
          created_at?: string | null
          id?: string
          rating: number
          tour_id: string
          user_id: string
        }
        Update: {
          approved?: boolean
          comment?: string | null
          created_at?: string | null
          id?: string
          rating?: number
          tour_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tour_reviews_tour_id_fkey"
            columns: ["tour_id"]
            isOneToOne: false
            referencedRelation: "tours"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tour_reviews_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tours: {
        Row: {
          age_max: number | null
          age_min: number | null
          contact_info: string | null
          created_at: string | null
          creator_id: string
          description: string | null
          end_date: string | null
          external_url: string | null
          featured: boolean
          id: string
          image_url: string | null
          latitude: number | null
          locality: string | null
          longitude: number | null
          max_participants: number | null
          parking_info: string | null
          responsible_person: string | null
          security_notes: string | null
          source: Database["public"]["Enums"]["tour_source"]
          start_date: string
          start_time: string | null
          status: Database["public"]["Enums"]["tour_status"]
          tags: string[]
          title: string
          updated_at: string | null
          view_count: number
        }
        Insert: {
          age_max?: number | null
          age_min?: number | null
          contact_info?: string | null
          created_at?: string | null
          creator_id: string
          description?: string | null
          end_date?: string | null
          external_url?: string | null
          featured?: boolean
          id?: string
          image_url?: string | null
          latitude?: number | null
          locality?: string | null
          longitude?: number | null
          max_participants?: number | null
          parking_info?: string | null
          responsible_person?: string | null
          security_notes?: string | null
          source?: Database["public"]["Enums"]["tour_source"]
          start_date: string
          start_time?: string | null
          status?: Database["public"]["Enums"]["tour_status"]
          tags?: string[]
          title: string
          updated_at?: string | null
          view_count?: number
        }
        Update: {
          age_max?: number | null
          age_min?: number | null
          contact_info?: string | null
          created_at?: string | null
          creator_id?: string
          description?: string | null
          end_date?: string | null
          external_url?: string | null
          featured?: boolean
          id?: string
          image_url?: string | null
          latitude?: number | null
          locality?: string | null
          longitude?: number | null
          max_participants?: number | null
          parking_info?: string | null
          responsible_person?: string | null
          security_notes?: string | null
          source?: Database["public"]["Enums"]["tour_source"]
          start_date?: string
          start_time?: string | null
          status?: Database["public"]["Enums"]["tour_status"]
          tags?: string[]
          title?: string
          updated_at?: string | null
          view_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "tours_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_bookings: {
        Row: {
          bookable_id: string
          bookable_name: string
          booking_date: string
          created_at: string
          id: string
          timeslot: string
          user_id: string
        }
        Insert: {
          bookable_id: string
          bookable_name: string
          booking_date: string
          created_at?: string
          id?: string
          timeslot: string
          user_id: string
        }
        Update: {
          bookable_id?: string
          bookable_name?: string
          booking_date?: string
          created_at?: string
          id?: string
          timeslot?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_bookings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_id_by_email: { Args: { p_email: string }; Returns: string }
      user_can_manage_team: {
        Args: { p_team_id: string; p_user_id: string }
        Returns: boolean
      }
      user_has_team_role: {
        Args: {
          p_min_level: Database["public"]["Enums"]["content_edit_level"]
          p_team_id: string
          p_user_id: string
        }
        Returns: boolean
      }
      user_is_team_member: {
        Args: { p_team_id: string; p_user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      content_edit_level: "read" | "edit" | "super"
      tour_source: "user" | "web"
      tour_status: "draft" | "published" | "cancelled" | "completed"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      content_edit_level: ["read", "edit", "super"],
      tour_source: ["user", "web"],
      tour_status: ["draft", "published", "cancelled", "completed"],
    },
  },
} as const


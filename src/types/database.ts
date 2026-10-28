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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      body_weights: {
        Row: {
          body_fat_pct: number | null
          created_at: string
          id: string
          measured_on: string
          user_id: string
          weight_kg: number
        }
        Insert: {
          body_fat_pct?: number | null
          created_at?: string
          id?: string
          measured_on?: string
          user_id?: string
          weight_kg: number
        }
        Update: {
          body_fat_pct?: number | null
          created_at?: string
          id?: string
          measured_on?: string
          user_id?: string
          weight_kg?: number
        }
        Relationships: []
      }
      food_entries: {
        Row: {
          carbs_g: number | null
          created_at: string
          eaten_on: string
          fat_g: number | null
          id: string
          kcal: number | null
          meal_plan_item_id: string | null
          meal_slot: string | null
          name: string
          protein_g: number | null
          status: string
          user_id: string
        }
        Insert: {
          carbs_g?: number | null
          created_at?: string
          eaten_on?: string
          fat_g?: number | null
          id?: string
          kcal?: number | null
          meal_plan_item_id?: string | null
          meal_slot?: string | null
          name: string
          protein_g?: number | null
          status?: string
          user_id?: string
        }
        Update: {
          carbs_g?: number | null
          created_at?: string
          eaten_on?: string
          fat_g?: number | null
          id?: string
          kcal?: number | null
          meal_plan_item_id?: string | null
          meal_slot?: string | null
          name?: string
          protein_g?: number | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "food_entries_meal_plan_item_id_user_id_fkey"
            columns: ["meal_plan_item_id", "user_id"]
            isOneToOne: false
            referencedRelation: "meal_plan_items"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      meal_plan_items: {
        Row: {
          amount: string | null
          carbs_g: number | null
          created_at: string
          day_key: string
          fat_g: number | null
          id: string
          kcal: number | null
          meal_plan_id: string
          meal_slot: string
          name: string
          notes: string | null
          position: number
          protein_g: number | null
          user_id: string
        }
        Insert: {
          amount?: string | null
          carbs_g?: number | null
          created_at?: string
          day_key: string
          fat_g?: number | null
          id?: string
          kcal?: number | null
          meal_plan_id: string
          meal_slot: string
          name: string
          notes?: string | null
          position: number
          protein_g?: number | null
          user_id?: string
        }
        Update: {
          amount?: string | null
          carbs_g?: number | null
          created_at?: string
          day_key?: string
          fat_g?: number | null
          id?: string
          kcal?: number | null
          meal_plan_id?: string
          meal_slot?: string
          name?: string
          notes?: string | null
          position?: number
          protein_g?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meal_plan_items_meal_plan_id_user_id_fkey"
            columns: ["meal_plan_id", "user_id"]
            isOneToOne: false
            referencedRelation: "meal_plans"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      meal_plans: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      plan_days: {
        Row: {
          created_at: string
          day_index: number
          id: string
          is_rest: boolean
          plan_id: string
          title: string | null
          user_id: string
          weekday: number | null
        }
        Insert: {
          created_at?: string
          day_index: number
          id?: string
          is_rest?: boolean
          plan_id: string
          title?: string | null
          user_id?: string
          weekday?: number | null
        }
        Update: {
          created_at?: string
          day_index?: number
          id?: string
          is_rest?: boolean
          plan_id?: string
          title?: string | null
          user_id?: string
          weekday?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "plan_days_plan_id_user_id_fkey"
            columns: ["plan_id", "user_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      plan_exercises: {
        Row: {
          created_at: string
          display_name: string | null
          exercise_key: string
          id: string
          notes: string | null
          plan_day_id: string
          position: number
          rep_max: number | null
          rep_min: number | null
          rest_seconds: number | null
          sets: number | null
          start_weight_kg: number | null
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          exercise_key: string
          id?: string
          notes?: string | null
          plan_day_id: string
          position: number
          rep_max?: number | null
          rep_min?: number | null
          rest_seconds?: number | null
          sets?: number | null
          start_weight_kg?: number | null
          user_id?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          exercise_key?: string
          id?: string
          notes?: string | null
          plan_day_id?: string
          position?: number
          rep_max?: number | null
          rep_min?: number | null
          rest_seconds?: number | null
          sets?: number | null
          start_weight_kg?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_exercises_plan_day_id_user_id_fkey"
            columns: ["plan_day_id", "user_id"]
            isOneToOne: false
            referencedRelation: "plan_days"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      plans: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          split: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          split?: string | null
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          split?: string | null
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          birth_year: number | null
          created_at: string
          days_per_week: number | null
          display_name: string | null
          equipment: string[]
          goal: string | null
          height_cm: number | null
          id: string
          level: string | null
          location: string | null
          onboarded: boolean
          sex: string | null
          updated_at: string
        }
        Insert: {
          birth_year?: number | null
          created_at?: string
          days_per_week?: number | null
          display_name?: string | null
          equipment?: string[]
          goal?: string | null
          height_cm?: number | null
          id: string
          level?: string | null
          location?: string | null
          onboarded?: boolean
          sex?: string | null
          updated_at?: string
        }
        Update: {
          birth_year?: number | null
          created_at?: string
          days_per_week?: number | null
          display_name?: string | null
          equipment?: string[]
          goal?: string | null
          height_cm?: number | null
          id?: string
          level?: string | null
          location?: string | null
          onboarded?: boolean
          sex?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      workout_sets: {
        Row: {
          created_at: string
          exercise_key: string
          id: string
          reps: number | null
          set_index: number
          user_id: string
          weight_kg: number | null
          workout_id: string
        }
        Insert: {
          created_at?: string
          exercise_key: string
          id?: string
          reps?: number | null
          set_index: number
          user_id?: string
          weight_kg?: number | null
          workout_id: string
        }
        Update: {
          created_at?: string
          exercise_key?: string
          id?: string
          reps?: number | null
          set_index?: number
          user_id?: string
          weight_kg?: number | null
          workout_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workout_sets_workout_id_user_id_fkey"
            columns: ["workout_id", "user_id"]
            isOneToOne: false
            referencedRelation: "workouts"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      workouts: {
        Row: {
          created_at: string
          finished_at: string | null
          id: string
          plan_day_id: string | null
          started_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          finished_at?: string | null
          id?: string
          plan_day_id?: string | null
          started_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          finished_at?: string | null
          id?: string
          plan_day_id?: string | null
          started_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workouts_plan_day_id_user_id_fkey"
            columns: ["plan_day_id", "user_id"]
            isOneToOne: false
            referencedRelation: "plan_days"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_meal_plan: {
        Args: { p_items: Json; p_name: string }
        Returns: string
      }
      create_plan: {
        Args: { p_days: Json; p_name: string; p_split: string }
        Returns: string
      }
      exercise_progress: { Args: { p_exercise_key: string }; Returns: Json }
      training_stats: { Args: never; Returns: Json }
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
    Enums: {},
  },
} as const

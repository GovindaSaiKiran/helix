-- ==============================================================================
-- HELIX DATABASE SCHEMA & ROW LEVEL SECURITY (RLS) POLICIES
-- Supabase PostgreSQL Primary Persistence Layer
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==============================================================================
-- 2. PROFILES TABLE (Linked to Supabase Auth)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL DEFAULT '',
    email TEXT NOT NULL DEFAULT '',
    avatar_url TEXT,
    course TEXT DEFAULT '',
    stream TEXT DEFAULT '',
    year TEXT DEFAULT '',
    enrolled_subjects TEXT[] DEFAULT '{}',
    theme TEXT DEFAULT 'light' CHECK (theme IN ('light', 'dark', 'system')),
    reminder_timings TEXT[] DEFAULT '{"10_min", "30_min", "at_start"}',
    notification_preferences JSONB DEFAULT '{"inApp": true, "fcmPush": true}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Enable RLS for profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profiles RLS Policies
CREATE POLICY "Users can view own profile"
    ON public.profiles FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
    ON public.profiles FOR INSERT
    WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can delete own profile"
    ON public.profiles FOR DELETE
    USING (auth.uid() = id);

-- Trigger to automatically create a profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, name)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', '')
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ==============================================================================
-- 3. SUBJECTS TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.subjects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    code TEXT DEFAULT '',
    color TEXT DEFAULT '#6366F1',
    syllabus_coverage NUMERIC DEFAULT 0 CHECK (syllabus_coverage >= 0 AND syllabus_coverage <= 100),
    total_units INTEGER DEFAULT 0,
    completed_units INTEGER DEFAULT 0,
    target_grade TEXT,
    priority TEXT DEFAULT 'medium' CHECK (priority IN ('urgent', 'high', 'medium', 'low')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own subjects" ON public.subjects FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own subjects" ON public.subjects FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own subjects" ON public.subjects FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own subjects" ON public.subjects FOR DELETE USING (auth.uid() = user_id);

-- ==============================================================================
-- 4. SYLLABUS UNITS & TOPICS TABLES
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.syllabus_units (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
    unit_number INTEGER NOT NULL,
    title TEXT NOT NULL,
    progress NUMERIC DEFAULT 0,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'rescheduled', 'cancelled')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.syllabus_units ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own syllabus units" ON public.syllabus_units FOR ALL USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.syllabus_topics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    unit_id UUID NOT NULL REFERENCES public.syllabus_units(id) ON DELETE CASCADE,
    subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    order_index INTEGER DEFAULT 1,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'rescheduled', 'cancelled')),
    progress NUMERIC DEFAULT 0,
    estimated_minutes INTEGER DEFAULT 45,
    mastery_score NUMERIC DEFAULT 0,
    key_points TEXT[] DEFAULT '{}',
    simplified_explanation TEXT,
    full_explanation TEXT,
    examples TEXT[] DEFAULT '{}',
    exam_tips TEXT[] DEFAULT '{}',
    youtube_recommendations JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.syllabus_topics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own syllabus topics" ON public.syllabus_topics FOR ALL USING (auth.uid() = user_id);

-- ==============================================================================
-- 5. STUDY MATERIALS TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.study_materials (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
    topic_id UUID REFERENCES public.syllabus_topics(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    file_type TEXT NOT NULL CHECK (file_type IN ('pdf', 'notes', 'slides', 'summary')),
    file_size TEXT DEFAULT '',
    file_url TEXT,
    content_text TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.study_materials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own study materials" ON public.study_materials FOR ALL USING (auth.uid() = user_id);

-- ==============================================================================
-- 6. TASKS & PROJECTS TABLES
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('assignment', 'project', 'goal', 'exam_prep')),
    priority TEXT DEFAULT 'medium' CHECK (priority IN ('urgent', 'high', 'medium', 'low')),
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'rescheduled', 'cancelled')),
    progress NUMERIC DEFAULT 0,
    due_date TEXT,
    created_date TEXT,
    estimated_effort_hours NUMERIC DEFAULT 0,
    remaining_effort_hours NUMERIC DEFAULT 0,
    dependencies TEXT[] DEFAULT '{}',
    modules JSONB DEFAULT '[]'::jsonb,
    notes TEXT DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own projects" ON public.projects FOR ALL USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL,
    project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    type TEXT NOT NULL CHECK (type IN ('study', 'assignment', 'project', 'revision', 'quiz', 'break')),
    priority TEXT DEFAULT 'medium' CHECK (priority IN ('urgent', 'high', 'medium', 'low')),
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'rescheduled', 'cancelled')),
    estimated_minutes INTEGER DEFAULT 45,
    actual_minutes INTEGER DEFAULT 0,
    due_date TEXT,
    scheduled_date DATE DEFAULT CURRENT_DATE,
    scheduled_start_time TEXT,
    scheduled_end_time TEXT,
    is_urgent BOOLEAN DEFAULT FALSE,
    progress NUMERIC DEFAULT 0,
    difficulty TEXT DEFAULT 'medium' CHECK (difficulty IN ('easy', 'medium', 'hard')),
    notes TEXT DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own tasks" ON public.tasks FOR ALL USING (auth.uid() = user_id);

-- ==============================================================================
-- 7. AVAILABILITY WINDOWS & PLAN VERSIONS TABLES
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.availability_windows (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    day_of_week TEXT NOT NULL CHECK (day_of_week IN ('Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun')),
    available_hours NUMERIC NOT NULL DEFAULT 4,
    planned_hours NUMERIC NOT NULL DEFAULT 0,
    buffer_hours NUMERIC NOT NULL DEFAULT 1,
    energy_profile TEXT NOT NULL DEFAULT 'evening' CHECK (energy_profile IN ('morning', 'afternoon', 'evening')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    UNIQUE(user_id, day_of_week)
);

ALTER TABLE public.availability_windows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own availability" ON public.availability_windows FOR ALL USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.plan_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    available_hours NUMERIC NOT NULL,
    planned_hours NUMERIC NOT NULL,
    buffer_hours NUMERIC NOT NULL,
    health_status TEXT NOT NULL,
    health_percentage NUMERIC NOT NULL,
    reason TEXT NOT NULL,
    applied_changes TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.plan_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own plan versions" ON public.plan_versions FOR ALL USING (auth.uid() = user_id);

-- ==============================================================================
-- 8. QUIZ RESULTS & ATTEMPTS TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.quiz_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    quiz_id TEXT NOT NULL,
    quiz_title TEXT NOT NULL,
    subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL,
    topic_id UUID REFERENCES public.syllabus_topics(id) ON DELETE SET NULL,
    topic_name TEXT NOT NULL,
    score INTEGER NOT NULL,
    total_score INTEGER NOT NULL,
    percentage NUMERIC NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('passed', 'needs_revision')),
    strong_topics TEXT[] DEFAULT '{}',
    needs_revision_topics TEXT[] DEFAULT '{}',
    recommended_action TEXT DEFAULT '',
    user_answers JSONB DEFAULT '[]'::jsonb,
    completed_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.quiz_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own quiz results" ON public.quiz_results FOR ALL USING (auth.uid() = user_id);

-- ==============================================================================
-- 9. NOTIFICATIONS TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    channel TEXT NOT NULL DEFAULT 'in_app' CHECK (channel IN ('in_app', 'fcm')),
    type TEXT NOT NULL DEFAULT 'reminder' CHECK (type IN ('reminder', 'deadline', 'replan', 'achievement')),
    read BOOLEAN NOT NULL DEFAULT FALSE,
    action_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own notifications" ON public.notifications FOR ALL USING (auth.uid() = user_id);

-- ==============================================================================
-- 10. NOTIFICATION DEVICES TABLE (Firebase Web Push Registrations)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.notification_devices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    installation_id TEXT NOT NULL,
    device_type TEXT DEFAULT 'browser',
    browser TEXT,
    platform TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    UNIQUE(user_id, installation_id)
);

CREATE INDEX IF NOT EXISTS idx_notification_devices_user_id ON public.notification_devices(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_devices_installation_id ON public.notification_devices(installation_id);

ALTER TABLE public.notification_devices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notification devices"
    ON public.notification_devices FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own notification devices"
    ON public.notification_devices FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own notification devices"
    ON public.notification_devices FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own notification devices"
    ON public.notification_devices FOR DELETE
    USING (auth.uid() = user_id);

-- ==============================================================================
-- 11. REMINDER DELIVERIES TABLE (Atomic Deduplication & Delivery State Tracking)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.reminder_deliveries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    delivery_key TEXT NOT NULL UNIQUE, -- Unique delivery identity: "task_<task_id>_<scheduled_date>"
    task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('claimed', 'sent', 'failed')),
    channel TEXT NOT NULL DEFAULT 'fcm' CHECK (channel IN ('fcm', 'in_app', 'email')),
    claimed_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    sent_at TIMESTAMPTZ,
    failed_at TIMESTAMPTZ,
    error_message TEXT,
    attempt_count INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_reminder_deliveries_task_id ON public.reminder_deliveries(task_id);
CREATE INDEX IF NOT EXISTS idx_reminder_deliveries_user_id ON public.reminder_deliveries(user_id);
CREATE INDEX IF NOT EXISTS idx_reminder_deliveries_status ON public.reminder_deliveries(status);

ALTER TABLE public.reminder_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own reminder deliveries"
    ON public.reminder_deliveries FOR SELECT
    USING (auth.uid() = user_id);



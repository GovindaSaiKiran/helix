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

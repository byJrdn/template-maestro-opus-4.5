-- ============================================================
-- Add username column to profiles table
-- Run this in Supabase SQL Editor to add username support
-- ============================================================

-- Add username column
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS username TEXT;

-- Create unique index on username
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles(username);

-- Update the first admin user after they register:
-- UPDATE public.profiles 
-- SET role = 'admin', status = 'active', approved_at = NOW()
-- WHERE username = 'jyoung';

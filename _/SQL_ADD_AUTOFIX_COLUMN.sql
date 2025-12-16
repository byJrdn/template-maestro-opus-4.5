-- Add auto_fix_settings column to templates table
-- Run this in Supabase SQL Editor

ALTER TABLE public.templates 
ADD COLUMN IF NOT EXISTS auto_fix_settings JSONB DEFAULT '{}'::jsonb;

-- Update the column to have a default value for existing rows
UPDATE public.templates 
SET auto_fix_settings = '{}'::jsonb 
WHERE auto_fix_settings IS NULL;

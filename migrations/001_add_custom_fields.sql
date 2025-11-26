-- Migration: Add custom fields for dynamic toggle options
-- Run this in Supabase SQL Editor after the initial schema

-- Add JSON columns for custom toggle items
ALTER TABLE journal_entries
ADD COLUMN IF NOT EXISTS custom_banned JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS custom_recovery JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS custom_health JSONB DEFAULT '{}';

-- These columns store custom toggle values like:
-- {"morning_routine": true, "evening_routine": false}

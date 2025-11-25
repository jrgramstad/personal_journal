-- JR Daily Journal Schema
-- Run this in the Supabase SQL Editor to create the journal_entries table

CREATE TABLE journal_entries (
  id SERIAL PRIMARY KEY,
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,

  -- Mood & Energy (1-10)
  mood INTEGER,
  energy INTEGER,
  stress INTEGER,

  -- Ashley
  ashley_connection INTEGER,
  ashley_conflict BOOLEAN DEFAULT FALSE,
  ashley_thoughtful BOOLEAN DEFAULT FALSE,
  ashley_withdrew BOOLEAN DEFAULT FALSE,

  -- Kids
  kids_quality_time INTEGER,
  kids_engaged BOOLEAN DEFAULT FALSE,

  -- Banned Behaviors
  thc BOOLEAN DEFAULT FALSE,
  alcohol BOOLEAN DEFAULT FALSE,
  fantasy_sports BOOLEAN DEFAULT FALSE,
  other_compulsion BOOLEAN DEFAULT FALSE,
  other_compulsion_notes TEXT,

  -- Recovery
  naltrexone BOOLEAN DEFAULT FALSE,
  meeting_attended BOOLEAN DEFAULT FALSE,
  sponsor_contact BOOLEAN DEFAULT FALSE,
  therapy_this_week BOOLEAN DEFAULT FALSE,
  cravings INTEGER,

  -- Health
  medications_taken BOOLEAN DEFAULT FALSE,
  post_dinner_walk BOOLEAN DEFAULT FALSE,
  meditation BOOLEAN DEFAULT FALSE,
  workout BOOLEAN DEFAULT FALSE,
  sleep_quality INTEGER,

  -- Work
  productive_hours NUMERIC(4,1),
  strategic_percent INTEGER,
  decision_fatigue INTEGER,
  protected_peak_hours BOOLEAN DEFAULT FALSE,

  -- Reflection
  what_went_well TEXT,
  what_to_change TEXT,
  tomorrow_priority TEXT,

  created_at TIMESTAMP DEFAULT NOW()
);

-- Prevent duplicate entries per day
CREATE UNIQUE INDEX idx_journal_date ON journal_entries(entry_date);

-- Enable Row Level Security (optional, but recommended for future auth)
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;

-- Create a policy that allows all operations (no auth for MVP)
-- This allows the anon key to perform all operations
CREATE POLICY "Allow all operations for MVP" ON journal_entries
  FOR ALL
  USING (true)
  WITH CHECK (true);

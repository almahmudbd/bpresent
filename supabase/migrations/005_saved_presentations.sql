-- Create saved_presentations table for users to save and reuse their presentations

CREATE TABLE IF NOT EXISTS saved_presentations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  slides JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster lookups by user
CREATE INDEX IF NOT EXISTS idx_saved_presentations_user ON saved_presentations(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_presentations_updated ON saved_presentations(updated_at DESC);

-- Enable Row Level Security
ALTER TABLE saved_presentations ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only access their own presentations
CREATE POLICY "Users can view their own presentations"
  ON saved_presentations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own presentations"
  ON saved_presentations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own presentations"
  ON saved_presentations FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own presentations"
  ON saved_presentations FOR DELETE
  USING (auth.uid() = user_id);

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
CREATE TRIGGER update_saved_presentations_updated_at
  BEFORE UPDATE ON saved_presentations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Comments for documentation
COMMENT ON TABLE saved_presentations IS 'Stores user-saved presentation templates for reuse';
COMMENT ON COLUMN saved_presentations.slides IS 'JSON array of slide objects with type, question, and options';

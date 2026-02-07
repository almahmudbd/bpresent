-- Fix for Poll Creation Constraint Error
-- Run this in Supabase SQL Editor to allow anonymous users to create polls without a presenter_id

-- Make presenter_id nullable to support anonymous polls
ALTER TABLE polls ALTER COLUMN presenter_id DROP NOT NULL;

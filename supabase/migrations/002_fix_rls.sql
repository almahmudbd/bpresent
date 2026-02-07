-- Fix for Poll Creation RLS Error
-- Run this in Supabase SQL Editor to allow anonymous users to create polls

-- 1. Allow anonymous users to insert into polls table
CREATE POLICY "Public can create polls"
ON polls
FOR INSERT
TO anon
WITH CHECK (true);

-- 2. Allow anonymous users to update polls (e.g. changing active slide)
CREATE POLICY "Public can update polls"
ON polls
FOR UPDATE
TO anon
USING (true);

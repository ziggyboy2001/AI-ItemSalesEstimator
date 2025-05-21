import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://sxkrkcxumaphascahdxz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN4a3JrY3h1bWFwaGFzY2FoZHh6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDc3NTM1OTQsImV4cCI6MjA2MzMyOTU5NH0.1CDLFPztnmcFD3ekqIl36RGyMQ0Dqv8LNQ3PBgoD4II';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY); 
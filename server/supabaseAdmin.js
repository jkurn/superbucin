import { createClient } from '@supabase/supabase-js';
import { env } from './config/env.js';

const supabaseUrl = env.SUPABASE_URL || '';
const supabaseServiceKey = env.SUPABASE_SERVICE_ROLE_KEY || '';

export const supabase = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;

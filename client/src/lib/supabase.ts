import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://mwhppdxrfekyazcliqcc.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im13aHBwZHhyZmVreWF6Y2xpcWNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEwODg2MzEsImV4cCI6MjA5NjY2NDYzMX0.zIhEw3ItdEqnq_PWeGA-Qwho27PsjKNP96vQuWVj_J8';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// The app stores all state as a single JSONB blob in sqgs_app_state table
// row id = 'default'
export const APP_STATE_ID = 'default';

export async function loadAppState(): Promise<Record<string, unknown> | null> {
  const { data, error } = await supabase
    .from('sqgs_app_state')
    .select('data')
    .eq('id', APP_STATE_ID)
    .single();

  if (error) {
    console.error('Supabase load error:', error);
    return null;
  }
  return data?.data ?? null;
}

export async function saveAppState(state: Record<string, unknown>): Promise<void> {
  const { error } = await supabase
    .from('sqgs_app_state')
    .upsert({ id: APP_STATE_ID, data: state }, { onConflict: 'id' });

  if (error) {
    console.error('Supabase save error:', error);
  }
}

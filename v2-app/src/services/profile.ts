import { supabase } from './supabase';

export async function getDisplayName(userId: string): Promise<string> {
  const { data } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('id', userId)
    .single();
  return (data as { display_name?: string | null } | null)?.display_name ?? '';
}

export async function setDisplayName(userId: string, name: string): Promise<void> {
  await supabase
    .from('profiles')
    .update({ display_name: name || null })
    .eq('id', userId);
}

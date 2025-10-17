// Preparado para Supabase; preencha quando integrar.
// Exemplo:
// export const SUPABASE_URL = 'https://your-project.supabase.co'
// export const SUPABASE_ANON_KEY = 'public-anon-key'
export const SupabaseConfig = {
  url: null,
  key: null,
  init(url, key){
    this.url = url; this.key = key;
  }
};
export default SupabaseConfig;

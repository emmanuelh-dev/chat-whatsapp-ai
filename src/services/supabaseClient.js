import { createClient } from '@supabase/supabase-js';

// Obtener las variables de entorno
const supabaseUrl = process.env.SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.REACT_APP_SUPABASE_ANON_KEY;

// Verificar que las variables de entorno estén definidas
if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Error: Variables de entorno de Supabase no configuradas correctamente.');
  console.error('Asegúrate de tener SUPABASE_URL y SUPABASE_ANON_KEY en tu archivo .env');
}

// Crear y exportar el cliente de Supabase
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default supabase;
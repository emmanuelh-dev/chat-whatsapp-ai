import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Cargar variables de entorno
dotenv.config();

// Crear cliente de Supabase usando las variables de entorno
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: Variables de entorno SUPABASE_URL o SUPABASE_ANON_KEY no definidas');
}

// Crear y exportar el cliente de Supabase
const supabase = createClient(supabaseUrl, supabaseKey);

export default supabase;
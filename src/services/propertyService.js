import supabase from './supabaseClient';

// Función para obtener todas las propiedades
export const fetchProperties = async () => {
  try {
    const { data, error } = await supabase
      .from('propiedades')
      .select('*');
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error al obtener propiedades:', error);
    throw error;
  }
};

// Función para obtener propiedades activas
export const fetchActiveProperties = async () => {
  try {
    const { data, error } = await supabase
      .from('propiedades')
      .select('*')
      .eq('activa', true);
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error al obtener propiedades activas:', error);
    throw error;
  }
};

// Función para obtener una propiedad por ID
export const fetchPropertyById = async (id) => {
  try {
    const { data, error } = await supabase
      .from('propiedades')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error al obtener propiedad por ID:', error);
    throw error;
  }
};

// Función para buscar propiedades por criterios
export const searchProperties = async (criteria) => {
  try {
    let query = supabase
      .from('propiedades')
      .select('*');
    
    // Aplicar filtros según los criterios proporcionados
    if (criteria.tipopropiedad) {
      query = query.eq('tipopropiedad', criteria.tipopropiedad.toLowerCase());
    }
    
    if (criteria.precioMin) {
      query = query.gte('precio', criteria.precioMin);
    }
    
    if (criteria.precioMax) {
      query = query.lte('precio', criteria.precioMax);
    }
    
    if (criteria.habitaciones) {
      query = query.gte('habitaciones', criteria.habitaciones);
    }
    
    if (criteria.banos) {
      query = query.gte('banos', criteria.banos);
    }
    
    if (criteria.ubicacion) {
      query = query.ilike('ubicacion', `%${criteria.ubicacion}%`);
    }
    
    // Solo propiedades activas
    query = query.eq('activa', true);
    
    const { data, error } = await query;
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error al buscar propiedades:', error);
    throw error;
  }
};
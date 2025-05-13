import supabase from './supabaseClient.js';
import { logger } from '../utils/logger.js';

/**
 * Obtiene todas las propiedades activas de Supabase
 * @returns {Promise<Array>} - Lista de propiedades activas
 */
export async function fetchActiveProperties() {
  try {
    const { data, error } = await supabase
      .from('propiedades')  // Asumiendo que la tabla se llama 'propiedades'
      .select('*')
      .eq('activa', true);  // Filtrando solo propiedades activas
    
    if (error) {
      logger.error('Error al obtener propiedades activas de Supabase', error);
      return [];
    }
    
    return data || [];
  } catch (error) {
    logger.error('Error en fetchActiveProperties', error);
    return [];
  }
}

/**
 * Busca propiedades en Supabase según criterios específicos
 * @param {Object} criteria - Criterios de búsqueda
 * @returns {Promise<Array>} - Lista de propiedades que coinciden con los criterios
 */
export async function searchProperties(criteria = {}) {
  try {
    let query = supabase
      .from('propiedades')
      .select('*')
      .eq('activa', true);  // Siempre filtramos por propiedades activas
    
    // Aplicar filtros según los criterios proporcionados
    if (criteria.tipopropiedad) {
      query = query.ilike('tipo_propiedad', `%${criteria.tipopropiedad}%`);
    }
    
    if (criteria.ubicacion) {
      query = query.ilike('ubicacion', `%${criteria.ubicacion}%`);
    }
    
    if (criteria.precioMin) {
      query = query.gte('precio', criteria.precioMin);
    }
    
    if (criteria.precioMax) {
      query = query.lte('precio', criteria.precioMax);
    }
    
    if (criteria.habitaciones) {
      query = query.eq('habitaciones', criteria.habitaciones);
    }
    
    if (criteria.banos) {
      query = query.eq('banos', criteria.banos);
    }
    
    const { data, error } = await query;
    
    if (error) {
      logger.error('Error al buscar propiedades en Supabase', error);
      return [];
    }
    
    return data || [];
  } catch (error) {
    logger.error('Error en searchProperties', error);
    return [];
  }
}

/**
 * Obtiene una propiedad específica por ID
 * @param {string|number} id - ID de la propiedad
 * @returns {Promise<Object|null>} - Datos de la propiedad o null si no se encuentra
 */
export async function getPropertyById(id) {
  try {
    const { data, error } = await supabase
      .from('propiedades')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) {
      logger.error(`Error al obtener propiedad con ID ${id}`, error);
      return null;
    }
    
    return data;
  } catch (error) {
    logger.error(`Error en getPropertyById para ID ${id}`, error);
    return null;
  }
}
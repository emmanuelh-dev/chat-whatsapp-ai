/**
 * Utilidades para el manejo de propiedades inmobiliarias
 */
import { properties, formatPrice } from '../data/properties.js';
import { fetchActiveProperties, searchProperties } from '../services/propertyService.js';
import { logger } from './logger.js';

/**
 * Busca propiedades que coincidan con los criterios de búsqueda en el texto
 * @param {string} text - El texto de la consulta
 * @returns {Array} - Lista de propiedades que coinciden con la búsqueda
 */
export function searchPropertiesInText(text) {
  if (!text) return [];
  
  const lowerText = text.toLowerCase();
  const results = [];
  
  // Buscar por tipo de propiedad
  const propertyTypes = ['casa', 'departamento', 'terreno', 'quinta'];
  let matchedType = null;
  
  for (const type of propertyTypes) {
    if (lowerText.includes(type)) {
      matchedType = type;
      break;
    }
  }
  
  // Buscar por ubicación
  const locations = properties.map(p => p.location.toLowerCase());
  let matchedLocation = null;
  
  for (const location of locations) {
    if (lowerText.includes(location.toLowerCase())) {
      matchedLocation = location;
      break;
    }
  }
  
  // Buscar por rango de precio
  const priceRegex = /(\d[\d,]*)\s*(?:mil|millones|mdp|pesos)/gi;
  const priceMatches = [...lowerText.matchAll(priceRegex)];
  let minPrice = 0;
  let maxPrice = Number.MAX_SAFE_INTEGER;
  
  if (priceMatches.length > 0) {
    // Extraer valores de precio mencionados
    const prices = priceMatches.map(match => {
      let price = match[1].replace(/,/g, '');
      if (match[0].includes('millones') || match[0].includes('mdp')) {
        price = parseFloat(price) * 1000000;
      } else if (match[0].includes('mil')) {
        price = parseFloat(price) * 1000;
      }
      return parseFloat(price);
    });
    
    // Determinar si es un rango o un precio específico
    if (lowerText.includes('menos de') || lowerText.includes('máximo')) {
      maxPrice = Math.min(...prices);
    } else if (lowerText.includes('más de') || lowerText.includes('mínimo')) {
      minPrice = Math.max(...prices);
    } else if (prices.length >= 2) {
      minPrice = Math.min(...prices);
      maxPrice = Math.max(...prices);
    } else if (prices.length === 1) {
      // Asumimos un rango de ±20% si solo se menciona un precio
      const price = prices[0];
      minPrice = price * 0.8;
      maxPrice = price * 1.2;
    }
  }
  
  // Filtrar propiedades según los criterios encontrados
  return properties.filter(property => {
    let matches = true;
    
    if (matchedType && property.type.toLowerCase() !== matchedType) {
      matches = false;
    }
    
    if (matchedLocation && !property.location.toLowerCase().includes(matchedLocation)) {
      matches = false;
    }
    
    if (property.price < minPrice || property.price > maxPrice) {
      matches = false;
    }
    
    return matches;
  });
}

/**
 * Genera un mensaje con el resumen de las propiedades encontradas
 * @param {Array} matchedProperties - Lista de propiedades encontradas
 * @param {string} language - Idioma para el mensaje (es/en)
 * @returns {string} - Mensaje formateado con las propiedades
 */
export function formatPropertyResults(matchedProperties, language = 'es') {
  if (!matchedProperties || matchedProperties.length === 0) {
    return language === 'es' 
      ? "No encontré propiedades que coincidan con tu búsqueda en nuestro inventario."
      : "I couldn't find properties matching your search in our inventory.";
  }
  
  const header = language === 'es'
    ? `📋 Encontré ${matchedProperties.length} propiedad(es) que podrían interesarte:`
    : `📋 I found ${matchedProperties.length} property(ies) that might interest you:`;
  
  const propertyList = matchedProperties.map(property => {
    return `🏠 *${property.title}*\n📍 ${property.location}\n💰 ${formatPrice(property.price)}\n${property.description || ''}`;
  }).join('\n\n');
  
  const footer = language === 'es'
    ? '¿Te gustaría más información sobre alguna de estas propiedades?'
    : 'Would you like more information about any of these properties?';
  
  return `${header}\n\n${propertyList}\n\n${footer}`;
}

/**
 * Genera un mensaje con el inventario completo de propiedades
 * @param {string} language - Idioma para el mensaje (es/en)
 * @returns {string} - Mensaje formateado con todas las propiedades
 */
export function getFullInventoryMessage(language = 'es') {
  const header = language === 'es'
    ? "📋 INVENTARIO COMPLETO DE PROPIEDADES:\n"
    : "📋 COMPLETE PROPERTY INVENTORY:\n";
  
  const propertyList = properties.map(property => {
    return `${property.id}. *${property.title}* - ${property.location} - ${formatPrice(property.price)}`;
  }).join('\n');
  
  return `${header}${propertyList}`;
}

/**
 * Busca propiedades activas en Supabase que coincidan con los criterios de búsqueda
 * @param {string} text - El texto de la consulta
 * @returns {Promise<Array>} - Lista de propiedades que coinciden con la búsqueda
 */
export async function searchPropertiesFromSupabase(text) {
  if (!text) return [];
  
  const lowerText = text.toLowerCase();
  
  // Extraer criterios de búsqueda del texto
  const criteria = {};
  
  // Buscar por tipo de propiedad
  const propertyTypes = ['casa', 'departamento', 'terreno', 'quinta'];
  for (const type of propertyTypes) {
    if (lowerText.includes(type)) {
      criteria.tipopropiedad = type;
      break;
    }
  }
  
  // Buscar por ubicación
  // Extraer posibles ubicaciones del texto
  const locationRegex = /(?:en|cerca de|por|zona)\s+([a-zÀ-ÿ\s]+?)(?:\s+con|\s+que|\s+de|\.|,|$)/i;
  const locationMatch = lowerText.match(locationRegex);
  if (locationMatch && locationMatch[1]) {
    criteria.ubicacion = locationMatch[1].trim();
  }
  
  // Buscar por rango de precio
  const priceRegex = /(\d[\d,]*)\s*(?:mil|millones|mdp|pesos)/gi;
  const priceMatches = [...lowerText.matchAll(priceRegex)];
  
  if (priceMatches.length > 0) {
    // Extraer valores de precio mencionados
    const prices = priceMatches.map(match => {
      let price = match[1].replace(/,/g, '');
      if (match[0].includes('millones') || match[0].includes('mdp')) {
        price = parseFloat(price) * 1000000;
      } else if (match[0].includes('mil')) {
        price = parseFloat(price) * 1000;
      }
      return parseFloat(price);
    });
    
    // Determinar si es un rango o un precio específico
    if (lowerText.includes('menos de') || lowerText.includes('máximo')) {
      criteria.precioMax = Math.min(...prices);
    } else if (lowerText.includes('más de') || lowerText.includes('mínimo')) {
      criteria.precioMin = Math.max(...prices);
    } else if (prices.length >= 2) {
      criteria.precioMin = Math.min(...prices);
      criteria.precioMax = Math.max(...prices);
    } else if (prices.length === 1) {
      // Asumimos un rango de ±20% si solo se menciona un precio
      const price = prices[0];
      criteria.precioMin = price * 0.8;
      criteria.precioMax = price * 1.2;
    }
  }
  
  // Buscar por número de habitaciones
  const roomsRegex = /(\d+)\s*(?:habitaciones|recámaras|cuartos|dormitorios)/i;
  const roomsMatch = lowerText.match(roomsRegex);
  if (roomsMatch && roomsMatch[1]) {
    criteria.habitaciones = parseInt(roomsMatch[1]);
  }
  
  // Buscar por número de baños
  const bathsRegex = /(\d+)\s*(?:baños|baño)/i;
  const bathsMatch = lowerText.match(bathsRegex);
  if (bathsMatch && bathsMatch[1]) {
    criteria.banos = parseInt(bathsMatch[1]);
  }
  
  // Realizar la búsqueda en Supabase
  try {
    logger.info('Buscando propiedades con criterios', { criteria });
    return await searchProperties(criteria);
  } catch (error) {
    logger.error('Error al buscar propiedades en Supabase:', error);
    // Si hay error, intentar obtener todas las propiedades activas
    return await fetchActiveProperties();
  }
}

/**
 * Formatea los resultados de propiedades de Supabase
 * @param {Array} matchedProperties - Lista de propiedades encontradas
 * @param {string} language - Idioma para el mensaje (es/en)
 * @returns {string} - Mensaje formateado con las propiedades
 */
export function formatSupabasePropertyResults(matchedProperties, language = 'es') {
  if (!matchedProperties || matchedProperties.length === 0) {
    return language === 'es' 
      ? "No encontré propiedades que coincidan con tu búsqueda en nuestro inventario."
      : "I couldn't find properties matching your search in our inventory.";
  }
  
  const header = language === 'es'
    ? `📋 Encontré ${matchedProperties.length} propiedad(es) que podrían interesarte:`
    : `📋 I found ${matchedProperties.length} property(ies) that might interest you:`;
  
  const propertyList = matchedProperties.map(property => {
    const price = new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(property.precio);
    
    return `🏠 *${property.titulo || 'Propiedad'}*\n📍 ${property.ubicacion || 'Ubicación no especificada'}\n💰 ${price}\n${property.descripcion || ''}`;
  }).join('\n\n');
  
  const footer = language === 'es'
    ? '¿Te gustaría más información sobre alguna de estas propiedades?'
    : 'Would you like more information about any of these properties?';
  
  return `${header}\n\n${propertyList}\n\n${footer}`;
}
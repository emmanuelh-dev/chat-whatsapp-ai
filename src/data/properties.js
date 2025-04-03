// Inventario de propiedades inmobiliarias
export const properties = [
  {
    id: 1,
    title: "CASA EN VENTA VILLAS DE ANAHUAC",
    location: "Escobedo",
    price: 4750000,
    type: "casa",
    description: "Casa en venta ubicada en Villas de Anahuac, Escobedo."
  },
  {
    id: 2,
    title: "Casa Bosques de las misiones",
    location: "Bosques de las misiones",
    price: 12500000,
    type: "casa",
    description: "Casa en venta en Bosques de las misiones."
  },
  {
    id: 3,
    title: "Terrenos bosques de las misiones",
    location: "Bosques de las misiones",
    price: 4200000,
    type: "terreno",
    description: "Terreno en venta en Bosques de las misiones."
  },
  {
    id: 4,
    title: "Departamentos vivía roma TEC",
    location: "Zona TEC",
    price: 4000000,
    type: "departamento",
    description: "Departamento en venta cerca del TEC."
  },
  {
    id: 5,
    title: "Quinta en venta Zuazua",
    location: "Zuazua",
    price: 3700000,
    type: "quinta",
    description: "Quinta en venta ubicada en Zuazua."
  },
  {
    id: 6,
    title: "Departamento En Venta Zona Universidad",
    location: "Zona Universidad",
    price: 1800000,
    type: "departamento",
    description: "Departamento en venta en Zona Universidad."
  },
  {
    id: 7,
    title: "Departamento En Venta Zona Anahuac",
    location: "Zona Anahuac",
    price: 4400000,
    type: "departamento",
    description: "Departamento en venta en Zona Anahuac."
  }
];

// Función para buscar propiedades por tipo
export function findPropertiesByType(type) {
  return properties.filter(property => property.type.toLowerCase() === type.toLowerCase());
}

// Función para buscar propiedades por ubicación
export function findPropertiesByLocation(location) {
  return properties.filter(property => 
    property.location.toLowerCase().includes(location.toLowerCase()));
}

// Función para buscar propiedades por rango de precio
export function findPropertiesByPriceRange(minPrice, maxPrice) {
  return properties.filter(property => 
    property.price >= minPrice && property.price <= maxPrice);
}

// Función para obtener todas las propiedades
export function getAllProperties() {
  return properties;
}

// Función para obtener una propiedad por ID
export function getPropertyById(id) {
  return properties.find(property => property.id === id);
}

// Función para formatear el precio en formato de moneda
export function formatPrice(price) {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(price);
}

// Función para generar un resumen del inventario
export function getInventorySummary() {
  const totalProperties = properties.length;
  const typeCount = {};
  
  properties.forEach(property => {
    if (typeCount[property.type]) {
      typeCount[property.type]++;
    } else {
      typeCount[property.type] = 1;
    }
  });
  
  return {
    totalProperties,
    typeCount
  };
}
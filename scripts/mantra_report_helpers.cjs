function extractContactPhone(item) {
  const fields = item.customFields && typeof item.customFields === 'object'
    ? item.customFields
    : item;
  const rawPhone = [
    item.contactPhone,
    item.phone,
    item.contact?.phone,
    fields.contactPhone,
    fields.phone
  ].find(value => value !== null && value !== undefined && String(value).trim() !== '');

  if (rawPhone === undefined) return '';
  const digits = String(rawPhone).replace(/\D/g, '');
  return digits.length >= 9 ? digits.slice(-9) : '';
}

function extractTemplateFields(item) {
  const source = item.customFields && typeof item.customFields === 'object'
    ? item.customFields
    : item;
  const fields = {};

  for (let index = 1; index <= 20; index++) {
    const key = `custom_${index}`;
    if (source[key] !== undefined && source[key] !== null) {
      fields[key] = source[key];
    }
  }

  return fields;
}

function normalizeMapping(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

function resolveConfiguredCustomValue(item, config, aliases, fallbackIndex) {
  const fields = extractTemplateFields(item);
  const normalizedAliases = new Set(aliases.map(normalizeMapping));

  for (let index = 1; index <= 20; index++) {
    const mapping = config?.[`custom_${index}_campo`];
    if (normalizedAliases.has(normalizeMapping(mapping))) {
      const value = fields[`custom_${index}`];
      if (value !== undefined && value !== null && String(value).trim() !== '') {
        return value;
      }
      return null;
    }
  }

  const fallbackMapping = normalizeMapping(config?.[`custom_${fallbackIndex}_campo`]);
  if (fallbackMapping && !normalizedAliases.has(fallbackMapping)) return null;

  const fallback = fields[`custom_${fallbackIndex}`];
  return fallback !== undefined && fallback !== null && String(fallback).trim() !== ''
    ? fallback
    : null;
}

function extractOrderId(item, config) {
  const rawOrderId = resolveConfiguredCustomValue(
    item,
    config,
    ['ORDEN', 'ORDENID', 'ORDEN_ID'],
    11
  );
  if (rawOrderId === null) return null;

  const normalized = String(rawOrderId).trim();
  if (!/^[1-9]\d*$/.test(normalized)) return null;

  const orderId = Number(normalized);
  return Number.isSafeInteger(orderId) ? orderId : null;
}

function isValidTicket(val) {
  if (!val || typeof val !== 'string') return false;
  const s = val.trim();
  if (!s || s.length < 3) return false;
  if (/^https?:\/\//i.test(s)) return false;
  if (/^(internet|paquete|lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo)/i.test(s)) return false;
  if (/^[a-záéíóúñ\s.,;:'"\/\\-]+$/i.test(s) && !/\d/.test(s)) return false;
  if (/^\d{1,2}\s+de\s+[a-z]+/i.test(s) || /^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  if (/^\d{1,2}:\d{2}/.test(s)) return false;
  return /\d/.test(s);
}

function extractTicket(item, config) {
  const configuredTicket = resolveConfiguredCustomValue(
    item,
    config,
    ['TICKET', 'DOCUMENTO', 'CODISEGUI'],
    5
  );
  if (configuredTicket !== null && isValidTicket(String(configuredTicket))) {
    return String(configuredTicket).trim();
  }

  const fields = extractTemplateFields(item);
  const legacyTicket = fields.custom_1 || fields.custom_6;
  if (!legacyTicket) return null;

  const ticket = String(legacyTicket).trim();
  if (!isValidTicket(ticket)) {
    return null;
  }
  return ticket;
}

function resolveTemplateConfig(candidate, configs) {
  const matchingConfigs = configs.filter(config =>
    String(config.template_id) === String(candidate.template_id)
    && String(config.tipo_servicio).trim().toUpperCase()
      === String(candidate.tipo_servicio).trim().toUpperCase()
    && config.group_id
    && config.api_key
  );
  const configsByCredentials = new Map(
    matchingConfigs.map(config => [`${config.group_id}\u0000${config.api_key}`, config])
  );
  if (configsByCredentials.size !== 1) {
    throw new Error(
      configsByCredentials.size === 0
        ? `No hay credenciales configuradas para la plantilla ${candidate.template_id} y servicio ${candidate.tipo_servicio}.`
        : `La plantilla ${candidate.template_id} tiene una configuración ambigua.`
    );
  }
  return configsByCredentials.values().next().value;
}

module.exports = {
  extractContactPhone,
  extractOrderId,
  extractTemplateFields,
  extractTicket,
  isValidTicket,
  resolveConfiguredCustomValue,
  resolveTemplateConfig
};

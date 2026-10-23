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
  resolveTemplateConfig
};

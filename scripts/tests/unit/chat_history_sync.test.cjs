const assert = require('node:assert/strict');
const test = require('node:test');
const {
  buildChatMetrics,
  sortMessagesNewestFirst
} = require('../../chat_history_metrics.cjs');
const {
  extractContactPhone,
  extractOrderId,
  extractTemplateFields,
  extractTicket,
  resolveConfiguredCustomValue,
  resolveTemplateConfig
} = require('../../mantra_report_helpers.cjs');
const { getDateInTimeZone } = require('../../date_utils.cjs');

test('converts dates using the configured timezone instead of UTC day boundaries', () => {
  assert.equal(
    getDateInTimeZone(new Date('2026-10-23T02:00:00.000Z'), 'America/Lima'),
    '2026-10-22'
  );
});

test('extracts and normalizes the contact phone from supported report shapes', () => {
  assert.equal(extractContactPhone({ phone: '+51 987 654 321' }), '987654321');
  assert.equal(extractContactPhone({ customFields: { phone: '987-654-321' } }), '987654321');
  assert.equal(extractContactPhone({ contact: { phone: '987654321' } }), '987654321');
  assert.equal(extractContactPhone({ contactPhone: '987654321' }), '987654321');
});

test('rejects missing or invalid contact phones', () => {
  assert.equal(extractContactPhone({}), '');
  assert.equal(extractContactPhone({ phone: '12345' }), '');
});

test('extracts OrdenId from the configured custom slot, including custom_10', () => {
  const config = { custom_10_campo: 'ORDEN' };
  assert.equal(
    extractOrderId({ customFields: { custom_10: '123456' } }, config),
    123456
  );
  assert.equal(
    extractOrderId({ custom_10: '789' }, { custom_3_campo: 'ORDEN_ID', custom_10_campo: 'LINK' }),
    null
  );
  assert.equal(
    extractOrderId({ custom_3: '789', custom_10: '999' }, { custom_3_campo: 'orden_id' }),
    789
  );
});

test('extracts OrdenId from custom_11 after moving the configured mapping', () => {
  const config = { custom_10_campo: 'LINK', custom_11_campo: 'ORDEN' };
  const item = {
    custom_10: 'https://example.test/seguimiento/token',
    custom_11: '3545279'
  };

  assert.equal(extractOrderId(item, config), 3545279);
  assert.deepEqual(extractTemplateFields(item), {
    custom_10: 'https://example.test/seguimiento/token',
    custom_11: '3545279'
  });
});

test('rejects partial, zero, unsafe, and nonnumeric OrdenId values', () => {
  for (const value of ['123abc', '0', '-1', '1.5', '9007199254740992']) {
    assert.equal(extractOrderId({ custom_10: value }, {}), null);
  }
});

test('uses the new template layout for ticket, token, PIN, and stored custom fields', () => {
  const item = {
    name: 'Cliente',
    custom_5: 'TCK-123',
    custom_7: '4321',
    custom_8: 'x'.repeat(24),
    custom_9: 'https://example.test/seguimiento/secret',
    custom_10: '123456',
    custom_11: '789012',
    phone: '987654321'
  };
  const config = {
    custom_5_campo: 'TICKET',
    custom_7_campo: 'PIN',
    custom_8_campo: 'TOKEN',
    custom_9_campo: 'LINK',
    custom_10_campo: 'ORDEN'
  };

  assert.equal(extractTicket(item, config), 'TCK-123');
  assert.equal(resolveConfiguredCustomValue(item, config, ['TOKEN'], 8), 'x'.repeat(24));
  assert.deepEqual(extractTemplateFields(item), {
    custom_5: 'TCK-123',
    custom_7: '4321',
    custom_8: 'x'.repeat(24),
    custom_9: 'https://example.test/seguimiento/secret',
    custom_10: '123456',
    custom_11: '789012'
  });
});

test('resolves credentials by template and service, including shared template IDs', () => {
  const configs = [
    { template_id: 'template-1', tipo_servicio: 'AVERIAS', group_id: 'group-a', api_key: 'key-a' },
    { template_id: 'template-1', tipo_servicio: 'AVERIAS PRV', group_id: 'group-b', api_key: 'key-b' }
  ];

  assert.equal(
    resolveTemplateConfig(
      { template_id: 'template-1', tipo_servicio: 'averias prv' },
      configs
    ).group_id,
    'group-b'
  );
  assert.throws(
    () => resolveTemplateConfig(
      { template_id: 'template-1', tipo_servicio: 'INSTALACION' },
      configs
    ),
    /No hay credenciales/
  );
});

test('sorts Mantra chat messages by newest timestamp first', () => {
  const messages = [
    { sender: 'contact', createdAt: '2026-10-23T10:00:00.000Z' },
    { sender: 'group', createdAt: '2026-10-23T10:05:00.000Z' }
  ];

  assert.deepEqual(
    sortMessagesNewestFirst(messages).map(message => message.sender),
    ['group', 'contact']
  );
  assert.equal(messages[0].sender, 'contact');
});

test('marks a recent customer message as waiting for an advisor', () => {
  const metrics = buildChatMetrics([
    {
      sender: 'contact',
      createdAt: '2026-10-23T10:00:00.000Z',
      content: { type: 'text', text: 'Necesito ayuda' }
    }
  ], null, null, Date.parse('2026-10-23T10:20:00.000Z'));

  assert.equal(metrics.quienTienePalabra, 'CLIENTE');
  assert.equal(metrics.tuvoRespuesta, 0);
  assert.equal(metrics.tiempoEsperaMinutos, 20);
  assert.equal(metrics.semaforo, 'ROJO');
  assert.equal(metrics.clienteTexto, 'Necesito ayuda');
});

test('uses the advisor response immediately after the customer message', () => {
  const metrics = buildChatMetrics([
    {
      sender: 'group',
      createdAt: '2026-10-23T10:12:00.000Z',
      content: { type: 'text', text: 'Ya lo reviso' }
    },
    {
      sender: 'contact',
      createdAt: '2026-10-23T10:02:00.000Z',
      content: { type: 'text', text: 'Mi servicio está lento' }
    }
  ]);

  assert.equal(metrics.quienTienePalabra, 'ASESOR');
  assert.equal(metrics.tuvoRespuesta, 1);
  assert.equal(metrics.tiempoEsperaMinutos, 10);
  assert.equal(metrics.asesorTexto, 'Ya lo reviso');
  assert.equal(metrics.clienteTexto, 'Mi servicio está lento');
});

test('calculates the SLA from a button response when chat history is empty', () => {
  const metrics = buildChatMetrics(
    [],
    'Reprogramar',
    '2026-10-23T09:00:00.000Z',
    Date.parse('2026-10-23T09:20:00.000Z')
  );

  assert.equal(metrics.clienteTipo, 'BOTON');
  assert.equal(metrics.quienTienePalabra, 'CLIENTE');
  assert.equal(metrics.tiempoEsperaMinutos, 20);
  assert.equal(metrics.semaforo, 'ROJO');
});

function parseSqlTimestamp(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

function sortMessagesNewestFirst(messages) {
  return [...messages].sort((left, right) => {
    const leftTime = Date.parse(left.createdAt);
    const rightTime = Date.parse(right.createdAt);
    return (Number.isNaN(rightTime) ? 0 : rightTime) - (Number.isNaN(leftTime) ? 0 : leftTime);
  });
}

function buildChatMetrics(messages, fallbackButton, fallbackDate, now = Date.now()) {
  const latestFirst = sortMessagesNewestFirst(messages);
  let clienteTipo = fallbackButton ? 'BOTON' : 'NINGUNO';
  let clienteBoton = fallbackButton || null;
  let clienteTexto = null;
  let clienteFecha = fallbackDate ? parseSqlTimestamp(fallbackDate) : null;
  let asesorTexto = null;
  let asesorFecha = null;
  let ultimoEmisor = null;
  let ultimoTexto = null;
  let ultimoFecha = null;
  let quienTienePalabra = fallbackButton ? 'CLIENTE' : 'BOT';
  let tuvoRespuesta = fallbackButton ? 0 : 1;
  let tiempoEsperaMinutos = 0;
  let semaforo = 'VERDE';
  let asesorAsignado = null;

  if (latestFirst.length > 0) {
    const latestMessage = latestFirst[0];
    ultimoEmisor = latestMessage.sender === 'contact' ? 'CLIENTE' : 'ASESOR/EMPRESA';
    ultimoTexto = latestMessage.content?.text
      || (latestMessage.content?.type ? `[${latestMessage.content.type}]` : '[mensaje]');
    ultimoFecha = parseSqlTimestamp(latestMessage.createdAt);

    const clientMessageIndex = latestFirst.findIndex(message => message.sender === 'contact');
    const clientMessage = clientMessageIndex >= 0 ? latestFirst[clientMessageIndex] : null;
    if (clientMessage) {
      const content = clientMessage.content || {};
      const type = content.type || 'text';
      if (type === 'button_reply' || type === 'interactive' || content.button_reply) {
        clienteTipo = 'BOTON';
        clienteBoton = content.text || content.button_reply?.title || clienteBoton || '[Botón]';
      } else if (['image', 'audio', 'document', 'video', 'media'].includes(type)) {
        clienteTipo = 'MEDIA';
        clienteTexto = `[Archivo ${type}]`;
      } else {
        clienteTipo = 'TEXTO_LIBRE';
        clienteTexto = content.text || null;
      }
      clienteFecha = parseSqlTimestamp(clientMessage.createdAt);
    }

    const advisorMessage = latestFirst.find(message => message.sender !== 'contact');
    if (advisorMessage) {
      asesorTexto = advisorMessage.content?.text
        || (advisorMessage.content?.type ? `[${advisorMessage.content.type}]` : '[mensaje]');
      asesorFecha = parseSqlTimestamp(advisorMessage.createdAt);
      asesorAsignado = advisorMessage.agent?.name || advisorMessage.sentByUser?.name || null;
    }

    if (clientMessageIndex === 0) {
      quienTienePalabra = 'CLIENTE';
      tuvoRespuesta = 0;
      const timestamp = Date.parse(latestFirst[0].createdAt);
      tiempoEsperaMinutos = Number.isNaN(timestamp)
        ? 0
        : Math.max(0, Math.round((now - timestamp) / 60000));
    } else if (clientMessageIndex > 0) {
      quienTienePalabra = 'ASESOR';
      tuvoRespuesta = 1;
      const clientTime = Date.parse(latestFirst[clientMessageIndex].createdAt);
      const responseTime = Date.parse(latestFirst[clientMessageIndex - 1].createdAt);
      if (!Number.isNaN(clientTime) && !Number.isNaN(responseTime)) {
        tiempoEsperaMinutos = Math.max(0, Math.round((responseTime - clientTime) / 60000));
      }
    } else {
      quienTienePalabra = 'BOT';
      tuvoRespuesta = 1;
    }
  } else if (fallbackButton && fallbackDate) {
    const timestamp = Date.parse(fallbackDate);
    tiempoEsperaMinutos = Number.isNaN(timestamp)
      ? 0
      : Math.max(0, Math.round((now - timestamp) / 60000));
  }

  if (quienTienePalabra === 'CLIENTE') {
    if (tiempoEsperaMinutos < 5) semaforo = 'VERDE';
    else if (tiempoEsperaMinutos <= 15) semaforo = 'AMARILLO';
    else semaforo = 'ROJO';
  }

  return {
    messages: latestFirst,
    clienteTipo,
    clienteBoton,
    clienteTexto,
    clienteFecha,
    asesorAsignado,
    asesorTexto,
    asesorFecha,
    ultimoEmisor,
    ultimoTexto,
    ultimoFecha,
    quienTienePalabra,
    tuvoRespuesta,
    tiempoEsperaMinutos,
    semaforo
  };
}

module.exports = {
  buildChatMetrics,
  parseSqlTimestamp,
  sortMessagesNewestFirst
};

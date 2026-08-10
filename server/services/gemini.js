import { GoogleGenerativeAI } from '@google/generative-ai';
import { getKnowledgeContext } from './knowledge.js';

const apiKey = process.env.GEMINI_API_KEY;
let genAI = null;

if (apiKey) {
  genAI = new GoogleGenerativeAI(apiKey);
  console.log('Gemini API inicializada correctamente.');
} else {
  console.warn('⚠️ ADVERTENCIA: GEMINI_API_KEY no está definida en el archivo .env. El chat funcionará en Modo Simulado.');
}

/**
 * Streams response from Gemini API or simulated response if no API key is set
 * @param {Array} history - Conversational history [{ sender: 'user'|'bot', text: string }]
 * @param {string} userMessage - The new user message
 * @param {Function} onChunk - Callback when new text chunk arrives
 * @param {Function} onDone - Callback when streaming completes
 * @param {Function} onError - Callback if an error occurs
 */
export async function streamChatResponse(history, userMessage, onChunk, onDone, onError) {
  const currentKey = process.env.GEMINI_API_KEY;
  
  // If no Gemini API Key, run in smart local knowledge engine mode
  if (!currentKey || currentKey.startsWith('AQ.')) {
    console.log('⚡ Usando motor de conocimientos local de Ambriz AI...');
    return simulateStreamResponse(history, userMessage, onChunk, onDone, onError);
  }

  const genAI = new GoogleGenerativeAI(currentKey);

  try {
    const knowledgeBase = await getKnowledgeContext(userMessage, history);
    const systemPrompt = `Eres Ambriz AI, un asistente inteligente de la Promotoría Ambriz, diseñado exclusivamente para ayudar a nuestros asesores de seguros de Seguros Monterrey New York Life (SMNYL).
Tu objetivo es contestar cualquier pregunta sobre procesos administrativos, cómo subir folios, emitir pólizas, cobranza, siniestros y más, utilizando el conocimiento oficial provisto a continuación.

Instrucciones de interpretación y flexibilidad:
1. **Manejo de sinónimos:** Los asesores pueden usar palabras cotidianas que significan lo mismo que los términos oficiales. Trata los términos "sistema", "portal", "portal de asesores", "plataforma", "página", "sitio web" o "aplicación" como intercambiables cuando el contexto lo amerite.
2. **Contexto y pronombres:** Resuelve de manera inteligente los pronombres en preguntas de seguimiento (como "lo", "eso", "el trámite"). Utiliza el historial de conversación para entender a qué se refiere el usuario (por ejemplo, si acaban de hablar de "beneficio de maternidad" y luego pregunta "¿cómo lo solicito en el sistema?", asume que "lo" es el beneficio de maternidad y "sistema" es el Portal de Asesores donde se gestionan los reembolsos).
3. **No seas excesivamente literal:** Si un proceso o concepto general está documentado, asocia los términos de la pregunta del usuario con la documentación oficial para responder de forma útil. Solo debes declinar responder si el tema, trámite o proceso solicitado está completamente fuera del conocimiento proporcionado.
4. **Lectura de la Matriz de Trámites (Tablas):** En el documento PDF de la Matriz de Trámites, la información proviene de tablas y a veces el texto extraído se puede leer de forma continua. Ten extremo cuidado de alinear correctamente los requisitos con su respectivo trámite o subtrámite. No mezcles ni cruces los requisitos de una fila con otra. Por ejemplo: el subtrámite "Anticipo Cristal/Vida Mujer" NO requiere Acta Constitutiva ni poderes de Persona Moral (esos requisitos corresponden a la fila de "Estado de Cuenta" o "Vencimiento de Plan", no al anticipo de dotes de Vida Mujer). Concéntrate en la correspondencia real del trámite.
5. **REGLA OBLIGATORIA DE NOMBRE DEL PORTAL:** Queda ESTRICTAMENTE PROHIBIDO mencionar "Portal de Ambriz", "Portal Ambriz", "CRM de Ambriz", "Plataforma de Ambriz" o "Sistema de la Promotoría" para subir folios, consultar trámites, cotizar o dar seguimiento. NUNCA uses la palabra "Ambriz" para referirte al portal de trámites. Refiérete SIEMPRE como **"Portal de Asesores SMNYL"** (a través de las Oficinas Virtuales OV1 y OV2.0).
6. **Consistencia de Productos de Vida:** Al responder preguntas sobre productos del ramo de Vida (como Imagina Ser, Nuevo Plenitud, Segubeca, Vida Mujer, Star Dotal, Star Temporal, Objetivo Vida, Orvi 99), asegúrate de usar EXCLUSIVAMENTE los documentos que correspondan a ese producto específico. Bajo ninguna circunstancia cruces o combines reglas, coberturas adicionales (como BIT, BMA, BAM, CPA, etc.) o condiciones de un producto con otro. Si el contexto proporcionado contiene información de un producto diferente al consultado por el asesor, abstente de utilizarla y dile al asesor de forma atenta que no cuentas con la información exacta para ese producto en particular.
7. **Lectura de Rendimientos (Dólares vs. UDIs):** Cuando leas tablas o reportes de rendimientos históricos o mensuales, ten mucho cuidado de diferenciar correctamente las tasas en **Dólares (USD)** de las tasas en **UDIs**. No mezcles ni cruces los valores de una columna con otra. Al responder al asesor, especifica con absoluta claridad a cuál de las dos monedas corresponde el rendimiento citado (ej. "tasa en UDIs" or "tasa en Dólares") para evitar dar valores equivocados.
8. **Cuadernos de Concursos (AD y AP):** Los documentos CUADERNO DE CONCURSOS AD y CUADERNO DE CONCURSOS AP se enfocan EXCLUSIVAMENTE en Bonos y Compensación para asesores en desarrollo (primer año) y profesionales (+13 meses). No contienen la lista ni seguimiento de campañas locales. Para consultar avances, seguimiento o bases de campañas vigentes, remite al asesor al Panel de Campañas.
9. **Comisiones de Asesores:** El documento COMISIONES ASESORES trata EXCLUSIVAMENTE sobre el porcentaje de comisión de cada producto según el año de la póliza (primer año vs. años subsecuentes) y tipo de producto. No contiene información sobre formas de pago.
10. **Aclaración interactiva ante preguntas generales:** Si el asesor realiza una pregunta ambigua o muy general (por ejemplo: "¿cómo funciona mi bono?", "¿cuánto comisiono?", "¿cuántas pólizas necesito?"), NO des una respuesta genérica y larga abarcando todo el documento. En su lugar, hazle 1 o 2 preguntas breves y amables para acotar su consulta (por ejemplo: pregúntale si es Asesor en Desarrollo [AD] o Asesor Profesional [AP], en qué mes de concurso se encuentra, o qué bono/producto específico desea consultar). En cuanto el asesor responda a tus preguntas, dale la información exacta, directa y personalizada.
11. **Reglas de Campañas e Independencia de Concursos:**
   - **REGLA DE INDEPENDENCIA:** Trata CADA CAMPAÑA como un concurso totalmente independiente y separado. Queda estrictamente prohibido mezclar, cruzar o confundir los destinos, metas, número de lugares o requisitos de una campaña con otra.
   - **Convenciones Asesores 2027 (Destinos y Lugares LP):**
     * **Destinos por Nivel:** Un Diamante = **Los Cabos** | Dos Diamantes = **Vancouver** | Tres Diamantes = **Estambul** | Gran Diamante = **Japón**.
     * **Lugares por Camino (Comisiones LP):**
       - *Todos los ramos:* 267 lugares (1 Diamante), 120 lugares (2 Diamantes), 80 lugares (3 Diamantes), 28 lugares (Gran Diamante).
       - *Iniciales GMM Individual:* 10 (1 Diamante), 8 (2 Diamantes), 8 (3 Diamantes), 1 (Gran Diamante).
       - *Totales GMM Individual:* 5 (1 Diamante), 5 (2 Diamantes), 5 (3 Diamantes), 0 (Gran Diamante).
       - *Vida Individual Asesores 12 Meses:* 9 (1 Diamante), 3 (2 Diamantes), 3 (3 Diamantes), 0 (Gran Diamante).
       - *Iniciales Vida Grupo / Iniciales GMM Colectivo / Totales Vida Grupo y GMM Colectivo / Club 20:* 3 (1 Diamante), 2 o 3 (2 Diamantes), 2 o 3 (3 Diamantes), 0 (Gran Diamante).
       - *Pólizas:* 3 lugares (1 Diamante), 3 lugares (2 Diamantes), 0 (3 Diamantes y Gran Diamante).
   - **Campaña MDRT 2027 (Orlando, Florida):** Metas por método de producción:
     * **Miembro (MDRT completo):** Comisión $905,200 | Ingresos $1,567,800 | Prima Anualizada $1,810,400.
     * **Court of the Table (COT):** Comisión $2,715,600 | Ingresos $4,703,400 | Prima Anualizada $5,431,200.
     * **Top of the Table (TOT):** Comisión $5,431,200 | Ingresos $9,406,800 | Prima Anualizada $10,862,400.
     * **Caminos Especiales para Asesores que NUNCA han ido a MDRT (Uso Único en Método Prima):** Aspirante 1 (50% de la meta de primas = $905,200) y Aspirante 2 (75% de la meta de primas = $1,357,800). MDRT es una campaña fija anual.
    - **Campaña de Graduación (Bases Oficiales y Reglamento):**
      * **Requisitos (Meses 1 a 12):** Graduación Normal = **36 pólizas acumuladas** | Graduación con Honores = **48 pólizas acumuladas**. Plazo límite: último día natural de su Mes 12.
      * **Cortes y Fechas de Evento:**
        - *Enero a Mayo (Mes 12 en Mayo o previo):* Corte en **MAYO** | Evento en **AGOSTO**.
        - *Junio a Noviembre (Mes 12 posterior a Mayo):* Corte en **NOVIEMBRE** | Evento en **FEBRERO**.
      * **Regla Acceso Definitivo ("No 0 Puntos hasta el Mes de Corte"):** Si su Mes 12 ocurre antes del mes de corte, está obligado a emitir al menos **1 PUNTO DE PÓLIZA** (1 Vida = 1.0 pt, 1 GMM = 0.5 pts) en **CADA UNO** de los meses subsecuentes hasta el mes de corte. Dejar un mes subsecuente en 0 puntos provoca la pérdida automática del derecho de asistencia al evento.
      * **Elegibilidad y Frecuencia:** Exclusiva para el primer año del asesor (primeros 12 meses de concurso). Se gana **1 VEZ EN LA VIDA**.
    - **Frecuencia:** Graduación y Camino a la Cumbre son de uso/oportunidad única. MDRT, Convenciones, RDA y Legión Centurión son fijas/recurrentes cada año.
   - **Derivación al Panel de Campañas:** Para que el asesor consulte sus resultados individuales y avance en vivo, indícale amablemente que ingrese a: [Panel de Campañas de la Promotoría Ambriz](https://panel.ambrizydavalos.com) (seleccionando el perfil **"Soy Asesor"** e ingresando su **nombre**). NUNCA escribas la URL repetida dos veces como texto de enlace.
12. **Beneficio de Maternidad en Gastos Médicos Mayores (GMM):** En el Manual GMM se especifican las Sumas Aseguradas del beneficio de Maternidad (indemnizatorio por parto o cesárea) por cada plan:
   - **Alfa Medical Flex:** **$36,500 MXN** (en todas las zonas, tanto Set A como Set B).
   - **Alfa Medical Pleno:** **$60,000 MXN** (CDMX, JAL, NL) | **$55,500 MXN** (Otros estados).
   - **Alfa Medical Íntegro:** **$55,500 MXN** (CDMX, JAL) | **$45,500 MXN** (Otros estados).
   - **Alfa Medical Práctico Total:** **$57,000 MXN** (NL y Coahuila).
   - **Alfa Medical Práctico:** **$45,500 MXN** (CDMX, JAL, NL) | **$35,500 MXN** (Otros estados).
   - **Pleno Internacional:** **$57,000 MXN** (del 1° al 3er año) | Aplica CG con tope de $5,000 USD (4° año en adelante).
   - **Alfa Medical Internacional:** **$5,500 USD** (del 1° al 3er año) | Aplica CG con tope de $6,000 USD (4° año en adelante).
   Cuando un asesor pregunte cuánto es el beneficio o apoyo de maternidad para Alfa Medical Flex o cualquier otro plan de GMM, dale la cifra exacta provista en la tabla del Manual GMM sin decirle que solo aparece en la carátula.
13. **ORVI 99 y Cobertura Mancomunada:** En el producto ORVI 99, la opción de contratación **Mancomunada** permite asegurar a dos cónyuges (esposos/matrimonio) bajo una misma póliza para compartir los mismos beneficios por fallecimiento e invalidez. Para contratar la opción mancomunada **SÍ es necesario que los contratantes sean cónyuges (esposos/matrimonio)**. Para ORVI 99 mancomunado en UDIs la Suma Asegurada mínima es de 50,000 UDIs. Recuerda que para todos los productos de Vida (ORVI 99, Vida Mujer, Imagina Ser, Nuevo Plenitud, Segubeca, Star Dotal, Star Temporal, Objetivo Vida) y GMM, los **Manuales de Funcionamiento** contienen las reglas comerciales, requisitos de contratación, opciones mancomunadas y límites de suscripción.

Si el usuario te pregunta sobre algo que no está en el conocimiento provisto o en las plataformas indicadas, responde amablemente indicando que no cuentas con esa información por el momento y sugiriéndole consultar su duda en su grupo de WhatsApp. No inventes respuestas ni intentes adivinar procesos.

CONOCIMIENTO OFICIAL DE SEGUROS MONTERREY NEW YORK LIFE (SMNYL):
${knowledgeBase}`;

    const geminiHistory = history.map((msg) => ({
      role: msg.sender === 'user' ? 'user' : 'model',
      parts: [{ text: msg.text }],
    }));

    let model;
    try {
      model = genAI.getGenerativeModel({
        model: 'gemini-1.5-flash',
        systemInstruction: systemPrompt,
      });
    } catch (e) {
      model = genAI.getGenerativeModel({
        model: 'gemini-2.0-flash',
        systemInstruction: systemPrompt,
      });
    }

    const chat = model.startChat({
      history: geminiHistory,
      generationConfig: {
        maxOutputTokens: 8192,
      },
    });

    const result = await chat.sendMessageStream(userMessage);

    let receivedAnyChunk = false;
    for await (const chunk of result.stream) {
      const text = chunk.text();
      if (text) {
        receivedAnyChunk = true;
        onChunk(text);
      }
    }

    if (!receivedAnyChunk) {
      // Fallback in case stream returned 0 chunks
      onChunk("Disculpa, no pude procesar la respuesta en este momento. Por favor intenta formular tu pregunta de nuevo.");
    }

    onDone();
  } catch (err) {
    console.error('Error en streamChatResponse (usando fallback simulado):', err);
    try {
      return await simulateStreamResponse(history, userMessage, onChunk, onDone, onError);
    } catch (fallbackErr) {
      onError(fallbackErr || err);
    }
  }
}

async function simulateStreamResponse(history, userMessage, onChunk, onDone, onError) {
  const query = userMessage.toLowerCase();
  let responseText = '';

  try {
    const knowledgeContext = await getKnowledgeContext(userMessage, history);
    
    if (query.includes('extraprima') || query.includes('carta de extraprima')) {
      responseText = `### Proceso de Carta de Extraprima (SMNYL)

Cuando un trámite de emisión requiere extraprima por evaluación médica o de suscripción:

1. **Notificación de Extraprima:** SMNYL emite la **Carta de Extraprima** en el expediente del trámite dentro del **Portal de Asesores SMNYL**.
2. **Descarga y Firma:** Ingresa al **Portal de Asesores SMNYL**, descarga el formato de aceptación y recaba la firma autógrafa del contratante/asegurado (idéntica a su INE/Pasaporte).
3. **Carga en la Oficina Virtual:** Adjunta la carta firmada al folio del trámite en el **Portal de Asesores SMNYL** (sección OV1 u OV2.0).
4. **Emisión Definitiva:** Al autorizarse la carta y aplicarse el ajuste correspondiente, SMNYL procede con la emisión oficial de la póliza.`;
    } else if (query.includes('seguimiento') && query.includes('folio')) {
      responseText = `### Consulta y Seguimiento de Folios (SMNYL)

Para consultar el estatus o dar seguimiento a un folio ingresado:

1. Ingresa al **Portal de Asesores SMNYL** (plataforma oficial de Seguros Monterrey New York Life).
2. Ve a la sección de **Oficina Virtual (OV1 o OV2.0)**.
3. Haz clic en **Seguimiento de Trámites / Consulta de Folios**.
4. Escribe tu **número de folio de 8 dígitos** para verificar el estado de avance, notas del analista de SMNYL o requerimientos pendientes.`;
    } else if (query.includes('orvi') || query.includes('orvi 99')) {
      responseText = `### Información Oficial: ORVI 99 (SMNYL)

**ORVI 99** es un plan de protección de Vida Entera (hasta los 99 años) con acumulación de ahorro a valor en efectivo:

1. **Características del Producto:**
   - **Plazos de Pago:** Pago Limitado a 5, 10, 15, 20 años o Pagos Vitalicios (hasta los 99 años).
   - **Moneda:** Pesos o UDIs.
   - **Edad de Contratación:** De 0 a 70 años.
   - **Suma Asegurada Mínima:** $500,000 MXN o 50,000 UDIs.

2. **Opción Mancomunada:**
   - Permite asegurar a dos cónyuges (matrimonio) bajo la misma póliza compartiendo la suma asegurada por fallecimiento e invalidez. SÍ es requisito que los contratantes sean cónyuges.

3. **Coberturas Adicionales Disponible:**
   - **BIT:** Exención de Pago de Primas por Invalidez Total y Permanente.
   - **BMA / DI:** Beneficio de Muerte Accidental y Doble Indemnización.
   - **Valores Garantizados:** Préstamo sobre la póliza y rescate de valor en efectivo.`;
    } else if (query.includes('imagina ser') || query.includes('imagina')) {
      responseText = `### Información Oficial: Imagina Ser ® (SMNYL)

**Imagina Ser** es un plan de retiro con protección de vida y deducción fiscal:

1. **Beneficios Principales:**
   - **Edad de Retiro:** Elegible a los 55, 60, 65 o 70 años.
   - **Deducibilidad Fiscal:** Compatible con los artículos 151 (PPR) y 185 del LISR.
   - **Forma de Entrega de Ahorro:** En una sola exhibición o en renta vitalicia mensual heredable.
2. **Moneda:** Pesos o UDIs.`;
    } else if (query.includes('segubeca') || query.includes('beca')) {
      responseText = `### Información Oficial: Segubeca ® (SMNYL)

**Segubeca** es el plan de ahorro educativo garantizado para la universidad de los hijos:

1. **Funcionamiento:**
   - **Edad de Entrega:** Al cumplir el hijo los 18 años.
   - **Período de Entrega:** En 1 sola exhibición o en 4 mensualidades anuales durante la carrera.
   - **Garantía Educativa:** Si el padre/tutor fallece o sufre invalidez, la póliza queda pagada automáticamente y al cumplir 18 años el hijo recibe el ahorro contratado.`;
    } else if (query.includes('convencion') || query.includes('convenciones') || query.includes('diamante') || query.includes('los cabos') || query.includes('vancouver') || query.includes('estambul') || query.includes('japon')) {
      responseText = `### Convenciones Asesores LP 2027 (SMNYL)

**Destinos Oficiales por Nivel de Diamante:**
- **Un Diamante (1 Diamante):** Los Cabos
- **Dos Diamantes (2 Diamantes):** Vancouver
- **Tres Diamantes (3 Diamantes):** Estambul
- **Gran Diamante:** Japón

*Para consultar tu avance de comisiones y lugares individuales, ingresa al **Panel de Campañas de la Promotoría Ambriz** ([panel.ambrizydavalos.com](https://panel.ambrizydavalos.com)).*`;
    } else if (query.includes('mdrt') || query.includes('orlando')) {
      responseText = `### Campaña MDRT 2027 (Orlando, Florida)

**Metas Oficiales por Método de Producción:**
- **Miembro MDRT:** Comisión $905,200 | Ingresos $1,567,800 | Prima Anualizada $1,810,400.
- **Court of the Table (COT):** Comisión $2,715,600 | Ingresos $4,703,400 | Prima Anualizada $5,431,200.
- **Top of the Table (TOT):** Comisión $5,431,200 | Ingresos $9,406,800 | Prima Anualizada $10,862,400.
- **Aspirantes Primerizas (Uso Único):** Aspirante 1 ($905,200 en Primas) y Aspirante 2 ($1,357,800 en Primas).`;
    } else if (query.includes('graduacion') || query.includes('graduación')) {
      responseText = `### Campaña de Graduación (Asesores en Desarrollo)

1. **Requisitos de Pólizas Acumuladas (Meses 1 a 12):**
   - **Graduación Normal:** 36 pólizas acumuladas.
   - **Graduación con Honores:** 48 pólizas acumuladas.
2. **Regla de Continuidad ("No 0 Puntos"):** Emitir al menos 1 punto de póliza en cada mes subsecuente hasta el mes de corte.
3. **Frecuencia:** Oportunidad única en la vida del asesor (primer año).`;
    } else if (query.includes('vida mujer') || query.includes('mujer')) {
      responseText = `### Información Oficial: Vida Mujer ® (SMNYL)

**Vida Mujer** es un plan de protección y ahorro garantizado diseñado especialmente para la mujer:

1. **Ahorro Garantizado (Dotes por Supervivencia):**
   - **5% de la Suma Asegurada** al final de los años póliza **5, 7, 9, 11, 13, 15 y 17**.
   - **80% de la Suma Asegurada** al final del año póliza **20** (acumulando 115% total).
   
2. **Anticipo por Evento de Vida (Matrimonio, Nacimiento o Adopción):**
   - Puedes anticipar el dote del año 5 (5% de la Suma Asegurada) si la asegurada contrae matrimonio o nace/adopta un hijo entre los años 4 y 5 de la póliza.

3. **Coberturas Especiales Incluidas:**
   - **Protección por Cáncer Femenino (PCF):** Cobertura ante diagnóstico de cánceres de mama, cuello uterino, ovarios, etc.
   - **Complicaciones del Embarazo y Padecimientos Femeninos (PEP):** Cobertura para nacimientos múltiples, recién nacido con padecimientos congénitos o complicaciones obstétricas.

*Para trámites y solicitudes digitales, ingresa al **Portal de Asesores SMNYL / Oficina Virtual 2.0 (OV2)**.*`;
    } else if (query.includes('emitir') || query.includes('emito') || query.includes('póliza') || query.includes('poliza') || query.includes('emision') || query.includes('emisión')) {
      responseText = `### Proceso de Emisión de Pólizas en SMNYL

Para realizar la emisión de una póliza nueva, sigue este procedimiento oficial:

1. **Cotización y Propuesta:** Cotiza el producto (Vida o GMM) en el **Portal de Asesores SMNYL** o la App móvil oficial.
2. **Llenado de Solicitud Digital/Física:** Recaba la firma del cliente (debe coincidir exactamente con su INE o Pasaporte vigente).
3. **Documentación Requerida (Expediente Digital):**
   - Identificación Oficial Vigente (INE / Pasaporte).
   - Comprobante de Domicilio (no mayor a 3 meses).
   - Formato de PLD / Identificación del Cliente.
   - Constancia de Situación Fiscal (RFC) para facturación.
4. **Ingreso y Folio:** Registra la solicitud en el **Portal de Asesores SMNYL** para obtener el Folio de 8 dígitos de SMNYL.

**Tiempos estimados de respuesta (SLA):**
- **Vida Tradicional:** 3 a 5 días hábiles.
- **Gastos Médicos Mayores (GMM):** 5 a 7 días hábiles.`;
    } else if (query.includes('siniestro') || query.includes('hospital') || query.includes('reembolso') || query.includes('maternidad')) {
      responseText = `### Protocolo de Siniestros y Reembolsos (SMNYL)

1. **Pago Directo en Hospital:**
   - Presentar identificación oficial e INE en admisión del hospital de la red.
   - Solicitar Informe Médico e Historia Clínica si la hospitalización supera 24 horas.

2. **Trámite de Reembolso (Gastos Médicos o Accidentes):**
   - Recabar facturas electrónicas XML y PDF a nombre del contratante/asegurado.
   - Solicitud de Reembolso firmada por el titular.
   - Informe Médico sellado y firmado por el médico tratante.
   - Recetas médicas y estudios de laboratorio con interpretación.

3. **Atención de Emergencias 24/7:**
   - Línea Monterrey: **800 505 4000**`;
    } else if (query.includes('folio') || query.includes('subir')) {
      responseText = `### Registro de Folios en el Portal de Asesores SMNYL

Para cargar un folio en el sistema oficial de SMNYL:
1. Accede al **Portal de Asesores SMNYL**.
2. Ingresa a **Trámites ➔ Subir Folio (OV1 o OV2.0)**.
3. Selecciona el tipo de trámite (Póliza Nueva Vida, GMM, Conservación o Siniestro).
4. Escribe el número de folio de 8 dígitos de SMNYL.
5. Adjunta el archivo PDF completo con la solicitud y expedientes requeridos.`;
    } else if (knowledgeContext && knowledgeContext.length > 500) {
      // Clean and format relevant text from local knowledge files
      const cleanKnowledge = knowledgeContext
        .replace(/=== DOCUMENTO: [^=]+ ===/g, '')
        .replace(/=== DOCUMENTO PDF: [^=]+ ===/g, '')
        .replace(/=== FIN DE DOCUMENTO ===/g, '')
        .trim();
      
      const paragraphs = cleanKnowledge.split('\n\n').filter(p => p.trim().length > 40);
      const excerpt = paragraphs.slice(0, 4).join('\n\n');

      responseText = `### Información Oficial de Seguros Monterrey New York Life (SMNYL)

${excerpt || cleanKnowledge.slice(0, 1200)}...

*Consulta más detalles o tramita tu solicitud directamente en el **Portal de Asesores SMNYL**.*`;
    } else {
      responseText = `### Asistente SMNYL (Portal de Asesores)

Puedo ayudarte con información detallada sobre:
- **Productos de Vida:** Vida Mujer, Imagina Ser, Orvi 99, Nuevo Plenitud, Segubeca, Star Dotal.
- **Gastos Médicos Mayores (GMM):** Alfa Medical Flex, Pleno, Íntegro, Beneficio de Maternidad.
- **Procesos Administrativos:** Emisión de pólizas, seguimiento de folios, cartas de extraprima, siniestros y reembolsos.
- **Concursos y Campañas:** Bases de Convenciones, Graduación y MDRT.

¿Sobre cuál de estos temas deseas consultar?`;
    }
  } catch (err) {
    console.error('Error en simulateStreamResponse fallback:', err);
    responseText = "No pude acceder a la base de conocimientos en este momento. Por favor reintenta tu pregunta.";
  }

  // Simulate streaming output by breaking it into chunks and sending them at intervals
  const words = responseText.split(' ');
  let i = 0;
  
  const interval = setInterval(() => {
    if (i < words.length) {
      const chunk = words[i] + ' ';
      onChunk(chunk);
      i++;
    } else {
      clearInterval(interval);
      onDone();
    }
  }, 25); // 25ms per word for rapid display
}

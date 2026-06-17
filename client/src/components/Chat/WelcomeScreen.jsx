export default function WelcomeScreen({ onQuickAction }) {
  const actions = [
    {
      id: 'poliza',
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
          <polyline points="10 9 9 9 8 9" />
        </svg>
      ),
      title: 'Emitir Póliza',
      desc: 'Pasos para emitir una póliza nueva en el sistema',
    },
    {
      id: 'siniestro',
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      ),
      title: 'Reportar Siniestro',
      desc: 'Proceso completo ante un siniestro de cliente',
    },
    {
      id: 'folio',
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
        </svg>
      ),
      title: 'Subir Folios',
      desc: 'Cómo cargar folios correctamente al sistema',
    },
    {
      id: 'cotizar',
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="20" x2="18" y2="10" />
          <line x1="12" y1="20" x2="12" y2="4" />
          <line x1="6" y1="20" x2="6" y2="14" />
        </svg>
      ),
      title: 'Cotizar Producto',
      desc: 'Guía para cotizar cualquier producto SMNYL',
    },
  ];

  const quickMessages = {
    poliza: '¿Cómo emitir una póliza nueva?',
    siniestro: '¿Qué hago ante un siniestro de un cliente?',
    folio: '¿Cómo subo folios al sistema?',
    cotizar: '¿Cómo cotizo un producto de SMNYL?',
  };

  return (
    <div className="welcome-screen">
      <div className="logo-container" style={{ width: 80, height: 80 }}>
        <div className="logo-glow" style={{ inset: -12, filter: 'blur(20px)' }}></div>
        <div className="logo-icon logo-lg">A</div>
      </div>

      <h2 className="welcome-title gradient-text">¿En qué puedo ayudarte hoy?</h2>
      <p className="welcome-subtitle">
        Soy tu asistente inteligente de la Promotoría Ambriz. Pregúntame sobre procesos, pólizas,
        siniestros, folios y más.
      </p>

      <div className="quick-actions">
        {actions.map((action) => (
          <div
            key={action.id}
            className="quick-action"
            onClick={() => onQuickAction(quickMessages[action.id])}
          >
            <div className="quick-action-icon">{action.icon}</div>
            <div className="quick-action-title">{action.title}</div>
            <div className="quick-action-desc">{action.desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

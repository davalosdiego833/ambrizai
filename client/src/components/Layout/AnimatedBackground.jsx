export default function AnimatedBackground() {
  return (
    <>
      <div className="animated-bg">
        <div className="orb"></div>
        <div className="orb"></div>
        <div className="orb"></div>
        <div className="orb"></div>
      </div>
      <Particles />
    </>
  );
}

function Particles() {
  const particles = Array.from({ length: 30 }, (_, i) => {
    const colors = [
      'var(--accent-1)',
      'var(--accent-2)',
      'var(--accent-3)',
    ];
    const size = Math.random() * 3 + 1;
    return (
      <div
        key={i}
        className="particle"
        style={{
          left: `${Math.random() * 100}%`,
          animationDuration: `${Math.random() * 15 + 10}s`,
          animationDelay: `${Math.random() * 10}s`,
          width: `${size}px`,
          height: `${size}px`,
          opacity: Math.random() * 0.5 + 0.1,
          background: colors[Math.floor(Math.random() * colors.length)],
        }}
      />
    );
  });

  return <div className="particles-container">{particles}</div>;
}

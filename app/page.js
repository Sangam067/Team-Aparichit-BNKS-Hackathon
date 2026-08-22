import Link from "next/link";

const navigation = [
  { label: "Home", href: "#home", active: true },
  { label: "Upload Syllabus", href: "/syllabus" },
  { label: "Learning Path", href: "/learning" },
];

const featureLinks = [
  { label: "Learn", href: "/learning" },
  { label: "Upload Syllabus", href: "/syllabus" },
  { label: "Boss Battle", href: "/learning" },
  { label: "Community", href: "#community" },
];

function Brand() {
  return (
    <a className="brand" href="#home" aria-label="GameEdu home">
      <span className="brand-mark" aria-hidden="true"><span /><span /><span /></span>
      <span>Game<span className="brand-accent">Edu</span></span>
    </a>
  );
}

function NavigationLinks() {
  return navigation.map((item) => (
    <a className={item.active ? "nav-link nav-link-active" : "nav-link"} href={item.href} key={item.label}>
      {item.label}
    </a>
  ));
}

export default function Home() {
  return (
    <main className="home-page" id="home">
      <div className="hero-backdrop" aria-hidden="true" />
      <div className="home-shell">
        <header className="site-header">
          <Brand />
          <nav className="desktop-nav" aria-label="Main navigation"><NavigationLinks /></nav>
          <div className="header-actions">
            <Link className="button button-ghost button-small" href="/login">Log in</Link>
            <Link className="button button-primary button-small" href="/register">Sign up <span aria-hidden="true">↗</span></Link>
          </div>
          <details className="mobile-menu">
            <summary aria-label="Open navigation menu"><span /><span /><span /></summary>
            <nav aria-label="Mobile navigation"><NavigationLinks /></nav>
          </details>
        </header>

        <section className="hero-content" aria-labelledby="hero-title">
          <p className="eyebrow"><span className="eyebrow-line" /> Learn. Play. Create.</p>
          <h1 id="hero-title">Level up your <span>future.</span></h1>
          <p className="hero-description">GameEdu makes learning interactive with game-inspired courses, hands-on projects, and a community that builds the future together.</p>
          <div className="hero-actions">
            <Link className="button button-primary button-large" href="/syllabus"><span className="pixel-cursor" aria-hidden="true">+</span> Upload &amp; Start Learning</Link>
            <Link className="button button-video" href="/learning"><span className="play-icon" aria-hidden="true">▶</span> View Learning Path</Link>
          </div>
          <div className="social-proof">
            <div className="avatar-stack" aria-hidden="true"><span>AR</span><span>JL</span><span>MK</span><span>+</span></div>
            <p><strong>10K+</strong> learners are already leveling up<span className="proof-dot">.</span></p>
          </div>
        </section>

        <nav className="feature-bar" aria-label="Explore GameEdu">
          {featureLinks.map((feature, index) => (
            <span className="feature-link-wrap" key={feature.label}>
              <a className="feature-link" href={feature.href}>{feature.label}</a>
              {index < featureLinks.length - 1 && <span className="feature-arrow" aria-hidden="true">→</span>}
            </span>
          ))}
        </nav>
      </div>
    </main>
  );
}
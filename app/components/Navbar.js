"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";

const navLinks = [
  { label: "Upload Syllabus", href: "/syllabus" },
  { label: "Learning Path", href: "/learning" },
];

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("user");
      if (stored) {
        setUser(JSON.parse(stored));
      }
    } catch {
      // ignore parse errors
    }
  }, []);

  function handleLogout() {
    localStorage.removeItem("user");
    router.push("/");
  }

  function getInitials(name) {
    if (!name) return "?";
    return name
      .split(" ")
      .map((w) => w[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }

  return (
    <nav className="app-navbar">
      <Link className="brand" href="/dashboard" aria-label="GameEdu home">
        <span className="brand-mark" aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
        <span>
          Game<span className="brand-accent">Edu</span>
        </span>
      </Link>

      <div className="app-nav-links">
        {navLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={`app-nav-link${pathname === link.href || pathname.startsWith(link.href + "/") ? " active" : ""}`}
          >
            {link.label}
          </Link>
        ))}
      </div>

      <div className="app-nav-right">
        {user && (
          <div className="app-nav-user">
            <div className="app-nav-avatar">{getInitials(user.name)}</div>
            <span>{user.name}</span>
          </div>
        )}
        <button className="app-nav-logout" onClick={handleLogout}>
          Log out
        </button>
      </div>

      <button
        className="app-mobile-menu-btn"
        onClick={() => setMobileOpen((prev) => !prev)}
        aria-label="Toggle navigation"
      >
        <span />
        <span />
        <span />
      </button>

      <div className={`app-mobile-nav${mobileOpen ? " open" : ""}`}>
        {navLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={`app-nav-link${pathname === link.href ? " active" : ""}`}
            onClick={() => setMobileOpen(false)}
          >
            {link.label}
          </Link>
        ))}
        {user && (
          <div className="app-nav-user" style={{ padding: "12px 16px" }}>
            <div className="app-nav-avatar">{getInitials(user.name)}</div>
            <span>{user.name}</span>
          </div>
        )}
        <button
          className="app-nav-logout"
          onClick={handleLogout}
          style={{ marginTop: 4 }}
        >
          Log out
        </button>
      </div>
    </nav>
  );
}

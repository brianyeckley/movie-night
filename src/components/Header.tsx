"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown, Crown, LogOut, Popcorn, Settings } from "lucide-react";
import { logoutAction } from "@/app/actions/user";

interface HeaderProps {
  currentUser: {
    id: string;
    name: string;
    username: string;
    role: string;
  } | null;
}

export default function Header({ currentUser }: HeaderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!accountMenuOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (accountMenuRef.current && !accountMenuRef.current.contains(e.target as Node)) {
        setAccountMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [accountMenuOpen]);

  return (
    <header className="site-header">
      <div className="container flex-between gap-lg relative">
        {/* Left Side: Logo & Desktop Nav */}
        <div className="flex-row items-center gap-2xl">
          <Link href="/" onClick={() => setIsOpen(false)}>
            <span className="site-logo" data-text="MOVIE NIGHT">
              MOVIE NIGHT
            </span>
          </Link>
 
          {currentUser && (
            <nav className="desktop-nav">
              <Link
                href="/"
                className="desktop-nav-link nav-link"
              >
                Dashboard
              </Link>
              <Link
                href="/catalog"
                className="desktop-nav-link nav-link"
              >
                Catalog
              </Link>
              {currentUser.role === "ADMIN" && (
                <Link
                  href="/admin/users"
                  className="desktop-nav-link nav-link"
                >
                  Users
                </Link>
              )}
            </nav>
          )}
        </div>
 
        {/* Right Side: Desktop User Info / Mobile Menu Toggle */}
        {currentUser && (
          <>
            {/* Desktop User Navigation */}
            <div className="desktop-user">
              <div className="account-menu" ref={accountMenuRef}>
                <button
                  type="button"
                  onClick={() => setAccountMenuOpen((open) => !open)}
                  className="account-menu-trigger"
                  aria-haspopup="menu"
                  aria-expanded={accountMenuOpen}
                >
                  {currentUser.role === "ADMIN" ? (
                    <Crown size="1em" className="inline-icon" />
                  ) : (
                    <Popcorn size="1em" className="inline-icon" />
                  )}
                  {currentUser.name}
                  <ChevronDown size="1em" className="inline-icon account-menu-chevron" />
                </button>

                {accountMenuOpen && (
                  <div className="account-menu-dropdown" role="menu">
                    <Link
                      href="/settings"
                      className="account-menu-item"
                      role="menuitem"
                      onClick={() => setAccountMenuOpen(false)}
                    >
                      <Settings size="1em" className="inline-icon" /> Settings
                    </Link>
                    <form action={logoutAction} className="w-full">
                      <button
                        type="submit"
                        className="account-menu-item"
                        role="menuitem"
                      >
                        <LogOut size="1em" className="inline-icon" /> Log Out
                      </button>
                    </form>
                  </div>
                )}
              </div>
            </div>
 
            {/* Mobile Hamburger Toggle Button */}
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="mobile-menu-toggle mobile-hamburger-btn"
              aria-label="Toggle navigation menu"
            >
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                {isOpen ? (
                  <>
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </>
                ) : (
                  <>
                    <line x1="4" y1="12" x2="20" y2="12" />
                    <line x1="4" y1="6" x2="20" y2="6" />
                    <line x1="4" y1="18" x2="20" y2="18" />
                  </>
                )}
              </svg>
            </button>
          </>
        )}
 
        {/* Mobile Absolute Dropdown Menu */}
        {currentUser && isOpen && (
          <div className="mobile-menu-dropdown">
            <nav className="flex-col gap-lg">
              <Link
                href="/"
                onClick={() => setIsOpen(false)}
                className="mobile-nav-link"
              >
                Dashboard
              </Link>
              <Link
                href="/catalog"
                onClick={() => setIsOpen(false)}
                className="mobile-nav-link"
              >
                Catalog
              </Link>
              {currentUser.role === "ADMIN" && (
                <Link
                  href="/admin/users"
                  onClick={() => setIsOpen(false)}
                  className="mobile-nav-link"
                >
                  Users
                </Link>
              )}
              <Link
                href="/settings"
                onClick={() => setIsOpen(false)}
                className="mobile-nav-link"
              >
                <Settings size="1em" className="inline-icon" /> Settings
              </Link>
            </nav>
 
            <div className="flex-col gap-md mt-sm">
              <span className="text-base text-secondary font-medium">
                Watching as: <strong className="text-primary-var">{currentUser.name} {currentUser.role === "ADMIN" ? <Crown size="1em" className="inline-icon" /> : <Popcorn size="1em" className="inline-icon" />}</strong>
              </span>
              <form action={logoutAction} className="w-full">
                <button
                  type="submit"
                  className="btn btn-secondary w-full bg-white-05"
                >
                  Log Out
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}

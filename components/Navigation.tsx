'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { ConnectButton } from '@rainbow-me/rainbowkit'

const navLinks = [
  { href: '/', label: 'Home' },
  { href: '/wrap', label: 'Wrap sKLC' },
  { href: '/deposit', label: 'Deposit' },
  { href: '/mint', label: 'Mint KUSD' },
  { href: '/borrow', label: 'Borrow' },
  { href: '/auctions', label: 'Auctions' },
  { href: '/dsr', label: 'Savings' },
]

export default function Navigation() {
  const pathname = usePathname()

  return (
    <nav className="border-b border-[#262626] bg-[#0a0a0a]/95 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-2">
            <Image
              src="/icons/logo.svg"
              alt="KUSD Logo"
              width={32}
              height={32}
              className="w-8 h-8"
            />
            <span className="text-xl font-bold text-white">KUSD</span>
          </Link>

          {/* Navigation Links */}
          <div className="hidden md:flex items-center space-x-1">
            {navLinks.map((link) => {
              const isActive = pathname === link.href
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-[#1a1a1a] text-white'
                      : 'text-[#9ca3af] hover:text-white hover:bg-[#1a1a1a]/50'
                  }`}
                >
                  {link.label}
                </Link>
              )
            })}
          </div>

          {/* Wallet Connect Button */}
          <div className="flex items-center">
            <ConnectButton />
          </div>
        </div>

        {/* Mobile Navigation */}
        <div className="md:hidden pb-4">
          <div className="flex flex-wrap gap-2">
            {navLinks.map((link) => {
              const isActive = pathname === link.href
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-[#1a1a1a] text-white'
                      : 'text-[#9ca3af] hover:text-white hover:bg-[#1a1a1a]/50'
                  }`}
                >
                  {link.label}
                </Link>
              )
            })}
          </div>
        </div>
      </div>
    </nav>
  )
}


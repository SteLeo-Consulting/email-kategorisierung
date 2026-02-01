'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { useSettings } from '@/contexts/SettingsContext';
import {
  LayoutDashboard,
  Link as LinkIcon,
  Tags,
  Settings,
  FileText,
  AlertCircle,
  LogOut,
  Mail,
  Globe,
  Moon,
  Sun,
  Monitor,
  Sparkles,
  Cog,
} from 'lucide-react';

interface DashboardNavProps {
  user: any;
}

export function DashboardNav({ user }: DashboardNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { t, language, setLanguage, theme, setTheme } = useSettings();

  const navItems = [
    { href: '/dashboard', label: t('nav.dashboard'), icon: LayoutDashboard },
    { href: '/dashboard/connections', label: t('nav.connections'), icon: LinkIcon },
    { href: '/dashboard/categories', label: t('nav.categories'), icon: Tags },
    { href: '/dashboard/rules', label: t('nav.rules'), icon: Settings },
    { href: '/dashboard/review', label: t('nav.review'), icon: AlertCircle },
    { href: '/dashboard/audit', label: t('nav.auditLog'), icon: FileText },
    { href: '/dashboard/settings', label: t('nav.settings'), icon: Sparkles },
  ];

  const handleLogout = () => {
    localStorage.removeItem('user');
    router.push('/auth/signin');
  };

  return (
    <nav className="border-b bg-white dark:bg-slate-900 dark:border-slate-800">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/dashboard" className="flex items-center gap-2 font-bold text-lg dark:text-white">
              <Mail className="h-6 w-6" />
              EmailCat
            </Link>

            <div className="hidden md:flex items-center gap-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;

                return (
                  <Link key={item.href} href={item.href}>
                    <Button
                      variant={isActive ? 'secondary' : 'ghost'}
                      size="sm"
                      className={cn('gap-2', isActive && 'bg-slate-100 dark:bg-slate-800')}
                    >
                      <Icon className="h-4 w-4" />
                      {item.label}
                    </Button>
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Language Selector */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-2">
                  <Globe className="h-4 w-4" />
                  <span className="hidden sm:inline">{language.toUpperCase()}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => setLanguage('de')}
                  className={cn(language === 'de' && 'bg-slate-100 dark:bg-slate-800')}
                >
                  🇩🇪 Deutsch
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setLanguage('en')}
                  className={cn(language === 'en' && 'bg-slate-100 dark:bg-slate-800')}
                >
                  🇬🇧 English
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Theme Selector */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm">
                  {theme === 'dark' ? (
                    <Moon className="h-4 w-4" />
                  ) : theme === 'light' ? (
                    <Sun className="h-4 w-4" />
                  ) : (
                    <Monitor className="h-4 w-4" />
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => setTheme('light')}
                  className={cn(theme === 'light' && 'bg-slate-100 dark:bg-slate-800')}
                >
                  <Sun className="h-4 w-4 mr-2" />
                  {t('theme.light')}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setTheme('dark')}
                  className={cn(theme === 'dark' && 'bg-slate-100 dark:bg-slate-800')}
                >
                  <Moon className="h-4 w-4 mr-2" />
                  {t('theme.dark')}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setTheme('system')}
                  className={cn(theme === 'system' && 'bg-slate-100 dark:bg-slate-800')}
                >
                  <Monitor className="h-4 w-4 mr-2" />
                  {t('theme.system')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <span className="text-sm text-muted-foreground hidden sm:block ml-2">
              {user?.email}
            </span>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
            >
              <LogOut className="h-4 w-4 mr-2" />
              {t('logout')}
            </Button>
          </div>
        </div>
      </div>
    </nav>
  );
}

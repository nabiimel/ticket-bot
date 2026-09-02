import { NavLink } from "./NavLink";

export type NavItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
  exact?: boolean;
  badge?: number;
  dot?: boolean;
};

export function SideNav({ items }: { items: NavItem[] }) {
  return (
    <nav className="space-y-1">
      {items.map((it) => (
        <NavLink
          key={it.href}
          href={it.href}
          exact={it.exact}
          icon={it.icon}
          badge={it.badge}
          dot={it.dot}
        >
          {it.label}
        </NavLink>
      ))}
    </nav>
  );
}

import { Link, useLocation } from "react-router-dom";
import { Home, Coins, Image as ImageIcon, User, Plus } from "lucide-react";

export function MobileBottomNav() {
  const location = useLocation();

  const navItems = [
    { label: "Home", path: "/", icon: Home },
    { label: "Tokens", path: "/token-launchpad", icon: Coins },
    { label: "Create", path: "/create", icon: Plus },
    { label: "NFTs", path: "/nft-launchpad", icon: ImageIcon },
    { label: "Profile", path: "/profile", icon: User },
  ];

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 bg-card border-t border-border z-50 pb-safe">
      <div className="flex justify-around items-center h-16 px-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-lg transition-all ${
                active ? "text-primary" : "text-muted-foreground"
              } ${item.path === "/create" ? "transform -translate-y-2" : ""}`}
            >
              <div
                className={`p-2 rounded-full transition-all ${
                  item.path === "/create"
                    ? "bg-primary text-primary-foreground shadow-lg"
                    : active
                    ? "bg-primary/10"
                    : ""
                }`}
              >
                <Icon className="w-5 h-5" />
              </div>
              <span className="text-xs">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

"use client";
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ResponsiveNavigation = ResponsiveNavigation;
const react_1 = require("react");
const link_1 = __importDefault(require("next/link"));
const navigation_1 = require("next/navigation");
const utils_1 = require("@/lib/utils");
const use_responsive_1 = require("@/hooks/use-responsive");
function ResponsiveNavigation({ items, orientation = "horizontal", className }) {
    const pathname = (0, navigation_1.usePathname)();
    const { breakpoint } = (0, use_responsive_1.useBreakpoint)();
    const [mounted, setMounted] = (0, react_1.useState)(false);
    // Handle hydration mismatch
    (0, react_1.useEffect)(() => {
        setMounted(true);
    }, []);
    if (!mounted)
        return null;
    // Determine how many items to show based on screen size
    const getVisibleItems = () => {
        switch (breakpoint) {
            case "xs":
                return items.slice(0, 2); // Show only 2 items on mobile
            case "sm":
                return items.slice(0, 3); // Show 3 items on small screens
            case "md":
                return items.slice(0, 5); // Show 5 items on medium screens
            default:
                return items; // Show all items on large screens
        }
    };
    const visibleItems = getVisibleItems();
    const hasMoreItems = visibleItems.length < items.length;
    return (<nav className={(0, utils_1.cn)("flex items-center gap-2", orientation === "vertical" && "flex-col items-start", className)}>
      {visibleItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (<link_1.default key={item.href} href={item.href} className={(0, utils_1.cn)("flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors", isActive
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-muted text-muted-foreground hover:text-foreground", orientation === "vertical" && "w-full")}>
            <Icon className={(0, utils_1.cn)("h-4 w-4", breakpoint === "xs" && "h-5 w-5")}/>
            <span className={(0, utils_1.cn)(breakpoint === "xs" && orientation === "horizontal" && "sr-only", "truncate")}>
              {item.label}
            </span>
          </link_1.default>);
        })}

      {hasMoreItems && (<div className="relative">
          {/* More menu implementation would go here */}
          <button className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium hover:bg-muted">
            <span>More</span>
          </button>
        </div>)}
    </nav>);
}

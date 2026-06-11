import { Link } from "wouter";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface HierarchyBreadcrumbProps {
  items: BreadcrumbItem[];
  className?: string;
}

export default function HierarchyBreadcrumb({ items, className }: HierarchyBreadcrumbProps) {
  return (
    <nav className={cn("flex items-center flex-wrap gap-1 text-sm mb-4", className)}>
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-1">
          {i > 0 && <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
          {item.href ? (
            <Link href={item.href}>
              <a className="text-blue-600 hover:text-blue-800 hover:underline font-medium transition-colors">
                {item.label}
              </a>
            </Link>
          ) : (
            <span className="text-slate-600 font-semibold">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}

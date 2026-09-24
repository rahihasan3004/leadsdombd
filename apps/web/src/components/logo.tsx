import Image from "next/image";
import Link from "next/link";

interface LogoProps {
  className?: string;
  showText?: boolean;
  size?: number;
}

export function Logo({ className = "", showText = true, size = 48 }: LogoProps) {
  return (
    <Link href="/" className={`inline-flex items-center gap-3.5 ${className}`}>
      <Image
        src="/favicon.svg"
        alt="LeadsDom Logo"
        width={size}
        height={size}
        className={`object-contain shrink-0 ${className}`}
        priority
      />
      {showText && (
        <span className="font-extrabold text-2xl tracking-tight text-slate-900 dark:text-white">
          LeadsDom
        </span>
      )}
    </Link>
  );
}

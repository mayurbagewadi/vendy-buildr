interface AppLogoProps {
  size?: number;
  showBackground?: boolean;
  className?: string;
}

/**
 * AppLogo - Store icon with blue background
 * Use this everywhere on the website for consistent branding
 *
 * @param size - Icon size in pixels (default: 40)
 * @param showBackground - Whether to show blue background (default: true)
 * @param className - Additional CSS classes
 *
 * @example
 * // Standard logo with background
 * <AppLogo />
 *
 * @example
 * // Larger logo for header
 * <AppLogo size={48} />
 *
 * @example
 * // Icon only without background
 * <AppLogo showBackground={false} />
 */
export const AppLogo = ({
  size = 40,
  showBackground = true,
  className = ""
}: AppLogoProps) => {
  return (
    <div
      className={`${showBackground ? 'bg-blue-600 rounded-lg p-2' : ''} inline-flex items-center justify-center ${className}`}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.50"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-white"
      >
        <path d="M15 21v-5a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v5"/>
        <path d="M17.774 10.31a1.12 1.12 0 0 0-1.549 0 2.5 2.5 0 0 1-3.451 0 1.12 1.12 0 0 0-1.548 0 2.5 2.5 0 0 1-3.452 0 1.12 1.12 0 0 0-1.549 0 2.5 2.5 0 0 1-3.77-3.248l2.889-4.184A2 2 0 0 1 7 2h10a2 2 0 0 1 1.653.873l2.895 4.192a2.5 2.5 0 0 1-3.774 3.244"/>
        <path d="M4 10.95V19a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8.05"/>
      </svg>
    </div>
  );
};

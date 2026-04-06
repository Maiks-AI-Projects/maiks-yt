import { VALID_SUBDOMAINS } from "@/lib/subdomains";

interface SubdomainLayoutProps {
  children: React.ReactNode;
  params: Promise<{
    subdomain: string;
  }>;
}

/**
 * Layout for hobby-specific subdomains.
 * This layout applies a theme class to its wrapper based on the subdomain.
 */
export default async function SubdomainLayout({
  children,
  params,
}: SubdomainLayoutProps) {
  const { subdomain } = await params;
  
  // Map subdomain to theme class if it exists in our CSS
  // Currently supported: theme-mc (Minecraft), theme-coding, theme-wow
  const themeClass = VALID_SUBDOMAINS.includes(subdomain) ? `theme-${subdomain}` : "";

  return (
    <div className={`flex flex-col flex-1 ${themeClass}`}>
      {children}
    </div>
  );
}

import "./globals.css";
import Providers from "@/components/Providers";

export const metadata = {
  title: "Sales Intelligence Dashboard",
  description: "Consumer sales performance dashboard",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="bg-gray-950 text-white min-h-screen antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

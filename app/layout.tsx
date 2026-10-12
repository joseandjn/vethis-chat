import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "Vethis · Asesor de alimentos",
  description: "Chat de demo del asesor de alimentos para mascotas",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="antialiased">{children}</body>
    </html>
  );
}

import type { Metadata } from "next";
import { branding } from "@studyhub/config";
import "./globals.css";

export const metadata: Metadata = {
  title: branding.productName,
  description: "Private learning-material sharing for invited students"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

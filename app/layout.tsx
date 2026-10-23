import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sổ Shop · Quản lý cửa hàng cầu lông",
  description: "Quỹ chi, đan vợt và cọc sản phẩm trong một nơi. Xuất báo cáo Excel theo tháng.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <body className="antialiased">{children}</body>
    </html>
  );
}

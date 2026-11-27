import "./globals.css";
export const metadata = { title: "El rincón de Lucía", description: "Tu espacio personal de estudio" };
export default function RootLayout({children}:{children:React.ReactNode}) { return <html lang="es"><body>{children}</body></html>; }

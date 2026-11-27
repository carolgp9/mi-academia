# Mi Academia — aplicación web

## Incluye
- Registro e inicio de sesión privado.
- Biblioteca personal de tests.
- Importación de PDF con texto, DOCX y TXT.
- Generación de preguntas tipo test con OpenAI.
- Cuatro opciones, respuesta correcta y explicación.
- Modo examen / estudio, orden aleatorio y temporizador.
- Historial de resultados.
- Datos persistentes por usuario con Supabase y Row Level Security.

## Antes de usar
Necesitas Node.js 20+, un proyecto Supabase y una clave de API de OpenAI.

### 1. Supabase
1. Crea un proyecto en https://supabase.com
2. En SQL Editor ejecuta `supabase/schema.sql`.
3. En Settings > API copia Project URL y anon/public key.
4. En Authentication > URL Configuration añade `http://localhost:3000` como URL local y luego tu URL publicada.

### 2. Variables
Copia `.env.example` a `.env.local` y rellena las credenciales.
La clave `OPENAI_API_KEY` es secreta y solo se configura en el servidor. No la compartas ni la pongas en variables `NEXT_PUBLIC_`.

### 3. Probar localmente
```bash
npm install
npm run dev
```
Abre http://localhost:3000

### 4. Publicar online
1. Sube el proyecto a un repositorio privado de GitHub.
2. En https://vercel.com importa el repositorio.
3. Añade las variables de `.env.example` en Vercel.
4. Pulsa Deploy.
5. Añade la URL de Vercel en Supabase > Authentication > URL Configuration.

## Importante
- Este proyecto es una primera versión funcional (MVP), no una plataforma auditada para uso comercial.
- PDFs escaneados como imágenes necesitan OCR previo.
- El límite de texto por generación es 90.000 caracteres.
- La generación consume crédito de la API de OpenAI; configura límites de facturación.
- Revisa las respuestas generadas por IA antes de usarlas para estudiar.

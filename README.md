# Quiet Field

Aplicación web gratuita de paisajes sonoros para concentración, descanso y sueño. Los sonidos se generan localmente mediante Web Audio API; no hay cuentas, backend ni servicios de audio externos.

## Requisitos

- Node.js 20 o superior
- npm
- Cuenta de GitHub

## Ejecutar en local

```bash
npm install
npm run dev
```

Abre la URL local que muestra Vite. El navegador solicitará interacción del usuario antes de iniciar el audio (política normal de reproducción web).

## Compilar

```bash
npm run build
npm run preview
```

## Publicar en GitHub Pages

1. Crea un repositorio en GitHub, por ejemplo `quiet-field`.
2. Sube el contenido de esta carpeta a la rama `main` (no subas `node_modules` ni `dist`).
3. En GitHub, entra en **Settings → Pages**.
4. En **Build and deployment**, selecciona **GitHub Actions** como Source.
5. Haz push a `main`. El workflow `.github/workflows/deploy.yml` compilará y publicará la aplicación.
6. La dirección será `https://TU-USUARIO.github.io/quiet-field/`.

Si el repositorio se llama de otra forma, no hace falta modificar `base`: está configurado como ruta relativa (`./`) para funcionar también en GitHub Pages.

## Qué incluye esta primera versión

- Ruido blanco, rosa, azul, marrón y verde.
- Capas simultáneas y controles de volumen independientes.
- Paisajes sintetizados: lluvia, viento y bosque.
- Ecualizador global de tres bandas.
- Visualizador de señal.
- Presets de concentración y descanso.
- Temporizador con desvanecimiento al finalizar.
- PWA instalable y recursos cacheados para uso offline.

## Notas técnicas y limitaciones de esta versión

- El audio se sintetiza en tiempo real en el navegador. Los ambientes de lluvia, viento y bosque son texturas generativas, no grabaciones de campo.
- El ruido verde se aproxima mediante ruido filtrado en banda media.
- El temporizador y el audio dependen de que el navegador mantenga activa la pestaña o la aplicación; el comportamiento en segundo plano varía según el sistema operativo.
- La instalación PWA requiere servir la aplicación por HTTPS, como hace GitHub Pages.
- El primer acceso requiere conexión para descargar la aplicación; después se puede abrir offline si el navegador conserva la caché.
- Los presets de esta primera entrega están integrados en la aplicación; guardar mezclas propias y restaurarlas es una mejora prevista.

## Personalización del nombre

Busca `Quiet Field` en `index.html`, `vite.config.ts`, `README.md` y `src/App.tsx` para cambiar el nombre provisional cuando esté decidido.

## Licencia

MIT. Puedes modificar, publicar y distribuir este proyecto.

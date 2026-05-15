# Control de Facturación — Firebase + Netlify

App web en tiempo real para controlar paquetes de numeración de facturas por cliente.

## Publicar en Netlify (gratis, 5 minutos)

### Opción A — Arrastrar y soltar (más fácil)

1. Instala las dependencias y compila:
   ```
   npm install
   npm run build
   ```
2. Ve a **https://app.netlify.com/drop**
3. Arrastra la carpeta `build/` que se generó
4. ¡Listo! Netlify te da un link como `https://nombre-random.netlify.app`
5. Puedes cambiar el nombre en Site Settings → Site name

### Opción B — Conectar con GitHub

1. Sube este proyecto a un repositorio de GitHub
2. Ve a **https://app.netlify.com** → "Add new site" → "Import from Git"
3. Conecta tu repo
4. Build command: `npm run build`
5. Publish directory: `build`
6. Deploy site

## Reglas de Firestore (importante)

En Firebase Console → Firestore → Rules, pega esto para permitir acceso:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

> ⚠️ Esto es para uso interno del equipo. Si quieres agregar login,
> avísame y lo implementamos con Firebase Auth.

## Características

- ✅ Tiempo real entre todos los dispositivos (Firebase Firestore)
- ✅ Buscar clientes por NIT o nombre
- ✅ Múltiples prefijos por cliente (FE, NC, DIST, etc.)
- ✅ Rango claro de factura inicio → factura fin
- ✅ Estados: Activo / Agotado / Cancelado
- ✅ Funciona en iPhone, Android, PC — cualquier navegador
- ✅ Se puede instalar como app en el celular (PWA)

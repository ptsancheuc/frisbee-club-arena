# Publicar Frisbee Club Arena

Estado: preparado y probado localmente. Aún no publicado en internet: falta seleccionar el dominio/hosting del propietario. El enlace 192.168.x.x solo funciona en la red local.

## Requisitos de esta implementación

- Un proceso Node.js persistente (Node 24 LTS recomendado), con HTTPS delante.
- Una sola instancia: las salas viven en memoria. Reiniciar borra las partidas y los puntos; el dibujo y nombre se conservan en el navegador.
- HTTP streaming/SSE sin buffering para recibir estados, y POST para comandos. No requiere base de datos ni dependencias npm.
- No basta con subir el HTML a un hosting estático. No desplegar el backend como funciones efímeras o múltiples réplicas independientes.
- Límite configurado: 24 jugadores por sala; validado con dos clientes, no con una prueba de carga de 24 jugadores.

## Servicio Node / contenedor

### Render con GitHub (sin dominio propio)

Se incluye `render.yaml` para un Web Service Node con plan `free`, región Virginia, comprobaciones antes del despliegue y `/health` como health check. Configuración basada en la [referencia oficial de Blueprints](https://render.com/docs/blueprint-spec).

El siguiente paso es crear un repositorio dedicado en la cuenta GitHub del propietario, subir este proyecto y conectar ese repositorio a un Blueprint de Render. El inicio de sesión del navegador está pendiente. No se ha creado el repositorio ni el servicio, ni se ha generado una URL pública.

No hace falta comprar dominio: Render asigna una URL `.onrender.com`. El plan gratuito puede suspenderse tras 15 minutos sin tráfico y reiniciarse al recibir visitas; las salas en memoria se reinician. Los límites están en la [documentación del plan gratuito](https://render.com/docs/free).

El servicio debe ejecutar `npm start` o `node server.cjs`. La variable PORT la puede asignar el proveedor; HOST por defecto es 0.0.0.0. Health check: `/health`.

Antes de subir:

```sh
npm run check
npm test
```

Para un proveedor que acepte Docker, usa el Dockerfile de la raíz. Configura una instancia, puerto 3000 y dominio/HTTPS del proveedor. No hay compilación frontend ni dependencias que instalar.

[Render documenta el despliegue de servidores Node como Web Services](https://render.com/docs/deploy-node-express-app). Se debe seleccionar un servicio que mantenga el proceso vivo durante las partidas; no se ha contratado ni creado ningún servicio.

## VPS con tu dominio

Si tienes Docker Compose y el subdominio apunta a la IP del VPS, copia `.env.example` a `.env` y sustituye el dominio por el tuyo. No uses el dominio de ejemplo.

```sh
docker compose up -d --build
```

La configuración incluida pone Caddy delante del juego en los puertos 80 y 443. Verifica que esos puertos no estén ocupados por tu sitio actual antes de usarla. Si ya tienes un proxy, añade un subdominio a ese proxy en vez de arrancar otro en los mismos puertos.

Para streaming, se incluye `flush_interval -1`, según la [documentación oficial de reverse_proxy de Caddy](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy). Conserva el host original hacia Node y no caches `/api/*`. Evita registrar parámetros completos de `/api/events`, ya que contienen el token temporal de la partida.

## Verificación después del despliegue

1. `/health` devuelve `ok: true`.
2. Dos dispositivos con el mismo enlace de sala muestran ambos perros y el mismo ranking.
3. El movimiento, la apariencia pintada y las capturas se reflejan en ambos clientes.
4. Probar uno con datos móviles para confirmar acceso desde fuera de la red local.

Node 24 figura como LTS en la [página oficial de versiones](https://nodejs.org/en/about/previous-releases). El Dockerfile usa esa rama, aunque no se ha construido la imagen en este equipo porque Docker no está instalado.

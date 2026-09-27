# Frisbee Club

## Arena multijugador (nuevo)

`npm start` abre la arena en `/`; el juego individual anterior está en `/solo.html`. Node.js 22 o superior. La arena necesita el servidor y no funciona abriendo index.html directamente.

- Salas de hasta 24 jugadores, invitaciones por enlace, ranking por masa y minimapa. Cada sala incluye seis bots identificados con IA, además de hasta 24 jugadores humanos. Persiguen e interceptan frisbees, saltan y hacen doble salto, beben al tener sed, huyen de amenazas y persiguen rivales pequeños. Usan los mismos controles y reglas del servidor. Las salas sin humanos dejan de simularse y caducan.
- Los frisbees vuelan en línea recta, diagonal, curva u ondulada y rebotan en los límites del parque. Todos requieren saltar; los azules requieren doble salto. El servidor comparte el vuelo y valida la altura de cada captura.
- Atrapa frisbees para crecer. Con al menos un 30 % más de masa puedes pillar a un rival, obtener el 35 % de su masa (mínimo 6) y 100 puntos. El rival reaparece con masa inicial y cinco segundos de protección; conserva sus puntos.
- Hay seis bebederos azules, señalados en el minimapa. Moverse consume agua según la distancia (más con turbo); la velocidad disminuye gradualmente hasta el 45 % cuando se agota. Detenerse en el suelo junto a un bebedero repone 24 de agua/s. E o el botón MEAR permite marcar el parque cada 20 s, cuesta 8 de agua y deja un charco decorativo durante 12 s.
- Los pequeños corren más rápido. Saltar evita que te pillen mientras estás suficientemente alto. El turbo consume 2 de masa/s. Por encima de 120, la masa decae lentamente para equilibrar la sala.
- Joystick izquierdo en celular para moverte en todas direcciones. Botones derechos para salto, giro, agarre y turbo. Dos pulsaciones de salto permiten doble salto. Combina la dirección horizontal del joystick con GIRO: derecha = 360, izquierda = backflip, centro = voltereta.
- Computador: WASD/flechas para moverte, espacio para salto, X para giro, Z para agarre, Shift para turbo.
- Editor de 20×16 píxeles con color libre, pincel, borrador, deshacer, pelaje y vista previa. Guarda localmente y transmite el diseño al entrar a la sala. Permite pintar con teclado (flechas + espacio).

Servidor autoritativo a 20 Hz y estados a 10 Hz mediante SSE. El cliente solo envía controles: posición, masa y puntos se calculan en el servidor. Las salas tienen códigos compartibles, no contraseñas. No hay pausa online. Al desconectarse se detienen los controles y la sesión caduca; las partidas no se conservan tras reiniciar el servidor.

Publicación: consulta [DEPLOY.md](DEPLOY.md). Incluye Dockerfile y ejemplo de proxy HTTPS; la publicación real está pendiente de destino/acceso. `npm test` incluye pruebas de dos clientes reales conectados al servidor.

## Modo individual

Juego 2D de estética pixel art, hecho con HTML, CSS y Canvas sin dependencias de JavaScript.

## Jugar

Ejecuta `npm start` y abre http://localhost:3000/solo.html. También puedes abrir `solo.html` directamente.

- Flechas o A/D: correr.
- Espacio, W o flecha arriba: saltar. Pulsa otra vez en el aire para un doble salto.
- P o Escape: pausar y continuar.
- En el aire, X: voltereta; derecha + X: 360; izquierda + X: backflip; Z: agarre de patitas.
- En dispositivos táctiles: botones de dirección y salto.

La ronda dura 60 segundos y la dificultad aumenta continuamente. Los frisbees normales valen 10 puntos y los dorados 30. Al encadenar 3, 6 y 9 capturas, el multiplicador sube a ×2, ×3 y ×4. Los frisbees azules dan 3 segundos extra, hasta un máximo de 12 por ronda. Dejar pasar un frisbee o pisar barro rompe la racha; el barro también ralentiza al perro brevemente. Salta para esquivarlo.

El resumen final muestra capturas, trucos aterrizados y mejor combo de trucos. El récord se guarda en el navegador y el sonido se puede activar desde la cabecera.

## Freestyle y sustos

En el celular, GIRO equivale a X y AGARRE a Z. Mantén una dirección al pulsar GIRO para cambiar de truco. Espera a que acabe cada animación antes de introducir la siguiente. Usa el doble salto para ganar tiempo.

Los trucos se encadenan durante un mismo salto y se cobran al aterrizar. Cada tipo diferente aumenta el multiplicador, hasta ×5 con el especial. Repetir reduce el valor y no aumenta el multiplicador. Se permiten hasta cinco trucos por salto. Una captura aérea añade 25 puntos a la base del combo. La secuencia **360 → agarre → backflip** activa **Hueso de oro**, que añade 200 puntos base y un multiplicador extra.

Si aterrizas con una animación incompleta, en barro, o te asusta el gato, pierdes los puntos pendientes, sin quitar los ya ganados. Los trucos sin aterrizar al terminar el tiempo tampoco se cobran.

El gato anuncia su entrada durante 1,4 segundos. Sáltalo o aléjate: el susto provoca un salto involuntario y una breve pérdida de velocidad, rompe la racha y cancela el combo. Hay un breve período de protección para evitar golpes consecutivos.

Aumentan continuamente la velocidad y la oscilación de los frisbees, la velocidad de gatos y barro, y la frecuencia de apariciones. Desde los 30 segundos algunos frisbees llegan también por la izquierda. El indicador cambia de nivel cada 15 segundos.

Desde un celular en la misma red, usa la dirección IP local del computador y el puerto 3000. El servidor escucha en la red local y sirve únicamente los archivos del juego.

`npm run check` comprueba la sintaxis; `npm test` verifica las reglas del juego. Las fuentes de Google son opcionales; hay tipografías de respaldo para jugar sin conexión.

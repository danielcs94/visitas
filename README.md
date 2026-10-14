# Panel de visitas

Mi panel para ver de un vistazo cuánta gente entra en mis proyectos. Los datos salen de
GoatCounter, que es el contador que tengo puesto en el portfolio, en Rutas Noviciado y en
Rutas A→B, pero aquí los ordeno por proyecto y con gráficos.

Lo que enseña:

- Visitantes del periodo, cuánta gente ha generado una ruta y cuántos clics llegan a las apps desde
  el portfolio.
- Un gráfico de visitas por día (o por hora si miras solo hoy), con un color por proyecto.
- Una tarjeta por proyecto con su tendencia.
- El camino de la gente: visita al portfolio, clic en una app, ruta generada y ruta abierta en
  Google Maps o descargada en GPX.
- Países, dispositivos, de dónde llegan, navegadores, sistemas e idiomas.
- Qué intensidad y qué distancia eligen en las apps, todos los eventos y los errores al generar rutas.

## Cómo conectarlo

En GoatCounter, *Configuración → API*, creo un token marcando solo «Read statistics». Lo pego en el
panel con el botón ⚙. El token se guarda solo en el navegador de ese dispositivo y solo se envía a
GoatCounter, así que el repositorio no tiene nada privado. Sin token, el panel enseña datos de
ejemplo para ver cómo queda.

## Ejecutarlo

```bash
python3 tools/serve.py 5183
```

Antes de publicar cambios, `python3 tools/release.py`.

Este panel no lleva contador, para no contarme a mí mismo cada vez que lo abro.

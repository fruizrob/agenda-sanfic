# Agenda SANFIC

Programación interactiva de SANFIC22, del 2 al 8 de noviembre de 2026.

El tiempo avanza horizontalmente; cada fila representa una sala y cada bloque muestra el metraje de una función. Incluye 100 funciones en siete salas, fichas, filtros y selección de funciones con detección de topes.

## GitHub Pages

Los archivos ya están en la raíz, listos para publicar. En **Settings → Pages**, selecciona **Deploy from a branch**, la rama **main** y **/(root)**; luego **Save**.

## Vista local

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

Abre `http://127.0.0.1:8000/`.

## Datos

Agenda independiente basada en la programación oficial. Datos consultados el 28 de octubre de 2026. Las fuentes están en [assets/fuentes.json](assets/fuentes.json) y el [PDF oficial](assets/programacion-sanfic22.pdf).

Los términos se calculan por metraje y no incluyen presentaciones ni conversatorios. El margen entre salas es configurable; no es un tiempo de viaje medido. La selección se guarda en el navegador y puede exportarse a un calendario.

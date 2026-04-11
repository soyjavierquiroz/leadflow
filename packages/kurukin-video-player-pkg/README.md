# Kurukin Video Player

## 🚀 Visión General

`kurukin-video-player-pkg` es un Universal Video Engine construido con React y TypeScript para unificar múltiples proveedores de video bajo una sola API de UI.

La arquitectura sigue un patrón Estrategia:

- La capa de proveedor decide cómo se monta y controla el video según el origen (`bunnynet`, `html5`, `youtube`).
- La capa de UI en React permanece agnóstica al proveedor y se encarga de overlays, posters, CTA, progreso psicológico y comportamiento VSL.
- El componente principal expone una superficie consistente de props y eventos, mientras cada adapter implementa `play`, `pause`, `mute`, `seek`, `getDuration` y callbacks de ciclo de vida.

Esto permite separar claramente la lógica de transporte y reproducción de la experiencia comercial o editorial que vive en la interfaz.

## 🧠 El Motor Bunny.net (HLS Pro)

Cuando se usa `provider="bunnynet"`, el player monta un elemento `<video>` nativo y conecta el stream HLS `.m3u8` mediante `hls.js`.

Flujo técnico:

- `KurukinPlayer` delega en `useVideoProviderController`.
- El controller selecciona `useBunnyProvider`.
- `useBunnyProvider` crea un provider nativo sobre el `<video>`.
- Si el navegador soporta `hls.js`, se hace `loadSource(videoId)` y `attachMedia(videoElement)`.
- Si el navegador puede reproducir HLS nativamente, se usa fallback directo asignando `videoElement.src = videoId`.

### Optimización de calidad inicial

La instancia de `hls.js` arranca con:

```ts
new Hls({
  startLevel: 2,
  capLevelToPlayerSize: true,
});
```

Esto persigue dos objetivos:

- `startLevel: 2` evita un arranque demasiado blando o borroso al no comenzar en el nivel más bajo disponible.
- `capLevelToPlayerSize: true` limita la calidad al tamaño real del reproductor para no pedir bitrate innecesario y mejorar el balance entre nitidez y tiempo de arranque.

En términos prácticos, Bunny arranca con una percepción visual más premium sin disparar de inmediato una calidad desproporcionada para el viewport.

## 💎 API VSL Premium (Props)

Estas son las props clave para la experiencia VSL y sincronización comercial:

| Prop | Tipo | Descripción |
| --- | --- | --- |
| `vslMode` | `boolean` | Activa el ecosistema VSL: muted autoplay, UI limpia, click-to-pause global, overlay de unmute y fake progress bar. |
| `onTimeUpdate` | `(currentTime: number) => void` | Emite el tiempo actual del video en segundos para sincronizar CTAs externos, barras de certeza, highlights o automatizaciones de layout. |
| `resumePlayback` | `boolean` | Guarda y recupera el progreso en `localStorage` usando una clave compuesta por provider y `videoId`. Nota: la persistencia se omite cuando `vslMode` está activo para proteger el flujo del pitch. |
| `vslProgressBarColor` | `string` | Permite personalizar el color de la fake progress bar, por ejemplo `#FBBF24`. |

## ⚙️ Características Psicológicas y de Conversión (VSL Mode)

Cuando `vslMode={true}`, el player cambia de un modo de reproducción tradicional a una experiencia pensada para ventas y retención.

### Click-to-Pause Global

- La botonera de controles desaparece por completo.
- Los controles custom de React no se renderizan.
- Los controles visuales de `Plyr` quedan ocultos en CSS dentro de `data-vsl-mode="true"`.
- Toda el área visible del video pasa a ser un trigger global de `play` y `pause`.
- Internamente se usa la API del provider para alternar `provider.play()` y `provider.pause()`.

El resultado es una interacción más limpia, sin fricción visual y con una única acción posible sobre la superficie del video.

### Muted Autoplay & Smart Overlay

El arranque en VSL sigue esta secuencia:

- El video intenta reproducirse en autoplay y en silencio.
- Mientras el estado VSL sigue muteado, aparece un overlay premium con badge ocre translúcido.
- Ese overlay obliga el primer clic consciente del usuario.
- Al hacer clic en el overlay se hace `unmute`, se desactiva el loop de preview y se ejecuta `seek(0)` para reiniciar el pitch desde el inicio.

Esto alinea la experiencia con la lógica clásica de VSL:

- autoplay sin sonido para maximizar arranque,
- primer gesto del usuario para desbloquear audio,
- reinicio del mensaje para que el pitch arranque limpio.

### Fake Progress Bar

En `vslMode` se muestra una barra psicológica de progreso que no refleja el porcentaje real del video, sino una percepción optimizada de avance.

Algoritmo actual:

- Del segundo `0` al `20`, la barra sube hasta el `30%`.
- Desde el segundo `20` hasta el `50%` de la duración real, la barra avanza del `30%` al `70%`.
- Desde el `50%` de duración hasta el final, la barra sube del `70%` al `98%`.
- El valor final siempre se limita con `clamp(..., 0, 98)`.

```ts
if (safeCurrentTime <= 20) {
  progress = (safeCurrentTime / 20) * 30;
} else if (safeCurrentTime <= safeDuration * 0.5) {
  const middlePhaseDuration = Math.max(safeDuration * 0.5 - 20, 1);
  progress = 30 + ((safeCurrentTime - 20) / middlePhaseDuration) * 40;
} else {
  const finalPhaseDuration = Math.max(safeDuration * 0.5, 1);
  progress = 70 + ((safeCurrentTime - safeDuration * 0.5) / finalPhaseDuration) * 28;
}
```

Importante:

- La sensación es de desaceleración progresiva.
- No es una curva exponencial pura; está implementada como una progresión psicológica por tramos lineales.
- El objetivo es comunicar “video corto y ya muy avanzado” durante la fase inicial sin llegar nunca al `100%` antes del final real.

## 💻 Ejemplo de Uso (Snippet)

Ejemplo de consumo con Bunny.net en modo VSL, capturando el tiempo actual para sincronizar UI externa:

```tsx
import { useState } from 'react';
import { KurukinPlayer } from 'kurukin-video-player-pkg';
import 'kurukin-video-player-pkg/style.css';

export function SalesHero() {
  const [currentTime, setCurrentTime] = useState(0);

  return (
    <section className="mx-auto max-w-5xl space-y-4">
      <KurukinPlayer
        provider="bunnynet"
        videoId="https://vz-xxxxxxxx.b-cdn.net/playlist.m3u8"
        vslMode
        vslProgressBarColor="#FBBF24"
        onTimeUpdate={setCurrentTime}
        smartPoster={{
          imageUrl: '/images/vsl-poster.jpg',
          eyebrow: 'VSL Premium',
          title: 'Descubre el sistema completo',
          description: 'Haz clic y activa el audio para comenzar desde el inicio.',
          buttonText: 'Ver ahora',
        }}
      />

      <div className="text-sm text-zinc-400">
        Tiempo actual: {currentTime.toFixed(1)}s
      </div>
    </section>
  );
}
```

### YouTube también puede correr en modo VSL

El adapter de YouTube ya consume la misma API premium del player. Eso significa que `vslMode`, `resumePlayback` y `onTimeUpdate` pueden activarse con `provider="youtube"` sin cambiar la capa de UI.

```tsx
import { useState } from 'react';
import { KurukinPlayer } from 'kurukin-video-player-pkg';

export function YoutubeVslDemo() {
  const [currentTime, setCurrentTime] = useState(0);

  return (
    <KurukinPlayer
      provider="youtube"
      videoId="aQhTmuZiKOY"
      vslMode={true}
      resumePlayback={true}
      onTimeUpdate={setCurrentTime}
    />
  );
}
```

## Notas Operativas

- En Bunny.net, `videoId` debe ser la URL del manifiesto HLS `.m3u8`.
- En YouTube, `videoId` debe ser el ID del video, por ejemplo `aQhTmuZiKOY`.
- La demo de la app en `src/pages/DemoPage.tsx` ya monta tanto Bunny como YouTube usando la misma API VSL.
- El player usa eventos de reproducción para mantener sincronizados `isPlaying`, overlays y callbacks.
- `onTimeUpdate` es el punto ideal para disparar lógica de conversión fuera del player.
- Si el navegador bloquea autoplay, el sistema cae en poster/manual start sin romper la interfaz.

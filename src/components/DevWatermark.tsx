/**
 * Marca de agua sutil de los desarrolladores. Se monta en __root y aparece
 * en todas las páginas. pointer-events-none + opacidad muy baja para no
 * interferir con la UI ni los clicks.
 */
export function DevWatermark() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed bottom-1.5 right-2 z-[60] hidden select-none text-[9px] font-medium tracking-wide text-muted-foreground/40 sm:block"
      style={{ mixBlendMode: "multiply" }}
    >
      Desarrollado por Andrés F. Quiceno · Juan D. Jaramillo
    </div>
  );
}

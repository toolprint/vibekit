import { useRef, useEffect } from "react";

export default function TVStatic({
  label,
  size = "md",
}: {
  label: string;
  size?: "md" | "lg";
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const generateStatic = () => {
      const imageData = ctx.createImageData(canvas.width, canvas.height);
      const data = imageData.data;

      // Adjust static intensity based on size
      const staticThreshold = size === "lg" ? 0.3 : 0.5; // lg = more white noise

      for (let i = 0; i < data.length; i += 4) {
        const random = Math.random();
        let noise;

        if (random > staticThreshold) {
          noise = 255; // white
        } else if (random > staticThreshold - 0.2) {
          noise = size === "lg" ? Math.floor(Math.random() * 100) + 155 : 128; // light gray with variation
        } else {
          noise = size === "lg" ? Math.floor(Math.random() * 80) + 50 : 64; // dark gray with variation
        }

        data[i] = noise; // red
        data[i + 1] = noise; // green
        data[i + 2] = noise; // blue
        data[i + 3] = 255; // fully opaque
      }

      ctx.putImageData(imageData, 0, 0);
    };

    // Adjust animation speed based on size
    const animationSpeed = size === "lg" ? 30 : 50; // lg = faster updates
    const interval = setInterval(generateStatic, animationSpeed);
    generateStatic(); // Initial render

    return () => clearInterval(interval);
  }, [size]);

  return (
    <div className="w-full h-full border rounded-lg bg-muted relative overflow-hidden flex items-center justify-center">
      <canvas
        ref={canvasRef}
        width="400"
        height="256"
        className="absolute inset-0 w-full h-full object-cover opacity-30"
      />
      <div className="relative z-10 text-black/70 text-sm font-mono animate-pulse">
        {label}
      </div>
      <div className="absolute top-3 right-3 size-2.5 rounded-full animate-fast-pulse bg-orange-500" />
    </div>
  );
}

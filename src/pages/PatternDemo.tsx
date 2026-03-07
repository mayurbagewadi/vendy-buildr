import { useMemo } from "react";

// Seeded random number generator (deterministic — same output every render)
const createRng = (seed: number) => {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
};

// Each entry = array of SVG path `d` strings (viewBox 0 0 24 24)
const ICONS: string[][] = [
  // Shopping Cart
  [
    "M9 22c.55 0 1-.45 1-1s-.45-1-1-1-1 .45-1 1 .45 1 1 1zm13 0c.55 0 1-.45 1-1s-.45-1-1-1-1 .45-1 1 .45 1 1 1zM1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.45L23 6H6",
  ],
  // Shopping Bag
  [
    "M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z",
    "M3 6h18",
    "M16 10a4 4 0 0 1-8 0",
  ],
  // Heart
  [
    "M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z",
  ],
  // Star
  [
    "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z",
  ],
  // Camera
  [
    "M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z",
    "M12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
  ],
  // Coffee Cup
  [
    "M18 8h1a4 4 0 0 1 0 8h-1",
    "M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z",
    "M6 1v3",
    "M10 1v3",
    "M14 1v3",
  ],
  // Music Note
  [
    "M9 18V5l12-2v13",
    "M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0z",
    "M21 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0z",
  ],
  // Gift Box
  [
    "M20 12v10H4V12",
    "M22 7H2v5h20V7z",
    "M12 22V7",
    "M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z",
    "M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z",
  ],
  // Clock
  [
    "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z",
    "M12 6v6l4 2",
  ],
  // Headphones
  [
    "M3 18v-6a9 9 0 0 1 18 0v6",
    "M3 18a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z",
    "M21 18a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3z",
  ],
  // Phone
  [
    "M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 2.18h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L7.91 9.91a16 16 0 0 0 6.06 6.06l.91-.91a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z",
  ],
  // Tag / Price tag
  [
    "M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z",
    "M7 7h.01",
  ],
  // Smile / Emoji
  [
    "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z",
    "M8 14s1.5 2 4 2 4-2 4-2",
    "M9 9h.01",
    "M15 9h.01",
  ],
  // Lightning / Zap
  [
    "M13 2L3 14h9l-1 8 10-12h-9l1-8z",
  ],
  // Package / Box
  [
    "M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z",
    "M3.27 6.96L12 12.01l8.73-5.05",
    "M12 22.08V12",
  ],
  // Bicycle (simplified)
  [
    "M5 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10z",
    "M19 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10z",
    "M9 12l3-6 4 6",
    "M5 12h4",
    "M12 6h4",
  ],
  // Laptop
  [
    "M20 16V7a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v9",
    "M2 16h20",
    "M10 20h4",
  ],
  // Credit Card / Wallet
  [
    "M21 4H3a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h18a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z",
    "M1 10h22",
    "M7 15h.01",
    "M11 15h2",
  ],
  // Flower / Sparkle
  [
    "M12 3a1 1 0 0 0-1 1v2a1 1 0 0 0 2 0V4a1 1 0 0 0-1-1z",
    "M12 18a1 1 0 0 0-1 1v2a1 1 0 0 0 2 0v-2a1 1 0 0 0-1-1z",
    "M3 12a1 1 0 0 0 1-1H2a1 1 0 0 0 0 2h2a1 1 0 0 0-1-1z",
    "M20 11h-2a1 1 0 0 0 0 2h2a1 1 0 0 0 0-2z",
    "M5.64 5.64a1 1 0 0 0 1.41 1.41l1.42-1.41a1 1 0 0 0-1.42-1.42L5.64 5.64z",
    "M15.54 15.54a1 1 0 0 0 1.41 1.41l1.42-1.41a1 1 0 0 0-1.42-1.42l-1.41 1.42z",
    "M5.64 18.36l1.42-1.42a1 1 0 0 0-1.42-1.41L4.22 16.95a1 1 0 0 0 1.42 1.41z",
    "M18.36 5.64l-1.42 1.42a1 1 0 0 0 1.42 1.41l1.41-1.42a1 1 0 0 0-1.41-1.41z",
    "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z",
  ],
  // Pizza slice
  [
    "M12 2a10 10 0 0 1 10 10",
    "M12 2L2 12",
    "M12 2l10 10L2 12z",
    "M8 9h.01",
    "M13 7h.01",
  ],
  // Umbrella
  [
    "M23 12a11.05 11.05 0 0 0-22 0zm-5 7a3 3 0 0 1-6 0v-7",
  ],
  // Donut / Circle with hole
  [
    "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z",
    "M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
  ],
  // Quote marks
  [
    "M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z",
    "M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z",
  ],
  // Percent / Discount
  [
    "M19 5L5 19",
    "M6.5 6.5m-2.5 0a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0-5 0",
    "M17.5 17.5m-2.5 0a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0-5 0",
  ],
];

const PatternDemo = () => {
  const W = 760;
  const H = 1400;
  const COUNT = 140;

  const items = useMemo(() => {
    const rand = createRng(1337);
    return Array.from({ length: COUNT }, () => ({
      paths: ICONS[Math.floor(rand() * ICONS.length)],
      x: rand() * W,
      y: rand() * H,
      size: 16 + rand() * 36,
      rotation: (rand() - 0.5) * 90,
      opacity: 0.06 + rand() * 0.14,
    }));
  }, []);

  return (
    <div style={{ background: "#161618", minHeight: "100vh", overflow: "hidden" }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        style={{ display: "block", maxHeight: "100vh" }}
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="xMidYMid slice"
      >
        <rect width={W} height={H} fill="#161618" />
        {items.map((item, i) => {
          const half = item.size / 2;
          return (
            <g
              key={i}
              opacity={item.opacity}
              transform={`translate(${item.x - half}, ${item.y - half}) rotate(${item.rotation}, ${half}, ${half}) scale(${item.size / 24})`}
            >
              {item.paths.map((d, j) => (
                <path
                  key={j}
                  d={d}
                  stroke="white"
                  strokeWidth={1.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                />
              ))}
            </g>
          );
        })}
      </svg>
    </div>
  );
};

export default PatternDemo;

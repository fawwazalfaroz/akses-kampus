/** Piktogram sederhana per jenis lokasi (gaya rambu penunjuk arah). */
export const TYPE_GLYPHS: Record<string, string> = {
  entrance: "M5 20V4h9v16 M14 12h6 M17 9l3 3-3 3",
  library: "M3 6h6a3 3 0 0 1 3 3v11a2 2 0 0 0-2-2H3z M21 6h-6a3 3 0 0 0-3 3v11a2 2 0 0 1 2-2h7z",
  service: "M12 7.5v.5 M10.5 11h1.5v6 M10.5 17h3",
  retail: "M5 8h14l-1.2 12H6.2z M9 8V6.5a3 3 0 0 1 6 0V8",
  bank: "M3 10l9-6 9 6 M5.5 10v7 M10 10v7 M14 10v7 M18.5 10v7 M3 20h18",
  vertical_access: "M8 20V4 M4.5 7.5 8 4l3.5 3.5 M16 4v16 M12.5 16.5 16 20l3.5-3.5",
  office: "M3.5 8h17v11h-17z M9 8V5h6v3 M3.5 13h17",
  room: "M6 3.5h12v17H6z M14.5 12h.5",
  toilet: "M7 4.5v.5 M17 4.5v.5 M5 8h4v6H8v6H6v-6H5z M15 8h4l1.5 7H19v5h-4v-5h-1.5z",
  food: "M7 3v7a2 2 0 0 0 2 2v9 M5 3v6 M9 3v6 M16 21V3c2.5 1 3.5 4 3.5 8H16",
  other: "M12 8a4 4 0 1 0 0 8a4 4 0 0 0 0-8",
};

export function TypeIcon({ type, className = "size-4" }: { type: string; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={TYPE_GLYPHS[type] ?? TYPE_GLYPHS.other} />
    </svg>
  );
}

type IconProps = { className?: string };
const base = (d: string) =>
  function Icon({ className = "size-4" }: IconProps) {
    return (
      <svg
        viewBox="0 0 24 24"
        className={className}
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d={d} />
      </svg>
    );
  };

export const SearchIcon = base("M11 4a7 7 0 1 0 0 14a7 7 0 0 0 0-14 M20 20l-4-4");
export const SwapIcon = base("M7 4v16 M3.5 7.5 7 4l3.5 3.5 M17 20V4 M13.5 16.5 17 20l3.5-3.5");
export const PlusIcon = base("M12 5v14 M5 12h14");
export const MinusIcon = base("M5 12h14");
export const ResetIcon = base("M4 4v6h6 M4.5 15a8 8 0 1 0 2-8.5L4 10");
export const CloseIcon = base("M6 6l12 12 M18 6L6 18");
export const FlagIcon = base("M5 21V4 M5 4h11l-2 4 2 4H5");
export const PinIcon = base("M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z M12 7.5a2 2 0 1 0 0 4a2 2 0 0 0 0-4");
export const AlertIcon = base("M12 4 2.5 20h19z M12 10v4 M12 17v.5");
export const CheckIcon = base("M5 12.5l4.5 4.5L19 7");
export const LayersIcon = base("M12 4 3 9l9 5 9-5z M3 14l9 5 9-5");

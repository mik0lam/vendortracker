export function CardThumb({
  src,
  alt = "",
  size = "md",
}: {
  src?: string | null;
  alt?: string;
  size?: "sm" | "md";
}) {
  const sizes = {
    sm: "h-10 w-7",
    md: "h-14 w-10",
  };
  if (!src) {
    return (
      <div
        className={`${sizes[size]} shrink-0 rounded-md bg-slate-200/80`}
        aria-hidden="true"
      />
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className={`${sizes[size]} shrink-0 rounded-md object-cover shadow-sm`}
    />
  );
}

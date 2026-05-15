import logo from "@/assets/neko-logo.png";

interface Props {
  size?: number;
  className?: string;
  rounded?: boolean;
  glow?: boolean;
}

export function Logo({ size = 32, className = "", rounded = true, glow = false }: Props) {
  return (
    <img
      src={logo}
      alt="NEKO"
      width={size}
      height={size}
      className={`${rounded ? "rounded-xl" : ""} object-cover ${glow ? "shadow-[0_0_30px_rgba(225,243,17,0.45)]" : ""} ${className}`}
      style={{ width: size, height: size }}
    />
  );
}

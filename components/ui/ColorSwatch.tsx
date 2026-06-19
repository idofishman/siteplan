interface Props {
  color: string | null
  size?: number
}

export function ColorSwatch({ color, size = 12 }: Props) {
  if (!color) return null
  return (
    <span
      className="inline-block rounded-sm shrink-0"
      style={{ backgroundColor: color, width: size, height: size }}
      aria-hidden="true"
    />
  )
}

import "./Button.css";

/**
 * Shared button used across the whole app.
 * variant: 'gold' | 'ghost' | 'danger' | 'plain'
 * size: 'sm' | 'md' | 'lg'
 */
export default function Button({
  variant = "plain",
  size = "md",
  icon,
  full = false,
  className = "",
  children,
  ...rest
}) {
  return (
    <button
      className={`ui-btn ui-btn--${variant} ui-btn--${size} ${full ? "ui-btn--full" : ""} ${className}`}
      {...rest}
    >
      {icon && <span className="ui-btn__icon">{icon}</span>}
      {children && <span>{children}</span>}
    </button>
  );
}

import React from 'react';

export interface LoaderButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
  variant?: 'primary' | 'danger' | 'secondary' | 'success' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  spinnerColor?: string;
}

export function Spinner({ size = 14, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={2.5}
      strokeLinecap="round"
      style={{ animation: 'spin 0.7s linear infinite', flexShrink: 0 }}
    >
      <circle cx="12" cy="12" r="10" strokeOpacity={0.25} />
      <path d="M12 2a10 10 0 0 1 10 10" />
    </svg>
  );
}

export default function LoaderButton({
  loading = false,
  disabled = false,
  variant = 'primary',
  size = 'md',
  spinnerColor,
  children,
  style,
  className,
  ...props
}: LoaderButtonProps) {
  const getVariantStyles = (): React.CSSProperties => {
    switch (variant) {
      case 'danger':
        return {
          background: '#FEE2E2',
          color: '#DC2626',
          border: '1px solid rgba(220, 38, 38, 0.2)',
        };
      case 'success':
        return {
          background: '#D1FAE5',
          color: '#059669',
          border: '1px solid rgba(5, 150, 105, 0.2)',
        };
      case 'secondary':
        return {
          background: '#1F2937',
          color: '#F8FAFC',
          border: 'none',
        };
      case 'outline':
        return {
          background: '#FFFFFF',
          color: '#334155',
          border: '1.5px solid #E2E8F0',
        };
      case 'primary':
      default:
        return {
          background: '#FF7F50',
          color: '#FFFFFF',
          border: 'none',
        };
    }
  };

  const getSizeStyles = (): React.CSSProperties => {
    switch (size) {
      case 'sm':
        return {
          padding: '6px 12px',
          fontSize: '12px',
          borderRadius: '7px',
          gap: '5px',
        };
      case 'lg':
        return {
          padding: '12px 22px',
          fontSize: '15px',
          borderRadius: '12px',
          gap: '8px',
        };
      case 'md':
      default:
        return {
          padding: '9px 16px',
          fontSize: '13.5px',
          borderRadius: '9px',
          gap: '7px',
        };
    }
  };

  const isActuallyDisabled = disabled || loading;

  return (
    <button
      disabled={isActuallyDisabled}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 700,
        cursor: isActuallyDisabled ? 'not-allowed' : 'pointer',
        opacity: isActuallyDisabled ? 0.65 : 1,
        transition: 'all 0.18s ease',
        boxSizing: 'border-box',
        ...getVariantStyles(),
        ...getSizeStyles(),
        ...style,
      }}
      className={className}
      {...props}
    >
      {loading && (
        <Spinner
          size={size === 'sm' ? 12 : size === 'lg' ? 16 : 14}
          color={spinnerColor || (variant === 'danger' ? '#DC2626' : variant === 'success' ? '#059669' : variant === 'outline' ? '#334155' : '#FFFFFF')}
        />
      )}
      {children}
    </button>
  );
}

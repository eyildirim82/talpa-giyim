import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'accent' | 'ghost';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  block?: boolean;
  children: ReactNode;
};

/** Tasarım sistemi butonu — tek vurgu (mavi) veya ghost. */
export default function Button({
  variant = 'primary',
  block = false,
  className = '',
  children,
  ...rest
}: Props) {
  const classes = ['ds-btn', `ds-btn--${variant}`, block ? 'ds-btn--block' : '', className]
    .filter(Boolean)
    .join(' ');
  return (
    <button className={classes} {...rest}>
      {children}
    </button>
  );
}

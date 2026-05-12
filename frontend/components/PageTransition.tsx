type Props = {
  children: React.ReactNode;
};

/**
 * Pass-through wrapper. The earlier CSS-fade and ViewTransition-based
 * page-level transitions were retired; the editorial route transition
 * will live in a dedicated curtain component (coming next). This
 * component is kept as a seam so we can re-introduce route-level wrap
 * logic without touching every layout consumer.
 */
export function PageTransition({ children }: Props) {
  return <>{children}</>;
}

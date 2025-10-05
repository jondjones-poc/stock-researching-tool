import HeaderCheck from '../components/HeaderCheck';

export default function GraphsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <HeaderCheck>
      {children}
    </HeaderCheck>
  );
}

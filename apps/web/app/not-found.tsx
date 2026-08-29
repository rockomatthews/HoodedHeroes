import Link from "next/link";

export default function NotFound() {
  return (
    <main className="error-page">
      <p className="kicker">SECRET DOOR // 404</p>
      <h1>THIS ROOM DOESN&apos;T EXIST.</h1>
      <Link href="/" className="action-button">RETURN TO HEADQUARTERS</Link>
    </main>
  );
}


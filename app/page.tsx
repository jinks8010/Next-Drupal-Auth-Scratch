import Articles from "./articles/page";

export default function Home() {
  return (
    <div className="grid grid-rows-[auto_1fr_auto] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20 font-[family-name:var(--font-geist-sans)]">
      <h1 className="text-3xl font-bold">Article listing</h1>
      <Articles/>
      <footer className="text-sm text-gray-500">Powered by Next.js and Drupal</footer>
    </div>
  );
}
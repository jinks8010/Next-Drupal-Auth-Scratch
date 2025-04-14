import Button from "@/components/Button";
import Link from "next/link";
interface Article {
  id: string;
  attributes: {
    title: string;
    drupal_internal__nid: number;
    created?: string;
    body?: {
      summary?: string;
      value?: string;
      processed?: string;
    };
  };
}

export default async function Articles() {
  const API_URL = `${process.env.NEXT_PUBLIC_API_URL}/jsonapi/node/article`;

  let articles: Article[] = [];

  try {
    const res = await fetch(API_URL, {
      headers: {
        Accept: "application/vnd.api+json",
      },
      // You can ignore cert issues via custom fetch wrapper or in dev CLI
      cache: "no-store", // optional: avoid ISR for dynamic content
    });

    if (!res.ok) {
      throw new Error(`HTTP error! Status: ${res.status}`);
    }

    const data = await res.json();
    articles = data.data;
  } catch (error: any) {
    return (
      <div className="p-8 text-red-600 font-medium">
        Error loading articles: {error.message}
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <h1 className="text-4xl font-bold mb-10 text-center text-gray-800">
        📚 Latest Articles
      </h1>

      {articles.length === 0 ? (
        <p className="text-center text-gray-500">No articles found.</p>
      ) : (
        <div className="grid gap-8 md:grid-cols-2">
          {articles.map((article) => (
            <div
              key={article.id}
              className="bg-white p-6 rounded-2xl shadow-md hover:shadow-xl transition-shadow duration-300 border border-gray-100"
            >
              <Link href={`/articles/${article.id}`} className="block">
                <h2 className="text-xl font-semibold text-blue-600 hover:underline">
                  {article.attributes.title}
                </h2>
              </Link>
              {article.attributes.created && (
                <p className="text-sm text-gray-400 mt-1">
                  {new Date(article.attributes.created).toLocaleDateString()}
                </p>
              )}
              <div className="mt-4 text-gray-700 text-sm prose max-w-none">
                <div
                  dangerouslySetInnerHTML={{
                    __html:
                      article.attributes.body?.summary ||
                      article.attributes.body?.value?.substring(0, 200) ||
                      "",
                  }}
                />
              </div>
              <Link
                href={`/articles/${article.id}`}
                className="inline-block mt-4 text-sm text-blue-500 hover:underline"
              >
                Read more →
              </Link>
            </div>
          ))}
        </div>
        
      )}
    </div>
  );
}

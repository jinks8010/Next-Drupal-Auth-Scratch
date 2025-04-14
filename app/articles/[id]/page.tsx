import Link from 'next/link';

interface ArticleDetail {
  id: string;
  attributes: {
    title: string;
    created?: string;
    body?: {
      processed?: string;
      value?: string;
    };
  };
}

export default async function ArticlePage({ params }: { params: { id: string } }) {
  const {id:articleId} = await params;

  let article: ArticleDetail | null = null;
  let error: string | null = null;
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
  try {
    
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/jsonapi/node/article/${articleId}`, {
      headers: {
        Accept: 'application/vnd.api+json',
      },
      cache: 'no-store', // disable caching for fresh content each time
    });

    if (!res.ok) {
      throw new Error(`HTTP error! Status: ${res.status}`);
    }

    const data = await res.json();

    if (data.data) {
      article = data.data; // single object if fetching by ID
    } else {
      throw new Error("Article not found");
    }
  } catch (err: any) {
    console.error("Error fetching article:", err);
    error = err.message;
  }

  if (error || !article) {
    return (
      <div className="container mx-auto p-8">
        <Link href="/" className="text-blue-600 hover:text-blue-800 mb-6 inline-block">
          &larr; Back to articles
        </Link>
        <div className="p-4 bg-red-50 border border-red-200 rounded">
          <p className="text-red-600">Error loading article: {error || "Article not found"}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-8">
      <Link href="/" className="text-blue-600 hover:text-blue-800 mb-6 inline-block">
        &larr; Back to articles
      </Link>

      <article className="prose lg:prose-xl max-w-none">
        <h1 className="text-3xl font-bold mb-4">{article.attributes.title}</h1>

        {article.attributes.created && (
          <div className="text-gray-500 mb-6">
            Published on {new Date(article.attributes.created).toLocaleDateString()}
          </div>
        )}

        <div
          dangerouslySetInnerHTML={{
            __html:
              article.attributes.body?.processed ||
              article.attributes.body?.value ||
              "No content available.",
          }}
        />
      </article>
    </div>
  );
}

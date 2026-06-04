import { createFileRoute, redirect, Link } from '@tanstack/react-router'
import { getPublishedPostBySlug } from '../../lib/server/blog'

// SAME stylesheet the editor imports — guarantees the published article is a
// 1:1 match of the editing canvas.
import '../../journal-prose.css'

export const Route = createFileRoute('/journal/$slug')({
  loader: async ({ params }) => {
    const post = await getPublishedPostBySlug({ data: params.slug })
    // Not found or still a draft → bounce back to the journal index.
    if (!post) throw redirect({ to: '/journal' })
    return { post }
  },
  head: ({ loaderData }) => ({
    meta: loaderData
      ? [
          { title: `${loaderData.post.title} — ZRNO Journal` },
          { name: 'description', content: loaderData.post.excerpt || '' },
        ]
      : [],
  }),
  component: Article,
})

function fmtDate(s: string | null) {
  if (!s) return ''
  return new Date(s).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
}

function Article() {
  const { post } = Route.useLoaderData()

  return (
    <div className="min-h-screen bg-espresso text-cream font-body">
      <article className="px-6 md:px-12 pb-28">
        {/* Title block shares the article reading column. */}
        <header className="max-w-[680px] mx-auto pt-16 md:pt-24 text-center">
          <time className="font-mono text-[11px] tracking-[0.22em] uppercase text-amber">
            {fmtDate(post.published_at ?? post.created_at)}
          </time>
          <h1 className="font-display text-4xl sm:text-5xl md:text-6xl leading-[0.95] mt-4">
            {post.title}
          </h1>
          {post.excerpt && (
            <p className="text-taupe text-lg md:text-xl leading-relaxed mt-6">{post.excerpt}</p>
          )}
        </header>

        {post.cover_image_url && (
          <figure className="max-w-4xl mx-auto mt-12">
            <img
              src={post.cover_image_url}
              alt=""
              className="w-full h-auto border border-muted/20"
            />
          </figure>
        )}

        {/* The 1:1 surface: stored Tiptap HTML rendered with `.prose-article`. */}
        <div
          className="prose-article mt-12 md:mt-16"
          dangerouslySetInnerHTML={{ __html: post.content_html }}
        />

        <footer className="max-w-[680px] mx-auto mt-20 pt-10 border-t border-muted/20 text-center">
          <Link
            to="/journal"
            className="font-mono text-[11px] tracking-[0.2em] uppercase text-amber hover:text-amberdeep transition-colors"
          >
            ← More from the Journal
          </Link>
        </footer>
      </article>
    </div>
  )
}

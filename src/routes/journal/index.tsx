import { createFileRoute, Link } from '@tanstack/react-router'
import { listPublishedPosts, type PostListItem } from '../../lib/server/blog'

export const Route = createFileRoute('/journal/')({
  loader: async () => {
    const posts = await listPublishedPosts()
    return { posts }
  },
  head: () => ({
    meta: [
      { title: 'Journal — ZRNO' },
      {
        name: 'description',
        content: 'Notes from the roastery — on coffee, craft, and the slow dark art of roasting. ZRNO, Žižkov, Prague.',
      },
    ],
  }),
  component: JournalIndex,
})

function fmtDate(s: string | null) {
  if (!s) return ''
  return new Date(s).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
}

function JournalIndex() {
  const { posts } = Route.useLoaderData()

  return (
    <div className="min-h-screen bg-espresso text-cream font-body">
      <main className="px-6 md:px-12">
        <section className="max-w-6xl mx-auto pt-16 md:pt-24 pb-12">
          <div className="font-mono text-xs tracking-[0.25em] text-amber uppercase">The ZRNO</div>
          <h1 className="font-display t-md mt-3">JOURNAL</h1>
          <p className="text-taupe max-w-xl mt-5 text-lg leading-relaxed">
            Notes from the roastery — on coffee, craft, and the slow dark art of
            getting a bean exactly right.
          </p>
        </section>

        <section className="max-w-6xl mx-auto pb-28">
          {posts.length === 0 ? (
            <div className="border border-muted/20 bg-surface px-8 py-20 text-center">
              <p className="font-display text-3xl text-cream">NOTHING HERE YET</p>
              <p className="text-taupe mt-3">
                The first entry is still drying on the rack. Check back soon.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-muted/15 border border-muted/15">
              {posts.map((p) => (
                <PostCard key={p.id} post={p} />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}

function PostCard({ post }: { post: PostListItem }) {
  return (
    <Link
      to="/journal/$slug"
      params={{ slug: post.slug }}
      className="group flex flex-col bg-surface hover:bg-elevated transition-colors"
    >
      {post.cover_image_url ? (
        <div className="aspect-[16/9] overflow-hidden bg-elevated">
          <img
            src={post.cover_image_url}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
          />
        </div>
      ) : (
        <div className="aspect-[16/9] panel-bg" aria-hidden />
      )}
      <div className="flex flex-1 flex-col p-7 md:p-9">
        <time className="font-mono text-[11px] tracking-[0.18em] uppercase text-amber">
          {fmtDate(post.published_at ?? post.created_at)}
        </time>
        <h2 className="font-display text-3xl md:text-4xl leading-[0.95] mt-3 text-cream group-hover:text-cream">
          {post.title}
        </h2>
        {post.excerpt && (
          <p className="text-taupe mt-4 leading-relaxed line-clamp-3">{post.excerpt}</p>
        )}
        <span className="mt-6 inline-flex items-center gap-2 font-mono text-[11px] tracking-[0.18em] uppercase text-cream">
          Read
          <span className="inline-block transition-transform duration-300 group-hover:translate-x-1">
            →
          </span>
        </span>
      </div>
    </Link>
  )
}

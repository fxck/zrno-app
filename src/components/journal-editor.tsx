import { useEditor, EditorContent, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import Placeholder from '@tiptap/extension-placeholder'
import { useEffect, useRef, useState } from 'react'
import {
  Bold,
  Italic,
  Heading2,
  Heading3,
  Quote,
  List,
  ListOrdered,
  Link2,
  Link2Off,
  ImagePlus,
  Minus,
  Undo2,
  Redo2,
  Loader2,
} from 'lucide-react'
import { uploadImageFile, ACCEPT_IMAGE } from '../lib/upload-client'

// The shared prose stylesheet — the SAME file the published article imports.
// This is what makes the editing canvas a 1:1 preview of the live article.
import '../journal-prose.css'

// NOTE: This component is the only place Tiptap is imported. It never runs on
// the server: `immediatelyRender: false` defers rendering to the client (the
// editor needs the DOM), and no server fn / loader imports this module.

type Props = {
  value: string
  onChange: (html: string) => void
}

function imageFilesFrom(list?: FileList | null): File[] {
  if (!list) return []
  return Array.from(list).filter((f) => f.type.startsWith('image/'))
}

function ToolbarButton({
  onClick,
  active,
  disabled,
  title,
  children,
}: {
  onClick: () => void
  active?: boolean
  disabled?: boolean
  title: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      aria-pressed={active}
      className={[
        'inline-flex h-9 w-9 items-center justify-center transition-colors',
        'disabled:opacity-30 disabled:pointer-events-none',
        active
          ? 'bg-amber text-espresso'
          : 'text-taupe hover:text-cream hover:bg-elevated',
      ].join(' ')}
    >
      {children}
    </button>
  )
}

function Divider() {
  return <span className="mx-1 h-5 w-px self-center bg-muted/25" aria-hidden />
}

function Toolbar({
  editor,
  onPickImage,
  uploading,
}: {
  editor: Editor
  onPickImage: () => void
  uploading: boolean
}) {
  function setLink() {
    const prev = editor.getAttributes('link').href as string | undefined
    const url = window.prompt('Link URL', prev ?? 'https://')
    if (url === null) return
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
      return
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
  }

  return (
    <div className="sticky top-0 z-10 -mx-4 mb-6 flex flex-wrap items-center gap-0.5 border-b border-muted/20 bg-espresso/95 px-4 py-2 backdrop-blur supports-[backdrop-filter]:bg-espresso/80">
      <ToolbarButton
        title="Bold"
        onClick={() => editor.chain().focus().toggleBold().run()}
        active={editor.isActive('bold')}
      >
        <Bold size={16} strokeWidth={2.5} />
      </ToolbarButton>
      <ToolbarButton
        title="Italic"
        onClick={() => editor.chain().focus().toggleItalic().run()}
        active={editor.isActive('italic')}
      >
        <Italic size={16} strokeWidth={2.5} />
      </ToolbarButton>

      <Divider />

      <ToolbarButton
        title="Heading 2"
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        active={editor.isActive('heading', { level: 2 })}
      >
        <Heading2 size={17} strokeWidth={2.25} />
      </ToolbarButton>
      <ToolbarButton
        title="Heading 3"
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        active={editor.isActive('heading', { level: 3 })}
      >
        <Heading3 size={17} strokeWidth={2.25} />
      </ToolbarButton>
      <ToolbarButton
        title="Quote"
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        active={editor.isActive('blockquote')}
      >
        <Quote size={16} strokeWidth={2.25} />
      </ToolbarButton>

      <Divider />

      <ToolbarButton
        title="Bullet list"
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        active={editor.isActive('bulletList')}
      >
        <List size={17} strokeWidth={2.25} />
      </ToolbarButton>
      <ToolbarButton
        title="Numbered list"
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        active={editor.isActive('orderedList')}
      >
        <ListOrdered size={17} strokeWidth={2.25} />
      </ToolbarButton>

      <Divider />

      <ToolbarButton title="Add / edit link" onClick={setLink} active={editor.isActive('link')}>
        <Link2 size={16} strokeWidth={2.25} />
      </ToolbarButton>
      <ToolbarButton
        title="Remove link"
        onClick={() => editor.chain().focus().unsetLink().run()}
        disabled={!editor.isActive('link')}
      >
        <Link2Off size={16} strokeWidth={2.25} />
      </ToolbarButton>
      <ToolbarButton
        title="Upload image (or paste / drop one in)"
        onClick={onPickImage}
        disabled={uploading}
      >
        {uploading ? (
          <Loader2 size={16} strokeWidth={2.25} className="animate-spin text-amber" />
        ) : (
          <ImagePlus size={16} strokeWidth={2.25} />
        )}
      </ToolbarButton>
      <ToolbarButton
        title="Horizontal rule"
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
      >
        <Minus size={16} strokeWidth={2.5} />
      </ToolbarButton>

      <Divider />

      <ToolbarButton
        title="Undo"
        onClick={() => editor.chain().focus().undo().run()}
        disabled={!editor.can().undo()}
      >
        <Undo2 size={16} strokeWidth={2.25} />
      </ToolbarButton>
      <ToolbarButton
        title="Redo"
        onClick={() => editor.chain().focus().redo().run()}
        disabled={!editor.can().redo()}
      >
        <Redo2 size={16} strokeWidth={2.25} />
      </ToolbarButton>
    </div>
  )
}

export default function JournalEditor({ value, onChange }: Props) {
  // Keep a ref to the live editor so the (once-created) paste/drop handlers
  // can always reach the current instance.
  const editorRef = useRef<Editor | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadErr, setUploadErr] = useState('')

  async function uploadAndInsert(file: File, at?: number) {
    const ed = editorRef.current
    if (!ed) return
    setUploadErr('')
    setUploading(true)
    try {
      const url = await uploadImageFile(file, 'body')
      if (typeof at === 'number') {
        ed.chain().focus().insertContentAt(at, { type: 'image', attrs: { src: url } }).run()
      } else {
        ed.chain().focus().setImage({ src: url }).run()
      }
    } catch (err: any) {
      setUploadErr(err?.message || 'Image upload failed.')
    } finally {
      setUploading(false)
    }
  }

  const editor = useEditor({
    // CRITICAL for SSR: do not render the editor on the server (needs the DOM).
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        // Only H2/H3 in the editorial body (H1 is the article title field).
        heading: { levels: [2, 3] },
        // StarterKit v3 bundles Link — configure it here (don't add a 2nd Link).
        link: {
          openOnClick: false,
          autolink: true,
          HTMLAttributes: { rel: 'noopener noreferrer nofollow', target: '_blank' },
        },
      }),
      Image.configure({ inline: false, HTMLAttributes: { loading: 'lazy' } }),
      Placeholder.configure({
        placeholder: 'Tell the story… (paste or drop an image to upload it)',
      }),
    ],
    content: value,
    editorProps: {
      attributes: {
        // SAME class as the published article — 1:1 typography while editing.
        class: 'prose-article focus:outline-none',
      },
      // Medium-style: paste an image from the clipboard → upload + insert.
      handlePaste: (_view, event) => {
        const files = imageFilesFrom((event as ClipboardEvent).clipboardData?.files)
        if (!files.length) return false
        event.preventDefault()
        files.forEach((f) => uploadAndInsert(f))
        return true
      },
      // …or drag an image file straight onto the canvas.
      handleDrop: (view, event) => {
        const e = event as DragEvent
        const files = imageFilesFrom(e.dataTransfer?.files)
        if (!files.length) return false
        event.preventDefault()
        const at = view.posAtCoords({ left: e.clientX, top: e.clientY })?.pos
        files.forEach((f) => uploadAndInsert(f, at))
        return true
      },
    },
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  })

  editorRef.current = editor

  // Keep the editor in sync if the bound value is replaced externally
  // (e.g. when an edit-form loads its post after mount).
  useEffect(() => {
    if (!editor) return
    const current = editor.getHTML()
    if (value !== current && value !== undefined) {
      editor.commands.setContent(value || '', { emitUpdate: false })
    }
    // Only re-sync on external value changes, not on every editor identity tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, editor])

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-picking the same file
    if (file) await uploadAndInsert(file)
  }

  return (
    <div className="w-full">
      <input
        ref={fileRef}
        type="file"
        accept={ACCEPT_IMAGE}
        className="hidden"
        onChange={onFileChange}
      />
      {editor && (
        <Toolbar
          editor={editor}
          uploading={uploading}
          onPickImage={() => fileRef.current?.click()}
        />
      )}
      {uploadErr && (
        <p className="mb-3 text-sm text-red-400 max-w-[680px] mx-auto">{uploadErr}</p>
      )}
      <EditorContent editor={editor} />
    </div>
  )
}

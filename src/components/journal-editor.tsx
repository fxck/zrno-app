import { useEditor, EditorContent, type Editor } from '@tiptap/react'
import { BubbleMenu, FloatingMenu } from '@tiptap/react/menus'
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
  Loader2,
} from 'lucide-react'
import { uploadImageFile, ACCEPT_IMAGE } from '../lib/upload-client'

// The shared prose stylesheet — the SAME file the published article imports.
import '../journal-prose.css'

// Tiptap is imported ONLY here. `immediatelyRender: false` keeps it off the
// server, and no loader/server fn imports this module.

type Props = {
  value: string
  onChange: (html: string) => void
}

function imageFilesFrom(list?: FileList | null): File[] {
  if (!list) return []
  return Array.from(list).filter((f) => f.type.startsWith('image/'))
}

function MenuButton({
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
        'inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors',
        'disabled:opacity-30 disabled:pointer-events-none',
        active ? 'bg-amber text-espresso' : 'text-cream/80 hover:bg-surface hover:text-cream',
      ].join(' ')}
    >
      {children}
    </button>
  )
}

function Divider() {
  return <span className="mx-0.5 h-5 w-px self-center bg-muted/30" aria-hidden />
}

const BAR =
  'flex items-center gap-0.5 rounded-xl border border-muted/25 bg-elevated/95 p-1 shadow-[0_14px_40px_-12px_rgba(0,0,0,0.85)] backdrop-blur-md'

export default function JournalEditor({ value, onChange }: Props) {
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
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        link: {
          openOnClick: false,
          autolink: true,
          HTMLAttributes: { rel: 'noopener noreferrer nofollow', target: '_blank' },
        },
      }),
      Image.configure({ inline: false, HTMLAttributes: { loading: 'lazy' } }),
      Placeholder.configure({
        placeholder: 'Tell the story… select text to format, or use + on an empty line to add an image.',
      }),
    ],
    content: value,
    editorProps: {
      attributes: { class: 'prose-article focus:outline-none' },
      // Medium-style: paste an image → upload + insert.
      handlePaste: (_view, event) => {
        const files = imageFilesFrom((event as ClipboardEvent).clipboardData?.files)
        if (!files.length) return false
        event.preventDefault()
        files.forEach((f) => uploadAndInsert(f))
        return true
      },
      // …or drop an image file onto the canvas.
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

  useEffect(() => {
    if (!editor) return
    const current = editor.getHTML()
    if (value !== current && value !== undefined) {
      editor.commands.setContent(value || '', { emitUpdate: false })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, editor])

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (file) await uploadAndInsert(file)
  }

  function setLink() {
    if (!editor) return
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
    <div className="relative w-full">
      <input
        ref={fileRef}
        type="file"
        accept={ACCEPT_IMAGE}
        className="hidden"
        onChange={onFileChange}
      />

      {/* Pops above a text selection — inline + block formatting. */}
      {editor && (
        <BubbleMenu editor={editor} className={BAR} options={{ placement: 'top' }}>
          <MenuButton
            title="Bold"
            onClick={() => editor.chain().focus().toggleBold().run()}
            active={editor.isActive('bold')}
          >
            <Bold size={15} strokeWidth={2.5} />
          </MenuButton>
          <MenuButton
            title="Italic"
            onClick={() => editor.chain().focus().toggleItalic().run()}
            active={editor.isActive('italic')}
          >
            <Italic size={15} strokeWidth={2.5} />
          </MenuButton>
          <Divider />
          <MenuButton
            title="Heading 2"
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            active={editor.isActive('heading', { level: 2 })}
          >
            <Heading2 size={16} strokeWidth={2.25} />
          </MenuButton>
          <MenuButton
            title="Heading 3"
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            active={editor.isActive('heading', { level: 3 })}
          >
            <Heading3 size={16} strokeWidth={2.25} />
          </MenuButton>
          <MenuButton
            title="Quote"
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            active={editor.isActive('blockquote')}
          >
            <Quote size={15} strokeWidth={2.25} />
          </MenuButton>
          <Divider />
          <MenuButton title="Add / edit link" onClick={setLink} active={editor.isActive('link')}>
            <Link2 size={15} strokeWidth={2.25} />
          </MenuButton>
          <MenuButton
            title="Remove link"
            onClick={() => editor.chain().focus().unsetLink().run()}
            disabled={!editor.isActive('link')}
          >
            <Link2Off size={15} strokeWidth={2.25} />
          </MenuButton>
        </BubbleMenu>
      )}

      {/* Appears at the start of an empty line — insert blocks & images. */}
      {editor && (
        <FloatingMenu editor={editor} className={BAR} options={{ placement: 'bottom-start' }}>
          <MenuButton
            title="Upload image"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? (
              <Loader2 size={15} strokeWidth={2.25} className="animate-spin text-amber" />
            ) : (
              <ImagePlus size={15} strokeWidth={2.25} />
            )}
          </MenuButton>
          <Divider />
          <MenuButton
            title="Heading 2"
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            active={editor.isActive('heading', { level: 2 })}
          >
            <Heading2 size={16} strokeWidth={2.25} />
          </MenuButton>
          <MenuButton
            title="Heading 3"
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            active={editor.isActive('heading', { level: 3 })}
          >
            <Heading3 size={16} strokeWidth={2.25} />
          </MenuButton>
          <MenuButton
            title="Quote"
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            active={editor.isActive('blockquote')}
          >
            <Quote size={15} strokeWidth={2.25} />
          </MenuButton>
          <MenuButton
            title="Bullet list"
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            active={editor.isActive('bulletList')}
          >
            <List size={16} strokeWidth={2.25} />
          </MenuButton>
          <MenuButton
            title="Numbered list"
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            active={editor.isActive('orderedList')}
          >
            <ListOrdered size={16} strokeWidth={2.25} />
          </MenuButton>
          <MenuButton
            title="Divider"
            onClick={() => editor.chain().focus().setHorizontalRule().run()}
          >
            <Minus size={16} strokeWidth={2.5} />
          </MenuButton>
        </FloatingMenu>
      )}

      {uploadErr && (
        <p className="mb-3 max-w-[680px] mx-auto text-sm text-red-400">{uploadErr}</p>
      )}
      <EditorContent editor={editor} />
    </div>
  )
}

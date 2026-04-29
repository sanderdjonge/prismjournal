'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import { useEffect } from 'react'
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  List,
  ListOrdered,
  Heading2,
  Quote,
  Code,
  Minus,
} from 'lucide-react'
import { cn } from '@/lib/cn'

interface RichTextEditorProps {
  value: string
  onChange: (html: string) => void
  compact?: boolean
  placeholder?: string
}

function Toolbar({ editor }: { editor: ReturnType<typeof useEditor> }) {
  if (!editor) return null

  const tools: {
    icon: React.ReactNode
    action: () => void
    isActive: boolean
    label: string
  }[] = [
    {
      icon: <Bold size={13} />,
      action: () => editor.chain().focus().toggleBold().run(),
      isActive: editor.isActive('bold'),
      label: 'Bold',
    },
    {
      icon: <Italic size={13} />,
      action: () => editor.chain().focus().toggleItalic().run(),
      isActive: editor.isActive('italic'),
      label: 'Italic',
    },
    {
      icon: <UnderlineIcon size={13} />,
      action: () => editor.chain().focus().toggleUnderline().run(),
      isActive: editor.isActive('underline'),
      label: 'Underline',
    },
    {
      icon: <Heading2 size={13} />,
      action: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
      isActive: editor.isActive('heading', { level: 2 }),
      label: 'Heading',
    },
    {
      icon: <List size={13} />,
      action: () => editor.chain().focus().toggleBulletList().run(),
      isActive: editor.isActive('bulletList'),
      label: 'Bullet List',
    },
    {
      icon: <ListOrdered size={13} />,
      action: () => editor.chain().focus().toggleOrderedList().run(),
      isActive: editor.isActive('orderedList'),
      label: 'Ordered List',
    },
    {
      icon: <Quote size={13} />,
      action: () => editor.chain().focus().toggleBlockquote().run(),
      isActive: editor.isActive('blockquote'),
      label: 'Blockquote',
    },
    {
      icon: <Code size={13} />,
      action: () => editor.chain().focus().toggleCodeBlock().run(),
      isActive: editor.isActive('codeBlock'),
      label: 'Code Block',
    },
    {
      icon: <Minus size={13} />,
      action: () => editor.chain().focus().setHorizontalRule().run(),
      isActive: false,
      label: 'Horizontal Rule',
    },
  ]

  return (
    <div className="flex flex-wrap gap-0.5 p-1.5 border-b border-border-subtle">
      {tools.map(tool => (
        <button
          key={tool.label}
          type="button"
          onClick={tool.action}
          className={cn(
            'p-1.5 rounded-md transition-colors text-text-muted hover:text-text-primary hover:bg-surface-hover',
            tool.isActive && 'bg-surface-hover text-primary',
          )}
          title={tool.label}
        >
          {tool.icon}
        </button>
      ))}
    </div>
  )
}

export function RichTextEditor({ value, onChange, compact = false, placeholder }: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [StarterKit, Underline],
    content: value || '',
    editable: !compact,
    onUpdate: ({ editor: ed }) => {
      onChange(ed.getHTML())
    },
    editorProps: {
      attributes: {
        class: 'prose prose-invert prose-sm max-w-none focus:outline-none p-3 min-h-[80px] text-text-secondary',
      },
    },
  })

  useEffect(() => {
    if (editor && !editor.isFocused && value !== editor.getHTML()) {
      editor.commands.setContent(value || '', { emitUpdate: false })
    }
  }, [value, editor])

  if (compact) {
    if (!value) return null
    return (
      <div
        className="prose prose-invert prose-sm max-w-none text-text-secondary [&_p]:my-1 [&_h2]:text-base [&_h2]:font-bold [&_ul]:my-1 [&_ol]:my-1 [&_blockquote]:border-l-2 [&_blockquote]:border-border-subtle [&_blockquote]:pl-3 [&_blockquote]:text-text-muted [&_pre]:bg-surface-elevated [&_pre]:rounded [&_pre]:p-2"
        dangerouslySetInnerHTML={{ __html: value }}
      />
    )
  }

  return (
    <div className="border border-border-subtle rounded-xl bg-surface-elevated overflow-hidden">
      <Toolbar editor={editor} />
      <EditorContent
        editor={editor}
        placeholder={placeholder}
      />
      {!value && placeholder && (
        <div className="px-3 -mt-[56px] pt-3 text-text-muted text-sm pointer-events-none">
          {placeholder}
        </div>
      )}
    </div>
  )
}

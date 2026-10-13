import React from 'react'
import type { Editor } from '@tiptap/react'
import {
  Bold,
  Italic,
  Strikethrough,
  Code,
  List,
  ListOrdered,
  Quote,
  Undo2,
  Redo2,
  Heading1,
  Heading2,
  Heading3,
  Pilcrow,
  FileCode,
  Minus,
  RemoveFormatting
} from 'lucide-react'
import { cn } from '@/utils/cn'

interface ToolbarProps {
  editor: Editor | null
  readOnly?: boolean
}

interface ToolbarButtonProps {
  onClick: () => void
  active?: boolean
  disabled?: boolean
  title: string
  children: React.ReactNode
}

const ToolbarButton: React.FC<ToolbarButtonProps> = ({
  onClick,
  active,
  disabled,
  title,
  children
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    title={title}
    aria-label={title}
    className={cn(
      'p-1.5 rounded-md text-gray-700 hover:bg-gray-200 transition-colors focus:outline-none disabled:opacity-30 disabled:pointer-events-none',
      active && 'bg-blue-100 text-blue-700 hover:bg-blue-200'
    )}
  >
    {children}
  </button>
)

export const Toolbar: React.FC<ToolbarProps> = ({ editor, readOnly = false }) => {
  if (!editor || readOnly) {
    if (readOnly) {
      return (
        <div className="bg-[#f0f4f9] border-y border-gray-200 px-4 py-2 text-xs text-gray-600 flex items-center justify-between">
          <span className="font-medium">Viewing mode &bull; You have read-only access to this document</span>
          <span className="bg-gray-200 text-gray-700 px-2 py-0.5 rounded text-xs">Viewer</span>
        </div>
      )
    }
    return null
  }

  return (
    <div className="bg-[#edf2fa] border-y border-gray-200 px-2 sm:px-4 py-1.5 flex flex-nowrap sm:flex-wrap overflow-x-auto items-center gap-1 select-none sticky top-0 z-20">
      {/* Undo / Redo */}
      <ToolbarButton
        onClick={() => editor.chain().focus().undo().run()}
        disabled={!editor.can().undo()}
        title="Undo (Ctrl+Z)"
      >
        <Undo2 className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().redo().run()}
        disabled={!editor.can().redo()}
        title="Redo (Ctrl+Y)"
      >
        <Redo2 className="w-4 h-4" />
      </ToolbarButton>

      <div className="w-px h-5 bg-gray-300 mx-1" />

      {/* Paragraph & Headings */}
      <ToolbarButton
        onClick={() => editor.chain().focus().setParagraph().run()}
        active={editor.isActive('paragraph')}
        title="Normal text"
      >
        <Pilcrow className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        active={editor.isActive('heading', { level: 1 })}
        title="Heading 1"
      >
        <Heading1 className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        active={editor.isActive('heading', { level: 2 })}
        title="Heading 2"
      >
        <Heading2 className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        active={editor.isActive('heading', { level: 3 })}
        title="Heading 3"
      >
        <Heading3 className="w-4 h-4" />
      </ToolbarButton>

      <div className="w-px h-5 bg-gray-300 mx-1" />

      {/* Formatting */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBold().run()}
        active={editor.isActive('bold')}
        title="Bold (Ctrl+B)"
      >
        <Bold className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleItalic().run()}
        active={editor.isActive('italic')}
        title="Italic (Ctrl+I)"
      >
        <Italic className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleStrike().run()}
        active={editor.isActive('strike')}
        title="Strikethrough"
      >
        <Strikethrough className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleCode().run()}
        active={editor.isActive('code')}
        title="Inline code"
      >
        <Code className="w-4 h-4" />
      </ToolbarButton>

      <div className="w-px h-5 bg-gray-300 mx-1" />

      {/* Lists & Quotes */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        active={editor.isActive('bulletList')}
        title="Bulleted list"
      >
        <List className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        active={editor.isActive('orderedList')}
        title="Numbered list"
      >
        <ListOrdered className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        active={editor.isActive('blockquote')}
        title="Blockquote"
      >
        <Quote className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        active={editor.isActive('codeBlock')}
        title="Code block"
      >
        <FileCode className="w-4 h-4" />
      </ToolbarButton>

      <div className="w-px h-5 bg-gray-300 mx-1" />

      {/* Horizontal Rule & Clear Formatting */}
      <ToolbarButton
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
        title="Horizontal rule"
      >
        <Minus className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
        title="Clear formatting"
      >
        <RemoveFormatting className="w-4 h-4" />
      </ToolbarButton>
    </div>
  )
}

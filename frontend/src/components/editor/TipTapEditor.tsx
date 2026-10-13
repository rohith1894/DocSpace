import React, { useEffect, useRef } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import CharacterCount from '@tiptap/extension-character-count'
import { Toolbar } from './Toolbar'

export interface RemoteContentUpdate {
  content: string
  revision: number
}

interface TipTapEditorProps {
  initialContent?: string
  remoteUpdate?: RemoteContentUpdate | null
  readOnly?: boolean
  onContentChange?: (htmlContent: string) => void
}

export const TipTapEditor: React.FC<TipTapEditorProps> = ({
  initialContent = '',
  remoteUpdate,
  readOnly = false,
  onContentChange
}) => {
  const isApplyingRemoteRef = useRef(false)
  const onContentChangeRef = useRef(onContentChange)
  onContentChangeRef.current = onContentChange

  const readOnlyRef = useRef(readOnly)
  readOnlyRef.current = readOnly

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3]
        }
      }),
      Placeholder.configure({
        placeholder: 'Start writing your document or paste text...'
      }),
      CharacterCount.configure()
    ],
    content: initialContent,
    editable: !readOnly,
    editorProps: {
      attributes: {
        class: 'tiptap focus:outline-none min-h-[850px] text-gray-900 leading-relaxed text-base'
      }
    },
    onUpdate: ({ editor }) => {
      // Do not broadcast local updates if this change was triggered by remote incoming packet
      if (readOnlyRef.current || !onContentChangeRef.current || isApplyingRemoteRef.current) return
      onContentChangeRef.current(editor.getHTML())
    }
  })

  // Synchronize remote peer updates with cursor position preservation
  useEffect(() => {
    if (!editor || !remoteUpdate) return

    const currentHTML = editor.getHTML()
    if (currentHTML === remoteUpdate.content) return

    isApplyingRemoteRef.current = true
    try {
      const isFocused = editor.isFocused
      const { from, to } = editor.state.selection

      editor.commands.setContent(remoteUpdate.content, false)

      const docSize = editor.state.doc.content.size
      if (isFocused) {
        // If the user was typing, restore cursor and maintain mobile keyboard focus
        const safeFrom = Math.min(from, Math.max(0, docSize - 1))
        const safeTo = Math.min(to, Math.max(0, docSize - 1))
        editor.commands.setTextSelection({ from: safeFrom, to: safeTo })
        editor.commands.focus()
      } else {
        // If not actively focused, move cursor to the end
        editor.commands.setTextSelection(Math.max(0, docSize - 1))
      }
    } catch {
      // ignore selection recovery failures
    } finally {
      // Synchronously release remote lock so local keystrokes are never dropped
      isApplyingRemoteRef.current = false
    }
  }, [editor, remoteUpdate])

  // Synchronize initialContent if document was loaded asynchronously
  useEffect(() => {
    if (editor && initialContent && editor.isEmpty && initialContent.trim() !== '<p></p>') {
      editor.commands.setContent(initialContent, false)
    }
  }, [editor, initialContent])

  // Synchronize readOnly mode changes
  useEffect(() => {
    if (editor && editor.isEditable === readOnly) {
      editor.setEditable(!readOnly)
    }
  }, [editor, readOnly])

  const words = editor?.storage.characterCount?.words() ?? 0
  const characters = editor?.storage.characterCount?.characters() ?? 0

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-[#f8fafd]">
      {/* Google Docs formatting toolbar */}
      <Toolbar editor={editor} readOnly={readOnly} />

      {/* Scrollable canvas area */}
      <div className="flex-1 overflow-y-auto px-4 py-8 flex flex-col items-center">
        <div className="w-full max-w-[850px] bg-white min-h-[1100px] shadow-sm border border-gray-200/80 rounded-sm px-16 py-14 flex flex-col">
          <EditorContent editor={editor} className="flex-1 focus:outline-none" />
        </div>

        {/* Word / Character count indicator footer */}
        <div className="w-full max-w-[850px] mt-3 px-2 flex justify-end text-xs text-gray-600 space-x-4">
          <span>{words} words</span>
          <span>{characters} characters</span>
        </div>
      </div>
    </div>
  )
}

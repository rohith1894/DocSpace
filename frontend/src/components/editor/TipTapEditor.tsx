import React, { useEffect, useRef } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Collaboration from '@tiptap/extension-collaboration'
import Placeholder from '@tiptap/extension-placeholder'
import CharacterCount from '@tiptap/extension-character-count'
import type * as Y from 'yjs'
import { Toolbar } from './Toolbar'

interface TipTapEditorProps {
  ydoc: Y.Doc
  initialContent?: string
  readOnly?: boolean
  onContentChange?: (htmlContent: string) => void
}

export const TipTapEditor: React.FC<TipTapEditorProps> = ({
  ydoc,
  initialContent = '',
  readOnly = false,
  onContentChange
}) => {
  const debounceTimerRef = useRef<number | null>(null)
  const isInitializedRef = useRef(false)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        history: false, // Managed by Yjs CRDT
        heading: {
          levels: [1, 2, 3]
        }
      }),
      Collaboration.configure({
        document: ydoc
      }),
      Placeholder.configure({
        placeholder: 'Start writing your document or paste text...'
      }),
      CharacterCount.configure()
    ],
    editable: !readOnly,
    editorProps: {
      attributes: {
        class: 'tiptap focus:outline-none min-h-[850px] text-gray-900 leading-relaxed text-base'
      }
    },
    onUpdate: ({ editor }) => {
      if (readOnly || !onContentChange) return

      // Debounce saving full HTML snapshots to Postgres
      if (debounceTimerRef.current) {
        window.clearTimeout(debounceTimerRef.current)
      }
      debounceTimerRef.current = window.setTimeout(() => {
        onContentChange(editor.getHTML())
      }, 1500)
    }
  })

  // Initialize document content from database if ydoc is empty
  useEffect(() => {
    if (editor && !isInitializedRef.current && initialContent) {
      isInitializedRef.current = true
      const fragment = ydoc.getXmlFragment('default')
      if (fragment.length === 0 && initialContent.trim() !== '<p></p>' && initialContent.trim() !== '') {
        editor.commands.setContent(initialContent, false)
      }
    }
  }, [editor, ydoc, initialContent])

  // Synchronize readOnly mode changes
  useEffect(() => {
    if (editor && editor.isEditable === readOnly) {
      editor.setEditable(!readOnly)
    }
  }, [editor, readOnly])

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        window.clearTimeout(debounceTimerRef.current)
      }
    }
  }, [])

  const words = editor?.storage.characterCount?.words() ?? 0
  const characters = editor?.storage.characterCount?.characters() ?? 0

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-[#f8fafd]">
      {/* Google Docs formatting toolbar */}
      <Toolbar editor={editor} readOnly={readOnly} />

      {/* Scrollable canvas area */}
      <div className="flex-1 overflow-y-auto px-4 py-8 flex flex-col items-center">
        {/* Realistic Google Docs Paper Sheet */}
        <div className="w-full max-w-[850px] min-h-[1100px] bg-white rounded-xs shadow-[0_1px_3px_1px_rgba(60,64,67,0.15)] border border-gray-200/80 px-16 py-16 transition-shadow focus-within:shadow-[0_2px_6px_2px_rgba(60,64,67,0.18)]">
          <EditorContent editor={editor} />
        </div>

        {/* Document Stats Footer */}
        <div className="w-full max-w-[850px] flex justify-between items-center py-4 text-xs text-gray-400 select-none">
          <span>{words} words &bull; {characters} characters</span>
          <span>DocSpace Editor v1.0</span>
        </div>
      </div>
    </div>
  )
}

import React, { useEffect, useRef } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import CharacterCount from '@tiptap/extension-character-count'
import { Toolbar } from './Toolbar'

interface TipTapEditorProps {
  initialContent?: string
  readOnly?: boolean
  onContentChange?: (htmlContent: string) => void
}

export const TipTapEditor: React.FC<TipTapEditorProps> = ({
  initialContent = '',
  readOnly = false,
  onContentChange
}) => {
  const debounceTimerRef = useRef<number | null>(null)

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
      if (readOnly || !onContentChange) return

      // Debounce autosave triggers by 600ms (reduces excessive writes)
      if (debounceTimerRef.current) {
        window.clearTimeout(debounceTimerRef.current)
      }
      debounceTimerRef.current = window.setTimeout(() => {
        onContentChange(editor.getHTML())
      }, 600)
    }
  })

  // Synchronize readOnly mode changes
  useEffect(() => {
    if (editor && editor.isEditable === readOnly) {
      editor.setEditable(!readOnly)
    }
  }, [editor, readOnly])

  // Synchronize external / collaborative updates when content changes remotely
  useEffect(() => {
    if (editor && initialContent !== undefined) {
      const currentHTML = editor.getHTML()
      if (currentHTML !== initialContent && !editor.isFocused) {
        editor.commands.setContent(initialContent, { emitUpdate: false })
      }
    }
  }, [editor, initialContent])

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

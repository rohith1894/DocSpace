import React, { useEffect, useRef } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import CharacterCount from '@tiptap/extension-character-count'
import Collaboration from '@tiptap/extension-collaboration'
import { ySyncPluginKey } from 'y-prosemirror'
import type * as Y from 'yjs'
import { Toolbar } from './Toolbar'

interface TipTapEditorProps {
  ydoc: Y.Doc
  editable: boolean
  /** Legacy HTML to load into the empty shared document; consumed once. */
  seedHtml?: string | null
  onSeeded?: () => void
  /** Called with the rendered HTML after edits made on this device. */
  onLocalChange?: (html: string) => void
}

export const TipTapEditor: React.FC<TipTapEditorProps> = ({ ydoc, editable, seedHtml, onSeeded, onLocalChange }) => {
  const onLocalChangeRef = useRef(onLocalChange)
  useEffect(() => {
    onLocalChangeRef.current = onLocalChange
  }, [onLocalChange])

  const editor = useEditor(
    {
      extensions: [
        // Collaboration ships its own CRDT-aware undo history.
        StarterKit.configure({ history: false, heading: { levels: [1, 2, 3] } }),
        Collaboration.configure({ document: ydoc }),
        Placeholder.configure({ placeholder: 'Start writing your document...' }),
        CharacterCount.configure()
      ],
      editable,
      editorProps: {
        attributes: {
          class: 'tiptap focus:outline-none min-h-[60vh] text-gray-900 leading-relaxed text-base',
          'data-testid': 'editor'
        }
      },
      onUpdate: ({ editor, transaction }) => {
        if (transaction.getMeta(ySyncPluginKey)?.isChangeOrigin) return // edit came from a peer
        onLocalChangeRef.current?.(editor.getHTML())
      }
    },
    [ydoc]
  )

  useEffect(() => {
    if (editor && editor.isEditable !== editable) {
      editor.setEditable(editable)
    }
  }, [editor, editable])

  useEffect(() => {
    if (!editor || seedHtml == null) return
    if (editor.isEmpty && seedHtml.trim() && seedHtml.trim() !== '<p></p>') {
      editor.commands.setContent(seedHtml)
    }
    onSeeded?.()
  }, [editor, seedHtml, onSeeded])

  const words = editor?.storage.characterCount?.words() ?? 0
  const characters = editor?.storage.characterCount?.characters() ?? 0

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-[#f8fafd]">
      <Toolbar editor={editor} readOnly={!editable} />

      <div className="flex-1 overflow-y-auto sm:px-4 sm:py-8 flex flex-col items-center">
        <div className="w-full max-w-[850px] bg-white sm:min-h-[1100px] sm:shadow-sm sm:border border-gray-200/80 sm:rounded-sm px-5 py-6 sm:px-16 sm:py-14 flex flex-col flex-1 sm:flex-none">
          <EditorContent editor={editor} className="flex-1" />
        </div>

        <div className="w-full max-w-[850px] my-3 px-4 sm:px-2 flex justify-end text-xs text-gray-600 space-x-4">
          <span>{words} words</span>
          <span>{characters} characters</span>
        </div>
      </div>
    </div>
  )
}

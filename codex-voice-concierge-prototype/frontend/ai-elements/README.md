# AI Elements

Source: official AI Elements registry, retrieved November 10, 2026:

- https://elements.ai-sdk.dev/api/registry/conversation.json
- https://elements.ai-sdk.dev/api/registry/message.json

Licensed under Apache-2.0; see LICENSE.

These are the registry's Conversation, ConversationContent, Message, MessageContent,
and memoized MessageResponse exports. Imports use local utilities. Unused actions,
branching controls, downloads, and optional syntax/math/Mermaid/CJK plugins are omitted.
MessageResponse uses Streamdown's default streaming Markdown support. The UIMessage
role type is declared locally to avoid adding the AI SDK solely for a type.

The application supplies speaker labels, theme classes, frame-batched transcript
updates, and a scroll-to-latest button using use-stick-to-bottom's context.

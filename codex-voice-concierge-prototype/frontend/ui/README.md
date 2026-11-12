Command and Popover are vendored from the official shadcn/ui new-york registry, retrieved November 10, 2026:

- https://ui.shadcn.com/r/styles/new-york/command.json
- https://ui.shadcn.com/r/styles/new-york/popover.json

Local adaptations: relative utility imports, omitted unused CommandDialog wrapper, and scoped CSS in ../chat-picker.css. The Vite frontend now also compiles Tailwind for the AI Elements transcript. The combobox follows the shadcn Popover + Command composition and retains Radix/cmdk focus, keyboard navigation, filtering, and dismissal behavior.

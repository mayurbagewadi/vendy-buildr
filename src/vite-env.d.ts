/// <reference types="vite/client" />

// Custom element definitions for third-party widgets
declare namespace JSX {
  interface IntrinsicElements {
    'elevenlabs-convai': React.DetailedHTMLProps<
      React.HTMLAttributes<HTMLElement> & {
        'agent-id'?: string;
      },
      HTMLElement
    >;
  }
}

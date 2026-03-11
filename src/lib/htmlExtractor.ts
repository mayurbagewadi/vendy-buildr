/**
 * HTML Structure Extraction for AI Designer Layer 2
 * Extracts clean, sanitized HTML from store preview iframe for AI analysis
 */

export interface ExtractedHTML {
  html: string;
  structure: HTMLStructureNode[];
  classes: string[];
  elements: {
    headers: number;
    sections: number;
    products: number;
    buttons: number;
    images: number;
  };
}

export interface HTMLStructureNode {
  tag: string;
  classes: string[];
  children: HTMLStructureNode[];
  attributes?: Record<string, string>;
}

/**
 * Extract HTML structure from iframe for AI analysis
 * @param iframe - The iframe element containing the store preview
 * @returns Extracted and sanitized HTML structure
 */
export function extractHTMLFromIframe(iframe: HTMLIFrameElement): ExtractedHTML | null {
  try {
    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc || !doc.body) {
      console.warn('[HTML-EXTRACTOR] Cannot access iframe document');
      return null;
    }

    // Clone body to avoid modifying live DOM
    const bodyClone = doc.body.cloneNode(true) as HTMLElement;

    // Sanitize: Remove scripts, styles, and sensitive content
    sanitizeHTML(bodyClone);

    // Extract structure
    const structure = buildStructureTree(bodyClone);

    // Extract all unique classes
    const classes = extractUniqueClasses(bodyClone);

    // Count element types
    const elements = countElements(bodyClone);

    // Get cleaned HTML string (compact)
    const html = bodyClone.outerHTML;

    console.log('[HTML-EXTRACTOR] Extracted:', {
      htmlLength: html.length,
      classesCount: classes.length,
      elements,
    });

    return {
      html,
      structure,
      classes,
      elements,
    };
  } catch (error) {
    console.error('[HTML-EXTRACTOR] Error extracting HTML:', error);
    return null;
  }
}

/**
 * Sanitize HTML by removing scripts, styles, and sensitive data
 */
function sanitizeHTML(element: HTMLElement): void {
  // Remove script tags
  element.querySelectorAll('script').forEach(el => el.remove());

  // Remove style tags (we only want structure, not inline styles)
  element.querySelectorAll('style').forEach(el => el.remove());

  // Remove comments
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_COMMENT);
  const comments: Node[] = [];
  let node;
  while ((node = walker.nextNode())) {
    comments.push(node);
  }
  comments.forEach(comment => comment.remove());

  // Remove sensitive attributes
  const sensitiveAttrs = ['onclick', 'onload', 'onerror', 'onmouseover', 'href', 'src'];
  element.querySelectorAll('*').forEach(el => {
    sensitiveAttrs.forEach(attr => {
      if (el.hasAttribute(attr)) {
        // Keep data-* attributes and class/id
        if (!attr.startsWith('data-')) {
          el.removeAttribute(attr);
        }
      }
    });

    // Remove inline styles (we only want structure)
    el.removeAttribute('style');
  });

  // Remove empty text nodes
  element.querySelectorAll('*').forEach(el => {
    Array.from(el.childNodes).forEach(child => {
      if (child.nodeType === Node.TEXT_NODE && !child.textContent?.trim()) {
        child.remove();
      }
    });
  });
}

/**
 * Build hierarchical structure tree from HTML
 */
function buildStructureTree(element: HTMLElement, maxDepth = 5, currentDepth = 0): HTMLStructureNode[] {
  if (currentDepth >= maxDepth) return [];

  const nodes: HTMLStructureNode[] = [];

  Array.from(element.children).forEach(child => {
    if (!(child instanceof HTMLElement)) return;

    const node: HTMLStructureNode = {
      tag: child.tagName.toLowerCase(),
      classes: Array.from(child.classList),
      children: buildStructureTree(child, maxDepth, currentDepth + 1),
    };

    // Include data-* attributes (useful for component identification)
    const dataAttrs: Record<string, string> = {};
    Array.from(child.attributes).forEach(attr => {
      if (attr.name.startsWith('data-')) {
        dataAttrs[attr.name] = attr.value;
      }
    });
    if (Object.keys(dataAttrs).length > 0) {
      node.attributes = dataAttrs;
    }

    nodes.push(node);
  });

  return nodes;
}

/**
 * Extract all unique CSS classes from HTML
 */
function extractUniqueClasses(element: HTMLElement): string[] {
  const classes = new Set<string>();

  element.querySelectorAll('*').forEach(el => {
    el.classList.forEach(cls => {
      // Filter out dynamic/generated classes
      if (!cls.match(/^(active|selected|open|closed|hidden|visible)$/i)) {
        classes.add(cls);
      }
    });
  });

  return Array.from(classes).sort();
}

/**
 * Count different element types for AI context
 */
function countElements(element: HTMLElement): ExtractedHTML['elements'] {
  return {
    headers: element.querySelectorAll('header, [data-ai="header"]').length,
    sections: element.querySelectorAll('section, [data-ai="hero"], [data-ai="products"], [data-ai="categories"]').length,
    products: element.querySelectorAll('[data-ai="product-card"], .product-card').length,
    buttons: element.querySelectorAll('button, [role="button"]').length,
    images: element.querySelectorAll('img').length,
  };
}

/**
 * Compress HTML for token efficiency
 * Removes whitespace, comments, and redundant attributes
 */
export function compressHTML(html: string): string {
  return html
    .replace(/\s+/g, ' ') // Collapse whitespace
    .replace(/>\s+</g, '><') // Remove space between tags
    .replace(/<!--.*?-->/g, '') // Remove comments
    .trim();
}

/**
 * Build compact HTML summary for AI (token-efficient)
 */
export function buildHTMLSummary(extracted: ExtractedHTML): string {
  const { elements, classes } = extracted;

  // Sample important classes (limit to 50 for token efficiency)
  const importantClasses = classes
    .filter(cls =>
      cls.includes('product') ||
      cls.includes('card') ||
      cls.includes('button') ||
      cls.includes('header') ||
      cls.includes('hero') ||
      cls.includes('grid') ||
      cls.includes('rounded') ||
      cls.includes('bg-') ||
      cls.includes('p-') ||
      cls.includes('shadow')
    )
    .slice(0, 50);

  return `HTML Structure Summary:
Elements: ${elements.headers} headers, ${elements.sections} sections, ${elements.products} products, ${elements.buttons} buttons, ${elements.images} images
Key Classes: ${importantClasses.join(', ')}
Total Classes: ${classes.length}`;
}

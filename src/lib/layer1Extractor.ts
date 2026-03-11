/**
 * Layer 1 (Baseline CSS) Extraction for AI Designer
 * Extracts current computed styles, CSS variables, and Tailwind classes
 * This becomes the "before" state that AI compares against when generating Layer 2
 */

export interface Layer1Snapshot {
  cssVariables: Record<string, string>;
  computedStyles: Record<string, ComputedStyle>;
  tailwindClasses: Record<string, string[]>;
  metadata: {
    extractedAt: string;
    elementCount: number;
    variableCount: number;
  };
}

export interface ComputedStyle {
  selector: string;
  styles: {
    'border-radius'?: string;
    'background'?: string;
    'background-color'?: string;
    'padding'?: string;
    'margin'?: string;
    'box-shadow'?: string;
    'color'?: string;
    'font-size'?: string;
    'font-weight'?: string;
    'font-family'?: string;
  };
}

/**
 * Extract Layer 1 baseline from iframe
 * @param iframe - The iframe containing the store preview
 * @returns Layer 1 snapshot with current styles
 */
export function extractLayer1Baseline(iframe: HTMLIFrameElement): Layer1Snapshot | null {
  try {
    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) {
      console.warn('[LAYER1] Cannot access iframe document');
      return null;
    }

    // Extract CSS variables from :root
    const cssVariables = extractCSSVariables(doc);

    // Extract computed styles for key elements
    const computedStyles = extractComputedStyles(doc);

    // Extract Tailwind classes
    const tailwindClasses = extractTailwindClasses(doc);

    const snapshot: Layer1Snapshot = {
      cssVariables,
      computedStyles,
      tailwindClasses,
      metadata: {
        extractedAt: new Date().toISOString(),
        elementCount: Object.keys(computedStyles).length,
        variableCount: Object.keys(cssVariables).length,
      },
    };

    console.log('[LAYER1] Extracted baseline:', snapshot.metadata);

    return snapshot;
  } catch (error) {
    console.error('[LAYER1] Error extracting baseline:', error);
    return null;
  }
}

/**
 * Extract CSS variables from :root and .dark
 */
function extractCSSVariables(doc: Document): Record<string, string> {
  const variables: Record<string, string> = {};

  // Get computed style of root element
  const rootStyles = window.getComputedStyle(doc.documentElement);

  // Extract all CSS custom properties (--variables)
  const cssVarPattern = /^--/;
  Array.from(rootStyles).forEach(prop => {
    if (cssVarPattern.test(prop)) {
      const value = rootStyles.getPropertyValue(prop).trim();
      if (value) {
        // Store without the '--' prefix for consistency
        variables[prop.replace('--', '')] = value;
      }
    }
  });

  return variables;
}

/**
 * Extract computed styles for key elements
 */
function extractComputedStyles(doc: Document): Record<string, ComputedStyle> {
  const styles: Record<string, ComputedStyle> = {};

  // Key selectors to extract styles from (MUST MATCH actual HTML data-ai attributes)
  const keySelectors = [
    { selector: '[data-ai="header"]', name: 'header' },
    { selector: '[data-ai="section-hero"]', name: 'hero' },
    { selector: '[data-ai="product-card"]', name: 'product-card' },
    { selector: '[data-ai="section-categories"]', name: 'categories' },
    { selector: '[data-ai="category-card"]', name: 'category-card' },
    { selector: '[data-ai="section-featured"]', name: 'featured' },
    { selector: '[data-ai="section-footer"]', name: 'footer' },
    { selector: 'button', name: 'button' },
  ];

  keySelectors.forEach(({ selector, name }) => {
    const elements = doc.querySelectorAll(selector);
    if (elements.length > 0) {
      const element = elements[0]; // Take first match
      const computed = window.getComputedStyle(element);

      styles[name] = {
        selector,
        styles: {
          'border-radius': computed.borderRadius,
          'background': computed.background,
          'background-color': computed.backgroundColor,
          'padding': computed.padding,
          'margin': computed.margin,
          'box-shadow': computed.boxShadow,
          'color': computed.color,
          'font-size': computed.fontSize,
          'font-weight': computed.fontWeight,
          'font-family': computed.fontFamily,
        },
      };
    }
  });

  return styles;
}

/**
 * Extract Tailwind classes from key elements
 */
function extractTailwindClasses(doc: Document): Record<string, string[]> {
  const classes: Record<string, string[]> = {};

  const keySelectors = [
    { selector: '[data-ai="header"]', name: 'header' },
    { selector: '[data-ai="section-hero"]', name: 'hero' },
    { selector: '[data-ai="product-card"]', name: 'product-card' },
    { selector: '[data-ai="section-categories"]', name: 'categories' },
    { selector: '[data-ai="category-card"]', name: 'category-card' },
    { selector: '[data-ai="section-featured"]', name: 'featured' },
    { selector: '[data-ai="section-footer"]', name: 'footer' },
    { selector: 'button', name: 'button' },
  ];

  keySelectors.forEach(({ selector, name }) => {
    const elements = doc.querySelectorAll(selector);
    if (elements.length > 0) {
      const element = elements[0];
      const classList = Array.from(element.classList);

      // Filter for Tailwind classes (common patterns)
      const tailwindClasses = classList.filter(cls =>
        cls.match(/^(bg-|text-|p-|m-|rounded|shadow|border|flex|grid|gap-|w-|h-|max-|min-)/)
      );

      if (tailwindClasses.length > 0) {
        classes[name] = tailwindClasses;
      }
    }
  });

  return classes;
}

/**
 * Build compact Layer 1 summary for AI (token-efficient)
 */
export function buildLayer1Summary(snapshot: Layer1Snapshot): string {
  const { cssVariables, computedStyles } = snapshot;

  // Format CSS variables
  const varsText = Object.entries(cssVariables)
    .slice(0, 15) // Limit to top 15 for token efficiency
    .map(([k, v]) => `${k}=${v}`)
    .join(', ');

  // Format key styles
  const stylesText = Object.entries(computedStyles)
    .map(([name, style]) => {
      const radius = style.styles['border-radius'] || 'none';
      const bg = style.styles['background-color'] || 'transparent';
      return `${name}: radius=${radius}, bg=${bg}`;
    })
    .join('; ');

  return `Layer 1 Baseline:
CSS Variables: ${varsText}
Computed Styles: ${stylesText}`;
}

/**
 * Compare two Layer 1 snapshots to detect changes
 */
export function compareLayer1Snapshots(
  before: Layer1Snapshot,
  after: Layer1Snapshot
): {
  changed: boolean;
  changes: string[];
} {
  const changes: string[] = [];

  // Compare CSS variables
  Object.keys(before.cssVariables).forEach(key => {
    if (before.cssVariables[key] !== after.cssVariables[key]) {
      changes.push(`--${key}: ${before.cssVariables[key]} → ${after.cssVariables[key]}`);
    }
  });

  // Compare computed styles (simplified - only check border-radius and background)
  Object.keys(before.computedStyles).forEach(name => {
    const beforeStyle = before.computedStyles[name];
    const afterStyle = after.computedStyles[name];

    if (!afterStyle) return;

    const beforeRadius = beforeStyle.styles['border-radius'];
    const afterRadius = afterStyle.styles['border-radius'];
    if (beforeRadius !== afterRadius) {
      changes.push(`${name} radius: ${beforeRadius} → ${afterRadius}`);
    }

    const beforeBg = beforeStyle.styles['background-color'];
    const afterBg = afterStyle.styles['background-color'];
    if (beforeBg !== afterBg) {
      changes.push(`${name} background: ${beforeBg} → ${afterBg}`);
    }
  });

  return {
    changed: changes.length > 0,
    changes,
  };
}

/**
 * Console Debug Helper for AI Designer
 * Provides interactive debugging tools accessible from browser console
 */

export interface DebugInfo {
  iframe: HTMLIFrameElement | null;
  styleTags: Array<{
    id: string;
    layer: string;
    length: number;
    preview: string;
  }>;
  cssVariables: Record<string, string>;
  fontLinks: string[];
  computedStyles: Record<string, any>;
}

/**
 * Main debug helper object exposed to window
 */
export const AIDesignerDebug = {
  /**
   * Find the preview iframe
   */
  getIframe(): HTMLIFrameElement | null {
    const iframe = document.querySelector('iframe');
    if (!iframe) {
      console.error('❌ No iframe found on page');
      return null;
    }
    console.log('✅ Found iframe:', iframe);
    return iframe;
  },

  /**
   * Inspect all styles in the iframe
   */
  inspectStyles(label: string = "Styles Inspection"): DebugInfo | null {
    const iframe = this.getIframe();
    if (!iframe) return null;

    const doc = iframe.contentDocument;
    if (!doc) {
      console.error('❌ Cannot access iframe document');
      return null;
    }

    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(`🔍 [${label}] Iframe Styles Inspection`);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

    // Get all style tags
    const styleTags = Array.from(doc.head.querySelectorAll('style'));
    console.log(`📄 Found ${styleTags.length} <style> tags in <head>`);

    const styleInfo = styleTags.map((style, idx) => {
      const id = style.id || "(no id)";
      const layer = style.getAttribute('data-ai-layer') || "(no layer)";
      const length = style.textContent?.length || 0;
      const preview = style.textContent?.substring(0, 200) || "";

      console.log(`  ${idx + 1}. id="${id}" layer="${layer}" length=${length} chars`);

      if (id.includes('ai-') || layer !== "(no layer)") {
        console.log(`     Preview:`, preview);
      }

      return { id, layer, length, preview };
    });

    // Get CSS variables
    const rootStyle = doc.defaultView?.getComputedStyle(doc.documentElement);
    const cssVariables: Record<string, string> = {};

    if (rootStyle) {
      console.log("\n🎨 Current CSS Variables on :root:");
      const varsToCheck = [
        'primary', 'background', 'foreground', 'card', 'card-foreground',
        'muted', 'muted-foreground', 'border', 'radius', 'accent', 'secondary'
      ];

      varsToCheck.forEach(varName => {
        const value = rootStyle.getPropertyValue(`--${varName}`).trim();
        if (value) {
          cssVariables[varName] = value;
          console.log(`  --${varName}: ${value}`);
        }
      });
    }

    // Get font links
    const fontLinks = Array.from(doc.head.querySelectorAll('link[data-ai-font]'))
      .map(link => (link as HTMLLinkElement).href);

    console.log(`\n🔤 Found ${fontLinks.length} AI font <link> tags`);
    fontLinks.forEach((href, idx) => {
      console.log(`  ${idx + 1}. ${href}`);
    });

    // Get computed styles of key elements
    const computedStyles: Record<string, any> = {};
    const elementsToCheck = [
      { selector: '[data-ai="header"]', name: 'header' },
      { selector: '[data-ai="hero"]', name: 'hero' },
      { selector: '[data-ai="product-card"]', name: 'product-card' },
      { selector: 'button', name: 'button' },
    ];

    console.log("\n🎯 Computed Styles of Key Elements:");
    elementsToCheck.forEach(({ selector, name }) => {
      const element = doc.querySelector(selector);
      if (element) {
        const computed = doc.defaultView?.getComputedStyle(element);
        if (computed) {
          const styles = {
            borderRadius: computed.borderRadius,
            background: computed.background,
            backdropFilter: computed.backdropFilter,
            boxShadow: computed.boxShadow,
          };
          computedStyles[name] = styles;
          console.log(`  ${name} (${selector}):`);
          console.log(`    border-radius: ${styles.borderRadius}`);
          console.log(`    background: ${styles.background.substring(0, 50)}...`);
          console.log(`    backdrop-filter: ${styles.backdropFilter}`);
          console.log(`    box-shadow: ${styles.boxShadow.substring(0, 50)}...`);
        }
      } else {
        console.log(`  ${name} (${selector}): ❌ Not found in DOM`);
      }
    });

    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

    return {
      iframe,
      styleTags: styleInfo,
      cssVariables,
      fontLinks,
      computedStyles,
    };
  },

  /**
   * Show specific style tag content
   */
  showStyleTag(idOrIndex: string | number): void {
    const iframe = this.getIframe();
    if (!iframe?.contentDocument) return;

    const styleTags = Array.from(iframe.contentDocument.head.querySelectorAll('style'));

    let targetStyle: Element | null = null;
    if (typeof idOrIndex === 'number') {
      targetStyle = styleTags[idOrIndex];
    } else {
      targetStyle = iframe.contentDocument.getElementById(idOrIndex);
    }

    if (!targetStyle) {
      console.error(`❌ Style tag not found: ${idOrIndex}`);
      return;
    }

    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(`📄 Style Tag Content: ${targetStyle.id || '(no id)'}`);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
    console.log(targetStyle.textContent);
    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
  },

  /**
   * Check if a specific selector exists in iframe
   */
  checkSelector(selector: string): void {
    const iframe = this.getIframe();
    if (!iframe?.contentDocument) return;

    const elements = iframe.contentDocument.querySelectorAll(selector);

    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(`🔍 Selector Check: "${selector}"`);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

    if (elements.length === 0) {
      console.log(`❌ No elements found matching "${selector}"`);
      console.log("\n💡 Suggestions:");

      // Suggest alternatives
      if (selector === 'header') {
        console.log('  Try: [data-ai="header"]');
      } else if (selector === 'button') {
        console.log('  Try: button, [role="button"], .btn');
      }
    } else {
      console.log(`✅ Found ${elements.length} element(s)`);
      elements.forEach((el, idx) => {
        console.log(`\n  ${idx + 1}. <${el.tagName.toLowerCase()}>`);
        console.log(`     Classes: ${el.className || '(none)'}`);
        console.log(`     ID: ${el.id || '(none)'}`);
        console.log(`     data-ai: ${el.getAttribute('data-ai') || '(none)'}`);
      });
    }

    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
  },

  /**
   * Test CSS injection
   */
  testCSS(css: string, label: string = "test-css"): void {
    const iframe = this.getIframe();
    if (!iframe?.contentDocument?.head) {
      console.error('❌ Cannot access iframe head');
      return;
    }

    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(`🧪 [TEST-CSS] Injecting test CSS`);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

    const styleId = `ai-debug-${label}`;

    // Remove existing test style
    const existing = iframe.contentDocument.getElementById(styleId);
    if (existing) {
      existing.remove();
      console.log('🗑️  Removed existing test style');
    }

    // Inject new test style
    const styleEl = iframe.contentDocument.createElement('style');
    styleEl.id = styleId;
    styleEl.textContent = css;
    iframe.contentDocument.head.appendChild(styleEl);

    console.log('✅ Test CSS injected');
    console.log('   ID:', styleId);
    console.log('   CSS:\n', css);
    console.log('\n💡 To remove: AIDesignerDebug.removeTestCSS("' + label + '")');
    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
  },

  /**
   * Remove test CSS
   */
  removeTestCSS(label: string = "test-css"): void {
    const iframe = this.getIframe();
    if (!iframe?.contentDocument) return;

    const styleId = `ai-debug-${label}`;
    const existing = iframe.contentDocument.getElementById(styleId);

    if (existing) {
      existing.remove();
      console.log(`✅ Removed test CSS: ${styleId}`);
    } else {
      console.log(`❌ Test CSS not found: ${styleId}`);
    }
  },

  /**
   * List all elements with data-ai attributes
   */
  listAIElements(): void {
    const iframe = this.getIframe();
    if (!iframe?.contentDocument) return;

    const aiElements = Array.from(iframe.contentDocument.querySelectorAll('[data-ai]'));

    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(`🎯 Elements with [data-ai] attribute`);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

    if (aiElements.length === 0) {
      console.log('❌ No elements with data-ai attribute found');
    } else {
      console.log(`✅ Found ${aiElements.length} elements:\n`);
      aiElements.forEach((el, idx) => {
        const dataAI = el.getAttribute('data-ai');
        console.log(`  ${idx + 1}. <${el.tagName.toLowerCase()}> data-ai="${dataAI}"`);
        console.log(`     Selector: [data-ai="${dataAI}"]`);
        console.log(`     Classes: ${el.className || '(none)'}`);
      });
    }

    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
  },

  /**
   * Compare AI description vs actual CSS
   */
  checkAIChange(description: string, selector: string, property: string): void {
    const iframe = this.getIframe();
    if (!iframe?.contentDocument) return;

    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(`🔬 AI Change Verification`);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

    console.log('📝 AI Description:', description);
    console.log('🎯 Checking selector:', selector);
    console.log('🔍 Property:', property);

    const element = iframe.contentDocument.querySelector(selector);
    if (!element) {
      console.log('\n❌ Element not found!');
      console.log('💡 Suggestions:');
      console.log('   1. Check if selector is correct');
      console.log('   2. Use AIDesignerDebug.listAIElements() to see available selectors');
      console.log('   3. Use AIDesignerDebug.checkSelector("' + selector + '") for details');
      return;
    }

    const computed = iframe.contentDocument.defaultView?.getComputedStyle(element);
    if (!computed) {
      console.log('\n❌ Cannot get computed styles');
      return;
    }

    const value = computed.getPropertyValue(property);
    console.log('\n✅ Element found');
    console.log('📊 Current value of', property + ':', value || '(not set)');

    // Check if it matches description
    const descLower = description.toLowerCase();
    if (descLower.includes('glass') || descLower.includes('blur')) {
      const backdropFilter = computed.backdropFilter;
      console.log('🔍 backdrop-filter:', backdropFilter);
      if (backdropFilter === 'none') {
        console.log('❌ No blur effect applied!');
      }
    }

    if (descLower.includes('gradient')) {
      const background = computed.background;
      console.log('🔍 background:', background.substring(0, 100) + '...');
      if (!background.includes('gradient')) {
        console.log('❌ No gradient in background!');
      }
    }

    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
  },

  /**
   * Show help
   */
  help(): void {
    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("🎨 AI Designer Console Debug Helper");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
    console.log("Available commands:\n");
    console.log("AIDesignerDebug.inspectStyles()");
    console.log("  → Inspect all styles, CSS variables, and computed styles\n");

    console.log("AIDesignerDebug.showStyleTag('ai-designer-styles')");
    console.log("AIDesignerDebug.showStyleTag(0)");
    console.log("  → Show content of specific style tag\n");

    console.log("AIDesignerDebug.checkSelector('[data-ai=\"header\"]')");
    console.log("  → Check if selector exists in iframe\n");

    console.log("AIDesignerDebug.listAIElements()");
    console.log("  → List all elements with [data-ai] attribute\n");

    console.log("AIDesignerDebug.testCSS('button { border-radius: 50px !important; }')");
    console.log("  → Test CSS injection\n");

    console.log("AIDesignerDebug.removeTestCSS('test-css')");
    console.log("  → Remove test CSS\n");

    console.log("AIDesignerDebug.checkAIChange('glassmorphism header', '[data-ai=\"header\"]', 'backdrop-filter')");
    console.log("  → Verify if AI changes match reality\n");

    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
  }
};

/**
 * Attach to window for console access
 */
if (typeof window !== 'undefined') {
  (window as any).AIDesignerDebug = AIDesignerDebug;
  console.log('🎨 AI Designer Debug Helper loaded! Type AIDesignerDebug.help() for commands');
}

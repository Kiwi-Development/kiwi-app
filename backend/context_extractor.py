"""
Semantic Context Extraction Module

Extracts structured context from web pages including:
- DOM tree structure with element metadata
- Accessibility tree (ARIA roles, labels, landmarks)
- Figma metadata (if applicable)
"""
import json
from typing import Dict, List, Optional, Any
from playwright.async_api import Page


async def extract_dom_tree(page: Page) -> Dict[str, Any]:
    """
    Extract DOM tree structure with element metadata.
    Returns a structured representation of the DOM.
    """
    dom_data = await page.evaluate("""
        () => {
            function extractElementInfo(element) {
                const rect = element.getBoundingClientRect();
                const computedStyle = window.getComputedStyle(element);
                
                return {
                    tag: element.tagName.toLowerCase(),
                    id: element.id || null,
                    classes: Array.from(element.classList) || [],
                    attributes: Array.from(element.attributes).reduce((acc, attr) => {
                        acc[attr.name] = attr.value;
                        return acc;
                    }, {}),
                    text: element.textContent?.trim().substring(0, 200) || null,
                    position: {
                        x: Math.round(rect.x),
                        y: Math.round(rect.y),
                        width: Math.round(rect.width),
                        height: Math.round(rect.height)
                    },
                    visible: rect.width > 0 && rect.height > 0 && computedStyle.display !== 'none' && computedStyle.visibility !== 'hidden',
                    children: []
                };
            }
            
            function buildTree(element, maxDepth = 5, currentDepth = 0) {
                if (currentDepth >= maxDepth) return null;
                
                const info = extractElementInfo(element);
                
                // Only process visible elements or important structural elements
                if (info.visible || ['html', 'head', 'body', 'main', 'header', 'footer', 'nav', 'section', 'article', 'aside'].includes(info.tag)) {
                    const children = Array.from(element.children)
                        .map(child => buildTree(child, maxDepth, currentDepth + 1))
                        .filter(child => child !== null);
                    
                    info.children = children;
                    return info;
                }
                
                return null;
            }
            
            return buildTree(document.documentElement);
        }
    """)
    
    return {
        "type": "dom_tree",
        "data": dom_data,
        "timestamp": None  # Will be set by caller
    }


async def extract_accessibility_tree(page: Page) -> Dict[str, Any]:
    """
    Extract accessibility tree with ARIA roles, labels, landmarks, and keyboard navigation info.
    """
    a11y_data = await page.evaluate("""
        () => {
            function extractA11yInfo(element) {
                const rect = element.getBoundingClientRect();
                const computedStyle = window.getComputedStyle(element);
                
                // Get ARIA attributes
                const ariaRole = element.getAttribute('role') || null;
                const ariaLabel = element.getAttribute('aria-label') || null;
                const ariaLabelledBy = element.getAttribute('aria-labelledby') || null;
                const ariaDescribedBy = element.getAttribute('aria-describedby') || null;
                const ariaHidden = element.getAttribute('aria-hidden') === 'true';
                const ariaLive = element.getAttribute('aria-live') || null;
                const ariaExpanded = element.getAttribute('aria-expanded') || null;
                
                // Get semantic HTML role
                const semanticRole = element.tagName.toLowerCase();
                const isLandmark = ['header', 'footer', 'nav', 'main', 'article', 'section', 'aside'].includes(semanticRole);
                
                // Check keyboard accessibility
                const isFocusable = element.tabIndex >= 0 || 
                    ['a', 'button', 'input', 'select', 'textarea'].includes(semanticRole) ||
                    element.getAttribute('tabindex') !== null;
                
                // Get accessible name
                let accessibleName = ariaLabel;
                if (!accessibleName && ariaLabelledBy) {
                    const labelElement = document.getElementById(ariaLabelledBy);
                    accessibleName = labelElement?.textContent?.trim() || null;
                }
                if (!accessibleName && element.textContent) {
                    accessibleName = element.textContent.trim().substring(0, 100);
                }
                
                // Check for alt text on images
                const altText = element.tagName.toLowerCase() === 'img' ? element.getAttribute('alt') : null;
                
                return {
                    role: ariaRole || semanticRole,
                    isLandmark: isLandmark,
                    accessibleName: accessibleName || null,
                    ariaLabel: ariaLabel,
                    ariaLabelledBy: ariaLabelledBy,
                    ariaDescribedBy: ariaDescribedBy,
                    ariaHidden: ariaHidden,
                    ariaLive: ariaLive,
                    ariaExpanded: ariaExpanded,
                    altText: altText,
                    isFocusable: isFocusable,
                    tabIndex: element.tabIndex,
                    position: {
                        x: Math.round(rect.x),
                        y: Math.round(rect.y),
                        width: Math.round(rect.width),
                        height: Math.round(rect.height)
                    },
                    visible: rect.width > 0 && rect.height > 0 && computedStyle.display !== 'none' && computedStyle.visibility !== 'hidden',
                    children: []
                };
            }
            
            function buildA11yTree(element, maxDepth = 5, currentDepth = 0) {
                if (currentDepth >= maxDepth) return null;
                
                const info = extractA11yInfo(element);
                
                // Include all elements with ARIA attributes, landmarks, or focusable elements
                if (info.visible && (info.role || info.isLandmark || info.isFocusable || info.ariaLabel || info.altText !== null)) {
                    const children = Array.from(element.children)
                        .map(child => buildA11yTree(child, maxDepth, currentDepth + 1))
                        .filter(child => child !== null);
                    
                    info.children = children;
                    return info;
                }
                
                return null;
            }
            
            return buildA11yTree(document.documentElement);
        }
    """)
    
    return {
        "type": "accessibility_tree",
        "data": a11y_data,
        "timestamp": None
    }


async def extract_page_metadata(page: Page) -> Dict[str, Any]:
    """
    Extract general page metadata (title, URL, viewport, etc.)
    """
    metadata = await page.evaluate("""
        () => {
            return {
                title: document.title,
                url: window.location.href,
                viewport: {
                    width: window.innerWidth,
                    height: window.innerHeight
                },
                language: document.documentElement.lang || null,
                metaDescription: document.querySelector('meta[name="description"]')?.content || null,
                metaKeywords: document.querySelector('meta[name="keywords"]')?.content || null,
                canonicalUrl: document.querySelector('link[rel="canonical"]')?.href || null
            };
        }
    """)
    
    return {
        "type": "page_metadata",
        "data": metadata,
        "timestamp": None
    }


async def extract_semantic_context(page: Page) -> Dict[str, Any]:
    """
    Extract complete semantic context including DOM, accessibility, and metadata.
    This is the main function to call for full context extraction.
    """
    from datetime import datetime
    
    timestamp = datetime.utcnow().isoformat()
    
    try:
        dom_tree = await extract_dom_tree(page)
        dom_tree["timestamp"] = timestamp
        
        a11y_tree = await extract_accessibility_tree(page)
        a11y_tree["timestamp"] = timestamp
        
        page_metadata = await extract_page_metadata(page)
        page_metadata["timestamp"] = timestamp
        
        return {
            "dom_tree": dom_tree,
            "accessibility_tree": a11y_tree,
            "page_metadata": page_metadata,
            "extracted_at": timestamp
        }
    except Exception as e:
        return {
            "error": str(e),
            "extracted_at": timestamp
        }


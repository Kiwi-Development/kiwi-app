"""
Figma API Client

Fetches metadata from Figma files including:
- Component names and properties
- Design tokens
- Constraints and layout information
"""
import os
import requests
from typing import Dict, Optional, Any
import re


def is_figma_url(url: str) -> bool:
    """
    Check if a URL is a Figma prototype or file URL.
    """
    figma_patterns = [
        r'https?://(www\.)?figma\.com/(file|proto)/[a-zA-Z0-9]+',
        r'https?://(www\.)?figma\.com/design/[a-zA-Z0-9]+',
    ]
    
    for pattern in figma_patterns:
        if re.match(pattern, url):
            return True
    return False


def extract_file_key_from_url(url: str) -> Optional[str]:
    """
    Extract Figma file key from URL.
    """
    patterns = [
        r'figma\.com/(?:file|proto|design)/([a-zA-Z0-9]+)',
    ]
    
    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)
    return None


def fetch_figma_metadata(file_key: str, api_token: Optional[str] = None) -> Dict[str, Any]:
    """
    Fetch metadata from Figma API for a given file key.
    
    For public files, this is optional. If no token is provided, returns a minimal response.
    The system will rely on DOM/A11y extraction instead, which works for any website.
    """
    if not api_token:
        api_token = os.environ.get('FIGMA_API_TOKEN')
    
    # If no token, return minimal metadata (file is public, we can't access API)
    # This is fine - DOM/A11y extraction will provide the necessary context
    if not api_token:
        return {
            "file_key": file_key,
            "public": True,
            "metadata_available": False,
            "note": "Figma API token not provided. Using DOM/A11y extraction instead (works for public prototypes)."
        }
    
    try:
        # Figma REST API endpoint
        url = f"https://api.figma.com/v1/files/{file_key}"
        
        headers = {
            "X-Figma-Token": api_token
        }
        
        response = requests.get(url, headers=headers, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            
            # Extract relevant metadata
            metadata = {
                "file_key": file_key,
                "name": data.get("name", ""),
                "lastModified": data.get("lastModified", ""),
                "version": data.get("version", ""),
                "document": extract_component_info(data.get("document", {})),
                "components": extract_components(data.get("document", {})),
                "styles": extract_styles(data.get("styles", {})),
            }
            
            return metadata
        elif response.status_code == 403:
            return {
                "error": "Figma API token is invalid or lacks permissions",
                "file_key": file_key
            }
        elif response.status_code == 404:
            return {
                "error": "Figma file not found or not accessible",
                "file_key": file_key
            }
        else:
            return {
                "error": f"Figma API error: {response.status_code} - {response.text}",
                "file_key": file_key
            }
            
    except requests.exceptions.RequestException as e:
        return {
            "error": f"Failed to fetch Figma metadata: {str(e)}",
            "file_key": file_key
        }


def extract_component_info(node: Dict[str, Any], depth: int = 0, max_depth: int = 10) -> Dict[str, Any]:
    """
    Recursively extract component information from Figma document tree.
    """
    if depth > max_depth:
        return {}
    
    info = {
        "type": node.get("type", ""),
        "name": node.get("name", ""),
        "id": node.get("id", ""),
    }
    
    # Extract constraints if available
    if "constraints" in node:
        info["constraints"] = node["constraints"]
    
    # Extract layout information
    if "layoutMode" in node:
        info["layoutMode"] = node["layoutMode"]
        info["layoutAlign"] = node.get("layoutAlign", "")
        info["layoutGrow"] = node.get("layoutGrow", 0)
    
    # Extract design tokens (fills, strokes, effects)
    if "fills" in node:
        info["fills"] = node["fills"]
    if "strokes" in node:
        info["strokes"] = node["strokes"]
    if "effects" in node:
        info["effects"] = node["effects"]
    
    # Recursively process children
    if "children" in node and isinstance(node["children"], list):
        info["children"] = [
            extract_component_info(child, depth + 1, max_depth)
            for child in node["children"][:50]  # Limit to first 50 children
        ]
    
    return info


def extract_components(document: Dict[str, Any]) -> list:
    """
    Extract all component definitions from the document.
    """
    components = []
    
    def traverse(node: Dict[str, Any]):
        if node.get("type") == "COMPONENT" or node.get("type") == "COMPONENT_SET":
            components.append({
                "id": node.get("id", ""),
                "name": node.get("name", ""),
                "type": node.get("type", ""),
                "description": node.get("description", ""),
            })
        
        if "children" in node and isinstance(node["children"], list):
            for child in node["children"]:
                traverse(child)
    
    if "children" in document:
        for child in document.get("children", []):
            traverse(child)
    
    return components


def extract_styles(styles: Dict[str, Any]) -> list:
    """
    Extract design tokens and styles from Figma.
    """
    style_list = []
    
    for style_id, style_data in styles.items():
        style_list.append({
            "id": style_id,
            "name": style_data.get("name", ""),
            "description": style_data.get("description", ""),
            "styleType": style_data.get("styleType", ""),
        })
    
    return style_list


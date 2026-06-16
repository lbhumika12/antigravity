import os
import re
import time
import requests
import xml.etree.ElementTree as ET
from bs4 import BeautifulSoup
from flask import Flask, render_template, jsonify, request

app = Flask(__name__)

# Constants
FEED_URL = "https://docs.cloud.google.com/feeds/bigquery-release-notes.xml"
CACHE_DURATION = 3600  # Cache feed for 1 hour (in seconds)

# Simple in-memory cache
feed_cache = {
    "data": None,
    "last_updated": 0
}

def clean_html_text(soup):
    """
    Strips HTML tags and formats links nicely for plain-text representations like Tweets.
    """
    # Create a copy so we don't modify the original soup
    temp_soup = BeautifulSoup(str(soup), "html.parser")
    
    # Replace links with text + href
    for link in temp_soup.find_all("a"):
        href = link.get("href")
        text = link.get_text()
        if href and text:
            # Avoid repeating the link text if it's already a URL
            if href.strip().rstrip("/") == text.strip().rstrip("/"):
                link.replace_with(href)
            else:
                link.replace_with(f"{text} ({href})")
    
    # Replace standard tag groupings with spacing
    text = temp_soup.get_text(separator=" ")
    # Normalize whitespaces
    text = re.sub(r'\s+', ' ', text)
    return text.strip()

def parse_xml_feed(xml_content):
    """
    Parses the BigQuery release notes Atom feed and splits each entry's
    grouped HTML contents into individual updates.
    """
    root = ET.fromstring(xml_content)
    ns = {"atom": "http://www.w3.org/2005/Atom"}
    
    entries = root.findall("atom:entry", ns)
    parsed_updates = []
    
    for entry in entries:
        date_str = entry.find("atom:title", ns).text
        updated_str = entry.find("atom:updated", ns).text
        
        # Link to this specific release date
        link_el = entry.find("atom:link", ns)
        link_url = ""
        if link_el is not None:
            link_url = link_el.attrib.get("href", "")
            
        content_html = entry.find("atom:content", ns).text
        if not content_html:
            continue
            
        soup = BeautifulSoup(content_html, "html.parser")
        h3s = soup.find_all("h3")
        
        # Unique entry identifier (date based)
        entry_id_raw = entry.find("atom:id", ns).text if entry.find("atom:id", ns) is not None else date_str
        
        if not h3s:
            # Fallback if no <h3> split is available
            plain_text = clean_html_text(soup)
            parsed_updates.append({
                "id": f"{entry_id_raw}-0",
                "date": date_str,
                "updated": updated_str,
                "type": "General",
                "html": content_html,
                "text": plain_text,
                "link": link_url
            })
            continue
            
        for i, h3 in enumerate(h3s):
            update_type = h3.get_text(strip=True)
            
            # Find all siblings until the next h3
            sibling_html_parts = []
            curr = h3.next_sibling
            while curr and curr.name != "h3":
                if curr.name:
                    sibling_html_parts.append(str(curr))
                elif str(curr).strip():
                    sibling_html_parts.append(str(curr))
                curr = curr.next_sibling
                
            update_html = "".join(sibling_html_parts).strip()
            sibling_soup = BeautifulSoup(update_html, "html.parser")
            update_text = clean_html_text(sibling_soup)
            
            # Generate a unique hash-like ID for individual updates
            update_id = f"{entry_id_raw}-{i}"
            
            parsed_updates.append({
                "id": update_id,
                "date": date_str,
                "updated": updated_str,
                "type": update_type,
                "html": update_html,
                "text": update_text,
                "link": link_url
            })
            
    return parsed_updates

def get_release_notes(force_refresh=False):
    """
    Retrieves and parses release notes, utilizing an in-memory cache.
    """
    now = time.time()
    
    # Return cache if valid and refresh is not forced
    if not force_refresh and feed_cache["data"] and (now - feed_cache["last_updated"] < CACHE_DURATION):
        return feed_cache["data"], False
        
    try:
        response = requests.get(FEED_URL, timeout=15)
        if response.status_code == 200:
            parsed_data = parse_xml_feed(response.content)
            feed_cache["data"] = parsed_data
            feed_cache["last_updated"] = now
            return parsed_data, True
        else:
            # Fall back to cache if request fails
            if feed_cache["data"]:
                return feed_cache["data"], False
            raise Exception(f"Failed to fetch feed, status code: {response.status_code}")
    except Exception as e:
        # Return cache as fallback if error occurs
        if feed_cache["data"]:
            return feed_cache["data"], False
        raise e

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/releases')
def api_releases():
    force_refresh = request.args.get('refresh', 'false').lower() == 'true'
    try:
        data, refetched = get_release_notes(force_refresh)
        return jsonify({
            "success": True,
            "refetched": refetched,
            "last_updated": time.strftime('%Y-%m-%d %H:%M:%S', time.localtime(feed_cache["last_updated"])),
            "data": data
        })
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

if __name__ == '__main__':
    # Bind to localhost on port 5000
    app.run(host='127.0.0.1', port=5000, debug=True)

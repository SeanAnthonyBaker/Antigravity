import os
import time
import logging
import threading
import json
from typing import Optional

from flask import Blueprint, jsonify, request, Response, stream_with_context
from selenium.webdriver.remote.webdriver import WebDriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, NoSuchElementException, StaleElementReferenceException, InvalidSessionIdException
from selenium import webdriver
import urllib3

notebooklm_bp = Blueprint('notebooklm', __name__)
logger = logging.getLogger(__name__)

# --- Global State Management for Selenium ---
# A single, shared browser instance and a lock to ensure thread safety.
browser_instance: Optional[WebDriver] = None
browser_lock = threading.Lock()

# --- Constants for Selenium Selectors ---
CHAT_INPUT_SELECTORS = [
    (By.CSS_SELECTOR, '[data-testid="chat-input"]'),
    (By.XPATH, "//textarea[contains(@placeholder, 'Start typing')]"),
    (By.XPATH, "//input[contains(@placeholder, 'Start typing')]"),
    (By.CSS_SELECTOR, 'textarea[placeholder*="Ask"]'),
    (By.CSS_SELECTOR, '.chat-input textarea'),
    (By.CSS_SELECTOR, 'textarea[aria-label*="Ask"]')
]

SUBMIT_BUTTON_SELECTORS = [
    (By.CSS_SELECTOR, 'button[data-testid="send-button"]'),
    (By.CSS_SELECTOR, 'button[aria-label*="Send"]'),
    (By.XPATH, "//button[@aria-label='Submit' or @type='submit']")
]

RESPONSE_CONTENT_SELECTOR = (By.CSS_SELECTOR, '.message-content')

# Suggestion chip selectors - these appear when response is complete
SUGGESTION_CHIP_SELECTORS = [
    (By.CSS_SELECTOR, '.suggestion-chip'),
    (By.CSS_SELECTOR, 'button.follow-up'),
    (By.CSS_SELECTOR, '[class*="suggestion"]'),
    (By.CSS_SELECTOR, '.follow-up-question'),
    (By.XPATH, "//button[contains(@class, 'suggestion')]")
]

SAVE_TO_NOTE_SELECTORS = [
    (By.CSS_SELECTOR, "button[aria-label='Save to note']"),
    (By.XPATH, "//button[contains(@aria-label, 'Save to note')]"),
    (By.CSS_SELECTOR, "[data-testid='save-to-note']"),
    (By.XPATH, "//*[text()='Save to note']"),
    (By.XPATH, "//span[contains(@class, 'mdc-button__label') and contains(text(), 'Save to note')]")
]

NOTEBOOKLM_LOAD_INDICATORS = [
    (By.CSS_SELECTOR, '[data-testid="chat-input"]'), # Chat input is a good sign of readiness
    (By.CSS_SELECTOR, 'div[aria-label="Sources"]'), # Sources panel
    (By.XPATH, "//*[contains(text(), 'New notebook')]") # "New notebook" button
]

THINKING_PHRASES = [
    "Thinking",
    "Reading documents",
    "Gathering facts",
    "Parsing the data",
    "Sifting through pages",
    "Working on it",
    "Analyzing",
    "Checking sources",
    "Gathering info",
    "Just a sec",
    "Assessing relevance",
    "Searching your docs",
    "Refining the answer",
    "Scanning the text",
    "Scanning your sources",
    "Finding relevant info",
    "Finding key words",
    "Finding connections",
    "Opening your notes",
    "Reviewing the content",
    "Exploring your material",
    "Checking the scope",
    "Checking your uploads",
    "Examining the specifics",
    "Checking the scope...",
    "Checking your uploads...",
    "Examining the specifics...",
    "Finding key words...",
    "Finding relevant info...",
    "Getting the gist",
    "Getting the gist...",
    "Reading full chapters",
    "Reading full chapters..."
]





def reset_browser():
    """
    Safely quits the current browser instance and resets the global variable to None.
    Enhanced with aggressive cleanup to prevent orphaned Chrome processes.
    """
    global browser_instance
    session_id = None
    
    try:
        if browser_instance:
            # Try to get session ID before quitting (in case quit() fails)
            try:
                session_id = browser_instance.session_id
            except:
                pass
            
            # Attempt graceful quit
            browser_instance.quit()
            logger.info("Browser instance quit successfully.")
    except Exception as e:
        logger.warning(f"Error quitting browser instance (likely already dead): {e}")
        
        # Fallback: Try to delete session via Selenium Hub API
        if session_id:
            try:
                import requests
                selenium_hub_url = os.environ.get('SELENIUM_HUB_URL', 'http://selenium:4444/wd/hub')
                delete_url = f"{selenium_hub_url}/session/{session_id}"
                response = requests.delete(delete_url, timeout=5)
                logger.info(f"Forcefully deleted Selenium session {session_id}: {response.status_code}")
            except Exception as cleanup_error:
                logger.warning(f"Failed to force-delete session via API: {cleanup_error}")
    finally:
        browser_instance = None
        logger.info("Browser instance reference cleared.")

def initialize_browser(retries=3, delay=5):
    """
    Initializes the shared browser instance with retry logic.
    Returns: (success: bool, error_message: str|None)
    """
    global browser_instance
    
    # Use a remote WebDriver to connect to the Selenium container
    selenium_hub_url = os.environ.get('SELENIUM_HUB_URL', 'http://localhost:4444/wd/hub')
    
    logger.info(f"Attempting to connect to Selenium Hub at: {selenium_hub_url}")
    
    chrome_options = Options()
    
    # --- Anti-detection options ---
    chrome_options.add_argument("--no-sandbox")
    chrome_options.add_argument("--disable-dev-shm-usage")
    chrome_options.add_argument("--disable-infobars")
    chrome_options.add_argument("--disable-extensions")
    # REMOVED --disable-gpu to allow proper window rendering in VNC
    chrome_options.add_argument("--window-size=1920,1080")
    chrome_options.add_argument('--disable-blink-features=AutomationControlled')
    chrome_options.add_experimental_option("excludeSwitches", ["enable-automation"])
    
    # Explicitly set display for VNC visibility
    chrome_options.add_argument("--display=:99.0")
    chrome_options.add_argument("--start-maximized")
    
    # Using a realistic or slightly future-dated User-Agent helps avoid bot detection.
    # This is configurable via the CHROME_USER_AGENT environment variable.
    default_user_agent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/138.0.7204.157 Safari/537.36'
    user_agent = os.environ.get('CHROME_USER_AGENT', default_user_agent)
    chrome_options.add_argument(f'user-agent={user_agent}')

    # This points to the profile directory mounted inside the Selenium container
    chrome_options.add_argument("--user-data-dir=/data")
    chrome_options.add_argument("--profile-directory=Default")

    last_error = None

    for attempt in range(retries):
        try:
            # Ensure any existing instance is cleaned up
            if browser_instance:
                reset_browser()

            browser_instance = webdriver.Remote(
                command_executor=selenium_hub_url,
                options=chrome_options
            )
            browser_instance.set_page_load_timeout(60)
            browser_instance.maximize_window()
            logger.info("WebDriver initialized successfully and connected to Selenium Hub.")
            return True, None
        except Exception as e:
            last_error = e
            logger.warning(f"Attempt {attempt + 1}/{retries} failed to initialize WebDriver: {e}")
            time.sleep(delay)

    logger.error(f"Failed to initialize WebDriver after {retries} attempts: {last_error}", exc_info=True)
    reset_browser()
    return False, str(last_error)

def cleanup_orphaned_sessions():
    """
    Clean up any orphaned Chrome sessions that may exist from previous crashes or restarts.
    Uses Selenium Grid API to delete all active sessions.
    This prevents leftover browser windows from appearing in VNC when the app starts.
    """
    try:
        logger.info("Cleaning up any orphaned Chrome sessions from previous runs...")
        import requests
        
        selenium_hub_url = os.environ.get('SELENIUM_HUB_URL', 'http://selenium:4444/wd/hub')
        status_url = selenium_hub_url.replace('/wd/hub', '/status')
        
        # Get all active sessions from Selenium Grid
        try:
            response = requests.get(status_url, timeout=5)
            if response.status_code == 200:
                status_data = response.json()
                
                # Navigate through the status structure to find sessions
                nodes = status_data.get('value', {}).get('nodes', [])
                sessions_found = 0
                sessions_deleted = 0
                
                for node in nodes:
                    slots = node.get('slots', [])
                    for slot in slots:
                        if slot.get('session'):
                            session_id = slot['session'].get('sessionId')
                            if session_id:
                                sessions_found += 1
                                # Try to delete this session
                                try:
                                    delete_url = f"{selenium_hub_url}/session/{session_id}"
                                    del_response = requests.delete(delete_url, timeout=5)
                                    if del_response.status_code in [200, 404]:
                                        sessions_deleted += 1
                                        logger.info(f"Deleted orphaned session: {session_id}")
                                except Exception as del_error:
                                    logger.warning(f"Failed to delete session {session_id}: {del_error}")
                
                if sessions_found > 0:
                    logger.info(f"Cleanup complete: Deleted {sessions_deleted}/{sessions_found} orphaned sessions")
                else:
                    logger.info("No orphaned sessions found - VNC should show clean desktop")
        except Exception as e:
            logger.debug(f"Could not query Selenium status (this is OK if Selenium is starting up): {e}")
        
    except Exception as e:
        logger.warning(f"Error during orphaned session cleanup: {e}")
        # Don't fail startup if cleanup fails


def start_browser_initialization_thread():
    """Starts the browser initialization in a background thread to not block app startup."""
    # First, clean up any orphaned sessions from previous runs
    cleanup_orphaned_sessions()
    
    # Then start browser initialization
    init_thread = threading.Thread(target=initialize_browser, daemon=True)
    init_thread.start()


def find_element_by_priority(driver, selectors, condition=EC.presence_of_element_located, timeout=10):
    """
    Tries to find an element by iterating through a list of selectors.
    This implementation polls for the element to avoid a multiplicative timeout effect.
    """
    end_time = time.time() + timeout
    while time.time() < end_time:
        for by, value in selectors:
            try:
                element = condition((by, value))(driver)
                if element:
                    return element
            except (NoSuchElementException, StaleElementReferenceException):
                pass
        time.sleep(0.2)

    logger.debug(f"Element not found using any selector within the {timeout}s timeout.")
    return None

def count_all_suggestions(driver):
    """
    Counts all suggestion chip elements using multiple selectors.
    Returns the total count of unique suggestion elements.
    """
    suggestion_elements = set()
    for by, value in SUGGESTION_CHIP_SELECTORS:
        try:
            elements = driver.find_elements(by, value)
            for elem in elements:
                # Use element ID to avoid counting duplicates
                try:
                    suggestion_elements.add(elem.id)
                except:
                    pass
        except Exception as e:
            logger.debug(f"Could not find suggestions with selector {value}: {e}")
            pass
    
    return len(suggestion_elements)

def count_save_to_note_buttons(driver):
    """
    Counts all 'Save to note' buttons using multiple selectors.
    Returns the total count of unique button elements.
    """
    buttons = set()
    for by, value in SAVE_TO_NOTE_SELECTORS:
        try:
            elements = driver.find_elements(by, value)
            for elem in elements:
                try:
                    buttons.add(elem.id)
                except:
                    pass
        except Exception as e:
            pass
    return len(buttons)

def safe_get_element_text(driver, selector, max_retries=15):
    """
    Safely retrieves text from an element that may go stale during NotebookLM's rapid DOM updates.
    
    Args:
        driver: Selenium WebDriver instance
        selector: Tuple of (By, value) for locating element
        max_retries: Maximum number of retry attempts (default 15)
    
    Returns:
        str: The element's text content
        
    Raises:
        StaleElementReferenceException: If element remains stale after all retries
    """
    for attempt in range(max_retries):
        try:
            # Find the latest response element
            elements = driver.find_elements(*selector)
            if not elements:
                return ""
            
            element = elements[-1]  # Get the most recent one
            text = element.text  # This line often triggers stale element
            return text
            
        except StaleElementReferenceException:
            if attempt < max_retries - 1:
                # Wait a tiny bit for DOM to stabilize
                time.sleep(0.05)  # 50ms
                continue
            else:
                # Final attempt failed
                logger.error(f"Element remained stale after {max_retries} attempts")
                raise
        except Exception as e:
            logger.debug(f"Unexpected error reading element text: {e}")
            return ""
    
    return ""

def is_only_thinking_phrase(text):
    """
    Checks if the given text contains ONLY thinking phrases (and nothing else).
    Returns True if yes, False if there's actual content.
    """
    if not text or not text.strip():
        return False
    
    # Remove common punctuation and whitespace
    cleaned = text.strip().rstrip('.').rstrip('...')
    
    # Check if the entire text matches any thinking phrase
    for phrase in THINKING_PHRASES:
        # 1. Exact match of cleaned text vs cleaned phrase
        clean_phrase = phrase.lower().rstrip('.').rstrip('...')
        if cleaned.lower() == clean_phrase:
            # logger.debug(f"Thinking phrase match (exact): '{text}'")
            return True
            
        # 2. Check if it starts with the phrase and is short enough
        if cleaned.lower().startswith(clean_phrase) and len(cleaned) <= len(clean_phrase) + 5:
            # logger.debug(f"Thinking phrase match (startswith): '{text}'")
            return True
            
        # 3. Direct match against raw phrase (in case list has dots)
        if text.strip().lower() == phrase.lower():
            # logger.debug(f"Thinking phrase match (raw): '{text}'")
            return True
            
    # 4. Heuristic: Check for common thinking verbs in short text
    # This catches variations like "Finding key words...", "Finding connections...", etc.
    # We use 'in' instead of 'startswith' to handle potential invisible characters at the start
    THINKING_VERBS = [
        "Finding", "Checking", "Scanning", "Reading", "Getting", 
        "Thinking", "Working", "Parsing", "Sifting", "Analyzing", 
        "Assessing", "Refining", "Reviewing", "Exploring", "Examining",
        "Gathering", "Consulting"
    ]
    
    if len(text) < 60:  # Increased to 60
        text_lower = text.lower()
        for verb in THINKING_VERBS:
            if verb.lower() in text_lower:
                logger.info(f"Heuristic thinking phrase match: '{text}' (contains {verb})")
                return True
                
    return False



@notebooklm_bp.route('/process_query', methods=['POST'])
def process_query():
    """
    Consolidated Endpoint: Opens NotebookLM, submits a query, streams the response.
    
    Development Mode:
    - Set dev_mode=true to keep browser open after query (for faster testing)
    - Browser will persist between queries until manually closed via /api/close_browser
    
    Production Mode (default):
    - Browser is automatically closed after query completion
    - Cleanup is guaranteed via the finally block
    """
    logger.info("VERSION: END_OF_DATA_CHUNK_DETECTION - Starting process_query")
    data = request.get_json()
    if not data or 'query' not in data:
        return jsonify({'error': 'Missing "query" in request body'}), 400
    
    url = data.get('notebooklm_url', "https://notebooklm.google.com/")
    logger.info(f"DEBUG: process_query received URL: '{url}'")
    query_text = data['query']
    timeout = data.get('timeout', 120)  # Default 120 seconds
    dev_mode = data.get('dev_mode', False)  # Development mode flag
    
    if dev_mode:
        logger.info("🔧 DEV MODE: Browser will remain open after query")


    def generate_full_process_response():
        global browser_instance
        
        # 1. Initialize and Open
        with browser_lock:
            # Ensure we have a valid browser instance
            if not browser_instance:
                success, error_msg = initialize_browser()
                if not success:
                     yield f'data: {json.dumps({"error": f"Failed to initialize browser: {error_msg}"})}\n\n'
                     return
            else:
                # Validate existing session
                try:
                    _ = browser_instance.current_url
                except Exception as e:
                    logger.warning(f"Found stale browser session during process_query: {e}. Re-initializing...")
                    success, error_msg = initialize_browser()
                    if not success:
                        yield f'data: {json.dumps({"error": f"Failed to re-initialize browser: {error_msg}"})}\n\n'
                        return
            
            try:
                logger.info(f"Navigating to {url}...")
                yield f'data: {json.dumps({"status": "opening_browser", "message": f"Navigating to {url}"})}\n\n'
                
                browser_instance.get(url)
                
                # Wait for initial load - reduced from fixed sleep to smart wait check below
                # time.sleep(5) 
                
                current_url = browser_instance.current_url
                logger.info(f"Current URL after navigation: {current_url}")
                
                if 'accounts.google.com' in current_url or 'signin' in current_url.lower():
                    logger.warning(f"Redirected to Google sign-in page.")
                    yield f'data: {json.dumps({"status": "authentication_required", "message": "Redirected to Google sign-in. Waiting 5 minutes for manual login..."})}\n\n'
                    
                    # Wait up to 5 minutes for user to log in
                    auth_timeout = 300
                    auth_start_time = time.time()
                    logged_in = False
                    
                    while time.time() - auth_start_time < auth_timeout:
                        if "notebooklm.google.com" in browser_instance.current_url and find_element_by_priority(browser_instance, CHAT_INPUT_SELECTORS, timeout=1):
                            logged_in = True
                            break
                        time.sleep(2)
                    
                    if not logged_in:
                        logger.error("Timed out waiting for manual login.")
                        yield f'data: {json.dumps({"error": "Timed out waiting for manual login."})}\n\n'
                        return
                    else:
                        logger.info("User logged in successfully.")
                        yield f'data: {json.dumps({"status": "login_success", "message": "Login detected. Proceeding..."})}\n\n'

                # Wait for page to fully load
                # logger.info("Waiting for page to fully load...")
                # time.sleep(5)
                
                # Ensure we are on the correct page with retry logic
                max_retries = 3
                target_id = url.split('/')[-1] if 'notebook/' in url else ''
                
                for i in range(max_retries):
                    current_url = browser_instance.current_url
                    
                    # 1. Check if we are on the home page but want a specific notebook
                    if "notebook/" in url and "notebook/" not in current_url:
                        logger.warning(f"Attempt {i+1}/{max_retries}: Detected Home Page (or non-notebook page) '{current_url}' but target is '{url}'. Re-navigating...")
                        browser_instance.get(url)
                        time.sleep(8) # Increased wait time
                        continue

                    # 2. Check if we are on the WRONG notebook (ID mismatch)
                    if target_id and target_id not in current_url:
                        logger.warning(f"Attempt {i+1}/{max_retries}: ID mismatch. Current '{current_url}' vs Target '{url}'. Re-navigating...")
                        browser_instance.get(url)
                        time.sleep(8)
                        continue

                    # 3. Success check
                    logger.info(f"Successfully on target page: {current_url}")
                    break
                else:
                    logger.error(f"Failed to navigate to {url} after {max_retries} attempts. Current URL: {browser_instance.current_url}")

                logger.info(f"Page loaded. Current URL: {browser_instance.current_url}")
                yield f'data: {json.dumps({"status": "browser_ready", "message": "NotebookLM interface loaded."})}\n\n'

                # 2. Query Logic
                if "notebooklm.google.com" not in browser_instance.current_url:
                     yield f'data: {json.dumps({"error": "Not on a NotebookLM page."})}\n\n'
                     return
                
                # Track baseline for completion detection
                response_elements_before = browser_instance.find_elements(*RESPONSE_CONTENT_SELECTOR)
                
                initial_response_count = len(browser_instance.find_elements(*RESPONSE_CONTENT_SELECTOR))
                
                logger.info("Attempting to find the chat input field...")
                input_field = find_element_by_priority(browser_instance, CHAT_INPUT_SELECTORS, condition=EC.element_to_be_clickable, timeout=10)
                if not input_field:
                    raise NoSuchElementException("Could not find the chat input field.")
                
                logger.info(f"Entering query text: {query_text}")
                input_field.clear()
                input_field.send_keys(query_text)
                
                submit_button = find_element_by_priority(browser_instance, SUBMIT_BUTTON_SELECTORS, condition=EC.element_to_be_clickable, timeout=5)
                if submit_button:
                    logger.info("Clicking submit button...")
                    submit_button.click()
                else:
                    logger.info("Submit button not found, sending RETURN key...")
                    from selenium.webdriver.common.keys import Keys
                    input_field.send_keys(Keys.RETURN)
                
                logger.info("Query submitted.")
                yield f'data: {json.dumps({"status": "waiting_for_response"})}\n\n'

                # 3. Stream the response
                # STRATEGY: Simple and reliable
                # 1. Wait for a NEW response element to appear
                # 2. Stream ALL text changes (ignore content, just detect changes)
                # 3. Stop when text hasn't changed for 6 seconds
                # This ignores "Thinking" phrases entirely - we just stream what we see

                def find_new_response_with_text(driver, initial_count, selector):
                    try:
                        response_elements = driver.find_elements(*selector)
                        if len(response_elements) > initial_count:
                            new_response_element = response_elements[-1]
                            if new_response_element.is_displayed() and new_response_element.text.strip():
                                return new_response_element
                    except StaleElementReferenceException:
                        return False
                    return False

                # 3. Stream the response
                # STRATEGY: Robust Clean-Text Streaming
                # 1. Get raw text from DOM
                # 2. Strip any "Thinking" phrases from the start of the text
                # 3. Calculate chunks based on the CLEAN text (ignoring the raw thinking prefix)
                # 4. If clean text is empty => status="thinking"
                # 5. If clean text has content => status="streaming"

                def find_new_response_with_text(driver, initial_count, selector):
                    try:
                        response_elements = driver.find_elements(*selector)
                        if len(response_elements) > initial_count:
                            new_response_element = response_elements[-1]
                            if new_response_element.is_displayed() and new_response_element.text.strip():
                                return new_response_element
                    except StaleElementReferenceException:
                        return False
                    return False

                def strip_thinking_phrase(text):
                    """
                    Removes any leading thinking phrase from the text.
                    Returns the clean text.
                    """
                    text_lower = text.lower().strip()
                    best_match_len = 0
                    
                    for phrase in THINKING_PHRASES:
                        # Check keys: startswith phrase
                        # We handle "..." and punctuation flexibly
                        clean_phrase = phrase.lower().rstrip('.').strip()
                        
                        if text_lower.startswith(clean_phrase):
                            # Ensure we don't match "Thinking" inside "ThinkingAbout"
                            # Match if full string OR followed by punctuation/space
                            match_len = len(clean_phrase)
                            
                            # Check what follows the match in the original text
                            # We want to consume the phrase PLUS any trailing dots/whitespace
                            
                            # Original case insensitive match check
                            if text[:match_len].lower() == clean_phrase:
                                # Look ahead for dots/spaces
                                remaining = text[match_len:]
                                stripped_len = match_len
                                
                                # Consume ... and spaces
                                while remaining and (remaining[0] == '.' or remaining[0].isspace()):
                                    remaining = remaining[1:]
                                    stripped_len += 1
                                
                                # Updates best match (greedy)
                                if stripped_len > best_match_len:
                                    best_match_len = stripped_len

                    if best_match_len > 0:
                        return text[best_match_len:]
                    
                    # Heuristic fallback for "Verbing..."
                    if len(text) < 60:
                         THINKING_VERBS = [
                            "Finding", "Checking", "Scanning", "Reading", "Getting", 
                            "Thinking", "Working", "Parsing", "Sifting", "Analyzing", 
                            "Assessing", "Refining", "Reviewing", "Exploring", "Examining",
                            "Gathering", "Consulting"
                        ]
                         for verb in THINKING_VERBS:
                             if text.strip().startswith(verb):
                                 # If it looks like a short thinking sentence, treat as empty
                                 return ""
                    
                    return text

                try:
                    response_element = WebDriverWait(browser_instance, 50).until(
                        lambda d: find_new_response_with_text(d, initial_response_count, RESPONSE_CONTENT_SELECTOR)
                    )
                    logger.info("Response element detected. Starting to stream.")
                    # Don't send "streaming" yet, wait for actual content
                except TimeoutException:
                    logger.error("Timed out waiting for a response from NotebookLM.")
                    yield f'data: {json.dumps({"error": "NotebookLM did not start generating a response in time."})}\n\n'
                    return

                last_clean_text = ""
                end_time = time.time() + timeout
                stream_completed = False
                last_change_time = time.time()
                SILENCE_TIMEOUT = 6
                
                material_started = False
                
                # Buffer for small chunks to ensure we don't send "thinking" blips
                # or tiny updates that cause jitter.
                chunk_buffer = ""
                MIN_WORD_COUNT = 10 

                while time.time() < end_time:
                    # 1. Get Raw Text
                    raw_text = safe_get_element_text(browser_instance, RESPONSE_CONTENT_SELECTOR)
                    
                    # 2. Clean Text (Strip Thinking)
                    current_clean_text = strip_thinking_phrase(raw_text)
                    
                    # 3. Handle Thinking State - Just swallow it, don't report status="thinking"
                    if not current_clean_text.strip():
                        time.sleep(0.2)
                        continue
                    
                    # 4. Handle Content Streaming
                    # Check for replacement (Discontinuity)
                    if last_clean_text and not current_clean_text.startswith(last_clean_text):
                         logger.info(f"Discontinuity in CLEAN text. Resetting. (Old: '{last_clean_text[:20]}...', New: '{current_clean_text[:20]}...')")
                         last_clean_text = ""
                         chunk_buffer = "" # Reset buffer on discontinuity
                    
                    # Calculate Chunk
                    if len(current_clean_text) > len(last_clean_text):
                        new_fragment = current_clean_text[len(last_clean_text):]
                        chunk_buffer += new_fragment
                        
                        # Only yield if we have enough words in the buffer OR it's been a while?
                        # User requested: "replay back ... with data chunks that are greated than 10 words"
                        
                        buffer_word_count = len(chunk_buffer.split())
                        
                        if buffer_word_count >= MIN_WORD_COUNT:
                             if not material_started:
                                logger.info("Material content started (buffer threshold met).")
                                yield f'data: {json.dumps({"status": "streaming"})}\n\n'
                                material_started = True
                             
                             # Yield the whole buffer
                             yield f'data: {json.dumps({"chunk": chunk_buffer})}\n\n'
                             chunk_buffer = "" # Clear buffer
                        
                        last_clean_text = current_clean_text
                        last_change_time = time.time()
                    
                    # 5. Completion Detection (End of Data - Silence-based)
                    # Check if content has stopped changing (no new chunks = end of stream)
                    if material_started:
                        silence_duration = time.time() - last_change_time
                        if silence_duration > SILENCE_TIMEOUT:
                             logger.info(f"🎯 COMPLETION DETECTED: No new content for {SILENCE_TIMEOUT}s (end of data chunks)")
                             stream_completed = True
                             break
                    
                    time.sleep(0.2)
                
                # Final flush - safely get any remaining text AND flush buffer
                final_raw = safe_get_element_text(browser_instance, RESPONSE_CONTENT_SELECTOR)
                final_clean = strip_thinking_phrase(final_raw)
                
                # If there's new text we haven't seen in chunks checks
                if len(final_clean) > len(last_clean_text):
                    new_fragment = final_clean[len(last_clean_text):]
                    chunk_buffer += new_fragment
                
                # Flush any remaining buffer
                if chunk_buffer:
                    if not material_started:
                         yield f'data: {json.dumps({"status": "streaming"})}\n\n'
                    yield f'data: {json.dumps({"chunk": chunk_buffer})}\n\n'

                # Signal end of streaming
                yield f'data: {json.dumps({"status": "end_of_stream"})}\n\n'

                # Determine final status
                if not stream_completed:
                    logger.warning(f"Query timed out after {timeout} seconds - cleanup will proceed")
                    status_message = "timeout"
                else:
                    logger.info("Query completed successfully")
                    status_message = "complete"
                    
                yield f'data: {json.dumps({"status": status_message})}\n\n'




            except Exception as e:
                logger.error(f"An unexpected error occurred during the query stream: {e}", exc_info=True)
                yield f'data: {json.dumps({"error": str(e)})}\n\n'
            
            finally:
                # --- DEBUGGING: Capture screenshot before closing ---
                try:
                    if browser_instance:
                        log_dir = os.environ.get('LOG_DIR', './logs')
                        os.makedirs(log_dir, exist_ok=True)
                        screenshot_path = os.path.join(log_dir, f"last_query_{int(time.time())}.png")
                        browser_instance.save_screenshot(screenshot_path)
                        logger.info(f"DEBUG: Saved post-query screenshot to {screenshot_path}")
                except Exception as screenshot_err:
                    logger.warning(f"DEBUG: Failed to save screenshot: {screenshot_err}")

                # CLEANUP: Conditional based on dev_mode
                if dev_mode:
                    logger.info("🔧 DEV MODE: Keeping browser open for next query")
                    yield f'data: {json.dumps({"status": "dev_mode_active", "message": "Browser kept open"})}\n\n'
                else:
                    logger.info("Cleaning up browser session (production mode)")
                    reset_browser()
                    yield f'data: {json.dumps({"status": "browser_closed"})}\n\n'


    return Response(stream_with_context(generate_full_process_response()), mimetype='text/event-stream')

@notebooklm_bp.route('/status', methods=['GET'])
def get_status():
    """Endpoint 2: Checks the status of the browser instance."""
    with browser_lock:
        if browser_instance:
            try:
                current_url = browser_instance.current_url
                page_title = browser_instance.title
                status = 'ready'
                if 'accounts.google.com' in current_url or 'signin' in current_url.lower():
                    status = 'authentication_required'
                
                return jsonify({
                    'browser_active': True,
                    'status': status,
                    'current_url': current_url,
                    'page_title': page_title
                })
            except Exception as e:
                logger.error(f"Error getting browser status: {e}")
                # IMPORTANT: If we can't get status, the session is likely dead. Reset it.
                reset_browser()
                return jsonify({'browser_active': False, 'status': 'error', 'error': str(e)}), 500
        else:
            return jsonify({'browser_active': False, 'status': 'inactive'})

@notebooklm_bp.route('/close_browser', methods=['POST'])
def close_browser_endpoint():
    """
    Endpoint for manually closing the browser (primarily for dev mode).
    Allows users to close the browser session via UI button.
    """
    global browser_instance
    with browser_lock:
        if browser_instance:
            try:
                logger.info("🔧 Manual browser close requested")
                reset_browser()
                return jsonify({
                    'success': True, 
                    'message': 'Browser closed successfully'
                })
            except Exception as e:
                logger.error(f"Error closing browser: {e}")
                return jsonify({
                    'success': False, 
                    'message': f'Error closing browser: {str(e)}'
                }), 500
        else:
            return jsonify({
                'success': False, 
                'message': 'No active browser session to close'
            })

@notebooklm_bp.route('/browser_status', methods=['GET'])
def browser_status_endpoint():
    """
    Get detailed browser status information.
    Useful for UI to show whether browser is active and what page it's on.
    """
    global browser_instance
    with browser_lock:
        if browser_instance:
            try:
                current_url = browser_instance.current_url
                session_id = browser_instance.session_id
                return jsonify({
                    'active': True,
                    'url': current_url,
                    'session_id': session_id,
                    'on_notebooklm': 'notebooklm.google.com' in current_url
                })
            except Exception as e:
                logger.warning(f"Browser session appears stale: {e}")
                return jsonify({
                    'active': False,
                    'error': 'Browser session is stale'
                })
        else:
            return jsonify({'active': False})


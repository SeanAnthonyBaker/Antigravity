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
    """
    global browser_instance
    try:
        if browser_instance:
            browser_instance.quit()
            logger.info("Browser instance quit successfully.")
    except Exception as e:
        logger.warning(f"Error quitting browser instance (likely already dead): {e}")
    finally:
        browser_instance = None

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
    chrome_options.add_argument("--disable-gpu")
    chrome_options.add_argument("--window-size=1920,1080")
    chrome_options.add_argument('--disable-blink-features=AutomationControlled')
    chrome_options.add_experimental_option("excludeSwitches", ["enable-automation"])
    
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

def start_browser_initialization_thread():
    """Starts the browser initialization in a background thread to not block app startup."""
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
    Consolidated Endpoint: Opens NotebookLM, submits a query, streams the response, and closes the browser.
    """
    logger.info("VERSION: STRICT_THINKING_LOGIC_V2 - Starting process_query")
    data = request.get_json()
    if not data or 'query' not in data:
        return jsonify({'error': 'Missing "query" in request body'}), 400
    
    url = data.get('notebooklm_url', "https://notebooklm.google.com/")
    logger.info(f"DEBUG: process_query received URL: '{url}'")
    query_text = data['query']
    timeout = data.get('timeout', 180)

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
                
                # BASELINE: Count suggestion chips before query
                initial_suggestion_count = count_all_suggestions(browser_instance)
                logger.info(f"BASELINE: {initial_suggestion_count} suggestion chips found before query")
                
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

                try:
                    response_element = WebDriverWait(browser_instance, 50).until(
                        lambda d: find_new_response_with_text(d, initial_response_count, RESPONSE_CONTENT_SELECTOR)
                    )
                    logger.info("Response element detected. Starting to stream.")
                    yield f'data: {json.dumps({"status": "streaming"})}\n\n'
                except TimeoutException:
                    logger.error("Timed out waiting for a response from NotebookLM.")
                    yield f'data: {json.dumps({"error": "NotebookLM did not start generating a response in time."})}\n\n'
                    return

                last_text = ""
                end_time = time.time() + timeout
                stream_completed = False
                last_change_time = time.time()
                SILENCE_TIMEOUT = 6  # Seconds of no growth to complete
                MATERIAL_CHUNK_SIZE = 30  # Chunk size that indicates real content (lowered for reliability)
                
                # State: have we seen material chunks yet?
                material_started = False
                
                # DOM logging during streaming
                last_dom_snapshot_time = time.time()
                DOM_SNAPSHOT_INTERVAL = 3  # Take a snapshot every 3 seconds during streaming
                streaming_snapshot_count = 0
                while time.time() < end_time:
                    # Safely get current text with retry logic
                    current_text = safe_get_element_text(browser_instance, RESPONSE_CONTENT_SELECTOR)
                    
                    # --- CONTINUITY CHECK (The Robust Fix) ---
                    # If the new text doesn't start with the old text, it means the content 
                    # was REPLACED (e.g., "Thinking..." -> "Actual Answer").
                    # We must reset last_text to capture the full new content.
                    if last_text and not current_text.startswith(last_text):
                        logger.info(f"Content discontinuity detected (Replacement). Resetting tracking. (Old: '{last_text[:20]}...', New: '{current_text[:20]}...')")
                        last_text = ""

                    # Detect if current text is a thinking phrase (to suppress it)
                    current_is_thinking = is_only_thinking_phrase(current_text)

                    # Detect text growth
                    if len(current_text) > len(last_text):
                        new_chunk = current_text[len(last_text):]
                        chunk_size = len(new_chunk)
                        
                        # Skip sending thinking phrases
                        if not current_is_thinking:
                            # Check if this is a material chunk
                            if chunk_size >= MATERIAL_CHUNK_SIZE and not material_started:
                                logger.info(f"Material content detected (chunk: {chunk_size} chars). Starting silence timer.")
                                material_started = True
                            
                            yield f'data: {json.dumps({"chunk": new_chunk})}\n\n'
                            
                            # Update last_text ONLY if we sent the chunk
                            last_text = current_text
                            last_change_time = time.time()
                        else:
                            logger.debug(f"Skipping thinking phrase chunk: {new_chunk[:50]}...")
                            # Track thinking phrases so we can detect the transition later
                            last_text = current_text
                            last_change_time = time.time()


                    # PRIMARY COMPLETION DETECTION: New suggestion chips appeared
                    current_suggestion_count = count_all_suggestions(browser_instance)
                    if current_suggestion_count > initial_suggestion_count:
                        logger.info(f"🎯 COMPLETION DETECTED: Suggestion chips increased from {initial_suggestion_count} to {current_suggestion_count}")
                        stream_completed = True
                        break

                    # FALLBACK COMPLETION: Silence detection (only if material content started)
                    # Completion logic
                    # ONLY complete if we've seen material content AND there's been silence
                    if material_started:
                        silence_duration = time.time() - last_change_time
                        if silence_duration > SILENCE_TIMEOUT:
                            logger.info(f"Stream complete: {SILENCE_TIMEOUT}s silence after material content.")
                            stream_completed = True
                            break
                    
                    time.sleep(0.2)

                # Final flush - safely get any remaining text
                final_text = safe_get_element_text(browser_instance, RESPONSE_CONTENT_SELECTOR)
                if len(final_text) > len(last_text):
                    new_chunk = final_text[len(last_text):]
                    yield f'data: {json.dumps({"chunk": new_chunk})}\n\n'

                logger.info("Query completed successfully")


                status_message = "timeout" if not stream_completed else "complete"
                yield f'data: {json.dumps({"status": status_message})}\n\n'





            except Exception as e:
                logger.error(f"An unexpected error occurred during the query stream: {e}", exc_info=True)
                yield f'data: {json.dumps({"error": str(e)})}\n\n'
            
            finally:
                # 3. Close Browser
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

